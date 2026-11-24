// Crea icons.js: mappa "mdi:nome-icona" -> path SVG, per il finto <ha-icon>
import * as mdi from '@mdi/js';
import { writeFileSync } from 'fs';

const map = {};
for (const [key, path] of Object.entries(mdi)) {
    const name = key.slice(3).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .replace(/([a-zA-Z])(\d)/g, '$1-$2').toLowerCase();
    map[`mdi:${name}`] = path;
}
writeFileSync(new URL('./icons.js', import.meta.url), `window.MDI_ICONS = ${JSON.stringify(map)};`);
console.log(Object.keys(map).length, map['mdi:fire'] ? 'ok' : 'missing fire', map['mdi:hand-back-right'] ? 'ok' : 'missing hand');
