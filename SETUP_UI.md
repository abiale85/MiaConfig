# 🚀 Mia Config - Guida Rapida

## ✨ Novità: Installazione Senza YAML!

Ora puoi aggiungere **Mia Config** direttamente dall'interfaccia di Home Assistant, **senza modificare configuration.yaml**!

## 📦 Installazione

### 1. Installa il Componente

Il componente è già nella cartella corretta: `custom_components/mia_config/`

### 2. Riavvia Home Assistant

Vai su **Impostazioni** → **Sistema** → **Riavvia**

### 3. Aggiungi l'Integrazione dall'UI ⭐

1. Vai su **Impostazioni** → **Dispositivi e Servizi**
2. Click sul pulsante **+ AGGIUNGI INTEGRAZIONE** (in basso a destra)
3. Cerca **"Mia Config"**
4. Click su **Mia Config**
5. Configura l'intervallo di scansione (default: 60 secondi)
6. Click **INVIA**

**Fatto!** L'integrazione è attiva! 🎉

## 🎨 Installa l'Interfaccia UI (Opzionale ma Consigliato)

### 1. Registra la Risorsa

**Opzione A - Tramite UI** (consigliato):
1. Vai su **Impostazioni** → **Dashboard**
2. Click sui 3 puntini in alto a destra → **Risorse**
3. Click **+ AGGIUNGI RISORSA**
4. URL: `/mia_config_local/mia-config-card.js`
5. Tipo: **JavaScript Module**
6. Click **CREA**

**Opzione B - Tramite YAML**:
```yaml
lovelace:
  mode: yaml
  resources:
    - url: /mia_config_local/mia-config-card.js
      type: module
```

### 2. Aggiungi la Card al Dashboard

1. Vai su un dashboard
2. Click **MODIFICA DASHBOARD**
3. Click **+ AGGIUNGI CARD**
4. Scorri in basso e click **MANUALE**
5. Incolla:
```yaml
type: custom:mia-config-card
```
6. Click **SALVA**

## 🎯 Primo Utilizzo

### Con l'Interfaccia UI (Facile):

1. Apri la card **Mia Config Manager**
2. Vai sul tab **🕐 Orario**
3. Compila:
   - **Nome**: `temperatura_casa`
   - **Valore**: `19`
   - **Dalle**: `22.00` (formato decimale per 22:00)
   - **Alle**: `6.00`
   - **Giorni**: seleziona Lun, Mar, Mer, Gio, Ven
4. Click **Salva**

### Con i Servizi:

Vai su **Strumenti Sviluppatori** → **Servizi** e usa:

```yaml
service: mia_config.set_schedule_config
data:
  setup_name: "temperatura_casa"
  setup_value: "19"
  valid_from_ora: 22.00
  valid_to_ora: 6.00
  days_of_week: ["0", "1", "2", "3", "4"]  # Lun-Ven
```

## 📊 Usa il Sensore nelle Automazioni

Dopo aver creato una configurazione, il sensore sarà disponibile:

```yaml
automation:
  - alias: "Temperatura Automatica"
    trigger:
      - platform: state
        entity_id: sensor.mia_config_temperatura_casa
    action:
      - service: climate.set_temperature
        target:
          entity_id: climate.termostato
        data:
          temperature: "{{ states('sensor.mia_config_temperatura_casa') | float }}"
```

## ⚙️ Configurazione Avanzata

### Modifica Opzioni

1. Vai su **Impostazioni** → **Dispositivi e Servizi**
2. Trova **Mia Config**
3. Click **CONFIGURA**
4. Modifica l'intervallo di scansione
5. Click **INVIA**

### Rimozione

1. Vai su **Impostazioni** → **Dispositivi e Servizi**
2. Trova **Mia Config**
3. Click sui 3 puntini → **ELIMINA**

## 🆘 Risoluzione Problemi

### L'integrazione non appare nella lista

- Verifica che la cartella sia: `custom_components/mia_config/`
- Riavvia Home Assistant
- Svuota la cache del browser (Ctrl+F5)
- Controlla i log in **Impostazioni** → **Sistema** → **Log**

### La card non funziona

- Verifica che il file sia in: `www/mia-config/mia-config-card.js`
- Ricarica il browser (Ctrl+F5)
- Controlla che la risorsa sia registrata

### I sensori non si creano

- Verifica di aver aggiunto l'integrazione dall'UI
- Crea almeno una configurazione
- Attendi 60 secondi (intervallo di scansione)
- Ricarica la pagina

## 📚 Servizi Disponibili

- `mia_config.set_config` - Configurazione standard
- `mia_config.set_schedule_config` - Configurazione a orario (con giorni)
- `mia_config.set_time_config` - Configurazione a tempo
- `mia_config.delete_config` - Elimina configurazioni
- `mia_config.get_configurations` - Recupera configurazioni

## 🎯 Esempi Completi

Vedi i file nella cartella del componente:
- `automations.yaml.example` - Esempi di automazioni
- `README.md` - Documentazione completa
- `UI_GUIDE.md` - Guida interfaccia UI

## 💡 Vantaggi dell'Installazione UI

✅ Nessuna modifica a `configuration.yaml`  
✅ Aggiunta/rimozione facile dall'interfaccia  
✅ Opzioni modificabili senza riavvio  
✅ Integrazione nativa con Home Assistant  
✅ Miglior esperienza utente  

## 📝 Nota: Supporto YAML Legacy

Se preferisci, puoi ancora configurare tramite YAML (opzionale):

```yaml
# configuration.yaml (NON NECESSARIO)
mia_config:
  db_path: "config/mia_config.db"
  scan_interval: 60
```

Ma **non è più richiesto**! Usa l'UI! 🎉

---

**Buon divertimento con Mia Config!** 🚀
