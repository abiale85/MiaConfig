## v2.3.9-beta.13 - 19 Novembre 2026 🎛️ Forzatura temporanea di entità

### ✨ Nuove funzionalità
- Nuovo widget `mia-config-entity-widget` (**Mia Config Forzatura entità**): imposta temporaneamente il valore di un'entità qualsiasi di Home Assistant (interruttori, luci, input_number/select/text, termostati, tapparelle, serrature...) e alla scadenza Mia Config rimette quello originale. Stessi formati riga, riquadro e card; la card mostra le ultime forzature.
- Forzature attive e storico salvati nella nuova tabella `forzature_entita` del database dell'istanza (inclusa nei backup): dopo un riavvio i ripristini vengono ripianificati e quelli scaduti nel frattempo eseguiti subito; se l'entità non risponde si riprova ogni minuto per un'ora.
- Forzando di nuovo un'entità già forzata, alla scadenza torna comunque il valore originale di partenza.
- Se qualcuno cambia il valore durante la forzatura si può scegliere se lasciare la modifica o rimettere il valore forzato per tutto il periodo (`enforce`), e se alla fine tornare al valore originale o all'ultimo valore manuale (`restore_to`). I cambi fatti da Mia Config stessa sono riconosciuti dal `context` e ignorati.
- Nuovi servizi `set_entity_override` (con `valid_to` o `duration`), `clear_entity_override` e `get_entity_override_history`; nuovo sensore `sensor.forzature_entita_<istanza>` con l'elenco delle forzature attive.

### ✨ Miglioramenti
- Card principale e widget riconoscono i sensori di configurazione dagli attributi (`integration`, `setup_name`) invece che dal prefisso `sensor.mia_config_` dell'entity_id: funzionano anche con entità rinominate e non scambiano per configurazioni altri sensori dell'integrazione.
- Widget riga ingrandito in altezza (vista a sezioni, 2+ righe): il valore va su una seconda riga a tutta larghezza e i valori lunghi vanno a capo invece di essere troncati.
- Nuova opzione `show_values` (editor: "Mostra i valori invece delle descrizioni"): widget e popup mostrano i valori validi invece delle loro descrizioni, che restano come suggerimento al passaggio del mouse.
- Quando lo spazio lo permette (riga alta, riquadro, card completa) il widget mostra anche da quanto tempo c'è il valore corrente (es. "da 2 h 10 min").
- Interruttore acceso/spento in manuale con i colori classici (blu acceso, grigio spento) invece del giallo del bordo: il valore corrente si legge meglio.

## v2.3.9-beta.12 - 5 Novembre 2026 🔗 Popup e storico

### ✨ Miglioramenti
- L'icona a sinistra del widget apre direttamente la vista **Storico** del popup di Home Assistant.
- Il pulsante "Torna in Auto" non compare più nei widget riga e riquadro: si trova solo nel popup.
- Nel popup nuovo link **Apri configurazione completa**: apre la card principale sulla scheda Configura con il gruppo dell'entità espanso (la dashboard con la card viene trovata automaticamente; opzione `config_path` per indicarla a mano).

## v2.3.9-beta.11 - 1 Novembre 2026 📈 Storico nei widget

### ✨ Miglioramenti
- L'icona a sinistra dei widget apre lo storico dell'entità nel popup standard di Home Assistant.
- Il click sul nome o sul valore continua ad aprire il popup per modificare il parametro.

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

## v2.3.7 - 13 Ottobre 2026 🐛 Backup senza chiamate bloccanti

### 🐛 Fix
- Risolto il warning `Detected blocking call to scandir ... inside the event loop`: tutte le operazioni su file dei backup (servizi e endpoint di download/upload) girano nell'executor.
- Validazione dei percorsi di backup con `Path.is_relative_to` (risposta 400 per percorsi fuori dalla cartella backup).
- Cache prossimi cambiamenti invalidata se il timestamp è nel futuro (clock skew) o se tutti gli eventi sono già passati.
- `manifest.json` allineato: la v2.3.6 era stata pubblicata con versione `2.3.5`.

## v2.3.5 - 22 Gennaio 2026 🔧 Sistema di refresh

### 🐛 Fix
- Refresh schedulato 2 secondi **dopo** l'evento invece di 10 secondi prima, così si legge sempre il valore nuovo.
- Precisione ai secondi (`seconds_until`): gli eventi a meno di 60 s non vengono più persi.
- Cache `event_times` validata e rigenerata automaticamente; intervallo minimo di refresh ridotto da 30 s a 5 s.

### ✨ Nuove funzionalità
- Servizio `mia_config.force_refresh` (con `entity_id` opzionale) per forzare l'aggiornamento e invalidare le cache.

## v2.3.4 - Gennaio 2026 🐛 Vista settimanale

### 🐛 Fix
- Buchi bianchi nella vista settimanale per le configurazioni a tempo: il confronto ora usa solo la data, non l'ora.

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
