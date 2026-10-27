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

// Prossima occorrenza di un orario HH:MM dopo un istante (predefinito: adesso)
const nextOccurrence = (hhmm, after = new Date()) => {
    const [h, m] = hhmm.split(':').map(Number);
    const date = new Date(after);
    date.setHours(h, m, 0, 0);
    if (date.getTime() <= after.getTime()) date.setDate(date.getDate() + 1);
    return date;
};

// Istanze Mia Config: un sensore principale (con total_configs) per ogni database
const getInstances = (hass) => Object.values(hass?.states || {})
    .filter(state => state.entity_id.startsWith('sensor.')
        && state.attributes.integration === 'mia_config'
        && state.attributes.total_configs !== undefined)
    .map(state => ({ entity_id: state.entity_id, db_name: state.attributes.db_name, entry_id: state.attributes.entry_id }))
    .sort((a, b) => String(a.db_name).localeCompare(String(b.db_name)));

const isTruthy = (value) => ['true', '1', 'on', 'yes', 'enabled'].includes(String(value).toLowerCase());

// Valori validi esattamente 0 e 1: si trattano come un interruttore
const isBinaryValues = (values) =>
    values.length === 2 && values.map(item => String(item.value).trim()).sort().join(',') === '0,1';

// Etichette acceso/spento: le descrizioni dei valori validi, se presenti
const booleanLabels = (values = []) => {
    const find = (candidates) => values.find(item => candidates.includes(String(item.value).toLowerCase()))?.description;
    return { on: find(['1', 'true', 'on']) || 'Acceso', off: find(['0', 'false', 'off']) || 'Spento' };
};

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
        const labels = booleanLabels(values);
        return `
            <div class="bool-buttons">
                <button data-pick="off" class="${on ? '' : 'selected'}"><ha-icon icon="mdi:power-off"></ha-icon>${escapeHtml(labels.off)}</button>
                <button data-pick="on" class="${on ? 'selected' : ''}"><ha-icon icon="mdi:power"></ha-icon>${escapeHtml(labels.on)}</button>
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

// Popup condiviso da widget, scorciatoie e card principale. Modalità:
// - manual:   forzatura manuale (valore + durata, anche senza scadenza)
// - override: nuovo override a tempo (valore + inizio + durata + priorità)
// - value:    solo valore (modifica della configurazione standard)
const DIALOG_MODES = {
    manual: { icon: 'mdi:hand-back-right', accent: 'var(--mia-manual-color)', apply: 'Forza' },
    override: { icon: 'mdi:clock-plus-outline', accent: 'var(--mia-auto-color)', apply: 'Aggiungi override' },
    value: { icon: 'mdi:pencil', accent: 'var(--mia-auto-color)', apply: 'Salva' }
};

class MiaConfigWidgetDialog extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._onKey = (ev) => { if (ev.key === 'Escape') this.close(); };
    }

    // opts: { mode, title, subtitle, note, type, value, values, min, max, step, unit, durations, manual, currentUntil,
    //         nextChangeAt, priority, presetFrom, presetUntil, onApply(value, until, { from, priority }), onAuto }
    // presetFrom/presetUntil (Date, presetUntil anche null = senza scadenza) precompilano inizio e fine.
    open(opts) {
        this._o = { mode: 'manual', durations: DEFAULT_DURATIONS, ...opts };
        const o = this._o;
        this._value = o.value;
        if (o.mode === 'override') this._duration = String(o.durations[1] ?? o.durations[0] ?? 'time');
        else if (o.manual) this._duration = o.currentUntil ? 'keep' : 'none';
        else this._duration = o.nextChangeAt ? 'next' : String(o.durations[1] ?? o.durations[0] ?? 'none');
        this._start = 'now';
        this._startTime = '';
        this._fixedStart = null;
        this._time = '';
        this._datetime = '';
        if (o.presetUntil === null) {
            this._duration = 'none';
        } else if (o.presetUntil instanceof Date) {
            this._duration = 'datetime';
            this._datetime = toLocalIso(o.presetUntil).slice(0, 16);
        }
        if (o.presetFrom instanceof Date && o.presetFrom.getTime() > Date.now() + 60000) {
            this._start = 'fixed';
            this._fixedStart = o.presetFrom;
        }
        this._priority = o.priority ?? 1;
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

    computeStart() {
        if (this._start === 'now') return new Date();
        if (this._start === 'fixed') return this._fixedStart;
        return this._startTime ? nextOccurrence(this._startTime) : undefined;
    }

    computeUntil() {
        const start = this.computeStart() || new Date();
        const d = this._duration;
        if (d === 'none') return null;
        if (d === 'keep') return this._o.currentUntil;
        if (d === 'next') return this._o.nextChangeAt;
        if (d === 'time') return this._time ? nextOccurrence(this._time, start) : undefined;
        if (d === 'datetime') return parseDate(this._datetime) || undefined;
        return new Date(start.getTime() + Number(d) * 60000);
    }

    preview() {
        const until = this.computeUntil();
        if (this._o.mode === 'override') {
            const start = this.computeStart();
            if (start === undefined) return "Scegli l'orario di inizio";
            if (!until) return 'Scegli quando terminare';
            if (until <= start) return "La fine deve essere dopo l'inizio";
            const length = formatDuration(Math.round((until - start) / 60000));
            if (this._start === 'now') return `Da adesso <b>${untilText(until)}</b> (${length})`;
            // "Dalle 21:00 alle 23:00", "Domani dalle 21:00 alle 23:00", "Il 28/10 dalle 21:00 a domani alle 01:00"
            const day = whenText(start).replace(/alle \d\d:\d\d$/, '').trim();
            const end = start.toDateString() === until.toDateString() ? `alle ${formatTime(until).split(' ').pop()}` : untilText(until).replace(/^fino /, '');
            const from = `${day ? `${day.charAt(0).toUpperCase()}${day.slice(1)} dalle` : 'Dalle'} ${formatTime(start).split(' ').pop()}`;
            return `${from} <b>${end}</b> (${length})`;
        }
        if (until === undefined) return 'Scegli quando terminare';
        if (until === null) return 'Resta in manuale finché non torni in Auto';
        if (until.getTime() <= Date.now()) return 'La fine deve essere nel futuro';
        return `Torna in Auto <b>${whenText(until)}</b> (tra ${formatRemaining(until)})`;
    }

    render() {
        const o = this._o;
        const mode = DIALOG_MODES[o.mode] || DIALOG_MODES.manual;
        const isOverride = o.mode === 'override';
        const chip = (attr, current, key, label, icon) => `
            <button class="chip ${current === key ? 'selected' : ''}" ${attr}="${key}">
                ${icon ? `<ha-icon icon="${icon}"></ha-icon>` : ''}${label}
            </button>`;
        const durationChip = (key, label, icon) => chip('data-duration', this._duration, key, label, icon);
        const chips = [
            o.mode === 'manual' && o.manual && o.currentUntil ? durationChip('keep', `Mantieni (${formatTime(o.currentUntil)})`, 'mdi:timer-check-outline') : '',
            ...o.durations.map(min => durationChip(String(min), formatDuration(min))),
            o.mode === 'manual' && !o.manual && o.nextChangeAt ? durationChip('next', `Prossimo cambio (${formatTime(o.nextChangeAt)})`, 'mdi:calendar-arrow-right') : '',
            durationChip('time', 'Fino alle…', 'mdi:clock-outline'),
            durationChip('datetime', 'Data e ora…', 'mdi:calendar-clock'),
            isOverride ? '' : durationChip('none', 'Senza scadenza', 'mdi:infinity')
        ].join('');

        const startSection = isOverride ? `
            <div class="section">
                <div class="label">Inizio</div>
                <div class="chips">
                    ${chip('data-start', this._start, 'now', 'Adesso', 'mdi:play')}
                    ${this._fixedStart ? chip('data-start', this._start, 'fixed', formatTime(this._fixedStart), 'mdi:calendar-start') : ''}
                    ${chip('data-start', this._start, 'time', 'Alle…', 'mdi:clock-start')}
                </div>
                ${this._start === 'time' ? `<div class="extra"><input data-start-time type="time" value="${escapeHtml(this._startTime)}"></div>` : ''}
            </div>` : '';
        const durationSection = o.mode === 'value' ? '' : `
            <div class="section">
                <div class="label">${isOverride ? 'Durata' : 'Per quanto tempo'}</div>
                <div class="chips">${chips}</div>
                ${this._duration === 'time' ? `<div class="extra"><input data-time type="time" value="${escapeHtml(this._time)}"></div>` : ''}
                ${this._duration === 'datetime' ? `<div class="extra"><input data-datetime type="datetime-local" value="${escapeHtml(this._datetime)}"></div>` : ''}
                <div class="preview"><ha-icon icon="mdi:timer-outline"></ha-icon><span>${this.preview()}</span></div>
            </div>`;
        const prioritySection = isOverride ? `
            <div class="section">
                <div class="label">Priorità <span class="hint">(1 = più alta)</span></div>
                <div class="extra"><input data-priority type="number" min="1" max="999" step="1" value="${escapeHtml(this._priority)}"></div>
            </div>` : '';

        this.shadowRoot.innerHTML = `
            <style>
                ${BASE_STYLE}
                :host { --mia-accent: ${mode.accent}; position: fixed; inset: 0; z-index: 9999; font-family: var(--paper-font-body1_-_font-family, var(--ha-font-family-body, Roboto, sans-serif)); }
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
                h2 ha-icon { color: var(--mia-accent); --mdc-icon-size: 24px; }
                .subtitle { margin: 4px 0 0 34px; font-size: 13px; color: var(--mia-muted); }
                .note {
                    display: flex; gap: 10px; align-items: flex-start; margin-top: 16px; padding: 10px 12px; border-radius: 12px;
                    font-size: 14px; font-style: italic; background: color-mix(in srgb, var(--mia-accent) 10%, transparent);
                }
                .note ha-icon { --mdc-icon-size: 18px; color: var(--mia-accent); flex: none; margin-top: 1px; }
                .section { margin-top: 20px; }
                .label { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--mia-muted); margin-bottom: 10px; }
                .hint { text-transform: none; letter-spacing: 0; }
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
                .btn.primary { background: var(--mia-accent); color: var(--text-primary-color, #fff); }
            </style>
            <div class="backdrop" data-close></div>
            <div class="sheet" role="dialog" aria-modal="true">
                <h2><ha-icon icon="${mode.icon}"></ha-icon>${escapeHtml(o.title)}</h2>
                ${o.subtitle ? `<div class="subtitle">${escapeHtml(o.subtitle)}</div>` : ''}
                ${o.note ? `<div class="note"><ha-icon icon="mdi:creation"></ha-icon><span>${escapeHtml(o.note)}</span></div>` : ''}
                <div class="section">
                    <div class="label">Valore</div>
                    ${renderValueControl(o.type, this._value, o)}
                </div>
                ${startSection}
                ${durationSection}
                ${prioritySection}
                ${this._error ? `<div class="error">${escapeHtml(this._error)}</div>` : ''}
                <div class="actions">
                    ${o.mode === 'manual' && o.manual ? `<button class="btn auto" data-auto><ha-icon icon="mdi:autorenew"></ha-icon>Torna in Auto</button>` : ''}
                    <span class="spacer"></span>
                    <button class="btn text" data-close>Annulla</button>
                    <button class="btn primary" data-apply ${this._busy ? 'disabled' : ''}>${mode.apply}</button>
                </div>
            </div>
        `;
        this.bindEvents();
    }

    bindEvents() {
        const root = this.shadowRoot;
        const refreshPreview = () => {
            const el = root.querySelector('.preview span');
            if (el) el.innerHTML = this.preview();
        };
        root.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => this.close()));
        root.querySelectorAll('[data-duration]').forEach(el => el.addEventListener('click', () => {
            this._duration = el.dataset.duration;
            this.render();
            root.querySelector('[data-time], [data-datetime]')?.focus();
        }));
        root.querySelectorAll('[data-start]').forEach(el => el.addEventListener('click', () => {
            this._start = el.dataset.start;
            this.render();
            root.querySelector('[data-start-time]')?.focus();
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
        root.querySelector('[data-priority]')?.addEventListener('input', (ev) => { this._priority = ev.target.value; });
        root.querySelector('[data-start-time]')?.addEventListener('input', (ev) => { this._startTime = ev.target.value; refreshPreview(); });
        root.querySelector('[data-time]')?.addEventListener('input', (ev) => { this._time = ev.target.value; refreshPreview(); });
        root.querySelector('[data-datetime]')?.addEventListener('input', (ev) => { this._datetime = ev.target.value; refreshPreview(); });
        root.querySelector('[data-auto]')?.addEventListener('click', async () => {
            await this.run(() => this._o.onAuto());
        });
        root.querySelector('[data-apply]')?.addEventListener('click', () => this.apply());
    }

    async apply() {
        const o = this._o;
        if (this._value === '' || this._value === undefined || this._value === null) return this.fail('Scegli un valore');
        if (o.mode === 'value') return this.run(() => o.onApply(this._value));

        const until = this.computeUntil();
        if (until === undefined) return this.fail('Scegli quando terminare');
        if (o.mode === 'override') {
            const from = this.computeStart();
            if (from === undefined) return this.fail("Scegli l'orario di inizio");
            if (until <= from) return this.fail("La fine deve essere dopo l'inizio");
            const priority = Number(this._priority);
            if (!Number.isInteger(priority) || priority < 1 || priority > 999) return this.fail('La priorità deve essere un numero intero tra 1 e 999');
            return this.run(() => o.onApply(this._value, until, { from, priority }));
        }
        if (until && until.getTime() <= Date.now()) return this.fail('La fine deve essere nel futuro');
        return this.run(() => o.onApply(this._value, until));
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
        if (this._values.length > 0) return isBinaryValues(this._values) ? 'boolean' : 'select';
        const current = String(this.getCurrentValue()).toLowerCase();
        if (current in BOOLEAN_PAIRS) return 'boolean';
        if (current !== '' && !isNaN(Number(current))) return 'number';
        return 'text';
    }

    getIcon(type) {
        return this._config.icon || this.getEntity()?.attributes?.icon || DEFAULT_ICONS[type];
    }

    getName() {
        if (this._config.name) return this._config.name;
        const entity = this.getEntity();
        const name = entity?.attributes?.friendly_name || this._config.entity;
        // Con più istanze il nome del database distingue configurazioni omonime
        const db = entity?.attributes?.db_name;
        return db && getInstances(this._hass).length > 1 ? `${name} · ${db}` : name;
    }

    displayValue(value, type) {
        if (type === 'boolean') {
            const labels = booleanLabels(this._values);
            return isTruthy(value) ? labels.on : labels.off;
        }
        const match = this._values.find(item => String(item.value) === String(value));
        const text = match?.description || value;
        return this._config.unit && type === 'number' ? `${text} ${this._config.unit}` : text;
    }

    // Mantiene il "vocabolario" del valore corrente (on/off oppure true/false)
    booleanValue(on) {
        const current = String(this.getCurrentValue()).toLowerCase();
        const family = current === 'on' || current === 'off' ? ['on', 'off']
            : current === '1' || current === '0' || isBinaryValues(this._values) ? ['1', '0']
            : ['true', 'false'];
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

    requireSetupName() {
        const setupName = this.getSetupName();
        if (!setupName) throw new Error("L'entità non espone setup_name: specificarlo nella configurazione");
        return setupName;
    }

    // Valore da salvare: i booleani del popup diventano on/off, 1/0 o true/false come il valore corrente
    toSetupValue(value) {
        return this.getControlType() === 'boolean' && typeof value === 'boolean' ? this.booleanValue(value) : String(value);
    }

    async setManual(value, until) {
        await this._hass.callService('mia_config', 'set_manual_override', {
            entity_id: this._config.entity,
            setup_name: this.requireSetupName(),
            setup_value: this.toSetupValue(value),
            ...(until ? { valid_to: toLocalIso(until) } : {})
        });
    }

    // Override a tempo (configurazione a tempo con priorità utente)
    async addOverride(value, from, until, priority) {
        await this._hass.callService('mia_config', 'set_time_config', {
            entity_id: this._config.entity,
            setup_name: this.requireSetupName(),
            setup_value: this.toSetupValue(value),
            valid_from: toLocalIso(from),
            valid_to: toLocalIso(until),
            priority
        });
    }

    async setAuto() {
        await this._hass.callService('mia_config', 'clear_manual_override', {
            entity_id: this._config.entity,
            setup_name: this.requireSetupName()
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

    // Apre un popup per un'entità senza bisogno di un widget in dashboard (usato da card principale e scorciatoie).
    // mode: manual | override | value. options: { title, subtitle, note, value, from, until, priority,
    //                                             onSave(value) per value, onDone() }
    static async openFor(hass, entityId, mode = 'manual', options = {}) {
        const widget = document.createElement('mia-config-widget');
        widget.setConfig({ entity: entityId, layout: 'row', ...(options.config || {}) });
        widget._hass = hass;
        if (['auto', 'select'].includes(widget._control)) await widget.loadValidValues();
        widget.openDialog(options.value, mode, options);
    }

    openDialog(value, mode = 'manual', options = {}) {
        const type = this.getControlType();
        const next = this.getNextChange();
        const done = async (action) => {
            await action();
            options.onDone?.();
        };
        const dialog = document.createElement('mia-config-widget-dialog');
        dialog.open({
            mode,
            title: options.title || this.getName(),
            subtitle: options.subtitle,
            note: options.note,
            presetFrom: options.from,
            presetUntil: options.until,
            priority: options.priority ?? this._config.priority ?? 1,
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
            onApply: (v, until, extra) => done(() => {
                if (mode === 'value') return options.onSave(this.toSetupValue(v));
                if (mode === 'override') return this.addOverride(v, extra.from, until, extra.priority);
                return this.setManual(v, until);
            }),
            onAuto: () => done(() => this.setAuto())
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
            this._form.computeLabel = (schema) => this.labels[schema.name] ?? schema.name;
            this._form.addEventListener('value-changed', (ev) => {
                ev.stopPropagation();
                const config = { ...ev.detail.value };
                // Rimuove i campi opzionali svuotati (e il default auto) per non sporcare lo YAML
                Object.keys(config).forEach(key => {
                    if (config[key] === '' || config[key] === undefined || config[key] === null) delete config[key];
                });
                this.stripDefaults(config);
                this._config = config;
                this.render();
                this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
            });
            this.appendChild(this._form);
        }
        this._form.hass = this._hass;
        this._form.schema = this.getSchema();
        this._form.data = { ...this.defaults, ...this._config };
    }

    get labels() {
        return EDITOR_LABELS;
    }

    get defaults() {
        return { control: 'auto', layout: 'row' };
    }

    // Toglie dallo YAML i valori uguali al predefinito
    stripDefaults(config) {
        if (config.control === 'auto') delete config.control;
    }
}

// ---------- Scorciatoie override ----------

// Calcola inizio e fine di una scorciatoia: from/until come HH:MM, duration in minuti (predefinita 60)
const shortcutWindow = (shortcut) => {
    const from = shortcut.from ? nextOccurrence(String(shortcut.from)) : new Date();
    const until = shortcut.until
        ? nextOccurrence(String(shortcut.until), from)
        : new Date(from.getTime() + (Number(shortcut.duration) || 60) * 60000);
    return { from, until };
};

const describeShortcut = (shortcut) => {
    const { from, until } = shortcutWindow(shortcut);
    const length = formatDuration(Math.round((until - from) / 60000));
    if (shortcut.from) return `dalle ${String(shortcut.from)} · ${length}`;
    if (shortcut.until) return `fino alle ${String(shortcut.until)}`;
    return length;
};

class MiaConfigShortcuts extends HTMLElement {
    static getConfigElement() {
        return document.createElement('mia-config-shortcuts-editor');
    }

    static getStubConfig(hass) {
        return { entity: MiaConfigWidget.getStubConfig(hass).entity, shortcuts: [] };
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    setConfig(config) {
        if (!config || !config.entity) {
            throw new Error('Devi specificare entity nella configurazione della card');
        }
        if (config.shortcuts !== undefined && !Array.isArray(config.shortcuts)) {
            throw new Error('shortcuts deve essere una lista');
        }
        (config.shortcuts || []).forEach((shortcut, index) => {
            if (!shortcut || shortcut.value === undefined || shortcut.value === null || shortcut.value === '') {
                throw new Error(`La scorciatoia ${index + 1} non ha un valore (value)`);
            }
        });
        this._config = config;
        // Il widget interno fornisce valori validi, tipo di controllo, etichette e chiamate ai servizi
        this._helper = document.createElement('mia-config-widget');
        this._helper.setConfig({ entity: config.entity, control: config.control, setup_name: config.setup_name, unit: config.unit });
        this._overrides = [];
        this._flash = null;
        this._error = null;
        this._entityState = undefined;
        this.render();
    }

    set hass(hass) {
        this._hass = hass;
        this._helper._hass = hass;
        if (!this._helper._valuesLoaded) {
            this._helper.loadValidValues().then(() => this.render());
        }
        const entityState = hass.states[this._config.entity];
        if (entityState === this._entityState) return;
        this._entityState = entityState;
        this.loadOverrides();
        this.render();
    }

    connectedCallback() {
        this._timer = setInterval(() => this.render(), 30000);
    }

    disconnectedCallback() {
        clearInterval(this._timer);
    }

    getCardSize() {
        return 3 + Math.ceil((this._config?.shortcuts?.length || 0) / 2);
    }

    getGridOptions() {
        return { columns: 6, min_columns: 4 };
    }

    // Override a tempo attivi o futuri per questa configurazione (esclusa la forzatura manuale)
    async loadOverrides() {
        if (this._config.show_active === false) return;
        const setupName = this._helper.getSetupName();
        if (!setupName || !this._hass) return;
        try {
            const result = await this._hass.callWS({
                type: 'call_service',
                domain: 'mia_config',
                service: 'get_configurations',
                service_data: { entity_id: this._config.entity },
                return_response: true
            });
            const configs = result.response?.[setupName] || [];
            const now = Date.now();
            this._overrides = configs
                .filter(cfg => cfg.type === 'time' && cfg.enabled && Number(cfg.priority) !== MANUAL_OVERRIDE_PRIORITY)
                .map(cfg => ({ ...cfg, from: parseDate(cfg.valid_from_date), until: parseDate(cfg.valid_to_date) }))
                .filter(cfg => cfg.from && cfg.until && cfg.until.getTime() > now)
                .sort((a, b) => a.from - b.from);
            this.render();
        } catch (error) {
            console.warn('Mia Config: impossibile caricare gli override', error);
        }
    }

    async run(action, flashKey) {
        this._error = null;
        try {
            await action();
            this._flash = flashKey;
            setTimeout(() => { this._flash = null; this.render(); }, 1500);
            // Lo stato del sensore si aggiorna dopo il refresh del coordinator: ricarica anche la lista
            setTimeout(() => this.loadOverrides(), 800);
        } catch (error) {
            this._error = error.message || 'Operazione non riuscita';
        }
        this.render();
    }

    applyShortcut(index) {
        const shortcut = this._config.shortcuts[index];
        const { from, until } = shortcutWindow(shortcut);
        const priority = Number(shortcut.priority ?? this._config.priority ?? 1);
        this.run(() => this._helper.addOverride(shortcut.value, from, until, priority), `s${index}`);
    }

    openCustom() {
        MiaConfigWidget.openFor(this._hass, this._config.entity, 'override', {
            config: { control: this._config.control, setup_name: this._config.setup_name, unit: this._config.unit,
                      min: this._config.min, max: this._config.max, step: this._config.step, durations: this._config.durations },
            title: this.getName(),
            subtitle: 'Nuovo override a tempo',
            priority: this._config.priority ?? 1,
            onDone: () => setTimeout(() => this.loadOverrides(), 800)
        });
    }

    deleteOverride(id) {
        this.run(() => this._hass.callService('mia_config', 'delete_single_config', {
            entity_id: this._config.entity,
            config_type: 'time',
            config_id: Number(id)
        }), null);
    }

    getName() {
        return this._config.name || this._helper.getName();
    }

    overrideWhen(cfg) {
        const now = Date.now();
        if (cfg.from.getTime() <= now) return `attivo · ${untilText(cfg.until)}`;
        return `${whenText(cfg.from).replace(/^alle/, 'dalle')} → ${formatTime(cfg.until)}`;
    }

    render() {
        if (!this._hass || !this._config) return;
        const helper = this._helper;
        const entity = helper.getEntity();
        if (!entity) {
            this.shadowRoot.innerHTML = `<ha-card style="padding:16px;color:var(--error-color)">Entità non trovata: ${escapeHtml(this._config.entity)}</ha-card>`;
            return;
        }
        const type = helper.getControlType();
        const manual = helper.isManualActive();
        const current = helper.getCurrentValue();
        const shortcuts = this._config.shortcuts || [];
        const now = Date.now();

        const buttons = shortcuts.map((shortcut, index) => {
            const done = this._flash === `s${index}`;
            return `
                <button class="shortcut ${done ? 'done' : ''}" data-shortcut="${index}">
                    <ha-icon icon="${escapeHtml(done ? 'mdi:check' : (shortcut.icon || 'mdi:clock-plus-outline'))}"></ha-icon>
                    <span class="s-text">
                        <span class="s-name">${escapeHtml(shortcut.name || helper.displayValue(String(shortcut.value), type))}</span>
                        <span class="s-sub">${escapeHtml(describeShortcut(shortcut))}</span>
                    </span>
                </button>`;
        }).join('');

        const active = this._config.show_active === false ? '' : this._overrides.slice(0, 5).map(cfg => `
            <div class="ov ${cfg.from.getTime() <= now ? 'running' : ''}">
                <span class="dot"></span>
                <span class="ov-text">
                    <b>${escapeHtml(helper.displayValue(cfg.value, type))}</b>
                    <span class="ov-when">${escapeHtml(this.overrideWhen(cfg))}</span>
                </span>
                <span class="prio" title="Priorità">P${escapeHtml(cfg.priority)}</span>
                <button class="del" data-delete="${escapeHtml(cfg.id)}" title="Elimina override"><ha-icon icon="mdi:close"></ha-icon></button>
            </div>`).join('');

        this.shadowRoot.innerHTML = `
            <style>
                ${BASE_STYLE}
                :host { height: 100%; min-width: 0; }
                ha-card { --mia-accent: var(--mia-auto-color); height: 100%; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
                .head { display: flex; align-items: center; gap: 12px; }
                .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                         background: color-mix(in srgb, var(--mia-accent) 15%, transparent); color: var(--mia-accent); }
                .badge.manual { background: color-mix(in srgb, var(--mia-manual-color) 15%, transparent); color: var(--mia-manual-color); }
                .title { flex: 1; min-width: 0; }
                .name { font-weight: 500; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .status { font-size: 12px; color: var(--mia-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .status.manual { color: var(--mia-manual-color); }
                .value { font-size: 20px; font-weight: 500; white-space: nowrap; }
                .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
                .shortcut {
                    display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; text-align: left; min-width: 0;
                    background: color-mix(in srgb, var(--mia-accent) 10%, transparent); border: 1px solid color-mix(in srgb, var(--mia-accent) 25%, transparent);
                    transition: transform .1s, background .2s;
                }
                .shortcut:active { transform: scale(.97); }
                .shortcut:hover { background: color-mix(in srgb, var(--mia-accent) 18%, transparent); }
                .shortcut ha-icon { color: var(--mia-accent); flex: none; }
                .shortcut.done { background: color-mix(in srgb, var(--success-color, #43a047) 20%, transparent); border-color: var(--success-color, #43a047); }
                .shortcut.done ha-icon { color: var(--success-color, #43a047); }
                .s-text { display: flex; flex-direction: column; min-width: 0; }
                .s-name { font-weight: 500; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .s-sub { font-size: 12px; color: var(--mia-muted); }
                .custom { justify-content: center; border-style: dashed; background: transparent; color: var(--mia-accent); font-weight: 500; }
                .empty { font-size: 13px; color: var(--mia-muted); }
                .list { display: flex; flex-direction: column; gap: 4px; }
                .list-title { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--mia-muted); margin-top: 2px; }
                .ov { display: flex; align-items: center; gap: 10px; padding: 6px 4px 6px 8px; border-radius: 10px; font-size: 13px; }
                .ov:hover { background: color-mix(in srgb, var(--mia-muted) 8%, transparent); }
                .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; border: 2px solid var(--mia-accent); }
                .ov.running .dot { background: var(--mia-accent); }
                .ov-text { flex: 1; min-width: 0; display: flex; gap: 8px; align-items: baseline; overflow: hidden; white-space: nowrap; }
                .ov-text b { font-weight: 500; overflow: hidden; text-overflow: ellipsis; }
                .ov-when { color: var(--mia-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
                .prio { font-size: 11px; color: var(--mia-muted); border: 1px solid var(--divider-color); border-radius: 6px; padding: 0 5px; }
                .del { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--mia-muted); }
                .del:hover { color: var(--error-color, #db4437); background: color-mix(in srgb, var(--error-color, #db4437) 12%, transparent); }
                .del ha-icon { --mdc-icon-size: 16px; }
                .error { color: var(--error-color, #db4437); font-size: 12px; }
            </style>
            <ha-card>
                <div class="head">
                    <div class="badge ${manual ? 'manual' : ''}"><ha-icon icon="${escapeHtml(this._config.icon || helper.getIcon(type))}"></ha-icon></div>
                    <div class="title">
                        <div class="name">${escapeHtml(this.getName())}</div>
                        <div class="status ${manual ? 'manual' : ''}">${helper.statusText(true)}</div>
                    </div>
                    <div class="value">${escapeHtml(helper.displayValue(current, type))}</div>
                </div>
                <div class="grid">
                    ${buttons}
                    ${this._config.show_custom === false ? '' : `<button class="shortcut custom" data-custom><ha-icon icon="mdi:plus"></ha-icon>Personalizzato</button>`}
                </div>
                ${!shortcuts.length && this._config.show_custom === false ? `<div class="empty">Aggiungi delle scorciatoie nell'editor della card</div>` : ''}
                ${active ? `<div class="list"><div class="list-title">Override</div>${active}</div>` : ''}
                ${this._error ? `<div class="error">${escapeHtml(this._error)}</div>` : ''}
            </ha-card>
        `;
        this.shadowRoot.querySelectorAll('[data-shortcut]').forEach(el =>
            el.addEventListener('click', () => this.applyShortcut(Number(el.dataset.shortcut))));
        this.shadowRoot.querySelector('[data-custom]')?.addEventListener('click', () => this.openCustom());
        this.shadowRoot.querySelectorAll('[data-delete]').forEach(el =>
            el.addEventListener('click', () => this.deleteOverride(el.dataset.delete)));
    }
}

const SHORTCUTS_LABELS = {
    entity: 'Entità Mia Config',
    name: 'Nome',
    icon: 'Icona',
    priority: 'Priorità degli override (1 = più alta)',
    show_custom: 'Mostra "Personalizzato"',
    show_active: 'Mostra gli override attivi',
    shortcuts: 'Scorciatoie',
    setup_name: 'Nome configurazione (se l\'entità non espone setup_name)'
};

class MiaConfigShortcutsEditor extends MiaConfigWidgetEditor {
    getSchema() {
        return [
            { name: 'entity', required: true, selector: { entity: { filter: { domain: 'sensor', integration: 'mia_config' } } } },
            {
                type: 'grid',
                name: '',
                schema: [
                    { name: 'name', selector: { text: {} } },
                    { name: 'icon', selector: { icon: {} } }
                ]
            },
            { name: 'priority', selector: { number: { mode: 'box', min: 1, max: 999, step: 1 } } },
            {
                type: 'grid',
                name: '',
                schema: [
                    { name: 'show_custom', selector: { boolean: {} } },
                    { name: 'show_active', selector: { boolean: {} } }
                ]
            },
            { name: 'shortcuts', selector: { object: {} } },
            { name: 'setup_name', selector: { text: {} } }
        ];
    }

    get labels() {
        return SHORTCUTS_LABELS;
    }

    get defaults() {
        return { show_custom: true, show_active: true, priority: 1, shortcuts: [] };
    }

    stripDefaults(config) {
        if (config.show_custom === true) delete config.show_custom;
        if (config.show_active === true) delete config.show_active;
    }
}

// ---------- Assistente a parole (AI Task) ----------

// Interpreta una frase con il servizio mia_config.interpret_request (AI Task di Home Assistant)
// e apre il popup precompilato: la modifica si applica solo dopo la conferma dell'utente.
class MiaConfigAssistant extends HTMLElement {
    static getConfigElement() {
        return document.createElement('mia-config-assistant-editor');
    }

    static getStubConfig() {
        return {};
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    setConfig(config) {
        this._config = config || {};
        this._text = '';
        this._busy = false;
        this._message = null;
        this._pending = null;
        this.render();
    }

    set hass(hass) {
        const first = !this._hass;
        this._hass = hass;
        // Ridisegna al primo hass o se cambia il numero di istanze (selettore)
        const instances = getInstances(hass).length;
        if (first || instances !== this._instanceCount) {
            this._instanceCount = instances;
            if (!this._busy) this.render();
        }
    }

    getCardSize() {
        return 2;
    }

    getGridOptions() {
        return { columns: 12, min_columns: 6 };
    }

    aiTaskAvailable() {
        return !!this._hass?.services?.ai_task?.generate_data;
    }

    notifyChanged(entityId) {
        this.dispatchEvent(new CustomEvent('mia-config-changed', { detail: { entity_id: entityId }, bubbles: true, composed: true }));
    }

    // Sensore che identifica l'istanza: entity dalla configurazione, altrimenti quella scelta nel selettore
    getInstanceEntity() {
        if (this._config.entity) return this._config.entity;
        const instances = getInstances(this._hass);
        if (!instances.some(i => i.entity_id === this._instanceEntity)) this._instanceEntity = instances[0]?.entity_id;
        return this._instanceEntity;
    }

    async submit() {
        const text = this._text.trim();
        if (!text || this._busy) return;
        this._busy = true;
        this._message = null;
        this._pending = null;
        this.render();
        try {
            const serviceData = { text };
            const instanceEntity = this.getInstanceEntity();
            if (instanceEntity) serviceData.entity_id = instanceEntity;
            if (this._config.setup_name) serviceData.setup_name = this._config.setup_name;
            if (this._config.ai_task_entity) serviceData.ai_task_entity = this._config.ai_task_entity;
            const result = await this._hass.callWS({
                type: 'call_service',
                domain: 'mia_config',
                service: 'interpret_request',
                service_data: serviceData,
                return_response: true
            });
            this.handleProposal(result.response || {});
        } catch (error) {
            this._message = { type: 'error', text: error.message || 'Interpretazione non riuscita' };
        }
        this._busy = false;
        this.render();
    }

    handleProposal(proposal) {
        if (proposal.action === 'none') {
            this._message = { type: 'info', text: proposal.explanation || 'Non ho capito la richiesta' };
            return;
        }
        if (!proposal.entity_id) {
            this._message = { type: 'error', text: `Nessun sensore trovato per la configurazione ${proposal.setup_name}` };
            return;
        }
        if (proposal.action === 'auto') {
            this._pending = proposal;
            return;
        }
        const done = () => {
            this._text = '';
            this._message = { type: 'success', text: proposal.explanation || 'Fatto' };
            this.render();
            this.notifyChanged(proposal.entity_id);
        };
        MiaConfigWidget.openFor(this._hass, proposal.entity_id, proposal.action, {
            subtitle: proposal.explanation,
            note: `“${proposal.request}”`,
            value: proposal.value,
            from: parseDate(proposal.start) || undefined,
            until: proposal.end ? parseDate(proposal.end) : (proposal.action === 'manual' ? null : undefined),
            priority: proposal.priority,
            onDone: done
        }).catch(error => {
            this._message = { type: 'error', text: error.message };
            this.render();
        });
    }

    async confirmAuto() {
        const proposal = this._pending;
        this._busy = true;
        this.render();
        try {
            await this._hass.callService('mia_config', 'clear_manual_override', {
                entity_id: proposal.entity_id,
                setup_name: proposal.setup_name
            });
            this._text = '';
            this._message = { type: 'success', text: proposal.explanation || 'Tornato in automatico' };
            this.notifyChanged(proposal.entity_id);
        } catch (error) {
            this._message = { type: 'error', text: error.message || 'Operazione non riuscita' };
        }
        this._pending = null;
        this._busy = false;
        this.render();
    }

    render() {
        if (!this._config) return;
        const available = !this._hass || this.aiTaskAvailable();
        const instances = this._config.entity ? [] : getInstances(this._hass);
        const selectedInstance = this.getInstanceEntity();
        const instanceSelect = instances.length > 1 ? `
            <select class="instance" data-instance title="Istanza" ${this._busy ? 'disabled' : ''}>
                ${instances.map(i => `<option value="${escapeHtml(i.entity_id)}" ${i.entity_id === selectedInstance ? 'selected' : ''}>${escapeHtml(i.db_name)}</option>`).join('')}
            </select>` : '';
        const message = this._message ? `
            <div class="msg ${this._message.type}">
                <ha-icon icon="${{ error: 'mdi:alert-circle-outline', success: 'mdi:check-circle-outline', info: 'mdi:information-outline' }[this._message.type]}"></ha-icon>
                <span>${escapeHtml(this._message.text)}</span>
            </div>` : '';
        const pending = this._pending ? `
            <div class="msg confirm">
                <ha-icon icon="mdi:autorenew"></ha-icon>
                <span>${escapeHtml(this._pending.explanation || `Torno in automatico ${this._pending.setup_name}?`)}</span>
                <button class="link" data-cancel>Annulla</button>
                <button class="pill" data-auto>Torna in Auto</button>
            </div>` : '';

        this.shadowRoot.innerHTML = `
            <style>
                ${BASE_STYLE}
                :host { --mia-accent: var(--mia-auto-color); }
                ha-card { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
                .compact ha-card, ha-card.compact { padding: 0; background: none; border: none; box-shadow: none; }
                .title { display: flex; align-items: center; gap: 8px; font-weight: 500; font-size: 14px; }
                .title ha-icon { color: var(--mia-accent); --mdc-icon-size: 20px; }
                .box {
                    display: flex; align-items: center; gap: 8px; padding: 4px 4px 4px 14px; border-radius: 999px;
                    border: 1px solid var(--divider-color); background: var(--secondary-background-color, transparent);
                    transition: border-color .2s, box-shadow .2s;
                }
                .box:focus-within { border-color: var(--mia-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--mia-accent) 20%, transparent); }
                .box > ha-icon { color: var(--mia-accent); --mdc-icon-size: 20px; flex: none; }
                .instance {
                    flex: none; max-width: 30%; height: 30px; padding: 0 6px; border-radius: 999px; font: inherit; font-size: 12px;
                    border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color);
                }
                input { flex: 1; min-width: 0; height: 40px; border: none; outline: none; background: none; font: inherit; font-size: 15px; color: var(--primary-text-color); }
                .send {
                    flex: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    background: var(--mia-accent); color: var(--text-primary-color, #fff);
                }
                .send:disabled { opacity: .35; }
                .spinner { width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, .4); border-top-color: #fff; animation: spin .8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .msg { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 8px 12px; border-radius: 12px; }
                .msg ha-icon { --mdc-icon-size: 18px; flex: none; }
                .msg span { flex: 1; }
                .msg.error { color: var(--error-color, #db4437); background: color-mix(in srgb, var(--error-color, #db4437) 10%, transparent); }
                .msg.success { color: var(--success-color, #43a047); background: color-mix(in srgb, var(--success-color, #43a047) 10%, transparent); }
                .msg.info { color: var(--mia-muted); background: color-mix(in srgb, var(--mia-muted) 10%, transparent); }
                .msg.confirm { background: color-mix(in srgb, var(--mia-accent) 10%, transparent); }
                .msg.confirm ha-icon { color: var(--mia-accent); }
                .link { color: var(--mia-muted); font-size: 13px; padding: 4px 8px; }
                .pill { background: var(--mia-accent); color: var(--text-primary-color, #fff); border-radius: 999px; padding: 6px 12px; font-size: 13px; font-weight: 500; }
                .hint { font-size: 12px; color: var(--mia-muted); padding: 0 6px; }
            </style>
            <ha-card class="${this._config.compact ? 'compact' : ''}">
                ${this._config.compact ? '' : `<div class="title"><ha-icon icon="mdi:creation"></ha-icon>${escapeHtml(this._config.name || 'Chiedi a Mia Config')}</div>`}
                <div class="box">
                    ${this._config.compact ? '<ha-icon icon="mdi:creation"></ha-icon>' : ''}
                    ${instanceSelect}
                    <input data-text type="text" value="${escapeHtml(this._text)}" ${this._busy ? 'disabled' : ''}
                        placeholder="${escapeHtml(this._config.placeholder || 'Es. riscaldamento acceso fino alle 22, domani dalle 18 alle 20 profilo eco…')}">
                    <button class="send" data-send ${this._busy || !this._text.trim() ? 'disabled' : ''} title="Interpreta">
                        ${this._busy ? '<span class="spinner"></span>' : '<ha-icon icon="mdi:arrow-up"></ha-icon>'}
                    </button>
                </div>
                ${available ? '' : `<div class="hint">Serve un'integrazione AI configurata come AI Task (Home Assistant 2025.7 o successivo).</div>`}
                ${this._busy ? '<div class="hint">Sto interpretando…</div>' : ''}
                ${pending}
                ${message}
            </ha-card>
        `;
        const input = this.shadowRoot.querySelector('[data-text]');
        input.addEventListener('input', (ev) => {
            this._text = ev.target.value;
            this.shadowRoot.querySelector('[data-send]').disabled = !this._text.trim();
        });
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') this.submit();
        });
        this.shadowRoot.querySelector('[data-send]').addEventListener('click', () => this.submit());
        this.shadowRoot.querySelector('[data-instance]')?.addEventListener('change', (ev) => {
            this._instanceEntity = ev.target.value;
        });
        this.shadowRoot.querySelector('[data-auto]')?.addEventListener('click', () => this.confirmAuto());
        this.shadowRoot.querySelector('[data-cancel]')?.addEventListener('click', () => {
            this._pending = null;
            this.render();
        });
    }
}

const ASSISTANT_LABELS = {
    entity: 'Istanza (un sensore Mia Config qualsiasi dell\'istanza, opzionale)',
    name: 'Titolo',
    placeholder: 'Testo di esempio',
    setup_name: 'Limita a questa configurazione (opzionale)',
    ai_task_entity: 'Entità AI Task (opzionale, altrimenti quella preferita)'
};

class MiaConfigAssistantEditor extends MiaConfigWidgetEditor {
    getSchema() {
        return [
            { name: 'name', selector: { text: {} } },
            { name: 'placeholder', selector: { text: {} } },
            { name: 'entity', selector: { entity: { filter: { domain: 'sensor', integration: 'mia_config' } } } },
            { name: 'setup_name', selector: { text: {} } },
            { name: 'ai_task_entity', selector: { entity: { filter: { domain: 'ai_task' } } } }
        ];
    }

    get labels() {
        return ASSISTANT_LABELS;
    }

    get defaults() {
        return {};
    }

    stripDefaults() {}
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
    customElements.define('mia-config-shortcuts', MiaConfigShortcuts);
    customElements.define('mia-config-shortcuts-editor', MiaConfigShortcutsEditor);
    customElements.define('mia-config-assistant', MiaConfigAssistant);
    customElements.define('mia-config-assistant-editor', MiaConfigAssistantEditor);
    customElements.define('mia-config-binary-card', MiaConfigBinaryCard);
    customElements.define('mia-config-select-card', MiaConfigSelectCard);
    customElements.define('mia-config-number-card', MiaConfigNumberCard);

    window.customCards = window.customCards || [];
    window.customCards.push({
        type: 'mia-config-widget',
        name: 'Mia Config Widget',
        description: 'Forzatura manuale Auto/Manuale di una configurazione (riga, riquadro o card completa)',
        preview: true
    }, {
        type: 'mia-config-shortcuts',
        name: 'Mia Config Scorciatoie',
        description: 'Pulsanti rapidi per aggiungere override a tempo a una configurazione',
        preview: true
    }, {
        type: 'mia-config-assistant',
        name: 'Mia Config Assistente',
        description: "Forzature e override a parole, interpretati dall'AI Task di Home Assistant",
        preview: true
    });
}
})();
