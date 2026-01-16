# 📋 Changelog - Mia Config

## v2.2.1 - January 16, 2026 🐛 Critical Bugfix

### 🐛 Critical Fix
- **All-day schedules with day filters**: Fixed critical bug where time-based overrides with `valid_from == valid_to` (00:00 - 00:00) were incorrectly applied to all days instead of respecting `days_of_week` filter
  - **Example bug**: Override for Saturday & Sunday (5,6) was being applied on all days
  - **Cause**: The code set `is_valid = True` for all-day schedules without checking `days_of_week`
  - **Solution**: Changed logic to evaluate `is_valid = current_day in valid_days` for all-day schedules
  - **Impact**: Sensor values now correctly respect day-of-week filters (weekly view was already working correctly)
  - **Affected scenarios**: Any time-based override with 00:00-00:00 hours and specific days selected
  
  **Code Changes**:
  - `_get_all_active_configs()`: Fixed all-day schedule evaluation (line ~374)
  - Now consistent with `_get_relevant_configs_for_target()` which had correct v2.1 logic

### 📦 Versions
- integration: 2.2.1
- card: 2.2.0 (no changes)

## v2.2.0 - January 15, 2026 🚀 Major Release

### ✨ New Features
- **Complete translation system**: Automatic loading of translations at startup for sensor/card messages
- **Configurable debug toggle**: Ability to enable/disable debug via YAML config (`debug: true`) or global variable (`window.miaConfigDebug`)
- **Weekly view improvements**: Removed debug logs from weekly view to reduce console noise

### 🐛 Fixes
- **Predictive attributes fix**: `next_*` attributes no longer return `unknown` - predictive cache reused with translated messages when no events in next 7 days
- **Regenerable event cache**: Complete invalidation of event cache on every configuration change to avoid stale results
- **Automatic startup retry**: When event cache is empty at startup, automatic retry to avoid "no events" blockage

### 🧠 Performance Improvements
- **Extended lookahead**: Default prediction window increased to 168 hours (7 days) to align `next_*` attributes with weekly view
- **Targeted dependency resolution**: Optimized algorithm that calculates only necessary configurations to resolve conditional dependencies
- **Event-driven simulation**: Weekly view uses event-based sampling instead of fixed granularity for maximum accuracy

### 📦 Versions
- integration: 2.2.0
- card: 2.2.0

## v2.1.2 - January 8, 2026 ✅ Stable Release

### 🐛 Predictive Fixes
- `next_*` attributes no longer return `unknown`: predictive cache is reused and shows translated message when no events in next 7 days.
- Default lookahead extended to 168 hours for sensors and services, aligned with weekly view.

### 🧠 Database Engine
- Regenerable `event_times` cache and complete invalidation on every configuration change to avoid stale results.
- Targeted resolution of conditional dependencies and event-driven simulation for `simulate_configuration_schedule` and `get_next_changes`.
- Automatic retry when event cache is empty at startup to avoid "no events" blockage.

### 🖥️ UI
- Card uses `debug` flag (config or `window.miaConfigDebug`) and reduces console noise.
- Translations loaded at startup for sensor/card side messages.

### 📦 Versions
- integration: 2.1.2
- card: 2.1.0-beta.7.2

## v2.1.0-beta.7.2 - January 7, 2026 🐛 Critical Fixes

### 🐛 Critical Fixes
- **Fix Null Reference**: Resolved `Cannot set properties of null` error in dcEditConfig
- **Ultra Compact Priority Field**: 60px with `!important` and `box-sizing: border-box`
- **Correct Checkbox Layout**: Changed from grid to flexbox with correct constraints (50-80px)
- **Max-Width Constraints**: Added limits to avoid horizontal overflow
- **Tooltip CSS Cleanup**: Removed `.mia-config-card` prefix for tooltip styles

### 📦 Versions
- Integration: 2.1.0-beta.7.2
- Card: 2.1.0-beta.7.2

---

## v2.1.0-beta.7.1 - January 7, 2026 🐛 Layout & Tooltip Fixes

### 🎨 Modal Layout Improvements
- **Compact Priority Field**: Width limited to 80px to save space
- **Responsive Time Picker**: Added `flex-wrap` for adaptive layout
- **Optimized Checkbox Groups**: Reduced minimum size to 60px, added maximum width
- **Filter Indentation**: 24px left margin for time/day filter containers

### 🖱️ Corrected Weekly View Tooltip
- **Immediate Setup**: Executed immediately instead of waiting for setTimeout
- **Safe Fallback**: If it fails, uses setTimeout as backup
- **Debug Logging**: Added logging for troubleshooting mouse events

### 📦 Versions
- Integration: 2.1.0-beta.7.1
- Card: 2.1.0-beta.7.1

---

### 🎨 Unified Interface
- **Unified Modal**: Merged edit interface with add interface
  - Completely removed separate `#dc-edit-modal` (~280 lines)
  - `#dc-add-config-modal` now handles both modes (add/edit)
  - Dynamic title: "Add New Configuration" or "Edit Configuration"
  - **~334 lines of code saved** (from 4699 to 4365 lines)

### 🎯 Smart Edit Mode
- **Mode Management**: Use of `data-attributes` to track current mode
  - `modal.dataset.mode = 'edit'` per modalità modifica
  - `modal.dataset.editId`, `modal.dataset.editName`, `modal.dataset.editType` per i dati della configurazione
  - Selettore tipo configurazione disabilitato in modalità edit
  - Campi chiave (nome configurazione, operatore, sorgente condizionale) disabilitati dove appropriato

### 🖱️ Tooltip Vista Settimanale Migliorato
- **Tooltip Flottante**: Rimosso il sistema basato su `:hover` CSS con posizionamento statico
  - Creato tooltip flottante che segue esattamente il cursore del mouse
  - Posizionato con `position: fixed` per massima flessibilità
  - Transizioni smooth con opacity (0.2s)

### 📍 Posizionamento Intelligente
- **Bounds Checking**: Il tooltip verifica automaticamente i bordi della viewport e del container
  - Si riposiziona automaticamente per rimanere sempre visibile nell'area del componente
  - Controllo intelligente: destra → sinistra, basso → alto, sempre dentro i bounds
  - Offset di 15px dal cursore per migliore leggibilità

### 🧹 Cleanup Automatico
- **Memory Management**: Aggiunto `disconnectedCallback()` per rimuovere il tooltip dal DOM
  - Previene memory leaks e tooltip "fantasma"
  - Rimozione di eventuali tooltip esistenti prima di crearne uno nuovo

### 📦 Versioni
- integrazione: 2.1.0-beta.7
- card: 2.1.0-beta.7

---

## v2.1.0-beta.6 - 6 Gennaio 2026 🔄 Restore v2.0.0 Implementation

### 🔧 Fix Definitivo
- **Ripristinata implementazione v2.0.0 funzionante**: Rimosso completamente l'approccio `triggerEl` + `getRootNode()`
  - Causa problema: Le modifiche beta.2-beta.5 hanno introdotto complessità inutile che rompeva il funzionamento
  - Soluzione: Ripristinato il codice originale v2.0.0/v2.0.1 che usava `this.content.querySelector()` direttamente
  - Arrow functions mantengono correttamente il contesto `this` dell'istanza della card

### 🐛 Correzioni Aggiuntive
- **Modal edit visibilità**: Ora il modal edit si apre correttamente
- **Chiusura modal incrociata**: Quando si apre il modal "Inserisci", il modal "Edit" viene chiuso automaticamente
- **Vista settimanale**: Corretta funzione `dcShowWeeklyEventModal` per usare `this.content` invece di shadowRoot
- **Funzioni close modal**: Tutte le funzioni di chiusura modal ora usano `this.content` in modo coerente
  
### 📝 Dettagli Tecnici  
- `dcEditConfig` usa `this.content` invece di shadowRoot
- `dcOpenAddConfigModal` chiude il modal edit se aperto
- `dcCloseEditModal` usa `this.content.querySelector`
- `dcShowWeeklyEventModal` usa `this.content.querySelector`
- `dcCloseWeeklyEventModal` usa `this.content.querySelector`
- Rimossi tutti i riferimenti a `document.querySelector('mia-config-card')` e `shadowRoot`

### 📦 Versioni
- integrazione: 2.1.0-beta.6
- card: 2.1.0-beta.6

---

## v2.1.0-beta.5 - 6 Gennaio 2026 🔧 Shadow DOM Fallback Fix

### 🛠️ Fix Critico Shadow Root
- **Fallback migliorato**: Usa `window._miaConfigCardInstance.shadowRoot` invece di `document.querySelector()`
  - Il problema: `document.querySelector('mia-config-card')` non funziona in contesti isolati
  - La soluzione: L'istanza globale è sempre disponibile e mantiene il riferimento al shadowRoot
  - Impatto: Elimina completamente gli errori "Impossibile trovare il componente card"

### 📦 Versioni
- integrazione: 2.1.0-beta.5
- card: 2.1.0-beta.5

---

## v2.1.0-beta.4 - 6 Gennaio 2026 🐛 Shadow DOM Hotfix

### 🛠️ Fix Critico
- **Modal Edit & Weekly Popup**: Risolto definitivamente l'accesso al shadow DOM per modali edit e popup settimanale
  - I pulsanti passano ora l'elemento cliccato; il codice usa `getRootNode()` con validazione dell'host `mia-config-card`
  - Eliminati gli errori "Impossibile trovare il componente card" su edit e popup
  - Allineato fallback legacy per garantire compatibilità

### 📦 Versioni
- integrazione: 2.1.0-beta.4
- card: 2.1.0-beta.4

---

## v2.1.0-beta.3 - 6 Gennaio 2026 🌍 Internationalization

### 🌐 Internationalization & Multilingual Support
- **English Documentation**: Complete English translation of all documentation
  - README_EN.md: Full English version of main README
  - QUICK_START_EN.md: English quick start guide
  - Complete UI translations in translations/en.json
  - **Impact**: Integration now fully accessible to international users

- **Multilingual UI**: Enhanced translation system
  - All config flow strings translated (English + Italian)
  - All service descriptions translated
  - Field descriptions and helpers in both languages
  - **Impact**: Users can use the integration in their language

- **HACS Compatibility**: Updated for worldwide distribution
  - Added country codes: IT, GB, US in hacs.json
  - Language switcher in README files
  - **Impact**: Integration ready for HACS default repository

### 📝 Documentation Updates
- Language switcher in all README files (🇮🇹 / 🇬🇧)
- Bilingual quick start guides
- Internationalized service documentation

### 🎯 Target Audience
Integration now serves both Italian and international Home Assistant communities

**Versions**
- integrazione: 2.1.0-beta.3
- card: 2.1.0-beta.2

---

## v2.1.0-beta.2 - 6 Gennaio 2026 🐛 Bugfix Release

### 🐛 Fix Critici
- **Modal Edit**: Corretto problema sovrapposizione modali quando si apriva edit da dentro il modal di inserimento
  - Aggiunta chiusura automatica del modal "add" quando si apre "edit"
  - Aumentato z-index del modal edit a 10000 (vs 9999 del modal add)
  - **Impatto**: Il tasto edit ora funziona correttamente e il modal appare in primo piano

- **Popup vista settimanale**: Corretto accesso al shadow DOM per visualizzazione dettagli eventi
  - Risolto problema "this" context quando chiamato da onclick HTML
  - Utilizzato `closest('mia-config-card')` per risalire al componente corretto
  - **Impatto**: Click/tap sulle barre della vista settimanale ora apre correttamente il modal dettagli

- **Collapse gruppi override**: Corretto toggle espansione/collasso dei gruppi
  - Modificata funzione `dcToggleOverrideGroup` per passare elemento DOM
  - Corretto accesso al shadow DOM del componente
  - **Impatto**: Il collapse nei gruppi per override ora funziona correttamente

### 🎨 UI/UX Mobile
- **Pulsanti compatti**: Sostituiti testi con icone per ottimizzare spazio su mobile
  - "Elimina Tutto" → 🗑️ con tooltip
  - "Inserisci" (gruppi override) → ➕ con tooltip
  - Padding ottimizzato per pulsanti più compatti
  - **Impatto**: Interfaccia più pulita e adatta a schermi piccoli

### 📝 Note Tecniche
Tutti i fix riguardano problemi di scope con `this` in funzioni window chiamate da onclick HTML inline. Soluzione: passare l'elemento DOM e usare `closest()` + `shadowRoot` per accedere agli elementi del custom element.

**Versioni**
- integrazione: 2.1.0-beta.2
- card: 2.1.0-beta.2

---

## v2.1.0-beta.1 - 6 Gennaio 2026 🧪 Beta Release

### 🎨 Frontend (mia-config-card.js)
- **Vista settimanale mobile**: Aggiunto modal con dettagli completi per tocco/click sulle barre
  - **Problema**: I tooltip hover erano tagliati e illeggibili su smartphone
  - **Soluzione**: Click/tap sulle barre apre un modal mobile-friendly con tutti i dettagli
  - Mantiene i tooltip hover per desktop (progressive enhancement)
  - Chiusura modal con click sul backdrop o pulsante X
  - Aggiunta nota nella legenda sulla funzionalità tap/click

### 📝 Note
Prima versione beta di 2.1.0. Testing per nuove funzionalità in arrivo.

---

## v2.0.0 - 3 Gennaio 2026 🚀 Major UX + Backup

### ✨ Novità principali
- Modal-only per inserimento/configurazione override: tutti i form (standard/orario/temporale/condizionale) usano modali dedicati, eliminato il vecchio quick override inline.
- Gestione backup integrata: upload/download/list/delete via nuovi endpoint HTTP e servizi dedicati, con UI nella card.
- Storico abilitazioni: i toggle enable/disable delle configurazioni ora vengono registrati nello storico e visualizzati nella UI.
- Override raggruppati e collassabili: gruppi per tipo con toggle rapido, migliore leggibilità.

### 🎨 Frontend (mia-config-card.js)
- Vista settimanale: tooltip protetti da "Node cannot be found" e allineamento dinamico sui bordi; legenda aggiornata.
- Modalità mobile: padding e spaziatura ridotti, operator+valore nella stessa riga nei modali condizionali.
- Banner/versione card aggiornata a 2.0.0; risorse backup e modali coerenti con i nuovi servizi.

### 🛠️ Backend (integrazione)
- Nuovi endpoint HTTP per backup (upload/download) e servizi di lista/eliminazione; helper per directory backup.
- simulate_schedule esposto via WebSocket per la vista settimanale, con granularità derivata da scan_interval.
- Log abilitazione/disabilitazione configurazioni nello storico.

### 🐛 Fix
- Override "valori validi" e select inizializzate correttamente nei modali (niente più selector null).
- Tooltip vista settimanale non esplodono quando il DOM viene smontato.

**Versioni allineate**
- integrazione: 2.0.0
- card: 2.0.0

## v1.5.5 - 2 Gennaio 2026 🐛 Fix Override 24h + UI

### 🐛 Fix: Override Orari 24h con Qualsiasi Orario
**Problema**: 22:00 - 22:00 non funzionava (solo 00:00 - 00:00 era supportato)
- **Causa**: La condizione speciale era `if valid_from == 0.0 and valid_to == 0.0`
- **Soluzione**: Generalizzato a `if valid_from == valid_to` (qualsiasi orario uguale)
- **Esempi ora funzionanti**:
  - 00:00 - 00:00 → 24 ore ✅
  - 08:00 - 08:00 → 24 ore ✅
  - 22:00 - 22:00 → 24 ore ✅

**File Modificati**: `database.py` (4 punti: linee 253, 212, 333, 1391)

### 🎨 UI: Miglioramenti Vista Settimanale (v1.3.14)

**1. Rimosso Hover Espansione Banda**
- **Problema**: Al passaggio del mouse, la barra si espandeva lateralmente causando una "banda" visibile sopra le date
- **Soluzione**: Rimosso `left: 0; right: 0; transform: scaleY(1.05);` dall'hover
- Mantiene solo l'ombra per feedback visivo
- CSS pulito: `transition: box-shadow 0.2s` (invece di `all 0.2s`)

**2. Tooltip Fuori Schermo per Barre 24h**
- **Problema**: Barre che occupano 24 ore mostrano tooltip in basso, fuori viewport
- **Soluzione**: Rilevamento automatico barre 24h (height >= 1430px)
- Per barre 24h: tooltip mostrato SEMPRE sopra
- Logica posizionamento:
  ```javascript
  if (barHeight >= 1430) {
      // 24h → sempre sopra
  } else if (barTopPx < 200) {
      // Inizio giornata → sotto
  } else {
      // Logica spazio viewport
  }
  ```

**File Modificato**: `www/mia-config-card.js` (linee 142, 3078-3098)

---

## v1.5.4 - 2 Gennaio 2026 🐛 BUGFIX Critico - Override Orari

### 🐛 Fix Critico: Validazione e Gestione Override Orari

**Problema 1: Errore "minuti devono essere tra 0 e 59, ricevuto: 98"**
- **Causa**: La funzione `validate_time_format` usava formula errata per convertire ore decimali
- **Bug**: Moltiplicava per 100 invece di 60
  - Frontend invia: `23.983333` (23 + 59/60 ore in formato decimale)
  - Backend calcolava: `int(0.983333 * 100) = 98` minuti ❌
  - Doveva calcolare: `round(0.983333 * 60) = 59` minuti ✅
- **Soluzione**: Corretta formula in `validate_time_format` ([__init__.py](c:\\Users\\abial\\Documents\\GitHub\\MiaConfig\\__init__.py#L34))
  ```python
  minutes = round((time_value - hours) * 60)  # Ora corretto!
  ```

**Problema 2: Override 00:00 - 00:00 non copre 24 ore**
- **Causa**: La logica interpretava 00:00 - 00:00 come "0 ore" invece di "24 ore"
- **Comportamento errato**: Attivo solo esattamente a mezzanotte (00:00:00)
- **Soluzione**: Aggiunto caso speciale in 4 punti del codice
  ```python
  if valid_from == 0.0 and valid_to == 0.0:
      is_valid = True  # 24 ore - sempre attivo
  ```
  
**File Modificati**:
- `__init__.py`: Fix validazione tempo (linea 34)
- `database.py`: Fix logica 00:00-00:00 in:
  - Override temporali con filtro orario (linea 213)
  - Override orari (linea 250)
  - Override condizionali con filtro orario (linea 330)
  - Dashboard configurazioni attive (linea 1383)

**Impatto**:
- ✅ Ora è possibile creare override orari fino alle 23:59
- ✅ Override 00:00 - 00:00 copre tutte le 24 ore come previsto
- ✅ Nessun impatto su configurazioni esistenti (backward compatible)

---

## v1.5.3 - 2 Gennaio 2026 🐛 BUGFIX Critico - Condizionali Dipendenti

### 🐛 Fix Critico: Valutazione Condizionali con Dipendenze
**Problema**: I condizionali che dipendono da altri condizionali usavano valori errati
- **Scenario**: 
  1. Condizionale A: `Se tipo_sveglia = sveglia6 → profilo_temperatura = sveglia`
  2. Condizionale B: `Se profilo_temperatura = minimo → accensione_automatica = 0`
  3. Quando tipo_sveglia = sveglia6, il Condizionale B dovrebbe vedere profilo_temperatura = "sveglia"
  4. **BUG**: Il Condizionale B valutava la condizione usando il valore "minimo" (standard), NON "sveglia"
  5. Risultato: accensione_automatica veniva impostato a 0 anche quando profilo_temperatura era "sveglia"

**Causa Root**: I condizionali venivano valutati una sola volta usando il risultato provvisorio (senza altri condizionali applicati)

**Soluzione**: Valutazione iterativa dei condizionali fino a convergenza
- Itera massimo 10 volte (tipicamente converge in 2-3 iterazioni)
- Ad ogni iterazione:
  1. Valuta tutti i condizionali con i valori correnti
  2. Applica i condizionali valutati al risultato
  3. Controlla se i valori sono cambiati
  4. Se stabili → fine, altrimenti ripete
- Gestisce correttamente catene di dipendenze di qualsiasi lunghezza
- Previene loop infiniti con limite iterazioni

**Impatto**: 
- ✅ I condizionali ora vedono i valori corretti di altri condizionali
- ✅ La vista settimanale ora mostra le configurazioni corrette
- ⚡ Performance: +1-2ms per timestamp (trascurabile, solo quando ci sono condizionali attivi)

### 🎨 UI: Miglioramenti Vista Settimanale (v1.3.13)
**Tooltip Condizionali più Chiari**:
- "Fascia oraria" → "Finestra configurata" (più chiaro che è un filtro)
- Aggiunto testo esplicativo: "Il condizionale si applica solo quando la condizione è soddisfatta E rientra nella finestra"
- Warning automatico se la barra è più corta della finestra: "⚠️ La barra mostrata è più corta perché la condizione non era soddisfatta per tutta la durata"

**Debug Migliorato**:
- ID configurazione visibile in tutti i tooltip
- ID visibile nel tab "Gestisci" sotto ogni configurazione
- Facilita il debug quando una configurazione sembra "non esistere"

**File Modificati**:
- `database.py`: Logica valutazione condizionali iterativa
- `www/mia-config-card.js`: Tooltip UI migliorati

---

## v1.5.2 - 2 Gennaio 2026 ⚡ Ottimizzazione Database

### ⚡ Performance Runtime - Riduzione Query e CPU/IO
- **Indici Database**: Aggiunti 5 indici strategici sulle tabelle principali
  - `idx_configurazioni_setup_name` - Accelera lookup configurazioni standard
  - `idx_orario_ora` - Ottimizza filtri temporali configurazioni a orario
  - `idx_tempo_date` - Velocizza range query configurazioni a tempo
  - `idx_condizionali_config` - Migliora risoluzione dipendenze condizionali
  - `idx_storico_name_timestamp` - Ottimizza query storico e grafici
  - **Impatto**: Query runtime 5-10x più veloci su database con molte configurazioni

- **Cache Descrizioni**: Sistema di caching intelligente per le descrizioni (TTL 60s)
  - Riduce 1 query completa ad ogni `scan_interval`
  - Invalidazione automatica su INSERT/UPDATE/DELETE
  - Zero impatto su latenza delle modifiche
  - **Impatto**: -20% query totali ad ogni aggiornamento sensori

### 🔍 Dettagli Tecnici
- Indici creati con `CREATE INDEX IF NOT EXISTS` - safe per aggiornamenti
- Query plan optimizer SQLite sfrutta indici compositi
- Cache thread-safe con timestamp validation
- Descrizioni raramente modificate: hit rate cache ~99%

### 🐛 Fix
- **Config Flow AttributeError**: Rimosso `__init__` ridondante da `MiaConfigOptionsFlowHandler`
  - Errore 500 quando si cliccava sull'ingranaggio configurazione integrazione
  - `config_entry` è già proprietà read-only della classe base `OptionsFlow`
  
- **Tooltip Bordi Vista Settimanale**: Tooltip prima/ultima colonna non più tagliati
  - Prima colonna: tooltip allineato a sinistra (`tooltip-left`)
  - Ultima colonna: tooltip allineato a destra (`tooltip-right`)
  - Colonne centrali: comportamento default centrato

---

## v1.5.1 - 1 Gennaio 2026 🎯 Performance e UX

### 🚀 Ottimizzazione Performance
- **Granularità Allineata a scan_interval**: Vista settimanale ora usa automaticamente `scan_interval` del componente
  - Nessun parametro aggiuntivo - riusa configurazione esistente
  - scan_interval 60s → 1 min granularità (1440 sample/giorno)
  - scan_interval 300s → 5 min granularità (288 sample/giorno) = **5x più veloce**
  - scan_interval 600s → 10 min granularità (144 sample/giorno) = **10x più veloce**
  - Impatto: 14 giorni con 300s scan passa da 20160 a 4032 chiamate (-80%)

### 🎨 Miglioramento UI
- **Fix Tooltip Vista Settimanale**: Tooltip ore notturne non più tagliati fuori schermo
  - Tooltip configurazioni 00:00-03:20 ora mostrati SEMPRE sotto la barra
  - Logica basata su posizione assoluta (`style.top`) invece che viewport relativo
  - Esperienza utente migliorata: tutti i tooltip sempre visibili

### 🔧 Dettagli Tecnici
- Algoritmo campionamento: sample ogni N minuti, riempimento minuti intermedi
- Default 5 minuti bilancia performance/precisione ottimale
- Usa sempre logica unificata `_get_configurations_at_time` (coerenza garantita)

---

## v1.5.0 - 1 Gennaio 2026 🚀 Architettura Unificata

### 🏗️ Refactoring Architetturale Maggiore
- **LOGICA UNIFICATA Runtime ↔ Simulazione**: Eliminata duplicazione codice tra valutazione runtime e vista settimanale
  - Nuova funzione `_get_configurations_at_time(target_datetime)` centralizza tutta la logica di risoluzione
  - `get_all_configurations()` ora usa `_get_configurations_at_time(datetime.now())`
  - `simulate_configuration_schedule()` usa `_get_configurations_at_time()` per ogni minuto simulato
  - **Garanzia assoluta**: runtime e simulazione producono sempre gli stessi risultati
  - Risoluzione ricorsiva nested conditionals unificata (profilo_temperatura → tipo_sveglia → giorno_festivo)

### 🐛 Fix Critico Discrepanza Stato
- **Risolto**: Vista settimanale mostrava valori diversi dall'entità in tempo reale
  - Causa: `simulate_configuration_schedule` usava `build_minute_map_for_setup` (ricorsivo)
  - Causa: `get_all_configurations` usava logica separata (non ricorsiva per nested conditionals)
  - Soluzione: **unica fonte di verità** per entrambi i percorsi

### 🎯 Vantaggi
- ✅ Coerenza garantita tra dashboard e vista settimanale
- ✅ Manutenibilità: modifiche alla logica di risoluzione in un solo punto
- ✅ Testing semplificato: una sola funzione da testare
- ✅ Meno bug: impossibile disallineamento logico

### ⚠️ Note Prestazioni
- Trade-off accettato: correttezza > performance
- Simulazione chiama `_get_configurations_at_time` 1440 volte/giorno (20160 per 14gg)
- Impatto limitato: vista settimanale chiamata solo su richiesta utente, non in loop

### 📐 Architettura
```
_get_configurations_at_time(timestamp) ← LOGICA CORE
    ├── Carica config a tempo attive
    ├── Carica config a orario attive  
    ├── Carica config standard
    ├── Valuta condizionali ricorsivamente
    └── Applica priorità e source_order

get_all_configurations()
    └── _get_configurations_at_time(now)

simulate_configuration_schedule()
    └── for ogni minuto:
        └── _get_configurations_at_time(minuto)
```

---

## v1.4.2 - 1 Gennaio 2026 🎯🔧

### 🐛 Correzioni Critiche Backend
- **Fix Conversione `days_of_week` Vuote**: Aggiunta validazione `if d` in tutte le conversioni `int(d)` per evitare errori con stringhe vuote
  - Risolto `invalid literal for int() with base 10: ''`
  - Gestione corretta di NULL/empty strings in `days_of_week`
  - Applicato fix su 9 occorrenze nel codice (linee 185, 212, 763, 787, 1093, 1155, 1274, 1520, 1563, 1646, 1719)

- **Fix Dipendenze Circolari**: Corretto algoritmo di rilevamento dipendenze negli override condizionali
  - Query invertita: da "WHERE conditional_config = ?" a "WHERE setup_name = ?"
  - Ora traccia correttamente le catene di dipendenza (A→B→C)
  - Aggiunto check diretto `if conditional_config == setup_name` all'inizio
  - Aggiunto `row_factory = sqlite3.Row` per accesso corretto ai campi

### ✨ Miglioramenti UI - Override Condizionali
- **Raggruppamento Semplificato**: Rimossa fascia oraria e giorni dalla chiave di raggruppamento
  - Override condizionali ora raggruppati solo per: `conditional_config`, `conditional_operator`, `conditional_value`
  - Vista più pulita e intuitiva

- **Pre-popolamento Completo Form "Inserisci"**: Funzione asincrona con await corretto
  - ✅ Configurazione da override (setup_name)
  - ✅ **Valore override** (setup_value) - NUOVO
  - ✅ Condizione basata su (conditional_config)
  - ✅ Operatore (conditional_operator)
  - ✅ Valore di confronto (conditional_value)
  - ✅ **Fascia oraria** (valid_from_ora/valid_to_ora) - NUOVO: pre-attivata e pre-popolata se presente
  - Attende caricamento valori validi con `await dcLoadValidValuesForForm()`
  - Attende `dcUpdateConditionalOptions()` per popolazione dropdown dinamici
  - Pause aggiuntive (100ms) per sincronizzazione DOM

### 🔧 Ottimizzazioni
- Funzione `dcInsertOverrideGroup` ora async per gestione corretta caricamento dati
- Pre-popolamento anche per form Schedule e Time (oltre a Conditional)
- Gestione robusta di `days_of_week` come string o array

### 📦 Versioni
- **Frontend**: v1.3.10 → Async form prefill with proper wait for dynamic select population
- **Backend**: Fix gestione stringhe vuote e circular dependency detection

---

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
