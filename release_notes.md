## v2.3.9 - 27 Ottobre 2026 🛠️ Widget Auto/Manuale

### ✨ Nuove funzionalità
- Widget Lovelace unico `mia-config-widget` in tre formati (riga, riquadro, card completa) con tipo di controllo dedotto automaticamente.
- Se i Valori Validi sono esattamente `0` e `1` il widget mostra un interruttore (etichette dalle descrizioni dei valori).
- Popup di forzatura con durate rapide (30 min … 4 h), "fino alle HH:MM", "fino al prossimo cambio automatico", data e ora o senza scadenza.
- Il sensore espone la scadenza della forzatura manuale nell'attributo `valid_to`.
- Nuovo widget `mia-config-shortcuts`: scorciatoie che creano override a tempo, override personalizzati da popup ed elenco degli override attivi con eliminazione.
- Card principale: pulsanti **🖐️ Manuale**, **➕ Override** e, per le configurazioni solo standard, **✏️ Valore**, con lo stesso popup dei widget.
- Assistente a parole: una frase viene interpretata dall'AI Task di Home Assistant (servizio `interpret_request`) e apre il popup precompilato da confermare; card `mia-config-assistant` e casella in cima alla dashboard della card principale.
- Nuovi servizi `set_manual_override` e `clear_manual_override`.
- Editor visuale del widget.
- Le risorse Lovelace di card e widget sono gestite automaticamente (create, aggiornate con `?v=versione`, doppioni e file obsoleti rimossi): non serve più registrarle a mano.
- La forzatura manuale è una configurazione a tempo con priorità riservata `0`, sempre vincente; schema del database invariato.

### 🔧 Modifiche
- Le priorità impostabili dall'utente partono da 1 (lo 0 è riservato alla forzatura manuale).
- Tutti i servizi accettano `entity_id`: prima la card configurata con un'istanza specifica dava errore "extra keys not allowed" a ogni salvataggio.
- Multi-istanza nella card principale: l'`entity_id` configurato nello YAML veniva ignorato (azzerato al primo aggiornamento); ora la card resta sull'istanza scelta, mostra un selettore se ce ne sono più di una, filtra la dashboard per istanza e più card nella stessa pagina non si scambiano più comandi.
- Multi-istanza in widget e assistente: nome del database nei nomi predefiniti e selettore di istanza nell'assistente.
- Modifica di una configurazione standard: il valore si sceglie tra i Valori Validi, se definiti.

### 🧹 Pulizia
- Rimosse le modifiche non previste della 2.3.8 (tabella `configurazioni_manuali`, servizi duplicati, modifiche alla card principale).

## v2.3.3 - 17 Gennaio 2026 🐛 Fix Buchi Vista Settimanale

### 🔧 Fix e miglioramenti
- **Fix buchi vista settimanale**: Risolti i buchi nella timeline quando finiscono le configurazioni a tempo con filtri orari
- **Generazione eventi orari**: Il metodo `_get_all_event_times()` ora genera eventi anche per gli orari di inizio/fine delle configurazioni a tempo
- **Timeline continua**: La vista settimanale ora mostra una timeline continua senza interruzioni

### 📦 Versioni
- integrazione: 2.3.3
- card: 2.2.0

## v2.3.2 - 17 Gennaio 2026 🐛 Fix Fuso Orario Critico

### 🔧 Fix e miglioramenti
- **Fix fuso orario critico**: Sostituiti tutti gli usi di `datetime.now()` con `dt_util.now()` per rispettare il timezone configurato in Home Assistant
- **Impatto**: Le configurazioni a orario ora funzionano correttamente anche se HA ha un timezone diverso da quello del sistema operativo
- **Aree coinvolte**: Calcoli schedulazioni, timestamp backup, aggiornamenti sensori, simulazioni

### 📦 Versioni
- integrazione: 2.3.2
- card: 2.2.0

## v2.3.1 - 17 Gennaio 2026 🐛 Fix Modal Condizionale

### 🔧 Fix e miglioramenti
- **Modal modifica condizionale**: Ora carica correttamente il menu dei valori validi in modalità modifica
- **Layout checkbox modal**: Sistemata larghezza checkbox che causava overflow del testo della label
- **CSS checkbox**: Aggiunti override specifici per prevenire comportamento full-width dei checkbox

### 📦 Versioni
- integrazione: 2.3.1
- card: 2.2.0

## v2.2.0 - 15 Gennaio 2026 🚀 Major Release

### ✨ Nuove funzionalità
- **Sistema di traduzione completo**: Caricamento automatico delle traduzioni all'avvio per messaggi sensore/card
- **Toggle debug configurabile**: Possibilità di abilitare/disabilitare debug via config YAML (`debug: true`) o variabile globale (`window.miaConfigDebug`)
- **Miglioramenti vista settimanale**: Rimossi log di debug dalla vista settimanale per ridurre rumore console

### 🔧 Fix e miglioramenti
- **Fix attributi predittivi**: Gli attributi `next_*` non tornano più `unknown` - cache predittiva riutilizzata con messaggi tradotti quando non ci sono eventi nei prossimi 7 giorni
- **Cache eventi rigenerabile**: Invalidazione completa della cache eventi ad ogni modifica configurazione per evitare risultati stantii
- **Retry automatico startup**: Quando la cache eventi è vuota allo startup, retry automatico per evitare blocco "nessun evento"
- **Lookahead esteso**: Finestra predittiva di default aumentata a 168 ore (7 giorni) per allineare attributi `next_*` con vista settimanale
- **Risoluzione mirata dipendenze**: Algoritmo ottimizzato che calcola solo le configurazioni necessarie per risolvere dipendenze condizionali
- **Simulazione event-driven**: Vista settimanale usa campionamento basato su eventi invece di granularità fissa per massima accuratezza

### 📦 Versioni
- integrazione: 2.2.0
- card: 2.2.0

## v2.1.2 - 8 Gennaio 2026 🚀 Stabilità & Fix Predittivi

### 🔧 Fix e miglioramenti
- Vista settimanale e sensori: i dati predittivi restano disponibili fra i refresh e mostrano un messaggio tradotto se non ci sono eventi nei prossimi 7 giorni (stop ai valori "unknown").
- Lookahead di default portato a 168 ore (7 giorni) per allineare attributi `next_*` con la card settimanale.
- Motore database: cache `event_times` con rigenerazione automatica, risoluzione mirata delle dipendenze condizionali e simulazione event-driven per la vista settimanale.
- Traduzioni caricate all'avvio, invalidazione cache completa dopo ogni modifica e meno rumore nei log della card grazie al toggle `debug` (config o `window.miaConfigDebug`).

### 📦 Versioni
- integrazione: 2.1.2
- card: 2.1.0-beta.7.2

## ✅ All Modal Issues Fixed + Multi-Instance Support + All Syntax Fixes + Layout Improvements

**This version fixes all 3 reported modal problems, adds complete multi-instance support, fixes all JavaScript syntax errors, and improves the add configuration modal layout:**

### 🐛 Issues Resolved:
1. **Edit Modal** - Now appears in foreground (was opening in background)
2. **Collapse in Group By Override** - Toggle now works correctly with enhanced debug logging
3. **Weekly View Popup** - Detail popup now appears when clicking bars (escapeHtml function added)
4. **JavaScript Syntax Errors** - Fixed all syntax issues:
   - Duplicate catch block in dcEditConfig function
   - Incorrect variable usage in dcShowWeeklyEventModal/dcToggleOverrideGroup (instance used before definition)
   - Missing try block in dcShowWeeklyEventModal function
   - Missing segment data extraction in dcShowWeeklyEventModal
   - Undefined addModal variable in dcEditConfig
   - Missing escapeHtml function in dcShowWeeklyEventModal
5. **Add Config Modal Layout** - Improved user experience:
   - Checkboxes now properly aligned with titles
   - Date fields (start/end) on same row
   - Priority field moved to header next to type selector
   - Added responsive design for mobile devices

### 🔧 Root Cause & Fix:
- **Problem**: Modal-specific IDs (#dc-edit-modal, #dc-weekly-event-modal) were defined outside .mia-config-card scope, so they didn't inherit the .active display rule
- **Solution**: Added explicit CSS rules for all modal IDs:
  ```
  #dc-add-config-modal.active, #dc-edit-modal.active, #dc-weekly-event-modal.active {
      display: flex !important;
  }
  ```
- **JavaScript**: Complete multi-instance support using `cardElement._instance` instead of global variables
- **Collapse Fix**: dcToggleOverrideGroup now uses CSS classes on specific group elements and includes enhanced debug logging
- **Weekly Modal Fix**: Added missing escapeHtml function to dcShowWeeklyEventModal for safe HTML rendering
- **Layout Improvements**:
  - Checkboxes use flex layout for proper alignment
  - Date fields combined in single row with flex
  - Priority moved to modal header for better UX
  - Added responsive CSS for mobile devices

### 🎯 Multi-Instance Support:
- **Before**: Used `window._miaConfigCardInstance` (breaks with multiple cards)
- **After**: Functions accept `cardElement` parameter and use `cardElement._instance`
- **Compatible**: Works with single or multiple MiaConfig cards on same page

### 🐛 Current Debug Focus:
- **Enhanced Logging**: dcToggleOverrideGroup now includes detailed debug logs
- **Console Output**: Check browser console for element detection and state changes
- **Troubleshooting**: Logs show available elements, search patterns, and operations performed

### 🧪 How to test:
1. **Hard-reload** (Ctrl+F5) - **IMPORTANT**: Clear browser cache!
2. **Edit button** → Modal should appear in foreground
3. **Collapse in group by override** → Should toggle open/close (check console for debug logs)
4. **Weekly view bar click** → Detail popup should appear (no more escapeHtml errors)
5. **Multiple cards** → Each card works independently
6. **No JavaScript errors** → Console should be clean (except debug logs)
7. **Add Config Modal** → Checkboxes aligned, dates inline, priority in header, responsive on mobile

### 📦 Versions:
- Integration: 2.1.0-beta.6
- Card: 2.1.0-beta.6

**All modals work correctly + full multi-instance support + zero syntax errors + improved UX + responsive design + enhanced debugging!** 🎉