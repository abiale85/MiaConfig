# 📋 Changelog - Mia Config

## v1.3.1 - 2 Dicembre 2025 🔧

### 🐛 Bug Fixes Critici
- **Fix Multi-Istanza**: Risolto bug che causava la chiusura del database sbagliato quando si cancellava un'istanza
  - Ora `async_unload_entry` chiude solo il database specifico dell'istanza usando `entry.entry_id`
  - Rimozione istanza non impatta più altre istanze attive
- **Fix Validazione Orari**: Corretto validatore per formato HH.MM
  - Nuovo validatore `validate_time_format()` controlla ore (0-23) e minuti (0-59) separatamente
  - Ora 23.55, 23.59, 14.30 sono tutti validi
  - Prima 23.55 veniva confrontato come float (23,55 > 23,59) e rifiutato
- **Fix Filtro Sensori**: Il sensore principale non appare più nella lista "Valori Correnti"
  - Card filtra sensori con attributo `total_configs` nella funzione `loadDashboard()`
  - Solo i sensori delle configurazioni effettive vengono mostrati

### ✨ Miglioramenti
- **Isolamento Database**: Ogni istanza opera sul proprio database senza interferenze
- **Cleanup Automatico**: Il file database viene cancellato automaticamente quando si rimuove un'istanza
  - Implementato `async_remove_entry()` che elimina il file `.db` dal filesystem
  - Log dettagliati delle operazioni di cancellazione

### 🔧 Modifiche Tecniche
- Aggiunto validatore personalizzato `validate_time_format()` in `__init__.py`
- Aggiornato `async_unload_entry()` per chiudere solo database specifico istanza
- Aggiunto `async_remove_entry()` per cleanup file database
- Filtro `!entity.attributes.total_configs` in `loadDashboard()` della card

---

## v1.3.0 - 1 Dicembre 2025 ⭐

### ✨ Multi-Istanza
- **Supporto Multi-Istanza Completo**:
  - Crea più istanze con database separati (es. casa principale, seconda casa)
  - Ogni istanza ha database SQLite isolato
  - Sensore principale per istanza mostra totale configurazioni
  - Parametro `entity_id` opzionale in tutti i servizi per selezionare istanza
- **Sensore Principale per Istanza**:
  - `MiaConfigMainSensor` sempre creato anche con database vuoto
  - Entity ID formato: `sensor.mia_config_{db_name}`
  - Attributi: `total_configs`, `config_names`, `db_name`, `integration`
  - Non appare nella lista "Valori Correnti" della card

### 🎨 UI Ridisegnata
- **Dashboard Separato**: Tab dedicato per valori correnti e prossimi eventi
- **Tab Configura Unificato**: Unico form per tutti i tipi (Standard/Orario/Tempo)
- **Campo Descrizione**: Documentazione personalizzata (solo per configurazioni standard)
- **Supporto Multi-Istanza Card**:
  - Parametro `entity_id` opzionale per selezionare istanza
  - Auto-detect database dal sensore principale

### ⚡ Attributi Predittivi Avanzati
- **Attributi Predittivi** nei sensori:
  - `next_value`: Prossimo valore programmato
  - `next_change_in_minutes`: Countdown al prossimo cambio
  - `upcoming_changes`: Lista completa prossimi 5 eventi
  - `upcoming_text`: Descrizioni leggibili es. "pre_sveglia tra 2h 30min"
- **Durata Stato Corrente**:
  - `current_value_since_minutes`: Minuti dall'attivazione
  - `current_value_since_text`: Formato leggibile es. "2h 15min"

### 🎨 Miglioramenti UI
- **Vista Settimanale Ridisegnata**:
  - Barre continue senza celle (1 pixel = 1 minuto, scala perfetta)
  - Allineamento preciso ore/minuti
  - Tooltip intelligenti con posizionamento automatico (4 direzioni)
- **Dashboard Interattiva**:
  - Entità clickabili per aprire dettagli (hass-more-info)
  - Lista eventi futuri con countdown visibile
  - Visualizzazione durata stato attivo

### ⚡ Ottimizzazioni Performance
- **Cache Intelligente**:
  - Query database solo quando necessario (cambio valore/evento imminente)
  - Ricalcolo periodico ogni ora per eventi futuri lontani
  - Calcolo incrementale durata stato (no query ripetute)
- **Opzioni Configurabili**:
  - `lookahead_hours` (default 24): Ore future per previsione eventi
  - `lookback_hours` (default 24): Limite ore passate per durata stato
  - `cleanup_days` (default 30): Auto-elimina eventi scaduti
  - `scan_interval` (default 60): Frequenza aggiornamento

### 🔧 Correzioni
- Risolto: Entità cancellate rimanevano nel registry
- Risolto: Deprecation warning config_flow per HA 2025.12
- Risolto: Accesso dati coordinator in property icon/available
- Aggiunto: Cleanup automatico eventi scaduti all'avvio

### 📚 Documentazione
- Repository GitHub: https://github.com/abiale85/MiaConfig
- README aggiornato con nuove funzionalità
- Esempi automazioni con attributi predittivi

---

## v1.1.0 - 30 Novembre 2025

### ✨ Installazione tramite UI
- Config Flow completo - non serve più configuration.yaml
- Aggiunta integrazione dall'interfaccia HA
- Opzioni modificabili senza riavvio
- Traduzioni IT/EN

---

## v1.0.0 - Versione Iniziale

### ✨ Nuove Funzionalità

### 🗓️ Selezione Giorni della Settimana
- Aggiunto supporto per selezionare i giorni della settimana nelle configurazioni a orario
- Puoi ora specificare se una configurazione è valida solo in giorni specifici (es. solo weekend, solo feriali)
- Campo `days_of_week` nella tabella `configurazioni_a_orario`
- Formato: lista di numeri (0=Lunedì, 6=Domenica)
- Default: tutti i giorni se non specificato

**Esempio**:
```yaml
service: dynamic_config.set_schedule_config
data:
  setup_name: "temperatura_target"
  setup_value: "20"
  valid_from_ora: 8.00
  valid_to_ora: 18.00
  days_of_week: ["0", "1", "2", "3", "4"]  # Solo Lun-Ven
```

### 🎨 Interfaccia UI Completa
- **Custom Card Lovelace** per gestire tutte le configurazioni tramite interfaccia grafica
- Nessun bisogno di scrivere YAML manualmente
- 4 tab organizzati:
  - **📋 Lista**: Visualizza tutte le configurazioni esistenti
  - **⚙️ Standard**: Crea configurazioni base
  - **🕐 Orario**: Crea configurazioni per fasce orarie con selezione giorni
  - **📅 Tempo**: Crea configurazioni per intervalli di date
- Badge colorati per identificare il tipo di configurazione
- Eliminazione configurazioni con un click
- Notifiche toast per feedback immediato

**Installazione**:
1. Registra la risorsa: `/local/dynamic-config/dynamic-config-card.js`
2. Aggiungi la card: `type: custom:dynamic-config-card`

### 🔍 Nuovo Servizio: get_configurations
- Recupera programmaticamente le configurazioni esistenti
- Supporta filtro per nome specifico o tutte le configurazioni
- Restituisce risposta strutturata utilizzabile in script/automazioni

**Esempio**:
```yaml
service: dynamic_config.get_configurations
data:
  setup_name: "temperatura_clima"  # Opzionale
response_variable: configs
```

## 🔧 Miglioramenti Tecnici

### Database
- Aggiunto campo `days_of_week` alla tabella `configurazioni_a_orario`
- Schema di default: `'0,1,2,3,4,5,6'` (tutti i giorni)
- Retrocompatibile con database esistenti

### Logica di Priorità
- Migliorata per considerare i giorni della settimana
- Una configurazione a orario è attiva solo se:
  1. L'ora corrente è nella fascia specificata
  2. Il giorno corrente è nei giorni selezionati

### Servizi
- Aggiornato `set_schedule_config` per accettare `days_of_week`
- Supporto sia per string che per array di numeri
- Validazione dei giorni (0-6)

### Attributi Sensori
- Aggiunto attributo `days_of_week` ai sensori per configurazioni a orario
- Migliorata visualizzazione degli attributi nelle card

## 📁 Struttura File

```
custom_components/dynamic_config/
├── __init__.py              # Componente principale + servizi
├── const.py                 # Costanti
├── database.py              # Gestione database SQLite
├── sensor.py                # Platform sensori
├── panel.py                 # Panel UI (opzionale)
├── manifest.json            # Metadata componente
├── services.yaml            # Definizione servizi
├── README.md                # Documentazione completa
├── QUICK_START.md           # Guida rapida
├── UI_GUIDE.md              # Guida interfaccia UI
├── configuration.yaml.example
└── automations.yaml.example

www/dynamic-config/
└── dynamic-config-card.js   # Custom Lovelace card
```

## 🗄️ Schema Database

### Tabella: configurazioni
```sql
CREATE TABLE configurazioni (
    setup_name TEXT PRIMARY KEY NOT NULL,
    setup_value TEXT,
    priority INTEGER NOT NULL DEFAULT 99
)
```

### Tabella: configurazioni_a_orario (AGGIORNATA)
```sql
CREATE TABLE configurazioni_a_orario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setup_name TEXT NOT NULL,
    setup_value TEXT,
    valid_from_ora REAL NOT NULL,
    valid_to_ora REAL,
    days_of_week TEXT DEFAULT '0,1,2,3,4,5,6'  -- ✨ NUOVO
)
```

### Tabella: configurazioni_a_tempo
```sql
CREATE TABLE configurazioni_a_tempo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setup_name TEXT NOT NULL,
    setup_value TEXT,
    valid_from_date DATETIME NOT NULL,
    valid_to_date DATETIME
)
```

## 🎯 Casi d'Uso Nuovi

### Temperatura Diversa Weekend
```yaml
# Temperatura feriale
service: dynamic_config.set_schedule_config
data:
  setup_name: "temp"
  setup_value: "21"
  valid_from_ora: 6.00
  valid_to_ora: 22.00
  days_of_week: ["0", "1", "2", "3", "4"]

# Temperatura weekend
service: dynamic_config.set_schedule_config
data:
  setup_name: "temp"
  setup_value: "23"
  valid_from_ora: 6.00
  valid_to_ora: 22.00
  days_of_week: ["5", "6"]
```

### Luci Diverse Venerdì Sera
```yaml
# Normale giorni feriali
service: dynamic_config.set_schedule_config
data:
  setup_name: "brightness"
  setup_value: "60"
  valid_from_ora: 19.00
  valid_to_ora: 23.00
  days_of_week: ["0", "1", "2", "3"]  # Lun-Gio

# Festa venerdì
service: dynamic_config.set_schedule_config
data:
  setup_name: "brightness"
  setup_value: "100"
  valid_from_ora: 19.00
  valid_to_ora: 2.00
  days_of_week: ["4"]  # Solo venerdì
```

## 🔄 Migrazione da Versione Precedente

Se avevi già installato il componente senza i giorni della settimana:

1. **Non serve fare nulla!** Il database viene aggiornato automaticamente
2. Le configurazioni esistenti avranno `days_of_week = '0,1,2,3,4,5,6'` (tutti i giorni)
3. Il comportamento rimane identico per le configurazioni esistenti

## 📝 Note di Sviluppo

### Priorità Giorni
- 0 = Lunedì (Python weekday standard)
- 6 = Domenica
- Stored come string CSV: `"0,1,2,3,4,5,6"`
- Convertito in lista di int per la validazione

### UI Card
- Tecnologia: Vanilla JavaScript (Web Components)
- Compatibile con Home Assistant 2023.1+
- Usa hass.callService() per l'integrazione
- Responsive design
- Supporto dark/light mode automatico

## 🐛 Bug Fix
- Nessuno in questa versione (release iniziale)

## 🔮 Roadmap Futuro

Possibili funzionalità future:
- [ ] Import/Export configurazioni in JSON
- [ ] Template support per valori dinamici
- [ ] Configurazioni per profilo utente
- [ ] Storia delle modifiche
- [ ] Notifiche quando una configurazione cambia
- [ ] Dashboard dedicato (invece di card)
- [ ] Integrazione con calendari

## 📞 Supporto

Per domande, bug o richieste di funzionalità:
- Leggi [README.md](README.md) per la documentazione completa
- Leggi [QUICK_START.md](QUICK_START.md) per iniziare velocemente
- Leggi [UI_GUIDE.md](UI_GUIDE.md) per l'interfaccia utente

## 📜 Licenza

MIT License

---

**Versione**: 1.0.0  
**Data**: 30 Novembre 2025  
**Compatibilità**: Home Assistant 2023.1+
