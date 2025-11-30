"""
Mia Config - Gestione configurazioni dinamiche basate su tempo e orario.
"""
import logging
import os
from datetime import datetime
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse
from homeassistant.helpers.typing import ConfigType
import voluptuous as vol
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN, DEFAULT_SCAN_INTERVAL
from .database import ConfigDatabase

_LOGGER = logging.getLogger(__name__)

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
async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Mia Config da config entry (UI)."""
    hass.data.setdefault(DOMAIN, {})
    
    # Ottieni opzioni da config entry
    scan_interval = entry.options.get("scan_interval", DEFAULT_SCAN_INTERVAL)
    db_path = hass.config.path("mia_config.db")
    
    # Inizializza il database
    db = ConfigDatabase(db_path)
    await hass.async_add_executor_job(db.initialize)
    
    # Salva i dati per questo entry
    entry_data = {
        "db": db,
        "scan_interval": scan_interval,
        "entry_id": entry.entry_id
    }
    hass.data[DOMAIN][entry.entry_id] = entry_data
    
    # Mantieni anche riferimenti globali per retrocompatibilità
    hass.data[DOMAIN]["db"] = db
    hass.data[DOMAIN]["scan_interval"] = scan_interval
    hass.data[DOMAIN]["entry_id"] = entry.entry_id
    
    # Registra le risorse statiche per la card usando frontend
    www_path = os.path.join(os.path.dirname(__file__), "www")
    
    # Usa il componente frontend per registrare risorse locali
    await hass.async_add_executor_job(
        hass.http.app.router.add_static,
        "/mia_config_local",
        www_path,
    )
    _LOGGER.info(f"Registered static path: /mia_config_local -> {www_path}")
    
    # Carica il platform sensor
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    
    # Registra i servizi (solo una volta)
    if not hass.services.has_service(DOMAIN, "set_config"):
        await async_setup_services(hass)
    
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
        # Chiudi il database
        if "db" in hass.data[DOMAIN]:
            await hass.async_add_executor_job(hass.data[DOMAIN]["db"].close)
        
        hass.data[DOMAIN].pop("db", None)
        hass.data[DOMAIN].pop("scan_interval", None)
        hass.data[DOMAIN].pop("coordinator", None)
    
    return unload_ok


async def async_setup_services(hass: HomeAssistant) -> None:
    """Registra i servizi del componente."""
    db: ConfigDatabase = hass.data[DOMAIN]["db"]
    
    async def handle_set_config(call: ServiceCall) -> None:
        """Gestisce il servizio per impostare una configurazione standard."""
        setup_name = call.data.get("setup_name")
        setup_value = call.data.get("setup_value")
        priority = call.data.get("priority", 99)
        
        await hass.async_add_executor_job(
            db.set_config, setup_name, setup_value, priority
        )
        
        # Forza aggiornamento del coordinator se esiste
        for entry_id, data in hass.data.get(DOMAIN, {}).items():
            if isinstance(data, dict) and 'coordinator' in data:
                await data['coordinator'].async_request_refresh()
        
        _LOGGER.info(f"Configurazione '{setup_name}' impostata a '{setup_value}'")
    
    async def handle_set_time_config(call: ServiceCall) -> None:
        """Gestisce il servizio per impostare una configurazione a tempo."""
        setup_name = call.data.get("setup_name")
        setup_value = call.data.get("setup_value")
        valid_from = call.data.get("valid_from")
        valid_to = call.data.get("valid_to")
        
        await hass.async_add_executor_job(
            db.set_time_config, setup_name, setup_value, valid_from, valid_to
        )
        
        # Forza aggiornamento del coordinator se esiste
        for entry_id, data in hass.data.get(DOMAIN, {}).items():
            if isinstance(data, dict) and 'coordinator' in data:
                await data['coordinator'].async_request_refresh()
        
        _LOGGER.info(f"Configurazione a tempo '{setup_name}' impostata")
    
    async def handle_set_schedule_config(call: ServiceCall) -> None:
        """Gestisce il servizio per impostare una configurazione a orario."""
        setup_name = call.data.get("setup_name")
        setup_value = call.data.get("setup_value")
        valid_from_ora = call.data.get("valid_from_ora")
        valid_to_ora = call.data.get("valid_to_ora")
        days_of_week = call.data.get("days_of_week", "0,1,2,3,4,5,6")
        
        # Converte lista in stringa se necessario
        if isinstance(days_of_week, list):
            days_of_week = ','.join(map(str, days_of_week))
        
        await hass.async_add_executor_job(
            db.set_schedule_config, setup_name, setup_value, valid_from_ora, valid_to_ora, days_of_week
        )
        
        # Forza aggiornamento del coordinator se esiste
        for entry_id, data in hass.data.get(DOMAIN, {}).items():
            if isinstance(data, dict) and 'coordinator' in data:
                await data['coordinator'].async_request_refresh()
        
        _LOGGER.info(f"Configurazione a orario '{setup_name}' impostata")
    
    async def handle_delete_config(call: ServiceCall) -> None:
        """Gestisce il servizio per eliminare una configurazione."""
        setup_name = call.data.get("setup_name")
        config_type = call.data.get("config_type", "all")
        
        await hass.async_add_executor_job(
            db.delete_config, setup_name, config_type
        )
        
        # Aggiorna il coordinatore se esiste
        for entry_id, data in hass.data.get(DOMAIN, {}).items():
            if isinstance(data, dict) and 'coordinator' in data:
                await data['coordinator'].async_request_refresh()
        
        _LOGGER.info(f"Configurazione '{setup_name}' eliminata")
    
    async def handle_get_configurations(call: ServiceCall) -> None:
        """Gestisce il servizio per ottenere tutte le configurazioni."""
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
    
    # Schema dei servizi
    set_config_schema = vol.Schema({
        vol.Required("setup_name"): cv.string,
        vol.Required("setup_value"): cv.string,
        vol.Optional("priority", default=99): cv.positive_int,
    })
    
    set_time_config_schema = vol.Schema({
        vol.Required("setup_name"): cv.string,
        vol.Required("setup_value"): cv.string,
        vol.Required("valid_from"): cv.datetime,
        vol.Required("valid_to"): cv.datetime,
    })
    
    set_schedule_config_schema = vol.Schema({
        vol.Required("setup_name"): cv.string,
        vol.Required("setup_value"): cv.string,
        vol.Required("valid_from_ora"): vol.All(vol.Coerce(float), vol.Range(min=0, max=23.59)),
        vol.Required("valid_to_ora"): vol.All(vol.Coerce(float), vol.Range(min=0, max=23.59)),
        vol.Optional("days_of_week", default="0,1,2,3,4,5,6"): vol.Any(cv.string, [vol.In([0, 1, 2, 3, 4, 5, 6])]),
    })
    
    delete_config_schema = vol.Schema({
        vol.Required("setup_name"): cv.string,
        vol.Optional("config_type", default="all"): vol.In(["all", "standard", "time", "schedule"]),
    })
    
    delete_single_config_schema = vol.Schema({
        vol.Required("config_type"): vol.In(["standard", "time", "schedule"]),
        vol.Required("config_id"): cv.string,
    })
    
    get_configurations_schema = vol.Schema({
        vol.Optional("setup_name"): cv.string,
    })
    
    get_history_schema = vol.Schema({
        vol.Optional("setup_name"): cv.string,
        vol.Optional("limit", default=50): cv.positive_int,
    })
    
    async def handle_delete_single_config(call: ServiceCall) -> None:
        """Gestisce il servizio per eliminare una singola configurazione."""
        config_type = call.data.get("config_type")
        config_id = call.data.get("config_id")
        
        await hass.async_add_executor_job(
            db.delete_single_config, config_type, config_id
        )
        
        # Aggiorna il coordinatore se esiste
        for entry_id, data in hass.data.get(DOMAIN, {}).items():
            if isinstance(data, dict) and 'coordinator' in data:
                await data['coordinator'].async_request_refresh()
        
        _LOGGER.info(f"Configurazione singola {config_type} ID {config_id} eliminata")
    
    async def handle_get_history(call: ServiceCall) -> None:
        """Gestisce il servizio per ottenere lo storico."""
        setup_name = call.data.get("setup_name")
        limit = call.data.get("limit", 50)
        
        result = await hass.async_add_executor_job(
            db.get_history, setup_name, limit
        )
        
        # Converte la lista in dizionario per compatibilità con il sistema di response
        return {"history": result}
    
    # Registra i servizi
    hass.services.async_register(
        DOMAIN, "set_config", handle_set_config, schema=set_config_schema
    )
    
    hass.services.async_register(
        DOMAIN, "set_time_config", handle_set_time_config, schema=set_time_config_schema
    )
    
    hass.services.async_register(
        DOMAIN, "set_schedule_config", handle_set_schedule_config, schema=set_schedule_config_schema
    )
    
    hass.services.async_register(
        DOMAIN, "delete_config", handle_delete_config, schema=delete_config_schema
    )
    
    hass.services.async_register(
        DOMAIN, "delete_single_config", handle_delete_single_config, schema=delete_single_config_schema
    )
    
    hass.services.async_register(
        DOMAIN, "get_history", handle_get_history, schema=get_history_schema, supports_response=SupportsResponse.OPTIONAL
    )
    
    hass.services.async_register(
        DOMAIN, "get_configurations", handle_get_configurations, schema=get_configurations_schema, supports_response=SupportsResponse.OPTIONAL
    )


async def async_migrate_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Migrate old entry."""
    _LOGGER.debug("Migrating from version %s", entry.version)

    if entry.version == 1:
        # Nessuna migrazione necessaria per ora
        pass

    _LOGGER.info("Migration to version %s successful", entry.version)

    return True
