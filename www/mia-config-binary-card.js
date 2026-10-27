// Widget Auto/Manuale indipendenti dalla card principale.
// La forzatura manuale usa i servizi set_manual_override / clear_manual_override,
// che salvano una configurazione a tempo con priorità riservata 0 (la più alta in assoluto).
const MANUAL_OVERRIDE_PRIORITY = 0;

class MiaConfigControlCard extends HTMLElement {
    static cardType = 'binary';

    static getConfigElement() {
        const editor = document.createElement('mia-config-control-card-editor');
        editor.cardType = this.cardType;
        return editor;
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
        this._config = config;
        this._type = this.constructor.cardType;
        this._values = Array.isArray(config.options) ? config.options : [];
        this._valuesLoaded = false;
        this._editing = false;
        this._error = null;
        this._entityState = undefined;
        this.render();
    }

    set hass(hass) {
        this._hass = hass;
        if (this._type === 'select' && !this._valuesLoaded) {
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

    renderManualInput(disabled) {
        const current = this.getCurrentValue();
        if (this._type === 'binary') {
            const checked = ['true', '1', 'on', 'yes', 'enabled'].includes(String(current).toLowerCase());
            return `<input data-manual-value type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>`;
        }
        if (this._type === 'select') {
            const options = this._values.map(item => {
                const option = typeof item === 'object' ? item : { value: item, label: item };
                return `<option value="${this.escape(option.value)}" ${String(option.value) === String(current) ? 'selected' : ''}>${this.escape(option.label)}</option>`;
            }).join('');
            return `<select data-manual-value ${disabled ? 'disabled' : ''}>${options}</select>`;
        }
        return `<input data-manual-value type="number" step="any" value="${this.escape(current)}" ${this._config.min !== undefined ? `min="${this.escape(this._config.min)}"` : ''} ${this._config.max !== undefined ? `max="${this.escape(this._config.max)}"` : ''} ${disabled ? 'disabled' : ''}>`;
    }

    render() {
        if (!this._hass || !this._config) return;
        const entity = this.getEntity();
        const active = this.isManualActive();
        const manual = active || this._editing;
        const current = this.getCurrentValue();
        const name = this._config.name || entity?.attributes?.friendly_name || this._config.entity;
        const typeLabel = this._type === 'binary' ? 'Boolean' : this._type === 'select' ? 'Valori validi' : 'Numero';
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
                    <div class="value-input">${this.renderManualInput(!manual)}</div>
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

    async applyManual() {
        const setupName = this.getSetupName();
        if (!setupName) return this.showError("L'entità non espone setup_name: specificarlo nella configurazione");
        const input = this.querySelector('[data-manual-value]');
        let value = input?.value;
        if (this._type === 'binary') value = input?.checked ? 'true' : 'false';
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
    name: 'Nome (opzionale)',
    setup_name: 'Nome configurazione (opzionale, se l\'entità non espone setup_name)',
    min: 'Minimo (opzionale)',
    max: 'Massimo (opzionale)'
};

class MiaConfigControlCardEditor extends HTMLElement {
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
            { name: 'name', selector: { text: {} } },
            { name: 'setup_name', selector: { text: {} } }
        ];
        if (this.cardType === 'number') {
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
                // Rimuove i campi opzionali svuotati per non lasciare chiavi vuote nello YAML
                Object.keys(config).forEach(key => {
                    if (config[key] === '' || config[key] === undefined || config[key] === null) delete config[key];
                });
                this._config = config;
                this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
            });
            this.appendChild(this._form);
        }
        this._form.hass = this._hass;
        this._form.schema = this.getSchema();
        this._form.data = this._config;
    }
}

customElements.define('mia-config-control-card-editor', MiaConfigControlCardEditor);

class MiaConfigBinaryCard extends MiaConfigControlCard {
    static cardType = 'binary';
}
class MiaConfigSelectCard extends MiaConfigControlCard {
    static cardType = 'select';
}
class MiaConfigNumberCard extends MiaConfigControlCard {
    static cardType = 'number';
}

customElements.define('mia-config-binary-card', MiaConfigBinaryCard);
customElements.define('mia-config-select-card', MiaConfigSelectCard);
customElements.define('mia-config-number-card', MiaConfigNumberCard);

window.customCards = window.customCards || [];
window.customCards.push(
    { type: 'mia-config-binary-card', name: 'Mia Config Boolean Card', description: 'Controllo booleano Auto/Manuale' },
    { type: 'mia-config-select-card', name: 'Mia Config Select Card', description: 'Controllo a valori validi Auto/Manuale' },
    { type: 'mia-config-number-card', name: 'Mia Config Number Card', description: 'Controllo numerico Auto/Manuale' }
);
