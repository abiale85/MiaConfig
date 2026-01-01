# MiaConfig - Modular Structure

## Aggiornamenti recenti (gen 2026)
- La vista settimanale usa ora solo la logica backend tramite il servizio `mia_config.simulate_schedule`; nessun calcolo duplicato nel frontend.
- Gli override condizionali sono valutati minuto-per-minuto in base al valore del setup di riferimento simulato per quel momento (non più sul valore corrente).
- Rimossa la funzione legacy `calculateDaySegments` dal frontend: l’unica fonte di verità per le sovrapposizioni è il backend.
- I tooltip nella vista settimanale rispettano il posizionamento sopra/sotto (classe `tooltip-below`).

## 📁 File Structure

```
MiaConfig/
├── www/
│   ├── mia-config-card.js              # Originale (4029 righe - legacy)
│   ├── mia-config-card-modular.js      # Versione modulare principale
│   ├── mia-config-card-bundle.js       # Build finale (generato da Rollup)
│   ├── window-functions.js             # Window functions (180 righe)
│   ├── styles.js                        # CSS styles (450 righe)
│   ├── utils.js                         # Utility functions (70 righe)
│   ├── api-service.js                   # API calls (145 righe)
│   ├── renderers.js                     # UI renderers (400 righe)
│   └── README_MODULES.md                # Documentazione moduli
├── package.json                         # NPM dependencies
├── rollup.config.js                     # Rollup bundler config
└── README_REFACTORING.md                # Questa guida
```

## 🚀 Setup & Usage

### Opzione 1: Sviluppo con Moduli ES6 (Nativo)

Per usare direttamente i moduli ES6 senza build step:

1. In Home Assistant, configura la card per usare la versione modulare:

```yaml
# ui-lovelace.yaml o dashboard
type: custom:mia-config-card
entity_id: sensor.mia_config_temperatura_target
```

2. Assicurati che il file venga servito con `type="module"`:

```yaml
# configuration.yaml
lovelace:
  mode: yaml
  resources:
    - url: /local/mia_config/mia-config-card-modular.js
      type: module  # Importante!
```

⚠️ **Nota**: Questa opzione funziona solo su browser moderni che supportano ES6 modules.

### Opzione 2: Build con Rollup (Produzione)

Per massima compatibilità, usa il bundler:

1. **Installa dipendenze**:
```bash
cd C:\Users\abial\Documents\GitHub\MiaConfig
npm install
```

2. **Build una volta**:
```bash
npm run build
```

Questo genera `www/mia-config-card-bundle.js` (singolo file ottimizzato).

3. **Sviluppo con watch mode**:
```bash
npm run watch
```

Ricompila automaticamente ad ogni modifica.

4. **Usa il bundle in Home Assistant**:
```yaml
# configuration.yaml
lovelace:
  mode: yaml
  resources:
    - url: /local/mia_config/mia-config-card-bundle.js
      type: module
```

## 📦 Vantaggi della Struttura Modulare

### Prima (Monolitico)
- ❌ 4029 righe in un file
- ❌ Difficile trovare codice specifico
- ❌ Merge conflicts frequenti
- ❌ Test complicati
- ❌ Riutilizzo limitato

### Dopo (Modulare)
- ✅ 6 file con responsabilità chiare
- ✅ Ogni modulo <500 righe
- ✅ Facile da testare isolatamente
- ✅ Funzioni riutilizzabili
- ✅ Manutenzione semplificata

## 🔧 Workflow di Sviluppo

### 1. Modifica un Modulo

```bash
# Esempio: modifica utils.js
code www/utils.js
```

### 2. Rebuild Automatico

```bash
npm run watch
# Lascia il terminale aperto, ricompila ad ogni salvataggio
```

### 3. Test in Home Assistant

1. Ricarica la dashboard (F5)
2. Apri DevTools per vedere eventuali errori
3. Testa la funzionalità modificata

### 4. Commit

```bash
git add www/
git commit -m "Refactor: aggiunti override condizionali"
git push
```

## 📝 Modificare il Codice

### Aggiungere una Nuova Funzione Window

In `window-functions.js`:

```javascript
export function initializeWindowFunctions(cardInstance) {
    const card = cardInstance;
    
    // ... existing functions ...
    
    // Nuova funzione
    window.dcMyNewFunction = async (param) => {
        // Usa card instance per accedere a metodi/proprietà
        await card.callMiaConfigService('my_service', { param });
        card.showToast('Operazione completata!');
    };
}
```

### Aggiungere una Nuova Utility

In `utils.js`:

```javascript
export function myNewUtility(input) {
    // Logica riutilizzabile
    return processedOutput;
}
```

Poi in `mia-config-card-modular.js`:

```javascript
import * as utils from './utils.js';

// Usa la nuova utility
const result = utils.myNewUtility(data);
```

### Aggiungere un Nuovo Renderer

In `renderers.js`:

```javascript
export function renderMyNewView(data, container) {
    let html = '<div>';
    // Genera HTML
    html += '</div>';
    container.innerHTML = html;
}
```

### Aggiungere una Nuova API Call

In `api-service.js`:

```javascript
export async function callMyNewService(hass, entityId, params) {
    const serviceData = { ...params };
    if (entityId) {
        serviceData.entity_id = entityId;
    }
    
    const result = await hass.callWS({
        type: 'call_service',
        domain: 'mia_config',
        service: 'my_new_service',
        service_data: serviceData,
        return_response: true
    });
    
    return result.response;
}
```

## 🧪 Testing

### Test Manuale

1. Apri Home Assistant
2. Vai alla dashboard con la card
3. Apri DevTools (F12)
4. Esegui operazioni e verifica:
   - Console per errori
   - Network per chiamate API
   - Behavior della UI

### Test Automatico (Futuro)

Setup con Jest per unit tests:

```javascript
// utils.test.js
import { formatTimeDisplay } from './utils.js';

test('formats decimal time correctly', () => {
    expect(formatTimeDisplay(22.5)).toBe('22:30');
    expect(formatTimeDisplay(22.85)).toBe('22:51');
});
```

## 🐛 Troubleshooting

### Errore: "Cannot use import statement"

**Causa**: Il file non viene servito come modulo ES6.

**Soluzione**: 
```yaml
resources:
  - url: /local/mia_config/mia-config-card-modular.js
    type: module  # <- Aggiungi questo!
```

### Errore: "Failed to fetch module"

**Causa**: Path del file non corretto.

**Soluzione**: Verifica che i file siano in `/config/www/mia_config/` e accessibili via `/local/mia_config/`.

### Errore: "window.dcXXX is not defined"

**Causa**: `initializeWindowFunctions()` non è stato chiamato.

**Soluzione**: Verifica che sia chiamato nel constructor:

```javascript
constructor() {
    super();
    initializeWindowFunctions(this);
}
```

### La card non si aggiorna dopo rebuild

**Causa**: Browser cache.

**Soluzione**: 
1. Hard refresh: Ctrl+Shift+R
2. Oppure disabilita cache in DevTools (F12 → Network → Disable cache)

## 📊 Metriche

### Prima del Refactoring
- **File**: 1
- **Righe totali**: 4029
- **Largest function**: ~500 righe
- **Maintainability Index**: Basso

### Dopo il Refactoring
- **File**: 6 moduli + 1 principale
- **Righe per file**: 70-450 (media ~250)
- **Largest function**: ~100 righe
- **Maintainability Index**: Alto
- **Code Reusability**: Alta

## 🎯 Prossimi Passi

1. ✅ Struttura modulare creata
2. ✅ Build system con Rollup
3. ⏳ Migrazione completa del codice legacy
4. ⏳ Unit tests con Jest
5. ⏳ CI/CD con GitHub Actions
6. ⏳ TypeScript types (opzionale)

## 💡 Best Practices

1. **Un modulo, una responsabilità**: Ogni file ha uno scopo chiaro
2. **Export named, not default**: Usa `export function` invece di `export default`
3. **Immutabilità**: Evita di modificare oggetti passati come parametri
4. **Error handling**: Ogni funzione async deve gestire errori
5. **Documentazione**: Commenta le funzioni complesse

## 📚 Risorse

- [ES6 Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Rollup Documentation](https://rollupjs.org/)
- [Home Assistant Custom Cards](https://developers.home-assistant.io/docs/frontend/custom-ui/lovelace-custom-card)
