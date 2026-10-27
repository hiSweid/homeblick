// Apple-Watch-artige Zifferblätter: analog „chrono“, „utility“, „meridian“; digital „typo“, „rings“.
// Farbe folgt dem Hintergrund des Face: Farbton (Zahl) = getönt, Schwarz = dunkel, Weiß = hell; „auto“ nachts = dunkel.
// Zeiger sind eigene SVG-Ebenen (.wh, data-per = Umlaufzeit in s) und werden in index.html per WAAPI animiert (GPU, wie die übrigen Uhren).
export const WF = { chrono: 'analog', utility: 'analog', meridian: 'analog', typo: 'bigclock', rings: 'bigclock' };
const DARK = { chrono: 1, rings: 1 };   // Standard je Stil; Schwarz/Weiß am Face überschreibt

const hs = (h, s, l, a) => `hsl(${h} ${s}% ${l}%${a != null ? ' / ' + a : ''})`;
// Farbvariablen je Stil und Modus (h = Farbton oder null)
const THEME = {
  chrono: (d, h) => d
    ? { bg: h == null ? 'radial-gradient(120% 120% at 28% 12%,#17171a,#000 68%)' : `radial-gradient(120% 120% at 28% 12%,${hs(h, 32, 19)},${hs(h, 38, 6)} 68%)`, ink: '#fff', dim: '#ffffff85', acc: '#ff9f0a', sub: '#ffffff12', hole: h == null ? '#0a0a0b' : hs(h, 38, 8) }
    : { bg: h == null ? 'linear-gradient(155deg,#fafafb,#d6d6dc)' : `linear-gradient(155deg,${hs(h, 45, 96)},${hs(h, 32, 80)})`, ink: '#1c1c1e', dim: '#1c1c1e8c', acc: '#ff6a00', sub: '#0000000d', hole: h == null ? '#e8e8ec' : hs(h, 40, 90) },
  utility: (d, h) => d
    ? { bg: h == null ? 'linear-gradient(155deg,#232326,#050506)' : `linear-gradient(155deg,${hs(h, 26, 20)},${hs(h, 34, 6)})`, ink: '#f5f5f7', dim: '#ffffff80', acc: '#ff9f0a', win: '#2c2c2e', hole: h == null ? '#101012' : hs(h, 30, 10) }
    : { bg: h == null ? 'linear-gradient(155deg,#fbfbfc,#dddde2)' : `linear-gradient(155deg,${hs(h, 55, 97)},${hs(h, 40, 84)})`, ink: '#1c1c1e', dim: '#1c1c1e80', acc: '#ff6a00', win: '#fff', hole: h == null ? '#f0f0f3' : hs(h, 45, 94) },
  meridian: (d, h) => d
    ? { bg: h == null ? 'radial-gradient(110% 110% at 30% 10%,#26221a,#0b0a07 70%)' : `radial-gradient(110% 110% at 30% 10%,${hs(h, 28, 17)},${hs(h, 32, 5)} 70%)`, ink: '#efe3c8', dim: '#efe3c88c', gold: h == null ? '#d9b46a' : hs(h, 55, 66), gold2: h == null ? '#a9823a' : hs(h, 50, 46), acc: '#ff5a4f' }
    : { bg: h == null ? 'linear-gradient(155deg,#f8f3e8,#e4d8c0)' : `linear-gradient(155deg,${hs(h, 48, 94)},${hs(h, 38, 80)})`, ink: h == null ? '#2e2616' : hs(h, 35, 16), dim: h == null ? '#6b5a3a' : hs(h, 25, 34), gold: h == null ? '#c39d52' : hs(h, 52, 48), gold2: h == null ? '#8d6a2a' : hs(h, 55, 30), acc: '#b3262b' },
  typo: (d, h) => {
    const b = h ?? 275;
    return d
      ? { bg: hs(b, 45, 7), b1: hs(b, 80, 38), b2: hs(b + 45, 80, 34), b3: hs(b - 45, 85, 30), ink: '#fff', ink2: '#ffffffa6', hi: `linear-gradient(180deg,#fff,${hs(b + 30, 90, 82)})` }
      : { bg: hs(b, 85, 93), b1: hs(b, 95, 82), b2: hs(b + 45, 95, 84), b3: hs(b - 45, 95, 86), ink: hs(b, 40, 17), ink2: hs(b, 25, 17, .6), hi: `linear-gradient(180deg,${hs(b, 62, 30)},${hs(b - 28, 72, 46)})` };
  },
  rings: (d, h) => d
    ? { bg: h == null ? 'radial-gradient(120% 120% at 50% 40%,#161618,#000 70%)' : `radial-gradient(120% 120% at 50% 40%,${hs(h, 28, 14)},${hs(h, 34, 3)} 70%)`, ink: '#fff', dim: '#ffffff80', r1: '#fa114f', r2: '#a6ff00', r3: '#00e5ff' }
    : { bg: h == null ? 'linear-gradient(155deg,#fbfbfc,#e0e0e5)' : `linear-gradient(155deg,${hs(h, 55, 97)},${hs(h, 40, 86)})`, ink: '#1c1c1e', dim: '#1c1c1e80', r1: '#ff2d55', r2: '#34c759', r3: '#0a84ff' },
};

const P = (r, a) => [+(50 + r * Math.sin(a)).toFixed(2), +(50 - r * Math.cos(a)).toFixed(2)];
const tk = (n, r1, r2, w, skip, op = 1, ox = 0, oy = 0) => Array.from({ length: n }, (_, i) => {
  if (skip?.(i)) return '';
  const a = i * 2 * Math.PI / n, [x1, y1] = P(r1, a), [x2, y2] = P(r2, a);
  return `<line x1="${x1 + ox}" y1="${y1 + oy}" x2="${x2 + ox}" y2="${y2 + oy}" stroke-width="${w}" opacity="${op}"/>`;
}).join('');
const txt = (x, y, s, size, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="middle" ${extra}>${s}</text>`;
// Zeigerebene: pos = Teilzifferblatt (Mitte cx/cy, Radius r in % des Face), sonst ganzes Face
const layer = (cls, per, body, pos) => `<svg class="wh ${cls}" data-per="${per}" viewBox="${pos ? `${-pos[2]} ${-pos[2]} ${pos[2] * 2} ${pos[2] * 2}` : '0 0 100 100'}"${pos ? ` style="left:${pos[0] - pos[2]}%;top:${pos[1] - pos[2]}%;width:${pos[2] * 2}%;height:${pos[2] * 2}%"` : ''}>${body}</svg>`;
// Zeiger mit „Leuchtkanal“ (Apple Utility): Körper + Rinne in Untergrundfarbe
const bar = (len, w, tail = 0) => `<rect x="${50 - w / 2}" y="${50 - len}" width="${w}" height="${len + tail}" rx="${w / 2}" fill="var(--ink)"/><rect x="${50 - w * .2}" y="${50 - len + w * .7}" width="${w * .4}" height="${len * .46}" rx="${w * .2}" fill="var(--hole)"/>`;
const secHand = (len, tail, w = .8, ring = 1.9) => `<rect x="${50 - w / 2}" y="${50 - len}" width="${w}" height="${len + tail}" rx="${w / 2}" fill="var(--acc)"/><circle cx="50" cy="${50 + tail - 1.6}" r="${w * 2.6}" fill="var(--acc)"/><circle cx="50" cy="50" r="${ring}" fill="var(--acc)"/><circle cx="50" cy="50" r="${ring * .38}" fill="var(--hole)"/>`;

function chrono() {
  const subs = [[30, 50, 11.4, 'SEK', 60], [70, 50, 11.4, 'MIN', 1800], [50, 71.5, 11.4, 'STD', 43200]];
  const dial = `<g stroke="var(--ink)" stroke-linecap="round">${tk(60, 48.4, 45.8, .28, i => i % 5 === 0, .55)}${tk(12, 48.4, 43.2, 1.5, null)}</g>
${txt(50, 20.6, '12', 9.4, 'font-weight="500" fill="var(--ink)"')}${txt(50, 36.6, 'HOMEBLICK', 2.7, 'font-weight="600" letter-spacing=".5" fill="var(--dim)"')}`
    + subs.map(([x, y, r, l]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--sub)"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="var(--ink)" stroke-opacity=".14" stroke-width=".35"/><g stroke="var(--ink)" stroke-linecap="round" opacity=".7">${tk(l === 'MIN' ? 30 : 12, r - .9, r - 2.6, .35, null, 1, x - 50, y - 50)}</g>${txt(x, y + 6.6, l, 2.5, 'font-weight="600" letter-spacing=".3" fill="var(--dim)"')}`).join('');
  const sh = (x, y, r, per) => layer('wh-sub', per, `<rect x="-.45" y="${-r + 1.6}" width=".9" height="${r - 1.6 + 2.4}" rx=".45" fill="var(--acc)"/><circle r="1.15" fill="var(--acc)"/><circle r=".42" fill="var(--hole)"/>`, [x, y, r]);
  return { svg: `<svg class="wd" viewBox="0 0 100 100">${dial}</svg>`, hands: subs.map(([x, y, r, , per]) => sh(x, y, r, per)).join('') + layer('wh-h', 43200, `<g class="sd">${bar(26, 3.6)}</g>`) + layer('wh-m', 3600, `<g class="sd">${bar(40, 2.7)}</g>`) + layer('wh-s', 60, `<g class="sd">${secHand(45, 12)}</g>`) + `<svg class="wh cap" viewBox="0 0 100 100"><circle cx="50" cy="50" r="2.7" fill="var(--ink)"/><circle cx="50" cy="50" r="1.5" fill="var(--acc)"/></svg>` };
}

function utility() {
  const nums = Array.from({ length: 12 }, (_, i) => { const [x, y] = P(37.2, i * Math.PI / 6); return txt(x, +y + 3.5, i || 12, 9.4, `font-weight="${i % 3 ? 400 : 600}" fill="var(--ink)"`); }).join('');
  return { svg: `<svg class="wd" viewBox="0 0 100 100"><g stroke="var(--ink)" stroke-linecap="round">${tk(60, 48.8, 46, .3, i => i % 5 === 0, .5)}${tk(12, 48.8, 44.2, 1.1, null)}</g>${nums}
${txt(50, 29.5, 'HOMEBLICK', 2.8, 'font-weight="600" letter-spacing=".6" fill="var(--dim)"')}
<rect x="59.6" y="45.4" width="13.6" height="9.2" rx="2.2" fill="var(--win)" stroke="#00000014" stroke-width=".25"/><text x="66.4" y="52" font-size="6.2" font-weight="600" text-anchor="middle" fill="var(--ink)" data-bind="day"></text></svg>`,
    hands: layer('wh-h', 43200, `<g class="sd">${bar(24.5, 4)}</g>`) + layer('wh-m', 3600, `<g class="sd">${bar(39, 3)}</g>`) + layer('wh-s', 60, `<g class="sd">${secHand(44.6, 11, .8, 2.1)}</g>`) + `<svg class="wh cap" viewBox="0 0 100 100"><circle cx="50" cy="50" r="2.9" fill="var(--ink)"/><circle cx="50" cy="50" r="1.55" fill="var(--acc)"/></svg>` };
}

function meridian() {
  const nums = Array.from({ length: 12 }, (_, i) => {
    const [x, y] = P(i % 3 ? 34.4 : 33.6, i * Math.PI / 6), big = i % 3 === 0;
    return `<text x="${x}" y="${+y + (big ? 3.9 : 2.5)}" font-size="${big ? 11 : 6.8}" font-family="'New York',Georgia,'Times New Roman',serif" ${big ? 'font-weight="600"' : 'font-style="italic"'} text-anchor="middle" fill="var(--ink)">${i || 12}</text>`;
  }).join('');
  const leaf = (len, w) => `<path d="M50 ${50 - len} L${50 + w} 51.5 L50 55.5 L${50 - w} 51.5Z" fill="var(--gold)"/><path d="M50 ${50 - len} L${50 + w} 51.5 L50 55.5Z" fill="var(--gold2)"/><path d="M50 ${50 - len} L${50 + w} 51.5 L50 55.5 L${50 - w} 51.5Z" fill="none" stroke="var(--ink)" stroke-opacity=".28" stroke-width=".25" stroke-linejoin="round"/>`;
  return { svg: `<svg class="wd" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46.6" fill="none" stroke="var(--gold)" stroke-width=".35" opacity=".7"/><circle cx="50" cy="50" r="40.6" fill="none" stroke="var(--gold)" stroke-width=".2" opacity=".45"/>
<g stroke="var(--ink)" stroke-linecap="round">${tk(60, 46.6, 44.2, .26, i => i % 5 === 0, .65)}${tk(12, 46.6, 41.6, .9, i => i % 3 === 0)}${tk(4, 46.6, 41.6, 1.4, null)}</g>${nums}
${txt(50, 66.4, 'AUTOMATIK', 2.7, 'font-family="Georgia,serif" letter-spacing=".9" fill="var(--dim)"')}</svg>`,
    hands: layer('wh-h', 43200, `<g class="sd">${leaf(30, 3.5)}</g>`) + layer('wh-m', 3600, `<g class="sd">${leaf(42, 2.7)}</g>`) + layer('wh-s', 60, `<g class="sd"><rect x="49.75" y="8" width=".5" height="52" fill="var(--acc)"/><circle cx="50" cy="55" r="1.4" fill="none" stroke="var(--acc)" stroke-width=".5"/></g>`) + `<svg class="wh cap" viewBox="0 0 100 100"><circle cx="50" cy="50" r="2.4" fill="var(--gold)" stroke="var(--gold2)" stroke-width=".4"/><circle cx="50" cy="50" r=".9" fill="var(--acc)"/></svg>` };
}

const typo = () => ({ html: `<i class="wmb wmb1"></i><i class="wmb wmb2"></i><i class="wmb wmb3"></i>
<div class="tdate" data-bind="dsh"></div>
<div class="tdig"><div class="th" data-bind="th"></div><div class="tm" data-bind="tmn"></div></div>
<div class="twx"><i class="wi" data-wxi></i><span data-bind="wxt"></span></div>` });

const RING = [[44, 'r1'], [37.2, 'r2'], [30.4, 'r3']];
const rings = () => ({ html: `<svg class="wd" viewBox="0 0 100 100">${RING.map(([r, c]) => `<circle cx="50" cy="50" r="${r}" class="${c} tr"/>`).join('')}
${RING.map(([r, c], i) => `<circle cx="50" cy="50" r="${r}" class="${c} fg" ${i === 2 ? `data-per="60" data-dash="${(2 * Math.PI * r).toFixed(2)}"` : `style="--C:${(2 * Math.PI * r).toFixed(2)}px"`} transform="rotate(-90 50 50)"/>`).join('')}</svg>
<div class="rc"><b data-bind="hm"></b><span data-bind="dsh"></span><em><i class="wi" data-wxi></i><span data-bind="wxt"></span></em></div>` });

const PARTS = { chrono, utility, meridian, typo, rings };

// bg = aufgelöster Hintergrund (Zahl | 'black' | 'white' | …), h = Farbton oder null, night = „auto“ nachts
export function wfHTML(style, h, bg, night) {
  const dark = bg === 'white' ? false : bg === 'black' || bg?.photo || night ? true : !!DARK[style], hue = bg === 'black' || bg === 'white' || bg?.photo ? null : h;
  const t = THEME[style](dark, hue), v = Object.entries(t).map(([k, x]) => `--${k}:${x}`).join(';');
  const p = PARTS[style]();
  return `<div class="wfr wf-${style} ${dark ? 'dk' : 'lt'}" style="${v}">${p.svg || ''}${p.hands || ''}${p.html || ''}</div>`;
}

// Zeiger starten: pro .wfr, in index.html an hands/dialIO angehängt. Rückgabe = [[per, Animation]]
export function wfAnimate(root) {
  return [...root.querySelectorAll('[data-per]')].map(w => {
    const per = +w.dataset.per, C = w.dataset.dash;
    const kf = C ? [{ strokeDasharray: `.01 ${C}` }, { strokeDasharray: `${C} ${C}` }] : [{ transform: 'rotate(0)' }, { transform: 'rotate(1turn)' }];
    return [per, w.animate(kf, { duration: per * 1000, iterations: Infinity })];
  });
}
// Minütlich: Tages- und Minutenring (Anteile 0–1)
export function wfTick(d) {
  const m = d.getMinutes() + d.getSeconds() / 60;
  for (const r of document.querySelectorAll('.wf-rings')) { r.style.setProperty('--d', (d.getHours() * 60 + m) / 1440); r.style.setProperty('--m', m / 60); }
}

export const WF_CSS = `
.wfr{position:absolute;inset:0;overflow:hidden;background:var(--bg);color:var(--ink);isolation:isolate;-webkit-font-smoothing:antialiased}
.wfr::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:9;border-radius:inherit;
  background:linear-gradient(135deg,#ffffff2e,#ffffff00 34%,#ffffff00 70%,#0000000f);box-shadow:inset 0 0 0 .3cqw #ffffff1a,inset 0 .5cqw 1cqw #ffffff14}
.wfr.lt::after{background:linear-gradient(135deg,#ffffffa6,#ffffff00 36%,#ffffff00 72%,#0000000d);box-shadow:inset 0 0 0 .3cqw #ffffff99,inset 0 -.6cqw 1.4cqw #0000000a}
.wfr .wd{position:absolute;inset:0;width:100%;height:100%}
.wfr .wd text{font-family:Inter,-apple-system,system-ui,sans-serif}
.wfr .wh{position:absolute;inset:0;width:100%;height:100%;overflow:visible;transform-origin:50% 50%;will-change:transform;filter:drop-shadow(.15cqw .5cqw .6cqw #0000004d)}
.wfr .wh.cap{filter:drop-shadow(0 .3cqw .5cqw #0000004d)}
.wfr.lt .wh{filter:drop-shadow(.1cqw .4cqw .5cqw #00000033)}
.wfr .wh.wh-sub{filter:drop-shadow(.1cqw .3cqw .35cqw #00000055)}
/* Digital */
.wf-typo{font-family:Inter,-apple-system,system-ui,sans-serif}
.wf-typo .wmb{position:absolute;border-radius:50%;filter:blur(7cqw);opacity:.95;will-change:transform}
.wf-typo .wmb1{width:78cqw;height:78cqw;left:-24cqw;top:-22cqw;background:var(--b1);animation:wfd1 24s ease-in-out infinite alternate}
.wf-typo .wmb2{width:70cqw;height:70cqw;right:-26cqw;top:22cqw;background:var(--b2);animation:wfd2 30s ease-in-out infinite alternate}
.wf-typo .wmb3{width:76cqw;height:76cqw;left:-6cqw;bottom:-34cqw;background:var(--b3);animation:wfd3 27s ease-in-out infinite alternate}
@keyframes wfd1{to{transform:translate(18cqw,14cqw) scale(1.12)}}@keyframes wfd2{to{transform:translate(-16cqw,-12cqw) scale(.92)}}@keyframes wfd3{to{transform:translate(14cqw,-10cqw) scale(1.1)}}
.wf-typo .tdate{position:absolute;left:9cqw;top:8cqw;font-size:5.6cqw;font-weight:600;color:var(--ink2);letter-spacing:.01em}
.wf-typo .tdig{position:absolute;left:8cqw;bottom:8cqw;line-height:.8;font-variant-numeric:tabular-nums}
.wf-typo .th,.wf-typo .tm{font-size:40cqw;letter-spacing:-.045em;white-space:nowrap}
.wf-typo .th{font-weight:250;color:var(--ink)}
.wf-typo .tm{font-weight:700;margin-top:1cqw;background:var(--hi);-webkit-background-clip:text;background-clip:text;color:transparent}
.wf-typo .twx{position:absolute;right:8cqw;top:8cqw;display:flex;align-items:center;gap:1.4cqw;font-size:5.6cqw;font-weight:600;color:var(--ink2)}
.wf-typo .twx .wi{height:5.4cqw}
.wf-rings .wd circle{fill:none;stroke-width:5.3;stroke-linecap:round}
.wf-rings .tr{opacity:.2}
.wf-rings .r1{stroke:var(--r1)}.wf-rings .r2{stroke:var(--r2)}.wf-rings .r3{stroke:var(--r3)}
.wf-rings .fg.r1{stroke-dasharray:calc(var(--d,0)*var(--C)) var(--C);transition:stroke-dasharray 1.2s cubic-bezier(.2,.8,.2,1)}
.wf-rings .fg.r2{stroke-dasharray:calc(var(--m,0)*var(--C)) var(--C);transition:stroke-dasharray 1.2s cubic-bezier(.2,.8,.2,1)}
.wf-rings .rc{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:1.2cqw;text-align:center}
.wf-rings .rc b{font-size:17cqw;font-weight:300;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}
.wf-rings .rc span{font-size:4cqw;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
.wf-rings .rc em{display:flex;align-items:center;gap:1.2cqw;font-style:normal;font-size:4.6cqw;font-weight:600;color:var(--dim)}
.wf-rings .rc .wi{height:4.4cqw}
@media (prefers-reduced-motion:reduce){.wf-typo .wmb{animation:none}}
`;
