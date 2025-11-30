# Dynamic Config per Home Assistant

Un componente custom per Home Assistant che gestisce configurazioni dinamiche con valori che cambiano automaticamente in base a regole temporali e orarie.

## Caratteristiche

- **Configurazioni Standard**: Valori di default con sistema di priorità
- **Configurazioni a Tempo**: Valori validi in intervalli di date specifici
- **Configurazioni a Orario**: Valori validi in fasce orarie giornaliere con selezione giorni settimana
- **Priorità Automatica**: Il sistema applica automaticamente la configurazione più specifica (Tempo > Orario > Standard)
- **Sensori Dinamici**: Ogni configurazione viene esposta come sensore in Home Assistant
- **Servizi Completi**: API per gestire le configurazioni tramite automazioni o script
- **Interfaccia UI**: Card Lovelace personalizzata per gestire tutte le configurazioni senza scrivere YAML

## Installazione

### Metodo 1: Installazione Manuale

1. Copia la cartella `custom_components/dynamic_config` nella cartella `custom_components` della tua configurazione Home Assistant
2. Riavvia Home Assistant

### Metodo 2: HACS (se pubblicato)

1. Apri HACS
2. Vai su "Integrazioni"
3. Cerca "Dynamic Config"
4. Clicca su "Installa"
5. Riavvia Home Assistant

## Configurazione

Aggiungi questa configurazione al tuo `configuration.yaml`:

```yaml
dynamic_config:
  db_path: "config/dynamic_config.db"  # Opzionale, default: config/dynamic_config.db
  scan_interval: 60  # Opzionale, intervallo di aggiornamento in secondi, default: 60
```

Riavvia Home Assistant dopo aver aggiunto la configurazione.

## Interfaccia UI

### Installazione Card Lovelace

1. **Registra la risorsa**: Vai su **Impostazioni** → **Dashboard** → **Risorse** e aggiungi:
   - URL: `/local/dynamic-config/dynamic-config-card.js`
   - Tipo: `JavaScript Module`

2. **Aggiungi la card** al tuo dashboard:
```yaml
type: custom:dynamic-config-card
```

La card ti permette di:
- ✅ Visualizzare tutte le configurazioni esistenti
- ✅ Creare configurazioni Standard, a Orario e a Tempo
- ✅ Selezionare i giorni della settimana per configurazioni a orario
- ✅ Eliminare configurazioni
- ✅ Tutto tramite interfaccia grafica, senza YAML!

Per maggiori dettagli vedi [UI_GUIDE.md](UI_GUIDE.md)

## Utilizzo

### Database

Il componente crea automaticamente un database SQLite con le seguenti tabelle:

- **configurazioni**: Configurazioni standard con priorità
- **configurazioni_a_orario**: Configurazioni valide in fasce orarie giornaliere
- **configurazioni_a_tempo**: Configurazioni valide in intervalli di date

### Logica di Priorità

Quando più configurazioni esistono per lo stesso nome, viene applicata questa priorità:

1. **Configurazione a Tempo** (massima priorità) - se l'orario corrente è nell'intervallo valido
2. **Configurazione a Orario** - se l'ora corrente è nella fascia oraria valida
3. **Configurazione Standard** (priorità base)

### Sensori

Ogni configurazione viene automaticamente esposta come sensore:

- **Entity ID**: `sensor.dynamic_config_<setup_name>`
- **Valore**: Il valore corrente secondo la priorità
- **Attributi**:
  - `setup_name`: Nome della configurazione
  - `source`: Tipo di configurazione attiva (`time`, `schedule`, `standard`)
  - `priority`: Priorità (solo per configurazioni standard)
  - `valid_to`: Data/ora di scadenza (per configurazioni a tempo/orario)

### Servizi

#### `dynamic_config.set_config`

Imposta una configurazione standard.

```yaml
service: dynamic_config.set_config
data:
  setup_name: "temperatura_target"
  setup_value: "22"
  priority: 99  # Opzionale, default: 99
```

#### `dynamic_config.set_time_config`

Imposta una configurazione valida in un intervallo di date.

```yaml
service: dynamic_config.set_time_config
data:
  setup_name: "temperatura_target"
  setup_value: "18"
  valid_from: "2025-12-01 00:00:00"
  valid_to: "2025-12-31 23:59:59"
```

#### `dynamic_config.set_schedule_config`

Imposta una configurazione valida in una fascia oraria giornaliera.

```yaml
service: dynamic_config.set_schedule_config
data:
  setup_name: "temperatura_target"
  setup_value: "20"
  valid_from_ora: 8.30  # 08:30
  valid_to_ora: 18.00   # 18:00
  days_of_week: ["0", "1", "2", "3", "4"]  # Lun-Ven
```

**Nota**: 
- L'orario va specificato in formato decimale: `8.30` = 08:30, `14.15` = 14:15
- I giorni: 0=Lunedì, 1=Martedì, 2=Mercoledì, 3=Giovedì, 4=Venerdì, 5=Sabato, 6=Domenica
- Se ometti `days_of_week`, la configurazione sarà valida tutti i giorni

#### `dynamic_config.delete_config`

Elimina una configurazione.

```yaml
service: dynamic_config.delete_config
data:
  setup_name: "temperatura_target"
  config_type: "all"  # Opzioni: all, standard, time, schedule
```

#### `dynamic_config.get_configurations`

Recupera le configurazioni esistenti (restituisce una risposta).

```yaml
service: dynamic_config.get_configurations
data:
  setup_name: "temperatura_target"  # Opzionale, ometti per tutte
response_variable: configs
```

## Esempi di Utilizzo

### Esempio 1: Temperatura Climatizzatore

Imposta una temperatura di default, più bassa di notte e ancora più bassa durante le vacanze:

```yaml
# Temperatura standard
service: dynamic_config.set_config
data:
  setup_name: "temperatura_clima"
  setup_value: "22"

# Temperatura notturna (ogni notte dalle 22:00 alle 06:00)
service: dynamic_config.set_schedule_config
data:
  setup_name: "temperatura_clima"
  setup_value: "19"
  valid_from_ora: 22.00
  valid_to_ora: 6.00

# Temperatura vacanze invernali (dal 20/12 al 10/01)
service: dynamic_config.set_time_config
data:
  setup_name: "temperatura_clima"
  setup_value: "16"
  valid_from: "2025-12-20 00:00:00"
  valid_to: "2026-01-10 23:59:59"
```

### Esempio 2: Utilizzo in Automazione

```yaml
automation:
  - alias: "Regola Temperatura da Configurazione"
    trigger:
      - platform: state
        entity_id: sensor.dynamic_config_temperatura_clima
    action:
      - service: climate.set_temperature
        target:
          entity_id: climate.condizionatore
        data:
          temperature: "{{ states('sensor.dynamic_config_temperatura_clima') | float }}"
```

### Esempio 3: Brightness Luci per Fasce Orarie con Giorni Specifici

```yaml
# Luminosità normale
service: dynamic_config.set_config
data:
  setup_name: "brightness_soggiorno"
  setup_value: "100"

# Luminosità ridotta sera nei giorni feriali (19:00 - 22:00, Lun-Ven)
service: dynamic_config.set_schedule_config
data:
  setup_name: "brightness_soggiorno"
  setup_value: "60"
  valid_from_ora: 19.00
  valid_to_ora: 22.00
  days_of_week: ["0", "1", "2", "3", "4"]  # Lun-Ven

# Luminosità ridotta tutto il giorno nel weekend
service: dynamic_config.set_schedule_config
data:
  setup_name: "brightness_soggiorno"
  setup_value: "70"
  valid_from_ora: 0.00
  valid_to_ora: 23.59
  days_of_week: ["5", "6"]  # Sab-Dom

# Luminosità minima notte (22:00 - 07:00, tutti i giorni)
service: dynamic_config.set_schedule_config
data:
  setup_name: "brightness_soggiorno"
  setup_value: "20"
  valid_from_ora: 22.00
  valid_to_ora: 7.00
```

### Esempio 4: Visualizzazione in Lovelace

```yaml
type: entities
title: Configurazioni Dinamiche
entities:
  - entity: sensor.dynamic_config_temperatura_clima
    name: Temperatura Target
    icon: mdi:thermometer
  - entity: sensor.dynamic_config_brightness_soggiorno
    name: Luminosità Soggiorno
    icon: mdi:brightness-6
```

## Struttura Database

### Tabella `configurazioni`
```sql
CREATE TABLE configurazioni (
    setup_name TEXT PRIMARY KEY NOT NULL,
    setup_value TEXT,
    priority INTEGER NOT NULL DEFAULT 99
)
```

### Tabella `configurazioni_a_orario`
```sql
CREATE TABLE configurazioni_a_orario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setup_name TEXT NOT NULL,
    setup_value TEXT,
    valid_from_ora REAL NOT NULL,
    valid_to_ora REAL
)
```

### Tabella `configurazioni_a_tempo`
```sql
CREATE TABLE configurazioni_a_tempo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setup_name TEXT NOT NULL,
    setup_value TEXT,
    valid_from_date DATETIME NOT NULL,
    valid_to_date DATETIME
)
```

## Troubleshooting

### I sensori non vengono creati

- Verifica che il database sia stato creato correttamente in `config/dynamic_config.db`
- Controlla i log di Home Assistant per eventuali errori
- Assicurati di aver riavviato Home Assistant dopo l'installazione

### I valori non cambiano

- Verifica che l'intervallo di aggiornamento (`scan_interval`) non sia troppo alto
- Controlla che le date/orari siano formattati correttamente
- Usa gli strumenti di sviluppo per verificare lo stato attuale del sensore

### Errori di formato orario

- Gli orari devono essere in formato decimale: `8.30` per 08:30, `14.15` per 14:15
- Le date devono essere in formato ISO: `2025-12-25 00:00:00`

## Supporto

Per bug report e richieste di funzionalità, apri un issue su GitHub.

## Licenza

MIT License

## Crediti

Sviluppato per gestire configurazioni dinamiche in Home Assistant con logica basata su priorità temporali.
