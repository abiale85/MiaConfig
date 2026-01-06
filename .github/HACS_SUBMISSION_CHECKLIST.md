# HACS Submission - Checklist Completo

## ✅ Preparazione Completata

### GitHub Actions Configurate
- [x] HACS Action: `.github/workflows/hacs.yaml` ✓
- [x] Hassfest Action: `.github/workflows/hassfest.yaml` ✓
- [x] Actions committate e pushate ✓

## 🔗 Link Necessari per la PR

### Link alla Release Corrente
```
https://github.com/abiale85/MiaConfig/releases/tag/v2.1.0-beta.2
```

### Link alla HACS Action (verifica che sia verde ✓)
```
https://github.com/abiale85/MiaConfig/actions/workflows/hacs.yaml
```

### Link alla Hassfest Action (verifica che sia verde ✓)
```
https://github.com/abiale85/MiaConfig/actions/workflows/hassfest.yaml
```

## 📋 Template PR per HACS Default

Quando crei la PR su hacs/default, usa questo template:

### Titolo
```
Add abiale85/MiaConfig integration
```

### Descrizione
```markdown
## Checklist

- [x] I've read the [publishing documentation](https://hacs.xyz/docs/publish/start).
- [x] I've added the [HACS action](https://hacs.xyz/docs/publish/action) to my repository.
- [x] I've added the [hassfest action](https://developers.home-assistant.io/blog/2020/04/16/hassfest/) to my repository.
- [x] The actions are passing without any disabled checks in my repository.
- [x] I've added a link to the action run on my repository below in the links section.
- [x] I've created a new release of the repository after the validation actions were run successfully.

## Links

Link to current release: <https://github.com/abiale85/MiaConfig/releases/tag/v2.1.0-beta.2>
Link to successful HACS action (without the `ignore` key): <https://github.com/abiale85/MiaConfig/actions/workflows/hacs.yaml>
Link to successful hassfest action (if integration): <https://github.com/abiale85/MiaConfig/actions/workflows/hassfest.yaml>

## Description

Adding **MiaConfig** - Dynamic Configuration Management for Home Assistant

**Repository**: https://github.com/abiale85/MiaConfig  
**Current Version**: 2.1.0-beta.2

### About MiaConfig

MiaConfig is a custom integration that provides dynamic configuration management with time-based, schedule-based, and conditional overrides with an advanced priority system.

### Key Features

- ✅ **Multi-instance support**: Separate configurations for different environments
- ✅ **Standard configurations**: Default values with customizable priority
- ✅ **Time-based configurations**: Values valid in specific date ranges
- ✅ **Schedule configurations**: Daily time slots with weekday selection
- ✅ **Conditional configurations**: Dynamic values based on entity states
- ✅ **Advanced priority system**: Numerical priorities (1 = highest, 99 = lowest)
- ✅ **Complete UI**: Lovelace card with dashboard, weekly view, and history
- ✅ **Backup management**: Built-in backup/restore functionality
- ✅ **Full history tracking**: Complete audit trail of all changes

### Technical Details

- Tested with Home Assistant 2024.1.0+
- Each instance uses isolated SQLite database
- RESTful API and WebSocket services
- Comprehensive documentation and examples
- Active maintenance and support

### Why Add to HACS Default

This integration provides unique functionality not available in other integrations, offering a flexible configuration management system that complements Home Assistant's automation capabilities.

<!-- tid:73253df5-5376-4e68-8c16-b234da6a2de3 -->
```

## 🚀 Procedura Step-by-Step

### 1. Verifica che le Actions siano passate
1. Vai su https://github.com/abiale85/MiaConfig/actions
2. Verifica che HACS Action abbia il badge verde ✓
3. Verifica che Hassfest Action abbia il badge verde ✓
4. Se ci sono errori, risolvili prima di procedere

### 2. Crea il Fork di hacs/default
1. Vai su https://github.com/hacs/default
2. Clicca su "Fork" in alto a destra
3. Attendi che il fork venga creato

### 3. Modifica il file integration
1. Nel tuo fork, apri il file `integration`
2. Clicca su "Edit this file" (icona matita)
3. Trova la posizione alfabetica corretta (cerca "abiale")
4. Aggiungi questa riga esatta:
   ```json
   "abiale85/MiaConfig",
   ```
5. **IMPORTANTE**: Assicurati che ci sia la virgola alla fine!

### 4. Commit e Proponi le Modifiche
1. Titolo commit: `Add abiale85/MiaConfig integration`
2. Clicca su "Propose changes"

### 5. Crea la Pull Request
1. Clicca su "Create pull request"
2. Copia e incolla il template sopra nel campo descrizione
3. Verifica che tutti i link siano corretti
4. Clicca su "Create pull request" finale

## ⏱️ Timeline Prevista

- **Validation automatica**: Immediata (bot HACS)
- **Review manuale**: 1-7 giorni
- **Merge**: Dopo approvazione
- **Disponibilità in HACS**: 24-48h dopo merge

## 🐛 Troubleshooting

### Se HACS Action fallisce
- Verifica che `hacs.json` sia valido
- Verifica che `manifest.json` sia completo
- Controlla i log della action per errori specifici

### Se Hassfest Action fallisce
- Verifica che `manifest.json` rispetti gli standard HA
- Controlla che tutte le dipendenze siano dichiarate
- Verifica la versione minima di Home Assistant

### Se la PR viene rifiutata
- Leggi attentamente i commenti del reviewer
- Applica le modifiche richieste
- Aggiorna la PR

## 📚 Risorse Utili

- HACS Publishing Guide: https://hacs.xyz/docs/publish/start
- Home Assistant Integration: https://developers.home-assistant.io/docs/creating_integration_manifest
- HACS Discord: https://discord.gg/apgchf8

## ✅ Checklist Finale Prima della Submission

- [ ] HACS Action passa con badge verde
- [ ] Hassfest Action passa con badge verde
- [ ] Release v2.1.0-beta.2 (o successiva) pubblicata
- [ ] Fork di hacs/default creato
- [ ] File integration modificato correttamente
- [ ] Template PR compilato con tutti i link
- [ ] PR creata su hacs/default

---

**Note**: Dopo che la PR viene merged, MiaConfig sarà disponibile automaticamente in HACS per tutti gli utenti di Home Assistant. Non sarà più necessario aggiungere il repository manualmente come custom repository.
