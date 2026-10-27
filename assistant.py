"""Interpretazione di richieste in linguaggio naturale tramite AI Task di Home Assistant.

L'LLM configurato dall'utente in Home Assistant (servizio ai_task.generate_data) trasforma
una frase in una proposta strutturata: forzatura manuale, override a tempo o ritorno in
automatico. La proposta viene validata qui e restituita al frontend, che la mostra nel
popup precompilato: nessuna modifica viene applicata senza conferma dell'utente.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .database import ConfigDatabase

_LOGGER = logging.getLogger(__name__)

ACTIONS = ("manual", "override", "auto", "none")
WEEKDAYS = ("lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica")

STRUCTURE = {
    "action": {
        "description": "Azione da eseguire: manual, override, auto oppure none",
        "required": True,
        "selector": {"select": {"options": list(ACTIONS)}},
    },
    "setup_name": {
        "description": "Nome esatto della configurazione interessata, scelto dall'elenco",
        "required": False,
        "selector": {"text": {}},
    },
    "value": {
        "description": "Valore da impostare; se esistono valori validi, il codice esatto di uno di essi",
        "required": False,
        "selector": {"text": {}},
    },
    "start": {
        "description": "Solo per override: inizio in formato YYYY-MM-DDTHH:MM (ora locale); vuoto = adesso",
        "required": False,
        "selector": {"text": {}},
    },
    "end": {
        "description": "Fine in formato YYYY-MM-DDTHH:MM (ora locale); vuoto = senza scadenza (solo manual)",
        "required": False,
        "selector": {"text": {}},
    },
    "priority": {
        "description": "Solo per override: priorità da 1 (più alta) a 999; 1 se non indicata",
        "required": False,
        "selector": {"number": {"min": 1, "max": 999, "mode": "box"}},
    },
    "explanation": {
        "description": "Una frase breve in italiano che descrive cosa verrà fatto, o perché non è possibile",
        "required": True,
        "selector": {"text": {}},
    },
}

INSTRUCTIONS = """Sei l'assistente di Mia Config, un sistema di configurazioni dinamiche per Home Assistant.
Trasforma la richiesta dell'utente in UNA sola azione.

Azioni:
- manual: forzatura manuale. Vince su qualsiasi altra configurazione finché non scade o si torna in automatico. \
È la scelta giusta per richieste immediate ("metti", "forza", "imposta", "accendi", "spegni"), anche con una durata \
("per 2 ore", "fino alle 22", "fino a domani mattina").
- override: override a tempo con priorità, cioè una programmazione. Usalo quando la richiesta parte nel futuro \
("domani dalle 18 alle 20", "stasera dalle 21") o quando l'utente chiede esplicitamente un override o una priorità.
- auto: rimuove la forzatura manuale e torna al funzionamento automatico ("torna in automatico", "togli la forzatura").
- none: la richiesta non è chiara o non riguarda nessuna configurazione dell'elenco; spiega il motivo in explanation.

Regole:
- setup_name deve essere esattamente uno dei nomi elencati sotto.
- Se la configurazione ha valori validi, value deve essere esattamente il codice di uno di essi (non la descrizione).
- Se non ha valori validi, rispetta il formato del valore attuale (per esempio un numero).
- Date e orari in formato YYYY-MM-DDTHH:MM, ora locale. Calcola le durate a partire da adesso.
- "stamattina" = 08:00, "a mezzogiorno" = 12:00, "stasera" = 20:00, "stanotte" = 23:00, "domattina" = 08:00 del giorno dopo, \
salvo indicazioni diverse.
- Per manual senza una durata o una fine, lascia end vuoto (nessuna scadenza).
- Per override end è obbligatorio; se manca una durata usa 1 ora.
- explanation in italiano, una frase, con orari in formato 24h.

Adesso è {now} ({weekday}).

Configurazioni disponibili:
{configs}

Richiesta dell'utente: "{text}"
"""


def _describe_configs(db: ConfigDatabase, only: str | None) -> tuple[str, dict[str, dict[str, Any]]]:
    """Elenco testuale delle configurazioni per il prompt e dati per la validazione (eseguito nell'executor)."""
    current = db.get_all_configurations()
    names = [only] if only else db.get_all_setup_names()
    lines = []
    catalog: dict[str, dict[str, Any]] = {}
    for name in names:
        info = current.get(name, {})
        valid = db.get_valid_values(name)
        catalog[name] = {"valid": valid, "current": info.get("value")}
        line = f"- {name}"
        if info.get("description"):
            line += f": {info['description']}"
        line += f" | valore attuale: {info.get('value', 'nessuno')}"
        if info.get("source") == "time" and info.get("priority") == 0:
            line += " (forzato manualmente)"
        if valid:
            values = ", ".join(
                f"{vv['value']} ({vv['description']})" if vv.get("description") else str(vv["value"])
                for vv in valid
            )
            line += f" | valori validi: {values}"
        lines.append(line)
    return "\n".join(lines), catalog


def _parse_local(value: Any) -> datetime | None:
    """Converte 'YYYY-MM-DDTHH:MM[:SS]' (o con spazio) in datetime naive locale; None se vuoto."""
    if value in (None, ""):
        return None
    text = str(value).strip().replace(" ", "T")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError as err:
        raise HomeAssistantError(f"Data/ora non valida restituita dall'assistente: {value}") from err
    if parsed.tzinfo is not None:
        parsed = dt_util.as_local(parsed).replace(tzinfo=None)
    return parsed.replace(second=0, microsecond=0)


def _match_setup_name(raw: Any, catalog: dict[str, Any]) -> str:
    name = str(raw or "").strip()
    if name in catalog:
        return name
    normalized = name.lower().replace(" ", "_")
    for candidate in catalog:
        if candidate.lower() == normalized:
            return candidate
    raise HomeAssistantError(f"L'assistente ha indicato una configurazione inesistente: '{name}'")


def _match_value(raw: Any, valid: list[dict[str, Any]]) -> str:
    value = str(raw if raw is not None else "").strip()
    if value == "":
        raise HomeAssistantError("L'assistente non ha indicato il valore da impostare")
    if not valid:
        return value
    for vv in valid:
        if str(vv["value"]) == value:
            return str(vv["value"])
    # L'LLM a volte restituisce la descrizione invece del codice
    for vv in valid:
        if vv.get("description") and vv["description"].strip().lower() == value.lower():
            return str(vv["value"])
    allowed = ", ".join(str(vv["value"]) for vv in valid)
    raise HomeAssistantError(f"Valore '{value}' non tra i valori validi ({allowed})")


def _entity_for(hass: HomeAssistant, setup_name: str, entry_id: str | None) -> str | None:
    """Sensore Mia Config della configurazione indicata, nella stessa istanza."""
    for state in hass.states.async_all("sensor"):
        attrs = state.attributes
        if attrs.get("integration") != DOMAIN or attrs.get("setup_name") != setup_name:
            continue
        if entry_id and attrs.get("entry_id") != entry_id:
            continue
        return state.entity_id
    return None


async def async_interpret_request(
    hass: HomeAssistant,
    db: ConfigDatabase,
    text: str,
    entry_id: str | None,
    setup_name: str | None = None,
    ai_task_entity: str | None = None,
) -> dict[str, Any]:
    """Interpreta una frase e restituisce una proposta validata (senza applicarla)."""
    if not hass.services.has_service("ai_task", "generate_data"):
        raise HomeAssistantError(
            "Servizio ai_task.generate_data non disponibile: serve Home Assistant 2025.7 o successivo "
            "e un'integrazione AI configurata come AI Task"
        )
    text = (text or "").strip()
    if not text:
        raise HomeAssistantError("Scrivi cosa vuoi fare")

    configs_text, catalog = await hass.async_add_executor_job(_describe_configs, db, setup_name)
    if not catalog:
        raise HomeAssistantError("Nessuna configurazione disponibile")

    now = dt_util.now()
    instructions = INSTRUCTIONS.format(
        now=now.strftime("%Y-%m-%dT%H:%M"),
        weekday=WEEKDAYS[now.weekday()],
        configs=configs_text,
        text=text.replace('"', "'"),
    )
    service_data: dict[str, Any] = {
        "task_name": "Mia Config: interpreta richiesta",
        "instructions": instructions,
        "structure": STRUCTURE,
    }
    if ai_task_entity:
        service_data["entity_id"] = ai_task_entity

    response = await hass.services.async_call(
        "ai_task", "generate_data", service_data, blocking=True, return_response=True
    )
    data = (response or {}).get("data")
    if not isinstance(data, dict):
        raise HomeAssistantError("Risposta dell'assistente non valida")
    _LOGGER.debug("Interpretazione di '%s': %s", text, data)

    action = str(data.get("action") or "none").strip().lower()
    if action not in ACTIONS:
        raise HomeAssistantError(f"Azione sconosciuta restituita dall'assistente: {action}")
    explanation = str(data.get("explanation") or "").strip()
    proposal: dict[str, Any] = {"action": action, "explanation": explanation, "request": text}
    if action == "none":
        return proposal

    name = _match_setup_name(data.get("setup_name"), catalog)
    proposal["setup_name"] = name
    proposal["entity_id"] = _entity_for(hass, name, entry_id)
    if action == "auto":
        return proposal

    proposal["value"] = _match_value(data.get("value"), catalog[name]["valid"])
    now_local = now.replace(tzinfo=None, second=0, microsecond=0)
    end = _parse_local(data.get("end"))

    if action == "manual":
        if end is not None and end <= now_local:
            raise HomeAssistantError("La fine della forzatura indicata è già passata")
        proposal["end"] = end.isoformat() if end else None
        return proposal

    start = _parse_local(data.get("start")) or now_local
    if start < now_local:
        start = now_local
    if end is None:
        end = start + timedelta(hours=1)
    if end <= start:
        raise HomeAssistantError("La fine dell'override deve essere dopo l'inizio")
    try:
        priority = int(float(data.get("priority") or 1))
    except (TypeError, ValueError):
        priority = 1
    proposal.update({
        "start": start.isoformat(),
        "end": end.isoformat(),
        "priority": min(max(priority, 1), 999),
    })
    return proposal
