"""Sensor platform per Mia Config."""
import logging
from datetime import timedelta
from typing import Any, Optional

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.typing import ConfigType, DiscoveryInfoType
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
    scan_interval = hass.data[DOMAIN]["scan_interval"]
    lookahead_hours = hass.data[DOMAIN].get("lookahead_hours", 24)
    lookback_hours = hass.data[DOMAIN].get("lookback_hours", 24)
    
    # Track existing sensors
    existing_sensors = {}
    
    # Cache per dati predittivi: evita query ripetute se i valori non cambiano
    predictive_cache = {}
    last_configs = {}
    last_recalc_time = {}  # Traccia ultimo ricalcolo per ogni setup
    
    async def async_update_data():
        """Aggiorna i dati dal database."""
        configs = await hass.async_add_executor_job(db.get_all_configurations)
        current_time = hass.loop.time()
        
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
            elif current_value != last_value:
                # Valore cambiato, ricalcola
                needs_recalc = True
                recalc_reason = f"valore cambiato da {last_value} a {current_value}"
            elif cached.get('next_changes'):
                # Controlla se il prossimo evento è vicino (< 2 minuti): ricalcola per aggiornare il countdown
                next_event_minutes = cached['next_changes'][0].get('minutes_until', 999)
                if next_event_minutes < 2:
                    needs_recalc = True
                    recalc_reason = f"prossimo evento tra {next_event_minutes}min"
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
                    minutes_active = await hass.async_add_executor_job(
                        db.get_current_config_start_time, setup_name
                    )
                    predictive_data[setup_name] = {
                        'next_changes': next_changes,
                        'minutes_active': minutes_active,
                        'start_time_base': minutes_active  # Salva il valore base per calcoli incrementali
                    }
                    predictive_cache[setup_name] = {
                        'next_changes': next_changes,
                        'start_time_base': minutes_active,
                        'last_update': configs[setup_name].get('value')  # Traccia il valore a cui corrisponde
                    }
                    last_recalc_time[setup_name] = current_time  # Aggiorna timestamp ricalcolo
                except Exception as e:
                    _LOGGER.error(f"Errore calcolo dati predittivi per {setup_name}: {e}")
                    predictive_data[setup_name] = {
                        'next_changes': [],
                        'minutes_active': None
                    }
            else:
                # Usa la cache: calcola minutes_active incrementalmente senza query
                # Se il valore non è cambiato, aggiungi semplicemente scan_interval
                base_minutes = cached.get('start_time_base', 0)
                if base_minutes is not None:
                    # Incrementa dal valore base (approssimazione, evita query)
                    estimated_minutes = base_minutes + scan_interval // 60
                    predictive_data[setup_name] = {
                        'next_changes': cached['next_changes'],
                        'minutes_active': estimated_minutes
                    }
                else:
                    predictive_data[setup_name] = {
                        'next_changes': cached['next_changes'],
                        'minutes_active': None
                    }
        
        # Salva stato corrente per il prossimo ciclo
        last_configs.clear()
        last_configs.update(configs)
        
        return {
            'configs': configs,
            'predictive': predictive_data
        }
    
    coordinator = DataUpdateCoordinator(
        hass,
        _LOGGER,
        name="mia_config",
        update_method=async_update_data,
        update_interval=timedelta(seconds=scan_interval),
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
        minutes_active = predictive.get('minutes_active')
        
        if next_changes:
            # Prossimo cambiamento
            next_change = next_changes[0]
            attributes['next_value'] = next_change['value']
            attributes['next_change_in_minutes'] = next_change['minutes_until']
            attributes['next_change_type'] = next_change['type']
            
            # Lista di tutti i prossimi cambiamenti (max 5)
            upcoming_events = []
            for event in next_changes:
                upcoming_events.append({
                    'value': event['value'],
                    'in_minutes': event['minutes_until'],
                    'type': event['type']
                })
            attributes['upcoming_changes'] = upcoming_events
            
            # Testo descrittivo dei prossimi eventi
            upcoming_text = []
            for event in next_changes:
                hours = event['minutes_until'] // 60
                mins = event['minutes_until'] % 60
                if hours > 0:
                    time_str = f"{hours}h {mins}min"
                else:
                    time_str = f"{mins}min"
                upcoming_text.append(f"{event['value']} tra {time_str}")
            attributes['upcoming_text'] = upcoming_text
            
            # Attributi dinamici per ogni valore futuro (per automazioni)
            # Traccia quale valore appare per primo (per evitare duplicati)
            value_first_occurrence = {}
            for event in next_changes:
                value = event['value']
                minutes = event['minutes_until']
                
                # Usa solo la prima occorrenza di ogni valore
                if value not in value_first_occurrence:
                    value_first_occurrence[value] = minutes
                    # Crea attributo: next_<valore>_in_minutes
                    # Il valore è già validato dal database (solo alfanumerici e underscore)
                    attr_name = f"next_{value}_in_minutes"
                    attributes[attr_name] = minutes
        else:
            attributes['next_value'] = None
            attributes['next_change_in_minutes'] = None
            attributes['upcoming_changes'] = []
            attributes['upcoming_text'] = []
        
        # Durata valore corrente
        if minutes_active is not None:
            attributes['current_value_since_minutes'] = minutes_active
            hours = minutes_active // 60
            mins = minutes_active % 60
            if hours > 0:
                attributes['current_value_since_text'] = f"{hours}h {mins}min"
            else:
                attributes['current_value_since_text'] = f"{mins}min"
        else:
            attributes['current_value_since_minutes'] = None
            attributes['current_value_since_text'] = "N/A (standard)"
        
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
    
    async def async_will_remove_from_hass(self) -> None:
        """Chiamato quando l'entità sta per essere rimossa da Home Assistant.
        
        Cancella automaticamente tutte le configurazioni associate dal database.
        """
        await super().async_will_remove_from_hass()
        
        _LOGGER.info(f"Removing entity {self._attr_unique_id}, deleting all configurations for setup_name: {self._setup_name}")
        
        # Cancella tutte le configurazioni per questo setup_name dal database
        try:
            # Ottieni tutti i config_id per questo setup_name
            configs = await self.hass.async_add_executor_job(
                self._db.get_all_configurations_by_name,
                self._setup_name
            )
            
            # Cancella ogni configurazione
            for config in configs:
                config_id = config.get('id')
                if config_id:
                    await self.hass.async_add_executor_job(
                        self._db.delete_single_config,
                        config_id
                    )
                    _LOGGER.debug(f"Deleted configuration ID {config_id} for {self._setup_name}")
            
            _LOGGER.info(f"Successfully deleted all data for {self._setup_name} from database")
        except Exception as err:
            _LOGGER.error(f"Error deleting configurations for {self._setup_name}: {err}")
