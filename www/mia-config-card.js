// Version 1.0.4 - Weekly view and midnight crossing - 20251130150000
class MiaConfigCard extends HTMLElement {
    set hass(hass) {
        this._hass = hass;
        if (!this.content) {
            this.innerHTML = `
                <ha-card header="Mia Config Manager">
                    <div class="card-content">
                        <div id="dynamic-config-ui"></div>
                    </div>
                </ha-card>
            `;
            this.content = this.querySelector("#dynamic-config-ui");
            this.render();
        }
    }

    setConfig(config) {
        this._config = config;
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
        for (let i = 0; i < 60; i += 5) {
            options += `<option value="${i}">${String(i).padStart(2, '0')}</option>`;
        }
        return options;
    }

    timeSelectorsToDecimal(hour, minute) {
        return parseFloat((hour + minute / 60).toFixed(2));
    }

    formatTimeDisplay(decimalTime) {
        const hours = Math.floor(decimalTime);
        const minutes = Math.round((decimalTime - hours) * 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    render() {
        if (!this._hass) return;

        this.content.innerHTML = `
            <style>
                .dc-tabs {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                    border-bottom: 2px solid var(--divider-color);
                }
                .dc-tab {
                    padding: 10px 20px;
                    cursor: pointer;
                    background: none;
                    border: none;
                    border-bottom: 3px solid transparent;
                    font-size: 14px;
                    color: var(--primary-text-color);
                }
                .dc-tab.active {
                    border-bottom-color: var(--primary-color);
                    color: var(--primary-color);
                    font-weight: 500;
                }
                .dc-tab-content {
                    display: none;
                }
                .dc-tab-content.active {
                    display: block;
                }
                .dc-form-group {
                    margin-bottom: 16px;
                }
                .dc-form-group label {
                    display: block;
                    margin-bottom: 4px;
                    font-weight: 500;
                    font-size: 14px;
                }
                .dc-form-group input,
                .dc-form-group select {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--divider-color);
                    border-radius: 4px;
                    background: var(--card-background-color);
                    color: var(--primary-text-color);
                    font-size: 14px;
                    box-sizing: border-box;
                }
                .dc-checkbox-group {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                .dc-checkbox-label {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 14px;
                }
                .dc-time-picker {
                    display: flex;
                    gap: 15px;
                    align-items: center;
                }
                .dc-time-input {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                .dc-time-input select {
                    width: 70px;
                    padding: 8px;
                    border: 1px solid var(--divider-color);
                    border-radius: 4px;
                    background: var(--card-background-color);
                    color: var(--primary-text-color);
                    font-size: 14px;
                }
                .dc-time-separator {
                    font-size: 18px;
                    font-weight: bold;
                }
                .dc-modal {
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
                }
                .dc-modal.active {
                    display: flex;
                }
                .dc-modal-content {
                    background: var(--card-background-color);
                    padding: 20px;
                    border-radius: 8px;
                    max-width: 500px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                }
                .dc-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid var(--divider-color);
                }
                .dc-modal-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: var(--primary-text-color);
                }
                .dc-btn {
                    background-color: var(--primary-color);
                    color: var(--text-primary-color, white);
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                }
                .dc-btn:hover {
                    opacity: 0.9;
                }
                .dc-config-item {
                    border: 1px solid var(--divider-color);
                    border-radius: 4px;
                    padding: 12px;
                    margin-bottom: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .dc-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 500;
                    margin-right: 8px;
                }
                .dc-badge-time {
                    background-color: #e3f2fd;
                    color: #1976d2;
                }
                .dc-badge-schedule {
                    background-color: #fff3e0;
                    color: #f57c00;
                }
                .dc-badge-standard {
                    background-color: #f5f5f5;
                    color: #616161;
                }
                .dc-btn-delete {
                    background-color: #f44336;
                    color: white;
                    border: none;
                    padding: 6px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .dc-time-group {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
            </style>

            <div class="dc-tabs">
                <button class="dc-tab" onclick="window.dcSwitchTab('list', event)">📋 Lista</button>
                <button class="dc-tab" onclick="window.dcSwitchTab('standard', event)">⚙️ Standard</button>
                <button class="dc-tab" onclick="window.dcSwitchTab('schedule', event)">🕐 Orario</button>
                <button class="dc-tab" onclick="window.dcSwitchTab('time', event)">⏰ Tempo</button>
                <button class="dc-tab" onclick="window.dcSwitchTab('weekly', event)">📊 Vista Settimanale</button>
                <button class="dc-tab" onclick="window.dcSwitchTab('history', event)">📜 Storico</button>
            </div>

            <div id="dc-tab-list" class="dc-tab-content active">
                <div id="dc-config-list">Caricamento...</div>
            </div>

            <div id="dc-tab-standard" class="dc-tab-content">
                <form id="dc-form-standard">
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
                    <button type="submit" class="dc-btn">Salva</button>
                </form>
            </div>

            <div id="dc-tab-schedule" class="dc-tab-content">
                <form id="dc-form-schedule">
                    <div class="dc-form-group">
                        <label>Configurazione da Override:</label>
                        <select id="schedule-config-select" name="setup_name" required>
                            <option value="">-- Caricamento... --</option>
                        </select>
                        <small style="color: var(--secondary-text-color);">Seleziona una configurazione standard esistente</small>
                    </div>
                    <div class="dc-form-group">
                        <label>Valore Override:</label>
                        <input type="text" name="setup_value" required placeholder="es. 20">
                    </div>
                    <div class="dc-form-group">
                        <label>Fascia Oraria:</label>
                        <div class="dc-time-picker">
                            <div>
                                <label style="font-size: 12px; margin-bottom: 4px;">Dalle:</label>
                                <div class="dc-time-input">
                                    <select id="from-hour" required>
                                        ${this.generateHourOptions(0, 23)}
                                    </select>
                                    <span class="dc-time-separator">:</span>
                                    <select id="from-minute" required>
                                        ${this.generateMinuteOptions()}
                                    </select>
                                </div>
                            </div>
                            <span style="font-size: 18px; align-self: flex-end; padding-bottom: 8px;">→</span>
                            <div>
                                <label style="font-size: 12px; margin-bottom: 4px;">Alle:</label>
                                <div class="dc-time-input">
                                    <select id="to-hour" required>
                                        ${this.generateHourOptions(0, 23)}
                                    </select>
                                    <span class="dc-time-separator">:</span>
                                    <select id="to-minute" required>
                                        ${this.generateMinuteOptions()}
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
                            <label class="dc-checkbox-label">
                                <input type="checkbox" name="days" value="0" checked> Lun
                            </label>
                            <label class="dc-checkbox-label">
                                <input type="checkbox" name="days" value="1" checked> Mar
                            </label>
                            <label class="dc-checkbox-label">
                                <input type="checkbox" name="days" value="2" checked> Mer
                            </label>
                            <label class="dc-checkbox-label">
                                <input type="checkbox" name="days" value="3" checked> Gio
                            </label>
                            <label class="dc-checkbox-label">
                                <input type="checkbox" name="days" value="4" checked> Ven
                            </label>
                            <label class="dc-checkbox-label">
                                <input type="checkbox" name="days" value="5" checked> Sab
                            </label>
                            <label class="dc-checkbox-label">
                                <input type="checkbox" name="days" value="6" checked> Dom
                            </label>
                        </div>
                    </div>
                    <button type="submit" class="dc-btn">Aggiungi Override Orario</button>
                </form>
            </div>

            <div id="dc-tab-time" class="dc-tab-content">
                <form id="dc-form-time">
                    <div class="dc-form-group">
                        <label>Configurazione da Override:</label>
                        <select id="time-config-select" name="setup_name" required>
                            <option value="">-- Caricamento... --</option>
                        </select>
                        <small style="color: var(--secondary-text-color);">Seleziona una configurazione standard esistente</small>
                    </div>
                    <div class="dc-form-group">
                        <label>Valore Override:</label>
                        <input type="text" name="setup_value" required placeholder="es. 18">
                    </div>
                    <div class="dc-form-group">
                        <label>Data/Ora Inizio:</label>
                        <input type="datetime-local" name="valid_from" required>
                    </div>
                    <div class="dc-form-group">
                        <label>Data/Ora Fine:</label>
                        <input type="datetime-local" name="valid_to" required>
                    </div>
                    <button type="submit" class="dc-btn">Aggiungi Override Temporale</button>
                </form>
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
                    <label style="font-weight: 500;">Filtra per nome:</label>
                    <input type="text" id="history-filter" placeholder="Lascia vuoto per tutte" style="padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color); width: 300px;">
                    <button class="dc-btn" onclick="window.dcLoadHistory()" style="margin-left: 10px;">Carica Storico</button>
                </div>
                <div id="dc-history-list">Clicca "Carica Storico" per visualizzare</div>
            </div>
            
            <!-- Modal per editare configurazioni -->
            <div id="dc-edit-modal" class="dc-modal">
                <div class="dc-modal-content">
                    <div class="dc-modal-header">
                        <h3>Modifica Configurazione</h3>
                        <button class="dc-modal-close" onclick="window.dcCloseEditModal()">×</button>
                    </div>
                    <div id="dc-edit-modal-body"></div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        this.loadConfigurations();
        this.setDefaultTimeValues();
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
        
        const validFromInput = this.content.querySelector('#dc-form-time input[name="valid_from"]');
        const validToInput = this.content.querySelector('#dc-form-time input[name="valid_to"]');
        
        if (validFromInput) validFromInput.value = formatDateTime(now);
        if (validToInput) validToInput.value = formatDateTime(midnight);
    }

    setupEventListeners() {
        // Form Standard
        this.content.querySelector('#dc-form-standard').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const formData = new FormData(form);
            try {
                await this._hass.callService('mia_config', 'set_config', {
                    setup_name: formData.get('setup_name'),
                    setup_value: formData.get('setup_value'),
                    priority: parseInt(formData.get('priority'))
                });
                form.reset();
                this.showToast('Configurazione salvata!');
                setTimeout(() => this.loadConfigurations(), 500);
            } catch (err) {
                console.error('Errore salvataggio:', err);
                this.showToast('Errore: ' + err.message, true);
            }
        });

        // Form Schedule
        this.content.querySelector('#dc-form-schedule').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const formData = new FormData(form);
            const days = Array.from(this.content.querySelectorAll('#dc-form-schedule input[name="days"]:checked'))
                .map(cb => parseInt(cb.value));  // Converti a numero
            
            // Ottieni valori dai selettori
            const fromHour = parseInt(this.content.querySelector('#from-hour').value);
            const fromMinute = parseInt(this.content.querySelector('#from-minute').value);
            const toHour = parseInt(this.content.querySelector('#to-hour').value);
            const toMinute = parseInt(this.content.querySelector('#to-minute').value);
            
            const validFromOra = this.timeSelectorsToDecimal(fromHour, fromMinute);
            const validToOra = this.timeSelectorsToDecimal(toHour, toMinute);
            
            try {
                await this._hass.callService('mia_config', 'set_schedule_config', {
                    setup_name: formData.get('setup_name'),
                    setup_value: formData.get('setup_value'),
                    valid_from_ora: validFromOra,
                    valid_to_ora: validToOra,
                    days_of_week: days
                });
                form.reset();
                // Reset selettori a valori di default
                this.content.querySelector('#from-hour').value = '0';
                this.content.querySelector('#from-minute').value = '0';
                this.content.querySelector('#to-hour').value = '23';
                this.content.querySelector('#to-minute').value = '59';
                this.content.querySelectorAll('#dc-form-schedule input[name="days"]').forEach(cb => cb.checked = true);
                this.showToast('Configurazione salvata!');
                setTimeout(() => this.loadConfigurations(), 500);
            } catch (err) {
                console.error('Errore salvataggio:', err);
                this.showToast('Errore: ' + err.message, true);
            }
        });

        // Form Time
        this.content.querySelector('#dc-form-time').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const formData = new FormData(form);
            const formatDateTime = (dt) => dt.replace('T', ' ') + ':00';
            
            try {
                await this._hass.callService('mia_config', 'set_time_config', {
                    setup_name: formData.get('setup_name'),
                    setup_value: formData.get('setup_value'),
                    valid_from: formatDateTime(formData.get('valid_from')),
                    valid_to: formatDateTime(formData.get('valid_to'))
                });
                form.reset();
                this.showToast('Configurazione salvata!');
                setTimeout(() => this.loadConfigurations(), 500);
            } catch (err) {
                console.error('Errore salvataggio:', err);
                this.showToast('Errore: ' + err.message, true);
            }
        });

        // Switch Tab Function
        window.dcSwitchTab = (tabName, event) => {
            this.content.querySelectorAll('.dc-tab').forEach(t => t.classList.remove('active'));
            this.content.querySelectorAll('.dc-tab-content').forEach(c => c.classList.remove('active'));
            
            event.target.classList.add('active');
            this.content.querySelector(`#dc-tab-${tabName}`).classList.add('active');
            
            if (tabName === 'list') {
                this.loadConfigurations();
            } else if (tabName === 'schedule' || tabName === 'time') {
                this.loadStandardConfigsForSelect();
                if (tabName === 'time') {
                    // Reimposta i valori di default quando si apre la tab tempo
                    this.setDefaultTimeValues();
                }
            } else if (tabName === 'weekly') {
                this.loadConfigsForWeeklyView();
            } else if (tabName === 'history') {
                // Carica automaticamente lo storico quando si apre la tab
                window.dcLoadHistory();
            }
        };
    }

    async loadStandardConfigsForSelect() {
        try {
            const result = await this._hass.callWS({
                type: 'call_service',
                domain: 'mia_config',
                service: 'get_configurations',
                service_data: {},
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
            
            const scheduleSelect = this.content.querySelector('#schedule-config-select');
            const timeSelect = this.content.querySelector('#time-config-select');
            
            if (standardConfigs.length === 0) {
                const noConfigOption = '<option value="">-- Nessuna configurazione standard disponibile --</option>';
                if (scheduleSelect) scheduleSelect.innerHTML = noConfigOption;
                if (timeSelect) timeSelect.innerHTML = noConfigOption;
                return;
            }
            
            let options = '<option value="">-- Seleziona configurazione --</option>';
            for (const config of standardConfigs) {
                options += `<option value="${config.name}">${config.name} (attuale: ${config.value})</option>`;
            }
            
            if (scheduleSelect) scheduleSelect.innerHTML = options;
            if (timeSelect) timeSelect.innerHTML = options;
        } catch (err) {
            console.error('Errore caricamento configurazioni:', err);
        }
    }

    async loadConfigurations() {
        const container = this.content.querySelector('#dc-config-list');
        container.innerHTML = 'Caricamento...';
        
        try {
            const result = await this._hass.callWS({
                type: 'call_service',
                domain: 'mia_config',
                service: 'get_configurations',
                service_data: {},
                return_response: true
            });
            console.log('Risposta get_configurations:', result);
            console.log('result.response:', result.response);
            console.log('result.response type:', typeof result.response);
            console.log('result.response keys:', result.response ? Object.keys(result.response) : 'null');
            
            // I dati sono direttamente in result.response, NON in result.response.configurations
            const configs = result.response || result.configurations || {};
            console.log('Configurazioni trovate:', Object.keys(configs).length, configs);
            
            // Ottieni tutti i sensori mia_config
            const sensors = Object.keys(this._hass.states)
                .filter(id => id.startsWith('sensor.mia_config_'))
                .map(id => ({
                    id,
                    entity: this._hass.states[id],
                    name: id.replace('sensor.mia_config_', '')
                }));
            
            if (Object.keys(configs).length === 0 && sensors.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: var(--secondary-text-color);">Nessuna configurazione presente</p>';
                return;
            }
            
            let html = '<h3>📊 Valori Correnti</h3>';
            
            // Sezione sensori attivi
            if (sensors.length > 0) {
                html += '<div style="margin-bottom: 20px;">';
                for (const sensor of sensors) {
                    const value = sensor.entity.state;
                    const attrs = sensor.entity.attributes;
                    const activeType = attrs.active_config_type || 'nessuna';
                    const priority = attrs.priority || '-';
                    
                    const typeLabel = activeType === 'time' ? '⏰ Tempo' :
                                     activeType === 'schedule' ? '📅 Orario' :
                                     activeType === 'standard' ? '⚙️ Standard' : '❌ Nessuna';
                    
                    html += `
                        <div class="dc-config-item" style="background: var(--card-background-color); border-left: 4px solid var(--primary-color);">
                            <div>
                                <strong>🎯 ${sensor.name}</strong><br>
                                <span style="font-size: 1.2em; color: var(--primary-color);">${value}</span><br>
                                <small>Tipo attivo: ${typeLabel} | Priorità: ${priority}</small>
                            </div>
                        </div>
                    `;
                }
                html += '</div>';
            }
            
            // Sezione configurazioni nel database
            html += '<h3>🗂️ Configurazioni Database</h3>';
            
            if (Object.keys(configs).length === 0) {
                html += '<p style="text-align: center; color: var(--secondary-text-color);">Nessuna configurazione salvata</p>';
            } else {
                for (const [name, configsList] of Object.entries(configs)) {
                    // configsList è un array di configurazioni per questo nome
                    if (!Array.isArray(configsList) || configsList.length === 0) continue;
                    
                    html += `<div style="margin-bottom: 15px; padding: 10px; border: 1px solid var(--divider-color); border-radius: 8px;">`;
                    html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">`;
                    html += `<strong style="font-size: 1.1em;">📦 ${name}</strong>`;
                    html += `<button class="dc-btn-delete" onclick="window.dcDeleteConfig('${name}')">Elimina Tutto</button>`;
                    html += `</div>`;
                    
                    for (const cfg of configsList) {
                        const type = cfg.type || 'standard';
                        const badgeClass = type === 'time' ? 'dc-badge-time' : 
                                          type === 'schedule' ? 'dc-badge-schedule' : 'dc-badge-standard';
                        const sourceLabel = type === 'time' ? '⏰ Tempo' :
                                           type === 'schedule' ? '📅 Orario' : '⚙️ Standard';
                        
                        let extra = '';
                        if (type === 'standard') {
                            extra = `Priorità: ${cfg.priority}`;
                        } else if (type === 'time') {
                            extra = `Da ${cfg.valid_from_date} a ${cfg.valid_to_date}`;
                        } else if (type === 'schedule') {
                            const days = cfg.days_of_week.map(d => ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'][d]).join(', ');
                            const fromTime = this.formatTimeDisplay(cfg.valid_from_ora);
                            const toTime = this.formatTimeDisplay(cfg.valid_to_ora);
                            extra = `${fromTime} → ${toTime} | ${days}`;
                        }
                        
                        // ID per eliminazione: per standard usa il nome, per altri usa l'id
                        const deleteId = type === 'standard' ? name : cfg.id;
                        
                        // Serializza i dati della configurazione per passarli alla funzione di edit
                        const cfgData = encodeURIComponent(JSON.stringify(cfg));
                        
                        html += `
                            <div class="dc-config-item" style="margin: 5px 0; padding: 8px; background: var(--card-background-color); display: flex; justify-content: space-between; align-items: center;">
                                <div style="flex: 1;">
                                    <span class="dc-badge ${badgeClass}">${sourceLabel}</span>
                                    Valore: <strong>${cfg.value}</strong><br>
                                    <small>${extra}</small>
                                </div>
                                <div style="display: flex; gap: 5px;">
                                    <button class="dc-btn" style="padding: 4px 8px; font-size: 11px;" onclick="window.dcEditConfig('${name}', '${type}', '${deleteId}', '${cfgData}')">✏️</button>
                                    <button class="dc-btn-delete" style="padding: 4px 8px; font-size: 11px;" onclick="window.dcDeleteSingleConfig('${type}', '${deleteId}')">🗑️</button>
                                </div>
                            </div>
                        `;
                    }
                    
                    html += `</div>`;
                }
            }
            
            container.innerHTML = html;
        } catch (error) {
            console.error('Error loading configurations:', error);
            container.innerHTML = '<p style="color: var(--error-color);">Errore nel caricamento</p>';
        }

        window.dcDeleteConfig = async (name) => {
            if (confirm(`Eliminare tutte le configurazioni di "${name}"?`)) {
                await this._hass.callService('mia_config', 'delete_config', {
                    setup_name: name,
                    config_type: 'all'
                });
                this.showToast('Configurazione eliminata!');
                setTimeout(() => this.loadConfigurations(), 500);
            }
        };
        
        window.dcDeleteSingleConfig = async (type, id) => {
            if (confirm(`Eliminare questa configurazione ${type}?`)) {
                try {
                    await this._hass.callService('mia_config', 'delete_single_config', {
                        config_type: type,
                        config_id: id.toString()
                    });
                    this.showToast('Configurazione eliminata!');
                    setTimeout(() => this.loadConfigurations(), 500);
                } catch (err) {
                    console.error('Errore eliminazione:', err);
                    this.showToast('Errore: ' + err.message, true);
                }
            }
        };
        
        window.dcEditConfig = async (name, type, id, cfgDataEncoded) => {
            const cfg = JSON.parse(decodeURIComponent(cfgDataEncoded));
            const modal = this.content.querySelector('#dc-edit-modal');
            const modalBody = this.content.querySelector('#dc-edit-modal-body');
            
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
                        </div>
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="dc-btn">Salva</button>
                            <button type="button" class="dc-btn" onclick="window.dcCloseEditModal()" style="background: #666;">Annulla</button>
                        </div>
                    </form>
                `;
            } else if (type === 'time') {
                // Converti il formato datetime per datetime-local
                const formatForInput = (dt) => dt.replace(' ', 'T').substring(0, 16);
                
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
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="dc-btn">Salva</button>
                            <button type="button" class="dc-btn" onclick="window.dcCloseEditModal()" style="background: #666;">Annulla</button>
                        </div>
                    </form>
                `;
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
                                            ${this.generateHourOptions(0, 23)}
                                        </select>
                                        <span class="dc-time-separator">:</span>
                                        <select id="edit-from-minute" required>
                                            ${this.generateMinuteOptions()}
                                        </select>
                                    </div>
                                </div>
                                <span style="font-size: 18px; align-self: flex-end; padding-bottom: 8px;">→</span>
                                <div>
                                    <label style="font-size: 12px; margin-bottom: 4px;">Alle:</label>
                                    <div class="dc-time-input">
                                        <select id="edit-to-hour" required>
                                            ${this.generateHourOptions(0, 23)}
                                        </select>
                                        <span class="dc-time-separator">:</span>
                                        <select id="edit-to-minute" required>
                                            ${this.generateMinuteOptions()}
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
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" class="dc-btn">Salva</button>
                            <button type="button" class="dc-btn" onclick="window.dcCloseEditModal()" style="background: #666;">Annulla</button>
                        </div>
                    </form>
                `;
                
                // Dopo aver mostrato il modal, imposta i valori dei selettori
                setTimeout(() => {
                    this.content.querySelector('#edit-from-hour').value = fromHour;
                    this.content.querySelector('#edit-from-minute').value = fromMinute;
                    this.content.querySelector('#edit-to-hour').value = toHour;
                    this.content.querySelector('#edit-to-minute').value = toMinute;
                }, 10);
            }
            
            modalBody.innerHTML = formHtml;
            modal.classList.add('active');
            
            // Gestione submit del form
            this.content.querySelector('#dc-edit-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                
                try {
                    if (type === 'standard') {
                        await this._hass.callService('mia_config', 'set_config', {
                            setup_name: name,
                            setup_value: formData.get('setup_value'),
                            priority: parseInt(formData.get('priority'))
                        });
                    } else if (type === 'time') {
                        // Prima elimina la vecchia configurazione
                        await this._hass.callService('mia_config', 'delete_single_config', {
                            config_type: 'time',
                            config_id: id
                        });
                        
                        // Poi crea la nuova
                        const formatDateTime = (dt) => dt.replace('T', ' ') + ':00';
                        await this._hass.callService('mia_config', 'set_time_config', {
                            setup_name: name,
                            setup_value: formData.get('setup_value'),
                            valid_from: formatDateTime(formData.get('valid_from')),
                            valid_to: formatDateTime(formData.get('valid_to'))
                        });
                    } else if (type === 'schedule') {
                        // Prima elimina la vecchia configurazione
                        await this._hass.callService('mia_config', 'delete_single_config', {
                            config_type: 'schedule',
                            config_id: id
                        });
                        
                        // Poi crea la nuova
                        const days = Array.from(this.content.querySelectorAll('#dc-edit-form input[name="days"]:checked'))
                            .map(cb => parseInt(cb.value));
                        
                        const fromHour = parseInt(this.content.querySelector('#edit-from-hour').value);
                        const fromMinute = parseInt(this.content.querySelector('#edit-from-minute').value);
                        const toHour = parseInt(this.content.querySelector('#edit-to-hour').value);
                        const toMinute = parseInt(this.content.querySelector('#edit-to-minute').value);
                        
                        await this._hass.callService('mia_config', 'set_schedule_config', {
                            setup_name: name,
                            setup_value: formData.get('setup_value'),
                            valid_from_ora: this.timeSelectorsToDecimal(fromHour, fromMinute),
                            valid_to_ora: this.timeSelectorsToDecimal(toHour, toMinute),
                            days_of_week: days
                        });
                    }
                    
                    window.dcCloseEditModal();
                    this.showToast('Configurazione modificata!');
                    setTimeout(() => this.loadConfigurations(), 500);
                } catch (err) {
                    console.error('Errore modifica:', err);
                    this.showToast('Errore: ' + err.message, true);
                }
            });
        };
        
        window.dcCloseEditModal = () => {
            const modal = this.content.querySelector('#dc-edit-modal');
            modal.classList.remove('active');
        };
        
        window.dcLoadHistory = async () => {
            const container = this.content.querySelector('#dc-history-list');
            const filterInput = this.content.querySelector('#history-filter');
            const setupName = filterInput ? filterInput.value.trim() : '';
            
            container.innerHTML = 'Caricamento storico...';
            
            try {
                const result = await this._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'get_history',
                    service_data: {
                        setup_name: setupName || undefined,
                        limit: 100
                    },
                    return_response: true
                });
                
                const history = result.response?.history || result.response || [];
                console.log('Storico caricato:', history);
                
                if (!Array.isArray(history) || history.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: var(--secondary-text-color);">Nessuna voce nello storico</p>';
                    return;
                }
                
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
                                   entry.operation === 'UPDATE' ? '#ff9800' : '#4caf50';
                    const typeLabel = entry.config_type === 'time' ? '⏰ Tempo' :
                                     entry.config_type === 'schedule' ? '📅 Orario' : '⚙️ Standard';
                    
                    let details = entry.setup_value || '-';
                    if (entry.config_type === 'schedule' && entry.valid_from_ora) {
                        const fromTime = this.formatTimeDisplay(entry.valid_from_ora);
                        const toTime = this.formatTimeDisplay(entry.valid_to_ora);
                        details += ` (${fromTime} → ${toTime})`;
                    } else if (entry.config_type === 'time' && entry.valid_from_date) {
                        details += ` (${entry.valid_from_date} - ${entry.valid_to_date})`;
                    } else if (entry.config_type === 'standard' && entry.priority) {
                        details += ` (P:${entry.priority})`;
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
                container.innerHTML = html;
                
            } catch (err) {
                console.error('Errore caricamento storico:', err);
                container.innerHTML = '<p style="color: var(--error-color);">Errore nel caricamento dello storico</p>';
            }
        };
        
        window.dcRestoreFromHistory = async (historyId) => {
            if (!confirm('Ripristinare questa configurazione?')) return;
            
            try {
                // Recupera i dettagli dalla storia
                const result = await this._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'get_history',
                    service_data: { limit: 1000 },
                    return_response: true
                });
                
                const history = result.response?.history || result.response || [];
                const entry = Array.isArray(history) ? history.find(h => h.id === historyId) : null;
                
                if (!entry) {
                    this.showToast('Voce storico non trovata', true);
                    return;
                }
                
                // Ricrea la configurazione in base al tipo
                if (entry.config_type === 'standard') {
                    await this._hass.callService('mia_config', 'set_config', {
                        setup_name: entry.setup_name,
                        setup_value: entry.setup_value,
                        priority: entry.priority || 99
                    });
                } else if (entry.config_type === 'schedule') {
                    await this._hass.callService('mia_config', 'set_schedule_config', {
                        setup_name: entry.setup_name,
                        setup_value: entry.setup_value,
                        valid_from_ora: parseFloat(entry.valid_from_ora),
                        valid_to_ora: parseFloat(entry.valid_to_ora),
                        days_of_week: entry.days_of_week ? entry.days_of_week.split(',').map(d => parseInt(d)) : [0,1,2,3,4,5,6]
                    });
                } else if (entry.config_type === 'time') {
                    await this._hass.callService('mia_config', 'set_time_config', {
                        setup_name: entry.setup_name,
                        setup_value: entry.setup_value,
                        valid_from: entry.valid_from_date,
                        valid_to: entry.valid_to_date
                    });
                }
                
                this.showToast('Configurazione ripristinata!');
                setTimeout(() => {
                    this.loadConfigurations();
                    window.dcLoadHistory();
                }, 500);
                
            } catch (err) {
                console.error('Errore ripristino:', err);
                this.showToast('Errore: ' + err.message, true);
            }
        };
    }

    async loadConfigsForWeeklyView() {
        try {
            const result = await this._hass.callWS({
                type: 'call_service',
                domain: 'mia_config',
                service: 'get_configurations',
                service_data: {},
                return_response: true
            });
            
            const configs = result.response || {};
            const select = this.content.querySelector('#weekly-config-select');
            
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
        
        window.dcLoadWeeklyView = async () => {
            const setupName = this.content.querySelector('#weekly-config-select').value;
            if (!setupName) {
                this.showToast('Seleziona una configurazione', true);
                return;
            }
            
            try {
                const result = await this._hass.callWS({
                    type: 'call_service',
                    domain: 'mia_config',
                    service: 'get_configurations',
                    service_data: {},
                    return_response: true
                });
                
                const configs = result.response || {};
                const setupConfigs = configs[setupName] || [];
                
                this.renderWeeklyView(setupName, setupConfigs);
                
            } catch (error) {
                console.error('Error loading weekly view:', error);
                this.showToast('Errore nel caricamento', true);
            }
        };
    }

    renderWeeklyView(setupName, configs) {
        const container = this.content.querySelector('#dc-weekly-view');
        
        // Separa configurazioni per tipo
        const standardConfig = configs.find(c => c.type === 'standard');
        const timeConfigs = configs.filter(c => c.type === 'time');
        const scheduleConfigs = configs.filter(c => c.type === 'schedule');
        
        // Genera 14 giorni a partire da oggi
        const now = new Date();
        const days = [];
        for (let i = 0; i < 14; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() + i);
            days.push(date);
        }
        
        // Calcola valore per ogni ora di ogni giorno
        const hoursInDay = Array.from({length: 24}, (_, i) => i);
        
        let html = `<h3>📊 Vista Settimanale: ${setupName}</h3>`;
        html += '<div style="overflow-x: auto;">';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 11px;">';
        
        // Header con giorni
        html += '<thead><tr style="background: var(--primary-color); color: white;">';
        html += '<th style="padding: 8px; border: 1px solid var(--divider-color); position: sticky; left: 0; background: var(--primary-color);">Ora</th>';
        days.forEach(day => {
            const dayOfWeekJS = day.getDay(); // 0=Dom, 1=Lun, ... 6=Sab in JavaScript
            const dayOfWeekPython = dayOfWeekJS === 0 ? 6 : dayOfWeekJS - 1; // Converti a 0=Lun, 6=Dom
            const dayName = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'][dayOfWeekPython];
            const dateStr = `${day.getDate()}/${day.getMonth() + 1}`;
            html += `<th style="padding: 8px; border: 1px solid var(--divider-color);">${dayName}<br>${dateStr}</th>`;
        });
        html += '</tr></thead><tbody>';
        
        // Righe per ogni ora
        hoursInDay.forEach(hour => {
            html += '<tr>';
            html += `<td style="padding: 4px 8px; border: 1px solid var(--divider-color); font-weight: bold; position: sticky; left: 0; background: var(--card-background-color);">${String(hour).padStart(2, '0')}:00</td>`;
            
            days.forEach(day => {
                const value = this.calculateValueForDateTime(day, hour, standardConfig, timeConfigs, scheduleConfigs);
                const cellStyle = this.getWeeklyCellStyle(value, standardConfig);
                html += `<td style="padding: 4px; border: 1px solid var(--divider-color); text-align: center; ${cellStyle}">${value}</td>`;
            });
            
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        
        // Legenda
        html += '<div style="margin-top: 15px; padding: 10px; background: var(--card-background-color); border-radius: 4px;">';
        html += '<strong>Legenda:</strong><br>';
        if (standardConfig) {
            html += `<span style="display: inline-block; width: 20px; height: 20px; background: #e8f5e9; border: 1px solid #4caf50; margin-right: 5px;"></span> Valore standard: ${standardConfig.value}<br>`;
        }
        html += '<span style="display: inline-block; width: 20px; height: 20px; background: #fff3e0; border: 1px solid #ff9800; margin-right: 5px;"></span> Override orario<br>';
        html += '<span style="display: inline-block; width: 20px; height: 20px; background: #e3f2fd; border: 1px solid #2196f3; margin-right: 5px;"></span> Override temporale<br>';
        html += '</div>';
        
        container.innerHTML = html;
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

    getWeeklyCellStyle(value, standardConfig) {
        if (value.includes('⏰')) {
            return 'background: #e3f2fd; font-weight: bold;';
        } else if (value.includes('🕐')) {
            return 'background: #fff3e0; font-weight: bold;';
        } else if (standardConfig && value === standardConfig.value) {
            return 'background: #e8f5e9;';
        }
        return '';
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
