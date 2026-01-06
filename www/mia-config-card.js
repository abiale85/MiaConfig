// Version 2.1.0-beta.6 - Restored v2.0.0 working implementation - 20260106

class MiaConfigCard extends HTMLElement {
    constructor() {
        super();
        // Salva riferimento all'istanza nell'elemento stesso per multi-instance support
        this._instance = this;
        // Mantiene anche variabile globale per compatibilità con funzioni esistenti
        window._miaConfigCardInstance = this;
        // Definisci subito le funzioni window che potrebbero essere chiamate dalla dashboard
        // prima che render() sia completato
        this.initializeWindowFunctions();
    }
    
    set hass(hass) {
        const firstLoad = !this._hass;
        this._hass = hass;
        if (!this.content) {
            // Determina il nome dell'istanza dal primo sensore disponibile
            const instanceName = this.getInstanceName();
            
            this.innerHTML = `
                <ha-card header="${instanceName}">
                    <div class="card-content">
                        <div id="dynamic-config-ui"></div>
                    </div>
                </ha-card>
            `;
            this.content = this.querySelector("#dynamic-config-ui");
            this.configuredEntityId = null; // Entity ID configurato via YAML
            this.render();
            // Assicura che setupEventListeners sia chiamato dopo render
            // per garantire che tutte le funzioni window siano disponibili
            this.setupEventListeners();
        } else if (firstLoad && this.content) {
            // Prima volta che _hass diventa disponibile e content già esiste
            // Carica dashboard se è il tab attivo
            const dashboardTab = window._miaConfigCardInstance.content.querySelector('#dc-tab-dashboard');
            if (dashboardTab && dashboardTab.classList.contains('active')) {
                this.loadDashboard();
            }
        }
    }
    
    getInstanceName() {
        if (!this._hass) return "Mia Config";
        
        // Cerca entity_id configurato via YAML
        if (this._config && this._config.entity_id) {
            const entity = this._hass.states[this._config.entity_id];
            if (entity && entity.attributes.db_name) {
                return entity.attributes.db_name;
            }
        }
        
        // Cerca il primo sensore mia_config disponibile
        for (const entityId in this._hass.states) {
            if (entityId.includes('_main') && entityId.startsWith('sensor.')) {
                const entity = this._hass.states[entityId];
                if (entity.attributes.integration === 'mia_config' && entity.attributes.db_name) {
                    return entity.attributes.db_name;
                }
            }
        }
        
        return "Mia Config";
    }

    static getCardInstance() {
        return window._miaConfigCardInstance;
    }

    setConfig(config) {
        this._config = config;
        // Leggi entity_id dalla configurazione YAML della card
        if (config.entity_id) {
            this.configuredEntityId = config.entity_id;
        }
    }

    generateHourOptions(min, max) {
        let options = '';
        for (let i = min; i <= max; i++) {
            options += `<option value="${i}">${String(i).padStart(2, '0')}</option>`;
        }
        return options;
    }

    generateMinuteOptions() {
        let options = '';
        for (let i = 0; i < 60; i++) {
            options += `<option value="${i}">${String(i).padStart(2, '0')}</option>`;
        }
        return options;
    }

    timeSelectorsToDecimal(hour, minute) {
        // Converte ore e minuti in formato decimale
        // Es: 4 ore e 30 minuti = 4.5, 22 ore e 15 minuti = 22.25
        return hour + (minute / 60);
    }

    formatTimeDisplay(decimalTime) {
        const hours = Math.floor(decimalTime);
        const minutes = Math.round((decimalTime - hours) * 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    getStyles() {
        return `
            <style>
                .mia-config-card .dc-tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 2px solid var(--divider-color); }
                .mia-config-card .dc-tab { padding: 10px 20px; cursor: pointer; background: var(--card-background-color); border: 1px solid var(--divider-color); border-bottom: 3px solid transparent; border-radius: 8px 8px 0 0; font-size: 14px; color: var(--primary-text-color); transition: all 0.2s ease; }
                .mia-config-card .dc-tab:hover { background: var(--secondary-background-color); }
                .mia-config-card .dc-tab.active { border-bottom-color: var(--primary-color); background: var(--primary-background-color); color: var(--primary-color); font-weight: 500; }
                .mia-config-card .dc-tab-content { display: none; }
                .mia-config-card .dc-tab-content.active { display: block; }
                .mia-config-card .dc-form-group { margin-bottom: 16px; }
                .mia-config-card .dc-form-group label { display: block; margin-bottom: 4px; font-weight: 500; font-size: 14px; }
                .mia-config-card .dc-form-group input, .mia-config-card .dc-form-group select { width: 100%; padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color); font-size: 14px; box-sizing: border-box; }
                .mia-config-card .dc-checkbox-group { display: flex; gap: 10px; flex-wrap: wrap; }
                .mia-config-card .dc-checkbox-label { display: flex; align-items: center; gap: 5px; font-size: 14px; }
                .mia-config-card .dc-time-picker { display: flex; gap: 15px; align-items: center; }
                .mia-config-card .dc-time-input { display: flex; gap: 8px; align-items: center; }
                .mia-config-card .dc-time-input select { width: 70px; padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color); font-size: 14px; }
                .mia-config-card .dc-time-separator { font-size: 18px; font-weight: bold; }
                .mia-config-card .dc-time-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .mia-config-card .dc-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; justify-content: center; align-items: center; }
                .mia-config-card .dc-modal.active { display: flex; }
                .mia-config-card .dc-modal-content { background: var(--card-background-color); padding: 20px; border-radius: 8px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; }
                .mia-config-card #dc-add-config-modal .dc-modal-content { max-width: 550px; margin: 0 auto; }
                .mia-config-card .dc-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid var(--divider-color); }
                .mia-config-card .dc-modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: var(--primary-text-color); }
                .mia-config-card .dc-weekly-tooltip { position: relative; cursor: help; }
                .mia-config-card .dc-weekly-tooltip .dc-tooltip-text { visibility: hidden; opacity: 0; width: 300px; max-width: 90vw; background-color: rgba(0,0,0,0.95); color: #fff; text-align: left; border-radius: 6px; padding: 12px; position: absolute; z-index: 999999; left: 50%; bottom: 100%; transform: translateX(-50%); margin-bottom: 8px; font-size: 12px; line-height: 1.5; box-shadow: 0 4px 16px rgba(0,0,0,0.6); pointer-events: none; transition: opacity 0.2s, visibility 0.2s; white-space: normal; }
                .mia-config-card .dc-weekly-tooltip.tooltip-below .dc-tooltip-text { bottom: auto; top: 100%; margin-bottom: 0; margin-top: 8px; }
                .mia-config-card .dc-weekly-tooltip.tooltip-left .dc-tooltip-text { left: 0; transform: translateX(0); }
                .mia-config-card .dc-weekly-tooltip.tooltip-right .dc-tooltip-text { left: auto; right: 0; transform: translateX(0); }
                .mia-config-card .dc-weekly-tooltip:hover .dc-tooltip-text { visibility: visible; opacity: 1; }
                .mia-config-card .dc-weekly-container { overflow-x: auto; margin: 15px 0; position: relative; }
                .mia-config-card .dc-weekly-grid { display: flex; min-width: 1000px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); position: relative; overflow: visible; }
                .mia-config-card .dc-weekly-time-column { width: 60px; flex-shrink: 0; border-right: 2px solid var(--divider-color); background: var(--primary-color); color: white; }
                .mia-config-card .dc-weekly-time-slot { height: 60px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; box-sizing: border-box; border-bottom: 1px solid rgba(255,255,255,0.1); }
                .mia-config-card .dc-weekly-days { display: flex; flex: 1; }
                .mia-config-card .dc-weekly-day-column { flex: 1; position: relative; border-right: 1px solid var(--divider-color); background: #f9f9f9; overflow: visible; min-height: 1490px; }
                .mia-config-card .dc-weekly-day-column:last-child { border-right: none; }
                .mia-config-card .dc-weekly-day-header { height: 50px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--primary-color); color: white; border-bottom: 2px solid var(--divider-color); font-weight: bold; font-size: 12px; position: sticky; top: 0; z-index: 10; }
                .mia-config-card .dc-weekly-day-content { position: relative; height: 1440px; min-height: 1440px; overflow: visible; }
                .mia-config-card .dc-weekly-hour-line { position: absolute; left: 0; right: 0; height: 1px; background: var(--divider-color); pointer-events: none; }
                .mia-config-card .dc-weekly-bar { position: absolute; left: 2px; right: 2px; border-radius: 2px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; cursor: pointer; transition: box-shadow 0.2s; overflow: visible; text-overflow: ellipsis; white-space: nowrap; padding: 0 4px; box-sizing: border-box; border-top: 2px solid rgba(0,0,0,0.3); border-bottom: 2px solid rgba(0,0,0,0.3); z-index: 1; }
                .mia-config-card .dc-weekly-bar:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 9999 !important; }
                .mia-config-card .dc-weekly-bar:focus { outline: 3px solid var(--primary-color); outline-offset: 2px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 9999 !important; }
                .mia-config-card .dc-weekly-bar-time { background: #2196f3; color: white; border-left: 3px solid #0d47a1; border-right: 3px solid #0d47a1; }
                .mia-config-card .dc-weekly-bar-schedule { background: #ff9800; color: white; border-left: 3px solid #e65100; border-right: 3px solid #e65100; }
                .mia-config-card .dc-weekly-bar-conditional { background: #9c27b0; color: white; border-left: 3px solid #7b1fa2; border-right: 3px solid #7b1fa2; }
                .mia-config-card .dc-weekly-bar-standard { background: #4caf50; color: white; border-left: 3px solid #1b5e20; border-right: 3px solid #1b5e20; }
                .mia-config-card .dc-btn { background-color: var(--primary-color); color: var(--text-primary-color, white); border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; }
                .mia-config-card .dc-btn:hover { opacity: 0.9; }
                .mia-config-card .dc-btn-delete { background-color: #f44336; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; }
                .mia-config-card .dc-config-item { border: 1px solid var(--divider-color); border-radius: 4px; padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
                .mia-config-card .dc-config-item.disabled { opacity: 0.5; background: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(128, 128, 128, 0.05) 10px, rgba(128, 128, 128, 0.05) 20px); border-left: 3px solid #999; }
                .mia-config-card .dc-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; margin-right: 8px; }
                .mia-config-card .dc-badge-time { background-color: #e3f2fd; color: #1976d2; }
                .mia-config-card .dc-badge-schedule { background-color: #fff3e0; color: #f57c00; }
                .mia-config-card .dc-badge-standard { background-color: #f5f5f5; color: #616161; }
                .mia-config-card .dc-config-group { margin-bottom: 15px; border: 1px solid var(--divider-color); border-radius: 8px; overflow: hidden; }
                .mia-config-card .dc-config-group-header { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--secondary-background-color); cursor: pointer; user-select: none; }
                .mia-config-card .dc-config-group-header:hover { background: var(--divider-color); }
                .mia-config-card .dc-config-group-title { display: flex; align-items: center; gap: 8px; flex: 1; }
                .mia-config-card .dc-config-group-toggle { font-size: 16px; transition: transform 0.3s ease; color: var(--primary-color); }
                .mia-config-card .dc-config-group-toggle.expanded { transform: rotate(90deg); }
                .mia-config-card .dc-config-group-content { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; }
                .mia-config-card .dc-config-group-content.expanded { max-height: 5000px; }
                .mia-config-card .dc-config-group-inner { padding: 10px; }
                .mia-config-card .dc-dashboard-actions { display: flex; gap: 5px; flex-direction: column; }
                .mia-config-card .dc-dashboard-actions button { white-space: nowrap; }
                @media (max-width: 768px) {
                    .mia-config-card .dc-tabs { flex-wrap: wrap; gap: 8px; justify-content: space-between; }
                    .mia-config-card .dc-tab { flex: 0 0 calc(50% - 4px); max-width: calc(50% - 4px); font-size: 13px; padding: 12px 6px; min-height: 48px; text-align: center; border: 2px solid var(--divider-color); box-sizing: border-box; }
                    .mia-config-card .dc-tab.active { border: 2px solid var(--primary-color); background: var(--primary-color); color: white; }
                    .mia-config-card .dc-btn, .mia-config-card .dc-btn-secondary, .mia-config-card .dc-btn-danger { padding: 10px 12px; font-size: 13px; min-height: 44px; }
                    .mia-config-card .dc-config-item { flex-direction: column; align-items: flex-start; gap: 10px; }
                    .mia-config-card .dc-config-item .dc-btn, .mia-config-card .dc-config-item .dc-btn-delete { min-height: 44px; min-width: 44px; padding: 10px 12px; font-size: 16px; }
                    .mia-config-card .dc-dashboard-actions { flex-direction: row; width: 100%; }
                    .mia-config-card .dc-dashboard-actions button { flex: 1; }
                    .mia-config-card .dc-time-group { grid-template-columns: 1fr; }
                    .mia-config-card input[type="text"], .mia-config-card input[type="time"], .mia-config-card input[type="number"], .mia-config-card select { font-size: 16px !important; padding: 10px !important; min-height: 44px; }
                    .mia-config-card .dc-weekly-container { overflow-x: auto; }
                    .mia-config-card .dc-weekly-grid { min-width: 700px; }
                }
                .mia-config-card .dc-section-header { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: var(--secondary-background-color); cursor: pointer; user-select: none; margin-bottom: 0; border-radius: 4px; margin-top: 15px; transition: background 0.2s ease; }
                .mia-config-card .dc-section-header:hover { background: var(--divider-color); }
                .mia-config-card .dc-section-content { border-left: 3px solid var(--primary-color); margin-bottom: 15px; border-radius: 0 4px 4px 0; }
                .mia-config-card .dc-toggle-arrow { transition: transform 0.3s ease; display: inline-block; }
                
                /* Modal styles (outside mia-config-card scope) */
                #dc-add-config-modal { 
                    display: none; 
                    position: fixed; 
                    top: 0; 
                    left: 0; 
                    width: 100%; 
                    height: 100%; 
                    background: rgba(0,0,0,0.5); 
                    z-index: 9999; 
                    justify-content: center; 
                    align-items: center;
                    font-family: inherit;
                }
                #dc-edit-modal { 
                    display: none; 
                    position: fixed; 
                    top: 0; 
                    left: 0; 
                    width: 100%; 
                    height: 100%; 
                    background: rgba(0,0,0,0.5); 
                    z-index: 10000; 
                    justify-content: center; 
                    align-items: center;
                    font-family: inherit;
                }
                #dc-add-config-modal.active, #dc-edit-modal.active, #dc-weekly-event-modal.active { 
                    display: flex !important; 
                }
                /* Unscoped form styles for modals */
                .dc-form-group {
                    margin-bottom: 16px;
                }
                .dc-form-group label {
                    display: block;
                    margin-bottom: 4px;
                    font-weight: 500;
                    font-size: 14px;
                    color: var(--primary-text-color);
                }
                .dc-form-group input,
                .dc-form-group select,
                .dc-form-group textarea {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--divider-color);
                    border-radius: 4px;
                    background: var(--card-background-color);
                    color: var(--primary-text-color);
                    font-size: 14px;
                    box-sizing: border-box;
                    font-family: inherit;
                }
                .dc-form-group input:focus,
                .dc-form-group select:focus,
                .dc-form-group textarea:focus {
                    outline: none;
                    border-color: var(--primary-color);
                    box-shadow: 0 0 0 2px rgba(var(--rgb-primary-color), 0.1);
                }
                .dc-time-picker {
                    display: flex;
                    gap: 15px;
                    align-items: flex-start;
                }
                .dc-time-input {
                    display: flex;
                    gap: 4px;
                    align-items: center;
                }
                .dc-time-separator {
                    font-weight: bold;
                    color: var(--primary-text-color);
                }
                .dc-checkbox-group {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
                    gap: 8px;
                }
                .dc-checkbox-label {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    font-size: 14px;
                }
                .dc-checkbox-label input[type="checkbox"] {
                    width: auto;
                    margin: 0;
                    cursor: pointer;
                }
                .dc-modal-content {
                    background: var(--card-background-color);
                    border-radius: 8px;
                    max-height: 85vh;
                    overflow-y: auto;
                    box-shadow: 0 5px 33px rgba(0,0,0,0.3);
                    width: 95%;
                    max-width: 600px;
                    color: var(--primary-text-color);
                }
                .dc-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid var(--divider-color);
                    position: sticky;
                    top: 0;
                    background: var(--secondary-background-color);
                }
                .dc-modal-header h3 {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 500;
                }
                .dc-modal-close {
                    background: none;
                    border: none;
                    font-size: 28px;
                    cursor: pointer;
                    padding: 0;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--primary-text-color);
                    transition: background 0.2s;
                }
                .dc-modal-close:hover {
                    background: rgba(0,0,0,0.1);
                    border-radius: 4px;
                }

                @media (max-width: 768px) {
                    .mia-config-card .dc-section-content { padding: 8px 10px !important; }
                    .mia-config-card .dc-tab { padding: 8px 12px; }
                    .mia-config-card .dc-tabs { flex-wrap: wrap; }
                    .mia-config-card .dc-modal-content { width: 98%; padding: 10px; }
                    .mia-config-card #dc-add-config-modal .dc-modal-content { width: 95%; max-width: none; margin: 0 auto; }
                    .mia-config-card .dc-btn { width: 100%; max-width: none; }
                    .mia-config-card .dc-view-mode-toggle { flex-wrap: wrap; }
                    /* Responsive per il nuovo layout del modal */
                    .mia-config-card #dc-add-config-modal .dc-modal-content > div:first-of-type { flex-direction: column; gap: 10px; }
                    .mia-config-card #dc-add-config-modal .dc-modal-content > div:first-of-type > div { flex: none !important; width: 100% !important; }
                    .mia-config-card .dc-form-group[style*="display: flex"] { flex-direction: column; gap: 10px; }
                    .mia-config-card .dc-form-group[style*="display: flex"] > div { flex: none !important; width: 100% !important; }
                }
            </style>
        `;
    }

    render() {
        if (!this._hass) return;

        this.content.innerHTML = `
            ${this.getStyles()}
            <div class="mia-config-card">
            <div class="dc-tabs">
                <button class="dc-tab" onclick="window.dcSwitchTab('dashboard', event)">📊 Dashboard</button>
                <button class="dc-tab" onclick="window.dcSwitchTab('config', event)">⚙️ Configura</button>
                <button class="dc-tab" onclick="window.dcSwitchTab('weekly', event)">📅 Settimanale</button>
                <button class="dc-tab" onclick="window.dcSwitchTab('history', event)">📜 Storico</button>
            </div>

            <div id="dc-tab-dashboard" class="dc-tab-content active">
                <div id="dc-dashboard-content">Caricamento...</div>
            </div>

            <div id="dc-tab-config" class="dc-tab-content">
                <!-- Pulsante per aprire modal inserimento -->
                <div style="margin-bottom: 20px;">
                    <button class="dc-btn" onclick="window.dcOpenAddConfigModal()" style="font-size: 16px; padding: 12px 24px;">➕ Aggiungi Nuova Configurazione</button>
                </div>
                
                <!-- Sezione Configurazioni Database -->
                <div class="dc-section-header" onclick="window.dcToggleSection(this, 'db-config')">
                    <span style="font-size: 18px; font-weight: bold;">🗂️ Configurazioni Database</span>
                    <span class="dc-toggle-arrow" style="float: right; font-size: 14px;">▼</span>
                </div>
                <div id="dc-section-db-config" class="dc-section-content" style="display: block; padding: 10px 12px; border-left: 3px solid var(--warning-color);">
                    <div class="dc-view-mode-toggle" style="margin-bottom: 15px;">
                        <button class="dc-view-btn active" data-mode="name" onclick="window.dcSwitchConfigView('name')">Per Nome</button>
                        <button class="dc-view-btn" data-mode="override" onclick="window.dcSwitchConfigView('override')">Per Override</button>
                    </div>
                    <div id="dc-config-list">Caricamento...</div>
                </div>

                <!-- Sezione Valori Validi -->
                <div class="dc-section-header" onclick="window.dcToggleSection(this, 'valid-values')">
                    <span style="font-size: 18px; font-weight: bold;">✓ Valori Validi</span>
                    <span class="dc-toggle-arrow" style="float: right; font-size: 14px;">▶</span>
                </div>
                <div id="dc-section-valid-values" class="dc-section-content" style="display: none; padding: 15px; border-left: 3px solid var(--success-color);">
                    <p style="color: var(--secondary-text-color); margin-bottom: 15px; font-size: 14px;">
                        Definisci opzionalmente valori consentiti con descrizioni per ogni configurazione
                    </p>
                    <div style="margin-bottom: 15px;">
                        <label style="font-weight: 500;">Seleziona Configurazione:</label>
                        <select id="vv-config-select" onchange="window.dcLoadValidValues()" style="padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color); width: 300px; margin-right: 10px;">
                            <option value="">-- Seleziona --</option>
                        </select>
                        <button class="dc-btn" onclick="window.dcShowAddValidValueForm()">➕ Aggiungi Valore</button>
                    </div>
                    <div id="dc-valid-values-list">Seleziona una configurazione per gestire i valori validi</div>
                    
                    <div id="dc-add-valid-value-form" style="display: none; margin-top: 20px; padding: 15px; border: 2px solid var(--primary-color); border-radius: 8px; background: var(--card-background-color);">
                        <h4 style="margin-top: 0;">Aggiungi Valore Valido</h4>
                        <div style="margin-bottom: 10px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Valore:</label>
                            <input type="text" id="vv-value" placeholder="es. 0, 1, comfort, auto..." style="padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color); width: 100%;">
                        </div>
                        <div style="margin-bottom: 10px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Descrizione (opzionale):</label>
                            <input type="text" id="vv-description" placeholder="es. Spento, Acceso, Modalità comfort..." style="padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color); width: 100%;">
                        </div>
                        <div style="margin-bottom: 10px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Ordinamento:</label>
                            <input type="number" id="vv-sort-order" value="0" min="0" style="padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color); width: 100px;">
                        </div>
                        <button class="dc-btn" onclick="window.dcSaveValidValue()">💾 Salva</button>
                        <button class="dc-btn-secondary" onclick="window.dcHideAddValidValueForm()">❌ Annulla</button>
                    </div>
                </div>
                
                <!-- Sezione Backup e Restore -->
                <div class="dc-section-header" onclick="window.dcToggleSection(this, 'backup-restore')">
                    <span style="font-size: 18px; font-weight: bold;">💾 Backup e Restore</span>
                    <span class="dc-toggle-arrow" style="float: right; font-size: 14px;">▶</span>
                </div>
                <div id="dc-section-backup-restore" class="dc-section-content" style="display: none; padding: 15px; border-left: 3px solid var(--info-color);">
                    <p style="color: var(--secondary-text-color); margin-bottom: 15px; font-size: 14px;">
                        Crea backup del database o ripristina da una versione precedente
                    </p>
                    <div style="display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;">
                        <button class="dc-btn" onclick="window.dcBackupDatabase()" style="flex: 1; min-width: 180px;">📦 Crea Backup</button>
                        <button class="dc-btn" onclick="window.dcShowRestoreForm()" style="flex: 1; min-width: 200px;">📥 Ripristina da Backup</button>
                        <button class="dc-btn" onclick="window.dcRefreshBackupList()" style="flex: 1; min-width: 180px;">🔄 Aggiorna elenco</button>
                        <button class="dc-btn-secondary" onclick="window.dcDeleteAllBackups()" style="flex: 1; min-width: 200px;">🗑️ Elimina tutti i backup</button>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 12px;">
                        <input type="file" id="dc-backup-upload-input" accept=".db" style="flex: 2; min-width: 240px;">
                        <button class="dc-btn" onclick="window.dcUploadBackup()" style="flex: 1; min-width: 160px;">⬆️ Carica backup</button>
                    </div>
                    <div id="dc-backup-status" style="margin-bottom: 10px;"></div>
                    <div id="dc-backup-list" style="border: 1px solid var(--divider-color); border-radius: 8px; padding: 12px; background: var(--card-background-color);">
                        <p style="margin: 0; color: var(--secondary-text-color);">Nessun backup caricato.</p>
                    </div>
                    
                    <div id="dc-restore-form" style="display: none; margin-top: 20px; padding: 15px; border: 2px solid var(--primary-color); border-radius: 8px; background: var(--card-background-color);">
                        <h4 style="margin-top: 0;">Ripristina da Backup</h4>
                        <div style="margin-bottom: 10px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: 500;">Percorso file backup:</label>
                            <input type="text" id="restore-backup-path" placeholder="/config/backups/mia_config/mia_config_backup_YYYYMMDD_HHMMSS.db" style="padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color); width: 100%;">
                        </div>
                        <div style="background: var(--warning-background-color); border-left: 4px solid var(--warning-color); padding: 10px; margin-bottom: 10px; border-radius: 4px;">
                            <strong style="color: var(--warning-color);">⚠️ Attenzione:</strong> Il database attuale sarà salvato come backup prima di ripristinare.
                        </div>
                        <button class="dc-btn" onclick="window.dcRestoreDatabase()">Ripristina</button>
                        <button class="dc-btn-secondary" onclick="window.dcHideRestoreForm()">Annulla</button>
                    </div>
                </div>
            </div>
            
            <div id="dc-tab-weekly" class="dc-tab-content">
                <div style="margin-bottom: 15px;">
                    <label style="font-weight: 500;">Seleziona configurazione:</label>
                    <select id="weekly-config-select" style="padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color); width: 300px;">
                        <option value="">-- Seleziona --</option>
                    </select>
                    <button class="dc-btn" onclick="window.dcLoadWeeklyView()" style="margin-left: 10px;">Visualizza</button>
                </div>
                <div id="dc-weekly-view">Seleziona una configurazione e clicca "Visualizza"</div>
            </div>
            
            <div id="dc-tab-history" class="dc-tab-content">
                <div style="margin-bottom: 15px;">
                    <label style="font-weight: 500;">Filtra per configurazione:</label>
                    <select id="history-filter" style="padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color); width: 300px;">
                        <option value="">-- Tutte le configurazioni --</option>
                    </select>
                    <button class="dc-btn" onclick="window.dcLoadHistory()" style="margin-left: 10px;">Carica Storico</button>
                </div>
                <div id="dc-history-list">Clicca "Carica Storico" per visualizzare</div>
            </div>
            </div>
            
            <!-- Modal per aggiungere nuove configurazioni -->
            <div id="dc-add-config-modal" class="dc-modal">
                <div class="dc-modal-content" style="max-width: 550px; padding: 20px; margin: 0 auto;">
                    <div class="dc-modal-header">
                        <h3>Aggiungi Nuova Configurazione</h3>
                        <button class="dc-modal-close" onclick="window.dcCloseAddConfigModal()">×</button>
                    </div>
                    
                    <div style="margin-bottom: 20px; display: flex; gap: 15px; align-items: end;">
                        <div style="flex: 1;">
                            <label style="font-weight: 500; font-size: 16px;">Seleziona Tipo:</label>
                            <select id="modal-config-type-selector" onchange="window.dcShowModalConfigForm(this.value)" style="width: 100%; padding: 10px; margin-top: 8px; border: 1px solid var(--divider-color); border-radius: 4px;">
                                <option value="standard">⚙️ Standard</option>
                                <option value="schedule">🕐 Override Orario</option>
                                <option value="time">⏰ Override Temporale</option>
                                <option value="conditional">🎯 Override Condizionale</option>
                            </select>
                        </div>
                        <div style="flex: 0 0 150px;">
                            <label style="font-weight: 500; font-size: 16px;">Priorità:</label>
                            <input type="number" id="modal-global-priority" min="1" max="999" value="99" style="width: 100%; padding: 10px; margin-top: 8px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color);">
                        </div>
                    </div>

                    <div id="modal-form-container-standard" class="dc-form-container" style="display: none;">
                    <form id="modal-dc-form-standard">
                        <div class="dc-form-group">
                            <label>Nome Configurazione:</label>
                            <input type="text" name="setup_name" required placeholder="es. temperatura_target">
                        </div>
                        <div class="dc-form-group">
                            <label>Valore:</label>
                            <input type="text" name="setup_value" required placeholder="es. 22">
                        </div>
                        <div class="dc-form-group">
                            <label>Priorità (1-999):</label>
                            <input type="number" name="priority" min="1" max="999" value="99">
                        </div>
                        <div class="dc-form-group">
                            <label>Descrizione (opzionale):</label>
                            <input type="text" name="description" placeholder="Descrizione della configurazione">
                        </div>
                        <button type="submit" class="dc-btn">Salva</button>
                        <button type="button" class="dc-btn-secondary" onclick="window.dcCloseAddConfigModal()" style="margin-left: 10px;">Annulla</button>
                    </form>
                    </div>

                    <div id="modal-form-container-schedule" class="dc-form-container" style="display: none;">
                    <form id="modal-dc-form-schedule">
                        <div class="dc-form-group">
                            <label>Configurazione da Override:</label>
                            <select id="modal-schedule-config-select" name="setup_name" required onchange="window.dcLoadValidValuesForForm('schedule')">
                                <option value="">-- Caricamento... --</option>
                            </select>
                            <small style="color: var(--secondary-text-color);">Seleziona una configurazione standard esistente</small>
                        </div>
                        <div class="dc-form-group">
                            <label>Valore Override:</label>
                            <div id="modal-schedule-value-container">
                                <input type="text" id="modal-schedule-setup-value" name="setup_value" required placeholder="es. 20">
                            </div>
                        </div>
                        <div class="dc-form-group">
                            <label>Fascia Oraria:</label>
                            <div class="dc-time-picker">
                                <div>
                                    <label style="font-size: 12px; margin-bottom: 4px;">Dalle:</label>
                                    <div class="dc-time-input">
                                        <select id="modal-from-hour" required>
                                            ${window._miaConfigCardInstance.generateHourOptions(0, 23)}
                                        </select>
                                        <span class="dc-time-separator">:</span>
                                        <select id="modal-from-minute" required>
                                            ${window._miaConfigCardInstance.generateMinuteOptions()}
                                        </select>
                                    </div>
                                </div>
                                <span style="font-size: 18px; align-self: flex-end; padding-bottom: 8px;">→</span>
                                <div>
                                    <label style="font-size: 12px; margin-bottom: 4px;">Alle:</label>
                                    <div class="dc-time-input">
                                        <select id="modal-to-hour" required>
                                            ${window._miaConfigCardInstance.generateHourOptions(0, 23)}
                                        </select>
                                        <span class="dc-time-separator">:</span>
                                        <select id="modal-to-minute" required>
                                            ${window._miaConfigCardInstance.generateMinuteOptions()}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <small style="color: var(--secondary-text-color); display: block; margin-top: 4px;">
                                💡 Se l'ora di fine è minore dell'inizio (es. 22:00-02:00), l'orario attraversa la mezzanotte
                            </small>
                        </div>
                        <div class="dc-form-group">
                            <label>Giorni della Settimana:</label>
                            <div class="dc-checkbox-group">
                                <label class="dc-checkbox-label"><input type="checkbox" name="days" value="0" checked> Lun</label>
                                <label class="dc-checkbox-label"><input type="checkbox" name="days" value="1" checked> Mar</label>
                                <label class="dc-checkbox-label"><input type="checkbox" name="days" value="2" checked> Mer</label>
                                <label class="dc-checkbox-label"><input type="checkbox" name="days" value="3" checked> Gio</label>
                                <label class="dc-checkbox-label"><input type="checkbox" name="days" value="4" checked> Ven</label>
                                <label class="dc-checkbox-label"><input type="checkbox" name="days" value="5" checked> Sab</label>
                                <label class="dc-checkbox-label"><input type="checkbox" name="days" value="6" checked> Dom</label>
                            </div>
                        </div>
                        <button type="submit" class="dc-btn">Aggiungi Override Orario</button>
                        <button type="button" class="dc-btn-secondary" onclick="window.dcCloseAddConfigModal()" style="margin-left: 10px;">Annulla</button>
                    </form>
                    </div>

                    <div id="modal-form-container-time" class="dc-form-container" style="display: block;">
                    <form id="modal-dc-form-time">
                        <div class="dc-form-group">
                            <label>Configurazione da Override:</label>
                            <select id="modal-time-config-select" name="setup_name" required onchange="window.dcLoadValidValuesForForm('time')">
                                <option value="">-- Caricamento... --</option>
                            </select>
                            <small style="color: var(--secondary-text-color);">Seleziona una configurazione standard esistente</small>
                        </div>
                        <div class="dc-form-group">
                            <label>Valore Override:</label>
                            <div id="modal-time-value-container">
                                <input type="text" id="modal-time-setup-value" name="setup_value" required placeholder="es. 18">
                            </div>
                        </div>
                        <div class="dc-form-group" style="display: flex; gap: 15px;">
                            <div style="flex: 1;">
                                <label>Data/Ora Inizio:</label>
                                <input type="datetime-local" name="valid_from" required>
                            </div>
                            <div style="flex: 1;">
                                <label>Data/Ora Fine:</label>
                                <input type="datetime-local" name="valid_to" required>
                            </div>
                        </div>
                        
                        <hr style="margin: 15px 0; border: none; border-top: 1px solid var(--divider-color);">
                        <h4 style="margin: 10px 0; font-size: 14px;">🎯 Filtri Opzionali</h4>
                        <small style="color: var(--secondary-text-color); display: block; margin-bottom: 10px;">
                            Puoi limitare l'override solo a certi orari o giorni della settimana
                        </small>
                        
                        <div class="dc-form-group">
                            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 0;">
                                <input type="checkbox" id="modal-time-enable-hours" style="margin: 0;">
                                Limita a fascia oraria
                            </label>
                            <div id="modal-time-hours-container" style="display: none; margin-top: 10px;">
                                <div class="dc-time-picker">
                                    <div>
                                        <label style="font-size: 12px; margin-bottom: 4px;">Dalle:</label>
                                        <div class="dc-time-input">
                                            <select id="modal-time-from-hour">${window._miaConfigCardInstance.generateHourOptions(0, 23)}</select>
                                            <span class="dc-time-separator">:</span>
                                            <select id="modal-time-from-minute">${window._miaConfigCardInstance.generateMinuteOptions()}</select>
                                        </div>
                                    </div>
                                    <span style="font-size: 18px; align-self: flex-end; padding-bottom: 8px;">→</span>
                                    <div>
                                        <label style="font-size: 12px; margin-bottom: 4px;">Alle:</label>
                                        <div class="dc-time-input">
                                            <select id="modal-time-to-hour">${window._miaConfigCardInstance.generateHourOptions(0, 23)}</select>
                                            <span class="dc-time-separator">:</span>
                                            <select id="modal-time-to-minute">${window._miaConfigCardInstance.generateMinuteOptions()}</select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="dc-form-group">
                            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 0;">
                                <input type="checkbox" id="modal-time-enable-days" style="margin: 0;">
                                Limita a giorni specifici
                            </label>
                            <div id="modal-time-days-container" style="display: none; margin-top: 10px;">
                                <div class="dc-checkbox-group">
                                    <label class="dc-checkbox-label"><input type="checkbox" name="time-days" value="0" checked> Lun</label>
                                    <label class="dc-checkbox-label"><input type="checkbox" name="time-days" value="1" checked> Mar</label>
                                    <label class="dc-checkbox-label"><input type="checkbox" name="time-days" value="2" checked> Mer</label>
                                    <label class="dc-checkbox-label"><input type="checkbox" name="time-days" value="3" checked> Gio</label>
                                    <label class="dc-checkbox-label"><input type="checkbox" name="time-days" value="4" checked> Ven</label>
                                    <label class="dc-checkbox-label"><input type="checkbox" name="time-days" value="5" checked> Sab</label>
                                    <label class="dc-checkbox-label"><input type="checkbox" name="time-days" value="6" checked> Dom</label>
                                </div>
                            </div>
                        </div>
                        
                        <button type="submit" class="dc-btn">Aggiungi Override Temporale</button>
                        <button type="button" class="dc-btn-secondary" onclick="window.dcCloseAddConfigModal()" style="margin-left: 10px;">Annulla</button>
                    </form>
                    </div>

                    <div id="modal-form-container-conditional" class="dc-form-container" style="display: none;">
                    <form id="modal-dc-form-conditional">
                        <div class="dc-form-group">
                            <label>Configurazione da Override:</label>
                            <select id="modal-conditional-config-select" name="setup_name" required onchange="window.dcLoadValidValuesForForm('conditional')">
                                <option value="">-- Caricamento... --</option>
                            </select>
                            <small style="color: var(--secondary-text-color);">Seleziona una configurazione standard esistente</small>
                        </div>
                        <div class="dc-form-group">
                            <label>Valore Override:</label>
                            <div id="modal-conditional-value-container">
                                <input type="text" id="modal-conditional-setup-value" name="setup_value" required placeholder="es. 18">
                            </div>
                        </div>
                        <div class="dc-form-group">
                            <label>🎯 Condizione Basata Su:</label>
                            <select id="modal-conditional-source-config" name="conditional_config" required onchange="window.dcUpdateConditionalOptions()">
                                <option value="">-- Seleziona configurazione --</option>
                            </select>
                            <small style="color: var(--secondary-text-color);">L'override si attiverà quando questa configurazione ha un valore specifico</small>
                        </div>
                        <div class="dc-form-group" style="display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: end;">
                            <div>
                                <label>Operatore:</label>
                                <select id="modal-conditional-operator" name="conditional_operator" required>
                                    <option value="==">==</option>
                                    <option value="!=">!=</option>
                                    <option value=">">&gt;</option>
                                    <option value="<">&lt;</option>
                                    <option value=">=">&gt;=</option>
                                    <option value="<=">&lt;=</option>
                                </select>
                            </div>
                            <div>
                                <label>Valore di Confronto:</label>
                                <div id="modal-conditional-comparison-container">
                                    <input type="text" id="modal-conditional-comparison-value" name="conditional_value" required placeholder="es. 1">
                                </div>
                            </div>
                        </div>
                        <div style="color: var(--secondary-text-color); font-size: 12px; margin: -5px 0 10px 0;">L'override si attiva se: <strong id="modal-conditional-preview">configurazione operatore valore</strong></div>
                        
                        <div class="dc-form-group">
                            <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 0;">
                                <input type="checkbox" id="modal-conditional-enable-hours" style="margin: 0;">
                                Limita a fascia oraria
                            </label>
                            <div id="modal-conditional-hours-container" style="display: none; margin-top: 10px;">
                                <div class="dc-time-picker">
                                    <div>
                                        <label style="font-size: 12px; margin-bottom: 4px;">Dalle:</label>
                                        <div class="dc-time-input">
                                            <select id="modal-conditional-from-hour">${window._miaConfigCardInstance.generateHourOptions(0, 23)}</select>
                                            <span class="dc-time-separator">:</span>
                                            <select id="modal-conditional-from-minute">${window._miaConfigCardInstance.generateMinuteOptions()}</select>
                                        </div>
                                    </div>
                                    <span style="font-size: 18px; align-self: flex-end; padding-bottom: 8px;">→</span>
                                    <div>
                                        <label style="font-size: 12px; margin-bottom: 4px;">Alle:</label>
                                        <div class="dc-time-input">
                                            <select id="modal-conditional-to-hour">${window._miaConfigCardInstance.generateHourOptions(0, 23)}</select>
                                            <span class="dc-time-separator">:</span>
                                            <select id="modal-conditional-to-minute">${window._miaConfigCardInstance.generateMinuteOptions()}</select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div style="padding: 10px; background: var(--secondary-background-color); border-radius: 4px; margin: 10px 0;">
                            <strong>⚠️ Nota:</strong> Il sistema previene loop infiniti. Non puoi creare dipendenze circolari.
                        </div>
                        <button type="submit" class="dc-btn">Aggiungi Override Condizionale</button>
                        <button type="button" class="dc-btn-secondary" onclick="window.dcCloseAddConfigModal()" style="margin-left: 10px;">Annulla</button>
                    </form>
                    </div>
                </div>
            <!-- Modal per editare configurazioni -->
            <div id="dc-edit-modal" class="dc-modal">
                <div class="dc-modal-content">
                    <div class="dc-modal-header">
                        <h3>Modifica Configurazione</h3>
                        <button class="dc-modal-close" onclick="window.dcCloseEditModal(this)">×</button>
                    </div>
                    <div id="dc-edit-modal-body"></div>
                </div>
            </div>
            
            <!-- Modal per dettagli evento settimanale -->
            <div id="dc-weekly-event-modal" class="dc-modal">
                <div class="dc-modal-content" style="max-width: 500px;">
                    <div class="dc-modal-header">
                        <h3>📅 Dettagli Configurazione</h3>
                        <button class="dc-modal-close" onclick="window.dcCloseWeeklyEventModal(this.closest('mia-config-card'))">×</button>
                    </div>
                    <div id="dc-weekly-event-modal-body" style="line-height: 1.6;"></div>
                </div>
            </div>
            </div>
        `;

        // setupEventListeners() ora è chiamato in set hass dopo render()
        window._miaConfigCardInstance.loadConfigurations();
        this.setDefaultTimeValues();
    }
    
    getSelectedEntityId() {
        // Ritorna l'entity_id configurato nel dashboard, o null per usare l'istanza di default
        return this.configuredEntityId || null;
    }
    
    async callMiaConfigService(serviceName, serviceData) {
        // Wrapper per chiamare servizi mia_config con entity_id automatico
        const entityId = this.getSelectedEntityId();
        if (entityId) {
            serviceData.entity_id = entityId;
        }
        return await this._hass.callService('mia_config', serviceName, serviceData);
    }
    
    setDefaultTimeValues() {
        // Imposta valori di default per data/ora nelle configurazioni a tempo
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const midnight = new Date(today);
        midnight.setDate(midnight.getDate() + 1);
        midnight.setSeconds(0);
        midnight.setMilliseconds(0);
        
        // Formato datetime-local: YYYY-MM-DDTHH:mm
        const formatDateTime = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        };
        
        const validFromInput = window._miaConfigCardInstance.content.querySelector('#modal-dc-form-time input[name="valid_from"]');
        const validToInput = window._miaConfigCardInstance.content.querySelector('#modal-dc-form-time input[name="valid_to"]');
        
        if (validFromInput) validFromInput.value = formatDateTime(now);
        if (validToInput) validToInput.value = formatDateTime(midnight);
    }

    initializeWindowFunctions() {
        // Definisce le funzioni window che possono essere chiamate dalla dashboard
        // anche prima che render() sia completato
        
        window.dcShowWeeklyFor = (setupName) => {
            // Verifica che il contenuto sia renderizzato
            if (!this.window._miaConfigCardInstance.content) {
                setTimeout(() => window.dcShowWeeklyFor(setupName), 100);
                return;
            }
            
            // Passa al tab vista settimanale
            const weeklyTab = window._miaConfigCardInstance.content.querySelector('.dc-tab:nth-child(3)');
            if (weeklyTab) {
                weeklyTab.click();
            }
            
            // Attendi che il tab si carichi e il select sia popolato
            setTimeout(() => {
                const weeklySelect = window._miaConfigCardInstance.content.querySelector('#weekly-config-select');
                if (weeklySelect) {
                    const checkAndLoad = () => {
                        if (weeklySelect.options.length > 1) {
                            weeklySelect.value = setupName;
                            if (typeof window.dcLoadWeeklyView === 'function') {
                                window.dcLoadWeeklyView();
                            } else {
                                console.error('dcLoadWeeklyView non è disponibile');
                            }
                        } else {
                            setTimeout(checkAndLoad, 100);
                        }
                    };
                    checkAndLoad();
                }
            }, 100);
        };
        
        window.dcLoadWeeklyView = async () => {
            if (!this._hass || !this.content) {
                return;
            }
            
            const setupName = window._miaConfigCardInstance.content.querySelector('#weekly-config-select').value;
            if (!setupName) {
                window._miaConfigCardInstance.showToast('Seleziona una configurazione', true);
                return;
            }
            
            try {
                const entityId = this.getSelectedEntityId();
                const serviceData = entityId ? { entity_id: entityId } : {};
                
                const result = await this._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'get_configurations',
                    service_data: serviceData,
                    return_response: true
                });
                
                const configs = result.response || {};
                const setupConfigs = configs[setupName] || [];
                
                if (setupConfigs.length === 0) {
                    window._miaConfigCardInstance.content.querySelector('#dc-weekly-view').innerHTML = '<p>Nessuna configurazione trovata per questo setup</p>';
                    return;
                }
                
                this.renderWeeklyView(setupName, setupConfigs);
            } catch (error) {
                console.error('Error loading weekly view:', error);
                window._miaConfigCardInstance.content.querySelector('#dc-weekly-view').innerHTML = `<p style="color: red;">Errore: ${error.message}</p>`;
            }
        };
        
        // Quick Override è definito più avanti usando i form modal
    }

    setupEventListeners() {
        // Form handlers per modal di inserimento
        const modalStandardForm = window._miaConfigCardInstance.content.querySelector('#modal-dc-form-standard');
        if (modalStandardForm) {
            modalStandardForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const form = e.target;
                const formData = new FormData(form);
                try {
                    const serviceData = {
                        setup_name: formData.get('setup_name'),
                        setup_value: formData.get('setup_value'),
                        priority: parseInt(formData.get('priority'))
                    };
                    const description = formData.get('description');
                    if (description && description.trim()) {
                        serviceData.description = description.trim();
                    }
                    await window._miaConfigCardInstance.callMiaConfigService('set_config', serviceData);
                    form.reset();
                    window.dcCloseAddConfigModal();
                    window._miaConfigCardInstance.showToast('Configurazione salvata!');
                    setTimeout(() => {
                        window._miaConfigCardInstance.loadConfigurations();
                        this.loadConfigsForValidValues();
                    }, 500);
                } catch (err) {
                    console.error('Errore salvataggio:', err);
                    window._miaConfigCardInstance.showToast('Errore: ' + err.message, true);
                }
            });
        }
        
        const modalScheduleForm = window._miaConfigCardInstance.content.querySelector('#modal-dc-form-schedule');
        if (modalScheduleForm) {
            modalScheduleForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const form = e.target;
                const setupName = window._miaConfigCardInstance.content.querySelector('#modal-schedule-config-select').value;
                const setupValue = window._miaConfigCardInstance.content.querySelector('#modal-schedule-setup-value').value;
                const fromHour = window._miaConfigCardInstance.content.querySelector('#modal-from-hour').value;
                const fromMinute = window._miaConfigCardInstance.content.querySelector('#modal-from-minute').value;
                const toHour = window._miaConfigCardInstance.content.querySelector('#modal-to-hour').value;
                const toMinute = window._miaConfigCardInstance.content.querySelector('#modal-to-minute').value;
                const selectedDays = Array.from(window._miaConfigCardInstance.content.querySelectorAll('#modal-dc-form-schedule input[name="days"]:checked')).map(el => el.value);
                const priority = window._miaConfigCardInstance.content.querySelector('#modal-global-priority').value;
                try {
                    const validFromOra = parseFloat(fromHour) + parseFloat(fromMinute) / 60;
                    const validToOra = parseFloat(toHour) + parseFloat(toMinute) / 60;
                    const serviceData = {
                        setup_name: setupName,
                        setup_value: setupValue,
                        valid_from_ora: validFromOra,
                        valid_to_ora: validToOra,
                        days_of_week: selectedDays.join(','),
                        priority: parseInt(priority)
                    };
                    await window._miaConfigCardInstance.callMiaConfigService('set_schedule_config', serviceData);
                    form.reset();
                    window.dcCloseAddConfigModal();
                    window._miaConfigCardInstance.showToast('Override orario aggiunto!');
                    setTimeout(() => window._miaConfigCardInstance.loadConfigurations(), 500);
                } catch (err) {
                    console.error('Errore:', err);
                    window._miaConfigCardInstance.showToast('Errore: ' + err.message, true);
                }
            });
        }
        
        const modalTimeForm = window._miaConfigCardInstance.content.querySelector('#modal-dc-form-time');
        if (modalTimeForm) {
            modalTimeForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const form = e.target;
                const setupName = window._miaConfigCardInstance.content.querySelector('#modal-time-config-select').value;
                const setupValue = window._miaConfigCardInstance.content.querySelector('#modal-time-setup-value').value;
                const validFrom = window._miaConfigCardInstance.content.querySelector('#modal-dc-form-time input[name="valid_from"]').value;
                const validTo = window._miaConfigCardInstance.content.querySelector('#modal-dc-form-time input[name="valid_to"]').value;
                const priority = window._miaConfigCardInstance.content.querySelector('#modal-global-priority').value;
                const enableHours = window._miaConfigCardInstance.content.querySelector('#modal-time-enable-hours').checked;
                const enableDays = window._miaConfigCardInstance.content.querySelector('#modal-time-enable-days').checked;
                try {
                    const serviceData = {
                        setup_name: setupName,
                        setup_value: setupValue,
                        valid_from: validFrom,
                        valid_to: validTo,
                        priority: parseInt(priority)
                    };
                    if (enableHours) {
                        const fromHour = window._miaConfigCardInstance.content.querySelector('#modal-time-from-hour').value;
                        const fromMinute = window._miaConfigCardInstance.content.querySelector('#modal-time-from-minute').value;
                        const toHour = window._miaConfigCardInstance.content.querySelector('#modal-time-to-hour').value;
                        const toMinute = window._miaConfigCardInstance.content.querySelector('#modal-time-to-minute').value;
                        serviceData.valid_from_ora = parseFloat(fromHour) + parseFloat(fromMinute) / 60;
                        serviceData.valid_to_ora = parseFloat(toHour) + parseFloat(toMinute) / 60;
                    }
                    if (enableDays) {
                        const selectedDays = Array.from(window._miaConfigCardInstance.content.querySelectorAll('#modal-dc-form-time input[name="time-days"]:checked')).map(el => el.value);
                        serviceData.days_of_week = selectedDays.join(',');
                    }
                    await window._miaConfigCardInstance.callMiaConfigService('set_time_config', serviceData);
                    form.reset();
                    window.dcCloseAddConfigModal();
                    window._miaConfigCardInstance.showToast('Override temporale aggiunto!');
                    setTimeout(() => window._miaConfigCardInstance.loadConfigurations(), 500);
                } catch (err) {
                    console.error('Errore:', err);
                    window._miaConfigCardInstance.showToast('Errore: ' + err.message, true);
                }
            });
        }
        
        const modalConditionalForm = window._miaConfigCardInstance.content.querySelector('#modal-dc-form-conditional');
        if (modalConditionalForm) {
            modalConditionalForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const form = e.target;
                
                // Validazione elementi obbligatori
                const setupNameElement = window._miaConfigCardInstance.content.querySelector('#modal-conditional-config-select');
                const setupValueElement = window._miaConfigCardInstance.content.querySelector('#modal-conditional-setup-value');
                const conditionalConfigElement = window._miaConfigCardInstance.content.querySelector('#modal-conditional-source-config');
                const conditionalOperatorElement = window._miaConfigCardInstance.content.querySelector('#modal-conditional-operator');
                const conditionalValueElement = window._miaConfigCardInstance.content.querySelector('#modal-conditional-comparison-value');
                const priorityElement = window._miaConfigCardInstance.content.querySelector('#modal-global-priority');
                
                // Se mancano elementi critici, annulla il submit
                if (!setupNameElement?.value || !setupValueElement?.value || !conditionalConfigElement?.value || !conditionalOperatorElement?.value || !conditionalValueElement?.value || !priorityElement?.value) {
                    return;
                }
                
                const setupName = setupNameElement.value;
                const setupValue = setupValueElement.value;
                const conditionalConfig = conditionalConfigElement.value;
                const conditionalOperator = conditionalOperatorElement.value;
                const conditionalValue = conditionalValueElement.value;
                const priority = priorityElement.value;
                const enableHours = window._miaConfigCardInstance.content.querySelector('#modal-conditional-enable-hours')?.checked || false;
                try {
                    const serviceData = {
                        setup_name: setupName,
                        setup_value: setupValue,
                        conditional_config: conditionalConfig,
                        conditional_operator: conditionalOperator,
                        conditional_value: conditionalValue,
                        priority: parseInt(priority)
                    };
                    if (enableHours) {
                        const fromHour = window._miaConfigCardInstance.content.querySelector('#modal-conditional-from-hour').value;
                        const fromMinute = window._miaConfigCardInstance.content.querySelector('#modal-conditional-from-minute').value;
                        const toHour = window._miaConfigCardInstance.content.querySelector('#modal-conditional-to-hour').value;
                        const toMinute = window._miaConfigCardInstance.content.querySelector('#modal-conditional-to-minute').value;
                        serviceData.valid_from_ora = parseFloat(fromHour) + parseFloat(fromMinute) / 60;
                        serviceData.valid_to_ora = parseFloat(toHour) + parseFloat(toMinute) / 60;
                    }
                    await window._miaConfigCardInstance.callMiaConfigService('set_conditional_config', serviceData);
                    form.reset();
                    window.dcCloseAddConfigModal();
                    window._miaConfigCardInstance.showToast('Override condizionale aggiunto!');
                    setTimeout(() => window._miaConfigCardInstance.loadConfigurations(), 500);
                } catch (err) {
                    console.error('Errore:', err);
                    window._miaConfigCardInstance.showToast('Errore: ' + err.message, true);
                }
            });
        }

        // Toggle per filtri opzionali nel modal Time
        const modalTimeHoursToggle = window._miaConfigCardInstance.content.querySelector('#modal-time-enable-hours');
        const modalTimeHoursContainer = window._miaConfigCardInstance.content.querySelector('#modal-time-hours-container');
        if (modalTimeHoursToggle && modalTimeHoursContainer) {
            modalTimeHoursToggle.addEventListener('change', (e) => {
                modalTimeHoursContainer.style.display = e.target.checked ? 'block' : 'none';
            });
        }
        const modalTimeDaysToggle = window._miaConfigCardInstance.content.querySelector('#modal-time-enable-days');
        const modalTimeDaysContainer = window._miaConfigCardInstance.content.querySelector('#modal-time-days-container');
        if (modalTimeDaysToggle && modalTimeDaysContainer) {
            modalTimeDaysToggle.addEventListener('change', (e) => {
                modalTimeDaysContainer.style.display = e.target.checked ? 'block' : 'none';
            });
        }

        // Toggle per filtri opzionali nel modal Conditional
        const modalConditionalHoursToggle = window._miaConfigCardInstance.content.querySelector('#modal-conditional-enable-hours');
        const modalConditionalHoursContainer = window._miaConfigCardInstance.content.querySelector('#modal-conditional-hours-container');
        if (modalConditionalHoursToggle && modalConditionalHoursContainer) {
            modalConditionalHoursToggle.addEventListener('change', (e) => {
                modalConditionalHoursContainer.style.display = e.target.checked ? 'block' : 'none';
            });
        }
        
        // Update conditional preview on operator change (modal)
        const modalConditionalOperator = window._miaConfigCardInstance.content.querySelector('#modal-conditional-operator');
        if (modalConditionalOperator) {
            modalConditionalOperator.addEventListener('change', () => {
                const sourceSelect = window._miaConfigCardInstance.content.querySelector('#modal-conditional-source-config');
                const operator = modalConditionalOperator.value;
                const previewSpan = window._miaConfigCardInstance.content.querySelector('#modal-conditional-preview');
                if (sourceSelect && sourceSelect.value && previewSpan) {
                    previewSpan.textContent = `${sourceSelect.value} ${operator} [valore]`;
                }
            });
        }

        // Switch Tab Function
        window.dcSwitchTab = (tabName, event) => {
            window._miaConfigCardInstance.content.querySelectorAll('.dc-tab').forEach(t => t.classList.remove('active'));
            window._miaConfigCardInstance.content.querySelectorAll('.dc-tab-content').forEach(c => c.classList.remove('active'));
            
            event.target.classList.add('active');
            window._miaConfigCardInstance.content.querySelector(`#dc-tab-${tabName}`).classList.add('active');
            
            if (tabName === 'dashboard') {
                this.loadDashboard();
            } else if (tabName === 'config') {
                window._miaConfigCardInstance.loadConfigurations();
                this.loadStandardConfigsForSelect();
                this.loadConfigsForValidValues();
            } else if (tabName === 'weekly') {
                this.loadConfigsForWeeklyView();
            } else if (tabName === 'history') {
                this.loadConfigsForHistoryFilter();
                if (typeof window.dcLoadHistory === 'function') {
                    window.dcLoadHistory();
                }
            }
        };
        
        window.dcShowConfigForm = (formType) => {
            // Nascondi tutti i form
            window._miaConfigCardInstance.content.querySelectorAll('.dc-form-container').forEach(container => {
                container.style.display = 'none';
            });
            
            // Mostra il form selezionato
            const container = window._miaConfigCardInstance.content.querySelector(`#dc-form-container-${formType}`);
            if (container) {
                container.style.display = 'block';
                
                // Carica le configurazioni standard per i select (schedule, time, conditional)
                if (formType === 'schedule' || formType === 'time' || formType === 'conditional') {
                    this.loadStandardConfigsForSelect();
                }
                
                // Reimposta valori di default per il form time
                if (formType === 'time') {
                    this.setDefaultTimeValues();
                }
            }
        };
        
        window.dcSwitchConfigView = (mode) => {
            // Salva la modalità di visualizzazione
            this.configViewMode = mode;
            
            // Aggiorna i pulsanti
            window._miaConfigCardInstance.content.querySelectorAll('.dc-view-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            window._miaConfigCardInstance.content.querySelector(`.dc-view-btn[data-mode="${mode}"]`).classList.add('active');
            
            // Ricarica le configurazioni con la nuova vista
            window._miaConfigCardInstance.loadConfigurations();
        };
        
        // Toggle sezioni collassabili
        window.dcToggleSection = (header, sectionId) => {
            const section = window._miaConfigCardInstance.content.querySelector(`#dc-section-${sectionId}`);
            const arrow = header.querySelector('.dc-toggle-arrow');
            
            if (section.style.display === 'none') {
                section.style.display = 'block';
                arrow.textContent = '▼';
            } else {
                section.style.display = 'none';
                arrow.textContent = '▶';
            }
        };
        
        // Backup Database
        window.dcBackupDatabase = async () => {
            const card = MiaConfigCard.getCardInstance();
            if (!card || !card.content || !card._hass) {
                console.error('Card instance not available for backup');
                return;
            }
            const statusDiv = card.content.querySelector('#dc-backup-status');
            statusDiv.innerHTML = '<p style="color: var(--info-color);">⏳ Creazione backup...</p>';
            
            try {
                const entityId = card.getSelectedEntityId();
                const serviceData = {};
                if (entityId) serviceData.entity_id = entityId;
                
                const result = await card._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'backup_database',
                    service_data: serviceData,
                    return_response: true
                });
                
                if (result.response?.success) {
                    statusDiv.innerHTML = `<p style="color: var(--success-color);">✅ ${result.response.message}</p><p style="color: var(--secondary-text-color); font-size: 12px;">File: ${result.response.backup_file}</p>`;
                    window.dcRefreshBackupList();
                    setTimeout(() => { statusDiv.innerHTML = ''; }, 5000);
                } else {
                    statusDiv.innerHTML = `<p style="color: var(--error-color);">❌ ${result.response?.message || 'Errore sconosciuto'}</p>`;
                }
            } catch (err) {
                console.error('Errore backup:', err);
                statusDiv.innerHTML = `<p style="color: var(--error-color);">❌ Errore: ${err.message || 'Errore sconosciuto'}</p>`;
            }
        };
        
        // Mostra form restore
        window.dcShowRestoreForm = () => {
            const card = MiaConfigCard.getCardInstance();
            if (!card || !card.content) return;
            const form = card.content.querySelector('#dc-restore-form');
            if (form) form.style.display = 'block';
        };
        
        // Nascondi form restore
        window.dcHideRestoreForm = () => {
            const card = MiaConfigCard.getCardInstance();
            if (!card || !card.content) return;
            const form = card.content.querySelector('#dc-restore-form');
            if (form) form.style.display = 'none';
        };
        
        // Restore Database
        window.dcRestoreDatabase = async () => {
            const card = MiaConfigCard.getCardInstance();
            if (!card || !card.content || !card._hass) {
                console.error('Card instance not available for restore');
                return;
            }
            const pathInput = card.content.querySelector('#restore-backup-path');
            const backupFile = pathInput.value.trim();
            
            if (!backupFile) {
                alert('Inserisci il percorso del file di backup');
                return;
            }
            
            if (!confirm('Attenzione: il database attuale sarà sostituito. Proseguire?')) {
                return;
            }
            
            const statusDiv = card.content.querySelector('#dc-backup-status');
            statusDiv.innerHTML = '<p style="color: var(--info-color);">⏳ Ripristino database...</p>';
            
            try {
                const entityId = card.getSelectedEntityId();
                const serviceData = { backup_file: backupFile };
                if (entityId) serviceData.entity_id = entityId;
                
                const result = await card._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'restore_database',
                    service_data: serviceData,
                    return_response: true
                });
                
                if (result.response?.success) {
                    statusDiv.innerHTML = `<p style="color: var(--success-color);">✅ Database ripristinato con successo</p>`;
                    window.dcHideRestoreForm();
                    pathInput.value = '';
                    setTimeout(() => {
                        card.loadDashboard();
                        statusDiv.innerHTML = '';
                    }, 2000);
                } else {
                    statusDiv.innerHTML = `<p style="color: var(--error-color);">❌ ${result.response?.message || 'Errore sconosciuto'}</p>`;
                }
            } catch (err) {
                console.error('Errore restore:', err);
                statusDiv.innerHTML = `<p style="color: var(--error-color);">❌ Errore: ${err.message || 'Errore sconosciuto'}</p>`;
            }
        };
        
        const getAuthToken = () => this._hass?.auth?.accessToken || this._hass?.connection?.options?.accessToken || this._hass?.connection?.options?.authToken;

        const humanFileSize = (size) => {
            if (size === 0) return '0 B';
            if (!size) return '-';
            const i = Math.floor(Math.log(size) / Math.log(1024));
            const value = size / Math.pow(1024, i);
            const units = ['B', 'KB', 'MB', 'GB', 'TB'];
            return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
        };

        window.dcRefreshBackupList = async () => {
            const card = MiaConfigCard.getCardInstance();
            if (!card || !card.content) {
                return;
            }
            const listDiv = card.content.querySelector('#dc-backup-list');
            if (!listDiv) return;
            listDiv.innerHTML = '<p style="margin: 0; color: var(--secondary-text-color);">Caricamento elenco backup...</p>';
            try {
                const entityId = card.getSelectedEntityId();
                const serviceData = entityId ? { entity_id: entityId } : {};
                const result = await card._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'list_backups',
                    service_data: serviceData,
                    return_response: true
                });
                const backups = result?.response?.backups || [];
                if (!backups.length) {
                    listDiv.innerHTML = '<p style="margin: 0; color: var(--secondary-text-color);">Nessun backup trovato.</p>';
                    return;
                }
                const rows = backups.map((backup) => {
                    const safeName = backup.file_name.replace(/\\/g, '\\\\').replace(/'/g, "\\''");
                    const safePath = backup.path.replace(/\\/g, '\\\\').replace(/'/g, "\\''");
                    const displayName = backup.file_name;
                    const sizeLabel = humanFileSize(backup.size);
                    const dateLabel = backup.modified ? new Date(backup.modified).toLocaleString() : '-';
                    return `
                        <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr auto; gap: 8px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--divider-color);">
                            <div style="overflow: hidden; text-overflow: ellipsis;">${displayName}</div>
                            <div style="color: var(--secondary-text-color);">${dateLabel}</div>
                            <div style="color: var(--secondary-text-color);">${sizeLabel}</div>
                            <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
                                <button class="dc-btn" onclick="window.dcDownloadBackup('${safeName}')" style="padding: 6px 10px;">⬇️ Scarica</button>
                                <button class="dc-btn-secondary" onclick="window.dcPrefillRestorePath('${safePath}')" style="padding: 6px 10px;">📥 Usa per restore</button>
                                <button class="dc-btn-secondary" onclick="window.dcDeleteBackup('${safeName}')" style="padding: 6px 10px;">🗑️ Elimina</button>
                            </div>
                        </div>
                    `;
                }).join('');
                listDiv.innerHTML = rows;
            } catch (err) {
                console.error('Errore durante la lettura dei backup:', err);
                listDiv.innerHTML = `<p style="color: var(--error-color);">Errore: ${err.message || err}</p>`;
            }
        };

        window.dcDownloadBackup = async (fileName) => {
            const card = MiaConfigCard.getCardInstance();
            if (!card || !card.content || !card._hass) {
                console.error('Card instance not available for download');
                return;
            }
            const statusDiv = card.content.querySelector('#dc-backup-status');
            const token = getAuthToken();
            try {
                statusDiv.innerHTML = '<p style="color: var(--info-color);">⬇️ Download backup...</p>';
                const url = card._hass.hassUrl(`/api/mia_config/backups/${encodeURIComponent(fileName)}`);
                const resp = await fetch(url, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                if (!resp.ok) {
                    throw new Error(`Download fallito (${resp.status})`);
                }
                const blob = await resp.blob();
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(link.href), 1500);
                statusDiv.innerHTML = '';
            } catch (err) {
                console.error('Errore download backup:', err);
                statusDiv.innerHTML = `<p style="color: var(--error-color);">❌ ${err.message || 'Errore download'}</p>`;
            }
        };

        window.dcUploadBackup = async () => {
            const card = MiaConfigCard.getCardInstance();
            if (!card || !card.content || !card._hass) {
                console.error('Card instance not available for upload');
                return;
            }
            const input = card.content.querySelector('#dc-backup-upload-input');
            const statusDiv = card.content.querySelector('#dc-backup-status');
            if (!input || !input.files || !input.files.length) {
                alert('Seleziona un file di backup (.db) da caricare');
                return;
            }
            const token = getAuthToken();
            const formData = new FormData();
            formData.append('file', input.files[0]);
            statusDiv.innerHTML = '<p style="color: var(--info-color);">⬆️ Caricamento backup...</p>';
            try {
                const resp = await fetch(card._hass.hassUrl('/api/mia_config/backups/upload'), {
                    method: 'POST',
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                    body: formData
                });
                const data = await resp.json();
                if (!resp.ok || !data.success) {
                    throw new Error(data?.message || 'Upload fallito');
                }
                statusDiv.innerHTML = `<p style="color: var(--success-color);">✅ ${data.message} (${data.file_name})</p>`;
                input.value = '';
                window.dcRefreshBackupList();
            } catch (err) {
                console.error('Errore upload backup:', err);
                statusDiv.innerHTML = `<p style="color: var(--error-color);">❌ ${err.message || 'Errore upload'}</p>`;
            }
        };

        window.dcDeleteBackup = async (fileName) => {
            if (!confirm(`Eliminare il backup "${fileName}"?`)) return;
            const card = MiaConfigCard.getCardInstance();
            if (!card || !card.content || !card._hass) {
                console.error('Card instance not available for delete');
                return;
            }
            const statusDiv = card.content.querySelector('#dc-backup-status');
            statusDiv.innerHTML = '<p style="color: var(--info-color);">🗑️ Eliminazione backup...</p>';
            try {
                const entityId = card.getSelectedEntityId();
                const serviceData = { file_name: fileName };
                if (entityId) serviceData.entity_id = entityId;
                const result = await card._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'delete_backup',
                    service_data: serviceData,
                    return_response: true
                });
                if (result.response?.success) {
                    statusDiv.innerHTML = `<p style="color: var(--success-color);">✅ ${result.response.message}</p>`;
                } else {
                    statusDiv.innerHTML = `<p style="color: var(--error-color);">❌ ${result.response?.message || 'Errore eliminazione'}</p>`;
                }
                window.dcRefreshBackupList();
            } catch (err) {
                console.error('Errore eliminazione backup:', err);
                statusDiv.innerHTML = `<p style="color: var(--error-color);">❌ ${err.message || 'Errore eliminazione'}</p>`;
            }
        };

        window.dcDeleteAllBackups = async () => {
            if (!confirm('Eliminare tutti i backup locali?')) return;
            const card = MiaConfigCard.getCardInstance();
            if (!card || !card.content || !card._hass) {
                console.error('Card instance not available for delete all backups');
                return;
            }
            const statusDiv = card.content.querySelector('#dc-backup-status');
            statusDiv.innerHTML = '<p style="color: var(--info-color);">🗑️ Eliminazione di tutti i backup...</p>';
            try {
                const entityId = card.getSelectedEntityId();
                const serviceData = entityId ? { entity_id: entityId } : {};
                const result = await card._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'delete_all_backups',
                    service_data: serviceData,
                    return_response: true
                });
                if (result.response?.success) {
                    statusDiv.innerHTML = `<p style="color: var(--success-color);">✅ ${result.response.message}</p>`;
                } else {
                    statusDiv.innerHTML = `<p style="color: var(--error-color);">❌ ${result.response?.message || 'Errore eliminazione'}</p>`;
                }
                window.dcRefreshBackupList();
            } catch (err) {
                console.error('Errore eliminazione backup:', err);
                statusDiv.innerHTML = `<p style="color: var(--error-color);">❌ ${err.message || 'Errore eliminazione'}</p>`;
            }
        };

        window.dcPrefillRestorePath = (path) => {
            const card = MiaConfigCard.getCardInstance();
            if (!card || !card.content) {
                console.warn('Card instance not available for prefill');
                return;
            }
            const input = card.content.querySelector('#restore-backup-path');
            if (input) {
                input.value = path;
                window.dcShowRestoreForm();
            }
        };

        window.dcLoadValidValuesForForm = async (formType) => {
            await this.dcLoadValidValuesForForm(formType);
        };
        
        window.dcUpdateConditionalOptions = async () => {
            const card = MiaConfigCard.getCardInstance();
            if (!card || !card.content || !card._hass) {
                console.error('Card instance not available for dcUpdateConditionalOptions');
                return;
            }
            
            const sourceSelect = card.content.querySelector('#modal-conditional-source-config');
            const comparisonContainer = card.content.querySelector('#modal-conditional-comparison-container');
            const previewSpan = card.content.querySelector('#modal-conditional-preview');
            
            if (!sourceSelect || !sourceSelect.value) return;
            
            const configName = sourceSelect.value;
            
            // Carica valori validi per questa configurazione
            try {
                const entityId = card.getSelectedEntityId();
                const serviceData = { setup_name: configName };
                if (entityId) serviceData.entity_id = entityId;
                
                const result = await card._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'get_valid_values',
                    service_data: serviceData,
                    return_response: true
                });
                
                const validValues = result.response?.valid_values || [];
                const allowFreeText = validValues.some(vv => vv.value === '%');
                
                if (validValues.length > 0 && allowFreeText) {
                    const datalistId = 'modal-conditional-comparison-datalist';
                    let html = `<input type="text" id="modal-conditional-comparison-value" name="conditional_value" required list="${datalistId}" placeholder="Inserisci o seleziona valore" style="width: 100%; padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px;">`;
                    html += `<datalist id="${datalistId}">`;
                    validValues.forEach(vv => {
                        const label = vv.description ? `${vv.value} (${vv.description})` : vv.value;
                        html += `<option value="${vv.value}">${label}</option>`;
                    });
                    html += '</datalist>';
                    html += '<small style="color: var(--secondary-text-color); display: block; margin-top: 4px;">Suggerimenti disponibili; % abilita valori liberi</small>';
                    comparisonContainer.innerHTML = html;
                } else if (validValues.length > 0) {
                    // Crea un select con i valori validi
                    let html = '<select id="modal-conditional-comparison-value" name="conditional_value" required style="width: 100%; padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px;">';
                    html += '<option value="">-- Seleziona valore --</option>';
                    validValues.forEach(vv => {
                        const label = vv.description ? `${vv.value} (${vv.description})` : vv.value;
                        html += `<option value="${vv.value}">${label}</option>`;
                    });
                    html += '</select>';
                    comparisonContainer.innerHTML = html;
                } else {
                    // Campo di input libero
                    comparisonContainer.innerHTML = '<input type="text" id="modal-conditional-comparison-value" name="conditional_value" required placeholder="es. 1" style="width: 100%; padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px;">';
                }
                
                // Aggiorna preview
                const operatorElement = card.content.querySelector('#modal-conditional-operator');
                if (previewSpan && operatorElement) {
                    previewSpan.textContent = `${configName} ${operatorElement.value} [valore]`;
                }
            } catch (err) {
                console.error('Errore caricamento valori validi:', err);
            }
        };
        
        // Quick Override - Apre tab Configura e precompila form temporale
        window.dcQuickOverride = (setupName) => {
            // Passa al tab configura
            const configTab = window._miaConfigCardInstance.content.querySelector('.dc-tab:nth-child(2)'); // Tab Configura
            if (configTab) {
                configTab.click();
            }
            
            // Attendi che il tab si carichi
            setTimeout(() => {
                // Apri modal e seleziona tipo "Override Temporale"
                window.dcOpenAddConfigModal();
                const typeSelector = window._miaConfigCardInstance.content.querySelector('#modal-config-type-selector');
                if (typeSelector) {
                    typeSelector.value = 'time';
                    window.dcShowModalConfigForm('time');
                }
                
                // Precompila il nome configurazione nel select dopo un momento
                setTimeout(() => {
                    const timeSelect = window._miaConfigCardInstance.content.querySelector('#modal-time-config-select');
                    if (timeSelect) {
                        timeSelect.value = setupName;
                        // Carica i valori validi per il campo valore
                        window.dcLoadValidValuesForForm('time');
                    }
                    
                    // Scroll al form
                    const formContainer = window._miaConfigCardInstance.content.querySelector('#modal-form-container-time');
                    if (formContainer) {
                        formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 300);
            }, 100);
        };
        
        // Show Weekly - Apre tab Vista Settimanale e mostra quella configurazione
        window.dcShowWeeklyFor = (setupName) => {
            // Passa al tab vista settimanale
            const weeklyTab = window._miaConfigCardInstance.content.querySelector('.dc-tab:nth-child(3)'); // Tab Vista Settimanale
            if (weeklyTab) {
                weeklyTab.click();
            }
            
            // Attendi che il tab si carichi
            setTimeout(() => {
                const weeklySelect = window._miaConfigCardInstance.content.querySelector('#weekly-config-select');
                if (weeklySelect) {
                    weeklySelect.value = setupName;
                    // Carica automaticamente la vista
                    window.dcLoadWeeklyView();
                }
            }, 100);
        };
        
        // Precarica elenco backup se la sezione è presente
        if (typeof window.dcRefreshBackupList === 'function') {
            window.dcRefreshBackupList();
        }

        // Carica dashboard iniziale se _hass è disponibile
        if (this._hass) {
            this.loadDashboard();
        }
    }

    async loadStandardConfigsForSelect() {
        try {
            const entityId = this.getSelectedEntityId();
            const serviceData = entityId ? { entity_id: entityId } : {};
            
            const result = await this._hass.callWS({
                type: 'call_service',
                domain: 'mia_config',
                service: 'get_configurations',
                service_data: serviceData,
                return_response: true
            });
            console.log('Risultato per select:', result);
            
            // I dati sono direttamente in result.response
            const configs = result.response || result.configurations || {};
            console.log('Configurazioni estratte per select:', configs);
            
            // Ora configs è un oggetto dove ogni valore è un array di configurazioni
            // Trova solo le configurazioni che hanno un valore standard (type: 'standard')
            const standardConfigs = [];
            for (const [name, configsList] of Object.entries(configs)) {
                if (Array.isArray(configsList)) {
                    const hasStandard = configsList.some(cfg => cfg.type === 'standard');
                    if (hasStandard) {
                        // Prendi il valore dalla configurazione standard
                        const standardCfg = configsList.find(cfg => cfg.type === 'standard');
                        standardConfigs.push({name, value: standardCfg.value});
                    }
                }
            }
            console.log('Configurazioni standard trovate:', standardConfigs);
            
            const scheduleSelect = window._miaConfigCardInstance.content.querySelector('#modal-schedule-config-select');
            const timeSelect = window._miaConfigCardInstance.content.querySelector('#modal-time-config-select');
            const conditionalSelect = window._miaConfigCardInstance.content.querySelector('#modal-conditional-config-select');
            const conditionalSourceSelect = window._miaConfigCardInstance.content.querySelector('#modal-conditional-source-config');
            
            if (standardConfigs.length === 0) {
                const noConfigOption = '<option value="">-- Nessuna configurazione standard disponibile --</option>';
                if (scheduleSelect) scheduleSelect.innerHTML = noConfigOption;
                if (timeSelect) timeSelect.innerHTML = noConfigOption;
                if (conditionalSelect) conditionalSelect.innerHTML = noConfigOption;
                if (conditionalSourceSelect) conditionalSourceSelect.innerHTML = noConfigOption;
                return;
            }
            
            let options = '<option value="">-- Seleziona configurazione --</option>';
            for (const config of standardConfigs) {
                options += `<option value="${config.name}">${config.name} (attuale: ${config.value})</option>`;
            }
            
            if (scheduleSelect) scheduleSelect.innerHTML = options;
            if (timeSelect) timeSelect.innerHTML = options;
            if (conditionalSelect) conditionalSelect.innerHTML = options;
            if (conditionalSourceSelect) conditionalSourceSelect.innerHTML = options;
        } catch (err) {
            console.error('Errore caricamento configurazioni:', err);
            console.error('Error details:', err?.message || err?.toString() || JSON.stringify(err));
        }
    }

    async loadDashboard() {
        const container = window._miaConfigCardInstance.content.querySelector('#dc-dashboard-content');
        container.innerHTML = 'Caricamento...';
        
        try {
            // Ottieni tutti i sensori mia_config
            const sensors = Object.keys(this._hass.states)
                .filter(id => {
                    if (!id.startsWith('sensor.mia_config_')) return false;
                    // Escludi solo aggregatori noti
                    if (id === 'sensor.miahomeconfig' || id === 'sensor.mia_config_main') return false;
                    const entity = this._hass.states[id];
                    // Escludi sensori che sono chiaramente aggregatori (hanno total_configs negli attributi)
                    if (entity?.attributes?.total_configs !== undefined) return false;
                    return true;
                })
                .map(id => ({
                    id,
                    entity: this._hass.states[id],
                    name: id.replace('sensor.mia_config_', '').replace(/_/g, ' ')
                }));
            console.debug('MIA-CONFIG dashboard sensors trovati:', sensors.map(s => s.id));
            
            if (sensors.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--secondary-text-color);">Nessun sensore disponibile</p>';
                return;
            }
            
            let html = '<h3>📊 Valori Correnti</h3>';
            html += '<div style="margin-bottom: 20px;">';
            
            // Carica tutti i valori validi per mostrare le descrizioni
            const entityId = this.getSelectedEntityId();
            const serviceData = {};
            if (entityId) {
                serviceData.entity_id = entityId;
            }
            
            let validValuesMap = {};
            try {
                const response = await this._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'get_valid_values',
                    service_data: serviceData,
                    return_response: true
                });
                
                // Crea mappa: {setup_name: {value: {description, sort_order}}}
                const allValidValues = response.response.valid_values || {};
                for (const [setupName, values] of Object.entries(allValidValues)) {
                    validValuesMap[setupName] = {};
                    for (const vv of values) {
                        validValuesMap[setupName][vv.value] = {
                            description: vv.description,
                            sort_order: vv.sort_order
                        };
                    }
                }
            } catch (err) {
                console.log('Info: nessun valore valido disponibile o errore caricamento');
            }
            
            for (const sensor of sensors) {
                const value = sensor.entity.state;
                const attrs = sensor.entity.attributes;
                const source = attrs.source || 'unknown';
                const entityId = sensor.id;
                const setupName = attrs.setup_name || sensor.name.replace(/ /g, '_');
                const description = attrs.description || '';
                
                // Ottieni descrizione dal valore valido se disponibile
                const valueDescription = validValuesMap[setupName]?.[value]?.description;
                const valueDisplay = valueDescription ? `${value} <small style="color: var(--secondary-text-color);">(${valueDescription})</small>` : value;
                
                const typeLabel = source === 'time' ? '⏰ Tempo' :
                                 source === 'schedule' ? '📅 Orario' :
                                 source === 'standard' ? '⚙️ Standard' : '❌ Nessuna';
                
                html += `
                    <div class="dc-config-item" style="background: var(--card-background-color); border-left: 4px solid var(--primary-color); display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                        <div style="flex: 1; cursor: pointer;" onclick="window.dcOpenEntity('${entityId}')" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                            <strong>🎯 ${sensor.name}</strong><br>
                            ${description ? `<small style="color: var(--secondary-text-color); font-style: italic;">📝 ${description}</small><br>` : ''}
                            <span style="font-size: 1.4em; color: var(--primary-color); font-weight: bold;">${valueDisplay}</span><br>
                            <small>Origine: ${typeLabel}</small>
                        </div>
                        <div class="dc-dashboard-actions">
                            <button class="dc-btn" onclick="event.stopPropagation(); window.dcQuickOverride('${setupName}')" style="padding: 6px 10px; font-size: 12px;">➕ Override</button>
                            <button class="dc-btn-secondary" onclick="event.stopPropagation(); window.dcShowWeeklyFor('${setupName}')" style="padding: 6px 10px; font-size: 12px;">📅 Vista</button>
                        </div>
                    </div>
                `;
            }
            
            html += '</div>';
            container.innerHTML = html;
        } catch (err) {
            console.error('Errore caricamento dashboard:', err);
            container.innerHTML = '<p style="color: red;">Errore caricamento dati</p>';
        }
    }

    async loadConfigurations() {
        const container = window._miaConfigCardInstance.content.querySelector('#dc-config-list');
        container.innerHTML = 'Caricamento...';
        
        // Determina la modalità di visualizzazione
        const viewMode = this.configViewMode || 'name';
        
        try {
            const entityId = this.getSelectedEntityId();
            const serviceData = entityId ? { entity_id: entityId } : {};
            
            const result = await this._hass.callWS({
                type: 'call_service',
                domain: 'mia_config',
                service: 'get_configurations',
                service_data: serviceData,
                return_response: true
            });
            
            console.log('Service response:', result);
            console.log('Response keys:', Object.keys(result || {}));
            
            const configs = result.response || result.configurations || {};
            console.log('Extracted configs:', configs);
            
            // Filtra configurazioni vuote o sensori principali
            const validConfigs = Object.entries(configs).filter(([name, configsList]) => {
                return Array.isArray(configsList) && configsList.length > 0 && configsList[0].id !== undefined;
            });
            
            if (validConfigs.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--secondary-text-color);">Nessuna configurazione presente</p>';
                return;
            }
            
            // Se modalità "override", raggruppa per override invece che per nome
            if (viewMode === 'override') {
                this.renderConfigurationsByOverride(validConfigs, container);
            } else {
                this.renderConfigurationsByName(validConfigs, container);
            }
            
        } catch (error) {
            console.error('Error loading configurations:', error);
            const errorMsg = error?.message || (typeof error === 'object' ? JSON.stringify(error) : error?.toString()) || 'Errore sconosciuto';
            console.error('Error details:', errorMsg);
            container.innerHTML = `<p style="color: var(--error-color);">Errore nel caricamento: ${errorMsg}</p>`;
        }
    }
    
    renderConfigurationsByName(validConfigs, container) {
        let html = '';
        
        // Vista classica per nome
        for (const [name, configsList] of validConfigs) {
            // configsList è un array di configurazioni per questo nome
            if (!Array.isArray(configsList) || configsList.length === 0) continue;
                
            // Ordina le configurazioni:
            // 1. Tempo future (valid_to_date > now) - ordinate per valid_from_date
            // 2. Orario - ordinate per valid_from_ora
            // 3. Standard
            // 4. Tempo passate (valid_to_date <= now) - ordinate per valid_to_date desc
            const now = new Date();
            const sortedConfigs = configsList.slice().sort((a, b) => {
                const typeOrder = {
                    'time_future': 1,
                    'schedule': 2,
                    'standard': 3,
                    'time_past': 4
                };
                
                // Determina categoria per a
                let categoryA = a.type;
                if (a.type === 'time') {
                    const toDate = new Date(a.valid_to_date);
                    categoryA = toDate > now ? 'time_future' : 'time_past';
                }
                
                // Determina categoria per b
                let categoryB = b.type;
                if (b.type === 'time') {
                    const toDate = new Date(b.valid_to_date);
                    categoryB = toDate > now ? 'time_future' : 'time_past';
                }
                
                // Ordina per categoria
                if (typeOrder[categoryA] !== typeOrder[categoryB]) {
                    return typeOrder[categoryA] - typeOrder[categoryB];
                }
                
                // All'interno della stessa categoria
                if (categoryA === 'time_future') {
                    // Ordina per data inizio (prima le più vicine)
                    return new Date(a.valid_from_date) - new Date(b.valid_from_date);
                } else if (categoryA === 'time_past') {
                    // Ordina per data fine (prima le più recenti)
                    return new Date(b.valid_to_date) - new Date(a.valid_to_date);
                } else if (categoryA === 'schedule') {
                    // Ordina per orario di inizio
                    return a.valid_from_ora - b.valid_from_ora;
                }
                
                return 0;
            });
            
            // Genera un ID univoco per il gruppo
            const groupId = `config-group-${name.replace(/[^a-zA-Z0-9]/g, '_')}`;
            
            html += `<div class="dc-config-group">`;
            html += `<div class="dc-config-group-header" onclick="window.dcToggleConfigGroup('${groupId}')">`;
            html += `<div class="dc-config-group-title">`;
            html += `<span class="dc-config-group-toggle" id="${groupId}-toggle">▶</span>`;
            html += `<strong style="font-size: 1.1em;">📦 ${name}</strong>`;
            html += `<span style="color: var(--secondary-text-color); font-size: 0.9em; margin-left: 8px;">(${sortedConfigs.length} configurazioni)</span>`;
            html += `</div>`;
            html += `<button class="dc-btn-delete" onclick="event.stopPropagation(); window.dcDeleteConfig('${name}')" style="margin-left: 10px; padding: 6px 12px;" title="Elimina tutte le configurazioni di ${name}">🗑️</button>`;
            html += `</div>`;
            html += `<div class="dc-config-group-content" id="${groupId}-content">`;
            html += `<div class="dc-config-group-inner">`;
            
            for (const cfg of sortedConfigs) {
                const type = cfg.type || 'standard';
                const badgeClass = type === 'time' ? 'dc-badge-time' : 
                                  type === 'schedule' ? 'dc-badge-schedule' :
                                  type === 'conditional' ? 'dc-badge-time' : 'dc-badge-standard';
                const sourceLabel = type === 'time' ? '⏰ Tempo' :
                                   type === 'schedule' ? '📅 Orario' :
                                   type === 'conditional' ? '🎯 Condizionale' : '⚙️ Standard';
                
                let extra = '';
                if (type === 'standard') {
                    extra = `Priorità: ${cfg.priority}`;
                } else if (type === 'time') {
                    extra = `Da ${cfg.valid_from_date} a ${cfg.valid_to_date}`;
                    
                    // Aggiungi filtri opzionali se presenti
                    if (cfg.valid_from_ora !== undefined && cfg.valid_to_ora !== undefined) {
                        const fromTime = this.formatTimeDisplay(cfg.valid_from_ora);
                        const toTime = this.formatTimeDisplay(cfg.valid_to_ora);
                        extra += ` | ⏰ ${fromTime} → ${toTime}`;
                    }
                    if (cfg.days_of_week !== undefined) {
                        const days = cfg.days_of_week.map(d => ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'][d]).join(', ');
                        extra += ` | 📅 ${days}`;
                    }
                    
                    extra += ` | Priorità: ${cfg.priority}`;
                } else if (type === 'schedule') {
                    const days = cfg.days_of_week.map(d => ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'][d]).join(', ');
                    const fromTime = this.formatTimeDisplay(cfg.valid_from_ora);
                    const toTime = this.formatTimeDisplay(cfg.valid_to_ora);
                    extra = `${fromTime} → ${toTime} | ${days} | Priorità: ${cfg.priority}`;
                } else if (type === 'conditional') {
                    extra = `Se ${cfg.conditional_config} ${cfg.conditional_operator} ${cfg.conditional_value}`;
                    
                    // Aggiungi fascia oraria se presente
                    if (cfg.valid_from_ora !== undefined && cfg.valid_to_ora !== undefined) {
                        const fromTime = this.formatTimeDisplay(cfg.valid_from_ora);
                        const toTime = this.formatTimeDisplay(cfg.valid_to_ora);
                        extra += ` | ⏰ ${fromTime} → ${toTime}`;
                    }
                    
                    extra += ` | Priorità: ${cfg.priority}`;
                }
                
                // ID per operazioni: sempre usa cfg.id (numerico)
                const configId = cfg.id;
                
                // Serializza i dati della configurazione per passarli alla funzione di edit
                const cfgData = encodeURIComponent(JSON.stringify(cfg));
                const isEnabled = cfg.enabled !== false; // Default a true se non specificato
                const disabledClass = !isEnabled ? ' disabled' : '';
                const disabledLabel = !isEnabled ? '<span style="color: #f44336; font-weight: bold; margin-left: 8px;">⊘ DISABILITATA</span>' : '';
                
                html += `
                    <div class="dc-config-item${disabledClass}" style="margin: 5px 0; padding: 8px; background: var(--card-background-color); display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <span class="dc-badge ${badgeClass}">${sourceLabel}</span>
                            Valore: <strong>${cfg.value}</strong>${disabledLabel}<br>
                            <small>${extra}</small>
                            <small style="color: var(--secondary-text-color); display: block; margin-top: 2px;">ID: ${configId}</small>
                        </div>
                        <div style="display: flex; gap: 5px; align-items: center;">
                            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 11px;" title="${isEnabled ? 'Disabilita' : 'Abilita'} configurazione">
                                <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="window.dcToggleConfigEnabled('${type}', ${configId}, this.checked)" style="cursor: pointer;">
                                <span style="font-size: 10px;">${isEnabled ? '✓' : '✗'}</span>
                            </label>
                            <button class="dc-btn" style="padding: 4px 8px; font-size: 11px;" onclick="window.dcEditConfig(this.closest('mia-config-card'), '${name}', '${type}', ${configId}, '${cfgData}')">✏️</button>
                            <button class="dc-btn-delete" style="padding: 4px 8px; font-size: 11px;" onclick="window.dcDeleteSingleConfig('${type}', ${configId})">🗑️</button>
                        </div>
                    </div>
                `;
            }
            
            html += `</div>`; // dc-config-group-inner
            html += `</div>`; // dc-config-group-content
            html += `</div>`; // dc-config-group
        }
        
        container.innerHTML = html;
        
        // Definisci la funzione per toggleare i gruppi
        window.dcToggleConfigGroup = (groupId) => {
            const content = window._miaConfigCardInstance.content.querySelector(`#${groupId}-content`);
            const toggle = window._miaConfigCardInstance.content.querySelector(`#${groupId}-toggle`);
            
            if (content && toggle) {
                const isExpanded = content.classList.contains('expanded');
                if (isExpanded) {
                    content.classList.remove('expanded');
                    toggle.classList.remove('expanded');
                } else {
                    content.classList.add('expanded');
                    toggle.classList.add('expanded');
                }
            }
        };
        
        // Definisci le funzioni window dopo aver popolato l'HTML
        window.dcToggleConfigEnabled = async (type, configId, enabled) => {
            try {
                const serviceName = enabled ? 'enable_config' : 'disable_config';
                await window._miaConfigCardInstance.callMiaConfigService(serviceName, {
                    config_type: type,
                    config_id: parseInt(configId)
                });
                window._miaConfigCardInstance.showToast(enabled ? 'Configurazione abilitata!' : 'Configurazione disabilitata!');
                setTimeout(() => window._miaConfigCardInstance.loadConfigurations(), 500);
            } catch (err) {
                console.error('Errore toggle enabled:', err);
                window._miaConfigCardInstance.showToast('Errore: ' + err.message, true);
                // Ricarica per ripristinare lo stato corretto
                setTimeout(() => window._miaConfigCardInstance.loadConfigurations(), 500);
            }
        };
        
        window.dcDeleteConfig = async (name) => {
            if (confirm(`Eliminare tutte le configurazioni di "${name}"?`)) {
                await window._miaConfigCardInstance.callMiaConfigService('delete_config', {
                    setup_name: name,
                    config_type: 'all'
                });
                window._miaConfigCardInstance.showToast('Configurazione eliminata!');
                setTimeout(() => window._miaConfigCardInstance.loadConfigurations(), 500);
            }
        };
        
        window.dcOpenEntity = (entityId) => {
            const event = new Event('hass-more-info', {
                bubbles: true,
                composed: true,
            });
            event.detail = { entityId };
            this.dispatchEvent(event);
        };
        
        window.dcDeleteSingleConfig = async (type, id) => {
            if (confirm(`Eliminare questa configurazione ${type}?`)) {
                try {
                    await window._miaConfigCardInstance.callMiaConfigService('delete_single_config', {
                        config_type: type,
                        config_id: parseInt(id)
                    });
                    window._miaConfigCardInstance.showToast('Configurazione eliminata!');
                    setTimeout(() => window._miaConfigCardInstance.loadConfigurations(), 500);
                } catch (err) {
                    console.error('Errore eliminazione:', err);
                    window._miaConfigCardInstance.showToast('Errore: ' + err.message, true);
                }
            }
        };
        
        window.dcEditConfig = async (cardElement, name, type, id, cfgDataEncoded) => {
            const instance = cardElement._instance;
            const content = instance.content;
            
            const addModal = content.querySelector('#dc-add-config-modal');
            if (addModal && addModal.classList.contains('active')) {
                addModal.classList.remove('active');
            }
                
                const cfg = JSON.parse(decodeURIComponent(cfgDataEncoded));
                const modal = content.querySelector('#dc-edit-modal');
                const modalBody = content.querySelector('#dc-edit-modal-body');
                
                if (!modal || !modalBody) {
                    console.error('Modal elements not found in DOM');
                    return;
                }
                
                let formHtml = '';
            
            if (type === 'standard') {
                formHtml = `
                    <form id="dc-edit-form">
                        <div class="dc-form-group">
                            <label>Nome Configurazione:</label>
                            <input type="text" value="${name}" disabled style="background: var(--disabled-color);">
                        </div>
                        <div class="dc-form-group">
                            <label>Valore:</label>
                            <input type="text" name="setup_value" value="${cfg.value}" required>
                        </div>
                        <div class="dc-form-group">
                            <label>Priorità:</label>
                            <input type="number" name="priority" value="${cfg.priority || 99}" required>
                            <small style="color: var(--secondary-text-color);">Più basso = più prioritario</small>
                        </div>
                        <div class="dc-form-group">
                            <label>Descrizione:</label>
                            <input type="text" name="description" value="${cfg.description || ''}" placeholder="Descrizione opzionale">
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="dc-btn">Salva</button>
                            <button type="button" class="dc-btn" onclick="window.dcCloseEditModal(this)" style="background: #666;">Annulla</button>
                        </div>
                    </form>
                `;
            } else if (type === 'time') {
                // Converti il formato datetime per datetime-local
                const formatForInput = (dt) => dt.replace(' ', 'T').substring(0, 16);
                
                // Verifica se ci sono filtri opzionali
                const hasTimeFilter = cfg.valid_from_ora !== undefined && cfg.valid_to_ora !== undefined;
                const hasDaysFilter = cfg.days_of_week !== undefined;
                
                let timeFilterHtml = '';
                if (hasTimeFilter) {
                    const fromHour = Math.floor(cfg.valid_from_ora);
                    const fromMinute = Math.round((cfg.valid_from_ora - fromHour) * 60);
                    const toHour = Math.floor(cfg.valid_to_ora);
                    const toMinute = Math.round((cfg.valid_to_ora - toHour) * 60);
                    
                    timeFilterHtml = `
                        <div class="dc-form-group">
                            <label>
                                <input type="checkbox" id="edit-time-enable-hours" checked> Limita a fascia oraria
                            </label>
                            <div id="edit-time-hours-container" style="margin-top: 10px;">
                                <div class="dc-time-picker">
                                    <div>
                                        <label style="font-size: 12px; margin-bottom: 4px;">Dalle:</label>
                                        <div class="dc-time-input">
                                            <select id="edit-time-from-hour">
                                                ${instance.generateHourOptions(0, 23)}
                                            </select>
                                            <span class="dc-time-separator">:</span>
                                            <select id="edit-time-from-minute">
                                                ${instance.generateMinuteOptions()}
                                            </select>
                                        </div>
                                    </div>
                                    <span style="font-size: 18px; align-self: flex-end; padding-bottom: 8px;">→</span>
                                    <div>
                                        <label style="font-size: 12px; margin-bottom: 4px;">Alle:</label>
                                        <div class="dc-time-input">
                                            <select id="edit-time-to-hour">
                                                ${instance.generateHourOptions(0, 23)}
                                            </select>
                                            <span class="dc-time-separator">:</span>
                                            <select id="edit-time-to-minute">
                                                ${instance.generateMinuteOptions()}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    timeFilterHtml = `
                        <div class="dc-form-group">
                            <label>
                                <input type="checkbox" id="edit-time-enable-hours"> Limita a fascia oraria
                            </label>
                            <div id="edit-time-hours-container" style="display: none; margin-top: 10px;">
                                <div class="dc-time-picker">
                                    <div>
                                        <label style="font-size: 12px; margin-bottom: 4px;">Dalle:</label>
                                        <div class="dc-time-input">
                                            <select id="edit-time-from-hour">
                                                ${instance.generateHourOptions(0, 23)}
                                            </select>
                                            <span class="dc-time-separator">:</span>
                                            <select id="edit-time-from-minute">
                                                ${instance.generateMinuteOptions()}
                                            </select>
                                        </div>
                                    </div>
                                    <span style="font-size: 18px; align-self: flex-end; padding-bottom: 8px;">→</span>
                                    <div>
                                        <label style="font-size: 12px; margin-bottom: 4px;">Alle:</label>
                                        <div class="dc-time-input">
                                            <select id="edit-time-to-hour">
                                                ${instance.generateHourOptions(0, 23)}
                                            </select>
                                            <span class="dc-time-separator">:</span>
                                            <select id="edit-time-to-minute">
                                                ${instance.generateMinuteOptions()}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                let daysFilterHtml = '';
                const daysOfWeek = cfg.days_of_week || [];
                const dayCheckboxes = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map((day, i) => 
                    `<label class="dc-checkbox-label">
                        <input type="checkbox" name="edit-time-days" value="${i}" ${daysOfWeek.includes(i) ? 'checked' : ''}> ${day}
                    </label>`
                ).join('');
                
                if (hasDaysFilter) {
                    daysFilterHtml = `
                        <div class="dc-form-group">
                            <label>
                                <input type="checkbox" id="edit-time-enable-days" checked> Limita a giorni specifici
                            </label>
                            <div id="edit-time-days-container" style="margin-top: 10px;">
                                <div class="dc-checkbox-group">
                                    ${dayCheckboxes}
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    daysFilterHtml = `
                        <div class="dc-form-group">
                            <label>
                                <input type="checkbox" id="edit-time-enable-days"> Limita a giorni specifici
                            </label>
                            <div id="edit-time-days-container" style="display: none; margin-top: 10px;">
                                <div class="dc-checkbox-group">
                                    ${dayCheckboxes}
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                formHtml = `
                    <form id="dc-edit-form">
                        <div class="dc-form-group">
                            <label>Nome Configurazione:</label>
                            <input type="text" value="${name}" disabled style="background: var(--disabled-color);">
                        </div>
                        <div class="dc-form-group">
                            <label>Valore Override:</label>
                            <input type="text" name="setup_value" value="${cfg.value}" required>
                        </div>
                        <div class="dc-form-group">
                            <label>Data/Ora Inizio:</label>
                            <input type="datetime-local" name="valid_from" value="${formatForInput(cfg.valid_from_date)}" required>
                        </div>
                        <div class="dc-form-group">
                            <label>Data/Ora Fine:</label>
                            <input type="datetime-local" name="valid_to" value="${formatForInput(cfg.valid_to_date)}" required>
                        </div>
                        <div class="dc-form-group">
                            <label>Priorità:</label>
                            <input type="number" name="priority" value="${cfg.priority || 99}" required>
                            <small style="color: var(--secondary-text-color);">Più basso = più prioritario</small>
                        </div>
                        ${timeFilterHtml}
                        ${daysFilterHtml}
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="dc-btn">Salva</button>
                            <button type="button" class="dc-btn" onclick="window.dcCloseEditModal(this)" style="background: #666;">Annulla</button>
                        </div>
                    </form>
                `;
                
                // Dopo aver mostrato il modal, imposta i valori dei selettori se presenti
                if (hasTimeFilter) {
                    setTimeout(() => {
                        const fromHour = Math.floor(cfg.valid_from_ora);
                        const fromMinute = Math.round((cfg.valid_from_ora - fromHour) * 60);
                        const toHour = Math.floor(cfg.valid_to_ora);
                        const toMinute = Math.round((cfg.valid_to_ora - toHour) * 60);
                        
                        content.querySelector('#edit-time-from-hour').value = fromHour;
                        content.querySelector('#edit-time-from-minute').value = fromMinute;
                        content.querySelector('#edit-time-to-hour').value = toHour;
                        content.querySelector('#edit-time-to-minute').value = toMinute;
                    }, 10);
                }
            } else if (type === 'schedule') {
                // Converti ore decimali a ore e minuti per i selettori
                const fromHour = Math.floor(cfg.valid_from_ora);
                const fromMinute = Math.round((cfg.valid_from_ora - fromHour) * 60);
                const toHour = Math.floor(cfg.valid_to_ora);
                const toMinute = Math.round((cfg.valid_to_ora - toHour) * 60);
                
                const daysOfWeek = cfg.days_of_week || [0,1,2,3,4,5,6];
                const dayCheckboxes = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map((day, i) => 
                    `<label class="dc-checkbox-label">
                        <input type="checkbox" name="days" value="${i}" ${daysOfWeek.includes(i) ? 'checked' : ''}> ${day}
                    </label>`
                ).join('');
                
                formHtml = `
                    <form id="dc-edit-form">
                        <div class="dc-form-group">
                            <label>Nome Configurazione:</label>
                            <input type="text" value="${name}" disabled style="background: var(--disabled-color);">
                        </div>
                        <div class="dc-form-group">
                            <label>Valore Override:</label>
                            <input type="text" name="setup_value" value="${cfg.value}" required>
                        </div>
                        <div class="dc-form-group">
                            <label>Fascia Oraria:</label>
                            <div class="dc-time-picker">
                                <div>
                                    <label style="font-size: 12px; margin-bottom: 4px;">Dalle:</label>
                                    <div class="dc-time-input">
                                        <select id="edit-from-hour" required>
                                            ${instance.generateHourOptions(0, 23)}
                                        </select>
                                        <span class="dc-time-separator">:</span>
                                        <select id="edit-from-minute" required>
                                            ${instance.generateMinuteOptions()}
                                        </select>
                                    </div>
                                </div>
                                <span style="font-size: 18px; align-self: flex-end; padding-bottom: 8px;">→</span>
                                <div>
                                    <label style="font-size: 12px; margin-bottom: 4px;">Alle:</label>
                                    <div class="dc-time-input">
                                        <select id="edit-to-hour" required>
                                            ${instance.generateHourOptions(0, 23)}
                                        </select>
                                        <span class="dc-time-separator">:</span>
                                        <select id="edit-to-minute" required>
                                            ${instance.generateMinuteOptions()}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="dc-form-group">
                            <label>Giorni della Settimana:</label>
                            <div class="dc-checkbox-group">
                                ${dayCheckboxes}
                            </div>
                        </div>
                        <div class="dc-form-group">
                            <label>Priorità:</label>
                            <input type="number" name="priority" value="${cfg.priority || 99}" required>
                            <small style="color: var(--secondary-text-color);">Più basso = più prioritario</small>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="dc-btn">Salva</button>
                            <button type="button" class="dc-btn" onclick="window.dcCloseEditModal(this)" style="background: #666;">Annulla</button>
                        </div>
                    </form>
                `;
                
                // Dopo aver mostrato il modal, imposta i valori dei selettori
                setTimeout(() => {
                    content.querySelector('#edit-from-hour').value = fromHour;
                    content.querySelector('#edit-from-minute').value = fromMinute;
                    content.querySelector('#edit-to-hour').value = toHour;
                    content.querySelector('#edit-to-minute').value = toMinute;
                }, 10);
            } else if (type === 'conditional') {
                // Form per modifica configurazione condizionale
                const hasTimeFilter = cfg.valid_from_ora !== undefined && cfg.valid_to_ora !== undefined;
                
                let timeFilterHtml = '';
                if (hasTimeFilter) {
                    const fromHour = Math.floor(cfg.valid_from_ora);
                    const fromMinute = Math.round((cfg.valid_from_ora - fromHour) * 60);
                    const toHour = Math.floor(cfg.valid_to_ora);
                    const toMinute = Math.round((cfg.valid_to_ora - toHour) * 60);
                    
                    timeFilterHtml = `
                        <div class="dc-form-group">
                            <label>
                                <input type="checkbox" id="edit-conditional-enable-hours" checked> Limita a fascia oraria
                            </label>
                            <div id="edit-conditional-hours-container" style="margin-top: 10px;">
                                <div class="dc-time-picker">
                                    <div>
                                        <label style="font-size: 12px; margin-bottom: 4px;">Dalle:</label>
                                        <div class="dc-time-input">
                                            <select id="edit-conditional-from-hour">
                                                ${instance.generateHourOptions(0, 23)}
                                            </select>
                                            <span class="dc-time-separator">:</span>
                                            <select id="edit-conditional-from-minute">
                                                ${instance.generateMinuteOptions()}
                                            </select>
                                        </div>
                                    </div>
                                    <span style="font-size: 18px; align-self: flex-end; padding-bottom: 8px;">→</span>
                                    <div>
                                        <label style="font-size: 12px; margin-bottom: 4px;">Alle:</label>
                                        <div class="dc-time-input">
                                            <select id="edit-conditional-to-hour">
                                                ${instance.generateHourOptions(0, 23)}
                                            </select>
                                            <span class="dc-time-separator">:</span>
                                            <select id="edit-conditional-to-minute">
                                                ${instance.generateMinuteOptions()}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    timeFilterHtml = `
                        <div class="dc-form-group">
                            <label>
                                <input type="checkbox" id="edit-conditional-enable-hours"> Limita a fascia oraria
                            </label>
                            <div id="edit-conditional-hours-container" style="display: none; margin-top: 10px;">
                                <div class="dc-time-picker">
                                    <div>
                                        <label style="font-size: 12px; margin-bottom: 4px;">Dalle:</label>
                                        <div class="dc-time-input">
                                            <select id="edit-conditional-from-hour">
                                                ${instance.generateHourOptions(0, 23)}
                                            </select>
                                            <span class="dc-time-separator">:</span>
                                            <select id="edit-conditional-from-minute">
                                                ${instance.generateMinuteOptions()}
                                            </select>
                                        </div>
                                    </div>
                                    <span style="font-size: 18px; align-self: flex-end; padding-bottom: 8px;">→</span>
                                    <div>
                                        <label style="font-size: 12px; margin-bottom: 4px;">Alle:</label>
                                        <div class="dc-time-input">
                                            <select id="edit-conditional-to-hour">
                                                ${instance.generateHourOptions(0, 23)}
                                            </select>
                                            <span class="dc-time-separator">:</span>
                                            <select id="edit-conditional-to-minute">
                                                ${instance.generateMinuteOptions()}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                formHtml = `
                    <form id="dc-edit-form">
                        <div class="dc-form-group">
                            <label>Nome Configurazione:</label>
                            <input type="text" value="${name}" disabled style="background: var(--disabled-color);">
                        </div>
                        <div class="dc-form-group">
                            <label>Valore:</label>
                            <input type="text" name="setup_value" value="${cfg.value}" required>
                        </div>
                        <div class="dc-form-group">
                            <label>Configurazione Sorgente:</label>
                            <input type="text" value="${cfg.conditional_config}" disabled style="background: var(--disabled-color);">
                        </div>
                        <div class="dc-form-group">
                            <label>Operatore:</label>
                            <input type="text" value="${cfg.conditional_operator}" disabled style="background: var(--disabled-color);">
                        </div>
                        <div class="dc-form-group">
                            <label>Valore di Confronto:</label>
                            <input type="text" value="${cfg.conditional_value}" disabled style="background: var(--disabled-color);">
                        </div>
                        ${timeFilterHtml}
                        <div class="dc-form-group">
                            <label>Priorità:</label>
                            <input type="number" name="priority" value="${cfg.priority || 99}" required>
                            <small style="color: var(--secondary-text-color);">Più basso = più prioritario</small>
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="dc-btn">Salva</button>
                            <button type="button" class="dc-btn" onclick="window.dcCloseEditModal(this)" style="background: #666;">Annulla</button>
                        </div>
                    </form>
                `;
                
                // Dopo aver mostrato il modal, imposta i valori dei selettori se presenti
                if (hasTimeFilter) {
                    setTimeout(() => {
                        const fromHour = Math.floor(cfg.valid_from_ora);
                        const fromMinute = Math.round((cfg.valid_from_ora - fromHour) * 60);
                        const toHour = Math.floor(cfg.valid_to_ora);
                        const toMinute = Math.round((cfg.valid_to_ora - toHour) * 60);
                        
                        content.querySelector('#edit-conditional-from-hour').value = fromHour;
                        content.querySelector('#edit-conditional-from-minute').value = fromMinute;
                        content.querySelector('#edit-conditional-to-hour').value = toHour;
                        content.querySelector('#edit-conditional-to-minute').value = toMinute;
                    }, 10);
                }
            }
            
            modalBody.innerHTML = formHtml;
            modal.classList.add('active');
            
            // Aggiungi event listener per i checkbox toggle
            if (type === 'time') {
                const enableHoursCheckbox = content.querySelector('#edit-time-enable-hours');
                const enableDaysCheckbox = content.querySelector('#edit-time-enable-days');
                
                if (enableHoursCheckbox) {
                    enableHoursCheckbox.addEventListener('change', (e) => {
                        const container = content.querySelector('#edit-time-hours-container');
                        if (container) {
                            container.style.display = e.target.checked ? 'block' : 'none';
                        }
                    });
                }
                
                if (enableDaysCheckbox) {
                    enableDaysCheckbox.addEventListener('change', (e) => {
                        const container = content.querySelector('#edit-time-days-container');
                        if (container) {
                            container.style.display = e.target.checked ? 'block' : 'none';
                        }
                    });
                }
            } else if (type === 'conditional') {
                const enableHoursCheckbox = content.querySelector('#edit-conditional-enable-hours');
                
                if (enableHoursCheckbox) {
                    enableHoursCheckbox.addEventListener('change', (e) => {
                        const container = content.querySelector('#edit-conditional-hours-container');
                        if (container) {
                            container.style.display = e.target.checked ? 'block' : 'none';
                        }
                    });
                }
            }
            
            // Gestione submit del form
            const editForm = content.querySelector('#dc-edit-form');
            if (!editForm) {
                console.error('Form di edit non trovato nel DOM');
                return;
            }
            
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                
                try {
                    if (type === 'standard') {
                        // Usa update_standard_config per aggiornare configurazioni esistenti
                        const serviceData = {
                            config_id: parseInt(id),
                            setup_value: formData.get('setup_value'),
                            priority: parseInt(formData.get('priority'))
                        };
                        
                        // Aggiungi descrizione se presente
                        const description = formData.get('description');
                        if (description && description.trim()) {
                            serviceData.description = description.trim();
                        }
                        
                        await instance.callMiaConfigService('update_standard_config', serviceData);
                    } else if (type === 'time') {
                        // Prima elimina la vecchia configurazione
                        await instance.callMiaConfigService('delete_single_config', {
                            config_type: 'time',
                            config_id: parseInt(id)
                        });
                        
                        // Poi crea la nuova
                        const formatDateTime = (dt) => dt.replace('T', ' ') + ':00';
                        const serviceData = {
                            setup_name: name,
                            setup_value: formData.get('setup_value'),
                            valid_from: formatDateTime(formData.get('valid_from')),
                            valid_to: formatDateTime(formData.get('valid_to')),
                            priority: parseInt(formData.get('priority'))
                        };
                        
                        // Aggiungi filtro orario se abilitato
                        const enableHours = content.querySelector('#edit-time-enable-hours');
                        if (enableHours && enableHours.checked) {
                            const fromHour = parseInt(content.querySelector('#edit-time-from-hour').value);
                            const fromMinute = parseInt(content.querySelector('#edit-time-from-minute').value);
                            const toHour = parseInt(content.querySelector('#edit-time-to-hour').value);
                            const toMinute = parseInt(content.querySelector('#edit-time-to-minute').value);
                            
                            serviceData.valid_from_ora = instance.timeSelectorsToDecimal(fromHour, fromMinute);
                            serviceData.valid_to_ora = instance.timeSelectorsToDecimal(toHour, toMinute);
                        }
                        
                        // Aggiungi filtro giorni se abilitato
                        const enableDays = content.querySelector('#edit-time-enable-days');
                        if (enableDays && enableDays.checked) {
                            const days = Array.from(content.querySelectorAll('#dc-edit-form input[name="edit-time-days"]:checked'))
                                .map(cb => parseInt(cb.value));
                            serviceData.days_of_week = days.join(',');
                        }
                        
                        await instance.callMiaConfigService('set_time_config', serviceData);
                    } else if (type === 'schedule') {
                        // Prima elimina la vecchia configurazione
                        await instance.callMiaConfigService('delete_single_config', {
                            config_type: 'schedule',
                            config_id: parseInt(id)
                        });
                        
                        // Poi crea la nuova
                        const days = Array.from(content.querySelectorAll('#dc-edit-form input[name="days"]:checked'))
                            .map(cb => parseInt(cb.value));
                        
                        const fromHour = parseInt(content.querySelector('#edit-from-hour').value);
                        const fromMinute = parseInt(content.querySelector('#edit-from-minute').value);
                        const toHour = parseInt(content.querySelector('#edit-to-hour').value);
                        const toMinute = parseInt(content.querySelector('#edit-to-minute').value);
                        
                        await instance.callMiaConfigService('set_schedule_config', {
                            setup_name: name,
                            setup_value: formData.get('setup_value'),
                            valid_from_ora: instance.timeSelectorsToDecimal(fromHour, fromMinute),
                            valid_to_ora: instance.timeSelectorsToDecimal(toHour, toMinute),
                            days_of_week: days,
                            priority: parseInt(formData.get('priority'))
                        });
                    } else if (type === 'conditional') {
                        // Prima elimina la vecchia configurazione
                        await instance.callMiaConfigService('delete_single_config', {
                            config_type: 'conditional',
                            config_id: parseInt(id)
                        });
                        
                        // Poi crea la nuova con gli stessi parametri condizionali
                        const serviceData = {
                            setup_name: name,
                            setup_value: formData.get('setup_value'),
                            conditional_config: cfg.conditional_config,
                            conditional_operator: cfg.conditional_operator,
                            conditional_value: cfg.conditional_value,
                            priority: parseInt(formData.get('priority'))
                        };
                        
                        // Aggiungi fascia oraria se abilitata
                        const enableHours = content.querySelector('#edit-conditional-enable-hours');
                        if (enableHours && enableHours.checked) {
                            const fromHour = parseInt(content.querySelector('#edit-conditional-from-hour').value);
                            const fromMinute = parseInt(content.querySelector('#edit-conditional-from-minute').value);
                            const toHour = parseInt(content.querySelector('#edit-conditional-to-hour').value);
                            const toMinute = parseInt(content.querySelector('#edit-conditional-to-minute').value);
                            
                            serviceData.valid_from_ora = instance.timeSelectorsToDecimal(fromHour, fromMinute);
                            serviceData.valid_to_ora = instance.timeSelectorsToDecimal(toHour, toMinute);
                        }
                        
                        await instance.callMiaConfigService('set_conditional_config', serviceData);
                    }
                    
                    window.dcCloseEditModal(this);
                    instance.showToast('Configurazione modificata!');
                    setTimeout(() => instance.loadConfigurations(), 500);
                } catch (err) {
                    console.error('Errore modifica:', err);
                    instance.showToast('Errore: ' + err.message, true);
                }
            });
        };
        
        // Funzioni per modal di inserimento configurazione
        window.dcOpenAddConfigModal = () => {
            // Chiudi il modal di edit se è aperto
            const editModal = window._miaConfigCardInstance.content.querySelector('#dc-edit-modal');
            if (editModal && editModal.classList.contains('active')) {
                editModal.classList.remove('active');
            }
            
            const modal = window._miaConfigCardInstance.content.querySelector('#dc-add-config-modal');
            modal.classList.add('active');
            // Carica le configurazioni standard per i select
            this.loadStandardConfigsForSelect();
            // Reimposta il form
            const typeSelector = window._miaConfigCardInstance.content.querySelector('#modal-config-type-selector');
            if (typeSelector) {
                typeSelector.value = 'time';
                window.dcShowModalConfigForm('time');
            }
        };
        
        window.dcCloseAddConfigModal = () => {
            const modal = window._miaConfigCardInstance.content.querySelector('#dc-add-config-modal');
            modal.classList.remove('active');
        };
        
        window.dcShowModalConfigForm = (formType) => {
            // Nascondi tutti i form
            window._miaConfigCardInstance.content.querySelectorAll('[id^="modal-form-container-"]').forEach(container => {
                container.style.display = 'none';
            });
            
            // Mostra il form selezionato
            const container = window._miaConfigCardInstance.content.querySelector(`#modal-form-container-${formType}`);
            if (container) {
                container.style.display = 'block';
                
                // Carica le configurazioni standard per i select
                if (formType === 'schedule' || formType === 'time' || formType === 'conditional') {
                    this.loadStandardConfigsForSelect();
                }
            }
        };
        
        window.dcCloseEditModal = (cardElement) => {
            const modal = cardElement.content.querySelector('#dc-edit-modal');
            if (modal) {
                modal.classList.remove('active');
            }
        };
        
        window.dcShowWeeklyEventModal = (cardElement, barElement) => {
            const instance = cardElement._instance;
            const content = instance.content;
            
            try {
                const modal = content.querySelector('#dc-weekly-event-modal');
                const modalBody = content.querySelector('#dc-weekly-event-modal-body');
                
                if (!modalBody || !modal) {
                    console.error('Modal elements not found:', {modalBody, modal});
                    return;
                }
                
                // Estrai i dati del segmento dall'attributo data-segment
                const segmentData = barElement.getAttribute('data-segment');
                if (!segmentData) {
                    console.error('No segment data found in barElement');
                    return;
                }
                
                const segment = JSON.parse(segmentData);
                
                // Genera l'HTML del contenuto usando la stessa logica del tooltip ma formattato meglio
                const startHour = Math.floor(segment.startTime / 60);
                const startMin = segment.startTime % 60;
                const endHour = Math.floor(segment.endTime / 60);
                const endMin = segment.endTime % 60;
                
                let html = `<div style="padding: 10px;">`;
                html += `<div style="background: var(--secondary-background-color); padding: 15px; border-radius: 8px; margin-bottom: 15px;">`;
                html += `<div style="font-size: 20px; font-weight: bold; margin-bottom: 8px;">Valore: ${escapeHtml(String(segment.value))}</div>`;
                html += `<div style="font-size: 16px; color: var(--secondary-text-color);">`;
                html += `⏰ ${String(startHour).padStart(2,'0')}:${String(startMin).padStart(2,'0')} - ${String(endHour).padStart(2,'0')}:${String(endMin).padStart(2,'0')}`;
                html += `</div>`;
                html += `</div>`;
                
                if (segment.type === 'time') {
                    const hasDates = segment.from instanceof Date && segment.to instanceof Date && !Number.isNaN(segment.from) && !Number.isNaN(segment.to);
                    html += `<div style="margin-bottom: 15px;">`;
                    html += `<div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">⏰ Override Temporale</div>`;
                    if (hasDates) {
                        const fromStr = `${segment.from.getDate()}/${segment.from.getMonth()+1}/${segment.from.getFullYear()} ${String(segment.from.getHours()).padStart(2,'0')}:${String(segment.from.getMinutes()).padStart(2,'0')}`;
                        const toStr = `${segment.to.getDate()}/${segment.to.getMonth()+1}/${segment.to.getFullYear()} ${String(segment.to.getHours()).padStart(2,'0')}:${String(segment.to.getMinutes()).padStart(2,'0')}`;
                        html += `<div style="color: var(--secondary-text-color); line-height: 1.8;">`;
                        html += `<strong>Periodo completo:</strong><br>`;
                        html += `📅 Dal: ${fromStr}<br>`;
                        html += `📅 Al: ${toStr}`;
                        html += `</div>`;
                    } else {
                        html += `<div style="color: var(--secondary-text-color);">Periodo temporale attivo</div>`;
                    }
                    html += `</div>`;
                } else if (segment.type === 'schedule') {
                    const daysStr = segment.days ? segment.days.map(d => ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'][d]).join(', ') : 'N/D';
                    const fromTotalMin = Math.round(segment.validFrom * 60);
                    const fromHour = Math.floor(fromTotalMin / 60);
                    const fromMin = fromTotalMin % 60;
                    const toTotalMin = Math.round(segment.validTo * 60);
                    const toHour = Math.floor(toTotalMin / 60);
                    const toMin = toTotalMin % 60;
                    
                    html += `<div style="margin-bottom: 15px;">`;
                    html += `<div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">🕐 Override Orario</div>`;
                    html += `<div style="color: var(--secondary-text-color); line-height: 1.8;">`;
                    html += `<strong>Fascia configurata:</strong><br>`;
                    html += `⏰ ${String(fromHour).padStart(2,'0')}:${String(fromMin).padStart(2,'0')} - ${String(toHour).padStart(2,'0')}:${String(toMin).padStart(2,'0')}<br>`;
                    html += `<strong>Giorni:</strong> ${daysStr}`;
                    if (segment.validTo < segment.validFrom) {
                        html += `<br><em style="font-size: 14px;">(attraversa la mezzanotte)</em>`;
                    }
                    html += `</div>`;
                    html += `</div>`;
                } else if (segment.type === 'conditional') {
                    html += `<div style="margin-bottom: 15px;">`;
                    html += `<div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">🎯 Override Condizionale</div>`;
                    html += `<div style="color: var(--secondary-text-color); line-height: 1.8;">`;
                    html += `<strong>Condizione:</strong> ${escapeHtml(String(segment.condition || 'N/D'))}<br>`;
                    html += `<strong>Entità:</strong> ${escapeHtml(String(segment.entity || 'N/D'))}`;
                    const hasWindow = typeof segment.validFrom === 'number' && typeof segment.validTo === 'number';
                    if (hasWindow) {
                        const fromTotalMin = Math.round(segment.validFrom * 60);
                        const fromHour = Math.floor(fromTotalMin / 60);
                        const fromMin = fromTotalMin % 60;
                        const toTotalMin = Math.round(segment.validTo * 60);
                        const toHour = Math.floor(toTotalMin / 60);
                        const toMin = toTotalMin % 60;
                        html += `<br><strong>Fascia oraria:</strong> ${String(fromHour).padStart(2,'0')}:${String(fromMin).padStart(2,'0')} - ${String(toHour).padStart(2,'0')}:${String(toMin).padStart(2,'0')}`;
                        if (segment.validTo < segment.validFrom) {
                            html += `<br><em style="font-size: 14px;">(attraversa la mezzanotte)</em>`;
                        }
                    }
                    html += `</div>`;
                    html += `</div>`;
                } else if (segment.type === 'standard') {
                    html += `<div style="margin-bottom: 15px;">`;
                    html += `<div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">⚙️ Valore Standard</div>`;
                    html += `<div style="color: var(--secondary-text-color);">`;
                    html += `<strong>Priorità:</strong> ${segment.priority || 99}`;
                    html += `</div>`;
                    html += `</div>`;
                }
                
                html += `<div style="margin-top: 15px; padding: 12px; background: var(--secondary-background-color); border-radius: 6px; font-size: 14px; color: var(--secondary-text-color);">`;
                html += `💡 <strong>Suggerimento:</strong> Su desktop, puoi passare il mouse sulle barre per vedere rapidamente i dettagli.`;
                html += `</div>`;
                
                html += `</div>`;
                
                modalBody.innerHTML = html;
                modal.classList.add('active');
            } catch (error) {
                console.error('Errore apertura modal dettagli evento:', error);
            }
        };
        
        window.dcCloseWeeklyEventModal = (cardElement) => {
            const modal = cardElement.content.querySelector('#dc-weekly-event-modal');
            if (modal) {
                modal.classList.remove('active');
            }
        };
        
        window.dcLoadHistory = async (page = 1) => {
            const container = window._miaConfigCardInstance.content.querySelector('#dc-history-list');
            const filterInput = window._miaConfigCardInstance.content.querySelector('#history-filter');
            const setupName = filterInput ? filterInput.value.trim() : '';
            
            const itemsPerPage = 20;
            const offset = (page - 1) * itemsPerPage;
            
            container.innerHTML = 'Caricamento storico...';
            
            try {
                const entityId = this.getSelectedEntityId();
                const serviceData = {
                    setup_name: setupName || undefined,
                    limit: itemsPerPage,
                    offset: offset
                };
                if (entityId) {
                    serviceData.entity_id = entityId;
                }
                
                const result = await this._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'get_history',
                    service_data: serviceData,
                    return_response: true
                });
                
                const history = result.response?.history || result.response || [];
                const total = result.response?.total || history.length;
                console.log('Storico caricato:', history, 'Totale:', total);
                
                if (!Array.isArray(history) || history.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: var(--secondary-text-color);">Nessuna voce nello storico</p>';
                    return;
                }
                
                const totalPages = Math.ceil(total / itemsPerPage);
                
                let html = '<div style="overflow-x: auto;">';
                html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
                html += '<thead><tr style="background: var(--primary-color); color: white;">';
                html += '<th style="padding: 8px; text-align: left;">Data/Ora</th>';
                html += '<th style="padding: 8px; text-align: left;">Nome</th>';
                html += '<th style="padding: 8px; text-align: left;">Tipo</th>';
                html += '<th style="padding: 8px; text-align: left;">Valore</th>';
                html += '<th style="padding: 8px; text-align: left;">Operazione</th>';
                html += '<th style="padding: 8px; text-align: center;">Azioni</th>';
                html += '</tr></thead><tbody>';
                
                for (const entry of history) {
                    const opColor = entry.operation === 'DELETE' ? '#f44336' : 
                                   entry.operation === 'UPDATE' ? '#ff9800' : 
                                   entry.operation === 'DISABLE' ? '#d32f2f' : 
                                   entry.operation === 'ENABLE' ? '#2e7d32' : '#4caf50';
                    const typeLabel = entry.config_type === 'time' ? '⏰ Tempo' :
                                     entry.config_type === 'schedule' ? '📅 Orario' :
                                     entry.config_type === 'conditional' ? '🎯 Condizionale' : '⚙️ Standard';
                    
                    let details = entry.setup_value || '-';
                    if (entry.config_type === 'schedule' && entry.valid_from_ora != null) {
                        const fromTime = String(entry.valid_from_ora).replace('.', ':');
                        const toTime = String(entry.valid_to_ora).replace('.', ':');
                        details += ` (${fromTime} → ${toTime})`;
                    } else if (entry.config_type === 'time' && entry.valid_from_date) {
                        details += ` (${entry.valid_from_date} - ${entry.valid_to_date})`;
                    } else if (entry.config_type === 'standard' && entry.priority) {
                        details += ` (P:${entry.priority})`;
                    } else if (entry.config_type === 'conditional' && entry.conditional_config) {
                        details += ` (${entry.conditional_config} ${entry.conditional_operator || ''} ${entry.conditional_value || ''})`;
                    }
                    
                    html += `<tr style="border-bottom: 1px solid var(--divider-color);">`;
                    html += `<td style="padding: 8px;">${entry.timestamp}</td>`;
                    html += `<td style="padding: 8px;"><strong>${entry.setup_name}</strong></td>`;
                    html += `<td style="padding: 8px;">${typeLabel}</td>`;
                    html += `<td style="padding: 8px;">${details}</td>`;
                    html += `<td style="padding: 8px;"><span style="color: ${opColor}; font-weight: bold;">${entry.operation}</span></td>`;
                    html += `<td style="padding: 8px; text-align: center;">`;
                    
                    if (entry.operation === 'DELETE') {
                        html += `<button class="dc-btn" style="padding: 4px 8px; font-size: 11px;" onclick="window.dcRestoreFromHistory(${entry.id})">↩️ Ripristina</button>`;
                    } else {
                        html += '-';
                    }
                    
                    html += `</td></tr>`;
                }
                
                html += '</tbody></table></div>';
                
                // Paginazione
                if (totalPages > 1) {
                    html += '<div style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 15px; padding: 10px;">';
                    
                    // Pulsante Prima pagina
                    if (page > 1) {
                        html += `<button class="dc-btn" onclick="window.dcLoadHistory(1)" style="padding: 5px 10px;">« Prima</button>`;
                        html += `<button class="dc-btn" onclick="window.dcLoadHistory(${page - 1})" style="padding: 5px 10px;">‹ Precedente</button>`;
                    }
                    
                    // Info pagina
                    html += `<span style="margin: 0 10px; color: var(--primary-text-color);">Pagina ${page} di ${totalPages} (${total} elementi)</span>`;
                    
                    // Pulsante Prossima pagina
                    if (page < totalPages) {
                        html += `<button class="dc-btn" onclick="window.dcLoadHistory(${page + 1})" style="padding: 5px 10px;">Successiva ›</button>`;
                        html += `<button class="dc-btn" onclick="window.dcLoadHistory(${totalPages})" style="padding: 5px 10px;">Ultima »</button>`;
                    }
                    
                    html += '</div>';
                }
                
                container.innerHTML = html;
                
            } catch (err) {
                console.error('Errore caricamento storico:', err);
                container.innerHTML = '<p style="color: var(--error-color);">Errore nel caricamento dello storico</p>';
            }
        };
        
        window.dcLoadValidValues = async () => {
            const select = window._miaConfigCardInstance.content.querySelector('#vv-config-select');
            const setupName = select.value;
            const container = window._miaConfigCardInstance.content.querySelector('#dc-valid-values-list');
            
            if (!setupName) {
                container.innerHTML = 'Seleziona una configurazione per gestire i valori validi';
                return;
            }
            
            container.innerHTML = 'Caricamento...';
            
            try {
                const entityId = this.getSelectedEntityId();
                const serviceData = {
                    setup_name: setupName
                };
                if (entityId) {
                    serviceData.entity_id = entityId;
                }
                
                const response = await this._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'get_valid_values',
                    service_data: serviceData,
                    return_response: true
                });
                
                const validValues = response.response.valid_values || [];
                
                if (validValues.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: var(--secondary-text-color);">Nessun valore valido definito per questa configurazione</p>';
                    return;
                }
                
                let html = '<div class="dc-table-responsive"><table class="dc-table"><thead><tr>';
                html += '<th>Valore</th><th>Descrizione</th><th>Ordine</th><th>Azioni</th>';
                html += '</tr></thead><tbody>';
                
                for (const vv of validValues) {
                    html += '<tr>';
                    html += `<td style="font-weight: 500;">${vv.value || ''}</td>`;
                    html += `<td>${vv.description || '-'}</td>`;
                    html += `<td>${vv.sort_order || 0}</td>`;
                    html += `<td>
                        <button class="dc-btn" onclick="window.dcEditValidValue(${vv.id}, '${vv.value}', '${(vv.description || '').replace(/'/g, "\\'")}', ${vv.sort_order || 0})" style="padding: 5px 10px; margin-right: 5px;">✏️ Modifica</button>
                        <button class="dc-btn-danger" onclick="window.dcDeleteValidValue(${vv.id}, '${setupName}')" style="padding: 5px 10px;">🗑️ Elimina</button>
                    </td>`;
                    html += '</tr>';
                }
                
                html += '</tbody></table></div>';
                container.innerHTML = html;
                
            } catch (err) {
                console.error('Errore caricamento valori validi:', err);
                container.innerHTML = '<p style="color: var(--error-color);">Errore nel caricamento dei valori validi</p>';
            }
        };
        
        window.dcShowAddValidValueForm = () => {
            const form = window._miaConfigCardInstance.content.querySelector('#dc-add-valid-value-form');
            const select = window._miaConfigCardInstance.content.querySelector('#vv-config-select');
            
            if (!select.value) {
                window._miaConfigCardInstance.showToast('Seleziona prima una configurazione', true);
                return;
            }
            
            // Reset form per nuovo inserimento
            form.style.display = 'block';
            form.dataset.editId = ''; // Rimuove ID se era in modalità modifica
            window._miaConfigCardInstance.content.querySelector('#vv-value').value = '';
            window._miaConfigCardInstance.content.querySelector('#vv-value').disabled = false; // Riabilita campo valore
            window._miaConfigCardInstance.content.querySelector('#vv-description').value = '';
            window._miaConfigCardInstance.content.querySelector('#vv-sort-order').value = '0';
            form.querySelector('h4').textContent = 'Aggiungi Valore Valido';
        };
        
        window.dcEditValidValue = (id, value, description, sortOrder) => {
            const form = window._miaConfigCardInstance.content.querySelector('#dc-add-valid-value-form');
            const select = window._miaConfigCardInstance.content.querySelector('#vv-config-select');
            
            if (!select.value) {
                window._miaConfigCardInstance.showToast('Errore: nessuna configurazione selezionata', true);
                return;
            }
            
            // Mostra form in modalità modifica
            form.style.display = 'block';
            form.dataset.editId = id; // Salva ID per la modifica
            window._miaConfigCardInstance.content.querySelector('#vv-value').value = value;
            window._miaConfigCardInstance.content.querySelector('#vv-value').disabled = true; // Blocca modifica valore
            window._miaConfigCardInstance.content.querySelector('#vv-description').value = description;
            window._miaConfigCardInstance.content.querySelector('#vv-sort-order').value = sortOrder;
            form.querySelector('h4').textContent = 'Modifica Valore Valido';
            
            // Scroll al form
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        
        window.dcHideAddValidValueForm = () => {
            const form = window._miaConfigCardInstance.content.querySelector('#dc-add-valid-value-form');
            form.style.display = 'none';
            form.dataset.editId = ''; // Reset ID
        };
        
        // Carica valori validi per i form override e cambia input in select se necessario
        window.dcLoadValidValuesForForm = async (formType) => {
            const selectId = formType === 'schedule' ? '#modal-schedule-config-select' : (formType === 'time' ? '#modal-time-config-select' : '#modal-conditional-config-select');
            const containerId = formType === 'schedule' ? '#modal-schedule-value-container' : (formType === 'time' ? '#modal-time-value-container' : '#modal-conditional-value-container');
            const inputId = formType === 'schedule' ? '#modal-schedule-setup-value' : (formType === 'time' ? '#modal-time-setup-value' : '#modal-conditional-setup-value');
            
            const configSelect = window._miaConfigCardInstance.content.querySelector(selectId);
            const container = window._miaConfigCardInstance.content.querySelector(containerId);
            const setupName = configSelect.value;
            
            if (!setupName) {
                // Nessuna configurazione selezionata, mostra input text
                container.innerHTML = `<input type="text" id="${inputId.substring(1)}" name="setup_value" required placeholder="es. 20">`;
                return;
            }
            
            try {
                const entityId = this.getSelectedEntityId();
                const serviceData = { setup_name: setupName };
                if (entityId) {
                    serviceData.entity_id = entityId;
                }
                
                const response = await this._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'get_valid_values',
                    service_data: serviceData,
                    return_response: true
                });
                
                const validValues = response.response.valid_values || [];
                const allowFreeText = formType === 'conditional' && validValues.some(vv => vv.value === '%');
                
                if (validValues.length === 0) {
                    // Nessun valore valido, mostra input text
                    container.innerHTML = `<input type="text" id="${inputId.substring(1)}" name="setup_value" required placeholder="Inserisci valore">`;
                } else if (allowFreeText) {
                    const datalistId = `${inputId.substring(1)}-datalist`;
                    let html = `<input type="text" id="${inputId.substring(1)}" name="setup_value" required list="${datalistId}" placeholder="Inserisci o seleziona valore" style="width: 100%;">`;
                    html += `<datalist id="${datalistId}">`;
                    for (const vv of validValues) {
                        const label = vv.description ? `${vv.value} (${vv.description})` : vv.value;
                        html += `<option value="${vv.value}">${label}</option>`;
                    }
                    html += '</datalist>';
                    html += '<small style="color: var(--secondary-text-color); display: block; margin-top: 5px;">Suggerimenti disponibili; % abilita valori liberi</small>';
                    container.innerHTML = html;
                } else {
                    // Ci sono valori validi, mostra select
                    let html = `<select id="${inputId.substring(1)}" name="setup_value" required style="width: 100%;">`;
                    html += '<option value="">-- Seleziona valore --</option>';
                    for (const vv of validValues) {
                        const description = vv.description ? ` - ${vv.description}` : '';
                        html += `<option value="${vv.value}">${vv.value}${description}</option>`;
                    }
                    html += '</select>';
                    html += '<small style="color: var(--secondary-text-color); display: block; margin-top: 5px;">✓ Valori predefiniti disponibili</small>';
                    container.innerHTML = html;
                }
            } catch (err) {
                console.error('Errore caricamento valori validi per form:', err);
                // In caso di errore, mostra input text
                container.innerHTML = `<input type="text" id="${inputId.substring(1)}" name="setup_value" required placeholder="Inserisci valore">`;
            }
        };
        
        window.dcSaveValidValue = async () => {
            const select = window._miaConfigCardInstance.content.querySelector('#vv-config-select');
            const setupName = select.value;
            const value = window._miaConfigCardInstance.content.querySelector('#vv-value').value.trim();
            const description = window._miaConfigCardInstance.content.querySelector('#vv-description').value.trim();
            const sortOrder = parseInt(window._miaConfigCardInstance.content.querySelector('#vv-sort-order').value) || 0;
            
            if (!setupName) {
                window._miaConfigCardInstance.showToast('Seleziona una configurazione', true);
                return;
            }
            
            if (!value) {
                window._miaConfigCardInstance.showToast('Il valore è obbligatorio', true);
                return;
            }
            
            try {
                const entityId = this.getSelectedEntityId();
                const serviceData = {
                    setup_name: setupName,
                    value: value,
                    sort_order: sortOrder
                };
                
                // Aggiungi description solo se non è vuota
                if (description) {
                    serviceData.description = description;
                }
                
                if (entityId) {
                    serviceData.entity_id = entityId;
                }
                
                await this._hass.callService('mia_config', 'add_valid_value', serviceData);
                
                window._miaConfigCardInstance.showToast('Valore valido salvato');
                window.dcHideAddValidValueForm();
                window.dcLoadValidValues();
                
            } catch (err) {
                console.error('Errore salvataggio valore valido:', err);
                window._miaConfigCardInstance.showToast('Errore nel salvataggio', true);
            }
        };
        
        window.dcDeleteValidValue = async (id, setupName) => {
            if (!confirm('Eliminare questo valore valido?')) return;
            
            try {
                const entityId = this.getSelectedEntityId();
                const serviceData = { id: id };
                if (entityId) {
                    serviceData.entity_id = entityId;
                }
                
                await this._hass.callService('mia_config', 'delete_valid_value', serviceData);
                
                window._miaConfigCardInstance.showToast('Valore valido eliminato');
                window.dcLoadValidValues();
                
            } catch (err) {
                console.error('Errore eliminazione valore valido:', err);
                window._miaConfigCardInstance.showToast('Errore nell\'eliminazione', true);
            }
        };
        
        window.dcRestoreFromHistory = async (historyId) => {
            if (!confirm('Ripristinare questa configurazione?')) return;
            
            try {
                // Recupera i dettagli dalla storia
                const entityId = this.getSelectedEntityId();
                const serviceData = { limit: 1000 };
                if (entityId) {
                    serviceData.entity_id = entityId;
                }
                
                const result = await this._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'get_history',
                    service_data: serviceData,
                    return_response: true
                });
                
                const history = result.response?.history || result.response || [];
                const entry = Array.isArray(history) ? history.find(h => h.id === historyId) : null;
                
                if (!entry) {
                    window._miaConfigCardInstance.showToast('Voce storico non trovata', true);
                    return;
                }
                
                // Ricrea la configurazione in base al tipo
                if (entry.config_type === 'standard') {
                    await window._miaConfigCardInstance.callMiaConfigService('set_config', {
                        setup_name: entry.setup_name,
                        setup_value: entry.setup_value,
                        priority: entry.priority || 99
                    });
                } else if (entry.config_type === 'schedule') {
                    await window._miaConfigCardInstance.callMiaConfigService('set_schedule_config', {
                        setup_name: entry.setup_name,
                        setup_value: entry.setup_value,
                        valid_from_ora: parseFloat(entry.valid_from_ora),
                        valid_to_ora: parseFloat(entry.valid_to_ora),
                        days_of_week: entry.days_of_week ? entry.days_of_week.split(',').map(d => parseInt(d)) : [0,1,2,3,4,5,6]
                    });
                } else if (entry.config_type === 'time') {
                    await window._miaConfigCardInstance.callMiaConfigService('set_time_config', {
                        setup_name: entry.setup_name,
                        setup_value: entry.setup_value,
                        valid_from: entry.valid_from_date,
                        valid_to: entry.valid_to_date
                    });
                }
                
                window._miaConfigCardInstance.showToast('Configurazione ripristinata!');
                setTimeout(() => {
                    window._miaConfigCardInstance.loadConfigurations();
                    window.dcLoadHistory();
                }, 500);
                
            } catch (err) {
                console.error('Errore ripristino:', err);
                window._miaConfigCardInstance.showToast('Errore: ' + err.message, true);
            }
        };
    }
    
    renderConfigurationsByOverride(validConfigs, container) {
        // Raggruppa tutte le configurazioni per tipo e parametri di override
        const groups = {};
        
        for (const [name, configsList] of validConfigs) {
            for (const cfg of configsList) {
                // Ignora configurazioni standard: non sono override
                if (cfg.type === 'standard') continue;
                // Crea una chiave univoca per ogni gruppo di override
                let groupKey;
                let groupTitle;
                let isExpired = false;
                
                if (cfg.type === 'schedule') {
                    // Raggruppa per orario e giorni
                    const fromTime = this.formatTimeDisplay(cfg.valid_from_ora);
                    const toTime = this.formatTimeDisplay(cfg.valid_to_ora);
                    const days = (cfg.days_of_week || []).sort().join(',');
                    groupKey = `schedule_${cfg.valid_from_ora}_${cfg.valid_to_ora}_${days}`;
                    const daysNames = cfg.days_of_week.map(d => ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'][d]).join(', ');
                    groupTitle = `🕐 Override Orario: ${fromTime} → ${toTime} | ${daysNames}`;
                } else if (cfg.type === 'time') {
                    // Raggruppa per periodo temporale
                    groupKey = `time_${cfg.valid_from_date}_${cfg.valid_to_date}`;
                    groupTitle = `⏰ Override Temporale: ${cfg.valid_from_date} → ${cfg.valid_to_date}`;
                    isExpired = new Date(cfg.valid_to_date) < new Date();
                    
                    // Aggiungi filtri opzionali alla chiave e al titolo
                    if (cfg.valid_from_ora !== undefined && cfg.valid_to_ora !== undefined) {
                        const fromTime = this.formatTimeDisplay(cfg.valid_from_ora);
                        const toTime = this.formatTimeDisplay(cfg.valid_to_ora);
                        groupKey += `_${cfg.valid_from_ora}_${cfg.valid_to_ora}`;
                        groupTitle += ` | ⏰ ${fromTime} → ${toTime}`;
                    }
                    if (cfg.days_of_week) {
                        const days = cfg.days_of_week.sort().join(',');
                        groupKey += `_${days}`;
                        const daysNames = cfg.days_of_week.map(d => ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'][d]).join(', ');
                        groupTitle += ` | 📅 ${daysNames}`;
                    }
                } else if (cfg.type === 'conditional') {
                    // Raggruppa per condizione (senza considerare fascia oraria)
                    groupKey = `conditional_${cfg.conditional_config}_${cfg.conditional_operator}_${cfg.conditional_value}`;
                    groupTitle = `🎯 Override Condizionale: ${cfg.conditional_config} ${cfg.conditional_operator} ${cfg.conditional_value}`;
                }
                
                if (!groups[groupKey]) {
                    groups[groupKey] = {
                        title: groupTitle,
                        type: cfg.type,
                        configs: [],
                        priority: cfg.priority || 99,
                        expired: isExpired
                    };
                }
                
                groups[groupKey].configs.push({
                    name: name,
                    cfg: cfg
                });
            }
        }
        
        // Ordina gruppi per priorità e mette gli override temporali scaduti in coda
        const sortedGroups = Object.entries(groups).sort((a, b) => {
            const orderValue = (group) => {
                if (group.type === 'time' && group.expired) return 99;
                if (group.type === 'time') return 1;
                if (group.type === 'schedule') return 2;
                if (group.type === 'conditional') return 3;
                return 98;
            };
            const aOrder = orderValue(a[1]);
            const bOrder = orderValue(b[1]);
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a[1].priority - b[1].priority;
        });
        
        let html = '';
        
        for (const [groupKey, group] of sortedGroups) {
            const safeKey = groupKey.replace(/[^a-zA-Z0-9_-]/g, '_');
            const templateData = encodeURIComponent(JSON.stringify({
                type: group.type,
                cfg: group.configs[0].cfg,
                name: group.configs[0].name
            }));
            html += `<div class="dc-config-group">`;
            html += `<div class="dc-config-group-header" onclick="window.dcToggleOverrideGroup(this.closest('mia-config-card'), this, '${safeKey}')">`;
            html += `<div class="dc-config-group-title">`;
            html += `<span class="dc-config-group-toggle" id="${safeKey}-toggle">▶</span>`;
            html += `<span>${group.title}</span>`;
            html += `</div>`;
            if (group.type !== 'standard') {
                // Pulsante per inserire un nuovo override con le stesse condizioni
                html += `<button class="dc-btn" onclick="event.stopPropagation(); window.dcInsertOverrideGroup('${group.type}', '${templateData}')" style="padding: 6px 12px;" title="Inserisci nuovo override con stesse condizioni">➕</button>`;
            }
            html += `</div>`;
            html += `<div class="dc-config-group-content" id="${safeKey}-content">`;
            
            // Lista configurazioni nel gruppo
            for (const item of group.configs) {
                const { name, cfg } = item;
                const cfgData = encodeURIComponent(JSON.stringify(cfg));
                const isEnabled = cfg.enabled !== false;
                const disabledClass = !isEnabled ? ' disabled' : '';
                const disabledLabel = !isEnabled ? '<span style="color: #f44336; font-weight: bold; margin-left: 8px;">⊘ DISABILITATA</span>' : '';
                
                // Aggiungi dettagli fascia oraria per condizionali se presente
                let extraDetails = `Priorità: ${cfg.priority || 99}`;
                if (group.type === 'conditional' && cfg.valid_from_ora !== undefined && cfg.valid_to_ora !== undefined) {
                    const fromTime = this.formatTimeDisplay(cfg.valid_from_ora);
                    const toTime = this.formatTimeDisplay(cfg.valid_to_ora);
                    extraDetails += ` | ⏰ ${fromTime} → ${toTime}`;
                }
                
                html += `
                    <div class="dc-config-item${disabledClass}" style="margin: 5px 0; padding: 8px; background: var(--card-background-color); display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <strong>${name}</strong>: ${cfg.value}${disabledLabel}
                            <br><small>${extraDetails}</small>
                            <small style="color: var(--secondary-text-color); display: block; margin-top: 2px;">ID: ${cfg.id}</small>
                        </div>
                        <div style="display: flex; gap: 5px; align-items: center;">
                            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 11px;" title="${isEnabled ? 'Disabilita' : 'Abilita'} configurazione">
                                <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="window.dcToggleConfigEnabled('${cfg.type}', ${cfg.id}, this.checked)" style="cursor: pointer;">
                                <span style="font-size: 10px;">${isEnabled ? '✓' : '✗'}</span>
                            </label>
                            <button class="dc-btn" style="padding: 4px 8px; font-size: 11px;" onclick="window.dcEditConfig(this.closest('mia-config-card'), '${name}', '${cfg.type}', ${cfg.id}, '${cfgData}')">✏️</button>
                            <button class="dc-btn-delete" style="padding: 4px 8px; font-size: 11px;" onclick="window.dcDeleteSingleConfig('${cfg.type}', ${cfg.id})">🗑️</button>
                        </div>
                    </div>
                `;
            }
            
            html += `</div>`;
            html += `</div>`;
        }
        
        container.innerHTML = html;
        
        // Inserisci un override precompilato con le condizioni del gruppo
        window.dcInsertOverrideGroup = async (groupType, templateEncoded) => {
            const payload = JSON.parse(decodeURIComponent(templateEncoded));
            const cfg = payload.cfg || {};
            const name = payload.name || '';
            const configTab = window._miaConfigCardInstance.content.querySelector('.dc-tab:nth-child(2)');
            if (configTab) {
                configTab.click();
            }

            // Apri il modal e seleziona il form corretto
            window.dcOpenAddConfigModal();
            const selector = window._miaConfigCardInstance.content.querySelector('#modal-config-type-selector');
            if (selector) {
                selector.value = groupType;
                window.dcShowModalConfigForm(groupType);
            }
            
            setTimeout(async () => {
                const configSelect = window._miaConfigCardInstance.content.querySelector(groupType === 'schedule' ? '#modal-schedule-config-select' : groupType === 'time' ? '#modal-time-config-select' : '#modal-conditional-config-select');
                if (configSelect) {
                    configSelect.value = name;
                }
                
                // Aspetta il caricamento dei valori validi
                if (typeof window.dcLoadValidValuesForForm === 'function') {
                    await window.dcLoadValidValuesForForm(groupType);
                }
                
                // Attendi un po' per permettere al DOM di aggiornarsi
                await new Promise(resolve => setTimeout(resolve, 100));
                
                if (groupType === 'schedule') {
                    const valueInput = window._miaConfigCardInstance.content.querySelector('#modal-schedule-setup-value');
                    if (valueInput && cfg.value !== undefined) {
                        valueInput.value = cfg.value;
                    }
                    
                    const fromHour = Math.floor(cfg.valid_from_ora || 0);
                    const fromMinute = Math.round(((cfg.valid_from_ora || 0) - fromHour) * 60);
                    const toHour = Math.floor(cfg.valid_to_ora || 0);
                    const toMinute = Math.round(((cfg.valid_to_ora || 0) - toHour) * 60);
                    const days = Array.isArray(cfg.days_of_week) ? cfg.days_of_week : (typeof cfg.days_of_week === 'string' ? cfg.days_of_week.split(',').map(d => parseInt(d)).filter(n => !Number.isNaN(n)) : [0,1,2,3,4,5,6]);
                    const daysCheckboxes = window._miaConfigCardInstance.content.querySelectorAll('#modal-dc-form-schedule input[name="days"]');
                    if (daysCheckboxes.length) {
                        daysCheckboxes.forEach(cb => cb.checked = days.includes(parseInt(cb.value)));
                    }
                    const fromHourSel = window._miaConfigCardInstance.content.querySelector('#modal-from-hour');
                    const fromMinuteSel = window._miaConfigCardInstance.content.querySelector('#modal-from-minute');
                    const toHourSel = window._miaConfigCardInstance.content.querySelector('#modal-to-hour');
                    const toMinuteSel = window._miaConfigCardInstance.content.querySelector('#modal-to-minute');
                    if (fromHourSel) fromHourSel.value = fromHour;
                    if (fromMinuteSel) fromMinuteSel.value = fromMinute;
                    if (toHourSel) toHourSel.value = toHour;
                    if (toMinuteSel) toMinuteSel.value = toMinute;
                } else if (groupType === 'time') {
                    const valueInput = window._miaConfigCardInstance.content.querySelector('#modal-time-setup-value');
                    if (valueInput && cfg.value !== undefined) {
                        valueInput.value = cfg.value;
                    }
                    
                    const formatForInput = (dt) => typeof dt === 'string' ? dt.replace(' ', 'T').substring(0, 16) : '';
                    const validFromInput = window._miaConfigCardInstance.content.querySelector('#modal-dc-form-time input[name="valid_from"]');
                    const validToInput = window._miaConfigCardInstance.content.querySelector('#modal-dc-form-time input[name="valid_to"]');
                    if (validFromInput && cfg.valid_from_date) validFromInput.value = formatForInput(cfg.valid_from_date);
                    if (validToInput && cfg.valid_to_date) validToInput.value = formatForInput(cfg.valid_to_date);
                    
                    const hasTimeFilter = cfg.valid_from_ora !== undefined && cfg.valid_to_ora !== undefined;
                    const timeToggle = window._miaConfigCardInstance.content.querySelector('#modal-time-enable-hours');
                    const timeContainer = window._miaConfigCardInstance.content.querySelector('#modal-time-hours-container');
                    if (timeToggle && timeContainer) {
                        timeToggle.checked = hasTimeFilter;
                        timeContainer.style.display = hasTimeFilter ? 'block' : 'none';
                    }
                    if (hasTimeFilter) {
                        const fromHour = Math.floor(cfg.valid_from_ora);
                        const fromMinute = Math.round((cfg.valid_from_ora - fromHour) * 60);
                        const toHour = Math.floor(cfg.valid_to_ora);
                        const toMinute = Math.round((cfg.valid_to_ora - toHour) * 60);
                        const fromHourSel = window._miaConfigCardInstance.content.querySelector('#modal-time-from-hour');
                        const fromMinuteSel = window._miaConfigCardInstance.content.querySelector('#modal-time-from-minute');
                        const toHourSel = window._miaConfigCardInstance.content.querySelector('#modal-time-to-hour');
                        const toMinuteSel = window._miaConfigCardInstance.content.querySelector('#modal-time-to-minute');
                        if (fromHourSel) fromHourSel.value = fromHour;
                        if (fromMinuteSel) fromMinuteSel.value = fromMinute;
                        if (toHourSel) toHourSel.value = toHour;
                        if (toMinuteSel) toMinuteSel.value = toMinute;
                    }
                    const hasDays = cfg.days_of_week !== undefined && cfg.days_of_week !== null;
                    const dayToggle = window._miaConfigCardInstance.content.querySelector('#modal-time-enable-days');
                    const dayContainer = window._miaConfigCardInstance.content.querySelector('#modal-time-days-container');
                    if (dayToggle && dayContainer) {
                        dayToggle.checked = hasDays;
                        dayContainer.style.display = hasDays ? 'block' : 'none';
                    }
                    if (hasDays) {
                        const days = Array.isArray(cfg.days_of_week) ? cfg.days_of_week : (typeof cfg.days_of_week === 'string' ? cfg.days_of_week.split(',').map(d => parseInt(d)).filter(n => !Number.isNaN(n)) : []);
                        window._miaConfigCardInstance.content.querySelectorAll('#modal-dc-form-time input[name="time-days"]').forEach(cb => {
                            cb.checked = days.includes(parseInt(cb.value));
                        });
                    }
                } else if (groupType === 'conditional') {
                    const valueInput = window._miaConfigCardInstance.content.querySelector('#modal-conditional-setup-value');
                    if (valueInput && cfg.value !== undefined) {
                        valueInput.value = cfg.value;
                    }
                    
                    const sourceSelect = window._miaConfigCardInstance.content.querySelector('#modal-conditional-source-config');
                    if (sourceSelect && cfg.conditional_config) {
                        sourceSelect.value = cfg.conditional_config;
                    }
                    
                    const operatorSelect = window._miaConfigCardInstance.content.querySelector('#modal-conditional-operator');
                    if (operatorSelect && cfg.conditional_operator) {
                        operatorSelect.value = cfg.conditional_operator;
                    }
                    
                    const enableHours = cfg.valid_from_ora !== undefined && cfg.valid_to_ora !== undefined;
                    const hoursToggle = window._miaConfigCardInstance.content.querySelector('#modal-conditional-enable-hours');
                    const hoursContainer = window._miaConfigCardInstance.content.querySelector('#modal-conditional-hours-container');
                    if (hoursToggle && hoursContainer) {
                        hoursToggle.checked = enableHours;
                        hoursContainer.style.display = enableHours ? 'block' : 'none';
                    }
                    if (enableHours) {
                        const fromHour = Math.floor(cfg.valid_from_ora);
                        const fromMinute = Math.round((cfg.valid_from_ora - fromHour) * 60);
                        const toHour = Math.floor(cfg.valid_to_ora);
                        const toMinute = Math.round((cfg.valid_to_ora - toHour) * 60);
                        const fromHourSel = window._miaConfigCardInstance.content.querySelector('#modal-conditional-from-hour');
                        const fromMinuteSel = window._miaConfigCardInstance.content.querySelector('#modal-conditional-from-minute');
                        const toHourSel = window._miaConfigCardInstance.content.querySelector('#modal-conditional-to-hour');
                        const toMinuteSel = window._miaConfigCardInstance.content.querySelector('#modal-conditional-to-minute');
                        if (fromHourSel) fromHourSel.value = fromHour;
                        if (fromMinuteSel) fromMinuteSel.value = fromMinute;
                        if (toHourSel) toHourSel.value = toHour;
                        if (toMinuteSel) toMinuteSel.value = toMinute;
                    }
                    
                    if (typeof window.dcUpdateConditionalOptions === 'function') {
                        await window.dcUpdateConditionalOptions();
                        await new Promise(resolve => setTimeout(resolve, 100));
                        const comparisonInput = window._miaConfigCardInstance.content.querySelector('#modal-conditional-comparison-value');
                        if (comparisonInput && cfg.conditional_value !== undefined) {
                            comparisonInput.value = cfg.conditional_value;
                        }
                    }
                }
                
                const targetForm = window._miaConfigCardInstance.content.querySelector(`#modal-form-container-${groupType}`);
                if (targetForm) {
                    targetForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 200);
        };

        window.dcToggleOverrideGroup = (cardElement, headerElement, safeKey) => {
            const instance = cardElement._instance;
            const content = instance.content;
            const toggle = content.querySelector(`#${safeKey}-toggle`);
            
            if (content && toggle) {
                const isExpanded = content.classList.contains('expanded');
                if (isExpanded) {
                    content.classList.remove('expanded');
                    toggle.classList.remove('expanded');
                } else {
                    content.classList.add('expanded');
                    toggle.classList.add('expanded');
                }
            }
        };
    }

    async loadConfigsForWeeklyView() {
        try {
            const entityId = this.getSelectedEntityId();
            const serviceData = entityId ? { entity_id: entityId } : {};
            
            const result = await this._hass.callWS({
                type: 'call_service',
                domain: 'mia_config',
                service: 'get_configurations',
                service_data: serviceData,
                return_response: true
            });
            
            const configs = result.response || {};
            const select = window._miaConfigCardInstance.content.querySelector('#weekly-config-select');
            
            if (!select) return;
            
            // Popola il dropdown con tutti i setup_name
            const configNames = Object.keys(configs).sort();
            select.innerHTML = '<option value="">-- Seleziona --</option>';
            configNames.forEach(name => {
                select.innerHTML += `<option value="${name}">${name}</option>`;
            });
            
        } catch (error) {
            console.error('Error loading configs for weekly view:', error);
        }
    }
    
    async loadConfigsForHistoryFilter() {
        try {
            const entityId = this.getSelectedEntityId();
            const serviceData = entityId ? { entity_id: entityId } : {};
            
            const result = await this._hass.callWS({
                type: 'call_service',
                domain: 'mia_config',
                service: 'get_configurations',
                service_data: serviceData,
                return_response: true
            });
            
            const configs = result.response || {};
            const select = window._miaConfigCardInstance.content.querySelector('#history-filter');
            
            if (!select) return;
            
            // Popola il dropdown con tutti i setup_name
            const configNames = Object.keys(configs).sort();
            select.innerHTML = '<option value="">-- Tutte le configurazioni --</option>';
            configNames.forEach(name => {
                select.innerHTML += `<option value="${name}">${name}</option>`;
            });
            
        } catch (error) {
            console.error('Error loading configs for history filter:', error);
        }
        
        window.dcLoadWeeklyView = async () => {
            const setupName = window._miaConfigCardInstance.content.querySelector('#weekly-config-select').value;
            if (!setupName) {
                window._miaConfigCardInstance.showToast('Seleziona una configurazione', true);
                return;
            }
            
            try {
                const entityId = this.getSelectedEntityId();
                const serviceData = entityId ? { entity_id: entityId } : {};
                
                const result = await this._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'get_configurations',
                    service_data: serviceData,
                    return_response: true
                });
                
                const configs = result.response || {};
                const setupConfigs = configs[setupName] || [];
                
                this.renderWeeklyView(setupName, setupConfigs);
                
            } catch (error) {
                console.error('Error loading weekly view:', error);
                window._miaConfigCardInstance.showToast('Errore nel caricamento', true);
            }
        };
    }

    async renderWeeklyView(setupName, configs) {
        const container = window._miaConfigCardInstance.content.querySelector('#dc-weekly-view');
        
        // Mostra loading
        container.innerHTML = '<div style="padding: 20px; text-align: center;">Caricamento vista settimanale...</div>';
        
        try {
                // Determina entity_id se disponibile
                const entityId = this._selectedEntity || null;
                const serviceData = {
                    setup_name: setupName,
                    days: 14
                };
                if (entityId) {
                    serviceData.entity_id = entityId;
                }
            
                // Chiama il servizio backend per ottenere i segmenti calcolati
                const result = await this._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'simulate_schedule',
                    service_data: serviceData,
                    return_response: true
                });
            
                const segments = result.response?.segments || [];
            
            // Raggruppa i segmenti per giorno
            const segmentsByDate = {};
            segments.forEach(seg => {
                // Normalizza la data (supporta formati con ora) ed evita segmenti fuori periodo
                const rawDate = seg.date || '';
                const parsedDate = new Date(rawDate);
                const isValidDate = !Number.isNaN(parsedDate.getTime());
                const dateKey = isValidDate
                    ? `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`
                    : rawDate.split(' ')[0];
                if (!dateKey) return;
                
                // Se il backend fornisce valid_from_date/valid_to_date, filtra i segmenti per il giorno corrente
                const meta = seg.metadata || {};
                const fromDate = meta.valid_from_date ? new Date(meta.valid_from_date) : null;
                const toDate = meta.valid_to_date ? new Date(meta.valid_to_date) : null;
                const hasFrom = fromDate && !Number.isNaN(fromDate.getTime());
                const hasTo = toDate && !Number.isNaN(toDate.getTime());
                if (isValidDate) {
                    if (hasFrom && parsedDate < fromDate) return;
                    if (hasTo && parsedDate > toDate) return;
                }
                
                if (!segmentsByDate[dateKey]) {
                    segmentsByDate[dateKey] = [];
                }
                segmentsByDate[dateKey].push(seg);
            });
            
            // Genera 14 giorni a partire da oggi
            const now = new Date();
            const days = [];
            for (let i = 0; i < 14; i++) {
                const date = new Date(now);
                date.setDate(date.getDate() + i);
                days.push(date);
            }
            
            let html = `<h3>📊 Vista Settimanale: ${setupName}</h3>`;
            html += '<div class="dc-weekly-container">';
            html += '<div class="dc-weekly-grid">';
            
            // Colonna orari
            html += '<div class="dc-weekly-time-column">';
            html += '<div style="height: 50px; display: flex; align-items: center; justify-content: center; border-bottom: 2px solid rgba(255,255,255,0.3);">Ora</div>';
            for (let hour = 0; hour < 24; hour++) {
                html += `<div class="dc-weekly-time-slot">${String(hour).padStart(2, '0')}:00</div>`;
            }
            html += '</div>';
            
            // Contenitore giorni
            html += '<div class="dc-weekly-days">';
            
            // Colonna per ogni giorno
            days.forEach((day, dayIdx) => {
                const dayOfWeekJS = day.getDay();
                const dayOfWeekPython = dayOfWeekJS === 0 ? 6 : dayOfWeekJS - 1;
                const dayName = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'][dayOfWeekPython];
                const dateStr = `${day.getDate()}/${day.getMonth() + 1}`;
                const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
                
                html += '<div class="dc-weekly-day-column">';
                html += `<div class="dc-weekly-day-header"><div>${dayName}</div><div style="font-size: 11px; font-weight: normal;">${dateStr}</div></div>`;
                html += '<div class="dc-weekly-day-content">';
                
                // Linee orizzontali per le ore (0, 60, 120, ..., 1440)
                for (let hour = 0; hour < 24; hour++) {
                    const topPosition = hour * 60;
                    html += `<div class="dc-weekly-hour-line" style="top: ${topPosition}px;"></div>`;
                }
                // Linea finale a 1440px (24:00)
                html += `<div class="dc-weekly-hour-line" style="top: 1440px; border-top: 2px solid var(--divider-color);"></div>`;
                
                // Ottieni i segmenti per questo giorno dal backend
                const daySegments = segmentsByDate[dateKey] || [];
                
                // Converti i segmenti dal formato backend al formato UI
                const uiSegments = daySegments.map(seg => {
                    const uiSeg = {
                        startTime: seg.start_minute,
                        endTime: seg.end_minute,
                        value: seg.value,
                        type: seg.type,
                        priority: seg.priority,
                        id: seg.id  // Aggiungi ID per debug
                    };
                    
                    // Aggiungi metadata specifici per tipo per i tooltip
                    if (seg.type === 'time' && seg.metadata) {
                        uiSeg.from = new Date(seg.metadata.valid_from_date);
                        uiSeg.to = new Date(seg.metadata.valid_to_date);
                    } else if (seg.type === 'schedule' && seg.metadata) {
                        uiSeg.validFrom = seg.metadata.valid_from_ora;
                        uiSeg.validTo = seg.metadata.valid_to_ora;
                        uiSeg.days = seg.metadata.days_of_week || [0,1,2,3,4,5,6];
                    } else if (seg.type === 'conditional' && seg.metadata) {
                        uiSeg.condition = `${seg.metadata.conditional_config} ${seg.metadata.conditional_operator} ${seg.metadata.conditional_value}`;
                        uiSeg.entity = seg.metadata.conditional_config;
                        // Se il condizionale ha una fascia oraria, la includiamo
                        if (typeof seg.metadata.valid_from_ora === 'number' && typeof seg.metadata.valid_to_ora === 'number') {
                            uiSeg.validFrom = seg.metadata.valid_from_ora;
                            uiSeg.validTo = seg.metadata.valid_to_ora;
                        }
                    }
                    
                    return uiSeg;
                });
                
                uiSegments.forEach((seg, segIdx) => {
                    const topPos = seg.startTime;
                    const height = seg.endTime - seg.startTime;
                    
                    const tooltip = this.generateSegmentTooltip(seg);
                    const barClass = `dc-weekly-bar dc-weekly-bar-${seg.type}`;
                    
                    // Calcola quante barre ci sono in sovrapposizione
                    const overlapping = uiSegments.filter(s => 
                        (s.startTime < seg.endTime && s.endTime > seg.startTime)
                    ).length;
                    
                    // Se ci sono sovrapposizioni, restringi la larghezza e sposta orizzontalmente
                    const widthPercent = overlapping > 1 ? (100 / overlapping) : 100;
                    const leftPercent = overlapping > 1 ? (segIdx % overlapping) * widthPercent : 0;
                    
                    // Serializza i dati del segmento per il modal (converti Date a string)
                    const segmentData = {
                        ...seg,
                        from: seg.from ? seg.from.toISOString() : undefined,
                        to: seg.to ? seg.to.toISOString() : undefined
                    };
                    // Helper per escape attributi HTML (condiviso con dcShowWeeklyEventModal)
                    const escapeHtmlAttribute = (str) => {
                        return String(str)
                            .replace(/&/g, '&amp;')
                            .replace(/'/g, '&#39;')
                            .replace(/"/g, '&quot;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;');
                    };
                    const segmentDataJson = escapeHtmlAttribute(JSON.stringify(segmentData));
                    
                    html += `<div class="${barClass} dc-weekly-tooltip" data-day-index="${dayIdx}" data-total-days="${days.length}" data-segment='${segmentDataJson}' onclick="window.dcShowWeeklyEventModal(this.closest('mia-config-card'), this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();window.dcShowWeeklyEventModal(this.closest('mia-config-card'), this);}" tabindex="0" role="button" aria-label="Visualizza dettagli configurazione" style="top: ${topPos}px; height: ${height}px; left: ${leftPercent}%; width: ${widthPercent}%;">`;
                    if (height > 20) {
                        html += seg.value;
                    }
                    html += `<span class="dc-tooltip-text">${tooltip}</span>`;
                    html += `</div>`;
                });
                
                html += '</div></div>';
            });
            
            html += '</div></div></div>';
            
            // Legenda
            html += '<div style="margin-top: 15px; padding: 10px; background: var(--card-background-color); border-radius: 4px;">';
            html += '<strong>Legenda:</strong><br>';
            html += '<span style="display: inline-block; width: 30px; height: 20px; background: #4caf50; border: 1px solid #388e3c; margin-right: 5px; vertical-align: middle; border-radius: 3px;"></span> Valore standard<br>';
            html += '<span style="display: inline-block; width: 30px; height: 20px; background: #ff9800; border: 1px solid #f57c00; margin-right: 5px; vertical-align: middle; border-radius: 3px;"></span> Override orario (🕐)<br>';
            html += '<span style="display: inline-block; width: 30px; height: 20px; background: #2196f3; border: 1px solid #1976d2; margin-right: 5px; vertical-align: middle; border-radius: 3px;"></span> Override temporale (⏰)<br>';
            html += '<span style="display: inline-block; width: 30px; height: 20px; background: #9c27b0; border: 1px solid #7b1fa2; margin-right: 5px; vertical-align: middle; border-radius: 3px;"></span> Override condizionale (🎯)<br>';
            html += '<small style="color: var(--secondary-text-color); display: block; margin-top: 8px;">💡 Le barre mostrano la durata esatta con posizionamento continuo</small>';
            html += '<small style="color: var(--secondary-text-color); display: block; margin-top: 4px;">📌 Configurazioni sovrapposte vengono visualizzate affiancate</small>';
            html += '<small style="color: var(--secondary-text-color); display: block; margin-top: 4px;">👆 Tocca/clicca su una barra per vedere i dettagli completi</small>';
            html += '</div>';
            
            container.innerHTML = html;
            
            // Gestione dinamica posizione tooltip (evita errori se il nodo viene smontato)
            setTimeout(() => {
                if (!container.isConnected) return;
                const bars = container.querySelectorAll('.dc-weekly-tooltip');
                bars.forEach(bar => {
                    bar.addEventListener('mouseenter', function() {
                        if (!document.body.contains(this)) return;
                        const rect = this.getBoundingClientRect();
                        
                        // Ottieni indice colonna e totale colonne
                        const dayIndex = parseInt(this.getAttribute('data-day-index')) || 0;
                        const totalDays = parseInt(this.getAttribute('data-total-days')) || 1;
                        
                        // STEP 1: Allineamento orizzontale (sempre applicato)
                        this.classList.remove('tooltip-left', 'tooltip-right');
                        if (dayIndex === 0) {
                            this.classList.add('tooltip-left');
                        } else if (dayIndex === totalDays - 1) {
                            this.classList.add('tooltip-right');
                        }
                        
                        // STEP 2: Allineamento verticale (sopra o sotto)
                        const barTopPx = parseFloat(this.style.top) || 0;
                        const barHeight = parseFloat(this.style.height) || 0;
                        
                        if (barHeight >= 1430) {
                            this.classList.remove('tooltip-below');
                        } else if (barTopPx < 200) {
                            this.classList.add('tooltip-below');
                        } else {
                            const viewportHeight = window.innerHeight;
                            const tooltipHeight = 200; // Altezza stimata del tooltip + margine
                            const headerHeight = 100; // Spazio per header Home Assistant
                            
                            const spaceAbove = rect.top - headerHeight;
                            const spaceBelow = viewportHeight - rect.bottom;
                            
                            if (spaceAbove < tooltipHeight && spaceBelow > spaceAbove) {
                                this.classList.add('tooltip-below');
                            } else {
                                this.classList.remove('tooltip-below');
                            }
                        }
                    });
                });
            }, 100);
            
            // Aggiungi event listener per chiudere il modal cliccando sul backdrop
            setTimeout(() => {
                if (!container.isConnected) return;
                const modal = window._miaConfigCardInstance.content.querySelector('#dc-weekly-event-modal');
                if (modal) {
                    modal.addEventListener('click', function(e) {
                        // Chiudi solo se si clicca sul backdrop (non sul contenuto)
                        if (e.target === modal) {
                            window.dcCloseWeeklyEventModal(this.closest('mia-config-card'));
                        }
                    });
                }
            }, 100);
            
        } catch (error) {
            console.error('Errore nel caricamento della vista settimanale:', error);
            container.innerHTML = `<div style="padding: 20px; color: var(--error-color);">
                <strong>Errore nel caricamento della vista settimanale</strong><br>
                ${error.message}
            </div>`;
        }
    }

    calculateDaySegments(date, standardConfig, timeConfigs, scheduleConfigs, conditionalConfigs) {
        const dayOfWeek = date.getDay();
        const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const segments = [];
        
        // Crea una mappa di minuti (0-1439) con i valori attivi
        const minuteMap = new Array(1440).fill(null);
        
        // Prima passa: configurazione standard (base)
        if (standardConfig) {
            for (let i = 0; i < 1440; i++) {
                minuteMap[i] = {
                    type: 'standard',
                    value: standardConfig.value,
                    priority: standardConfig.priority || 99,
                    sourceOrder: 3 // standard ha source_order più alto
                };
            }
        }
        
        // Seconda passa: override orari - considera priorità
        for (const schedConfig of scheduleConfigs) {
            const validDays = schedConfig.days_of_week || [0,1,2,3,4,5,6];
            if (!validDays.includes(adjustedDay)) continue;
            
            const validFrom = schedConfig.valid_from_ora;
            const validTo = schedConfig.valid_to_ora;
            const priority = schedConfig.priority || 99;
            
            const fromMin = Math.floor(validFrom * 60);
            const toMin = Math.floor(validTo * 60);
            
            const shouldOverride = (existing) => {
                if (!existing) return true;
                // Confronta priorità (1 = massima), poi sourceOrder (1 = massima)
                if (priority < existing.priority) return true;
                if (priority > existing.priority) return false;
                // A parità di priorità, schedule (2) batte standard (3)
                return 2 < existing.sourceOrder;
            };
            
            if (validTo < validFrom) {
                // Attraversa mezzanotte
                for (let i = fromMin; i < 1440; i++) {
                    if (shouldOverride(minuteMap[i])) {
                        minuteMap[i] = {
                            type: 'schedule',
                            value: schedConfig.value,
                            priority: priority,
                            sourceOrder: 2,
                            validFrom: validFrom,
                            validTo: validTo,
                            days: validDays
                        };
                    }
                }
                for (let i = 0; i <= toMin; i++) {
                    if (shouldOverride(minuteMap[i])) {
                        minuteMap[i] = {
                            type: 'schedule',
                            value: schedConfig.value,
                            priority: priority,
                            sourceOrder: 2,
                            validFrom: validFrom,
                            validTo: validTo,
                            days: validDays
                        };
                    }
                }
            } else {
                // Range normale
                for (let i = fromMin; i <= toMin && i < 1440; i++) {
                    if (shouldOverride(minuteMap[i])) {
                        minuteMap[i] = {
                            type: 'schedule',
                            value: schedConfig.value,
                            priority: priority,
                            sourceOrder: 2,
                            validFrom: validFrom,
                            validTo: validTo,
                            days: validDays
                        };
                    }
                }
            }
        }
        
        // Passa intermedia: override condizionali con fascia oraria
        for (const condConfig of conditionalConfigs || []) {
            // Solo condizionali con fascia oraria definita
            if (condConfig.valid_from_ora === undefined || condConfig.valid_to_ora === undefined) {
                continue; // Salta i condizionali senza fascia oraria
            }
            
            const validFrom = condConfig.valid_from_ora;
            const validTo = condConfig.valid_to_ora;
            const priority = condConfig.priority || 99;
            
            const fromMin = Math.floor(validFrom * 60);
            const toMin = Math.floor(validTo * 60);
            
            const shouldOverride = (existing) => {
                if (!existing) return true;
                // Confronta priorità (1 = massima)
                if (priority < existing.priority) return true;
                if (priority > existing.priority) return false;
                // A parità di priorità, conditional ha sourceOrder simile a schedule
                return 2 < existing.sourceOrder;
            };
            
            if (validTo < validFrom) {
                // Attraversa mezzanotte
                for (let i = fromMin; i < 1440; i++) {
                    if (shouldOverride(minuteMap[i])) {
                        minuteMap[i] = {
                            type: 'conditional',
                            value: condConfig.value,
                            priority: priority,
                            sourceOrder: 2,
                            validFrom: validFrom,
                            validTo: validTo,
                            condition: `${condConfig.conditional_config} ${condConfig.conditional_operator} ${condConfig.conditional_value}`
                        };
                    }
                }
                for (let i = 0; i <= toMin; i++) {
                    if (shouldOverride(minuteMap[i])) {
                        minuteMap[i] = {
                            type: 'conditional',
                            value: condConfig.value,
                            priority: priority,
                            sourceOrder: 2,
                            validFrom: validFrom,
                            validTo: validTo,
                            condition: `${condConfig.conditional_config} ${condConfig.conditional_operator} ${condConfig.conditional_value}`
                        };
                    }
                }
            } else {
                // Range normale
                for (let i = fromMin; i <= toMin && i < 1440; i++) {
                    if (shouldOverride(minuteMap[i])) {
                        minuteMap[i] = {
                            type: 'conditional',
                            value: condConfig.value,
                            priority: priority,
                            sourceOrder: 2,
                            validFrom: validFrom,
                            validTo: validTo,
                            condition: `${condConfig.conditional_config} ${condConfig.conditional_operator} ${condConfig.conditional_value}`
                        };
                    }
                }
            }
        }
        
        // Terza passa: override temporali - considera priorità
        for (const timeConfig of timeConfigs) {
            const from = new Date(timeConfig.valid_from_date);
            const to = new Date(timeConfig.valid_to_date);
            const priority = timeConfig.priority || 99;
            
            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);
            
            // Verifica sovrapposizione
            if (dayEnd >= from && dayStart <= to) {
                let startMin = from <= dayStart ? 0 : (from.getHours() * 60 + from.getMinutes());
                let endMin = to >= dayEnd ? 1439 : (to.getHours() * 60 + to.getMinutes());
                
                // Se definiti, limita anche alla fascia oraria
                if (timeConfig.valid_from_ora !== undefined && timeConfig.valid_to_ora !== undefined) {
                    const validFrom = timeConfig.valid_from_ora;
                    const validTo = timeConfig.valid_to_ora;
                    
                    const timeStartMin = Math.floor(validFrom * 60);
                    const timeEndMin = Math.floor(validTo * 60);
                    
                    if (validTo < validFrom) {
                        // Attraversa mezzanotte: applica intersezione con i due range
                        // Prima parte: da timeStartMin a 1439
                        const firstStart = Math.max(startMin, timeStartMin);
                        const firstEnd = Math.min(endMin, 1439);
                        // Seconda parte: da 0 a timeEndMin
                        const secondStart = Math.max(startMin, 0);
                        const secondEnd = Math.min(endMin, timeEndMin);
                        
                        // Applica i range
                        const shouldOverride = (existing) => {
                            if (!existing) return true;
                            if (priority < existing.priority) return true;
                            if (priority > existing.priority) return false;
                            return 1 < existing.sourceOrder;
                        };
                        
                        for (let i = firstStart; i <= firstEnd && i < 1440; i++) {
                            if (shouldOverride(minuteMap[i])) {
                                minuteMap[i] = {
                                    type: 'time',
                                    value: timeConfig.value,
                                    priority: priority,
                                    sourceOrder: 1,
                                    from: from,
                                    to: to
                                };
                            }
                        }
                        for (let i = secondStart; i <= secondEnd && i < 1440; i++) {
                            if (shouldOverride(minuteMap[i])) {
                                minuteMap[i] = {
                                    type: 'time',
                                    value: timeConfig.value,
                                    priority: priority,
                                    sourceOrder: 1,
                                    from: from,
                                    to: to
                                };
                            }
                        }
                        continue; // Salta il loop normale
                    } else {
                        // Range normale
                        startMin = Math.max(startMin, timeStartMin);
                        endMin = Math.min(endMin, timeEndMin);
                    }
                }
                
                const shouldOverride = (existing) => {
                    if (!existing) return true;
                    // Confronta priorità (1 = massima), poi sourceOrder (1 = massima)
                    if (priority < existing.priority) return true;
                    if (priority > existing.priority) return false;
                    // A parità di priorità, time (1) batte schedule (2) e standard (3)
                    return 1 < existing.sourceOrder;
                };
                
                for (let i = startMin; i <= endMin && i < 1440; i++) {
                    if (shouldOverride(minuteMap[i])) {
                        minuteMap[i] = {
                            type: 'time',
                            value: timeConfig.value,
                            priority: priority,
                            sourceOrder: 1,
                            from: from,
                            to: to
                        };
                    }
                }
            }
        }
        
        // Converti la mappa in segmenti continui
        let currentSegment = null;
        for (let i = 0; i < 1440; i++) {
            const current = minuteMap[i];
            
            if (!current) {
                if (currentSegment) {
                    segments.push(currentSegment);
                    currentSegment = null;
                }
                continue;
            }
            
            // Verifica se è lo stesso tipo e valore del segmento corrente
            const isSame = currentSegment && 
                          currentSegment.type === current.type &&
                          currentSegment.value === current.value;
            
            if (isSame) {
                // Estendi il segmento corrente (endTime è il primo minuto NON incluso)
                currentSegment.endTime = i + 1;
            } else {
                // Salva il segmento precedente e inizia uno nuovo
                if (currentSegment) {
                    segments.push(currentSegment);
                }
                currentSegment = {
                    type: current.type,
                    value: current.value,
                    startTime: i,
                    endTime: i + 1,
                    level: current.level,
                    ...current
                };
            }
        }
        
        // Salva l'ultimo segmento
        if (currentSegment) {
            segments.push(currentSegment);
        }
        
        return segments;
    }

    generateSegmentTooltip(segment) {
        const startHour = Math.floor(segment.startTime / 60);
        const startMin = segment.startTime % 60;
        const endHour = Math.floor(segment.endTime / 60);
        const endMin = segment.endTime % 60;
        
        let tooltip = `<strong>Valore: ${segment.value}</strong><br><br>`;
        tooltip += `<strong>Orario:</strong> ${String(startHour).padStart(2,'0')}:${String(startMin).padStart(2,'0')} - ${String(endHour).padStart(2,'0')}:${String(endMin).padStart(2,'0')}<br>`;
        if (segment.id) {
            tooltip += `<small>Config ID: ${segment.id}</small><br>`;
        }
        tooltip += '<br>';
        
        if (segment.type === 'time') {
            const hasDates = segment.from instanceof Date && segment.to instanceof Date && !Number.isNaN(segment.from) && !Number.isNaN(segment.to);
            tooltip += `<strong>⏰ Override Temporale</strong><br>`;
            if (hasDates) {
                const fromStr = `${segment.from.getDate()}/${segment.from.getMonth()+1} ${String(segment.from.getHours()).padStart(2,'0')}:${String(segment.from.getMinutes()).padStart(2,'0')}`;
                const toStr = `${segment.to.getDate()}/${segment.to.getMonth()+1} ${String(segment.to.getHours()).padStart(2,'0')}:${String(segment.to.getMinutes()).padStart(2,'0')}`;
                tooltip += `Periodo completo:<br>${fromStr} - ${toStr}`;
            } else {
                tooltip += 'Periodo temporale attivo';
            }
        } else if (segment.type === 'schedule') {
            const daysStr = segment.days.map(d => ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'][d]).join(', ');
            // Converti ore decimali in HH:MM (es. 4.5 ore = 270 minuti = 4h 30m)
            const fromTotalMin = Math.round(segment.validFrom * 60);
            const fromHour = Math.floor(fromTotalMin / 60);
            const fromMin = fromTotalMin % 60;
            const toTotalMin = Math.round(segment.validTo * 60);
            const toHour = Math.floor(toTotalMin / 60);
            const toMin = toTotalMin % 60;
            
            tooltip += `<strong>🕐 Override Orario</strong><br>`;
            tooltip += `Fascia configurata: ${String(fromHour).padStart(2,'0')}:${String(fromMin).padStart(2,'0')} - ${String(toHour).padStart(2,'0')}:${String(toMin).padStart(2,'0')}<br>`;
            tooltip += `Giorni: ${daysStr}`;
            
            if (segment.validTo < segment.validFrom) {
                tooltip += '<br><small>(attraversa la mezzanotte)</small>';
            }
        } else if (segment.type === 'conditional') {
            tooltip += `<strong>🎯 Override Condizionale</strong><br>`;
            tooltip += `Condizione: ${segment.condition}<br>`;
            tooltip += `Entità: ${segment.entity || 'n/d'}<br>`;
            const hasWindow = typeof segment.validFrom === 'number' && typeof segment.validTo === 'number';
            if (hasWindow) {
                // Converti ore decimali in HH:MM
                const fromTotalMin = Math.round(segment.validFrom * 60);
                const fromHour = Math.floor(fromTotalMin / 60);
                const fromMin = fromTotalMin % 60;
                const toTotalMin = Math.round(segment.validTo * 60);
                const toHour = Math.floor(toTotalMin / 60);
                const toMin = toTotalMin % 60;
                tooltip += `Fascia oraria: ${String(fromHour).padStart(2,'0')}:${String(fromMin).padStart(2,'0')} - ${String(toHour).padStart(2,'0')}:${String(toMin).padStart(2,'0')}`;
                if (segment.validTo < segment.validFrom) {
                    tooltip += '<br><small>(attraversa la mezzanotte)</small>';
                }
            } else {
                tooltip += `<small>⓵ Il condizionale si applica quando la condizione è soddisfatta (nessun filtro orario)</small>`;
            }
        } else if (segment.type === 'standard') {
            tooltip += `<strong>⚙️ Valore Standard</strong><br>`;
            tooltip += `Priorità: ${segment.priority}`;
        }
        
        return tooltip;
    }

    calculateBarsForHour(date, hour, standardConfig, timeConfigs, scheduleConfigs) {
        const dayOfWeek = date.getDay();
        const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const bars = [];
        let layer = 0;
        
        // Controlla override temporali (massima priorità)
        for (const timeConfig of timeConfigs) {
            const from = new Date(timeConfig.valid_from_date);
            const to = new Date(timeConfig.valid_to_date);
            
            const hourStart = new Date(date);
            hourStart.setHours(hour, 0, 0, 0);
            const hourEnd = new Date(date);
            hourEnd.setHours(hour, 59, 59, 999);
            
            // Verifica sovrapposizione
            if (hourEnd >= from && hourStart <= to) {
                // Calcola inizio e fine della barra all'interno dell'ora
                const barStart = from > hourStart ? from : hourStart;
                const barEnd = to < hourEnd ? to : hourEnd;
                
                // Converti in percentuali (0-100% dell'ora)
                const startMinutes = barStart.getMinutes() + barStart.getSeconds() / 60;
                const endMinutes = barEnd.getMinutes() + barEnd.getSeconds() / 60;
                
                const startPercent = (startMinutes / 60) * 100;
                const widthPercent = ((endMinutes - startMinutes) / 60) * 100;
                
                bars.push({
                    type: 'time',
                    value: timeConfig.value,
                    startPercent: startPercent,
                    widthPercent: widthPercent,
                    layer: layer++,
                    from: from,
                    to: to
                });
            }
        }
        
        // Controlla override orari
        for (const schedConfig of scheduleConfigs) {
            const validDays = schedConfig.days_of_week || [0,1,2,3,4,5,6];
            if (!validDays.includes(adjustedDay)) continue;
            
            const validFrom = schedConfig.valid_from_ora;
            const validTo = schedConfig.valid_to_ora;
            
            const fromHour = Math.floor(validFrom);
            const fromMin = (validFrom - fromHour) * 60;
            const toHour = Math.floor(validTo);
            const toMin = (validTo - toHour) * 60;
            
            let barStart = null;
            let barEnd = null;
            
            // Gestisce orari a cavallo di mezzanotte
            if (validTo < validFrom) {
                // Attraversa mezzanotte
                if (hour >= fromHour) {
                    // Parte dalla config o dall'inizio dell'ora
                    barStart = hour === fromHour ? fromMin : 0;
                    barEnd = 60;
                } else if (hour <= toHour) {
                    barStart = 0;
                    barEnd = hour === toHour ? toMin : 60;
                }
            } else {
                // Range normale
                if (hour >= fromHour && hour <= toHour) {
                    barStart = hour === fromHour ? fromMin : 0;
                    barEnd = hour === toHour ? toMin : 60;
                }
            }
            
            if (barStart !== null) {
                const startPercent = (barStart / 60) * 100;
                const widthPercent = ((barEnd - barStart) / 60) * 100;
                
                bars.push({
                    type: 'schedule',
                    value: schedConfig.value,
                    startPercent: startPercent,
                    widthPercent: widthPercent,
                    layer: layer++,
                    validFrom: validFrom,
                    validTo: validTo,
                    days: validDays
                });
            }
        }
        
        // Se non ci sono override e c'è un valore standard, mostra la barra standard
        if (bars.length === 0 && standardConfig) {
            bars.push({
                type: 'standard',
                value: standardConfig.value,
                startPercent: 0,
                widthPercent: 100,
                layer: 0,
                priority: standardConfig.priority
            });
        }
        
        return bars;
    }

    generateBarTooltip(bar) {
        let tooltip = `<strong>Valore: ${bar.value}</strong><br><br>`;
        
        if (bar.type === 'time') {
            const fromStr = `${bar.from.getDate()}/${bar.from.getMonth()+1} ${String(bar.from.getHours()).padStart(2,'0')}:${String(bar.from.getMinutes()).padStart(2,'0')}`;
            const toStr = `${bar.to.getDate()}/${bar.to.getMonth()+1} ${String(bar.to.getHours()).padStart(2,'0')}:${String(bar.to.getMinutes()).padStart(2,'0')}`;
            tooltip += `<strong>⏰ Override Temporale</strong><br>`;
            tooltip += `Da: ${fromStr}<br>`;
            tooltip += `A: ${toStr}`;
        } else if (bar.type === 'schedule') {
            const fromHour = Math.floor(bar.validFrom);
            const fromMin = Math.round((bar.validFrom - fromHour) * 60);
            const toHour = Math.floor(bar.validTo);
            const toMin = Math.round((bar.validTo - toHour) * 60);
            const daysStr = bar.days.map(d => ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'][d]).join(', ');
            
            tooltip += `<strong>🕐 Override Orario</strong><br>`;
            tooltip += `Orario: ${String(fromHour).padStart(2,'0')}:${String(fromMin).padStart(2,'0')} - ${String(toHour).padStart(2,'0')}:${String(toMin).padStart(2,'0')}<br>`;
            tooltip += `Giorni: ${daysStr}`;
            
            if (bar.validTo < bar.validFrom) {
                tooltip += '<br><small>(attraversa la mezzanotte)</small>';
            }
        } else if (bar.type === 'standard') {
            tooltip += `<strong>⚙️ Valore Standard</strong><br>`;
            tooltip += `Priorità: ${bar.priority || 99}`;
        }
        
        return tooltip;
    }

    calculateValueForDateTimeDetailed(date, hour, standardConfig, timeConfigs, scheduleConfigs) {
        const dayOfWeek = date.getDay();
        const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        
        // Range dell'ora corrente: da hour.00 a hour.59
        const hourStart = hour + 0.0;
        const hourEnd = hour + 0.99;
        
        let activeOverrides = [];
        
        // Controlla override temporali (massima priorità)
        for (const timeConfig of timeConfigs) {
            const from = new Date(timeConfig.valid_from_date);
            const to = new Date(timeConfig.valid_to_date);
            
            // Controlla se c'è sovrapposizione con l'ora corrente
            const checkDateStart = new Date(date);
            checkDateStart.setHours(hour, 0, 0, 0);
            const checkDateEnd = new Date(date);
            checkDateEnd.setHours(hour, 59, 59, 999);
            
            if (checkDateEnd >= from && checkDateStart <= to) {
                // Se definiti, controlla anche la fascia oraria
                if (timeConfig.valid_from_ora !== undefined && timeConfig.valid_to_ora !== undefined) {
                    const validFrom = timeConfig.valid_from_ora;
                    const validTo = timeConfig.valid_to_ora;
                    
                    const fromHour = Math.floor(validFrom);
                    const fromMin = Math.round((validFrom - fromHour) * 60);
                    const toHour = Math.floor(validTo);
                    const toMin = Math.round((validTo - toHour) * 60);
                    
                    let hasTimeOverlap = false;
                    if (validTo < validFrom) {
                        // Attraversa mezzanotte
                        if (hour > fromHour || hour < toHour) {
                            hasTimeOverlap = true;
                        } else if (hour === fromHour && hourEnd >= validFrom) {
                            hasTimeOverlap = true;
                        } else if (hour === toHour && hourStart <= validTo) {
                            hasTimeOverlap = true;
                        }
                    } else {
                        // Range normale
                        if (hour > fromHour && hour < toHour) {
                            hasTimeOverlap = true;
                        } else if (hour === fromHour && hourEnd >= validFrom) {
                            hasTimeOverlap = true;
                        } else if (hour === toHour && hourStart <= validTo) {
                            hasTimeOverlap = true;
                        }
                    }
                    
                    if (!hasTimeOverlap) continue; // Non attivo in questa ora
                }
                
                const fromStr = `${from.getDate()}/${from.getMonth()+1} ${String(from.getHours()).padStart(2,'0')}:${String(from.getMinutes()).padStart(2,'0')}`;
                const toStr = `${to.getDate()}/${to.getMonth()+1} ${String(to.getHours()).padStart(2,'0')}:${String(to.getMinutes()).padStart(2,'0')}`;
                
                // Calcola se è attivo per tutta l'ora o solo parzialmente
                const isFullHour = checkDateStart >= from && checkDateEnd <= to;
                const partial = isFullHour ? '' : ' (parziale)';
                
                return {
                    displayValue: timeConfig.value + ' ⏰' + partial,
                    type: 'time',
                    value: timeConfig.value,
                    details: `Override Temporale${partial}\nValido: ${fromStr} - ${toStr}`,
                    partial: !isFullHour
                };
            }
        }
        
        // Controlla override orari
        for (const schedConfig of scheduleConfigs) {
            const validDays = schedConfig.days_of_week || [0,1,2,3,4,5,6];
            
            if (!validDays.includes(adjustedDay)) continue;
            
            const validFrom = schedConfig.valid_from_ora;
            const validTo = schedConfig.valid_to_ora;
            
            const fromHour = Math.floor(validFrom);
            const fromMin = Math.round((validFrom - fromHour) * 60);
            const toHour = Math.floor(validTo);
            const toMin = Math.round((validTo - toHour) * 60);
            
            // Gestisce orari a cavallo di mezzanotte
            let hasOverlap = false;
            let timeDetails = '';
            
            if (validTo < validFrom) {
                // Attraversa mezzanotte: attivo se hour >= fromHour OR hour <= toHour
                // Ma dobbiamo verificare la sovrapposizione con i minuti
                if (hour > fromHour || hour < toHour) {
                    hasOverlap = true;
                } else if (hour === fromHour && hourEnd >= validFrom) {
                    hasOverlap = true;
                } else if (hour === toHour && hourStart <= validTo) {
                    hasOverlap = true;
                }
                timeDetails = `Fascia Oraria: ${String(fromHour).padStart(2,'0')}:${String(fromMin).padStart(2,'0')} - ${String(toHour).padStart(2,'0')}:${String(toMin).padStart(2,'0')} (attraversa mezzanotte)`;
            } else {
                // Range normale: verifica sovrapposizione
                if (hour > fromHour && hour < toHour) {
                    hasOverlap = true;
                } else if (hour === fromHour && hourEnd >= validFrom) {
                    hasOverlap = true;
                } else if (hour === toHour && hourStart <= validTo) {
                    hasOverlap = true;
                }
                timeDetails = `Fascia Oraria: ${String(fromHour).padStart(2,'0')}:${String(fromMin).padStart(2,'0')} - ${String(toHour).padStart(2,'0')}:${String(toMin).padStart(2,'0')}`;
            }
            
            if (hasOverlap) {
                const daysStr = validDays.map(d => ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'][d]).join(', ');
                
                // Verifica se l'override copre tutta l'ora o solo una parte
                const isFullHour = (validFrom <= hourStart && validTo >= hourEnd) || 
                                   (validTo < validFrom && (validFrom <= hourStart || validTo >= hourEnd));
                const partial = isFullHour ? '' : ' (parziale)';
                
                return {
                    displayValue: schedConfig.value + ' 🕐' + partial,
                    type: 'schedule',
                    value: schedConfig.value,
                    details: `Override Orario${partial}\n${timeDetails}\nGiorni: ${daysStr}`,
                    partial: !isFullHour
                };
            }
        }
        
        // Valore standard
        return {
            displayValue: standardConfig ? standardConfig.value : '-',
            type: 'standard',
            value: standardConfig ? standardConfig.value : '-',
            details: standardConfig ? `Valore Standard\nPriorità: ${standardConfig.priority || 99}` : 'Nessuna configurazione',
            partial: false
        };
    }

    calculateValueForDateTime(date, hour, standardConfig, timeConfigs, scheduleConfigs) {
        const dayOfWeek = date.getDay(); // 0=Dom, 1=Lun, ... 6=Sab in JavaScript
        const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Converti a 0=Lun, 6=Dom per Python
        const currentTime = hour + 0.0; // Converti ora in formato decimale
        
        // Controlla override temporali (massima priorità)
        for (const timeConfig of timeConfigs) {
            const from = new Date(timeConfig.valid_from_date);
            const to = new Date(timeConfig.valid_to_date);
            const checkDate = new Date(date);
            checkDate.setHours(hour, 0, 0, 0);
            
            if (checkDate >= from && checkDate <= to) {
                // Se definiti, controlla anche la fascia oraria
                if (timeConfig.valid_from_ora !== undefined && timeConfig.valid_to_ora !== undefined) {
                    const validFrom = timeConfig.valid_from_ora;
                    const validTo = timeConfig.valid_to_ora;
                    const currentTime = hour + 0.0;
                    
                    let isInRange = false;
                    if (validTo < validFrom) {
                        isInRange = (currentTime >= validFrom || currentTime <= validTo);
                    } else {
                        isInRange = (currentTime >= validFrom && currentTime <= validTo);
                    }
                    
                    if (!isInRange) continue;
                }
                
                return timeConfig.value + ' ⏰';
            }
        }
        
        // Controlla override orari
        for (const schedConfig of scheduleConfigs) {
            const validDays = schedConfig.days_of_week || [0,1,2,3,4,5,6];
            
            if (!validDays.includes(adjustedDay)) continue;
            
            const validFrom = schedConfig.valid_from_ora;
            const validTo = schedConfig.valid_to_ora;
            
            // Gestisce orari a cavallo di mezzanotte
            let isInRange = false;
            if (validTo < validFrom) {
                isInRange = (currentTime >= validFrom || currentTime <= validTo);
            } else {
                isInRange = (currentTime >= validFrom && currentTime <= validTo);
            }
            
            if (isInRange) {
                return schedConfig.value + ' 🕐';
            }
        }
        
        // Valore standard
        return standardConfig ? standardConfig.value : '-';
    }

    generateTooltip(result, hour) {
        const hourStr = `${String(hour).padStart(2, '0')}:00 - ${String(hour).padStart(2, '0')}:59`;
        let tooltip = `<strong>⏰ Ora: ${hourStr}</strong><br><br>`;
        tooltip += `<strong>Valore: ${result.value}</strong><br><br>`;
        tooltip += result.details.replace(/\n/g, '<br>');
        
        if (result.type === 'schedule') {
            tooltip += '<br><br><small>💡 Questo override è basato sull\'orario e i giorni della settimana</small>';
        } else if (result.type === 'time') {
            tooltip += '<br><br><small>💡 Questo override è basato su un periodo di tempo specifico</small>';
        }
        
        return tooltip;
    }

    getWeeklyCellStyle(value, standardConfig, isPartial = false) {
        const partialStyle = isPartial ? 'background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.3) 10px, rgba(255,255,255,0.3) 20px);' : '';
        
        if (value.includes('⏰')) {
            return `background: #e3f2fd; font-weight: bold; ${partialStyle}`;
        } else if (value.includes('🕐')) {
            return `background: #fff3e0; font-weight: bold; ${partialStyle}`;
        } else if (standardConfig && value === standardConfig.value) {
            return 'background: #e8f5e9;';
        }
        return '';
    }
    
    async loadConfigsForValidValues() {
        const select = window._miaConfigCardInstance.content.querySelector('#vv-config-select');
        if (!select) return;
        
        try {
            const entityId = this.getSelectedEntityId();
            const serviceData = entityId ? { entity_id: entityId } : {};
            
            const response = await this._hass.callWS({
                type: 'call_service',
                domain: 'mia_config',
                service: 'get_configurations',
                service_data: serviceData,
                return_response: true
            });
            
            // response.response è un oggetto con chiavi = nomi configurazioni
            const configs = response.response || {};
            const uniqueNames = Object.keys(configs).filter(name => Array.isArray(configs[name]) && configs[name].length > 0);
            
            select.innerHTML = '<option value="">-- Seleziona --</option>' + 
                uniqueNames.map(name => `<option value="${name}">${name}</option>`).join('');
        } catch (err) {
            console.error('Errore caricamento configurazioni per valori validi:', err);
            console.error('Error details:', err?.message || err?.toString() || JSON.stringify(err));
        }
    }

    showToast(message, isError = false) {
        const event = new Event('hass-notification', {
            bubbles: true,
            composed: true
        });
        event.detail = { 
            message,
            duration: isError ? 5000 : 3000
        };
        this.dispatchEvent(event);
    }

    getCardSize() {
        return 5;
    }
}

customElements.define('mia-config-card', MiaConfigCard);

window.customCards = window.customCards || [];
window.customCards.push({
    type: 'mia-config-card',
    name: 'Mia Config Card',
    description: 'Gestione configurazioni dinamiche'
});
