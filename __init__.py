"""
Mia Config - Gestione configurazioni dinamiche basate su tempo e orario.
"""
import logging
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from aiohttp import web
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.helpers.typing import ConfigType
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.exceptions import ConfigEntryNotReady
import voluptuous as vol
from homeassistant.helpers import config_validation as cv
from homeassistant.components.http import HomeAssistantView

from .const import (
    DOMAIN,
    DEFAULT_SCAN_INTERVAL,
    DEFAULT_LOOKAHEAD_HOURS,
    DEFAULT_LOOKBACK_HOURS,
    DEFAULT_CLEANUP_DAYS,
    DEFAULT_HISTORY_RETENTION_DAYS,
    DEFAULT_MAX_HISTORY_PER_NAME,
    DEFAULT_MIN_HISTORY_PER_NAME,
)
from .database import ConfigDatabase

_LOGGER = logging.getLogger(__name__)


def validate_time_format(value):
    """Valida il formato orario in formato decimale (0.0 - 23.983333)."""
    time_value = float(value)
    hours = int(time_value)
    minutes = round((time_value - hours) * 60)  # CORRETTO: decimale ore -> minuti
    
    # Caso speciale: 24.0 (mezzanotte del giorno dopo) è valido
    if time_value == 24.0:
        return time_value
    
    if hours < 0 or hours > 23:
        raise vol.Invalid(f"Le ore devono essere tra 0 e 23, ricevuto: {hours}")
    if minutes < 0 or minutes > 59:
        raise vol.Invalid(f"I minuti devono essere tra 0 e 59, ricevuto: {minutes}")
    
    return time_value

PLATFORMS = ["sensor"]

# Supporto legacy per configurazione YAML (opzionale)
CONFIG_SCHEMA = vol.Schema(
    {
        DOMAIN: vol.Schema({
            vol.Optional("db_path", default="config/mia_config.db"): cv.string,
            vol.Optional("scan_interval", default=DEFAULT_SCAN_INTERVAL): cv.positive_int,
        })
    },
    extra=vol.ALLOW_EXTRA,
)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up del componente Mia Config (legacy YAML support)."""
    hass.data.setdefault(DOMAIN, {})
    
    # Se c'è configurazione YAML, la usiamo come fallback
    if DOMAIN in config:
        conf = config[DOMAIN]
        db_path = hass.config.path(conf.get("db_path", "mia_config.db"))
        scan_interval = conf.get("scan_interval", DEFAULT_SCAN_INTERVAL)
        
        hass.data[DOMAIN]["db_path"] = db_path
        hass.data[DOMAIN]["scan_interval"] = scan_interval
        
        _LOGGER.info("Mia Config configurato tramite YAML (legacy)")
    
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Mia Config da config entry (UI)."""
    hass.data.setdefault(DOMAIN, {})
    
    # Ottieni opzioni da config entry
    db_name = entry.data.get("db_name", "mia_config")
    scan_interval = entry.options.get("scan_interval", DEFAULT_SCAN_INTERVAL)
    lookahead_hours = entry.options.get("lookahead_hours", DEFAULT_LOOKAHEAD_HOURS)
    lookback_hours = entry.options.get("lookback_hours", DEFAULT_LOOKBACK_HOURS)
    cleanup_days = entry.options.get("cleanup_days", DEFAULT_CLEANUP_DAYS)
    retention_days = entry.options.get("retention_days", DEFAULT_HISTORY_RETENTION_DAYS)
    max_history_per_name = entry.options.get("max_history_per_name", DEFAULT_MAX_HISTORY_PER_NAME)
    min_history_per_name = entry.options.get("min_history_per_name", DEFAULT_MIN_HISTORY_PER_NAME)
    db_path = hass.config.path(f"{db_name}.db")
    
    # Inizializza il database con gestione errori
    try:
        db = ConfigDatabase(db_path)
        await hass.async_add_executor_job(db.initialize)
        
        # Verifica che il database sia accessibile
        await hass.async_add_executor_job(db.get_all_setup_names)
        
    except Exception as err:
        _LOGGER.error("Errore inizializzazione database %s: %s", db_path, err)
        raise ConfigEntryNotReady(f"Impossibile inizializzare il database: {err}") from err
    
    # Esegui cleanup degli eventi scaduti
    try:
        if cleanup_days > 0:
            await hass.async_add_executor_job(db.cleanup_expired_events, cleanup_days)
    except Exception as err:
        _LOGGER.warning("Errore durante cleanup eventi scaduti: %s", err)
    
    # Salva i dati per questo entry
    entry_data = {
        "db": db,
        "scan_interval": scan_interval,
        "lookahead_hours": lookahead_hours,
        "lookback_hours": lookback_hours,
        "cleanup_days": cleanup_days,
        "retention_days": retention_days,
        "max_history_per_name": max_history_per_name,
        "min_history_per_name": min_history_per_name,
        "entry_id": entry.entry_id
    }
    hass.data[DOMAIN][entry.entry_id] = entry_data
    
    # Mantieni anche riferimenti globali per retrocompatibilità
    hass.data[DOMAIN]["db"] = db
    hass.data[DOMAIN]["scan_interval"] = scan_interval
    hass.data[DOMAIN]["lookahead_hours"] = lookahead_hours
    hass.data[DOMAIN]["lookback_hours"] = lookback_hours
    hass.data[DOMAIN]["cleanup_days"] = cleanup_days
    hass.data[DOMAIN]["entry_id"] = entry.entry_id
    
    # Registra le risorse statiche per la card usando frontend
    www_path = os.path.join(os.path.dirname(__file__), "www")
    
    # Usa il componente frontend per registrare risorse locali
    try:
        await hass.async_add_executor_job(
            hass.http.app.router.add_static,
            "/mia_config_local",
            www_path,
        )
        _LOGGER.info(f"Registered static path: /mia_config_local -> {www_path}")
    except Exception as err:
        _LOGGER.warning("Impossibile registrare risorse statiche: %s", err)
    
    # Carica il platform sensor
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    
    # Registra i servizi (solo una volta)
    if not hass.services.has_service(DOMAIN, "set_config"):
        await async_setup_services(hass)
    
    # Avvia cleanup automatico giornaliero dello storico e configurazioni scadute
    async def daily_cleanup(now):
        """Esegue il cleanup automatico dello storico e delle configurazioni scadute una volta al giorno."""
        _LOGGER.info("Avvio cleanup automatico giornaliero")
        
        # Cleanup storico
        all_names = await hass.async_add_executor_job(db.get_all_setup_names)
        for name in all_names:
            await hass.async_add_executor_job(
                db._cleanup_history, name, 
                retention_days, 
                max_history_per_name, 
                min_history_per_name
            )
        _LOGGER.info(f"Cleanup storico completato per {len(all_names)} configurazioni")
        
        # Cleanup configurazioni a tempo scadute
        if cleanup_days > 0:
            await hass.async_add_executor_job(db.cleanup_expired_events, cleanup_days)
            _LOGGER.info(f"Cleanup configurazioni a tempo scadute oltre {cleanup_days} giorni completato")
    
    # Pianifica cleanup ogni 24 ore
    entry.async_on_unload(
        async_track_time_interval(hass, daily_cleanup, timedelta(days=1))
    )
    
    # Registra listener per aggiornamenti opzioni
    entry.async_on_unload(entry.add_update_listener(async_update_options))
    
    _LOGGER.info("Mia Config configurato tramite UI")
    
    return True


async def async_update_options(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Aggiorna le opzioni."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    
    if unload_ok:
        # Chiudi SOLO il database specifico di questa istanza
        entry_data = hass.data[DOMAIN].get(entry.entry_id)
        if entry_data and "db" in entry_data:
            await hass.async_add_executor_job(entry_data["db"].close)
            _LOGGER.info(f"Closed database for entry {entry.entry_id}")
        
        # Rimuovi i dati specifici dell'istanza
        hass.data[DOMAIN].pop(entry.entry_id, None)
    
    return unload_ok


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Rimuove completamente l'istanza dell'integrazione cancellando il database."""
    db_name = entry.data.get("db_name", "mia_config")
    db_path = hass.config.path(f"{db_name}.db")
    
    _LOGGER.info(f"Removing Mia Config instance '{db_name}', deleting database file: {db_path}")
    
    try:
        # Verifica se il file esiste e cancellalo
        if await hass.async_add_executor_job(os.path.exists, db_path):
            await hass.async_add_executor_job(os.remove, db_path)
            _LOGGER.info(f"Successfully deleted database file: {db_path}")
        else:
            _LOGGER.warning(f"Database file not found: {db_path}")
    except Exception as err:
        _LOGGER.error(f"Error deleting database file {db_path}: {err}")


def get_db_from_entity_id(hass: HomeAssistant, entity_id: str = None) -> ConfigDatabase:
    """Ottiene il database corretto dall'entity_id, o il database di default."""
    if entity_id:
        # Cerca l'entity per trovare il suo entry_id
        state = hass.states.get(entity_id)
        if state and state.attributes.get("entry_id"):
            entry_id = state.attributes["entry_id"]
            entry_data = hass.data.get(DOMAIN, {}).get(entry_id)
            if entry_data and isinstance(entry_data, dict) and "db" in entry_data:
                return entry_data["db"]
    
    # Fallback al database globale (per retrocompatibilità)
    return hass.data[DOMAIN]["db"]


async def async_setup_services(hass: HomeAssistant) -> None:
    """Registra i servizi del componente."""
    
    async def handle_set_config(call: ServiceCall) -> None:
        """Gestisce il servizio per impostare una configurazione standard."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        setup_name = call.data.get("setup_name")
        setup_value = call.data.get("setup_value")
        priority = call.data.get("priority", 99)
        description = call.data.get("description")
        
        await hass.async_add_executor_job(
            db.set_config, setup_name, setup_value, priority, description
        )
        
        # Forza aggiornamento e invalida cache
        for entry_id, data in hass.data.get(DOMAIN, {}).items():
            if isinstance(data, dict):
                if 'clear_cache' in data:
                    data['clear_cache']()
                if 'coordinator' in data:
                    await data['coordinator'].async_request_refresh()
        
        _LOGGER.info(f"Configurazione '{setup_name}' impostata a '{setup_value}'")
    
    async def handle_set_time_config(call: ServiceCall) -> None:
        """Gestisce il servizio per impostare una configurazione a tempo."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        setup_name = call.data.get("setup_name")
        setup_value = call.data.get("setup_value")
        valid_from = call.data.get("valid_from")
        valid_to = call.data.get("valid_to")
        priority = call.data.get("priority", 99)
        valid_from_ora = call.data.get("valid_from_ora")
        valid_to_ora = call.data.get("valid_to_ora")
        days_of_week = call.data.get("days_of_week")
        
        await hass.async_add_executor_job(
            db.set_time_config, setup_name, setup_value, valid_from, valid_to, priority,
            valid_from_ora, valid_to_ora, days_of_week
        )
        
        # Forza aggiornamento e invalida cache
        for entry_id, data in hass.data.get(DOMAIN, {}).items():
            if isinstance(data, dict):
                if 'clear_cache' in data:
                    data['clear_cache']()
                if 'coordinator' in data:
                    await data['coordinator'].async_request_refresh()
        
        _LOGGER.info(f"Configurazione a tempo '{setup_name}' impostata")
    
    async def handle_set_schedule_config(call: ServiceCall) -> None:
        """Gestisce il servizio per impostare una configurazione a orario."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        setup_name = call.data.get("setup_name")
        setup_value = call.data.get("setup_value")
        valid_from_ora = call.data.get("valid_from_ora")
        valid_to_ora = call.data.get("valid_to_ora")
        days_of_week = call.data.get("days_of_week", "0,1,2,3,4,5,6")
        priority = call.data.get("priority", 99)
        
        # Converte lista in stringa se necessario
        if isinstance(days_of_week, list):
            days_of_week = ','.join(map(str, days_of_week))
        
        await hass.async_add_executor_job(
            db.set_schedule_config, setup_name, setup_value, valid_from_ora, valid_to_ora, days_of_week, priority
        )
        
        # Forza aggiornamento e invalida cache
        for entry_id, data in hass.data.get(DOMAIN, {}).items():
            if isinstance(data, dict):
                if 'clear_cache' in data:
                    data['clear_cache']()
                if 'coordinator' in data:
                    await data['coordinator'].async_request_refresh()
        
        _LOGGER.info(f"Configurazione a orario '{setup_name}' impostata")
    
    async def handle_set_conditional_config(call: ServiceCall) -> None:
        """Gestisce il servizio per impostare una configurazione condizionale."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        setup_name = call.data.get("setup_name")
        setup_value = call.data.get("setup_value")
        conditional_config = call.data.get("conditional_config")
        conditional_operator = call.data.get("conditional_operator")
        conditional_value = call.data.get("conditional_value")
        priority = call.data.get("priority", 99)
        valid_from_ora = call.data.get("valid_from_ora")
        valid_to_ora = call.data.get("valid_to_ora")
        
        try:
            await hass.async_add_executor_job(
                db.set_conditional_config, setup_name, setup_value, conditional_config,
                conditional_operator, conditional_value, priority,
                valid_from_ora, valid_to_ora
            )
            
            # Forza aggiornamento e invalida cache
            for entry_id, data in hass.data.get(DOMAIN, {}).items():
                if isinstance(data, dict):
                    if 'clear_cache' in data:
                        data['clear_cache']()
                    if 'coordinator' in data:
                        await data['coordinator'].async_request_refresh()
            
            _LOGGER.info(f"Configurazione condizionale '{setup_name}' impostata")
        except ValueError as err:
            _LOGGER.error(f"Errore nella configurazione condizionale: {err}")
            raise
    
    async def handle_update_standard_config(call: ServiceCall) -> None:
        """Gestisce il servizio per aggiornare una configurazione standard esistente."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        config_id = call.data.get("config_id")
        setup_value = call.data.get("setup_value")
        priority = call.data.get("priority")
        description = call.data.get("description")
        
        await hass.async_add_executor_job(
            db.update_standard_config, config_id, setup_value, priority, description
        )
        
        # Forza aggiornamento e invalida cache
        for entry_id, data in hass.data.get(DOMAIN, {}).items():
            if isinstance(data, dict):
                if 'clear_cache' in data:
                    data['clear_cache']()
                if 'coordinator' in data:
                    await data['coordinator'].async_request_refresh()
        
        _LOGGER.info(f"Configurazione ID {config_id} aggiornata")
    
    async def handle_delete_config(call: ServiceCall) -> None:
        """Gestisce il servizio per eliminare una configurazione."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        setup_name = call.data.get("setup_name")
        config_type = call.data.get("config_type", "all")
        
        await hass.async_add_executor_job(
            db.delete_config, setup_name, config_type
        )
        
        # Pulisci i valori validi orfani
        await hass.async_add_executor_job(
            db.cleanup_orphan_valid_values
        )
        
        # Forza aggiornamento e invalida cache
        for entry_id, data in hass.data.get(DOMAIN, {}).items():
            if isinstance(data, dict):
                if 'clear_cache' in data:
                    data['clear_cache']()
                if 'coordinator' in data:
                    await data['coordinator'].async_request_refresh()
        
        _LOGGER.info(f"Configurazione '{setup_name}' eliminata")
    
    async def handle_simulate_schedule(call: ServiceCall) -> ServiceResponse:
        """Simula la configurazione per un periodo di tempo."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        setup_name = call.data.get("setup_name")
        start_date = call.data.get("start_date")
        days = call.data.get("days", 14)
        
        # Usa lo scan_interval del componente come granularità (già in secondi, converti in minuti)
        scan_interval_seconds = hass.data[DOMAIN].get("scan_interval", DEFAULT_SCAN_INTERVAL)
        granularity_minutes = max(1, scan_interval_seconds // 60)  # Converti in minuti, minimo 1
        
        # Se non specificata, usa data/ora corrente
        if start_date is None:
            start_date = datetime.now()
        
        segments = await hass.async_add_executor_job(
            db.simulate_configuration_schedule, setup_name, start_date, days, granularity_minutes
        )
        
        return {"segments": segments}
    
    async def handle_delete_single_config(call: ServiceCall) -> None:
        """Gestisce il servizio per eliminare una singola configurazione tramite ID."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        config_type = call.data.get("config_type")
        config_id = call.data.get("config_id")
        
        await hass.async_add_executor_job(
            db.delete_single_config, config_type, config_id
        )
        
        # Forza aggiornamento e invalida cache
        for entry_id, data in hass.data.get(DOMAIN, {}).items():
            if isinstance(data, dict):
                if 'clear_cache' in data:
                    data['clear_cache']()
                if 'coordinator' in data:
                    await data['coordinator'].async_request_refresh()
        
        _LOGGER.info(f"Configurazione singola {config_type} con id {config_id} eliminata")
    
    async def handle_enable_config(call: ServiceCall) -> None:
        """Gestisce il servizio per abilitare una configurazione."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        config_type = call.data.get("config_type")
        config_id = call.data.get("config_id")
        
        await hass.async_add_executor_job(
            db.set_config_enabled, config_type, config_id, True
        )
        
        # Forza aggiornamento e invalida cache
        for entry_id, data in hass.data.get(DOMAIN, {}).items():
            if isinstance(data, dict):
                if 'clear_cache' in data:
                    data['clear_cache']()
                if 'coordinator' in data:
                    await data['coordinator'].async_request_refresh()
        
        _LOGGER.info(f"Configurazione {config_type} con id {config_id} abilitata")
    
    async def handle_disable_config(call: ServiceCall) -> None:
        """Gestisce il servizio per disabilitare una configurazione."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        config_type = call.data.get("config_type")
        config_id = call.data.get("config_id")
        
        await hass.async_add_executor_job(
            db.set_config_enabled, config_type, config_id, False
        )
        
        # Forza aggiornamento e invalida cache
        for entry_id, data in hass.data.get(DOMAIN, {}).items():
            if isinstance(data, dict):
                if 'clear_cache' in data:
                    data['clear_cache']()
                if 'coordinator' in data:
                    await data['coordinator'].async_request_refresh()
        
        _LOGGER.info(f"Configurazione {config_type} con id {config_id} disabilitata")
    
    async def handle_get_configurations(call: ServiceCall) -> ServiceResponse:
        """Gestisce il servizio per ottenere le configurazioni."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        setup_name = call.data.get("setup_name")
        
        if setup_name:
            config = await hass.async_add_executor_job(
                db.get_configuration, setup_name
            )
            result = {setup_name: config} if config else {}
        else:
            # Usa get_all_configurations_detailed per avere tutte le configurazioni raggruppate
            result = await hass.async_add_executor_job(
                db.get_all_configurations_detailed
            )
        
        _LOGGER.info(f"get_configurations chiamato, risultati: {len(result)} configurazioni")
        
        # Invia evento con i risultati
        hass.bus.async_fire(
            f"{DOMAIN}_configurations_result",
            {"configurations": result}
        )
        
        return result
    
    async def handle_get_history(call: ServiceCall) -> ServiceResponse:
        """Gestisce il servizio per ottenere lo storico."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        setup_name = call.data.get("setup_name")
        limit = call.data.get("limit", 50)
        offset = call.data.get("offset", 0)
        
        history = await hass.async_add_executor_job(
            db.get_history, setup_name, limit, offset
        )
        
        # Ottieni il conteggio totale per la paginazione
        total = await hass.async_add_executor_job(
            db.get_history_count, setup_name
        )
        
        _LOGGER.info(f"get_history chiamato, risultati: {len(history)} record (totale: {total})")
        
        return {"history": history, "total": total}
    
    async def handle_cleanup_history(call: ServiceCall) -> None:
        """Gestisce il servizio per pulire lo storico delle configurazioni."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        setup_name = call.data.get("setup_name")
        retention_days = call.data.get("retention_days", DEFAULT_HISTORY_RETENTION_DAYS)
        max_entries_per_name = call.data.get("max_entries_per_name", DEFAULT_MAX_HISTORY_PER_NAME)
        min_entries_per_name = call.data.get("min_entries_per_name", DEFAULT_MIN_HISTORY_PER_NAME)
        
        if setup_name:
            # Cleanup per un singolo setup_name
            await hass.async_add_executor_job(
                db._cleanup_history, setup_name, retention_days, max_entries_per_name, min_entries_per_name
            )
            _LOGGER.info(f"Cleanup storico per '{setup_name}' completato")
        else:
            # Cleanup per tutti i setup_name
            all_names = await hass.async_add_executor_job(db.get_all_setup_names)
            for name in all_names:
                await hass.async_add_executor_job(
                    db._cleanup_history, name, retention_days, max_entries_per_name, min_entries_per_name
                )
            _LOGGER.info(f"Cleanup storico globale completato per {len(all_names)} configurazioni")
    
    # Schema dei servizi
    set_config_schema = vol.Schema({
        vol.Required("setup_name"): cv.string,
        vol.Required("setup_value"): cv.string,
        vol.Optional("priority", default=99): cv.positive_int,
        vol.Optional("description"): cv.string,
    })
    
    update_standard_config_schema = vol.Schema({
        vol.Required("config_id"): cv.positive_int,
        vol.Required("setup_value"): cv.string,
        vol.Required("priority"): cv.positive_int,
        vol.Optional("description"): cv.string,
    })
    
    set_time_config_schema = vol.Schema({
        vol.Required("setup_name"): cv.string,
        vol.Required("setup_value"): cv.string,
        vol.Required("valid_from"): cv.datetime,
        vol.Required("valid_to"): cv.datetime,
        vol.Optional("priority", default=99): cv.positive_int,
        vol.Optional("valid_from_ora"): vol.All(vol.Coerce(float), validate_time_format),
        vol.Optional("valid_to_ora"): vol.All(vol.Coerce(float), validate_time_format),
        vol.Optional("days_of_week"): vol.Any(cv.string, [vol.In([0, 1, 2, 3, 4, 5, 6])]),
    })
    
    set_schedule_config_schema = vol.Schema({
        vol.Required("setup_name"): cv.string,
        vol.Required("setup_value"): cv.string,
        vol.Required("valid_from_ora"): vol.All(vol.Coerce(float), validate_time_format),
        vol.Required("valid_to_ora"): vol.All(vol.Coerce(float), validate_time_format),
        vol.Optional("days_of_week", default="0,1,2,3,4,5,6"): vol.Any(cv.string, [vol.In([0, 1, 2, 3, 4, 5, 6])]),
        vol.Optional("priority", default=99): cv.positive_int,
    })
    
    set_conditional_config_schema = vol.Schema({
        vol.Required("setup_name"): cv.string,
        vol.Required("setup_value"): cv.string,
        vol.Required("conditional_config"): cv.string,
        vol.Required("conditional_operator"): vol.In(["==", "!=", ">", "<", ">=", "<=", "contains", "not_contains"]),
        vol.Required("conditional_value"): cv.string,
        vol.Optional("priority", default=99): cv.positive_int,
        vol.Optional("valid_from_ora"): vol.Any(int, float),
        vol.Optional("valid_to_ora"): vol.Any(int, float),
    })
    
    delete_config_schema = vol.Schema({
        vol.Required("setup_name"): cv.string,
        vol.Optional("config_type", default="all"): vol.In(["all", "standard", "time", "schedule", "conditional"]),
    })
    
    delete_single_config_schema = vol.Schema({
        vol.Required("config_type"): vol.In(["standard", "time", "schedule", "conditional"]),
        vol.Required("config_id"): cv.positive_int,
    })
    
    get_configurations_schema = vol.Schema({
        vol.Optional("entity_id"): cv.entity_id,
        vol.Optional("setup_name"): cv.string,
    })
    
    get_history_schema = vol.Schema({
        vol.Optional("setup_name"): cv.string,
        vol.Optional("limit", default=50): cv.positive_int,
        vol.Optional("offset", default=0): cv.positive_int,
    })
    
    cleanup_history_schema = vol.Schema({
        vol.Optional("setup_name"): cv.string,
        vol.Optional("retention_days", default=DEFAULT_HISTORY_RETENTION_DAYS): cv.positive_int,
        vol.Optional("max_entries_per_name", default=DEFAULT_MAX_HISTORY_PER_NAME): cv.positive_int,
        vol.Optional("min_entries_per_name", default=DEFAULT_MIN_HISTORY_PER_NAME): cv.positive_int,
    })
    
    simulate_schedule_schema = vol.Schema({
        vol.Required("setup_name"): cv.string,
        vol.Optional("start_date"): cv.datetime,
        vol.Optional("days", default=14): cv.positive_int,
    })
    
    # Registra i servizi
    hass.services.async_register(
        DOMAIN, "set_config", handle_set_config, schema=set_config_schema
    )
    
    hass.services.async_register(
        DOMAIN, "update_standard_config", handle_update_standard_config, schema=update_standard_config_schema
    )
    
    hass.services.async_register(
        DOMAIN, "set_time_config", handle_set_time_config, schema=set_time_config_schema
    )
    
    hass.services.async_register(
        DOMAIN, "set_schedule_config", handle_set_schedule_config, schema=set_schedule_config_schema
    )
    
    hass.services.async_register(
        DOMAIN, "set_conditional_config", handle_set_conditional_config, schema=set_conditional_config_schema
    )
    
    hass.services.async_register(
        DOMAIN, "delete_config", handle_delete_config, schema=delete_config_schema
    )
    
    hass.services.async_register(
        DOMAIN, "delete_single_config", handle_delete_single_config, schema=delete_single_config_schema
    )
    
    hass.services.async_register(
        DOMAIN, "enable_config", handle_enable_config, schema=delete_single_config_schema
    )
    
    hass.services.async_register(
        DOMAIN, "disable_config", handle_disable_config, schema=delete_single_config_schema
    )
    
    hass.services.async_register(
        DOMAIN, "get_history", handle_get_history, schema=get_history_schema, supports_response=SupportsResponse.OPTIONAL
    )
    
    hass.services.async_register(
        DOMAIN, "cleanup_history", handle_cleanup_history, schema=cleanup_history_schema
    )
    
    hass.services.async_register(
        DOMAIN, "get_configurations", handle_get_configurations, schema=get_configurations_schema, supports_response=SupportsResponse.OPTIONAL
    )
    
    # Servizi per gestione valori validi
    async def handle_add_valid_value(call: ServiceCall) -> None:
        """Aggiunge un valore valido per una configurazione."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        setup_name = call.data["setup_name"]
        value = call.data["value"]
        description = call.data.get("description")
        sort_order = call.data.get("sort_order", 0)
        
        await hass.async_add_executor_job(
            db.add_valid_value, setup_name, value, description, sort_order
        )
    
    async def handle_delete_valid_value(call: ServiceCall) -> None:
        """Elimina un valore valido."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        valid_value_id = call.data["id"]
        
        await hass.async_add_executor_job(
            db.delete_valid_value, valid_value_id
        )
    
    async def handle_get_valid_values(call: ServiceCall) -> ServiceResponse:
        """Ottiene i valori validi per una configurazione."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        setup_name = call.data.get("setup_name")
        
        if setup_name:
            valid_values = await hass.async_add_executor_job(
                db.get_valid_values, setup_name
            )
            return {"valid_values": valid_values}
        else:
            # Restituisci tutti i valori validi raggruppati per setup_name
            cursor = db.conn.cursor()
            cursor.execute("""
                SELECT setup_name, value, description, sort_order, id
                FROM configurazioni_valori_validi
                ORDER BY setup_name, sort_order, value
            """)
            all_values = {}
            for row in cursor.fetchall():
                name = row['setup_name']
                if name not in all_values:
                    all_values[name] = []
                all_values[name].append(dict(row))
            return {"valid_values": all_values}
    
    add_valid_value_schema = vol.Schema({
        vol.Required("setup_name"): cv.string,
        vol.Required("value"): cv.string,
        vol.Optional("description"): cv.string,
        vol.Optional("sort_order", default=0): cv.positive_int,
    })
    
    delete_valid_value_schema = vol.Schema({
        vol.Required("id"): cv.positive_int,
    })
    
    get_valid_values_schema = vol.Schema({
        vol.Optional("setup_name"): cv.string,
    })
    
    hass.services.async_register(
        DOMAIN, "add_valid_value", handle_add_valid_value, schema=add_valid_value_schema
    )
    
    hass.services.async_register(
        DOMAIN, "delete_valid_value", handle_delete_valid_value, schema=delete_valid_value_schema
    )
    
    hass.services.async_register(
        DOMAIN, "get_valid_values", handle_get_valid_values, schema=get_valid_values_schema, supports_response=SupportsResponse.OPTIONAL
    )
    
    hass.services.async_register(
        DOMAIN, "simulate_schedule", handle_simulate_schedule, schema=simulate_schedule_schema, supports_response=SupportsResponse.OPTIONAL
    )
    
    def get_backup_dir() -> Path:
        """Cartella di lavoro per i backup."""
        return Path(hass.config.path()) / "backups" / "mia_config"

    # Servizi per backup e restore
    async def handle_backup_database(call: ServiceCall) -> ServiceResponse:
        """Effettua il backup del database."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        backup_dir = get_backup_dir()
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Crea il nome del file di backup con timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = backup_dir / f"mia_config_backup_{timestamp}.db"
        
        try:
            # Copia il database
            await hass.async_add_executor_job(
                shutil.copy2, db.db_path, str(backup_file)
            )
            _LOGGER.info("Backup del database creato: %s", backup_file)
            return {
                "success": True,
                "backup_file": str(backup_file),
                "timestamp": timestamp,
                "message": f"Backup creato con successo: {backup_file.name}"
            }
        except Exception as e:
            _LOGGER.error("Errore durante il backup: %s", e)
            return {
                "success": False,
                "message": f"Errore durante il backup: {str(e)}"
            }
    
    async def handle_restore_database(call: ServiceCall) -> ServiceResponse:
        """Ripristina il database da un backup."""
        entity_id = call.data.get("entity_id")
        db = get_db_from_entity_id(hass, entity_id)
        
        backup_file = call.data.get("backup_file")
        
        if not os.path.exists(backup_file):
            return {
                "success": False,
                "message": f"File di backup non trovato: {backup_file}"
            }
        
        try:
            # Chiudi la connessione al database corrente
            db.conn.close()
            
            # Crea un backup del database corrente prima di ripristinare
            current_backup = os.path.join(
                hass.config.path(), "backups", "mia_config",
                f"mia_config_pre_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
            )
            os.makedirs(os.path.dirname(current_backup), exist_ok=True)
            await hass.async_add_executor_job(
                shutil.copy2, db.db_path, current_backup
            )
            
            # Ripristina il backup
            await hass.async_add_executor_job(
                shutil.copy2, backup_file, db.db_path
            )
            
            # Riapri la connessione
            db.conn = db._open_database()
            
            # Invalida la cache dopo il ripristino per riflettere i nuovi dati
            db._invalidate_next_changes_cache()
            
            _LOGGER.info("Database ripristinato da: %s", backup_file)
            return {
                "success": True,
                "message": f"Database ripristinato con successo",
                "pre_restore_backup": current_backup
            }
        except Exception as e:
            _LOGGER.error(f"Errore durante il ripristino: {e}")
            # Prova a riaprire la connessione comunque
            try:
                db.conn = db._open_database()
            except:
                pass
            return {
                "success": False,
                "message": f"Errore durante il ripristino: {str(e)}"
            }

    async def handle_list_backups(call: ServiceCall) -> ServiceResponse:
        """Restituisce l'elenco dei backup disponibili."""
        backup_dir = get_backup_dir()
        backup_dir.mkdir(parents=True, exist_ok=True)
        try:
            backups = []
            for file_path in sorted(backup_dir.glob("*.db"), reverse=True):
                try:
                    stat_info = file_path.stat()
                    backups.append({
                        "file_name": file_path.name,
                        "path": str(file_path),
                        "size": stat_info.st_size,
                        "modified": datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                        "download_url": f"/api/mia_config/backups/{file_path.name}"
                    })
                except OSError as err:
                    _LOGGER.warning("Impossibile leggere metadati per %s: %s", file_path, err)
            return {"success": True, "backups": backups}
        except Exception as err:
            _LOGGER.error("Errore durante la lettura dei backup: %s", err)
            return {"success": False, "message": f"Errore durante la lettura dei backup: {err}"}

    async def handle_delete_backup(call: ServiceCall) -> ServiceResponse:
        """Elimina un singolo file di backup."""
        file_name = call.data.get("file_name")
        backup_dir = get_backup_dir()
        backup_dir.mkdir(parents=True, exist_ok=True)
        try:
            target = (backup_dir / os.path.basename(file_name)).resolve()
            backup_dir_resolved = backup_dir.resolve()
            try:
                if not target.is_relative_to(backup_dir_resolved):
                    return {"success": False, "message": "Percorso non valido"}
            except Exception:
                if backup_dir_resolved not in target.parents:
                    return {"success": False, "message": "Percorso non valido"}
            if not target.exists():
                return {"success": False, "message": "Backup non trovato"}
            await hass.async_add_executor_job(target.unlink)
            return {"success": True, "message": f"Backup rimosso: {target.name}"}
        except Exception as err:
            _LOGGER.error("Errore durante l'eliminazione del backup %s: %s", file_name, err)
            return {"success": False, "message": f"Errore durante l'eliminazione: {err}"}

    async def handle_delete_all_backups(call: ServiceCall) -> ServiceResponse:
        """Elimina tutti i backup locali."""
        backup_dir = get_backup_dir()
        backup_dir.mkdir(parents=True, exist_ok=True)
        deleted = 0
        errors = 0
        for file_path in backup_dir.glob("*.db"):
            try:
                await hass.async_add_executor_job(file_path.unlink)
                deleted += 1
            except Exception as err:
                errors += 1
                _LOGGER.error("Errore durante l'eliminazione di %s: %s", file_path, err)
        message = f"Eliminati {deleted} backup"
        if errors:
            message += f"; errori: {errors}"
        return {"success": errors == 0, "message": message, "deleted": deleted, "errors": errors}

    class MiaConfigBackupDownloadView(HomeAssistantView):
        """Endpoint autenticato per scaricare un backup."""

        url = "/api/mia_config/backups/{file_name}"
        name = "api:mia_config:backup_download"
        requires_auth = True

        def __init__(self, hass: HomeAssistant) -> None:
            self.hass = hass

        async def get(self, request, file_name):
            backup_dir = get_backup_dir()
            backup_dir.mkdir(parents=True, exist_ok=True)

            safe_name = os.path.basename(file_name)
            target = (backup_dir / safe_name).resolve()
            try:
                backup_dir_resolved = backup_dir.resolve()
                try:
                    if not target.is_relative_to(backup_dir_resolved):
                        return web.Response(status=400, text="Percorso non valido")
                except Exception:
                    if backup_dir_resolved not in target.parents:
                        return web.Response(status=400, text="Percorso non valido")
            except Exception:
                pass

            if not target.exists():
                return web.Response(status=404, text="Backup non trovato")

            return web.FileResponse(path=str(target))

    class MiaConfigBackupUploadView(HomeAssistantView):
        """Endpoint autenticato per caricare un nuovo backup."""

        url = "/api/mia_config/backups/upload"
        name = "api:mia_config:backup_upload"
        requires_auth = True

        def __init__(self, hass: HomeAssistant) -> None:
            self.hass = hass

        async def post(self, request):
            backup_dir = get_backup_dir()
            backup_dir.mkdir(parents=True, exist_ok=True)

            data = await request.post()
            upload = data.get("file")

            if upload is None or not getattr(upload, "file", None):
                return web.json_response({"success": False, "message": "Nessun file di backup ricevuto"}, status=400)

            filename = os.path.basename(upload.filename or "uploaded_backup.db")
            target = (backup_dir / filename).resolve()

            try:
                backup_dir_resolved = backup_dir.resolve()
                try:
                    if not target.is_relative_to(backup_dir_resolved):
                        return web.json_response({"success": False, "message": "Nome file non valido"}, status=400)
                except Exception:
                    if backup_dir_resolved not in target.parents:
                        return web.json_response({"success": False, "message": "Nome file non valido"}, status=400)
            except Exception:
                pass

            file_bytes = upload.file.read()
            try:
                await self.hass.async_add_executor_job(target.write_bytes, file_bytes)
            except Exception as err:
                _LOGGER.error("Errore durante il salvataggio del backup caricato: %s", err)
                return web.json_response({"success": False, "message": f"Errore durante il salvataggio: {err}"}, status=500)

            return web.json_response({
                "success": True,
                "message": "Backup caricato con successo",
                "file_name": filename,
                "path": str(target),
                "download_url": f"/api/mia_config/backups/{filename}"
            })
    
    backup_database_schema = vol.Schema({
        vol.Optional("entity_id"): cv.entity_id,
    })
    
    restore_database_schema = vol.Schema({
        vol.Optional("entity_id"): cv.entity_id,
        vol.Required("backup_file"): cv.string,
    })

    list_backups_schema = vol.Schema({
        vol.Optional("entity_id"): cv.entity_id,
    })

    delete_backup_schema = vol.Schema({
        vol.Optional("entity_id"): cv.entity_id,
        vol.Required("file_name"): cv.string,
    })

    delete_all_backups_schema = vol.Schema({
        vol.Optional("entity_id"): cv.entity_id,
    })
    
    hass.services.async_register(
        DOMAIN, "backup_database", handle_backup_database, schema=backup_database_schema, supports_response=SupportsResponse.OPTIONAL
    )
    
    hass.services.async_register(
        DOMAIN, "restore_database", handle_restore_database, schema=restore_database_schema, supports_response=SupportsResponse.OPTIONAL
    )

    hass.services.async_register(
        DOMAIN, "list_backups", handle_list_backups, schema=list_backups_schema, supports_response=SupportsResponse.OPTIONAL
    )

    hass.services.async_register(
        DOMAIN, "delete_backup", handle_delete_backup, schema=delete_backup_schema, supports_response=SupportsResponse.OPTIONAL
    )

    hass.services.async_register(
        DOMAIN, "delete_all_backups", handle_delete_all_backups, schema=delete_all_backups_schema, supports_response=SupportsResponse.OPTIONAL
    )

    hass.http.register_view(MiaConfigBackupDownloadView(hass))
    hass.http.register_view(MiaConfigBackupUploadView(hass))


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Migrate old entry."""
    _LOGGER.debug("Migrating from version %s", entry.version)

    if entry.version == 1:
        # Nessuna migrazione necessaria per ora
        pass

    _LOGGER.info("Migration to version %s successful", entry.version)

    return True
