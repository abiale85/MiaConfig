# Guida Interfaccia UI per Dynamic Config

## Installazione Card Lovelace

### 1. Copia il file JavaScript

Il file `dynamic-config-card.js` è già nella cartella `www/dynamic-config/`

### 2. Registra la risorsa in Home Assistant

Vai su **Impostazioni** → **Dashboard** → **Risorse** (in alto a destra) e aggiungi:

- **URL**: `/local/dynamic-config/dynamic-config-card.js`
- **Tipo**: `JavaScript Module`

Oppure aggiungi questa configurazione a `configuration.yaml`:

```yaml
lovelace:
  mode: yaml
  resources:
    - url: /local/dynamic-config/dynamic-config-card.js
      type: module
```

### 3. Aggiungi la Card al Dashboard

Vai in modalità modifica del dashboard e aggiungi una nuova card con questo YAML:

```yaml
type: custom:dynamic-config-card
```

## Utilizzo dell'Interfaccia UI

### 📋 Tab Lista
Visualizza tutte le configurazioni esistenti con:
- Badge colorato che indica il tipo (Standard/Orario/Tempo)
- Nome e valore della configurazione
- Metadati (priorità, validità, giorni)
- Pulsante per eliminare

### ⚙️ Tab Standard
Crea configurazioni base:
- **Nome**: Identificatore univoco (es. `temperatura_target`)
- **Valore**: Il valore della configurazione (es. `22`)
- **Priorità**: Numero da 1 a 999 (più basso = maggiore priorità)

### 🕐 Tab Orario
Crea configurazioni valide in fasce orarie:
- **Nome**: Identificatore della configurazione
- **Valore**: Valore da applicare nella fascia oraria
- **Dalle/Alle**: Orari in formato decimale (es. 8.30 = 08:30, 18.00 = 18:00)
- **Giorni**: Seleziona i giorni della settimana (Lun-Dom)

**Esempio**: Temperatura ridotta dalle 22:00 alle 06:00 solo nei giorni feriali

### 📅 Tab Tempo
Crea configurazioni valide in intervalli di date:
- **Nome**: Identificatore della configurazione
- **Valore**: Valore da applicare nel periodo
- **Data/Ora Inizio**: Quando inizia la validità
- **Data/Ora Fine**: Quando finisce la validità

**Esempio**: Temperatura economica durante le vacanze natalizie

## Esempio Completo

### 1. Configura Temperatura Standard
```
Nome: temperatura_clima
Valore: 21
Priorità: 99
```

### 2. Aggiungi Temperatura Notte (Tutti i giorni)
```
Nome: temperatura_clima
Valore: 18
Dalle: 22.00
Alle: 6.00
Giorni: ✓ Tutti selezionati
```

### 3. Aggiungi Temperatura Economica Weekend
```
Nome: temperatura_clima
Valore: 19
Dalle: 0.00
Alle: 23.59
Giorni: ✓ Sabato ✓ Domenica
```

### 4. Aggiungi Temperatura Vacanze
```
Nome: temperatura_clima
Valore: 16
Data Inizio: 2025-12-20 00:00
Data Fine: 2026-01-10 23:59
```

## Priorità Automatica

Il sistema applica automaticamente la configurazione con priorità più alta:

1. **Configurazione a Tempo** (se l'intervallo è valido)
2. **Configurazione a Orario** (se la fascia oraria e i giorni sono validi)
3. **Configurazione Standard** (default)

## Utilizzo in Automazioni

Il sensore `sensor.dynamic_config_temperatura_clima` rifletterà automaticamente il valore corretto:

```yaml
automation:
  - alias: "Aggiorna Temperatura"
    trigger:
      - platform: state
        entity_id: sensor.dynamic_config_temperatura_clima
    action:
      - service: climate.set_temperature
        target:
          entity_id: climate.termostato
        data:
          temperature: "{{ states('sensor.dynamic_config_temperatura_clima') | float }}"
```

## Servizi da Interfaccia UI

Tutti i servizi sono ora accessibili anche dall'interfaccia **Strumenti per Sviluppatori** → **Servizi**:

- `dynamic_config.set_config`
- `dynamic_config.set_schedule_config`
- `dynamic_config.set_time_config`
- `dynamic_config.delete_config`
- `dynamic_config.get_configurations`

## Giorni della Settimana

I giorni seguono la numerazione Python:
- 0 = Lunedì
- 1 = Martedì
- 2 = Mercoledì
- 3 = Giovedì
- 4 = Venerdì
- 5 = Sabato
- 6 = Domenica

## Troubleshooting

### La card non appare
1. Verifica che il file JS sia in `www/dynamic-config/dynamic-config-card.js`
2. Controlla di aver registrato la risorsa
3. Ricarica completamente il browser (Ctrl+F5)

### Errore "Servizio non disponibile"
1. Verifica che il componente sia configurato in `configuration.yaml`
2. Riavvia Home Assistant
3. Controlla i log per errori

### Le configurazioni non si aggiornano
1. Verifica che `scan_interval` non sia troppo alto (default: 60 secondi)
2. Controlla che i formati di data/ora siano corretti
3. Riavvia l'integrazione
