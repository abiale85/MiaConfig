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
    
    # Track existing sensors
    existing_sensors = {}
    
    async def async_update_data():
        """Aggiorna i dati dal database."""
        return await hass.async_add_executor_job(db.get_all_configurations)
    
    coordinator = DataUpdateCoordinator(
        hass,
        _LOGGER,
        name="mia_config",
        update_method=async_update_data,
        update_interval=timedelta(seconds=scan_interval),
    )
    
    # Esegui il primo aggiornamento
    await coordinator.async_config_entry_first_refresh()
    
    async def async_update_sensors():
        """Update sensors based on coordinator data."""
        current_configs = set(coordinator.data.keys())
        tracked_configs = set(existing_sensors.keys())
        
        # Add new sensors
        new_configs = current_configs - tracked_configs
        if new_configs:
            new_sensors = []
            for setup_name in new_configs:
                sensor = DynamicConfigSensor(coordinator, setup_name, db)
                existing_sensors[setup_name] = sensor
                new_sensors.append(sensor)
            async_add_entities(new_sensors, True)
            _LOGGER.debug(f"Added new sensors: {new_configs}")
        
        # Remove old sensors
        removed_configs = tracked_configs - current_configs
        for setup_name in removed_configs:
            sensor = existing_sensors.pop(setup_name)
            await sensor.async_remove()
            _LOGGER.debug(f"Removed sensor: {setup_name}")
    
    # Initial sensor creation
    await async_update_sensors()
    
    # Add listener to coordinator to update sensors on data change
    coordinator.async_add_listener(lambda: hass.async_create_task(async_update_sensors()))
    
    # Salva il coordinator per aggiornamenti futuri
    entry_data = hass.data[DOMAIN].setdefault(entry.entry_id, {})
    entry_data["coordinator"] = coordinator
    entry_data["existing_sensors"] = existing_sensors


class DynamicConfigSensor(CoordinatorEntity, SensorEntity):
    """Sensore per una configurazione dinamica."""
    
    def __init__(
        self,
        coordinator: DataUpdateCoordinator,
        setup_name: str,
        db: ConfigDatabase,
    ) -> None:
        """Inizializza il sensore."""
        super().__init__(coordinator)
        self._setup_name = setup_name
        self._db = db
        self._attr_name = f"Mia Config {setup_name}"
        self._attr_unique_id = f"mia_config_{setup_name}"
        self._attr_has_entity_name = True
    
    @property
    def native_value(self) -> Optional[str]:
        """Restituisce il valore corrente della configurazione."""
        if self._setup_name in self.coordinator.data:
            return self.coordinator.data[self._setup_name].get('value')
        return None
    
    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Restituisce attributi extra del sensore."""
        if self._setup_name not in self.coordinator.data:
            return {}
        
        config_data = self.coordinator.data[self._setup_name]
        attributes = {
            "setup_name": self._setup_name,
            "source": config_data.get('source', 'unknown'),
        }
        
        # Aggiungi informazioni specifiche in base al tipo
        if 'priority' in config_data:
            attributes['priority'] = config_data['priority']
        
        if 'valid_to' in config_data:
            attributes['valid_to'] = config_data['valid_to']
        
        return attributes
    
    @property
    def icon(self) -> str:
        """Restituisce l'icona del sensore."""
        if self._setup_name not in self.coordinator.data:
            return "mdi:cog-off"
        
        source = self.coordinator.data[self._setup_name].get('source')
        if source == 'time':
            return "mdi:calendar-clock"
        elif source == 'schedule':
            return "mdi:clock-outline"
        else:
            return "mdi:cog"
    
    @property
    def available(self) -> bool:
        """Restituisce se il sensore è disponibile."""
        return self._setup_name in self.coordinator.data
