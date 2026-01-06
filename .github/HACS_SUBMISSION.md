# HACS Default Repository Submission

Questa guida spiega come sottomettere MiaConfig al repository default di HACS.

## Prerequisiti

Il repository MiaConfig ha già tutti i requisiti necessari:
- ✅ `hacs.json` presente e configurato
- ✅ `manifest.json` con tutte le informazioni richieste
- ✅ `README.md` con documentazione completa
- ✅ Release pubblicate su GitHub
- ✅ Integrazione funzionante e testata

## Processo di Submission

### Metodo 1: Tramite GitHub Web (Consigliato)

1. **Vai al repository HACS default**:
   https://github.com/hacs/default

2. **Clicca su Fork** (in alto a destra)

3. **Modifica il file `integration`**:
   - Naviga al file `integration` nel tuo fork
   - Clicca su "Edit this file" (icona matita)
   - Aggiungi `"abiale85/MiaConfig",` alla lista in ordine alfabetico
   - La riga dovrebbe essere inserita dopo `"abiale12/ha_aruba_acs"` o simile
   - Assicurati che ci sia una virgola alla fine

4. **Commit delle modifiche**:
   - Titolo: `Add abiale85/MiaConfig integration`
   - Descrizione:
   ```
   Adding MiaConfig - Dynamic Configuration Management for Home Assistant
   
   Repository: https://github.com/abiale85/MiaConfig
   Version: 2.1.0-beta.2
   
   MiaConfig is a custom integration that provides dynamic configuration management
   with time-based, schedule-based, and conditional overrides with priority system.
   
   Features:
   - Multi-instance support
   - Standard, time, schedule, and conditional configurations
   - Advanced priority system
   - Complete UI with Lovelace card
   - Backup management
   - Full history tracking
   ```

5. **Crea la Pull Request**:
   - Clicca su "Contribute" → "Open pull request"
   - Titolo: `Add abiale85/MiaConfig integration`
   - Usa la stessa descrizione del commit
   - Invia la PR

### Metodo 2: Tramite Command Line

```bash
# 1. Fork del repository (dal browser GitHub)
# Poi clona il tuo fork:
git clone https://github.com/abiale85/default.git
cd default

# 2. Crea un branch per la modifica
git checkout -b add-miaconfig

# 3. Leggi il file integration e trova la posizione corretta
cat integration | grep -i "abiale"

# 4. Modifica il file integration aggiungendo la riga:
# Inserisci "abiale85/MiaConfig", nella posizione alfabetica corretta

# 5. Commit e push
git add integration
git commit -m "Add abiale85/MiaConfig integration"
git push origin add-miaconfig

# 6. Crea la PR dal browser GitHub
```

## Riga da Aggiungere

Cerca la posizione corretta (in ordine alfabetico) e aggiungi:

```json
"abiale85/MiaConfig",
```

**Nota**: La riga deve avere una virgola alla fine!

## Checklist Pre-Submission

Prima di inviare la PR, verifica che:

- [ ] Il repository sia pubblico
- [ ] Ci sia almeno una release pubblicata
- [ ] Il file `hacs.json` sia presente e valido
- [ ] Il file `manifest.json` sia presente e valido
- [ ] Il `README.md` contenga documentazione chiara
- [ ] L'integrazione sia funzionante e testata
- [ ] Non ci siano conflitti con integrazioni esistenti

## Dopo la Submission

1. **Attendi il review**: Il team HACS esaminerà la PR
2. **Rispondi ai feedback**: Se ci sono richieste di modifiche
3. **Merge**: Una volta approvata, la PR verrà merged
4. **Disponibile in HACS**: L'integrazione sarà disponibile in HACS entro 24-48 ore

## Validation Automatica

HACS esegue validation automatica che controlla:
- Formato JSON del file integration
- Esistenza del repository
- Presenza di hacs.json e manifest.json
- Validità dei file di configurazione

Se la validation fallisce, il bot HACS commenterà sulla PR con i dettagli.

## Link Utili

- HACS Default Repository: https://github.com/hacs/default
- HACS Documentation: https://hacs.xyz/
- Repository Requirements: https://hacs.xyz/docs/publish/integration

## Supporto

Se hai problemi con la submission:
- Apri un issue su https://github.com/hacs/default/issues
- Chiedi aiuto su Discord HACS: https://discord.gg/apgchf8
