# Release Notes v2.3.7

**Data**: 13 Ottobre 2026

## 🐛 Fix

### ⚡ Chiamate bloccanti nell'event loop (backup)
- Risolto il warning di Home Assistant `Detected blocking call to scandir ... inside the event loop` in `list_backups`
- Tutte le operazioni su file dei backup (`mkdir`, `glob`, `stat`, `exists`, `resolve`, `unlink`, lettura upload) ora girano nell'executor
- Servizi interessati: `backup_database`, `restore_database`, `list_backups`, `delete_backup`, `delete_all_backups`, endpoint di download e upload backup
- Validazione dei percorsi semplificata con `Path.is_relative_to` (risposta 400 per percorsi fuori dalla cartella backup)

### 🔄 Cache prossimi cambiamenti
- Se il timestamp della cache è nel futuro (clock skew), la cache viene invalidata e ricalcolata
- Se tutti gli eventi in cache sono già passati, viene forzato un ricalcolo immediato (con log `[CACHE]`)

### 🧹 Pulizia codice
- Rimossi `except:` generici, import e variabili inutilizzati (pyflakes pulito)

### 📦 Versione
- `manifest.json` allineato: la v2.3.6 era stata pubblicata con versione `2.3.5` nel manifest

## 📦 Versioni
- integration: 2.3.7
