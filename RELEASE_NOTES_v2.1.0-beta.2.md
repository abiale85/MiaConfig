# Release Notes v2.1.0-beta.2

## 🐛 Bugfix Release - 6 Gennaio 2026

Questa versione beta risolve problemi critici nell'interfaccia utente relativi all'accesso al Shadow DOM nei custom elements.

### 🔧 Correzioni Principali

#### 1. **Modal Edit Sovrapposti** ✅
**Problema**: Quando si cliccava su "edit" (✏️) all'interno del modal di inserimento, il modal di modifica appariva dietro invece che in primo piano.

**Causa**: Entrambi i modali avevano lo stesso z-index (9999) e non c'era gestione della chiusura automatica.

**Soluzione**:
- Aggiunta chiusura automatica del modal "add" quando si apre "edit"
- Z-index modal edit aumentato a 10000
- Ora il tasto edit funziona correttamente

#### 2. **Popup Vista Settimanale** ✅
**Problema**: Cliccando sulle barre colorate nella vista settimanale, il popup con i dettagli non si apriva.

**Causa**: La funzione `dcShowWeeklyEventModal` usava `this.content.querySelector()`, ma quando chiamata da `onclick` HTML, `this` non puntava al componente custom element.

**Soluzione**:
- Modificata per usare `barElement.closest('mia-config-card')` per risalire al componente
- Accesso corretto al shadowRoot per trovare gli elementi del modal
- Il popup ora si apre correttamente con tutti i dettagli

#### 3. **Collapse Gruppi Override** ✅
**Problema**: Cliccando sull'intestazione dei gruppi override, il contenuto non si espandeva/collassava.

**Causa**: Stesso problema di scope con `this` nella funzione `dcToggleOverrideGroup`.

**Soluzione**:
- Passaggio dell'elemento DOM cliccato come parametro
- Utilizzo di `closest()` per trovare il componente
- Il collapse ora funziona correttamente

### 🎨 Miglioramenti UI/UX

#### Ottimizzazione Mobile
**Pulsanti compatti**: Per migliorare l'usabilità su dispositivi mobili:
- **"Elimina Tutto"** → **🗑️** (con tooltip)
- **"Inserisci"** → **➕** (con tooltip)
- Padding ottimizzato per una interfaccia più pulita

### 📝 Note Tecniche

Tutti i fix di questa versione riguardano problemi di scope nelle funzioni `window.*` chiamate da `onclick` inline nell'HTML. La soluzione adottata è:
1. Passare l'elemento DOM come parametro
2. Usare `element.closest('mia-config-card')` per trovare il componente
3. Accedere al `shadowRoot` per query selector degli elementi

### 🔄 Upgrade da v2.1.0-beta.1

L'upgrade è automatico tramite HACS. Assicurarsi di:
1. Aggiornare l'integrazione da HACS
2. Ricaricare Home Assistant
3. Fare hard refresh del browser (Ctrl+F5) per ricaricare la card JavaScript

### 📦 File Modificati

- `manifest.json` - Versione aggiornata a 2.1.0-beta.2
- `www/mia-config-card.js` - Correzioni shadow DOM e UI mobile
- `CHANGELOG.md` - Documentazione completa delle modifiche

### 🐛 Bug Noti

Nessun bug critico noto in questa versione.

### 🚀 Prossimi Passi

Questa è la seconda beta della versione 2.1.0. Dopo un periodo di testing, verrà rilasciata la versione stabile 2.1.0.

---

**Versioni componenti**:
- Integrazione: 2.1.0-beta.2
- Card UI: 2.1.0-beta.2

Per segnalare problemi: https://github.com/abiale85/MiaConfig/issues
