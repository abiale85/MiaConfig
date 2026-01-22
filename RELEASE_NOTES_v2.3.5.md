# Release Notes v2.3.5

**Data**: 22 Gennaio 2026

## 🔧 Fix Critici - Sistema di Refresh

### ✅ Timing Refresh Corretto
- **CRITICO**: Refresh schedulato ora **DOPO** l'evento (+2s) invece di 10s PRIMA
- Garantisce che il valore nuovo sia sempre attivo quando letto
- Evita di leggere il valore vecchio durante la transizione

### ⚡ Precisione Temporale ai Secondi
- Aggiunto campo `seconds_until` nelle event predictions
- Eventi < 60s non vengono più persi per arrotondamento minuti
- Timing preciso per configurazioni con transizioni rapide

### 🔄 Cache Event Times Robusta
- Validazione rigorosa della cache con log dettagliati
- Rigenerazione automatica quando cache scade o insufficiente
- Safety check: forza rigenerazione se ci sono configurazioni ma nessun evento calcolato
- Log `[EVENT_TIMES]` per tracciare generazione/scadenza cache

### 🛡️ Safety Nets Aggiunti
- Intervallo minimo ridotto da 30s a 5s (per transizioni rapide)
- Se no next_changes ma configs esistono → refresh ogni 5min (non 1h)
- Se cache empty > 5min → forza ricalcolo
- Se eventi scaduti > 50% → forza ricalcolo
- Log dettagliati con prefissi: `[REFRESH TIMING]`, `[EVENT_TIMES]`, `[NEXT_CHANGES]`, `[COORDINATOR]`

### 🔍 Debuggabilità Migliorata
- Logging esplicito per ogni step di refresh
- Tracciamento completo di: event_times, next_changes, refresh scheduling
- Messaggi di warning se anomalie rilevate
- Dump periodico stato coordinator

## 🆕 Nuovo Servizio

### `mia_config.force_refresh`
Forza il refresh immediato dei valori e invalida cache predittive.

**Parametri**:
- `entity_id` (opzionale): Se specificato, refresh solo quella istanza. Se omesso, refresh globale.

**Uso**:
```yaml
service: mia_config.force_refresh
data:
  entity_id: sensor.mia_config_temperatura_target
```

## 📋 Cambiamenti Tecnici

### Database
- Event times generation con log dettagliato
- Validazione rigorosa con dettagli di fallback
- Next changes calculation con seconds precision

### Sensor
- Coordinator update interval adjustment migliorato
- Safety net per no-changes scenario
- Periodic state logging per debugging

### Services
- Nuovo servizio `force_refresh` per forzare aggiornamento manuale
- Schema aggiunto in services.yaml

## 🧪 Test Consigliati

Vedi `TEST_REFRESH_TIMING.md` per piano di test completo:
- Test transizioni orarie (8:15, 18:00, etc.)
- Test eventi ravvicinati (< 60s)
- Test cache regeneration
- Test safety nets

## 📊 Metriche Attese

✅ Nessun refresh saltato in 24h  
✅ Transizioni esatte al secondo (±2s)  
✅ Log precisi con timestamp coordinamento  
✅ Cache rigenerata quando necessario  
✅ Safety nets attivi automaticamente  

## 🔗 Correlati

- Chiude: Issue con salti di refresh casuali
- Risolve: Problemi timing configurazioni schedule
- Migliora: Affidabilità sistema refresh (base critica del componente)

## ⚠️ Breaking Changes

Nessuno. Completamente backward-compatible.

## 📝 Note

Questo è un fix di stabilità critico per il sistema di refresh. Il timing perfetto è la base del funzionamento dell'intero componente - gli aggiornamenti non devono più saltare.
