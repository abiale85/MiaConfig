// Widget Auto/Manuale indipendenti dalla card principale.
// La forzatura manuale usa i servizi set_manual_override / clear_manual_override,
// che salvano una configurazione a tempo con priorità riservata 0 (la più alta in assoluto).
// Tutto il file è racchiuso in uno scope isolato: niente nomi globali in conflitto con altre card.
(() => {
const MANUAL_OVERRIDE_PRIORITY = 0;
const CONTROL_TYPES = ['auto', 'boolean', 'select', 'number', 'text'];
const LAYOUTS = ['card', 'tile', 'row'];
const BOOLEAN_PAIRS = { true: 'false', false: 'true', on: 'off', off: 'on' };
const DEFAULT_DURATIONS = [30, 60, 120, 240];
const DEFAULT_ICONS = {
    boolean: 'mdi:toggle-switch-outline',
    select: 'mdi:format-list-bulleted',
    number: 'mdi:numeric',
    text: 'mdi:form-textbox'
};

// ---------- Utilità ----------

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const pad = (n) => String(n).padStart(2, '0');

// Stringa ISO locale senza fuso: il backend la interpreta nel fuso di Home Assistant
const toLocalIso = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;

const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
};

const formatTime = (date) => {
    const now = new Date();
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    if (date.toDateString() === now.toDateString()) return time;
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return `domani ${time}`;
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${time}`;
};

const whenText = (date) => {
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return `alle ${time}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return `domani alle ${time}`;
    return `il ${pad(date.getDate())}/${pad(date.getMonth() + 1)} alle ${time}`;
};

// "fino alle 22:10", "fino a domani alle 00:22", "fino al 28/10 alle 10:00"
const untilText = (date) => `fino ${whenText(date).replace(/^domani/, 'a domani').replace(/^il /, 'al ')}`;

const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

const formatRemaining = (date) => {
    const minutes = Math.max(0, Math.round((date.getTime() - Date.now()) / 60000));
    if (minutes < 1) return 'meno di 1 min';
    if (minutes < 60 * 24) return formatDuration(minutes);
    const days = Math.floor(minutes / (60 * 24));
    return days === 1 ? '1 giorno' : `${days} giorni`;
};

// Prossima occorrenza di un orario HH:MM (oggi se nel futuro, altrimenti domani)
const nextOccurrence = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
    return date;
};

const isTruthy = (value) => ['true', '1', 'on', 'yes', 'enabled'].includes(String(value).toLowerCase());

// ---------- Stili comuni ----------

const BASE_STYLE = `
    :host {
        display: block;
        --mia-manual-color: var(--warning-color, #ff9800);
        --mia-auto-color: var(--primary-color, #03a9f4);
        --mia-muted: var(--secondary-text-color, #727272);
        --mia-outline-auto: var(--disabled-color, var(--divider-color, #bdbdbd));
        --mia-radius: var(--ha-card-border-radius, 12px);
    }
    * { box-sizing: border-box; }
    button { font: inherit; color: inherit; background: none; border: none; padding: 0; cursor: pointer; }
    button:disabled { cursor: default; opacity: .5; }
    ha-icon { --mdc-icon-size: 20px; display: inline-flex; }
    .chip {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 12px; border-radius: 999px; font-size: 13px; line-height: 18px;
        border: 1px solid var(--divider-color); background: var(--card-background-color);
        color: var(--primary-text-color); white-space: nowrap;
    }
    .chip.selected { background: var(--mia-accent); border-color: var(--mia-accent); color: var(--text-primary-color, #fff); }
    .chip ha-icon { --mdc-icon-size: 16px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .bool-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .bool-buttons button {
        display: flex; align-items: center; justify-content: center; gap: 8px;
        padding: 12px; border-radius: 10px; border: 1px solid var(--divider-color); font-weight: 500;
    }
    .bool-buttons button.selected { background: var(--mia-accent); border-color: var(--mia-accent); color: var(--text-primary-color, #fff); }
    .stepper { display: flex; align-items: center; gap: 8px; }
    .stepper button {
        width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--divider-color);
        display: flex; align-items: center; justify-content: center;
    }
    .stepper input, .text-input {
        flex: 1; min-width: 0; height: 44px; padding: 0 12px; text-align: center; font: inherit; font-size: 18px;
        border-radius: 10px; border: 1px solid var(--divider-color);
        background: var(--card-background-color); color: var(--primary-text-color);
    }
    .text-input { text-align: left; font-size: 15px; }
    .unit { color: var(--mia-muted); }
`;

// Controllo valore condiviso tra card e popup. onSelect è identificato da data-value / data-step.
function renderValueControl(type, value, { values = [], min, max, unit } = {}) {
    if (type === 'boolean') {
        const on = isTruthy(value);
        return `
            <div class="bool-buttons">
                <button data-pick="off" class="${on ? '' : 'selected'}"><ha-icon icon="mdi:power-off"></ha-icon>Spento</button>
                <button data-pick="on" class="${on ? 'selected' : ''}"><ha-icon icon="mdi:power"></ha-icon>Acceso</button>
            </div>`;
    }
    if (type === 'select') {
        if (!values.length) return `<div class="unit">Nessun valore valido definito</div>`;
        return `<div class="chips">${values.map(item => `
            <button class="chip ${String(item.value) === String(value) ? 'selected' : ''}" data-pick-value="${escapeHtml(item.value)}" title="${escapeHtml(item.description || '')}">
                ${escapeHtml(item.description ? `${item.description}` : item.value)}
            </button>`).join('')}</div>`;
    }
    if (type === 'number') {
        return `
            <div class="stepper">
                <button data-step="-1" aria-label="Diminuisci"><ha-icon icon="mdi:minus"></ha-icon></button>
                <input data-number type="number" step="any" value="${escapeHtml(value)}" ${min !== undefined ? `min="${escapeHtml(min)}"` : ''} ${max !== undefined ? `max="${escapeHtml(max)}"` : ''}>
                ${unit ? `<span class="unit">${escapeHtml(unit)}</span>` : ''}
                <button data-step="1" aria-label="Aumenta"><ha-icon icon="mdi:plus"></ha-icon></button>
            </div>`;
    }
    return `<input class="text-input" data-text type="text" value="${escapeHtml(value)}">`;
}

// ---------- Popup forzatura ----------

class MiaConfigWidgetDialog extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._onKey = (ev) => { if (ev.key === 'Escape') this.close(); };
    }

    // opts: { title, type, value, values, min, max, step, unit, durations, manual, currentUntil, nextChangeAt, nextValue, onApply, onAuto }
    open(opts) {
        this._o = opts;
        this._value = opts.value;
        if (opts.manual) this._duration = opts.currentUntil ? 'keep' : 'none';
        else this._duration = opts.nextChangeAt ? 'next' : String(opts.durations[1] ?? opts.durations[0] ?? 'none');
        this._time = '';
        this._datetime = '';
        this._error = null;
        this._busy = false;
        document.body.appendChild(this);
        document.addEventListener('keydown', this._onKey);
        this.render();
    }

    close() {
        document.removeEventListener('keydown', this._onKey);
        this.remove();
    }

    computeUntil() {
        const d = this._duration;
        if (d === 'none') return null;
        if (d === 'keep') return this._o.currentUntil;
        if (d === 'next') return this._o.nextChangeAt;
        if (d === 'time') return this._time ? nextOccurrence(this._time) : undefined;
        if (d === 'datetime') return parseDate(this._datetime) || undefined;
        return new Date(Date.now() + Number(d) * 60000);
    }

    untilPreview() {
        const until = this.computeUntil();
        if (until === undefined) return 'Scegli quando terminare';
        if (until === null) return 'Resta in manuale finché non torni in Auto';
        if (until.getTime() <= Date.now()) return 'La fine deve essere nel futuro';
        return `Torna in Auto <b>${whenText(until)}</b> (tra ${formatRemaining(until)})`;
    }

    render() {
        const o = this._o;
        const durationChip = (key, label, icon) => `
            <button class="chip ${this._duration === key ? 'selected' : ''}" data-duration="${key}">
                ${icon ? `<ha-icon icon="${icon}"></ha-icon>` : ''}${label}
            </button>`;
        const chips = [
            o.manual && o.currentUntil ? durationChip('keep', `Mantieni (${formatTime(o.currentUntil)})`, 'mdi:timer-check-outline') : '',
            ...o.durations.map(min => durationChip(String(min), formatDuration(min))),
            !o.manual && o.nextChangeAt ? durationChip('next', `Prossimo cambio (${formatTime(o.nextChangeAt)})`, 'mdi:calendar-arrow-right') : '',
            durationChip('time', 'Fino alle…', 'mdi:clock-outline'),
            durationChip('datetime', 'Data e ora…', 'mdi:calendar-clock'),
            durationChip('none', 'Senza scadenza', 'mdi:infinity')
        ].join('');

        this.shadowRoot.innerHTML = `
            <style>
                ${BASE_STYLE}
                :host { --mia-accent: var(--mia-manual-color); position: fixed; inset: 0; z-index: 9999; font-family: var(--paper-font-body1_-_font-family, var(--ha-font-family-body, Roboto, sans-serif)); }
                .backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, .5); animation: fade .15s ease-out; }
                .sheet {
                    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
                    width: min(440px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto;
                    background: var(--ha-card-background, var(--card-background-color, #fff)); color: var(--primary-text-color);
                    border-radius: 20px; padding: 20px; box-shadow: 0 10px 40px rgba(0, 0, 0, .35);
                    animation: pop .18s ease-out;
                }
                @media (max-width: 600px) {
                    .sheet { top: auto; bottom: 0; transform: translateX(-50%); width: 100vw; border-radius: 20px 20px 0 0; animation: slide .2s ease-out; padding-bottom: calc(20px + env(safe-area-inset-bottom)); }
                }
                @keyframes fade { from { opacity: 0; } }
                @keyframes pop { from { opacity: 0; transform: translate(-50%, -48%) scale(.97); } }
                @keyframes slide { from { transform: translate(-50%, 100%); } }
                h2 { margin: 0; font-size: 20px; font-weight: 500; display: flex; align-items: center; gap: 10px; }
                h2 ha-icon { color: var(--mia-manual-color); --mdc-icon-size: 24px; }
                .section { margin-top: 20px; }
                .label { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--mia-muted); margin-bottom: 10px; }
                .extra { margin-top: 10px; }
                .extra input {
                    width: 100%; height: 44px; padding: 0 12px; font: inherit; border-radius: 10px;
                    border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color);
                    color-scheme: light dark;
                }
                .preview { margin-top: 14px; font-size: 14px; color: var(--mia-muted); display: flex; align-items: center; gap: 8px; }
                .preview ha-icon { --mdc-icon-size: 18px; }
                .error { margin-top: 12px; color: var(--error-color, #db4437); font-size: 13px; }
                .actions { display: flex; gap: 8px; margin-top: 24px; align-items: center; }
                .actions .spacer { flex: 1; }
                .btn { padding: 10px 18px; border-radius: 999px; font-weight: 500; }
                .btn.text { color: var(--mia-muted); }
                .btn.auto { color: var(--mia-auto-color); display: inline-flex; align-items: center; gap: 6px; }
                .btn.primary { background: var(--mia-manual-color); color: var(--text-primary-color, #fff); }
            </style>
            <div class="backdrop" data-close></div>
            <div class="sheet" role="dialog" aria-modal="true">
                <h2><ha-icon icon="mdi:hand-back-right"></ha-icon>${escapeHtml(o.title)}</h2>
                <div class="section">
                    <div class="label">Valore</div>
                    ${renderValueControl(o.type, this._value, o)}
                </div>
                <div class="section">
                    <div class="label">Per quanto tempo</div>
                    <div class="chips">${chips}</div>
                    ${this._duration === 'time' ? `<div class="extra"><input data-time type="time" value="${escapeHtml(this._time)}"></div>` : ''}
                    ${this._duration === 'datetime' ? `<div class="extra"><input data-datetime type="datetime-local" value="${escapeHtml(this._datetime)}"></div>` : ''}
                    <div class="preview"><ha-icon icon="mdi:timer-outline"></ha-icon><span>${this.untilPreview()}</span></div>
                </div>
                ${this._error ? `<div class="error">${escapeHtml(this._error)}</div>` : ''}
                <div class="actions">
                    ${o.manual ? `<button class="btn auto" data-auto><ha-icon icon="mdi:autorenew"></ha-icon>Torna in Auto</button>` : ''}
                    <span class="spacer"></span>
                    <button class="btn text" data-close>Annulla</button>
                    <button class="btn primary" data-apply ${this._busy ? 'disabled' : ''}>Forza</button>
                </div>
            </div>
        `;
        this.bindEvents();
    }

    bindEvents() {
        const root = this.shadowRoot;
        root.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => this.close()));
        root.querySelectorAll('[data-duration]').forEach(el => el.addEventListener('click', () => {
            this._duration = el.dataset.duration;
            this.render();
            root.querySelector('[data-time], [data-datetime]')?.focus();
        }));
        root.querySelectorAll('[data-pick]').forEach(el => el.addEventListener('click', () => {
            this._value = el.dataset.pick === 'on';
            this.render();
        }));
        root.querySelectorAll('[data-pick-value]').forEach(el => el.addEventListener('click', () => {
            this._value = el.dataset.pickValue;
            this.render();
        }));
        root.querySelectorAll('[data-step]').forEach(el => el.addEventListener('click', () => {
            const input = root.querySelector('[data-number]');
            const next = (Number(input.value) || 0) + Number(el.dataset.step) * (Number(this._o.step) || 1);
            this._value = this.clamp(Math.round(next * 1000) / 1000);
            input.value = this._value;
        }));
        root.querySelector('[data-number]')?.addEventListener('input', (ev) => { this._value = ev.target.value; });
        root.querySelector('[data-text]')?.addEventListener('input', (ev) => { this._value = ev.target.value; });
        root.querySelector('[data-time]')?.addEventListener('input', (ev) => {
            this._time = ev.target.value;
            root.querySelector('.preview span').innerHTML = this.untilPreview();
        });
        root.querySelector('[data-datetime]')?.addEventListener('input', (ev) => {
            this._datetime = ev.target.value;
            root.querySelector('.preview span').innerHTML = this.untilPreview();
        });
        root.querySelector('[data-auto]')?.addEventListener('click', async () => {
            await this.run(() => this._o.onAuto());
        });
        root.querySelector('[data-apply]')?.addEventListener('click', async () => {
            const until = this.computeUntil();
            if (until === undefined) return this.fail('Scegli quando terminare la forzatura');
            if (until && until.getTime() <= Date.now()) return this.fail('La fine deve essere nel futuro');
            if (this._value === '' || this._value === undefined || this._value === null) return this.fail('Scegli un valore');
            await this.run(() => this._o.onApply(this._value, until));
        });
    }

    clamp(value) {
        const { min, max } = this._o;
        if (min !== undefined && value < Number(min)) return Number(min);
        if (max !== undefined && value > Number(max)) return Number(max);
        return value;
    }

    fail(message) {
        this._error = message;
        this.render();
    }

    async run(action) {
        this._busy = true;
        this._error = null;
        this.render();
        try {
            await action();
            this.close();
        } catch (error) {
            this._busy = false;
            this.fail(error.message || 'Operazione non riuscita');
        }
    }
}

// ---------- Widget ----------

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
        return { entity: entity || '', layout: 'row' };
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    setConfig(config) {
        if (!config || !config.entity) {
            throw new Error('Devi specificare entity nella configurazione della card');
        }
        const control = this.constructor.forcedControl || config.control || 'auto';
        if (!CONTROL_TYPES.includes(control)) {
            throw new Error(`control non valido: ${control} (valori ammessi: ${CONTROL_TYPES.join(', ')})`);
        }
        const layout = config.layout || (this.constructor.forcedControl ? 'card' : 'row');
        if (!LAYOUTS.includes(layout)) {
            throw new Error(`layout non valido: ${layout} (valori ammessi: ${LAYOUTS.join(', ')})`);
        }
        this._config = config;
        this._control = control;
        this._layout = layout;
        this._values = Array.isArray(config.options)
            ? config.options.map(item => typeof item === 'object' ? item : { value: item })
            : [];
        this._valuesLoaded = false;
        this._busy = false;
        this._error = null;
        this._entityState = undefined;
        this.render();
    }

    set hass(hass) {
        this._hass = hass;
        if (['auto', 'select'].includes(this._control) && !this._valuesLoaded) {
            this.loadValidValues();
        }
        // Ridisegna solo se cambia l'entità controllata
        const entityState = hass.states[this._config.entity];
        if (entityState === this._entityState) return;
        this._entityState = entityState;
        this.render();
    }

    connectedCallback() {
        // Aggiorna il conto alla rovescia
        this._timer = setInterval(() => this.render(), 30000);
    }

    disconnectedCallback() {
        clearInterval(this._timer);
    }

    getCardSize() {
        return { row: 1, tile: 2, card: 4 }[this._layout] ?? 2;
    }

    // Dimensioni nella vista a sezioni
    getGridOptions() {
        if (this._layout === 'row') return { columns: 6, rows: 1, min_columns: 4, min_rows: 1 };
        if (this._layout === 'tile') return { columns: 6, rows: 2, min_columns: 3, min_rows: 2 };
        return { columns: 12, min_columns: 6 };
    }

    // ----- Dati -----

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

    getManualUntil() {
        return this.isManualActive() ? parseDate(this.getEntity()?.attributes?.valid_to) : null;
    }

    getNextChange() {
        const attrs = this.getEntity()?.attributes || {};
        const at = parseDate(attrs.next_change_at);
        return at && at.getTime() > Date.now() ? { at, value: attrs.next_value } : null;
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

    getIcon(type) {
        return this._config.icon || this.getEntity()?.attributes?.icon || DEFAULT_ICONS[type];
    }

    getName() {
        const entity = this.getEntity();
        return this._config.name || entity?.attributes?.friendly_name || this._config.entity;
    }

    displayValue(value, type) {
        if (type === 'boolean') return isTruthy(value) ? 'Acceso' : 'Spento';
        const match = this._values.find(item => String(item.value) === String(value));
        const text = match?.description || value;
        return this._config.unit && type === 'number' ? `${text} ${this._config.unit}` : text;
    }

    // Mantiene il "vocabolario" del valore corrente (on/off oppure true/false)
    booleanValue(on) {
        const current = String(this.getCurrentValue()).toLowerCase();
        const family = current === 'on' || current === 'off' ? ['on', 'off'] : ['true', 'false'];
        return on ? family[0] : family[1];
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
                this._values = values.map(item => ({ value: item.value, description: item.description }));
                this.render();
            }
        } catch (error) {
            this._error = error.message || 'Impossibile caricare i valori validi';
            this.render();
        }
    }

    // ----- Azioni -----

    async setManual(value, until) {
        const setupName = this.getSetupName();
        if (!setupName) throw new Error("L'entità non espone setup_name: specificarlo nella configurazione");
        const type = this.getControlType();
        const setupValue = type === 'boolean' && typeof value === 'boolean' ? this.booleanValue(value) : String(value);
        await this._hass.callService('mia_config', 'set_manual_override', {
            entity_id: this._config.entity,
            setup_name: setupName,
            setup_value: setupValue,
            ...(until ? { valid_to: toLocalIso(until) } : {})
        });
    }

    async setAuto() {
        const setupName = this.getSetupName();
        if (!setupName) throw new Error("L'entità non espone setup_name: specificarlo nella configurazione");
        await this._hass.callService('mia_config', 'clear_manual_override', {
            entity_id: this._config.entity,
            setup_name: setupName
        });
    }

    async run(action) {
        if (this._busy) return;
        this._busy = true;
        this._error = null;
        this.render();
        try {
            await action();
        } catch (error) {
            this._error = error.message || 'Operazione non riuscita';
        }
        this._busy = false;
        this.render();
    }

    openDialog(value) {
        const type = this.getControlType();
        const next = this.getNextChange();
        const dialog = document.createElement('mia-config-widget-dialog');
        dialog.open({
            title: this.getName(),
            type,
            value: value ?? (type === 'boolean' ? isTruthy(this.getCurrentValue()) : this.getCurrentValue()),
            values: this._values,
            min: this._config.min,
            max: this._config.max,
            step: this._config.step,
            unit: this._config.unit,
            durations: Array.isArray(this._config.durations) ? this._config.durations : DEFAULT_DURATIONS,
            manual: this.isManualActive(),
            currentUntil: this.getManualUntil(),
            nextChangeAt: next?.at || null,
            onApply: (v, until) => this.setManual(v, until),
            onAuto: () => this.setAuto()
        });
    }

    // Scelta di un valore dal widget: in manuale si applica subito (mantenendo la scadenza),
    // in automatico si apre il popup per scegliere la durata.
    pickValue(value) {
        if (this.isManualActive()) {
            this.run(() => this.setManual(value, this.getManualUntil()));
        } else {
            this.openDialog(value);
        }
    }

    // ----- Rendering -----

    statusText(compact = false) {
        if (this.isManualActive()) {
            const until = this.getManualUntil();
            if (!until) return 'Manuale · senza scadenza';
            if (compact) {
                const text = untilText(until);
                return text.charAt(0).toUpperCase() + text.slice(1);
            }
            return `Manuale ${untilText(until)} <span class="dim">· ancora ${formatRemaining(until)}</span>`;
        }
        const next = this.getNextChange();
        const type = this.getControlType();
        if (!next) return 'Auto';
        const when = compact ? formatTime(next.at) : whenText(next.at);
        return `Auto · ${when} → ${escapeHtml(this.displayValue(next.value, type))}`;
    }

    render() {
        if (!this._hass || !this._config) return;
        // Non ridisegnare mentre l'utente sta scrivendo in un campo: si aggiorna all'uscita
        if (this.shadowRoot.activeElement?.tagName === 'INPUT') {
            this._pendingRender = true;
            return;
        }
        this._pendingRender = false;
        const entity = this.getEntity();
        if (!entity) {
            this.shadowRoot.innerHTML = `<ha-card style="padding:16px;color:var(--error-color)">Entità non trovata: ${escapeHtml(this._config.entity)}</ha-card>`;
            return;
        }
        const type = this.getControlType();
        const manual = this.isManualActive();
        const body = this._layout === 'row' ? this.renderRow(type, manual)
            : this._layout === 'tile' ? this.renderTile(type, manual)
            : this.renderCard(type, manual);

        this.shadowRoot.innerHTML = `
            <style>
                ${BASE_STYLE}
                :host { height: 100%; min-width: 0; }
                ha-card {
                    --mia-accent: ${manual ? 'var(--mia-manual-color)' : 'var(--mia-auto-color)'};
                    height: 100%; overflow: hidden; transition: border-color .2s, box-shadow .2s;
                }
                ha-card.manual { border: 2px solid var(--mia-manual-color); }
                ha-card.auto.outlined { border: 1px dashed var(--mia-outline-auto); }
                .dim { opacity: .75; }
                .error { color: var(--error-color, #db4437); font-size: 12px; padding: 0 16px 10px; }
                .icon-badge {
                    position: relative; flex: none; width: 40px; height: 40px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    background: color-mix(in srgb, var(--mia-accent) 15%, transparent); color: var(--mia-accent);
                }
                .auto .icon-badge { background: color-mix(in srgb, var(--mia-muted) 12%, transparent); color: var(--state-icon-color, var(--mia-muted)); }
                .icon-badge .mode {
                    position: absolute; right: -3px; bottom: -3px; width: 18px; height: 18px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    background: var(--mia-manual-color); color: #fff; border: 2px solid var(--card-background-color);
                }
                .icon-badge .mode ha-icon { --mdc-icon-size: 11px; }
                .name { font-weight: 500; font-size: 14px; color: var(--primary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .status { font-size: 12px; color: var(--mia-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .manual .status { color: var(--mia-manual-color); }
                .info { min-width: 0; flex: 1; cursor: pointer; }
                .auto-btn {
                    flex: none; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    color: var(--mia-auto-color); background: color-mix(in srgb, var(--mia-auto-color) 12%, transparent);
                }
                .auto-btn ha-icon { --mdc-icon-size: 18px; }

                /* --- row: grande come una riga entità --- */
                .row { display: flex; align-items: center; gap: 12px; padding: 8px 12px 8px 8px; min-height: 56px; }
                .switch {
                    flex: none; position: relative; width: 46px; height: 26px; border-radius: 13px;
                    border: 2px dashed var(--mia-outline-auto); background: transparent; transition: all .2s;
                }
                .switch::after {
                    content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%;
                    background: var(--mia-outline-auto); transition: all .2s;
                }
                .switch.on::after { left: 23px; }
                .manual .switch { border-style: solid; border-color: var(--mia-manual-color); }
                .manual .switch.on { background: var(--mia-manual-color); }
                .manual .switch.on::after { background: #fff; }
                .manual .switch:not(.on)::after { background: var(--mia-manual-color); }
                .value-pill {
                    flex: none; max-width: 45%; padding: 5px 12px; border-radius: 999px; font-size: 13px; font-weight: 500;
                    border: 2px dashed var(--mia-outline-auto); color: var(--primary-text-color);
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
                .manual .value-pill { border-style: solid; border-color: var(--mia-manual-color); background: color-mix(in srgb, var(--mia-manual-color) 15%, transparent); }

                /* --- tile --- */
                .tile { display: flex; flex-direction: column; gap: 8px; padding: 12px; height: 100%; min-height: 104px; min-width: 0; cursor: pointer; }
                .tile .top { display: flex; align-items: center; gap: 12px; }
                .tile .text { flex: 1; min-width: 0; }
                .tile .value { font-size: 20px; font-weight: 500; line-height: 1.3; color: var(--primary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .tile .bottom { display: flex; align-items: center; gap: 8px; margin-top: auto; min-height: 28px; }
                .tile .auto-btn { width: 28px; height: 28px; }
                .tile .status { flex: 1; }

                /* --- card completa --- */
                .card { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
                .card .head { display: flex; align-items: center; gap: 12px; }
                .card .big { font-size: 32px; font-weight: 400; line-height: 1.1; color: var(--primary-text-color); }
                .card .big small { display: block; font-size: 13px; line-height: 1.4; color: var(--mia-muted); margin-top: 6px; }
                .segmented { display: grid; grid-template-columns: 1fr 1fr; padding: 4px; border-radius: 12px; background: color-mix(in srgb, var(--mia-muted) 12%, transparent); }
                .segmented button { padding: 9px; border-radius: 9px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--mia-muted); }
                .segmented button.active { background: var(--card-background-color); color: var(--primary-text-color); box-shadow: 0 1px 3px rgba(0, 0, 0, .2); }
                .segmented button.active.m { color: var(--mia-manual-color); }
                .segmented button.active.a { color: var(--mia-auto-color); }
                .statusbar { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px; font-size: 13px; background: color-mix(in srgb, var(--mia-accent) 10%, transparent); }
                .statusbar .status { flex: 1; white-space: normal; }
                .statusbar button { color: var(--mia-accent); font-weight: 500; font-size: 13px; }
                .busy { opacity: .6; pointer-events: none; }
            </style>
            ${body}
        `;
        this.bindEvents();
    }

    iconBadge(type, manual) {
        return `
            <div class="icon-badge">
                <ha-icon icon="${escapeHtml(this.getIcon(type))}"></ha-icon>
                ${manual ? '<span class="mode"><ha-icon icon="mdi:hand-back-right"></ha-icon></span>' : ''}
            </div>`;
    }

    errorLine() {
        return this._error ? `<div class="error">${escapeHtml(this._error)}</div>` : '';
    }

    renderRow(type, manual) {
        const current = this.getCurrentValue();
        const control = type === 'boolean'
            ? `<button class="switch ${isTruthy(current) ? 'on' : ''}" data-action="toggle" aria-label="Cambia valore"></button>`
            : `<button class="value-pill" data-action="dialog">${escapeHtml(this.displayValue(current, type))}</button>`;
        return `
            <ha-card class="${manual ? 'manual' : 'auto outlined'} ${this._busy ? 'busy' : ''}">
                <div class="row">
                    ${this.iconBadge(type, manual)}
                    <div class="info" data-action="dialog">
                        <div class="name">${escapeHtml(this.getName())}</div>
                        <div class="status">${this.statusText(true)}</div>
                    </div>
                    ${manual ? '<button class="auto-btn" data-action="auto" title="Torna in Auto"><ha-icon icon="mdi:autorenew"></ha-icon></button>' : ''}
                    ${control}
                </div>
                ${this.errorLine()}
            </ha-card>`;
    }

    renderTile(type, manual) {
        const current = this.getCurrentValue();
        return `
            <ha-card class="${manual ? 'manual' : 'auto outlined'} ${this._busy ? 'busy' : ''}">
                <div class="tile" data-action="${type === 'boolean' ? 'toggle' : 'dialog'}">
                    <div class="top">
                        ${this.iconBadge(type, manual)}
                        <div class="text">
                            <div class="name">${escapeHtml(this.getName())}</div>
                            <div class="value">${escapeHtml(this.displayValue(current, type))}</div>
                        </div>
                    </div>
                    <div class="bottom">
                        <div class="status">${this.statusText(true)}</div>
                        ${manual ? '<button class="auto-btn" data-action="auto" title="Torna in Auto"><ha-icon icon="mdi:autorenew"></ha-icon></button>' : ''}
                    </div>
                </div>
                ${this.errorLine()}
            </ha-card>`;
    }

    renderCard(type, manual) {
        const current = this.getCurrentValue();
        const match = this._values.find(item => String(item.value) === String(current));
        const until = this.getManualUntil();
        return `
            <ha-card class="${manual ? 'manual' : 'auto'} ${this._busy ? 'busy' : ''}">
                <div class="card">
                    <div class="head">
                        ${this.iconBadge(type, manual)}
                        <div class="info" data-action="dialog">
                            <div class="name">${escapeHtml(this.getName())}</div>
                            <div class="status">${manual ? 'Forzato manualmente' : 'Gestito automaticamente'}</div>
                        </div>
                    </div>
                    <div class="big">
                        ${escapeHtml(this.displayValue(current, type))}
                        ${type === 'select' && match?.description ? `<small>${escapeHtml(match.value)}</small>` : ''}
                    </div>
                    <div class="segmented">
                        <button class="${manual ? '' : 'active a'}" data-action="auto"><ha-icon icon="mdi:autorenew"></ha-icon>Auto</button>
                        <button class="${manual ? 'active m' : ''}" data-action="dialog"><ha-icon icon="mdi:hand-back-right"></ha-icon>Manuale</button>
                    </div>
                    <div class="controls">${renderValueControl(type, type === 'boolean' ? isTruthy(current) : current, { values: this._values, min: this._config.min, max: this._config.max, unit: this._config.unit })}</div>
                    <div class="statusbar">
                        <ha-icon icon="${manual ? 'mdi:timer-outline' : 'mdi:calendar-clock'}"></ha-icon>
                        <span class="status">${this.statusText()}</span>
                        ${manual ? `<button data-action="dialog">${until ? 'Modifica' : 'Scadenza'}</button>` : ''}
                    </div>
                </div>
                ${this.errorLine()}
            </ha-card>`;
    }

    bindEvents() {
        const root = this.shadowRoot;
        root.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const action = el.dataset.action;
            if (action === 'dialog') this.openDialog();
            else if (action === 'auto') { if (this.isManualActive()) this.run(() => this.setAuto()); }
            else if (action === 'toggle') this.pickValue(!isTruthy(this.getCurrentValue()));
        }));
        // Controlli inline della card completa
        root.querySelectorAll('.controls [data-pick]').forEach(el => el.addEventListener('click', () => {
            const on = el.dataset.pick === 'on';
            if (on === isTruthy(this.getCurrentValue()) && !this.isManualActive()) return this.openDialog(on);
            if (on !== isTruthy(this.getCurrentValue())) this.pickValue(on);
        }));
        root.querySelectorAll('.controls [data-pick-value]').forEach(el => el.addEventListener('click', () => {
            this.pickValue(el.dataset.pickValue);
        }));
        root.querySelectorAll('.controls [data-step]').forEach(el => el.addEventListener('click', () => {
            const step = Number(this._config.step) || 1;
            let next = (Number(this.getCurrentValue()) || 0) + Number(el.dataset.step) * step;
            if (this._config.min !== undefined) next = Math.max(Number(this._config.min), next);
            if (this._config.max !== undefined) next = Math.min(Number(this._config.max), next);
            this.pickValue(Math.round(next * 1000) / 1000);
        }));
        root.querySelector('.controls [data-number]')?.addEventListener('change', (ev) => this.pickValue(ev.target.value));
        root.querySelector('.controls [data-text]')?.addEventListener('change', (ev) => this.pickValue(ev.target.value));
        root.querySelectorAll('input').forEach(el => el.addEventListener('blur', () => {
            if (this._pendingRender) setTimeout(() => this.render());
        }));
    }
}

// ---------- Editor visuale ----------

const EDITOR_LABELS = {
    entity: 'Entità Mia Config',
    layout: 'Formato',
    control: 'Tipo di controllo',
    name: 'Nome',
    icon: 'Icona',
    setup_name: 'Nome configurazione (se l\'entità non espone setup_name)',
    min: 'Minimo',
    max: 'Massimo',
    step: 'Passo',
    unit: 'Unità'
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
                name: 'layout',
                selector: {
                    select: {
                        mode: 'box',
                        options: [
                            { value: 'row', label: 'Riga (come un\'entità)' },
                            { value: 'tile', label: 'Riquadro' },
                            { value: 'card', label: 'Card completa' }
                        ]
                    }
                }
            },
            {
                type: 'grid',
                name: '',
                schema: [
                    { name: 'name', selector: { text: {} } },
                    { name: 'icon', selector: { icon: {} } }
                ]
            },
            {
                name: 'control',
                selector: {
                    select: {
                        mode: 'dropdown',
                        options: [
                            { value: 'auto', label: 'Automatico (dedotto dal valore)' },
                            { value: 'boolean', label: 'Acceso/Spento' },
                            { value: 'select', label: 'Valori validi' },
                            { value: 'number', label: 'Numero' },
                            { value: 'text', label: 'Testo libero' }
                        ]
                    }
                }
            }
        ];
        if (['auto', 'number'].includes(this._config.control || 'auto')) {
            schema.push({
                type: 'grid',
                name: '',
                schema: [
                    { name: 'min', selector: { number: { mode: 'box', step: 'any' } } },
                    { name: 'max', selector: { number: { mode: 'box', step: 'any' } } },
                    { name: 'step', selector: { number: { mode: 'box', step: 'any', min: 0 } } },
                    { name: 'unit', selector: { text: {} } }
                ]
            });
        }
        schema.push({ name: 'setup_name', selector: { text: {} } });
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
        this._form.data = { control: 'auto', layout: 'row', ...this._config };
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
    customElements.define('mia-config-widget-dialog', MiaConfigWidgetDialog);
    customElements.define('mia-config-binary-card', MiaConfigBinaryCard);
    customElements.define('mia-config-select-card', MiaConfigSelectCard);
    customElements.define('mia-config-number-card', MiaConfigNumberCard);

    window.customCards = window.customCards || [];
    window.customCards.push({
        type: 'mia-config-widget',
        name: 'Mia Config Widget',
        description: 'Forzatura manuale Auto/Manuale di una configurazione (riga, riquadro o card completa)',
        preview: true
    });
}
})();
