# Release Notes v2.1.2

**Data**: 10 Gennaio 2025

## 🚀 Ottimizzazioni Performance

### Cache Intelligente
- **get_all_setup_names()**: eliminati 4 accessi al database utilizzando la cache in memoria
- **get_all_configurations_detailed()**: implementata cache completa con rebuild da memoria, da N query a 1 sola lookup
- **Risoluzione configurazioni mirata**: `_get_configurations_at_time()` ora accetta parametro opzionale `setup_name` per risolvere solo la configurazione richiesta invece di tutte le 7

### Event Detection Semplificato
- **Campionamento semplificato**: rimosso algoritmo complesso di raccolta eventi (100+ righe), sostituito con campionamento lineare del periodo richiesto
- **Scan Interval configurabile**: `get_next_changes()` ora rispetta il timing del coordinator (`scan_interval_seconds`) invece di campionare sempre ogni minuto
- **Efficienza migliorata**: ~8-15 query al database eliminate per ogni ciclo di aggiornamento

## 🔧 Miglioramenti

### Gestione Cache dopo Restore
- **Reload automatico**: il servizio `restore_database` ora chiama automaticamente `reload_cache()` dopo il ripristino
- **Nuovo metodo pubblico**: `reload_cache()` disponibile per sincronizzazione manuale della cache
- **Consistenza garantita**: cache sempre sincronizzata con database dopo restore

### Invalidazione Cache Completa
- `_invalidate_next_changes_cache()` ora svuota anche `_detailed_configs_cache` e `_descriptions_cache`
- Garantisce consistenza completa dopo modifiche alle configurazioni

## 🐛 Bug Fix

- **Fix cache stale dopo restore**: risolto problema di desincronizzazione cache dopo ripristino database da interfaccia
- **Fix campionamento eventi**: `get_next_changes` ora parte da `next_interval` invece di `now` per evitare di rilevare lo stato corrente come cambiamento futuro

## 📊 Impatto Performance

**Prima**:
- get_next_changes chiamava _get_configurations_at_time che risolveva TUTTE le 7 configurazioni per ogni timestamp
- get_all_setup_names: 4 query al database
- get_all_configurations_detailed: N query ad ogni chiamata

**Dopo**:
- get_next_changes risolve SOLO la configurazione richiesta + dipendenze
- get_all_setup_names: 0 query (cache)
- get_all_configurations_detailed: 0 query dopo primo caricamento
- Campionamento rispetta timing coordinator (no calcoli inutili)

## ⚙️ Dettagli Tecnici

- `_get_configurations_at_time(target_datetime, setup_name=None)`: filtro early con `should_process_config()`
- `get_next_changes(setup_name, limit_hours=24, max_results=5, scan_interval_seconds=60)`: loop di campionamento semplificato
- Tutte le modifiche backward-compatible, nessun breaking change

## 🔗 Commit Correlati

- `4635119` - refactor: simplify get_next_changes with sampling and configurable scan_interval
- `0614de3` - cache: optimize get_all_setup_names and get_all_configurations_detailed  
- `b5c9c7c` - fix: auto reload cache after database restore
