# Quick Start Guide - Mia Config

[🇮🇹 Italiano](QUICK_START.md) | 🇬🇧 **English**

This guide will help you get started with Mia Config in 5 minutes.

## Step 1: Installation

### Via HACS (Recommended)
1. Open HACS in Home Assistant
2. Go to "Integrations"
3. Click "+" → Search "Mia Config"
4. Click "Install"
5. Restart Home Assistant

### Manual Installation
1. Download the latest release from GitHub
2. Extract to `custom_components/mia_config/`
3. Restart Home Assistant

## Step 2: Add Integration

1. Go to **Settings** → **Devices & Services**
2. Click **Add Integration**
3. Search "Mia Config"
4. Enter database name (e.g., "main_home")
5. Click "Submit"

✅ The integration is now active!

## Step 3: Add the Lovelace Card

Add to your dashboard (or via UI):

```yaml
type: custom:mia-config-card
entity: sensor.main_home_active_configs
```

## Step 4: Create Your First Configuration

### Via UI (Easy)
1. Open the Mia Config card
2. Click "Add Configuration"
3. Fill in:
   - Name: `house_temperature`
   - Value: `20`
   - Priority: `99`
4. Click "Save"

### Via Service (Advanced)
```yaml
service: mia_config.set_standard_config
data:
  entity_id: sensor.main_home_active_configs
  setup_name: "house_temperature"
  setup_value: "20"
  priority: 99
  description: "Default house temperature"
```

## Step 5: Add a Schedule Override

Create an override for weekdays from 6:00 to 22:00:

```yaml
service: mia_config.set_schedule_config
data:
  entity_id: sensor.main_home_active_configs
  setup_name: "house_temperature"
  setup_value: "22"
  valid_from_ora: 6.0
  valid_to_ora: 22.0
  days_of_week: [0, 1, 2, 3, 4]  # Mon-Fri
  priority: 50
```

## Step 6: Use in Automation

```yaml
automation:
  - alias: "Adjust Thermostat"
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

## Quick Examples

### Vacation Mode
```yaml
service: mia_config.set_time_config
data:
  entity_id: sensor.main_home_active_configs
  setup_name: "alarm_mode"
  setup_value: "away"
  valid_from_date: "2026-08-01 00:00"
  valid_to_date: "2026-08-31 23:59"
  priority: 10
```

### Presence-Based
```yaml
service: mia_config.set_conditional_config
data:
  entity_id: sensor.main_home_active_configs
  setup_name: "house_temperature"
  setup_value: "18"
  conditional_config: "presence"
  conditional_operator: "=="
  conditional_value: "away"
  priority: 30
```

## Priority System

Remember the priority rules:
- **Lower number = Higher priority**
- **1-9**: Emergency (highest)
- **10-49**: Special events
- **50-89**: Daily schedules
- **90-99**: Default values (lowest)

## Weekly View

The card includes an interactive weekly visualization:
1. Click the "Weekly" tab
2. Select a configuration
3. Click "View"
4. Click on bars for details

## Next Steps

- 📖 Read the [complete guide](README_EN.md)
- 🎨 Explore the [UI guide](UI_GUIDE_EN.md)
- 🔧 Check [advanced examples](EXAMPLES_EN.md)
- 💾 Set up [automatic backups](BACKUP_GUIDE_EN.md)

## Need Help?

- 🐛 Report issues: https://github.com/abiale85/MiaConfig/issues
- 💬 Ask questions: https://github.com/abiale85/MiaConfig/discussions
- 📚 Full documentation: https://github.com/abiale85/MiaConfig/wiki

---

**Happy configuring! 🎉**
