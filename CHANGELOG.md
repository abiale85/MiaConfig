# 📋 Changelog - Dynamic Config v1.0.0

## ✨ Nuove Funzionalità

### 🗓️ Selezione Giorni della Settimana
- Aggiunto supporto per selezionare i giorni della settimana nelle configurazioni a orario
- Puoi ora specificare se una configurazione è valida solo in giorni specifici (es. solo weekend, solo feriali)
- Campo `days_of_week` nella tabella `configurazioni_a_orario`
- Formato: lista di numeri (0=Lunedì, 6=Domenica)
- Default: tutti i giorni se non specificato

**Esempio**:
```yaml
service: dynamic_config.set_schedule_config
data:
  setup_name: "temperatura_target"
  setup_value: "20"
  valid_from_ora: 8.00
  valid_to_ora: 18.00
  days_of_week: ["0", "1", "2", "3", "4"]  # Solo Lun-Ven
```

### 🎨 Interfaccia UI Completa
- **Custom Card Lovelace** per gestire tutte le configurazioni tramite interfaccia grafica
- Nessun bisogno di scrivere YAML manualmente
- 4 tab organizzati:
  - **📋 Lista**: Visualizza tutte le configurazioni esistenti
  - **⚙️ Standard**: Crea configurazioni base
  - **🕐 Orario**: Crea configurazioni per fasce orarie con selezione giorni
  - **📅 Tempo**: Crea configurazioni per intervalli di date
- Badge colorati per identificare il tipo di configurazione
- Eliminazione configurazioni con un click
- Notifiche toast per feedback immediato

**Installazione**:
1. Registra la risorsa: `/local/dynamic-config/dynamic-config-card.js`
2. Aggiungi la card: `type: custom:dynamic-config-card`

### 🔍 Nuovo Servizio: get_configurations
- Recupera programmaticamente le configurazioni esistenti
- Supporta filtro per nome specifico o tutte le configurazioni
- Restituisce risposta strutturata utilizzabile in script/automazioni

**Esempio**:
```yaml
service: dynamic_config.get_configurations
data:
  setup_name: "temperatura_clima"  # Opzionale
response_variable: configs
```

## 🔧 Miglioramenti Tecnici

### Database
- Aggiunto campo `days_of_week` alla tabella `configurazioni_a_orario`
- Schema di default: `'0,1,2,3,4,5,6'` (tutti i giorni)
- Retrocompatibile con database esistenti

### Logica di Priorità
- Migliorata per considerare i giorni della settimana
- Una configurazione a orario è attiva solo se:
  1. L'ora corrente è nella fascia specificata
  2. Il giorno corrente è nei giorni selezionati

### Servizi
- Aggiornato `set_schedule_config` per accettare `days_of_week`
- Supporto sia per string che per array di numeri
- Validazione dei giorni (0-6)

### Attributi Sensori
- Aggiunto attributo `days_of_week` ai sensori per configurazioni a orario
- Migliorata visualizzazione degli attributi nelle card

## 📁 Struttura File

```
custom_components/dynamic_config/
├── __init__.py              # Componente principale + servizi
├── const.py                 # Costanti
├── database.py              # Gestione database SQLite
├── sensor.py                # Platform sensori
├── panel.py                 # Panel UI (opzionale)
├── manifest.json            # Metadata componente
├── services.yaml            # Definizione servizi
├── README.md                # Documentazione completa
├── QUICK_START.md           # Guida rapida
├── UI_GUIDE.md              # Guida interfaccia UI
├── configuration.yaml.example
└── automations.yaml.example

www/dynamic-config/
└── dynamic-config-card.js   # Custom Lovelace card
```

## 🗄️ Schema Database

### Tabella: configurazioni
```sql
CREATE TABLE configurazioni (
    setup_name TEXT PRIMARY KEY NOT NULL,
    setup_value TEXT,
    priority INTEGER NOT NULL DEFAULT 99
)
```

### Tabella: configurazioni_a_orario (AGGIORNATA)
```sql
CREATE TABLE configurazioni_a_orario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setup_name TEXT NOT NULL,
    setup_value TEXT,
    valid_from_ora REAL NOT NULL,
    valid_to_ora REAL,
    days_of_week TEXT DEFAULT '0,1,2,3,4,5,6'  -- ✨ NUOVO
)
```

### Tabella: configurazioni_a_tempo
```sql
CREATE TABLE configurazioni_a_tempo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setup_name TEXT NOT NULL,
    setup_value TEXT,
    valid_from_date DATETIME NOT NULL,
    valid_to_date DATETIME
)
```

## 🎯 Casi d'Uso Nuovi

### Temperatura Diversa Weekend
```yaml
# Temperatura feriale
service: dynamic_config.set_schedule_config
data:
  setup_name: "temp"
  setup_value: "21"
  valid_from_ora: 6.00
  valid_to_ora: 22.00
  days_of_week: ["0", "1", "2", "3", "4"]

# Temperatura weekend
service: dynamic_config.set_schedule_config
data:
  setup_name: "temp"
  setup_value: "23"
  valid_from_ora: 6.00
  valid_to_ora: 22.00
  days_of_week: ["5", "6"]
```

### Luci Diverse Venerdì Sera
```yaml
# Normale giorni feriali
service: dynamic_config.set_schedule_config
data:
  setup_name: "brightness"
  setup_value: "60"
  valid_from_ora: 19.00
  valid_to_ora: 23.00
  days_of_week: ["0", "1", "2", "3"]  # Lun-Gio

# Festa venerdì
service: dynamic_config.set_schedule_config
data:
  setup_name: "brightness"
  setup_value: "100"
  valid_from_ora: 19.00
  valid_to_ora: 2.00
  days_of_week: ["4"]  # Solo venerdì
```

## 🔄 Migrazione da Versione Precedente

Se avevi già installato il componente senza i giorni della settimana:

1. **Non serve fare nulla!** Il database viene aggiornato automaticamente
2. Le configurazioni esistenti avranno `days_of_week = '0,1,2,3,4,5,6'` (tutti i giorni)
3. Il comportamento rimane identico per le configurazioni esistenti

## 📝 Note di Sviluppo

### Priorità Giorni
- 0 = Lunedì (Python weekday standard)
- 6 = Domenica
- Stored come string CSV: `"0,1,2,3,4,5,6"`
- Convertito in lista di int per la validazione

### UI Card
- Tecnologia: Vanilla JavaScript (Web Components)
- Compatibile con Home Assistant 2023.1+
- Usa hass.callService() per l'integrazione
- Responsive design
- Supporto dark/light mode automatico

## 🐛 Bug Fix
- Nessuno in questa versione (release iniziale)

## 🔮 Roadmap Futuro

Possibili funzionalità future:
- [ ] Import/Export configurazioni in JSON
- [ ] Template support per valori dinamici
- [ ] Configurazioni per profilo utente
- [ ] Storia delle modifiche
- [ ] Notifiche quando una configurazione cambia
- [ ] Dashboard dedicato (invece di card)
- [ ] Integrazione con calendari

## 📞 Supporto

Per domande, bug o richieste di funzionalità:
- Leggi [README.md](README.md) per la documentazione completa
- Leggi [QUICK_START.md](QUICK_START.md) per iniziare velocemente
- Leggi [UI_GUIDE.md](UI_GUIDE.md) per l'interfaccia utente

## 📜 Licenza

MIT License

---

**Versione**: 1.0.0  
**Data**: 30 Novembre 2025  
**Compatibilità**: Home Assistant 2023.1+
