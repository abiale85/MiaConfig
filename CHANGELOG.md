# 📋 Changelog - Mia Config

## v1.4.1 - 6 Dicembre 2025 ⚡

### ✨ Nuove Funzionalità
- **Azioni Rapide Dashboard**: Aggiunti pulsanti azione per ogni configurazione
  - **➕ Override**: Apre tab Configura e precompila form Override Temporale
  - **📅 Vista**: Apre Vista Settimanale per quella configurazione
  - Navigazione rapida senza cercare manualmente
  - Auto-scroll al form dopo il cambio tab
  - Precompilazione automatica dei campi

- **Valori Validi Dinamici nei Form**: Campo valore diventa dropdown quando esistono valori predefiniti
  - Selezione configurazione → carica automaticamente valori validi
  - Se esistono valori: mostra dropdown con valore e descrizione
  - Se non esistono: mostra campo testo libero
  - Applicato ai form Override Orario e Override Temporale
  - Indicatore visivo "✓ Valori predefiniti disponibili"

- **Gestione Completa Valori Validi**:
  - ✏️ **Pulsante Modifica**: Modifica descrizione e ordinamento (valore bloccato)
  - Modalità modifica con form precompilato
  - Dashboard mostra descrizione del valore corrente se disponibile
  - Formato: "valore (descrizione)" per migliore leggibilità

### 🔧 Miglioramenti UX
- Dashboard più interattiva con azioni dirette su ogni valore
- Workflow semplificato per creare override temporali (default)
- Visualizzazione immediata della pianificazione settimanale
- Layout responsive: pulsanti in colonna (desktop) o riga (mobile)
- Validazione automatica tramite valori predefiniti

### 🐛 Bug Fixes
- Corretto errore `this.config.entity` undefined nelle funzioni valori validi
- Usato `getSelectedEntityId()` invece di `this.config.entity`
- Fix `callService` con `return_response` → usato `callWS` correttamente

### 🎨 CSS
- Nuova classe `.dc-dashboard-actions` per gestire layout pulsanti
- Responsive mobile: pulsanti a larghezza piena in riga su smartphone
- Migliorato hover effect sulla card dashboard

---

## v1.4.0 - 4 Dicembre 2025 ✅📱

### ✨ Nuove Funzionalità
- **Gestione Valori Validi**: Sistema per definire valori consentiti per ogni configurazione
  - Nuova sezione "✓ Valori Validi" nel tab Configura
  - Possibilità di definire valori opzionali con descrizioni (es. "0"="Off", "1"="Economy", "2"="Comfort")
  - Gestione separata rispetto alla creazione configurazioni
  - Auto-cleanup: valori eliminati automaticamente quando la configurazione viene cancellata
  - Tabella database: `configurazioni_valori_validi` con campi value, description, sort_order
  - **3 nuovi servizi**:
    - `mia_config.add_valid_value`: Aggiunge/modifica valore valido
    - `mia_config.delete_valid_value`: Elimina valore valido per ID
    - `mia_config.get_valid_values`: Ottiene valori validi per configurazione (supporta response)
  - Ordinamento personalizzabile tramite campo `sort_order`
  
- **UI Responsive Mobile**: Ottimizzazione completa per smartphone e tablet
  - Media query @768px: Layout adattivo per tablet
    - Tab su 2 colonne con dimensioni touch-friendly (min-height: 44px)
    - Pulsanti più grandi (10px padding, 13px font)
    - Input con font 16px per evitare zoom automatico iOS
    - Tabelle con scroll orizzontale
    - Configurazioni in colonna singola invece che flex-row
  - Media query @480px: Layout ottimizzato per smartphone
    - Tab a larghezza piena (100%)
    - Header con font ridotto (18px)
  - Vista settimanale: Scroll orizzontale con larghezza minima 700px
  - Form con campi touch-optimized (min-height 44px)

### 🔧 Miglioramenti Backend
- **Database**: 
  - Nuova tabella `configurazioni_valori_validi` con UNIQUE(setup_name, value)
  - 4 nuove funzioni: `get_valid_values()`, `add_valid_value()`, `delete_valid_value()`, `cleanup_orphan_valid_values()`
  - Cleanup automatico invocato dopo `delete_config()`
  
- **__init__.py**:
  - 3 handler per servizi valori validi
  - Integrazione cleanup nel flusso eliminazione configurazioni
  - Schema validazione con campi opzionali (description, sort_order)

### 📱 UX Mobile
- **Touch-Friendly**: Tutti i controlli rispettano dimensioni minime 44x44px (Apple HIG)
- **Typography**: Font più leggibili su mobile (13-16px)
- **Layout Adaptive**: Grid/flex collassano in colonna singola sotto 768px
- **Form Input**: Font 16px previene zoom automatico iOS
- **Table Responsive**: Wrapper con overflow-x auto per tabelle larghe
- **Navigation**: Tab wrappati in 2 colonne (tablet) o stacked (mobile)

### 🎨 Frontend
- **Sezione Valori Validi**: Integrata nel tab Configura
  - Dropdown per selezionare configurazione
  - Tabella con Value, Descrizione, Ordine, Azioni
  - Form inline per aggiungere nuovi valori
  - Pulsanti Elimina per ogni valore
  - Separata visivamente dalle configurazioni con bordo superiore
  
- **JavaScript**:
  - `loadConfigsForValidValues()`: Popola dropdown configurazioni
  - `dcLoadValidValues()`: Carica valori per configurazione selezionata
  - `dcShowAddValidValueForm()` / `dcHideAddValidValueForm()`: Toggle form
  - `dcSaveValidValue()`: Salva nuovo valore con validazione
  - `dcDeleteValidValue()`: Elimina con conferma

---

## v1.3.2 - 3 Dicembre 2025 🎨

### ✨ Nuove Funzionalità
- **Icona Personalizzata**: Aggiunta icona con cavalier king nella cuccia
  - `icon.png` (128x128) e `icon@2x.png` (256x256)
  - Visibile in Impostazioni → Dispositivi e Servizi
- **Header Card Dinamico**: Titolo mostra il nome dell'istanza (es. "MiaHomeConfig")
  - Funzione `getInstanceName()` legge `db_name` dagli attributi sensore
  - Fallback su "Mia Config" se istanza non trovata
- **Paginazione Storico**: Gestione efficiente di migliaia di record
  - 20 elementi per pagina con navigazione: Prima, Precedente, Successiva, Ultima
  - Mostra "Pagina X di Y (Z elementi)"
  - Parametro `offset` nel servizio `get_history`
  - Nuova funzione `get_history_count()` per conteggio totale

### 🔧 Miglioramenti
- **Attributi Sensori Semplificati**: Rimossi attributi non necessari
  - ❌ `upcoming_text` (non si aggiornava dinamicamente)
  - ❌ `upcoming_changes` (ridondante)
  - ❌ `current_value_since_minutes` (non usato)
  - ❌ `current_value_since_text` (non usato)
  - ✅ Mantenuti solo: `next_value`, `next_change_at`, `next_change_type`, `next_<valore>_at`

### 🐛 Bug Fixes
- **Fix Dashboard**: Risolto errore `upcomingText.forEach is not a function`
  - Rimossa visualizzazione `upcoming_text` dalla dashboard
- **Fix Storico**: Corretto errore caricamento storico
  - Sostituita chiamata `this.formatTimeDisplay()` con conversione inline
  - Formato orari: `String(ora).replace('.', ':')` (es. 8.30 → 8:30)
- **Fix Servizio get_history**: Aggiunto parametro `offset` allo schema
  - Prima causava errore `extra keys not allowed @ data['offset']`
  - Schema aggiornato: `vol.Optional("offset", default=0): cv.positive_int`
- **Fix Vista Settimanale**: Priorità numeriche ora rispettate
  - Implementato confronto priorità in `calculateDaySegments()`
  - Funzione `shouldOverride()` confronta `priority` e `sourceOrder`
  - Schedule con priorità 99 batte schedule con priorità 100

### 📝 Documentazione
- Aggiornato README con nuove funzionalità
- Esempio automazione con timestamp ISO
- Istruzioni installazione HACS
- Documentazione attributi sensori semplificati

---

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
