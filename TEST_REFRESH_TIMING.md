# Test Piano per Verificare il Sistema di Refresh

## Problemi Risolti

### 1. **Timing del Refresh (CRITICO)**
**Problema**: Schedulavo refresh 10s PRIMA dell'evento → leggevo ancora il valore vecchio
**Fix**: Ora schedulo refresh 2s DOPO l'evento → garantisco che la config sia attiva

### 2. **Precisione Secondi**
**Problema**: Usavo `minutes_until * 60` → perdevo eventi < 60s
**Fix**: Uso `seconds_until` direttamente → precisione al secondo

### 3. **Cache Event Times Stale**
**Problema**: Cache non si rigenerava quando scadeva
**Fix**: Validazione rigorosa + log dettagliati + rigenerazione forzata se mancano eventi attesi

### 4. **Safety Nets**
- Se no next_changes ma configs esistono → refresh ogni 5min invece di 1h
- Se cache vuota > 5min → forza ricalcolo
- Se eventi scaduti > 50% → forza ricalcolo
- Log dettagliati per debugging con prefisso `[REFRESH TIMING]`, `[EVENT_TIMES]`, `[NEXT_CHANGES]`

## Test da Eseguire

### Test 1: Configurazione che Inizia alle 8:15
```yaml
# Configurazione schedule attiva Lun-Ven 8:15-18:00
service: mia_config.set_schedule_config
data:
  setup_name: "test_timing"
  setup_value: "active"
  valid_from_ora: 8.25  # 8:15
  valid_to_ora: 18.0
  days_of_week: "0,1,2,3,4"
```

**Verifiche**:
1. Alle 8:13 → log mostra "Next change in 120s, scheduling update AFTER event at 122s"
2. Alle 8:15:02 → valore passa ad "active"
3. Alle 17:58 → log mostra "Next change in 120s, scheduling update AFTER event at 122s"  
4. Alle 18:00:02 → valore torna a standard

### Test 2: Eventi Ravvicinati (< 60s)
```yaml
# Due config che si alternano ogni 30s
service: mia_config.set_schedule_config
data:
  setup_name: "test_rapid"
  setup_value: "A"
  valid_from_ora: 10.0
  valid_to_ora: 10.0083  # 10:00:30
  
service: mia_config.set_schedule_config
data:
  setup_name: "test_rapid"
  setup_value: "B"
  valid_from_ora: 10.0083
  valid_to_ora: 10.0167  # 10:01:00
```

**Verifiche**:
1. Entrambi gli eventi devono essere catturati (non più saltati per arrotondamento minuti)
2. Log mostra `seconds_until` precisi

### Test 3: Cache Regeneration
```bash
# Modifica configurazione
service: mia_config.set_schedule_config
# Attendi 1 secondo
# Verifica nei log:
# "[EVENT_TIMES] Regenerated cache: N events..."
```

### Test 4: Safety Net - No Events
```yaml
# Crea solo config standard (no schedule/time)
service: mia_config.set_config
data:
  setup_name: "test_static"
  setup_value: "static"
```

**Verifiche**:
- Log: "No changes predicted but 1 configs exist, using fallback interval: 300s"
- Refresh ogni 5 minuti (non 1 ora)

## Comandi per Monitorare

### Log in Tempo Reale
```bash
# In Home Assistant
tail -f home-assistant.log | grep -E "REFRESH TIMING|EVENT_TIMES|NEXT_CHANGES|COORDINATOR"
```

### Verifica Stato Sensore
```yaml
# Developer Tools > States
sensor.mia_config_test_timing
# Attributes:
# - next_change_at: timestamp
# - next_changes: array eventi futuri
```

## Metriche di Successo

✅ **Nessun refresh saltato in 24h**
✅ **Transizioni esatte al secondo previsto (±2s)**
✅ **Log mostrano timing preciso con `[REFRESH TIMING]`**
✅ **Cache regenerata quando necessario (log `[EVENT_TIMES]`)**
✅ **Safety nets attivi quando servono**

## Log Attesi (Esempio)

```
2026-01-22 08:13:00 INFO [NEXT_CHANGES] test_timing: Next change to 'active' in 120s at 2026-01-22T08:15:00
2026-01-22 08:13:00 INFO [REFRESH TIMING] Next change in 120s, scheduling update AFTER event at 122s
2026-01-22 08:15:02 INFO [COORDINATOR] Update interval dynamically adjusted to 17878s
2026-01-22 08:15:02 INFO [COORDINATOR] State: 5 configs, next_update=17878s, earliest_change=17876s
```
