# Release Notes - v2.3.4

## 🐛 Bug Fixes

### Weekly View - Configurazioni Temporali
- **Risolto:** Buchi bianchi nella vista settimanale per le configurazioni a tempo
- **Causa:** Il frontend confrontava erroneamente timestamp completi (con ore) invece di solo le date
- **Soluzione:** Confronto corretto basato solo su giorno/mese/anno, ignorando ore/minuti
- **Impatto:** Le configurazioni temporali ora vengono visualizzate correttamente senza interruzioni nella weekly view

### Backend Cleanup
- Rimossi log di debug temporanei utilizzati per l'analisi del problema
- Codice più pulito e performante

## 📊 Technical Details

**File modificati:**
- `www/mia-config-card.js`: Fix confronto date nel rendering weekly view
- `database.py`: Cleanup log debug

**Esempio del fix:**
```javascript
// Prima (ERRATO):
if (parsedDate < fromDate) return; // 2026-01-18 00:00 < 2026-01-18 15:05 → esclusione

// Dopo (CORRETTO):
const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
const parsedDateOnly = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
if (parsedDateOnly < fromDateOnly) return; // 2026-01-18 vs 2026-01-18 → OK
```

## 🔄 Upgrade Notes

Nessuna azione richiesta. Aggiornamento automatico via HACS o manuale.

## 🙏 Credits

Grazie agli utenti per le segnalazioni dettagliate che hanno permesso di identificare e risolvere rapidamente il problema.
