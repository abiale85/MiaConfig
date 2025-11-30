# ✅ Mia Config - Modifiche Completate

## 🎉 Componente Rinominato e Aggiornato!

Il componente è stato completamente rinominato da **Dynamic Config** a **Mia Config** e ora supporta l'installazione tramite UI senza modificare `configuration.yaml`!

## 📝 Modifiche Principali

### 1. Rinominazione Completa ✅
- **Cartella**: `custom_components/dynamic_config/` → `custom_components/mia_config/`
- **Dominio**: `dynamic_config` → `mia_config`
- **Servizi**: `dynamic_config.*` → `mia_config.*`
- **Sensori**: `sensor.dynamic_config_*` → `sensor.mia_config_*`
- **Card**: `dynamic-config-card` → `mia-config-card`
- **WWW**: `www/dynamic-config/` → `www/mia-config/`

### 2. Config Flow - Installazione UI ⭐ NUOVO!
- ✅ Creato `config_flow.py` per supporto UI
- ✅ Aggiunto `"config_flow": true` in `manifest.json`
- ✅ Aggiornato `__init__.py` per supportare config entries
- ✅ Aggiornato `sensor.py` per async_setup_entry
- ✅ NON serve più `configuration.yaml`!

### 3. Traduzioni e Localizzazione 🌍 NUOVO!
- ✅ Creato `strings.json` (default)
- ✅ Creato `translations/it.json` (italiano)
- ✅ Creato `translations/en.json` (inglese)
- ✅ Interfaccia completamente tradotta

### 4. Costanti Aggiornate
```python
DOMAIN = "mia_config"
DEFAULT_NAME = "Mia Config"
DEFAULT_SCAN_INTERVAL = 60
```

### 5. File JavaScript Aggiornato
- ✅ Rinominato: `mia-config-card.js`
- ✅ Tutti i servizi aggiornati a `mia_config.*`
- ✅ Titolo card: "Mia Config Manager"
- ✅ Tipo card: `custom:mia-config-card`

## 🚀 Come Installare (NUOVA PROCEDURA)

### Metodo 1: Installazione UI (Raccomandato) ⭐

1. **Riavvia Home Assistant**

2. **Aggiungi l'integrazione**:
   - Vai su **Impostazioni** → **Dispositivi e Servizi**
   - Click **+ AGGIUNGI INTEGRAZIONE**
   - Cerca **"Mia Config"**
   - Click su **Mia Config**
   - Configura intervallo (default 60 secondi)
   - Click **INVIA**

3. **Installa la Card** (opzionale):
   - **Impostazioni** → **Dashboard** → **Risorse**
   - Aggiungi risorsa: `/mia_config_local/mia-config-card.js`
   - Tipo: **JavaScript Module**
   - Aggiungi card al dashboard: `type: custom:mia-config-card`

**Fatto!** Nessun YAML necessario! 🎉

### Metodo 2: Configurazione YAML (Legacy - Opzionale)

Se preferisci, puoi ancora usare YAML:

```yaml
# configuration.yaml (OPZIONALE - non più necessario!)
mia_config:
  db_path: "config/mia_config.db"
  scan_interval: 60
```

Ma il metodo UI è molto più semplice!

## 📁 Struttura File Aggiornata

```
mia_config/
├── custom_components/
│   └── mia_config/                    # ← Rinominato
│       ├── __init__.py                # ← Aggiornato per config flow
│       ├── config_flow.py             # ← NUOVO!
│       ├── const.py                   # ← Aggiornato con nuovo nome
│       ├── database.py                # ← Nessuna modifica
│       ├── sensor.py                  # ← Aggiornato per config entry
│       ├── panel.py                   # ← Aggiornato nome
│       ├── panel.html                 # ← Nessuna modifica
│       ├── manifest.json              # ← Aggiunto config_flow: true
│       ├── services.yaml              # ← Nessuna modifica
│       ├── strings.json               # ← NUOVO!
│       ├── translations/              # ← NUOVO!
│       │   ├── it.json
│       │   └── en.json
│       ├── SETUP_UI.md                # ← NUOVO! Guida installazione UI
│       └── ... (altri file MD)
│
└── www/
    └── mia-config/                    # ← Rinominato
        └── mia-config-card.js         # ← Rinominato e aggiornato
```

## 🔄 Migrazione da Versione Precedente

Se avevi già installato "Dynamic Config":

### 1. Rimuovi la Vecchia Configurazione

**Metodo A**: Se avevi YAML in `configuration.yaml`:
```yaml
# Rimuovi questa sezione:
dynamic_config:
  db_path: "config/dynamic_config.db"
  scan_interval: 60
```

**Metodo B**: Se non avevi nulla in YAML, passa al punto 2.

### 2. Rinomina il Database (Opzionale)

Per mantenere le configurazioni esistenti:

```powershell
# In PowerShell
Move-Item -Path "config/dynamic_config.db" -Destination "config/mia_config.db"
```

Oppure crea nuove configurazioni (il database verrà creato automaticamente).

### 3. Riavvia Home Assistant

### 4. Aggiungi la Nuova Integrazione

Segui la procedura di installazione UI sopra.

### 5. Aggiorna la Risorsa Card

- Rimuovi la vecchia risorsa: `/local/dynamic-config/dynamic-config-card.js`
- Aggiungi la nuova: `/mia_config_local/mia-config-card.js`

### 6. Aggiorna i Dashboard

Sostituisci nei tuoi dashboard:
```yaml
# Vecchio
type: custom:dynamic-config-card

# Nuovo
type: custom:mia-config-card
```

### 7. Aggiorna le Automazioni

Sostituisci nei servizi:
```yaml
# Vecchio
service: dynamic_config.set_config

# Nuovo
service: mia_config.set_config
```

Sostituisci nei sensori:
```yaml
# Vecchio
entity_id: sensor.dynamic_config_temperatura

# Nuovo
entity_id: sensor.mia_config_temperatura
```

## ✨ Vantaggi della Nuova Versione

### Installazione UI
✅ Nessuna modifica a `configuration.yaml`  
✅ Aggiunta/rimozione dall'interfaccia  
✅ Opzioni modificabili senza riavvio  
✅ Integrazione nativa Home Assistant  
✅ Miglior esperienza utente  

### Nome Personalizzato
✅ "Mia Config" più personalizzato e chiaro  
✅ Evita conflitti con altre integrazioni  
✅ Identità unica nel tuo sistema  

### Config Flow
✅ Standard Home Assistant  
✅ Supporto per più istanze (future)  
✅ Gestione entry lifecycle  
✅ Opzioni dinamiche  

## 🎯 Nuovi File Creati

1. **config_flow.py** - Gestione flusso configurazione UI
2. **strings.json** - Traduzioni default
3. **translations/it.json** - Traduzioni italiano
4. **translations/en.json** - Traduzioni inglese
5. **SETUP_UI.md** - Guida installazione UI completa

## 📊 File Aggiornati

1. **__init__.py** - Supporto config entry + backward compatibility YAML
2. **const.py** - Nuovo dominio e costanti
3. **manifest.json** - Aggiunto config_flow: true
4. **sensor.py** - async_setup_entry invece di async_setup_platform
5. **panel.py** - Nuovo nome
6. **mia-config-card.js** - Tutti i servizi aggiornati
7. **README.md** (root) - Nuove istruzioni installazione
8. Tutti i file **.md** nella cartella del componente (da aggiornare)

## 🧪 Test Consigliati

Dopo l'installazione, verifica:

1. ✅ L'integrazione appare in **Impostazioni** → **Dispositivi e Servizi**
2. ✅ I servizi `mia_config.*` sono disponibili
3. ✅ Puoi creare una configurazione dalla card UI
4. ✅ Il sensore `sensor.mia_config_*` viene creato
5. ✅ Le opzioni sono modificabili dalla configurazione integrazione
6. ✅ L'integrazione può essere rimossa senza errori

## 🐛 Risoluzione Problemi

### Integrazione non appare
- Verifica cartella: `custom_components/mia_config/`
- Riavvia Home Assistant
- Svuota cache: Ctrl+F5

### Errore "Domain mia_config already registered"
- Hai ancora configurazione YAML in `configuration.yaml`
- Rimuovila e riavvia

### Card non funziona
- Aggiorna risorsa con nuovo URL
- Svuota cache browser
- Verifica tipo card: `custom:mia-config-card`

### Sensori vecchi (sensor.dynamic_config_*)
- I vecchi sensori rimarranno fino alla rimozione manuale
- Puoi rimuoverli da **Strumenti Sviluppatori** → **Stati**
- Oppure usa i nuovi `sensor.mia_config_*`

## 📚 Documentazione

- **[SETUP_UI.md](SETUP_UI.md)** - Guida completa installazione UI
- **[README.md](../../../README.md)** - README principale aggiornato
- File **.md** originali ancora da aggiornare con i nuovi nomi

## 🎉 Conclusioni

Il componente è stato completamente rinominato e modernizzato:

- ✅ Nome: **Mia Config**
- ✅ Installazione: **Tramite UI** (no YAML!)
- ✅ Config Flow: **Completo**
- ✅ Traduzioni: **IT/EN**
- ✅ Card: **Aggiornata**
- ✅ Retrocompatibilità: **YAML legacy supportato**

**Riavvia Home Assistant e aggiungi l'integrazione dall'UI!** 🚀

---

**Versione**: 1.1.0  
**Data**: 30 Novembre 2025  
**Compatibilità**: Home Assistant 2023.1+
