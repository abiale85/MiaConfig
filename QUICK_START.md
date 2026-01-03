# 🚀 Quick Start - Mia Config

## Installazione Rapida

### 1. Installa il Componente
La cartella `custom_components/mia_config` è già pronta!
- Include già la sottocartella `www/` con i file JavaScript necessari

### 2. Configura Home Assistant

**Opzione A - Tramite UI (Consigliato)**:
1. Vai su **Impostazioni** → **Dispositivi e Servizi**
2. Click su **+ AGGIUNGI INTEGRAZIONE**
3. Cerca **"Mia Config"**
4. Inserisci il nome del database (es. "MiaHomeConfig")
5. Configura l'intervallo di scansione (default: 60 secondi)

**Opzione B - Tramite YAML** (legacy):
Aggiungi a `configuration.yaml`:
```yaml
mia_config:
  db_name: "MiaHomeConfig"
  scan_interval: 60
```

### 3. Riavvia Home Assistant

### 4. Installa l'Interfaccia UI (Opzionale ma Consigliato)

#### A. Registra la Risorsa
**Metodo 1 - Tramite UI:**
1. Vai su **Impostazioni** → **Dashboard**
2. Click sui tre puntini in alto a destra → **Risorse**
3. Click **+ Aggiungi Risorsa**
4. URL: `/mia_config_local/mia-config-card.js`
5. Tipo: **JavaScript Module**

**Metodo 2 - Tramite YAML:**
Aggiungi a `configuration.yaml`:
```yaml
lovelace:
  mode: yaml
  resources:
    - url: /mia_config_local/mia-config-card.js
      type: module
```

#### B. Aggiungi la Card
1. Vai su un dashboard
2. Click **Modifica Dashboard**
3. Click **+ Aggiungi Card**
4. Scorri in basso e click **Manuale**
5. Incolla:
```yaml
type: custom:mia-config-card
entity_id: sensor.miahomeconfig_main  # Opzionale
```
6. Salva!

## Primo Utilizzo

### Esempio: Temperatura Climatizzatore

#### Con l'Interfaccia UI:
1. Apri la card Dynamic Config
2. Vai su tab **⚙️ Standard**
3. Compila:
   - Nome: `temperatura_clima`
   - Valore: `22`
   - Priorità: `99`
4. Click **Salva**

5. Vai su tab **🕐 Orario**
6. Compila:
   - Nome: `temperatura_clima`
   - Valore: `19`
   - Dalle: `22.00`
   - Alle: `6.00`
   - Giorni: seleziona tutti
7. Click **Salva**

#### Con i Servizi:
Vai su **Strumenti Sviluppatori** → **Servizi**:

```yaml
service: dynamic_config.set_config
data:
  setup_name: "temperatura_clima"
  setup_value: "22"
```

```yaml
service: dynamic_config.set_schedule_config
data:
  setup_name: "temperatura_clima"
  setup_value: "19"
  valid_from_ora: 22.00
  valid_to_ora: 6.00
  days_of_week: ["0", "1", "2", "3", "4", "5", "6"]
```

### Usa il Sensore nell'Automazione

```yaml
automation:
  - alias: "Temperatura Automatica"
    trigger:
      - platform: state
        entity_id: sensor.dynamic_config_temperatura_clima
    action:
      - service: climate.set_temperature
        target:
          entity_id: climate.tuo_termostato
        data:
          temperature: "{{ states('sensor.dynamic_config_temperatura_clima') | float }}"
```

## Verifica Installazione

1. **Verifica il componente**: Vai su **Strumenti Sviluppatori** → **Servizi** e cerca `dynamic_config`
2. **Verifica i sensori**: Dopo aver creato una configurazione, cerca `sensor.dynamic_config_*`
3. **Verifica la card**: Dovrebbe essere visibile nel tuo dashboard

## Problemi Comuni

### La card non appare
- Verifica che il file sia in `custom_components/mia_config/www/mia-config-card.js`
- Controlla di aver registrato la risorsa con l'URL: `/mia_config_local/mia-config-card.js`
- Ricarica completamente il browser (Ctrl+F5 o Cmd+Shift+R)
- Controlla la console del browser (F12) per errori

### I servizi non appaiono
- Verifica la configurazione in `configuration.yaml`
- Riavvia Home Assistant
- Controlla i log: **Impostazioni** → **Sistema** → **Log**

### I sensori non si creano
- Crea almeno una configurazione usando i servizi
- Attendi l'intervallo di scan (default 60 secondi)
- Ricarica la pagina

## Prossimi Passi

- Leggi [README.md](README.md) per la documentazione completa
- Leggi [UI_GUIDE.md](UI_GUIDE.md) per dettagli sull'interfaccia
- Vedi [automations.yaml.example](automations.yaml.example) per esempi di automazioni

## 🎯 Caso d'Uso Completo

**Obiettivo**: Gestire la temperatura del riscaldamento automaticamente

1. **Temperatura base**: 21°C
2. **Notte (22-06)**: 18°C solo nei giorni feriali
3. **Weekend**: 20°C tutto il giorno
4. **Vacanze Natale**: 16°C dal 20/12 al 10/01

### Setup:

```yaml
# 1. Base
service: dynamic_config.set_config
data:
  setup_name: "temp_casa"
  setup_value: "21"

# 2. Notte Feriale
service: dynamic_config.set_schedule_config
data:
  setup_name: "temp_casa"
  setup_value: "18"
  valid_from_ora: 22.00
  valid_to_ora: 6.00
  days_of_week: ["0", "1", "2", "3", "4"]

# 3. Weekend
service: dynamic_config.set_schedule_config
data:
  setup_name: "temp_casa"
  setup_value: "20"
  valid_from_ora: 0.00
  valid_to_ora: 23.59
  days_of_week: ["5", "6"]

# 4. Vacanze
service: dynamic_config.set_time_config
data:
  setup_name: "temp_casa"
  setup_value: "16"
  valid_from: "2025-12-20 00:00:00"
  valid_to: "2026-01-10 23:59:59"
```

### Automazione:

```yaml
automation:
  - alias: "Temperatura Automatica Casa"
    trigger:
      - platform: state
        entity_id: sensor.dynamic_config_temp_casa
      - platform: homeassistant
        event: start
    action:
      - service: climate.set_temperature
        target:
          entity_id: climate.termostato
        data:
          temperature: "{{ states('sensor.dynamic_config_temp_casa') | float }}"
```

**Fatto!** Il sistema gestirà tutto automaticamente. 🎉
