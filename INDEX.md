# 📚 Dynamic Config - Indice Documentazione

Benvenuto nella documentazione di **Dynamic Config**!

## 🚦 Inizia Qui

### 🎯 Nuovo Utente? Leggi nell'ordine:

1. **[INSTALLAZIONE_COMPLETATA.md](INSTALLAZIONE_COMPLETATA.md)** ⭐
   - Panoramica completa del progetto
   - Cosa è stato creato
   - Verifica installazione

2. **[QUICK_START.md](QUICK_START.md)** ⚡
   - Installazione in 5 minuti
   - Primo esempio pratico
   - Configurazione base

3. **[UI_GUIDE.md](UI_GUIDE.md)** 🎨
   - Guida all'interfaccia grafica
   - Come usare la card Lovelace
   - Esempi con screenshot testuali

4. **[README.md](README.md)** 📖
   - Documentazione tecnica completa
   - Tutti i servizi disponibili
   - Esempi avanzati

## 📂 Documentazione per Argomento

### 🎓 Guide per Livello

| Livello | Documento | Contenuto |
|---------|-----------|-----------|
| Principiante | [QUICK_START.md](QUICK_START.md) | Setup base e primo utilizzo |
| Intermedio | [UI_GUIDE.md](UI_GUIDE.md) | Interfaccia UI completa |
| Avanzato | [README.md](README.md) | API, servizi, automazioni |
| Sviluppatore | [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | Architettura e codice |

### 📋 Guide per Funzionalità

#### Configurazioni
- **Standard**: [README.md - Servizi](README.md#servizi)
- **A Orario**: [UI_GUIDE.md - Tab Orario](UI_GUIDE.md#-tab-orario)
- **A Tempo**: [UI_GUIDE.md - Tab Tempo](UI_GUIDE.md#-tab-tempo)
- **Giorni Settimana**: [CHANGELOG.md - Giorni](CHANGELOG.md#️-selezione-giorni-della-settimana)

#### Interfaccia
- **Installazione Card**: [UI_GUIDE.md - Installazione](UI_GUIDE.md#installazione-card-lovelace)
- **Uso della Card**: [UI_GUIDE.md - Utilizzo](UI_GUIDE.md#utilizzo-dellinterfaccia-ui)
- **Troubleshooting UI**: [UI_GUIDE.md - Problemi](UI_GUIDE.md#troubleshooting)

#### Integrazione
- **Servizi YAML**: [README.md - Servizi](README.md#servizi)
- **Automazioni**: [automations.yaml.example](automations.yaml.example)
- **Sensori**: [README.md - Sensori](README.md#sensori)

## 🗂️ Tutti i Documenti

### 📘 Documentazione Principale

| File | Descrizione | Quando Leggerlo |
|------|-------------|-----------------|
| [INSTALLAZIONE_COMPLETATA.md](INSTALLAZIONE_COMPLETATA.md) | Riepilogo installazione | Dopo la creazione |
| [QUICK_START.md](QUICK_START.md) | Guida rapida 5 minuti | Per iniziare subito |
| [README.md](README.md) | Documentazione completa | Per approfondire |
| [UI_GUIDE.md](UI_GUIDE.md) | Guida interfaccia UI | Per usare la card |
| [CHANGELOG.md](CHANGELOG.md) | Modifiche e novità | Per sapere cosa c'è di nuovo |
| [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) | Architettura progetto | Per sviluppatori |

### 📝 File di Esempio

| File | Descrizione | Come Usarlo |
|------|-------------|-------------|
| [configuration.yaml.example](configuration.yaml.example) | Config base | Copia in configuration.yaml |
| [automations.yaml.example](automations.yaml.example) | Esempi automazioni | Copia/adatta le tue automazioni |

### 📦 File Tecnici

| File | Descrizione | Tipo |
|------|-------------|------|
| `__init__.py` | Core componente | Python |
| `database.py` | Gestione database | Python |
| `sensor.py` | Platform sensori | Python |
| `const.py` | Costanti | Python |
| `panel.py` | Panel UI setup | Python |
| `manifest.json` | Metadata | JSON |
| `services.yaml` | Definizioni servizi | YAML |
| `www/dynamic-config/dynamic-config-card.js` | Custom card | JavaScript |

## 🎯 Guide per Caso d'Uso

### Gestione Temperatura
1. Leggi: [QUICK_START.md - Caso d'Uso Completo](QUICK_START.md#-caso-duso-completo)
2. Esempio: [automations.yaml.example - Temperatura](automations.yaml.example)
3. Approfondisci: [README.md - Esempio 1](README.md#esempio-1-temperatura-climatizzatore)

### Gestione Luci
1. Esempio base: [README.md - Esempio 3](README.md#esempio-3-brightness-luci)
2. Con giorni: [CHANGELOG.md - Luci Venerdì](CHANGELOG.md#luci-diverse-venerdì-sera)

### Automazioni Complesse
1. Leggi: [README.md - Utilizzo in Automazione](README.md#esempio-2-utilizzo-in-automazione)
2. Esempi: [automations.yaml.example](automations.yaml.example)

## 🔍 Ricerca Rapida

### Problemi Comuni
- **Card non appare**: [UI_GUIDE.md - Troubleshooting](UI_GUIDE.md#troubleshooting)
- **Servizi mancanti**: [QUICK_START.md - Problemi Comuni](QUICK_START.md#problemi-comuni)
- **Sensori non creati**: [README.md - Troubleshooting](README.md#troubleshooting)

### Domande Frequenti

**Q: Come installo l'interfaccia UI?**  
A: [UI_GUIDE.md - Installazione](UI_GUIDE.md#installazione-card-lovelace)

**Q: Come funziona la priorità?**  
A: [README.md - Logica di Priorità](README.md#logica-di-priorità)

**Q: Come seleziono i giorni della settimana?**  
A: [UI_GUIDE.md - Tab Orario](UI_GUIDE.md#-tab-orario)

**Q: Come uso i sensori nelle automazioni?**  
A: [README.md - Esempio 2](README.md#esempio-2-utilizzo-in-automazione)

**Q: Formato orari?**  
A: Decimale: 8.30 = 08:30, 14.15 = 14:15

**Q: Formato giorni?**  
A: 0=Lun, 1=Mar, 2=Mer, 3=Gio, 4=Ven, 5=Sab, 6=Dom

## 📊 Riferimenti Tecnici

### API
- **Servizi**: [services.yaml](services.yaml)
- **Database**: [PROJECT_STRUCTURE.md - Database](PROJECT_STRUCTURE.md#️-database)
- **Sensori**: [sensor.py](sensor.py)

### Sviluppo
- **Architettura**: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
- **Flusso**: [PROJECT_STRUCTURE.md - Flusso](PROJECT_STRUCTURE.md#-flusso-di-lavoro)
- **Entry Points**: [PROJECT_STRUCTURE.md - Entry Points](PROJECT_STRUCTURE.md#-entry-points)

## 🎓 Percorsi di Apprendimento

### Path 1: Utente Base (15 minuti)
1. [INSTALLAZIONE_COMPLETATA.md](INSTALLAZIONE_COMPLETATA.md) (2 min)
2. [QUICK_START.md](QUICK_START.md) (5 min)
3. Installa e prova (8 min)

### Path 2: Utente Avanzato (30 minuti)
1. Path 1
2. [UI_GUIDE.md](UI_GUIDE.md) (10 min)
3. [README.md - Esempi](README.md#esempi-di-utilizzo) (10 min)
4. [automations.yaml.example](automations.yaml.example) (10 min)

### Path 3: Power User (1 ora)
1. Path 2
2. [README.md](README.md) completo (20 min)
3. [CHANGELOG.md](CHANGELOG.md) (5 min)
4. Sperimentazione (5 min)

### Path 4: Sviluppatore (2+ ore)
1. Path 3
2. [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) (30 min)
3. Lettura codice (1+ ore)

## 📱 Accesso Rapido

### Configurazione
```yaml
# configuration.yaml
dynamic_config:
  db_path: "config/dynamic_config.db"
  scan_interval: 60
```

### Card UI
```yaml
# dashboard
type: custom:dynamic-config-card
```

### Risorsa
```yaml
# resources
url: /local/dynamic-config/dynamic-config-card.js
type: module
```

## 🆘 Supporto

Per aiuto, consulta nell'ordine:

1. Questo indice (cerca argomento)
2. [QUICK_START.md - Problemi Comuni](QUICK_START.md#problemi-comuni)
3. [UI_GUIDE.md - Troubleshooting](UI_GUIDE.md#troubleshooting)
4. [README.md - Troubleshooting](README.md#troubleshooting)
5. [CHANGELOG.md](CHANGELOG.md) per novità recenti

## 📌 Link Utili

- **Home**: [INSTALLAZIONE_COMPLETATA.md](INSTALLAZIONE_COMPLETATA.md)
- **Quick Start**: [QUICK_START.md](QUICK_START.md)
- **UI**: [UI_GUIDE.md](UI_GUIDE.md)
- **Completo**: [README.md](README.md)
- **Modifiche**: [CHANGELOG.md](CHANGELOG.md)
- **Struttura**: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

---

**Tip**: Salva questo file nei preferiti per accesso rapido alla documentazione!

**Versione**: 1.0.0  
**Ultimo aggiornamento**: 30 Novembre 2025
