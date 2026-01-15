# Mia Config for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/abiale85/MiaConfig.svg)](https://GitHub.com/abiale85/MiaConfig/releases/)
[![GitHub issues](https://img.shields.io/github/issues/abiale85/MiaConfig.svg)](https://GitHub.com/abiale85/MiaConfig/issues/)
[![License](https://img.shields.io/github/license/abiale85/MiaConfig.svg)](https://github.com/abiale85/MiaConfig/blob/main/LICENSE)

[🇮🇹 Italian](README.md) | 🇬🇧 **English**

A custom component for Home Assistant that manages dynamic configurations with values that automatically change based on temporal and time rules with an advanced priority system.

## Features

- **Multi-Instance**: Support for separate configurations for multiple homes/environments
- **Standard Configurations**: Default values with customizable priority system
- **Time Configurations**: Values valid in specific date intervals with priority
- **Schedule Configurations**: Values valid in daily time slots with weekday selection and priority
- **Conditional Configurations**: Dynamic values based on entity states
- **Advanced Priority System**: Each configuration has numerical priority (1 = highest, 99 = lowest)
- **Dynamic Sensors**: Each configuration is exposed as a sensor in Home Assistant
- **Event Prediction**: Attributes with ISO timestamps of next value changes
- **Weekly Lookahead**: Default prediction window set to 7 days (configurable via options)
- **Complete Services**: API for managing configurations via automations or scripts
- **Complete UI Interface**: Lovelace card with dashboard, weekly view, management, and history
- **Isolated Database**: Each instance has its own separate SQLite database
- **Complete History**: Modification history with pagination and restore

## Installation

### Method 1: Manual Installation

1. Copy the `custom_components/mia_config` folder to your Home Assistant `custom_components` folder
   - **Note**: The folder already includes necessary files in the `www/` subfolder
2. Restart Home Assistant

### Method 2: HACS (Recommended)

1. Open HACS
2. Go to "Integrations"
3. Click the three dots in the top right → "Custom repositories"
4. Add: `https://github.com/abiale85/MiaConfig` (Category: Integration)
5. Search for "Mia Config"
6. Click "Install"
7. Restart Home Assistant

## Configuration

### Adding via UI (Recommended)

1. Go to **Settings** → **Devices & Services**
2. Click **Add Integration**
3. Search for **Mia Config**
4. Enter a name for the database (e.g., "MiaHomeConfig" for main home)
5. Confirm

### Manual Configuration (Advanced)

Add to your `configuration.yaml`:

```yaml
mia_config:
  - db_name: "mia_home_config"
    scan_interval: 60
    lookahead_hours: 48
    lookback_hours: 24
    cleanup_days: 90
    retention_days: 365
    max_history_per_name: 1000
    min_history_per_name: 10
```

## Quick Start

### 1. Add the Lovelace Card

```yaml
type: custom:mia-config-card
entity: sensor.mia_home_config_active_configs
```

### 2. Create Your First Configuration

Via UI:
1. Open the Mia Config card
2. Click "Add Configuration"
3. Enter name (e.g., "house_temperature")
4. Set default value (e.g., "20")
5. Save

Via Service:
```yaml
service: mia_config.set_standard_config
data:
  setup_name: "house_temperature"
  setup_value: "20"
  priority: 99
  description: "Default house temperature"
```

### 3. Add Time-Based Override

Example: Higher temperature from 6:00 to 22:00:

```yaml
service: mia_config.set_schedule_config
data:
  setup_name: "house_temperature"
  setup_value: "22"
  valid_from_ora: 6.0
  valid_to_ora: 22.0
  days_of_week: [0, 1, 2, 3, 4]  # Monday to Friday
  priority: 50
```

### 4. Use in Automations

```yaml
automation:
  - alias: "Set Thermostat Based on Config"
    trigger:
      - platform: state
        entity_id: sensor.house_temperature
    action:
      - service: climate.set_temperature
        target:
          entity_id: climate.living_room
        data:
          temperature: "{{ states('sensor.house_temperature') | float }}"
```

## Configuration Types

### 1. Standard Configuration
Base values with priority. Multiple standard configs can coexist; the one with highest priority (lowest number) wins.

```yaml
service: mia_config.set_standard_config
data:
  setup_name: "alarm_mode"
  setup_value: "home"
  priority: 99
  description: "Default alarm mode"
```

### 2. Schedule Configuration
Overrides during specific time slots and weekdays.

```yaml
service: mia_config.set_schedule_config
data:
  setup_name: "alarm_mode"
  setup_value: "away"
  valid_from_ora: 8.0    # 8:00
  valid_to_ora: 18.0     # 18:00
  days_of_week: [0, 1, 2, 3, 4]  # Mon-Fri
  priority: 50
```

**Special Cases**:
- `valid_from_ora == valid_to_ora`: Active 24 hours (e.g., 8.0 - 8.0 = always active on selected days)
- `valid_to_ora < valid_from_ora`: Crosses midnight (e.g., 22.0 - 6.0 = from 22:00 to 6:00 next day)

### 3. Time Configuration
Overrides during specific date ranges.

```yaml
service: mia_config.set_time_config
data:
  setup_name: "alarm_mode"
  setup_value: "vacation"
  valid_from_date: "2026-08-01 00:00"
  valid_to_date: "2026-08-31 23:59"
  priority: 10
```

**Optional Filters**:
- `valid_from_ora`, `valid_to_ora`: Active only during time slots
- `days_of_week`: Active only on certain days

### 4. Conditional Configuration
Overrides based on other entity states.

```yaml
service: mia_config.set_conditional_config
data:
  setup_name: "house_temperature"
  setup_value: "18"
  conditional_config: "presence_mode"
  conditional_operator: "=="
  conditional_value: "away"
  priority: 30
```

**Supported Operators**: `==`, `!=`, `>`, `<`, `>=`, `<=`

## Priority System

Priorities determine which configuration wins when multiple are valid:
- **1-9**: Maximum priority (e.g., emergency overrides)
- **10-49**: High priority (e.g., vacations, special events)
- **50-89**: Normal priority (e.g., daily schedules)
- **90-99**: Low priority (e.g., standard configurations)

**Example**:
```
Standard "20" (priority 99)
Schedule "22" 6:00-22:00 (priority 50)
Time "18" vacation (priority 10)
```
Result: During vacation → "18", otherwise during 6:00-22:00 → "22", otherwise → "20"

## Advanced Features

### Multi-Instance

You can create multiple instances for different environments:

```yaml
mia_config:
  - db_name: "main_home"
    scan_interval: 60
  - db_name: "vacation_home"
    scan_interval: 120
  - db_name: "office"
    scan_interval: 300
```

Each instance has isolated sensors and databases.

### Backup and Restore

#### Create Backup
```yaml
service: mia_config.backup_database
data:
  entity_id: sensor.mia_home_config_active_configs
  backup_name: "pre_update_backup"
```

#### Restore from Backup
```yaml
service: mia_config.restore_database
data:
  entity_id: sensor.mia_home_config_active_configs
  backup_name: "pre_update_backup"
```

### History and Audit

All changes are recorded in history with:
- Timestamp
- Configuration type
- Values
- Operation (created, modified, deleted)

View history via:
- UI card (History tab)
- Service `mia_config.get_history`

### Weekly View

The card includes an interactive weekly view that shows:
- All active configurations
- Time slots
- Overlaps
- Click on bars for details

## Sensor Attributes

Each sensor exposes these attributes:

```yaml
friendly_name: "house_temperature"
current_value: "22"
current_priority: 50
current_type: "schedule"
valid_from: "2026-01-06T06:00:00+01:00"
valid_to: "2026-01-06T22:00:00+01:00"
next_change_time: "2026-01-06T22:00:00+01:00"
next_change_value: "20"
next_change_type: "standard"
all_configs: [...]  # All active configurations
```

## Complete Services

### Management Services
- `set_standard_config`: Set standard configuration
- `set_schedule_config`: Set schedule override
- `set_time_config`: Set temporal override
- `set_conditional_config`: Set conditional override
- `update_standard_config`: Update existing configuration
- `delete_config`: Delete configuration
- `delete_single_config`: Delete specific configuration by ID
- `toggle_config`: Enable/disable configuration

### Query Services
- `get_configurations`: Get all configurations
- `get_history`: Get modification history
- `get_valid_values`: Get all valid values for dropdown lists
- `simulate_schedule`: Simulate weekly schedule

### Backup Services
- `backup_database`: Create backup
- `restore_database`: Restore from backup
- `list_backups`: List available backups
- `delete_backup`: Delete specific backup
- `delete_all_backups`: Delete all backups

### Maintenance Services
- `cleanup_history`: Clean old history
- `import_config`: Import configurations from YAML
- `export_config`: Export configurations to YAML

## Troubleshooting

### Sensors not updating
- Check scan_interval in configuration
- Verify configurations are enabled
- Check Home Assistant logs

### Conflicts between configurations
- Review priorities
- Use weekly view to visualize overlaps
- Check history for recent changes

### Card not appearing
- Clear browser cache (Ctrl+F5)
- Verify `www/mia-config-card.js` exists
- Check browser console for errors

## Development

### Testing
```bash
# Run tests
pytest tests/

# Check coverage
pytest --cov=custom_components/mia_config tests/
```

### Contributing
Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file

## Support

- **Issues**: https://github.com/abiale85/MiaConfig/issues
- **Discussions**: https://github.com/abiale85/MiaConfig/discussions
- **Documentation**: https://github.com/abiale85/MiaConfig/wiki

## Credits

Developed by [@abiale85](https://github.com/abiale85)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

## Screenshots

![Dashboard](images/dashboard.png)
![Weekly View](images/weekly_view.png)
![Configuration Management](images/config_management.png)

---

**Made with ❤️ for the Home Assistant community**
