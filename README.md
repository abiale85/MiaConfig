# Mia Config per Home Assistant

Un componente custom per Home Assistant che gestisce configurazioni dinamiche con valori che cambiano automaticamente in base a regole temporali e orarie con sistema avanzato di priorità.

## Caratteristiche

- **Multi-Istanza**: Supporto per configurazioni separate per più case/ambienti
- **Configurazioni Standard**: Valori di default con sistema di priorità personalizzabile
- **Configurazioni a Tempo**: Valori validi in intervalli di date specifici con priorità
- **Configurazioni a Orario**: Valori validi in fasce orarie giornaliere con selezione giorni settimana e priorità
- **Sistema Priorità Avanzato**: Ogni configurazione ha priorità numerica (1 = massima, 99 = minima)
- **Sensori Dinamici**: Ogni configurazione viene esposta come sensore in Home Assistant
- **Predizione Eventi**: Attributi con timestamp ISO dei prossimi cambiamenti valore
- **Servizi Completi**: API per gestire le configurazioni tramite automazioni o script
- **Interfaccia UI Completa**: Card Lovelace con dashboard, vista settimanale, gestione e storico
- **Database Isolato**: Ogni istanza ha il proprio database SQLite separato
- **Storico Completo**: Cronologia modifiche con paginazione e ripristino

## Installazione

### Metodo 1: Installazione Manuale

1. Copia la cartella `custom_components/mia_config` nella cartella `custom_components` della tua configurazione Home Assistant
2. Copia la cartella `www/mia-config` nella cartella `www` di Home Assistant
3. Riavvia Home Assistant

### Metodo 2: HACS (Consigliato)

1. Apri HACS
2. Vai su "Integrazioni"
3. Clicca sui tre puntini in alto a destra → "Repository personalizzati"
4. Aggiungi: `https://github.com/abiale85/MiaConfig` (Categoria: Integration)
5. Cerca "Mia Config"
6. Clicca su "Installa"
5. Riavvia Home Assistant

## Configurazione

### Aggiunta tramite UI (Consigliato)

1. Vai su **Impostazioni** → **Dispositivi e Servizi**
2. Clicca su **Aggiungi Integrazione**
3. Cerca **Mia Config**
4. Inserisci un nome per il database (es. "MiaHomeConfig" per casa principale)
5. Conferma

**Multi-Istanza**: Puoi aggiungere l'integrazione più volte con nomi diversi per gestire configurazioni separate (es. casa principale, casa vacanze, ufficio).

Ogni istanza:
- Ha un database SQLite dedicato (`<db_name>.db`)
- Crea un sensore principale per monitorare lo stato
- È completamente isolata dalle altre istanze

## Interfaccia UI

### Installazione Card Lovelace

1. **Registra la risorsa**: Vai su **Impostazioni** → **Dashboard** → **Risorse** e aggiungi:
   - URL: `/hacsfiles/mia-config/mia-config-card.js`
   - Tipo: `JavaScript Module`

2. **Aggiungi la card** al tuo dashboard:
```yaml
type: custom:mia-config-card
entity_id: sensor.miahomeconfig_main  # Opzionale: specifica l'istanza da gestire
```

**Nota**: Se hai più istanze e non specifichi `entity_id`, la card mostrerà la prima istanza trovata.

La card ti permette di:
- ✅ **Dashboard**: Visualizza valori correnti e configurazioni attive
- ✅ **Configura**: Crea/modifica configurazioni Standard, a Orario e a Tempo + gestione valori validi
- ✅ **Vista Settimanale**: Barre colorate che mostrano i valori per ogni ora della settimana
- ✅ **Storico**: Cronologia modifiche con paginazione (20 elementi per pagina) e ripristino
- ✅ **Mobile-Responsive**: Ottimizzata per smartphone e tablet con layout adattivi

**Header Card**: Il titolo della card mostra automaticamente il nome dell'istanza (es. "MiaHomeConfig")

**Valori Validi**: Nel tab Configura puoi definire opzionalmente valori consentiti per ogni configurazione:
- Esempio: `riscaldamento` → "0"="Off", "1"="Economy", "2"="Comfort"
- Sezione dedicata "✓ Valori Validi" in fondo al tab Configura
- Eliminazione automatica quando la configurazione viene cancellata
- Se non definiti, qualsiasi valore è accettato

Per maggiori dettagli vedi [UI_GUIDE.md](UI_GUIDE.md)

## Utilizzo

### Database

Ogni istanza crea automaticamente un database SQLite separato (`<nome_istanza>.db`) con le seguenti tabelle:

- **configurazioni**: Configurazioni standard con priorità
- **configurazioni_a_orario**: Configurazioni valide in fasce orarie giornaliere
- **configurazioni_a_tempo**: Configurazioni valide in intervalli di date
- **configurazioni_valori_validi**: Valori opzionali consentiti con descrizioni
- **configurazioni_storico**: Cronologia modifiche con operazioni INSERT/UPDATE/DELETE

### Logica di Priorità

Quando più configurazioni esistono per lo stesso nome, il valore attivo viene determinato da:

1. **Tipo di configurazione** (source_order):
   - Time (configurazioni a tempo): source_order = 1
   - Schedule (configurazioni a orario): source_order = 2
   - Standard (configurazioni base): source_order = 3

2. **Priorità numerica** (per configurazioni dello stesso tipo):
   - Valori: 1 (massima priorità) - 99 (minima priorità)
   - Default: 99 se non specificato
   - Una schedule con priorità 50 batte una schedule con priorità 99

**Esempio**: Se alle 08:00 sono attive:
- Schedule "sveglia" (priorità 99) dalle 05:30-08:15
- Schedule "colazione" (priorità 100) dalle 07:00-08:00

Viene applicata "sveglia" perché ha priorità migliore (99 < 100)

### Sensori

Ogni configurazione viene automaticamente esposta come sensore:

- **Entity ID**: `sensor.<db_name>_<setup_name>`
- **Valore**: Il valore corrente secondo la priorità
- **Attributi**:
  - `setup_name`: Nome della configurazione
  - `source`: Tipo di configurazione attiva (`time`, `schedule`, `standard`)
  - `priority`: Priorità numerica della configurazione attiva
  - `next_value`: Prossimo valore che sarà attivo
  - `next_change_at`: Timestamp ISO del prossimo cambio (es. `2025-12-02T14:30:00`)
  - `next_change_type`: Tipo del prossimo cambio (`schedule`, `schedule_end`, `time`, `time_end`)
  - `next_<valore>_at`: Timestamp della prima occorrenza di ogni valore specifico

**Utilizzo in automazioni**:
```yaml
trigger:
  - platform: template
    value_template: >
      {% set next_at = state_attr('sensor.miahomeconfig_riscaldamento', 'next_1_at') %}
      {{ (as_datetime(next_at) - now()).total_seconds() / 60 < 30 }}
```

### Servizi

#### `mia_config.set_config`

Imposta una configurazione standard.

```yaml
service: mia_config.set_config
data:
  setup_name: "temperatura_target"
  setup_value: "22"
  priority: 99  # Opzionale, default: 99 (bassa)
  description: "Temperatura default"  # Opzionale
  entity_id: sensor.miahomeconfig_main  # Opzionale, per specificare l'istanza
```

#### `mia_config.set_time_config`

Imposta una configurazione valida in un intervallo di date.

```yaml
service: mia_config.set_time_config
data:
  setup_name: "temperatura_target"
  setup_value: "18"
  valid_from_date: "2025-12-01 00:00:00"
  valid_to_date: "2025-12-31 23:59:59"
  priority: 50  # Opzionale, default: 99
  description: "Vacanze invernali"  # Opzionale
  entity_id: sensor.miahomeconfig_main  # Opzionale
```

#### `mia_config.set_schedule_config`

Imposta una configurazione valida in una fascia oraria giornaliera.

```yaml
service: mia_config.set_schedule_config
data:
  setup_name: "temperatura_target"
  setup_value: "20"
  valid_from_ora: "8.30"  # 08:30
  valid_to_ora: "18.00"   # 18:00
  days_of_week: ["0", "1", "2", "3", "4"]  # Lun-Ven
  priority: 80  # Opzionale, default: 99
  description: "Orario lavorativo"  # Opzionale
  entity_id: sensor.miahomeconfig_main  # Opzionale
```

**Nota**: 
- L'orario va specificato in formato `HH.MM`: `8.30` = 08:30, `14.15` = 14:15, `23.55` = 23:55
- Ore valide: 0-23, Minuti validi: 0-59
- I giorni: 0=Lunedì, 1=Martedì, 2=Mercoledì, 3=Giovedì, 4=Venerdì, 5=Sabato, 6=Domenica
- Se ometti `days_of_week`, la configurazione sarà valida tutti i giorni

#### `mia_config.delete_single_config`

Elimina una singola configurazione specifica.

```yaml
service: mia_config.delete_single_config
data:
  config_id: 15  # ID della configurazione da eliminare
  config_type: "schedule"  # Tipo: standard, time, schedule
  entity_id: sensor.miahomeconfig_main  # Opzionale
```

#### `mia_config.get_configurations`

Recupera le configurazioni esistenti (restituisce una risposta).

```yaml
service: mia_config.get_configurations
data:
  setup_name: "temperatura_target"  # Opzionale, ometti per tutte
  entity_id: sensor.miahomeconfig_main  # Opzionale
response_variable: configs
```

#### `mia_config.get_history`

Recupera lo storico delle modifiche alle configurazioni con paginazione.

```yaml
service: mia_config.get_history
data:
  setup_name: "temperatura_target"  # Opzionale, ometti per tutte
  limit: 20  # Elementi per pagina, default: 50
  offset: 0  # Offset per paginazione, default: 0
  entity_id: sensor.miahomeconfig_main  # Opzionale
response_variable: history_data
```

**Risposta**:
```yaml
history: 
  - id: 123
    timestamp: "2025-12-02 10:30:00"
    setup_name: "temperatura_target"
    config_type: "schedule"
    setup_value: "22"
    operation: "INSERT"
    # ... altri campi
total: 150  # Numero totale record (per paginazione)
```

#### `mia_config.cleanup_history`

Pulisce la cronologia eventi vecchi dal database.

```yaml
service: mia_config.cleanup_history
data:
  days: 30  # Elimina eventi più vecchi di 30 giorni
  entity_id: sensor.miahomeconfig_main  # Opzionale
```

#### `mia_config.add_valid_value`

Aggiunge un valore valido con descrizione per una configurazione (opzionale).

```yaml
service: mia_config.add_valid_value
data:
  setup_name: "riscaldamento"
  value: "0"
  description: "Spento"  # Opzionale
  sort_order: 0  # Opzionale, default: 0
  entity_id: sensor.miahomeconfig_main  # Opzionale
```

**Valori validi**: Se definiti, puoi creare un sistema di validazione per i valori delle configurazioni. Per esempio:
- `riscaldamento`: "0"="Off", "1"="Economy", "2"="Comfort"
- `allarme`: "armed_away"="Totale", "armed_home"="Casa", "disarmed"="Disattivato"

I valori validi sono opzionali e indipendenti dalle configurazioni. Se non definiti, qualsiasi valore è accettato.

#### `mia_config.delete_valid_value`

Elimina un valore valido.

```yaml
service: mia_config.delete_valid_value
data:
  id: 5  # ID del valore valido da eliminare
  entity_id: sensor.miahomeconfig_main  # Opzionale
```

#### `mia_config.get_valid_values`

Ottiene i valori validi per una configurazione (supporta response).

```yaml
service: mia_config.get_valid_values
data:
  setup_name: "riscaldamento"  # Opzionale, se omesso restituisce tutti
  entity_id: sensor.miahomeconfig_main  # Opzionale
response_variable: valid_values
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
