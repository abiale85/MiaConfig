"""Sensor platform per Mia Config."""
import logging
import time
from datetime import datetime, timedelta
from typing import Any, Optional

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.typing import ConfigType, DiscoveryInfoType

from . import get_translation
from homeassistant.helpers.update_coordinator import (
    CoordinatorEntity,
    DataUpdateCoordinator,
    UpdateFailed,
)
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN
from .database import ConfigDatabase

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up del platform sensor da config entry."""
    db: ConfigDatabase = hass.data[DOMAIN]["db"]
    lookahead_hours = hass.data[DOMAIN].get("lookahead_hours", 24)
    lookback_hours = hass.data[DOMAIN].get("lookback_hours", 24)
    
    # Track existing sensors
    existing_sensors = {}
    
    # Cache per dati predittivi: evita query ripetute se i valori non cambiano
    predictive_cache = {}
    last_configs = {}
    last_recalc_time = {}  # Traccia ultimo ricalcolo per ogni setup
    last_config_version = None  # Traccia versione configurazioni per invalidare cache
    
    async def async_update_data():
        """Aggiorna i dati dal database."""
        nonlocal last_config_version
        configs = await hass.async_add_executor_job(db.get_all_configurations)
        # Usa timestamp epoch reale, non il clock monotono dell'event loop
        current_time = time.time()
        
        # Controlla se le configurazioni sono cambiate (nuova versione)
        current_config_version = db._config_version
        config_changed = last_config_version != current_config_version
        if config_changed:
            _LOGGER.debug(f"Configurazione cambiata (versione {current_config_version}), invalido cache predittive")
            predictive_cache.clear()  # Invalida tutta la cache predittiva
            last_config_version = current_config_version
        
        # Calcola i dati predittivi SOLO se necessario
        predictive_data = {}
        for setup_name in configs.keys():
            current_value = configs[setup_name].get('value')
            last_value = last_configs.get(setup_name, {}).get('value')
            
            # Recupera dalla cache se esiste
            cached = predictive_cache.get(setup_name)
            needs_recalc = False
            recalc_reason = None
            
            if cached is None:
                # Prima volta, calcola
                needs_recalc = True
                recalc_reason = "prima volta"
            elif config_changed:
                # Configurazioni cambiate, ricalcola
                needs_recalc = True
                recalc_reason = "configurazioni cambiate"
            elif current_value != last_value:
                # Valore cambiato, ricalcola
                needs_recalc = True
                recalc_reason = f"valore cambiato da {last_value} a {current_value}"
            else:
                # Nessun evento nei prossimi lookahead_hours: ricalcola ogni ora per vedere se ne compaiono
                last_calc = last_recalc_time.get(setup_name, 0)
                if current_time - last_calc > 3600:  # 1 ora
                    needs_recalc = True
                    recalc_reason = "ricalcolo periodico (nessun evento visibile)"
            
            if needs_recalc:
                if recalc_reason:
                    _LOGGER.debug(f"{setup_name}: {recalc_reason}, ricalcolo predittivi")
                try:
                    next_changes = await hass.async_add_executor_job(
                        db.get_next_changes, setup_name, lookahead_hours
                    )
                    predictive_data[setup_name] = {
                        'next_changes': next_changes,
                        'last_recalc': current_time
                    }
                    predictive_cache[setup_name] = {
                        'next_changes': next_changes,
                        'last_update': configs[setup_name].get('value'),  # Traccia il valore a cui corrisponde
                        'last_recalc': current_time
                    }
                    last_recalc_time[setup_name] = current_time  # Aggiorna timestamp ricalcolo
                except Exception as e:
                    _LOGGER.error(f"Errore calcolo dati predittivi per {setup_name}: {e}")
                    predictive_data[setup_name] = {
                        'next_changes': [],
                        'last_recalc': current_time
                    }
            else:
                # Mantieni i dati predittivi già calcolati, così non spariscono a ogni refresh
                if cached:
                    predictive_data[setup_name] = {
                        'next_changes': cached.get('next_changes', []),
                        'last_recalc': cached.get('last_recalc')
                    }
        
        # Salva stato corrente per il prossimo ciclo
        last_configs.clear()
        last_configs.update(configs)
        
        # Calcola scheduling dinamico basato su next_change_at più vicino
        next_update_seconds = None
        earliest_change = None
        
        for setup_name, pred_data in predictive_data.items():
            next_changes = pred_data.get('next_changes', [])
            if next_changes and len(next_changes) > 0:
                # Prendi il primo cambio (il più vicino)
                minutes_until = next_changes[0].get('minutes_until', None)
                if minutes_until is not None and minutes_until > 0:
                    seconds_until = minutes_until * 60
                    if earliest_change is None or seconds_until < earliest_change:
                        earliest_change = seconds_until
        
        if earliest_change is not None:
            # Applica limiti: min 30s, max 24h
            MIN_INTERVAL = 30
            MAX_INTERVAL = 86400  # 24 ore
            
            if earliest_change < MIN_INTERVAL:
                next_update_seconds = MIN_INTERVAL
                _LOGGER.debug(f"Next change in {earliest_change}s, scheduling update in {MIN_INTERVAL}s (minimum)")
            elif earliest_change > MAX_INTERVAL:
                next_update_seconds = MAX_INTERVAL
                _LOGGER.debug(f"Next change in {earliest_change}s, scheduling update in {MAX_INTERVAL}s (maximum)")
            else:
                # Schedula qualche secondo prima del cambio effettivo per assicurarsi di catturarlo
                next_update_seconds = max(MIN_INTERVAL, earliest_change - 10)
                _LOGGER.debug(f"Next change in {earliest_change}s, scheduling update in {next_update_seconds}s")
        else:
            # Nessun cambio previsto: usa intervallo lungo di default (1 ora)
            next_update_seconds = 3600
            _LOGGER.debug(f"No changes predicted, using fallback interval: {next_update_seconds}s")
        
        # Aggiorna dinamicamente l'intervallo del coordinator
        if next_update_seconds and next_update_seconds != coordinator.update_interval.total_seconds():
            coordinator.update_interval = timedelta(seconds=next_update_seconds)
            _LOGGER.info(f"Update interval dynamically adjusted to {next_update_seconds}s")
        
        return {
            'configs': configs,
            'predictive': predictive_data
        }
    
    coordinator = DataUpdateCoordinator(
        hass,
        _LOGGER,
        name="mia_config",
        update_method=async_update_data,
        update_interval=timedelta(seconds=3600),  # Verrà aggiornato dinamicamente
    )
    
    # Esegui il primo aggiornamento
    await coordinator.async_config_entry_first_refresh()
    
    # Crea sempre un sensore principale per l'istanza (anche con DB vuoto)
    db_name = entry.data.get("db_name", "mia_config")
    main_sensor = MiaConfigMainSensor(coordinator, db_name, db, entry)
    async_add_entities([main_sensor], True)
    _LOGGER.info(f"Created main sensor for instance: {db_name}")
    
    async def async_update_sensors():
        """Update sensors based on coordinator data."""
        current_configs = set(coordinator.data.get('configs', {}).keys())
        tracked_configs = set(existing_sensors.keys())
        
        # Add new sensors
        new_configs = current_configs - tracked_configs
        if new_configs:
            new_sensors = []
            for setup_name in new_configs:
                sensor = DynamicConfigSensor(coordinator, setup_name, db, entry)
                existing_sensors[setup_name] = sensor
                new_sensors.append(sensor)
            async_add_entities(new_sensors, True)
            _LOGGER.debug(f"Added new sensors: {new_configs}")
        
        # Remove old sensors
        removed_configs = tracked_configs - current_configs
        if removed_configs:
            registry = er.async_get(hass)
            for setup_name in removed_configs:
                sensor = existing_sensors.pop(setup_name)
                
                # Rimuovi dal registry
                entity_id = sensor.entity_id
                if entity_id and registry.async_get(entity_id):
                    registry.async_remove(entity_id)
                    _LOGGER.info(f"Removed entity from registry: {entity_id}")
                
                # Rimuovi l'entità
                await sensor.async_remove(force_remove=True)
                _LOGGER.debug(f"Removed sensor: {setup_name}")
    
    # Initial sensor creation for configs
    await async_update_sensors()
    
    # Add listener to coordinator to update sensors on data change
    coordinator.async_add_listener(lambda: hass.async_create_task(async_update_sensors()))
    
    # Salva il coordinator per aggiornamenti futuri
    entry_data = hass.data[DOMAIN].setdefault(entry.entry_id, {})
    entry_data["coordinator"] = coordinator
    entry_data["existing_sensors"] = existing_sensors
    
    # Funzione per invalidare la cache (chiamata dai servizi)
    def clear_predictive_cache():
        """Invalida la cache dei dati predittivi per forzare ricalcolo."""
        predictive_cache.clear()
        last_recalc_time.clear()
        _LOGGER.debug("Cache predittiva invalidata")
    
    entry_data["clear_cache"] = clear_predictive_cache


class MiaConfigMainSensor(CoordinatorEntity, SensorEntity):
    """Sensore principale per l'istanza Mia Config."""
    
    def __init__(
        self,
        coordinator: DataUpdateCoordinator,
        db_name: str,
        db: ConfigDatabase,
        entry: ConfigEntry,
    ) -> None:
        """Inizializza il sensore principale."""
        super().__init__(coordinator)
        self._db_name = db_name
        self._db = db
        self._entry = entry
        self._attr_name = f"Mia Config {db_name}"
        self._attr_unique_id = f"mia_config_{db_name}_{entry.entry_id}"
        self._attr_has_entity_name = False
    
    @property
    def native_value(self) -> int:
        """Restituisce il numero di configurazioni attive."""
        configs = self.coordinator.data.get('configs', {})
        return len(configs)
    
    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Restituisce attributi extra del sensore principale."""
        configs = self.coordinator.data.get('configs', {})
        return {
            "db_name": self._db_name,
            "integration": DOMAIN,
            "entry_id": self._entry.entry_id,
            "total_configs": len(configs),
            "config_names": list(configs.keys()),
        }
    
    @property
    def icon(self) -> str:
        """Icona del sensore."""
        return "mdi:cog-outline"


class DynamicConfigSensor(CoordinatorEntity, SensorEntity):
    """Sensore per una configurazione dinamica."""
    
    def __init__(
        self,
        coordinator: DataUpdateCoordinator,
        setup_name: str,
        db: ConfigDatabase,
        entry: ConfigEntry,
    ) -> None:
        """Inizializza il sensore."""
        super().__init__(coordinator)
        self._setup_name = setup_name
        self._db = db
        self._entry = entry
        self._attr_name = f"Mia Config {setup_name}"
        self._attr_unique_id = f"mia_config_{setup_name}_{entry.entry_id}"
        self._attr_has_entity_name = True
    
    @property
    def native_value(self) -> Optional[str]:
        """Restituisce il valore corrente della configurazione."""
        configs = self.coordinator.data.get('configs', {})
        if self._setup_name in configs:
            return configs[self._setup_name].get('value')
        return None
    
    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Restituisce attributi extra del sensore."""
        configs = self.coordinator.data.get('configs', {})
        if self._setup_name not in configs:
            return {}
        
        config_data = configs[self._setup_name]
        attributes = {
            "setup_name": self._setup_name,
            "source": config_data.get('source', 'unknown'),
            "integration": DOMAIN,
            "entry_id": self._entry.entry_id,
            "db_name": self._entry.data.get("db_name", "mia_config"),
        }
        
        # Aggiungi descrizione se presente
        if config_data.get('description'):
            attributes['description'] = config_data['description']
        
        # Aggiungi informazioni specifiche in base al tipo
        if 'priority' in config_data:
            attributes['priority'] = config_data['priority']
        
        if 'valid_to' in config_data:
            attributes['valid_to'] = config_data['valid_to']
        
        # Usa i dati predittivi già calcolati dal coordinator
        predictive = self.coordinator.data.get('predictive', {}).get(self._setup_name, {})
        next_changes = predictive.get('next_changes', [])
        
        # Aggiungi timestamp ultimo ricalcolo se disponibile
        last_recalc = predictive.get('last_recalc')
        if last_recalc:
            try:
                recalc_time = datetime.fromtimestamp(last_recalc)
                attributes['predictive_last_recalc'] = recalc_time.isoformat()
            except (ValueError, TypeError):
                attributes['predictive_last_recalc'] = str(last_recalc)
        
        if next_changes:
            # Prossimo cambiamento
            next_change = next_changes[0]
            
            attributes['next_value'] = next_change['value']
            attributes['next_change_type'] = next_change['type']
            if 'id' in next_change:
                attributes['next_value_id'] = next_change['id']
            
            # Timestamp del prossimo evento (se disponibile)
            if 'timestamp' in next_change:
                attributes['next_change_at'] = next_change['timestamp']
            
            # Lista di tutti i prossimi cambiamenti con timestamp
            upcoming_events = []
            for event in next_changes:
                event_data = {
                    'value': event['value'],
                    'type': event['type']
                }
                if 'id' in event:
                    event_data['id'] = event['id']
                if 'timestamp' in event:
                    event_data['at'] = event['timestamp']
                upcoming_events.append(event_data)
            
            attributes['upcoming_changes'] = upcoming_events
            
            # Testo descrittivo con data/ora
            upcoming_text = []
            for event in upcoming_events:
                if 'at' in event:
                    try:
                        event_time = datetime.fromisoformat(event['at'])
                        time_str = event_time.strftime('%d/%m %H:%M')
                    except:
                        time_str = event['at']
                    upcoming_text.append(f"{event['value']} il {time_str}")
                else:
                    upcoming_text.append(f"{event['value']}")
            
            # Attributi dinamici per ogni valore futuro (per automazioni) - con timestamp
            value_first_occurrence = {}
            for event in upcoming_events:
                value = event['value']
                
                # Usa solo la prima occorrenza di ogni valore
                if value not in value_first_occurrence and 'at' in event:
                    value_first_occurrence[value] = event['at']
                    # Crea attributo: next_<valore>_at
                    attr_name = f"next_{value}_at"
                    attributes[attr_name] = event['at']
        else:
            # Usa la traduzione per il messaggio di nessun evento
            days = 7  # 168 ore / 24 = 7 giorni
            message = get_translation(self.hass, "sensor.no_upcoming_events", days=days)
            
            attributes['next_value'] = message
            attributes['next_change_at'] = None
            attributes['next_change_type'] = None
        
        return attributes
    
    @property
    def icon(self) -> str:
        """Restituisce l'icona del sensore."""
        configs = self.coordinator.data.get('configs', {})
        if self._setup_name not in configs:
            return "mdi:cog-off"
        
        source = configs[self._setup_name].get('source')
        if source == 'time':
            return "mdi:calendar-clock"
        elif source == 'schedule':
            return "mdi:clock-outline"
        else:
            return "mdi:cog"
    
    @property
    def available(self) -> bool:
        """Restituisce se il sensore è disponibile."""
        configs = self.coordinator.data.get('configs', {})
        return self._setup_name in configs
