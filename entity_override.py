"""Forzature temporanee di entità Home Assistant qualsiasi.

Una forzatura imposta un valore su un'entità (interruttore, numero, select, termostato...) e,
alla scadenza, rimette il valore che l'entità aveva prima. Forzature attive e storico stanno
nella tabella ``forzature_entita`` del database dell'istanza, così sopravvivono ai riavvii di
Home Assistant (le scadenze passate a sistema spento vengono ripristinate all'avvio) e finiscono
nei backup insieme al resto.

Ogni forzatura agisce sullo stato dell'entità oppure su un suo attributo (``attribute``):
la temperatura impostata di un termostato o la posizione di una tapparella.

Durante la forzatura i cambi fatti da altri (a mano, da automazioni, dal dispositivo) vengono
riconosciuti confrontando il ``context`` dello stato con quello delle chiamate di Mia Config:
- ``enforce``: il valore forzato viene rimesso subito, per tutto il periodo;
- ``restore_to``: alla fine si torna al valore originale (``original``) oppure all'ultimo
  valore impostato da altri durante la forzatura (``last_manual``, se c'è).
"""
from __future__ import annotations

import json
import logging
import threading
from collections import deque
from datetime import datetime, timedelta
from typing import Any, Callable

from homeassistant.const import EVENT_HOMEASSISTANT_STARTED, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import Context, CoreState, Event, HomeAssistant, State, callback
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers.event import (
    async_call_later,
    async_track_point_in_time,
    async_track_state_change_event,
)
from homeassistant.util import dt as dt_util

_LOGGER = logging.getLogger(__name__)

# Nuovo tentativo di ripristino se l'entità non risponde (es. dispositivo offline)
RETRY_INTERVAL = timedelta(minutes=1)
MAX_RESTORE_ATTEMPTS = 60

# Valore da rimettere alla fine della forzatura
RESTORE_ORIGINAL = "original"          # quello che c'era prima della forzatura
RESTORE_LAST_MANUAL = "last_manual"    # l'ultimo impostato da altri durante la forzatura (se c'è)
RESTORE_OPTIONS = (RESTORE_ORIGINAL, RESTORE_LAST_MANUAL)

# Mantenimento forzato: attesa prima di rimettere il valore e limite di ri-applicazioni
ENFORCE_DELAY_SECONDS = 2
ENFORCE_WINDOW = timedelta(minutes=10)
ENFORCE_MAX_IN_WINDOW = 10

# Motivi di chiusura salvati nello storico
END_EXPIRED = "expired"          # scaduta: valore originale ripristinato
END_CANCELLED = "cancelled"      # annullata dall'utente: valore originale ripristinato
END_RELEASED = "released"        # annullata lasciando il valore attuale
END_REPLACED = "replaced"        # sostituita da una nuova forzatura sulla stessa entità
END_FAILED = "restore_failed"    # ripristino non riuscito dopo tutti i tentativi

TOGGLE_DOMAINS = {
    "switch", "light", "fan", "input_boolean", "automation", "siren", "humidifier", "remote",
}
NUMBER_DOMAINS = {"input_number", "number"}
SELECT_DOMAINS = {"input_select", "select"}
TEXT_DOMAINS = {"input_text", "text"}
TEMPERATURE_DOMAINS = {"climate", "water_heater"}
POSITION_DOMAINS = {"cover", "valve"}
SUPPORTED_DOMAINS = (
    TOGGLE_DOMAINS | NUMBER_DOMAINS | SELECT_DOMAINS | TEXT_DOMAINS
    | TEMPERATURE_DOMAINS | POSITION_DOMAINS | {"lock"}
)

_TRUE = {"on", "true", "1", "yes", "acceso"}
_FALSE = {"off", "false", "0", "no", "spento"}


def _number_text(value: Any) -> str:
    """Numero come testo senza decimali inutili (21.0 -> '21')."""
    number = float(value)
    return str(int(number)) if number.is_integer() else str(number)


def _parse_number(value: str, what: str = "un numero") -> float:
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError) as err:
        raise ServiceValidationError(f"Il valore '{value}' non è {what}") from err


def _domain(entity_id: str) -> str:
    return entity_id.split(".", 1)[0]


def resolve_target(state: State, value: str) -> tuple[str | None, str]:
    """Decide cosa modificare e normalizza il valore richiesto.

    Restituisce (attributo o None per lo stato, valore normalizzato).
    """
    domain = _domain(state.entity_id)
    text = str(value).strip()
    lower = text.lower()

    if domain in TOGGLE_DOMAINS:
        if lower in _TRUE:
            return None, "on"
        if lower in _FALSE:
            return None, "off"
        raise ServiceValidationError(f"Valore '{value}' non valido per {state.entity_id}: usa on oppure off")

    if domain in NUMBER_DOMAINS:
        number = _parse_number(text)
        attrs = state.attributes
        if "min" in attrs and number < float(attrs["min"]) or "max" in attrs and number > float(attrs["max"]):
            raise ServiceValidationError(
                f"Il valore {_number_text(number)} è fuori dall'intervallo {attrs.get('min')} – {attrs.get('max')}"
            )
        return None, _number_text(number)

    if domain in SELECT_DOMAINS:
        options = state.attributes.get("options") or []
        if options and text not in options:
            raise ServiceValidationError(f"'{value}' non è tra le opzioni di {state.entity_id}: {', '.join(options)}")
        return None, text

    if domain in TEXT_DOMAINS:
        return None, text

    if domain in TEMPERATURE_DOMAINS:
        return "temperature", _number_text(_parse_number(text, "una temperatura"))

    if domain in POSITION_DOMAINS:
        if lower in {"open", "opened", "aperta", "aperto", "on"}:
            return None, "open"
        if lower in {"closed", "close", "chiusa", "chiuso", "off"}:
            return None, "closed"
        position = _parse_number(text, "una posizione (0-100) né open/closed")
        if not 0 <= position <= 100:
            raise ServiceValidationError("La posizione deve essere tra 0 e 100")
        return "current_position", _number_text(position)

    if domain == "lock":
        if lower in {"locked", "lock", "bloccata", "chiusa", "on"}:
            return None, "locked"
        if lower in {"unlocked", "unlock", "sbloccata", "aperta", "off"}:
            return None, "unlocked"
        raise ServiceValidationError(f"Valore '{value}' non valido per {state.entity_id}: usa locked oppure unlocked")

    raise ServiceValidationError(
        f"Il dominio '{domain}' non è supportato. Domini supportati: {', '.join(sorted(SUPPORTED_DOMAINS))}"
    )


def read_value(state: State, attribute: str | None) -> str | None:
    """Legge il valore attuale (stato o attributo) nello stesso formato usato da resolve_target."""
    if attribute:
        raw = state.attributes.get(attribute)
        return None if raw is None else _number_text(raw)
    if state.state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
        return None
    domain = _domain(state.entity_id)
    if domain in NUMBER_DOMAINS:
        # Lo stato di input_number è "50.0": stesso formato del valore forzato ("50")
        try:
            return _number_text(state.state)
        except ValueError:
            return state.state
    if domain in POSITION_DOMAINS:
        return {"opening": "open", "closing": "closed"}.get(state.state, state.state)
    if domain == "lock":
        return {"locking": "locked", "unlocking": "unlocked"}.get(state.state, state.state)
    return state.state


def capture_extra(state: State, attribute: str | None) -> dict[str, Any]:
    """Attributi utili a ripristinare fedelmente il valore originale (es. luminosità di una luce)."""
    if _domain(state.entity_id) == "light" and state.state == "on":
        extra = {}
        if state.attributes.get("brightness") is not None:
            extra["brightness"] = state.attributes["brightness"]
        if state.attributes.get("color_mode") == "color_temp" and state.attributes.get("color_temp_kelvin"):
            extra["color_temp_kelvin"] = state.attributes["color_temp_kelvin"]
        return extra
    return {}


async def apply_value(
    hass: HomeAssistant, entity_id: str, attribute: str | None, value: str,
    extra: dict | None = None, context: Context | None = None,
) -> None:
    """Imposta il valore sull'entità con il servizio adatto al dominio."""
    domain = _domain(entity_id)
    data: dict[str, Any] = {"entity_id": entity_id}

    if domain in TOGGLE_DOMAINS:
        service_domain, service = domain, ("turn_on" if value == "on" else "turn_off")
        if value == "on" and extra:
            data.update(extra)
    elif domain in NUMBER_DOMAINS:
        service_domain, service = domain, "set_value"
        data["value"] = float(value)
    elif domain in SELECT_DOMAINS:
        service_domain, service = domain, "select_option"
        data["option"] = value
    elif domain in TEXT_DOMAINS:
        service_domain, service = domain, "set_value"
        data["value"] = value
    elif domain in TEMPERATURE_DOMAINS:
        service_domain, service = domain, "set_temperature"
        data["temperature"] = float(value)
    elif domain in POSITION_DOMAINS:
        service_domain = domain
        if attribute == "current_position":
            service = f"set_{domain}_position"
            data["position"] = int(float(value))
        else:
            service = f"open_{domain}" if value == "open" else f"close_{domain}"
    elif domain == "lock":
        service_domain, service = "lock", ("lock" if value == "locked" else "unlock")
    else:
        raise ServiceValidationError(f"Il dominio '{domain}' non è supportato")

    await hass.services.async_call(service_domain, service, data, blocking=True, context=context)


def _iso(value: datetime | None) -> str | None:
    return dt_util.as_utc(value).isoformat() if value else None


def _parse(value: str | None) -> datetime | None:
    return dt_util.parse_datetime(value) if value else None


class EntityOverrideManager:
    """Forzature temporanee di entità per un'istanza Mia Config (un database)."""

    def __init__(self, hass: HomeAssistant, db, entry_id: str) -> None:
        self.hass = hass
        self._db = db  # ConfigDatabase: si usa sempre db.conn (riaperta dopo un ripristino da backup)
        self.entry_id = entry_id
        self._lock = threading.Lock()
        self._active: dict[str, dict[str, Any]] = {}
        self._timers: dict[str, Callable[[], None]] = {}
        self._listeners: list[Callable[[], None]] = []
        self._unsub_started: Callable[[], None] | None = None
        # Cambi di stato esterni: ascolto per entità e context delle chiamate fatte da Mia Config
        self._watchers: dict[str, Callable[[], None]] = {}
        self._own_contexts: dict[str, deque] = {}
        self._enforce_pending: dict[str, Callable[[], None]] = {}
        self._enforce_log: dict[str, list[datetime]] = {}

    # ----- Database (eseguito nell'executor) -----

    def _create_tables(self) -> None:
        with self._lock:
            conn = self._db.conn
            conn.execute("""
                CREATE TABLE IF NOT EXISTS forzature_entita (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entity_id TEXT NOT NULL,
                    attribute TEXT,
                    value TEXT NOT NULL,
                    original_value TEXT,
                    original_extra TEXT,
                    started_at TEXT NOT NULL,
                    valid_to TEXT,
                    ended_at TEXT,
                    end_reason TEXT,
                    restore_attempts INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT,
                    active INTEGER NOT NULL DEFAULT 1
                )
            """)
            # Colonne aggiunte dopo la prima versione della tabella
            columns = {row[1] for row in conn.execute("PRAGMA table_info(forzature_entita)")}
            for name, definition in (
                ("enforce", "INTEGER NOT NULL DEFAULT 0"),
                ("restore_to", f"TEXT NOT NULL DEFAULT '{RESTORE_ORIGINAL}'"),
                ("last_manual_value", "TEXT"),
                ("last_manual_extra", "TEXT"),
                ("last_manual_at", "TEXT"),
                ("restored_value", "TEXT"),
            ):
                if name not in columns:
                    conn.execute(f"ALTER TABLE forzature_entita ADD COLUMN {name} {definition}")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_forzature_attive ON forzature_entita(active, entity_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_forzature_storico ON forzature_entita(entity_id, started_at)")
            conn.commit()

    def _fetch_active(self) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._db.conn.execute(
                "SELECT * FROM forzature_entita WHERE active = 1 ORDER BY started_at"
            ).fetchall()
        return [dict(row) for row in rows]

    def _insert(self, row: dict[str, Any], replaced_id: int | None) -> int:
        with self._lock:
            conn = self._db.conn
            try:
                if replaced_id is not None:
                    conn.execute(
                        "UPDATE forzature_entita SET active = 0, ended_at = ?, end_reason = ? WHERE id = ?",
                        (row["started_at"], END_REPLACED, replaced_id),
                    )
                cursor = conn.execute(
                    """INSERT INTO forzature_entita
                       (entity_id, attribute, value, original_value, original_extra, started_at, valid_to,
                        enforce, restore_to)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (row["entity_id"], row["attribute"], row["value"], row["original_value"],
                     row["original_extra"], row["started_at"], row["valid_to"],
                     int(row["enforce"]), row["restore_to"]),
                )
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            return cursor.lastrowid

    def _end(self, row_id: int, reason: str, error: str | None = None, restored_value: str | None = None) -> None:
        with self._lock:
            self._db.conn.execute(
                """UPDATE forzature_entita SET active = 0, ended_at = ?, end_reason = ?,
                   last_error = COALESCE(?, last_error), restored_value = ? WHERE id = ?""",
                (_iso(dt_util.utcnow()), reason, error, restored_value, row_id),
            )
            self._db.conn.commit()

    def _record_manual(self, row_id: int, value: str, extra: str | None, at: str) -> None:
        with self._lock:
            self._db.conn.execute(
                "UPDATE forzature_entita SET last_manual_value = ?, last_manual_extra = ?, last_manual_at = ? WHERE id = ?",
                (value, extra, at, row_id),
            )
            self._db.conn.commit()

    def _record_failure(self, row_id: int, attempts: int, error: str) -> None:
        with self._lock:
            self._db.conn.execute(
                "UPDATE forzature_entita SET restore_attempts = ?, last_error = ? WHERE id = ?",
                (attempts, error, row_id),
            )
            self._db.conn.commit()

    def _fetch_history(self, entity_id: str | None, limit: int, offset: int) -> list[dict[str, Any]]:
        query = "SELECT * FROM forzature_entita"
        params: list[Any] = []
        if entity_id:
            query += " WHERE entity_id = ?"
            params.append(entity_id)
        query += " ORDER BY started_at DESC, id DESC LIMIT ? OFFSET ?"
        params += [limit, offset]
        with self._lock:
            rows = self._db.conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]

    def cleanup_history(self, retention_days: int) -> int:
        """Elimina dallo storico le forzature concluse da più di retention_days giorni."""
        cutoff = _iso(dt_util.utcnow() - timedelta(days=retention_days))
        with self._lock:
            cursor = self._db.conn.execute(
                "DELETE FROM forzature_entita WHERE active = 0 AND ended_at < ?", (cutoff,)
            )
            self._db.conn.commit()
        return cursor.rowcount

    # ----- Ciclo di vita -----

    async def async_load(self) -> None:
        """Carica le forzature attive e pianifica i ripristini (anche dopo un ripristino da backup)."""
        self._cancel_timers()
        await self.hass.async_add_executor_job(self._create_tables)
        rows = await self.hass.async_add_executor_job(self._fetch_active)
        self._active = {row["entity_id"]: row for row in rows}
        if self.hass.state is CoreState.running:
            self._schedule_all()
        elif self._unsub_started is None:
            # All'avvio le entità da ripristinare potrebbero non esistere ancora
            @callback
            def _started(_event) -> None:
                self._unsub_started = None
                self._schedule_all()
            self._unsub_started = self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _started)
        self._notify()

    @callback
    def async_unload(self) -> None:
        """Ferma i timer senza ripristinare: al prossimo avvio le forzature vengono ricaricate."""
        self._cancel_timers()
        self._own_contexts.clear()
        if self._unsub_started:
            self._unsub_started()
            self._unsub_started = None
        self._listeners.clear()

    def _cancel_timers(self) -> None:
        for timers in (self._timers, self._watchers, self._enforce_pending):
            for unsub in timers.values():
                unsub()
            timers.clear()

    @callback
    def _schedule_all(self) -> None:
        for row in list(self._active.values()):
            self._schedule(row)
            self._watch(row["entity_id"])
            if row.get("enforce"):
                self._request_enforce(row["entity_id"])

    # ----- Cambi esterni durante la forzatura -----

    async def _apply(self, entity_id: str, attribute: str | None, value: str, extra: dict | None = None) -> None:
        """Applica un valore ricordando il context, così il cambio non viene scambiato per manuale."""
        context = Context()
        self._own_contexts.setdefault(entity_id, deque(maxlen=20)).append(context.id)
        await apply_value(self.hass, entity_id, attribute, value, extra, context)

    @callback
    def _watch(self, entity_id: str) -> None:
        if entity_id not in self._watchers:
            self._watchers[entity_id] = async_track_state_change_event(
                self.hass, [entity_id], self._on_state_change
            )

    @callback
    def _on_state_change(self, event: Event) -> None:
        entity_id = event.data.get("entity_id")
        row = self._active.get(entity_id)
        new_state = event.data.get("new_state")
        if row is None or new_state is None:
            return
        own = self._own_contexts.get(entity_id, ())
        context = new_state.context
        if context is not None and (context.id in own or context.parent_id in own):
            return
        if _domain(entity_id) in POSITION_DOMAINS and new_state.state in ("opening", "closing"):
            return  # in movimento: si guarda la posizione finale
        value = read_value(new_state, row["attribute"])
        if value is None or value == row["value"]:
            return
        if value != row.get("last_manual_value"):
            extra = capture_extra(new_state, row["attribute"])
            row["last_manual_value"] = value
            row["last_manual_extra"] = json.dumps(extra) if extra else None
            row["last_manual_at"] = _iso(dt_util.utcnow())
            _LOGGER.info("%s cambiato dall'esterno durante la forzatura: %s", entity_id, value)
            self.hass.async_create_task(self.hass.async_add_executor_job(
                self._record_manual, row["id"], value, row["last_manual_extra"], row["last_manual_at"]
            ))
            self._notify()
        if row.get("enforce"):
            self._request_enforce(entity_id)

    @callback
    def _request_enforce(self, entity_id: str) -> None:
        """Rimette il valore forzato dopo un attimo (più cambi ravvicinati vengono raggruppati)."""
        if entity_id in self._enforce_pending:
            return

        async def _run(_now) -> None:
            self._enforce_pending.pop(entity_id, None)
            await self._async_enforce(entity_id)

        self._enforce_pending[entity_id] = async_call_later(self.hass, ENFORCE_DELAY_SECONDS, _run)

    async def _async_enforce(self, entity_id: str) -> None:
        row = self._active.get(entity_id)
        state = self.hass.states.get(entity_id)
        if row is None or not row.get("enforce") or state is None:
            return
        current = read_value(state, row["attribute"])
        if current is None or current == row["value"]:
            return
        now = dt_util.utcnow()
        log = [at for at in self._enforce_log.get(entity_id, []) if now - at < ENFORCE_WINDOW]
        if len(log) >= ENFORCE_MAX_IN_WINDOW:
            _LOGGER.warning("%s continua a cambiare: valore forzato non rimesso (troppi tentativi in %s)",
                            entity_id, ENFORCE_WINDOW)
            self._enforce_log[entity_id] = log
            return
        self._enforce_log[entity_id] = log + [now]
        try:
            await self._apply(entity_id, row["attribute"], row["value"])
            _LOGGER.info("Forzatura mantenuta: %s rimesso a %s", entity_id, row["value"])
        except Exception as err:
            _LOGGER.warning("Impossibile rimettere %s a %s: %s", entity_id, row["value"], err)

    @callback
    def _schedule(self, row: dict[str, Any], at: datetime | None = None) -> None:
        entity_id = row["entity_id"]
        if unsub := self._timers.pop(entity_id, None):
            unsub()
        when = at or _parse(row["valid_to"])
        if when is None:
            return  # senza scadenza
        when = max(when, dt_util.utcnow() + timedelta(seconds=1))
        row_id = row["id"]

        async def _expire(_now) -> None:
            self._timers.pop(entity_id, None)
            await self._async_expire(entity_id, row_id)

        self._timers[entity_id] = async_track_point_in_time(self.hass, _expire, when)

    # ----- Ascoltatori (sensore) -----

    @callback
    def add_listener(self, listener: Callable[[], None]) -> Callable[[], None]:
        self._listeners.append(listener)

        def _remove() -> None:
            if listener in self._listeners:
                self._listeners.remove(listener)
        return _remove

    @callback
    def _notify(self) -> None:
        for listener in list(self._listeners):
            listener()

    # ----- API -----

    def has_active(self, entity_id: str) -> bool:
        return entity_id in self._active

    @property
    def active(self) -> list[dict[str, Any]]:
        """Forzature attive in forma pubblicabile (attributi del sensore)."""
        result = []
        for row in self._active.values():
            state = self.hass.states.get(row["entity_id"])
            result.append({
                "id": row["id"],
                "entity_id": row["entity_id"],
                "name": state.name if state else row["entity_id"],
                "attribute": row["attribute"],
                "value": row["value"],
                "original_value": row["original_value"],
                "started_at": row["started_at"],
                "valid_to": row["valid_to"],
                "enforce": bool(row.get("enforce")),
                "restore_to": row.get("restore_to") or RESTORE_ORIGINAL,
                "last_manual_value": row.get("last_manual_value"),
                "last_manual_at": row.get("last_manual_at"),
                "restore_value": self._restore_target(row)[0],
                "restore_attempts": row.get("restore_attempts", 0),
                "last_error": row.get("last_error"),
            })
        return sorted(result, key=lambda item: item["started_at"])

    async def async_set(
        self, entity_id: str, value: str, valid_to: datetime | None,
        enforce: bool = False, restore_to: str = RESTORE_ORIGINAL,
    ) -> dict[str, Any]:
        """Imposta il valore e pianifica il ripristino. Una forzatura già attiva viene sostituita
        mantenendo il valore originale di partenza."""
        if restore_to not in RESTORE_OPTIONS:
            raise ServiceValidationError(f"restore_to non valido: {restore_to} ({', '.join(RESTORE_OPTIONS)})")
        state = self.hass.states.get(entity_id)
        if state is None:
            raise ServiceValidationError(f"Entità non trovata: {entity_id}")
        if valid_to is not None and valid_to <= dt_util.utcnow():
            raise ServiceValidationError("La scadenza deve essere nel futuro")
        attribute, target = resolve_target(state, value)

        existing = self._active.get(entity_id)
        if existing and existing["attribute"] == attribute:
            original_value = existing["original_value"]
            original_extra = existing["original_extra"]
        else:
            original_value = read_value(state, attribute)
            extra = capture_extra(state, attribute)
            original_extra = json.dumps(extra) if extra else None
            if original_value is None:
                raise ServiceValidationError(
                    f"Impossibile leggere il valore attuale di {entity_id}: non sarebbe possibile ripristinarlo"
                )

        try:
            await self._apply(entity_id, attribute, target)
        except HomeAssistantError:
            raise
        except Exception as err:
            raise HomeAssistantError(f"Impossibile impostare {entity_id} a {target}: {err}") from err

        row = {
            "entity_id": entity_id,
            "attribute": attribute,
            "value": target,
            "original_value": original_value,
            "original_extra": original_extra,
            "started_at": _iso(dt_util.utcnow()),
            "valid_to": _iso(valid_to),
            "enforce": bool(enforce),
            "restore_to": restore_to,
            "last_manual_value": None,
            "last_manual_extra": None,
            "last_manual_at": None,
            "restore_attempts": 0,
            "last_error": None,
        }
        row["id"] = await self.hass.async_add_executor_job(
            self._insert, row, existing["id"] if existing else None
        )
        self._active[entity_id] = row
        self._schedule(row)
        self._watch(entity_id)
        _LOGGER.info(
            "Forzatura %s%s = %s (originale %s) fino a %s%s, alla fine torna a %s",
            entity_id, f".{attribute}" if attribute else "", target, original_value,
            row["valid_to"] or "senza scadenza", ", mantenuta" if enforce else "", restore_to,
        )
        self._notify()
        return row

    async def async_clear(self, entity_id: str, restore: bool = True) -> None:
        """Termina la forzatura; con restore rimette subito il valore originale."""
        row = self._active.get(entity_id)
        if row is None:
            raise ServiceValidationError(f"Nessuna forzatura attiva su {entity_id}")
        restored = await self._async_restore(row) if restore else None
        await self.hass.async_add_executor_job(
            self._end, row["id"], END_CANCELLED if restore else END_RELEASED, None, restored
        )
        self._finish(entity_id)

    async def async_history(self, entity_id: str | None = None, limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
        rows = await self.hass.async_add_executor_job(self._fetch_history, entity_id, limit, offset)
        for row in rows:
            row["active"] = bool(row["active"])
            row["enforce"] = bool(row.get("enforce"))
            row.pop("original_extra", None)
            row.pop("last_manual_extra", None)
        return rows

    @staticmethod
    def _restore_target(row: dict[str, Any]) -> tuple[str | None, str | None]:
        """(valore, extra JSON) da rimettere: l'ultimo manuale se richiesto e presente, altrimenti l'originale."""
        if row.get("restore_to") == RESTORE_LAST_MANUAL and row.get("last_manual_value") is not None:
            return row["last_manual_value"], row.get("last_manual_extra")
        return row["original_value"], row.get("original_extra")

    async def _async_restore(self, row: dict[str, Any]) -> str:
        """Rimette il valore finale e lo restituisce."""
        entity_id = row["entity_id"]
        state = self.hass.states.get(entity_id)
        if state is None or state.state == STATE_UNAVAILABLE:
            raise HomeAssistantError(f"{entity_id} non è disponibile")
        value, extra_json = self._restore_target(row)
        if value is None:
            raise HomeAssistantError(f"Valore originale di {entity_id} sconosciuto")
        extra = json.loads(extra_json) if extra_json else None
        try:
            await self._apply(entity_id, row["attribute"], value, extra)
        except HomeAssistantError:
            raise
        except Exception as err:
            raise HomeAssistantError(str(err)) from err
        return value

    async def _async_expire(self, entity_id: str, row_id: int) -> None:
        row = self._active.get(entity_id)
        if row is None or row["id"] != row_id:
            return
        try:
            restored = await self._async_restore(row)
        except Exception as err:
            attempts = row.get("restore_attempts", 0) + 1
            row["restore_attempts"] = attempts
            row["last_error"] = str(err)
            if attempts >= MAX_RESTORE_ATTEMPTS:
                _LOGGER.error("Ripristino di %s fallito definitivamente dopo %s tentativi: %s", entity_id, attempts, err)
                await self.hass.async_add_executor_job(self._end, row_id, END_FAILED, str(err))
                self._finish(entity_id)
                return
            _LOGGER.warning("Ripristino di %s non riuscito (tentativo %s): %s. Nuovo tentativo tra %s",
                            entity_id, attempts, err, RETRY_INTERVAL)
            await self.hass.async_add_executor_job(self._record_failure, row_id, attempts, str(err))
            self._schedule(row, dt_util.utcnow() + RETRY_INTERVAL)
            self._notify()
            return
        await self.hass.async_add_executor_job(self._end, row_id, END_EXPIRED, None, restored)
        _LOGGER.info("Forzatura di %s scaduta: ripristinato %s", entity_id, restored)
        self._finish(entity_id)

    @callback
    def _finish(self, entity_id: str) -> None:
        self._active.pop(entity_id, None)
        for timers in (self._timers, self._watchers, self._enforce_pending):
            if unsub := timers.pop(entity_id, None):
                unsub()
        self._enforce_log.pop(entity_id, None)
        self._notify()
