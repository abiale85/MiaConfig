// Widget Auto/Manuale indipendenti dalla card principale.
// La forzatura manuale usa i servizi set_manual_override / clear_manual_override,
// che salvano una configurazione a tempo con priorità riservata 0 (la più alta in assoluto).
const MANUAL_OVERRIDE_PRIORITY = 0;
const CONTROL_TYPES = ['auto', 'boolean', 'select', 'number', 'text'];
const BOOLEAN_PAIRS = { true: 'false', false: 'true', on: 'off', off: 'on' };

class MiaConfigWidget extends HTMLElement {
    // Tipo imposto dagli alias delle beta precedenti (mia-config-binary-card ecc.)
    static forcedControl = null;

    static getConfigElement() {
        return document.createElement('mia-config-widget-editor');
    }

    static getStubConfig(hass) {
        const entity = Object.keys(hass.states).find(entityId =>
            entityId.startsWith('sensor.') && hass.states[entityId].attributes?.integration === 'mia_config'
        );
        return { entity: entity || '' };
    }

    setConfig(config) {
        if (!config || !config.entity) {
            throw new Error('Devi specificare entity nella configurazione della card');
        }
        const control = this.constructor.forcedControl || config.control || 'auto';
        if (!CONTROL_TYPES.includes(control)) {
            throw new Error(`control non valido: ${control} (valori ammessi: ${CONTROL_TYPES.join(', ')})`);
        }
        this._config = config;
        this._control = control;
        this._values = Array.isArray(config.options) ? config.options : [];
        this._valuesLoaded = false;
        this._editing = false;
        this._error = null;
        this._entityState = undefined;
        this.render();
    }

    set hass(hass) {
        this._hass = hass;
        if (['auto', 'select'].includes(this._control) && !this._valuesLoaded) {
            this.loadValidValues();
        }
        // Ridisegna solo se cambia l'entità controllata e l'utente non sta modificando il valore
        const entityState = hass.states[this._config.entity];
        if (entityState === this._entityState) return;
        this._entityState = entityState;
        if (!this._editing) this.render();
    }

    getCardSize() {
        return 3;
    }

    getEntity() {
        return this._hass?.states?.[this._config.entity];
    }

    getSetupName() {
        return this._config.setup_name || this.getEntity()?.attributes?.setup_name;
    }

    getCurrentValue() {
        return this.getEntity()?.state ?? 'unknown';
    }

    isManualActive() {
        const attrs = this.getEntity()?.attributes || {};
        return attrs.source === 'time' && Number(attrs.priority) === MANUAL_OVERRIDE_PRIORITY;
    }

    // In modalità auto il tipo si deduce da valori validi e valore corrente
    getControlType() {
        if (this._control !== 'auto') return this._control;
        if (this._values.length > 0) return 'select';
        const current = String(this.getCurrentValue()).toLowerCase();
        if (current in BOOLEAN_PAIRS) return 'boolean';
        if (current !== '' && !isNaN(Number(current))) return 'number';
        return 'text';
    }

    async loadValidValues() {
        this._valuesLoaded = true;
        const setupName = this.getSetupName();
        if (!setupName) return;
        try {
            const response = await this._hass.callWS({
                type: 'call_service',
                domain: 'mia_config',
                service: 'get_valid_values',
                service_data: { entity_id: this._config.entity, setup_name: setupName },
                return_response: true
            });
            const values = response.response?.valid_values || [];
            if (Array.isArray(values) && values.length > 0) {
                this._values = values.map(item => ({
                    value: item.value,
                    label: item.description ? `${item.value} - ${item.description}` : item.value
                }));
                if (!this._editing) this.render();
            }
        } catch (error) {
            this.showError(error.message || 'Impossibile caricare i valori validi');
        }
    }

    renderManualInput(type, disabled) {
        const current = this.getCurrentValue();
        if (type === 'boolean') {
            const checked = ['true', '1', 'on', 'yes', 'enabled'].includes(String(current).toLowerCase());
            return `<input data-manual-value type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>`;
        }
        if (type === 'select') {
            const options = this._values.map(item => {
                const option = typeof item === 'object' ? item : { value: item, label: item };
                return `<option value="${this.escape(option.value)}" ${String(option.value) === String(current) ? 'selected' : ''}>${this.escape(option.label)}</option>`;
            }).join('');
            return `<select data-manual-value ${disabled ? 'disabled' : ''}>${options}</select>`;
        }
        if (type === 'number') {
            return `<input data-manual-value type="number" step="any" value="${this.escape(current)}" ${this._config.min !== undefined ? `min="${this.escape(this._config.min)}"` : ''} ${this._config.max !== undefined ? `max="${this.escape(this._config.max)}"` : ''} ${disabled ? 'disabled' : ''}>`;
        }
        return `<input data-manual-value type="text" value="${this.escape(current)}" ${disabled ? 'disabled' : ''}>`;
    }

    render() {
        if (!this._hass || !this._config) return;
        const entity = this.getEntity();
        const active = this.isManualActive();
        const manual = active || this._editing;
        const current = this.getCurrentValue();
        const type = this.getControlType();
        const name = this._config.name || entity?.attributes?.friendly_name || this._config.entity;
        const typeLabel = { boolean: 'Boolean', select: 'Valori validi', number: 'Numero', text: 'Testo' }[type];
        this.innerHTML = `
            <ha-card>
                <div class="control-card">
                    <div class="header"><strong>${this.escape(name)}</strong><span>${typeLabel}</span></div>
                    <div class="current">Valore attivo: <b>${this.escape(current)}</b>${active ? ' (forzato)' : ''}</div>
                    <div class="modes">
                        <button data-mode="auto" class="${manual ? '' : 'active'}">Auto</button>
                        <button data-mode="manual" class="${manual ? 'active' : ''}">Manuale</button>
                    </div>
                    <label>Valore manuale</label>
                    <div class="value-input">${this.renderManualInput(type, !manual)}</div>
                    <label>Fine manuale (opzionale)</label>
                    <input data-valid-to type="datetime-local" ${manual ? '' : 'disabled'}>
                    <button data-apply class="apply" ${manual ? '' : 'disabled'}>Applica valore manuale</button>
                    ${this._error ? `<div class="error">${this.escape(this._error)}</div>` : ''}
                </div>
            </ha-card>
            <style>
                .control-card { padding: 16px; }
                .header { display: flex; justify-content: space-between; gap: 12px; font-size: 16px; }
                .header span, .current, label { color: var(--secondary-text-color); font-size: 13px; }
                .current { margin: 12px 0; }
                .modes { display: flex; gap: 8px; margin: 12px 0; }
                button, input, select { font: inherit; box-sizing: border-box; }
                button { border: 1px solid var(--divider-color); border-radius: 4px; padding: 9px 14px; cursor: pointer; background: var(--card-background-color); color: var(--primary-text-color); }
                button.active { background: var(--primary-color); color: white; border-color: var(--primary-color); }
                button:disabled, input:disabled, select:disabled { opacity: .55; cursor: not-allowed; }
                .value-input input, .value-input select, [data-valid-to] { width: 100%; padding: 9px; margin: 5px 0 12px; color: var(--primary-text-color); background: var(--card-background-color); border: 1px solid var(--divider-color); border-radius: 4px; }
                .value-input input[type="checkbox"] { width: 24px; height: 24px; }
                .apply { width: 100%; margin-top: 4px; background: var(--primary-color); color: white; border-color: var(--primary-color); }
                .error { color: var(--error-color); margin-top: 10px; font-size: 13px; }
            </style>
        `;
        this.bindEvents();
    }

    bindEvents() {
        this.querySelector('[data-mode="auto"]')?.addEventListener('click', () => this.clearManual());
        this.querySelector('[data-mode="manual"]')?.addEventListener('click', () => {
            this._editing = true;
            this.render();
        });
        this.querySelector('[data-apply]')?.addEventListener('click', () => this.applyManual());
    }

    // Mantiene il "vocabolario" del valore corrente (on/off oppure true/false)
    booleanValue(checked) {
        const current = String(this.getCurrentValue()).toLowerCase();
        const family = current === 'on' || current === 'off' ? ['on', 'off'] : ['true', 'false'];
        return checked ? family[0] : family[1];
    }

    async applyManual() {
        const setupName = this.getSetupName();
        if (!setupName) return this.showError("L'entità non espone setup_name: specificarlo nella configurazione");
        const input = this.querySelector('[data-manual-value]');
        let value = input?.value;
        if (this.getControlType() === 'boolean') value = this.booleanValue(input?.checked);
        if (value === undefined || value === '') return this.showError('Inserisci un valore da forzare');
        // datetime-local restituisce un orario locale senza fuso: il backend lo interpreta come locale
        const validTo = this.querySelector('[data-valid-to]')?.value;
        try {
            await this._hass.callService('mia_config', 'set_manual_override', {
                entity_id: this._config.entity,
                setup_name: setupName,
                setup_value: String(value),
                ...(validTo ? { valid_to: validTo } : {})
            });
            this._editing = false;
            this._error = null;
            this.render();
        } catch (error) {
            this.showError(error.message || 'Impossibile applicare il valore manuale');
        }
    }

    async clearManual() {
        this._editing = false;
        if (!this.isManualActive()) {
            this._error = null;
            return this.render();
        }
        const setupName = this.getSetupName();
        if (!setupName) return this.showError("L'entità non espone setup_name: specificarlo nella configurazione");
        try {
            await this._hass.callService('mia_config', 'clear_manual_override', {
                entity_id: this._config.entity,
                setup_name: setupName
            });
            this._error = null;
            this.render();
        } catch (error) {
            this.showError(error.message || 'Impossibile tornare in automatico');
        }
    }

    showError(message) {
        this._error = message;
        this.render();
    }

    escape(value) {
        return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
}

// Editor visuale: usa ha-form di Home Assistant
const EDITOR_LABELS = {
    entity: 'Entità Mia Config',
    control: 'Tipo di controllo',
    name: 'Nome (opzionale)',
    setup_name: 'Nome configurazione (opzionale, se l\'entità non espone setup_name)',
    min: 'Minimo (opzionale)',
    max: 'Massimo (opzionale)'
};

class MiaConfigWidgetEditor extends HTMLElement {
    setConfig(config) {
        this._config = config;
        this.render();
    }

    set hass(hass) {
        this._hass = hass;
        this.render();
    }

    getSchema() {
        const schema = [
            { name: 'entity', required: true, selector: { entity: { filter: { domain: 'sensor', integration: 'mia_config' } } } },
            {
                name: 'control',
                selector: {
                    select: {
                        mode: 'dropdown',
                        options: [
                            { value: 'auto', label: 'Automatico (dedotto dal valore)' },
                            { value: 'boolean', label: 'Boolean (interruttore)' },
                            { value: 'select', label: 'Valori validi (tendina)' },
                            { value: 'number', label: 'Numero' },
                            { value: 'text', label: 'Testo libero' }
                        ]
                    }
                }
            },
            { name: 'name', selector: { text: {} } },
            { name: 'setup_name', selector: { text: {} } }
        ];
        if (['auto', 'number'].includes(this._config.control || 'auto')) {
            schema.push({
                type: 'grid',
                name: '',
                schema: [
                    { name: 'min', selector: { number: { mode: 'box', step: 'any' } } },
                    { name: 'max', selector: { number: { mode: 'box', step: 'any' } } }
                ]
            });
        }
        return schema;
    }

    render() {
        if (!this._hass || !this._config) return;
        if (!this._form) {
            this._form = document.createElement('ha-form');
            this._form.computeLabel = (schema) => EDITOR_LABELS[schema.name] ?? schema.name;
            this._form.addEventListener('value-changed', (ev) => {
                ev.stopPropagation();
                const config = { ...ev.detail.value };
                // Rimuove i campi opzionali svuotati (e il default auto) per non sporcare lo YAML
                Object.keys(config).forEach(key => {
                    if (config[key] === '' || config[key] === undefined || config[key] === null) delete config[key];
                });
                if (config.control === 'auto') delete config.control;
                this._config = config;
                this.render();
                this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
            });
            this.appendChild(this._form);
        }
        this._form.hass = this._hass;
        this._form.schema = this.getSchema();
        this._form.data = { control: 'auto', ...this._config };
    }
}

// Alias delle beta 2.3.9-beta.1/2: restano funzionanti ma non compaiono nel selettore card
class MiaConfigBinaryCard extends MiaConfigWidget {
    static forcedControl = 'boolean';
}
class MiaConfigSelectCard extends MiaConfigWidget {
    static forcedControl = 'select';
}
class MiaConfigNumberCard extends MiaConfigWidget {
    static forcedControl = 'number';
}

// Il file può essere caricato due volte (caricamento automatico + vecchia risorsa manuale)
if (!customElements.get('mia-config-widget')) {
    customElements.define('mia-config-widget', MiaConfigWidget);
    customElements.define('mia-config-widget-editor', MiaConfigWidgetEditor);
    customElements.define('mia-config-binary-card', MiaConfigBinaryCard);
    customElements.define('mia-config-select-card', MiaConfigSelectCard);
    customElements.define('mia-config-number-card', MiaConfigNumberCard);

    window.customCards = window.customCards || [];
    window.customCards.push({
        type: 'mia-config-widget',
        name: 'Mia Config Widget',
        description: 'Forzatura manuale Auto/Manuale di una configurazione',
        preview: true
    });
}
