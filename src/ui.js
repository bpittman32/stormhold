'use strict';
// ===================== SOUND =====================
const SFX = (() => {
  let ac = null, on = true;
  try { on = localStorage.getItem('stormhold_snd') !== '0'; } catch (e) { }
  const init = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (ac && ac.state === 'suspended') ac.resume(); };
  const tone = (f, d, type = 'square', v = 0.05, f2) => {
    if (!on || !ac) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
  };
  return {
    init, get on() { return on; }, toggle() { on = !on; try { localStorage.setItem('stormhold_snd', on ? '1' : '0'); } catch (e) { } },
    hit: () => tone(180, 0.08, 'square', 0.05, 90), miss: () => tone(400, 0.06, 'sine', 0.03, 300), kill: () => { tone(220, 0.15, 'sawtooth', 0.04, 60); },
    pick: () => tone(660, 0.07, 'triangle', 0.05, 990), coin: () => { tone(988, 0.06, 'square', 0.03); setTimeout(() => tone(1318, 0.1, 'square', 0.03), 60); },
    spell: () => tone(500, 0.25, 'sine', 0.05, 1200), shoot: () => tone(900, 0.1, 'triangle', 0.04, 300), drink: () => tone(300, 0.2, 'sine', 0.05, 600),
    heal: () => tone(523, 0.25, 'sine', 0.04, 784), trap: () => tone(120, 0.3, 'sawtooth', 0.06, 60), hurt: () => tone(140, 0.12, 'sawtooth', 0.05, 70),
    level: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.05), i * 90)); },
    die: () => tone(300, 0.9, 'sawtooth', 0.06, 40), stairs: () => tone(200, 0.3, 'triangle', 0.05, 100),
  };
})();

// ===================== FX =====================
const FX = {
  list: [],
  cap() { if (this.list.length > 250) this.list.splice(0, this.list.length - 250); },
  text(x, y, t, c) { this.cap(); this.list.push({ k: 'text', x, y, t, c, life: 0, max: 900, off: (Math.random() - 0.5) * 0.4 }); },
  bolt(x0, y0, x1, y1, c, style) { this.cap(); this.list.push({ k: 'bolt', x0, y0, x1, y1, c, style, life: 0, max: style === 'beam' ? 260 : 200 }); },
  burst(x, y, c, s = 1) { const parts = []; for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, v = (0.6 + Math.random()) * s; parts.push([Math.cos(a) * v, Math.sin(a) * v]); } this.list.push({ k: 'burst', x, y, c, parts, life: 0, max: 450 }); },
  flash(m) { m._flash = performance.now(); },
  lunge(m) { m._lunge = performance.now(); m._lx = Math.sign(G.p.x - m.x); m._ly = Math.sign(G.p.y - m.y); },
  hurt() { const f = document.getElementById('flash'); f.style.boxShadow = 'inset 0 0 90px 30px rgba(220,30,20,.55)'; setTimeout(() => f.style.boxShadow = 'inset 0 0 80px 20px rgba(220,30,20,0)', 120); SFX.hurt(); if (navigator.vibrate) try { navigator.vibrate(25); } catch (e) { } },
};

// ===================== UI CORE =====================
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const UI = {
  dirty: true, logDirty: true, zoom: 1, cam: null, run: null, targeting: null, T: 40, cssW: 0, cssH: 0, dpr: 1,
  stopRun() { if (this.run) { this.run = null; } },
  refresh() { this.dirty = true; this.logDirty = true; },
};
const cv = () => $('cv');
let ctx;
const emojiCache = new Map();
function emo(ch, size) {
  const key = ch + '|' + size;
  let c = emojiCache.get(key);
  if (!c) {
    c = document.createElement('canvas'); const s = Math.ceil(size * 1.3); c.width = c.height = s;
    const x = c.getContext('2d'); x.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, s / 2, s / 2 + size * 0.06);
    emojiCache.set(key, c);
    if (emojiCache.size > 600) emojiCache.delete(emojiCache.keys().next().value);
  }
  return c;
}
function drawEmo(ch, cx, cy, size, alpha = 1) { const c = emo(ch, Math.round(size)); ctx.globalAlpha = alpha; ctx.drawImage(c, cx - c.width / 2, cy - c.height / 2); ctx.globalAlpha = 1; }

function resize() {
  const v = $('view'); const r = v.getBoundingClientRect();
  UI.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  UI.cssW = r.width; UI.cssH = r.height;
  const c = cv(); c.width = Math.round(r.width * UI.dpr); c.height = Math.round(r.height * UI.dpr);
  ctx = c.getContext('2d');
  UI.T = Math.round(clamp(r.width / 11, 30, 58) * UI.zoom);
  UI.dirty = true;
}
function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

const PCH = { warrior: '🧔', rogue: '🥷', mage: '🧙' };
// ===================== HERO SPRITES =====================
const HERO_PIX = {"warrior": ["..w..........w..", "..wk..kkkk..kw..", "...wkkggggkkw...", "....kgggggGk....", "....kGGGGGGk....", "....ksesseSk....", ".g..khsSShhk....", ".gk.khhhhhhkkkk.", ".gk.kRrrrrRktttk", ".gk.krrttrrktrtk", ".gkkkrrrrrrktttk", ".tttkbBBBBbktttk", "..k.kGGkkGGk.kk.", "....kGGkkGGk....", "....kbbkkbbk....", "....kkk..kkk...."], "rogue": ["................", ".....kkkkkk.....", "....kDddddDk....", "...kDddddddDk...", "...kDkkkkkkDk...", "...kDkeseekDk...", "...kDksSSskDk...", "...kCkkddkkCk...", "..kCcCdddddCck..", ".gkCcCdtddCcckg.", ".GkcCcdddCcCck..", "..kkcCddddCckk..", "....kdddkddk....", "....kddkkddk....", "....kBBkkBBk....", "....kkk..kkk...."], "mage": ["........kk......", ".......kuuk.....", "......kuutk.....", ".....kuuuuk...o.", "....kuuuuuuk.oto", "...kkkkkkkkkk.o.", "....kseSSesk..b.", "....kswwwwsk..b.", "....kwwwwwwk..b.", "...kuuwwwwuuk.b.", "..kuuUuwwuUuuksb", "..kuUuuttuuUuk.b", "...kuuuuuuuuk..b", "...kuUuuuuUuk..b", "...kUUuuuuUUk..b", "....kkkkkkkk...."]};
const HERO_PAL = {"k": "#1a1210", "s": "#f0c090", "S": "#c98e60", "h": "#8a5a2a", "y": "#e8c050", "g": "#c8d0d8", "G": "#7a8490", "w": "#f4efe4", "r": "#c8402e", "R": "#7a1f1a", "b": "#8a5428", "B": "#4a2a12", "u": "#3f6fe0", "U": "#24408f", "o": "#9ef4ff", "c": "#3f8a46", "C": "#22502a", "d": "#3a3a44", "D": "#22222a", "e": "#111111", "t": "#f0c040"};
const heroCache = {};
function heroSprite(cls, flip) {
  const key = cls + (flip ? 'f' : '');
  if (heroCache[key]) return heroCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
  HERO_PIX[cls].forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch === '.') return; x.fillStyle = HERO_PAL[ch]; x.fillRect(flip ? 15 - xx : xx, yy, 1, 1); }));
  return heroCache[key] = c;
}
function heroDataURL(cls) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(heroSprite(cls), 0, 0, 64, 64); return c.toDataURL(); }

const SNOWFLAKES = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: 0.4 + Math.random() * 0.9, w: Math.random() * 6.28 }));
function draw(now) {
  if (!G || !ctx) return;
  const L = lvl(), p = G.p, T = Math.round(UI.T * (L.town ? 0.8 : 1)); UI.Td = T;
  const W = UI.cssW, H = UI.cssH;
  const tx = p.x * T + T / 2, ty = p.y * T + T / 2;
  if (UI.camT !== T) { UI.cam = null; UI.camT = T; }
  if (!UI.cam) UI.cam = { x: tx, y: ty };
  UI.cam.x += (tx - UI.cam.x) * 0.3; UI.cam.y += (ty - UI.cam.y) * 0.3;
  if (Math.abs(tx - UI.cam.x) < 0.5) UI.cam.x = tx; if (Math.abs(ty - UI.cam.y) < 0.5) UI.cam.y = ty;
  const top = Math.min(H * 0.35, ($('log').offsetHeight || 64) + 4);
  const mw = L.w * T, mh = L.h * T;
  let ox = W / 2 - UI.cam.x, oy = (H + top) / 2 - UI.cam.y;
  ox = mw <= W ? (W - mw) / 2 : clamp(ox, W - mw, 0);
  oy = mh <= H - top ? top + (H - top - mh) / 2 : clamp(oy, H - mh, top);
  ox = Math.round(ox); oy = Math.round(oy);
  UI.ox = ox; UI.oy = oy;
  ctx.setTransform(UI.dpr, 0, 0, UI.dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = L.town ? (L.ch === 2 ? '#3e6a2e' : '#c8d4e0') : '#050404'; ctx.fillRect(0, 0, W, H);
  const art = levelArt(L);
  ctx.drawImage(art, ox, oy, L.w * T, L.h * T);
  const x0 = Math.max(0, Math.floor(-ox / T) - 1), y0 = Math.max(0, Math.floor(-oy / T) - 1);
  const x1 = Math.min(L.w - 1, Math.ceil((W - ox) / T) + 1), y1 = Math.min(L.h - 1, Math.ceil((H - oy) / T) + 1);
  const sc = T / 16; // screen px per art px
  if (!L.town) {
    // torches on wall faces (animated)
    for (const [wx, wy] of (L._torches || [])) {
      if (!L.seen[wy * L.w + wx] || wx < x0 || wx > x1 || wy < y0 || wy > y1) continue;
      const X = ox + wx * T, Y = oy + wy * T, f = Math.sin(now / 90 + wx * 3) * 0.5 + 0.5;
      const lit = G.vis[wy * L.w + wx];
      if (lit) { const g = ctx.createRadialGradient(X + T / 2, Y + T * 0.4, 1, X + T / 2, Y + T * 0.4, T * (1.6 + f * 0.2)); g.addColorStop(0, 'rgba(255,170,80,.30)'); g.addColorStop(1, 'rgba(255,140,60,0)'); ctx.fillStyle = g; ctx.fillRect(X - T * 1.5, Y - T, T * 4, T * 3.2); }
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(X + 7 * sc, Y + 6 * sc, 2 * sc, 5 * sc);
      ctx.fillStyle = f > 0.5 ? '#ffd040' : '#ff9a20'; ctx.fillRect(X + 6 * sc, Y + (3 - f) * sc, 4 * sc, 3 * sc);
      ctx.fillStyle = '#fff4b0'; ctx.fillRect(X + 7 * sc, Y + (4 - f) * sc, 2 * sc, 2 * sc);
    }
    // fog of war
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * L.w + x;
      if (!L.seen[i]) { ctx.fillStyle = '#050404'; ctx.fillRect(ox + x * T, oy + y * T, T + 1, T + 1); }
      else if (!G.vis[i]) { ctx.fillStyle = 'rgba(6,6,14,0.62)'; ctx.fillRect(ox + x * T, oy + y * T, T + 1, T + 1); }
    }
    const px = ox + p.x * T + T / 2, py = oy + p.y * T + T / 2, R = G.s.light * T;
    const g = ctx.createRadialGradient(px, py, T * 1.2, px, py, R);
    g.addColorStop(0, 'rgba(255,200,120,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else {
    // lamp glow, building labels, chimney smoke
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (L.t[y * L.w + x] === 'L') {
      const X = ox + x * T + T / 2, Y = oy + y * T + T * 0.2; const g = ctx.createRadialGradient(X, Y, 1, X, Y, T * 1.6);
      g.addColorStop(0, 'rgba(255,210,110,.45)'); g.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = g; ctx.fillRect(X - T * 2, Y - T * 2, T * 4, T * 4);
    }
    for (const b of L.bld) {
      if (b.smoke) for (let k = 0; k < 5; k++) { const t = ((now / 1400 + k / 5) % 1); ctx.fillStyle = `rgba(230,235,240,${0.55 * (1 - t)})`; const sz = (3 + t * 6) * sc; ctx.fillRect(ox + b.smoke[0] * sc + Math.sin(t * 6 + k) * 4 * sc - sz / 2, oy + (b.smoke[1] - t * 30) * sc - sz / 2, sz, sz); }
      const info = SHOP_INFO[b.id];
      const lx = ox + (b.x + b.w / 2) * T, ly = oy + (b.y + b.h * (b.id === 'jarl' ? 0.42 : 0.5)) * T;
      ctx.font = `600 ${Math.max(11, Math.round(T * 0.36))}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(info.n).width + 12;
      ctx.fillStyle = 'rgba(30,18,10,.82)'; ctx.fillRect(lx - tw / 2, ly - T * 0.25, tw, T * 0.5);
      ctx.strokeStyle = '#c8a050'; ctx.lineWidth = 1; ctx.strokeRect(lx - tw / 2 + 0.5, ly - T * 0.25 + 0.5, tw - 1, T * 0.5 - 1);
      ctx.fillStyle = '#f6dc90'; ctx.fillText(info.n, lx, ly + 1);
    }
  }
  // traps
  for (const tr of L.traps) if (tr.found && L.seen[idx(tr.x, tr.y)]) {
    const X = ox + tr.x * T, Y = oy + tr.y * T;
    ctx.fillStyle = OUTLINE; ctx.fillRect(X + 4 * sc, Y + 10 * sc, 8 * sc, 3 * sc);
    ctx.fillStyle = '#a83a2a'; for (let k = 0; k < 4; k++) ctx.fillRect(X + (4 + k * 2) * sc, Y + 8 * sc, 1 * sc, 3 * sc);
    ctx.fillStyle = '#c8d0d8'; ctx.fillRect(X + 4 * sc, Y + 11 * sc, 8 * sc, 1 * sc);
  }
  // items
  for (const fi of L.items) {
    if (!L.seen[idx(fi.x, fi.y)]) continue;
    const cx = ox + fi.x * T + T / 2, cy = oy + fi.y * T + T / 2, it = fi.it;
    const vis = L.town || G.vis[idx(fi.x, fi.y)];
    if (it.k === 'eq' && it.rar > 0) { const col = ['', '80,140,255', '255,210,60', '255,140,40'][it.rar]; const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, T * 0.55); g.addColorStop(0, `rgba(${col},${0.45 + 0.15 * Math.sin(now / 300)})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(cx - T, cy - T, T * 2, T * 2); }
    const sz = Math.round(T * 0.75); ctx.globalAlpha = vis ? 1 : 0.55;
    ctx.drawImage(itemSprite(it), Math.round(cx - sz / 2), Math.round(cy - sz / 2 + T * 0.05), sz, sz); ctx.globalAlpha = 1;
  }
  // stone circle relics + portal, captive
  if (L.ped) for (const d in L.ped) { const pd = L.ped[d]; if (!pd.r || !L.seen[idx(pd.x, pd.y)]) continue; const sz = Math.round(T * 0.6); const X = ox + pd.x * T + T / 2, Y = oy + pd.y * T + T * 0.2; const g = ctx.createRadialGradient(X, Y, 1, X, Y, T * 0.7); g.addColorStop(0, RELICS[pd.r].col + 'aa'); g.addColorStop(1, RELICS[pd.r].col + '00'); ctx.fillStyle = g; ctx.fillRect(X - T, Y - T, T * 2, T * 2); ctx.drawImage(itemSprite({ k: 'relic', b: pd.r }), Math.round(X - sz / 2), Math.round(Y - sz / 2), sz, sz); }
  if (L.gate && L.t[idx(L.gate.x, L.gate.y)] === '&' && L.seen[idx(L.gate.x, L.gate.y)]) { const X = ox + L.gate.x * T, Y = oy + L.gate.y * T; for (let k = 0; k < 6; k++) { const a = now / 400 + k; ctx.fillStyle = `rgba(110,230,255,${0.5 + 0.3 * Math.sin(a * 2)})`; ctx.fillRect(X + T / 2 + Math.cos(a) * T * 0.2 - 2, Y + T * 0.6 + Math.sin(a) * T * 0.25 - 2, 4, 4); } const g = ctx.createRadialGradient(X + T / 2, Y + T / 2, 1, X + T / 2, Y + T / 2, T * 1.4); g.addColorStop(0, 'rgba(110,230,255,.5)'); g.addColorStop(1, 'rgba(110,230,255,0)'); ctx.fillStyle = g; ctx.fillRect(X - T, Y - T, T * 3, T * 3); }
  if (L.captive && !L.captive.freed && L.seen[idx(L.captive.x, L.captive.y)]) { const c = L.captive, sz = Math.round(T * 0.9); const X = ox + c.x * T + T / 2, Y = oy + c.y * T + T / 2; ctx.globalAlpha = G.vis[idx(c.x, c.y)] ? 1 : 0.5; ctx.drawImage(tplSprite(MON_TPL.person, MON_PAL.npc_captive[1], false, 'm:npc_captive'), Math.round(X - sz / 2), Math.round(Y - sz / 2), sz, sz); ctx.globalAlpha = 1; ctx.strokeStyle = '#8a8a94'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X - T * 0.3, Y + T * 0.1); ctx.lineTo(X - T * 0.5, Y - T * 0.3); ctx.moveTo(X + T * 0.3, Y + T * 0.1); ctx.lineTo(X + T * 0.5, Y - T * 0.3); ctx.stroke(); if (Math.floor(now / 900) % 3 === 0) { ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(T * 0.3)}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.fillText('Help!', X, Y - T * 0.55); } }
  // npcs
  if (L.npcs) for (const n of L.npcs) { const sz = Math.round(T * 0.9), bob = Math.floor(now / 500 + n.x) % 2; ctx.fillStyle = 'rgba(60,80,110,.25)'; ctx.beginPath(); ctx.ellipse(ox + n.x * T + T / 2, oy + n.y * T + T * 0.85, T * 0.3, T * 0.1, 0, 0, 6.28); ctx.fill(); ctx.drawImage(npcSprite(n, n.x > p.x), Math.round(ox + n.x * T + T / 2 - sz / 2), Math.round(oy + n.y * T + T / 2 - sz / 2 - bob * sc), sz, sz); }
  // monsters
  for (const m of L.mons) {
    const vis = G.vis[idx(m.x, m.y)];
    if (!vis && !G.detectT) continue;
    const D = MONSTERS[m.id];
    let cx = ox + m.x * T + T / 2, cy = oy + m.y * T + T / 2;
    if (m._lunge && now - m._lunge < 160) { const k = Math.sin((now - m._lunge) / 160 * Math.PI) * T * 0.25; cx += m._lx * k; cy += m._ly * k; }
    if (D.aura) { const g = ctx.createRadialGradient(cx, cy, T * 0.1, cx, cy, T * 1.1); g.addColorStop(0, D.aura + '99'); g.addColorStop(1, D.aura + '00'); ctx.fillStyle = g; ctx.fillRect(cx - T * 1.2, cy - T * 1.2, T * 2.4, T * 2.4); }
    const scl = monScale(m.id), sz = Math.round(T * 0.92 * scl);
    const asleep = m.asleep || m.sleepT > 0;
    const bob = asleep ? 0 : (Math.floor(now / 420 + m.uid * 0.37) % 2) * sc;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + T * 0.38 * scl, T * 0.32 * scl, T * 0.09, 0, 0, 6.28); ctx.fill();
    ctx.globalAlpha = vis ? 1 : 0.4;
    const spr = monSprite(m.id, p.x < m.x);
    const X = Math.round(cx - sz / 2), Y = Math.round(cy - sz / 2 - (scl - 1) * T * 0.3 - bob);
    ctx.drawImage(spr, X, Y, sz, sz);
    if (m._flash && now - m._flash < 140) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7; ctx.drawImage(spr, X, Y, sz, sz); ctx.globalCompositeOperation = 'source-over'; }
    ctx.globalAlpha = 1;
    if (m.carry && m.carry !== 'key' && vis) { ctx.drawImage(itemSprite({ k: 'gold', b: 'gold', q: 1 }), Math.round(cx + T * 0.12), Math.round(Y - T * 0.05), Math.round(T * 0.38), Math.round(T * 0.38)); }
    if (m.carry === 'key' && vis) { ctx.drawImage(itemSprite({ k: 'key', b: 'x' }), Math.round(cx + T * 0.12), Math.round(Y - T * 0.05), Math.round(T * 0.38), Math.round(T * 0.38)); }
    if (D.boss) drawCrown(ctx, Math.round(cx - 3.5 * sc * scl), Y - Math.round(2 * sc), Math.max(1, Math.round(sc * scl)));
    if (vis && m.hp < m.mhp) { const w = T * 0.8, by = cy + T * 0.44 * scl; ctx.fillStyle = OUTLINE; ctx.fillRect(cx - w / 2 - 1, by - 1, w + 2, 5); ctx.fillStyle = '#3a0c0c'; ctx.fillRect(cx - w / 2, by, w, 3); ctx.fillStyle = m.hp / m.mhp > 0.5 ? '#5c5' : m.hp / m.mhp > 0.25 ? '#dc4' : '#e44'; ctx.fillRect(cx - w / 2, by, w * Math.max(0, m.hp / m.mhp), 3); }
    if (vis && asleep) { ctx.fillStyle = '#bcd'; ctx.font = `bold ${Math.round(T * 0.3)}px system-ui,sans-serif`; ctx.textAlign = 'left'; ctx.fillText('z', cx + T * 0.24, cy - T * 0.28 - (Math.floor(now / 600) % 2) * 3); }
    if (vis && m.slow) { ctx.fillStyle = '#c9f'; ctx.fillRect(cx - T * 0.42, cy - T * 0.42, 4, 4); }
    if (UI.targeting && vis) { ctx.strokeStyle = '#f3d58a'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.strokeRect(ox + m.x * T + 2, oy + m.y * T + 2, T - 4, T - 4); ctx.setLineDash([]); }
  }
  // player
  {
    const cx = ox + p.x * T + T / 2, cy = oy + p.y * T + T / 2;
    const pulse = 0.55 + 0.25 * Math.sin(now / 350);
    ctx.fillStyle = `rgba(255,205,80,${0.22 * pulse})`; ctx.beginPath(); ctx.ellipse(cx, cy + T * 0.36, T * 0.44, T * 0.15, 0, 0, 6.28); ctx.fill();
    ctx.strokeStyle = `rgba(255,210,90,${pulse})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy + T * 0.36, T * 0.44, T * 0.15, 0, 0, 6.28); ctx.stroke();
    if (p.st.shield) { ctx.strokeStyle = 'rgba(120,190,255,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, T * 0.5, 0, 6.28); ctx.stroke(); }
    const sz = Math.round(T * 0.92), bob = (Math.floor(now / 450) % 2) * sc;
    ctx.drawImage(heroSprite(G.cls, p.face < 0), Math.round(cx - sz / 2), Math.round(cy - sz / 2 - T * 0.04 - bob), sz, sz);
    ctx.fillStyle = `rgba(255,210,90,${0.6 + 0.4 * pulse})`; const ay = cy - T * 0.58 + Math.sin(now / 300) * 2;
    ctx.beginPath(); ctx.moveTo(cx - T * 0.09, ay - T * 0.08); ctx.lineTo(cx + T * 0.09, ay - T * 0.08); ctx.lineTo(cx, ay + T * 0.03); ctx.closePath(); ctx.fill();
  }
  if (L.town && L.ch === 2) { // drifting leaves
    for (const f of SNOWFLAKES.slice(0, 25)) { f.y += 0.0006 * f.s; f.x += Math.sin(now / 700 + f.w) * 0.0008; if (f.y > 1) { f.y = 0; f.x = Math.random(); } ctx.fillStyle = f.w > 3 ? 'rgba(220,140,40,.8)' : 'rgba(200,80,40,.75)'; ctx.fillRect(f.x * W, f.y * H, 4, 3); }
  } else if (L.kind === 'forest') { // fireflies
    for (const f of SNOWFLAKES.slice(0, 18)) { const fx = (f.x + Math.sin(now / 2000 + f.w) * 0.03) * W, fy = (f.y + Math.cos(now / 1700 + f.w) * 0.03) * H; ctx.fillStyle = `rgba(220,255,120,${0.3 + 0.5 * Math.abs(Math.sin(now / 500 + f.w * 3))})`; ctx.fillRect(fx, fy, 3, 3); }
  } else if (L.town) { // falling snow
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const f of SNOWFLAKES) { f.y += 0.0009 * f.s * 2; f.x += Math.sin(now / 900 + f.w) * 0.0004; if (f.y > 1) { f.y = 0; f.x = Math.random(); } const s2 = Math.max(1.5, f.s * 3); ctx.fillRect(f.x * W, f.y * H, s2, s2); }
  } else if (L.depth === 10) { ctx.fillStyle = 'rgba(200,230,255,.5)'; for (const f of SNOWFLAKES.slice(0, 30)) { f.y += 0.0012 * f.s; f.x += 0.0008; if (f.y > 1) { f.y = 0; f.x = Math.random(); } if (f.x > 1) f.x = 0; ctx.fillRect(f.x * W, f.y * H, 2, 2); } }
  ctx.imageSmoothingEnabled = true;
  // fx
  const keep = [];
  for (const f of FX.list) {
    f.life += 16; if (f.life < f.max) keep.push(f);
    const k = f.life / f.max;
    if (f.k === 'text') {
      ctx.globalAlpha = 1 - k * k; ctx.fillStyle = f.c; ctx.font = `700 ${Math.round(T * 0.38)}px system-ui,sans-serif`; ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3; const X = ox + (f.x + 0.5 + f.off) * T, Y = oy + (f.y + 0.2) * T - k * T * 0.8;
      ctx.strokeText(f.t, X, Y); ctx.fillText(f.t, X, Y); ctx.globalAlpha = 1;
    } else if (f.k === 'bolt') {
      const ax = ox + (f.x0 + 0.5) * T, ay = oy + (f.y0 + 0.5) * T, bx = ox + (f.x1 + 0.5) * T, by = oy + (f.y1 + 0.5) * T;
      if (f.style === 'beam') { ctx.strokeStyle = f.c; ctx.globalAlpha = 1 - k; ctx.lineWidth = 4; ctx.shadowColor = f.c; ctx.shadowBlur = 12; ctx.beginPath(); ctx.moveTo(ax, ay); const n = 7; for (let i = 1; i < n; i++) { const t = i / n; ctx.lineTo(ax + (bx - ax) * t + (Math.random() - 0.5) * T * 0.3, ay + (by - ay) * t + (Math.random() - 0.5) * T * 0.3); } ctx.lineTo(bx, by); ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
      else { const t = Math.min(1, k * 1.25); const X = ax + (bx - ax) * t, Y = ay + (by - ay) * t; if (t < 1) { ctx.fillStyle = f.c; ctx.shadowColor = f.c; ctx.shadowBlur = 14; const r = f.style === 'arrow' ? T * 0.07 : T * 0.14; ctx.fillRect(X - r, Y - r, r * 2, r * 2); ctx.shadowBlur = 0; if (f.style === 'arrow') { ctx.strokeStyle = f.c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X - (bx - ax) * 0.08, Y - (by - ay) * 0.08); ctx.stroke(); } } }
    } else if (f.k === 'burst') {
      ctx.fillStyle = f.c; ctx.globalAlpha = 1 - k;
      for (const [vx, vy] of f.parts) { const s2 = Math.max(2, T * 0.09 * (1 - k)); ctx.fillRect(ox + (f.x + 0.5) * T + vx * k * T * 0.8 - s2 / 2, oy + (f.y + 0.5) * T + vy * k * T * 0.8 - s2 / 2, s2, s2); }
      ctx.globalAlpha = 1;
    }
  }
  FX.list = keep;
  UI.anim = true;
}
// ===================== HUD =====================
const DEPTH_NAME = d => d === 0 ? 'Ravensfjord' : `Barrow ${d}`;
function updateHud() {
  const p = G.p, s = G.s;
  $('hudName').innerHTML = `<b>${esc(G.name)}</b> · Lv ${p.lvl} ${CLASSES[G.cls].n}`;
  $('hudDepth').textContent = levelName(G.loc);
  $('hudGold').textContent = '💰 ' + p.gold;
  $('hpb').querySelector('i').style.width = clamp(p.hp / s.mhp * 100, 0, 100) + '%';
  $('hpb').querySelector('span').textContent = `HP ${Math.max(0, p.hp)}/${s.mhp}`;
  $('mpb').querySelector('i').style.width = (s.mmp ? clamp(p.mp / s.mmp * 100, 0, 100) : 0) + '%';
  $('mpb').querySelector('span').textContent = `MP ${p.mp}/${s.mmp}`;
  $('xpb').querySelector('i').style.width = clamp(p.xp / xpNext(p.lvl) * 100, 0, 100) + '%';
  const st = [];
  if (p.st.poison) st.push(`<span style="color:#8f6">☠ Poison ${p.st.poison}</span>`);
  if (p.st.haste) st.push(`<span style="color:#9cf">💨 Haste ${p.st.haste}</span>`);
  if (p.st.shield) st.push(`<span style="color:#9cf">🔰 Shield×${p.st.shieldN} ${p.st.shield}</span>`);
  if (p.st.resist) st.push(`<span style="color:#9cf">🌈 Resist ${p.st.resist}</span>`);
  if (p.st.slow) st.push(`<span style="color:#c9f">🐌 Slowed ${p.st.slow}</span>`);
  if (p.st.confuse) st.push(`<span style="color:#c9f">💫 Confused ${p.st.confuse}</span>`);
  if (G.detectT) st.push(`<span style="color:#c9f">👁️ Detect ${G.detectT}</span>`);
  const dr = STATS4.filter(k => p.drain[k]); if (dr.length) st.push(`<span style="color:#c8f">⬇ Drained</span>`);
  $('status').innerHTML = st.join('');
  // quickslots
  const qb = $('quick').children;
  for (let i = 0; i < 4; i++) {
    const q = G.quick[i], b = qb[i];
    let html = '', cls = '';
    if (!q) { html = '+ slot'; cls = 'empty'; }
    else if (q.t === 'spell') { const S = SPELLS[q.id]; html = `${S.ic}<small>${S.mp}mp</small>`; if (p.mp < S.mp) cls = 'off'; }
    else { const it = findQuickItem(q.key); if (it) html = `${itemIcon(it, 36)}<small>${it.k === 'wand' ? (it.id ? it.chg : '?') : it.q}</small>`; else { html = '—'; cls = 'off'; } }
    b.innerHTML = `<em>${i + 1}</em>` + html; b.className = cls;
  }
  // context buttons
  const c = [];
  const t = tile(p.x, p.y);
  if (G.pendingLvl) c.push(`<button class="gold" data-a="lvl">⭐ Level up!</button>`);
  if (UI.targeting) c.push(`<button class="warn" data-a="cancelT">✖ Cancel target</button>`);
  if (UI.run) c.push(`<button class="warn" data-a="stop">✋ Stop</button>`);
  const L = lvl(), kind = L.kind || (L.town ? 'town' : 'barrow'), links = linksFor(G.loc);
  if (t === '>' && links['>']) c.push(`<button data-a="down">${kind === 'town' ? (K(G.loc) === 't2' ? '⬇ Enter Shadowdeep' : '⬇ Enter Barrow') : kind === 'forest' ? '🌲 Deeper into the woods' : '⬇ Descend'}</button>`);
  if (kind === 'town' && t !== '>') c.push(`<button data-a="goBarrow">${K(G.loc) === 't2' ? '🕳️ Go to the Shadowdeep' : '🕳️ Go to the Barrow'}</button>`);
  if (K(G.loc) === '0' && G.quest.won && t !== '>') c.push(`<button data-a="goWest">🌲 Road to the Ironwood</button>`);
  if (t === '<' && links['<']) { const to = links['<']; c.push(`<button data-a="up">${kindOf(to) === 'town' ? '⬆ To ' + levelName(to) : kind === 'forest' ? '🌲 Back along the trail' : '⬆ Ascend'}</button>`); }
  const ch = c.join('');
  if ($('ctx').dataset.h !== ch) { $('ctx').innerHTML = ch; $('ctx').dataset.h = ch; }
  if (UI.logDirty) {
    UI.logDirty = false;
    const last = G.msgs.slice(-3);
    $('log').innerHTML = last.map((m, i) => `<div style="color:${m.c};opacity:${m.turn >= G.turn - 1 ? 1 : 0.45 + i * 0.12}">${esc(m.t)}</div>`).join('');
  }
  $('banner').style.display = UI.targeting ? 'block' : 'none';
  if (UI.targeting) $('banner').textContent = UI.targeting.label;
}

// ===================== LOOP =====================
function frame(now) {
  if (G && (UI.dirty || UI.anim)) { UI.dirty = false; draw(now); updateHud(); }
  requestAnimationFrame(frame);
}

// ===================== INPUT =====================
function screenToTile(cx, cy) { const r = cv().getBoundingClientRect(); const x = cx - r.left - UI.ox, y = cy - r.top - UI.oy; return [Math.floor(x / UI.Td), Math.floor(y / UI.Td)]; }
let pdown = null, pressTimer = null;
function setupInput() {
  const c = cv();
  c.addEventListener('pointerdown', e => {
    SFX.init();
    pdown = { x: e.clientX, y: e.clientY, t: performance.now(), long: false };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { if (pdown) { pdown.long = true; const [tx, ty] = screenToTile(pdown.x, pdown.y); examine(tx, ty); } }, 480);
  });
  c.addEventListener('pointermove', e => { if (pdown && Math.hypot(e.clientX - pdown.x, e.clientY - pdown.y) > 14) { clearTimeout(pressTimer); } });
  c.addEventListener('pointerup', e => {
    clearTimeout(pressTimer);
    if (!pdown || pdown.long) { pdown = null; return; }
    const d = pdown; pdown = null;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 24) { // swipe = step
      const dx = e.clientX - d.x, dy = e.clientY - d.y, a = Math.atan2(dy, dx);
      const oct = Math.round(a / (Math.PI / 4)); const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
      const [sx, sy] = dirs[(oct + 8) % 8]; UI.stopRun(); act(() => playerStep(sx, sy)); return;
    }
    const [tx, ty] = screenToTile(e.clientX, e.clientY); onTap(tx, ty);
  });
  c.addEventListener('pointercancel', () => { clearTimeout(pressTimer); pdown = null; });
  c.addEventListener('contextmenu', e => e.preventDefault());
  $('blog').onclick = showLog;
  $('ctx').addEventListener('click', e => {
    const a = e.target.closest('button'); if (!a) return;
    const k = a.dataset.a;
    if (k === 'lvl') openLevelUp();
    if (k === 'cancelT') { UI.targeting = null; UI.dirty = true; }
    if (k === 'stop') { UI.stopRun(); UI.dirty = true; }
    if (k === 'goBarrow') { const d = lvl().down; onTap(d.x, d.y); }
    if (k === 'goWest') { const e = findTile(lvl(), 'E'); onTap(e.x, e.y); }
    if (k === 'down' || k === 'up') { SFX.stairs(); act(useStairs); }
  });
  $('zin').onclick = () => { UI.zoom = Math.min(1.6, UI.zoom * 1.2); resize(); };
  $('zout').onclick = () => { UI.zoom = Math.max(0.55, UI.zoom / 1.2); resize(); };
  [...$('quick').children].forEach((b, i) => {
    let t = null, long = false;
    b.addEventListener('pointerdown', () => { SFX.init(); long = false; t = setTimeout(() => { long = true; assignQuick(i); }, 500); });
    b.addEventListener('pointerup', () => { clearTimeout(t); if (!long) useQuick(i); });
    b.addEventListener('pointerleave', () => clearTimeout(t));
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
  $('bBag').onclick = openInventory; $('bMagic').onclick = openMagic; $('bExplore').onclick = startExplore;
  $('bRest').onclick = startRest; $('bMap').onclick = openMap; $('bMenu').onclick = openMenu;
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', resize);
}
function busy() { return $('modal').classList.contains('on') || !$('title').classList.contains('hidden') || !G || G.dead; }
function act(fn) { if (busy()) return; if (G.pendingLvl) { openLevelUp(); return; } fn(); afterAct(); }
function afterAct() {
  UI.refresh();
  if (G.pendingLvl && !UI.run) setTimeout(() => { if (!busy()) openLevelUp(); }, 250);
  if (G.won && !G.wonShown) { G.wonShown = true; showVictory(); }
}
function onTap(tx, ty) {
  if (busy()) return;
  SFX.init();
  const p = G.p;
  if (UI.targeting) {
    const m = inb(tx, ty) ? monAt(tx, ty) : null;
    if (m && canSeeTile(tx, ty)) { const cb = UI.targeting.cb; UI.targeting = null; act(() => cb(m)); }
    else { UI.targeting = null; msg('Targeting cancelled.', '#aaa'); UI.refresh(); }
    return;
  }
  UI.stopRun();
  if (!inb(tx, ty)) return;
  if (tx === p.x && ty === p.y) {
    const t = tile(tx, ty);
    if (t === '>' || t === '<') { SFX.stairs(); act(useStairs); return; }
    act(() => { if (!lvl().town) { searchAround(2, 0.55); } endTurn(); });
    return;
  }
  const m = monAt(tx, ty);
  if (m && canSeeTile(tx, ty)) {
    const d = dist(tx, ty, p.x, p.y);
    if (d === 1) { act(() => playerStep(tx - p.x, ty - p.y)); return; }
    if (canShoot(m)) { act(() => playerShoot(m)); return; }
  }
  const L = lvl();
  if (!L.seen[idx(tx, ty)]) return;
  if (L.town && tile(tx, ty) === 'B') { const b = L.bld.find(b => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h); if (b && b.door) { tx = b.door.x; ty = b.door.y; } }
  const t = tile(tx, ty);
  const BUMP = 'SPRYJGO';
  if (dist(tx, ty, p.x, p.y) === 1 && (BUMP.includes(t) || t === '+' || npcAt(tx, ty))) { act(() => playerStep(tx - p.x, ty - p.y)); return; }
  let target = [tx, ty];
  if (BUMP.includes(t) || t === 'B' || npcAt(tx, ty) || (m && canSeeTile(tx, ty))) {
    // walk to a free neighbour (closest to player), then step in
    const cands = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = tx + dx, ny = ty + dy; if ((dx || dy) && isWalk(nx, ny) && L.seen[idx(nx, ny)] && !monAt(nx, ny) && !'E&'.includes(tile(nx, ny))) cands.push([nx, ny]); }
    cands.sort((a, b) => dist(a[0], a[1], p.x, p.y) - dist(b[0], b[1], p.x, p.y));
    const best = cands.find(c => (c[0] === p.x && c[1] === p.y) || pathTo(c[0], c[1]));
    if (!best) return; target = best;
    if (BUMP.includes(t)) UI.afterPath = [tx, ty];
  } else if (!isWalk(tx, ty)) return;
  if (t === 'E' && K(G.loc) === '0' && !G.quest.won) { act(() => playerStep(Math.sign(tx - p.x) || -1, 0)); }
  const path = pathTo(target[0], target[1]);
  if (!path || !path.length) { if (UI.afterPath) { const a = UI.afterPath; UI.afterPath = null; act(() => playerStep(a[0] - p.x, a[1] - p.y)); } return; }
  UI.run = { mode: 'path', path, hostiles: hostilesInView(), hp: p.hp };
  runTick();
}
function runTick() {
  const r = UI.run;
  if (!r || busy()) { UI.run = null; UI.dirty = true; return; }
  const p = G.p;
  if (G.pendingLvl) { UI.run = null; openLevelUp(); return; }
  if (r.mode === 'path') {
    if (!r.path.length) { UI.run = null; if (UI.afterPath) { const a = UI.afterPath; UI.afterPath = null; if (dist(a[0], a[1], p.x, p.y) === 1) act(() => playerStep(a[0] - p.x, a[1] - p.y)); } UI.refresh(); return; }
    const [nx, ny] = r.path[0];
    if (monAt(nx, ny)) { UI.run = null; UI.afterPath = null; UI.refresh(); return; }
    const before = [p.x, p.y], depth = G.depth;
    playerStep(nx - p.x, ny - p.y);
    if (G.depth !== depth) { UI.run = null; afterAct(); return; }
    if (p.x === nx && p.y === ny) r.path.shift();
    else if (p.x === before[0] && p.y === before[1] && tile(nx, ny) !== "'") { UI.run = null; UI.afterPath = null; afterAct(); return; }
    const h = hostilesInView();
    if (h > r.hostiles || p.hp < r.hp) { if (h > r.hostiles) noticeMonsters(); UI.run = null; UI.afterPath = null; afterAct(); return; }
    r.hostiles = h; r.hp = p.hp;
  } else if (r.mode === 'explore') {
    if (hostilesInView()) { noticeMonsters(); UI.run = null; afterAct(); return; }
    const tgt = exploreTarget();
    if (!tgt) { msg(lvl().down ? 'Nothing left to explore here. Head for the stairs down.' : 'This level is fully explored.', '#9cf'); UI.run = null; afterAct(); return; }
    const path = pathTo(tgt[0], tgt[1]);
    if (!path || !path.length) { const fi = lvl().items.find(i => i.x === tgt[0] && i.y === tgt[1]); if (fi) fi.skip = true; else { UI.run = null; afterAct(); return; } }
    else { const hp = p.hp; playerStep(path[0][0] - p.x, path[0][1] - p.y); if (p.hp < hp) { UI.run = null; afterAct(); return; } }
    if (r.steps++ > 600) { UI.run = null; }
  } else if (r.mode === 'rest') {
    if (hostilesInView()) { noticeMonsters(); UI.run = null; afterAct(); return; }
    if ((p.hp >= G.s.mhp && p.mp >= G.s.mmp && !p.st.poison) || r.steps++ > 500) { msg('You finish resting.', '#9cf'); UI.run = null; afterAct(); return; }
    if (!lvl().town) searchAround(2, 0.15);
    endTurn();
  }
  UI.refresh();
  if (UI.run) setTimeout(runTick, r.mode === 'rest' ? 12 : 70);
  else afterAct();
}
function noticeMonsters() { const ms = visibleMons(); if (ms.length) msg(`You see ${ms.length === 1 ? 'a ' + MONSTERS[ms[0].id].n : ms.length + ' foes'}!`, '#fc8'); }
function startExplore() {
  if (busy()) return; SFX.init();
  if (lvl().town) { msg('The Barrow entrance is at the top of the village.', '#9cf'); UI.refresh(); return; }
  if (hostilesInView()) { msg('Not with enemies in sight!', '#f99'); UI.refresh(); return; }
  if (G.pendingLvl) { openLevelUp(); return; }
  UI.run = { mode: 'explore', steps: 0 }; runTick();
}
function startRest() {
  if (busy()) return; SFX.init();
  if (hostilesInView()) { msg('You can\'t rest with enemies in sight!', '#f99'); UI.refresh(); return; }
  if (G.pendingLvl) { openLevelUp(); return; }
  msg('You rest and search the area...', '#9cf');
  UI.run = { mode: 'rest', steps: 0 }; runTick();
}
function onKey(e) {
  if (!G || !$('title').classList.contains('hidden')) return;
  if (e.key === 'Escape') { if ($('modal').classList.contains('on')) closeModal(); UI.targeting = null; UI.stopRun(); UI.refresh(); return; }
  if (busy()) return;
  const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], k: [0, -1], j: [0, 1], h: [-1, 0], l: [1, 0], y: [-1, -1], u: [1, -1], b: [-1, 1], n: [1, 1], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], '8': [0, -1], '2': [0, 1], '4': [-1, 0], '6': [1, 0], '7': [-1, -1], '9': [1, -1], '1': [-1, 1], '3': [1, 1] };
  if (e.code && e.code.startsWith('Numpad') && dirs[e.key]) { e.preventDefault(); UI.stopRun(); act(() => playerStep(...dirs[e.key])); return; }
  if (dirs[e.key] && !/^[1-4]$/.test(e.key)) { e.preventDefault(); UI.stopRun(); act(() => playerStep(...dirs[e.key])); return; }
  if (/^[1-4]$/.test(e.key)) { useQuick(+e.key - 1); return; }
  if (e.key === '>' || e.key === '<') { act(useStairs); return; }
  if (e.key === 'i') openInventory(); if (e.key === 'm') openMagic(); if (e.key === 'x') startExplore(); if (e.key === 'r') startRest();
  if (e.key === 'M' || e.key === 'Tab') { e.preventDefault(); openMap(); }
  if (e.key === '.' || e.key === '5') act(() => { if (!lvl().town) searchAround(2, 0.55); endTurn(); });
}
function examine(tx, ty) {
  if (!G || !inb(tx, ty) || busy()) return;
  const L = lvl();
  if (!L.seen[idx(tx, ty)]) return;
  const parts = [];
  const m = monAt(tx, ty);
  if (m && (canSeeTile(tx, ty) || G.detectT)) {
    const D = MONSTERS[m.id];
    const tags = [];
    if (D.undead) tags.push('undead'); if (D.poison) tags.push('poisonous'); if (D.ranged) tags.push('ranged: ' + D.ranged.verb); if (D.regen) tags.push('regenerates'); if (D.drain) tags.push('drains stats'); if (D.leech) tags.push('drains life'); if (D.spd > 120) tags.push('fast'); if (D.spd < 90) tags.push('slow');
    if (D.res) for (const k in D.res) tags.push(D.res[k] === 0 ? `immune to ${k}` : D.res[k] < 1 ? `resists ${k}` : `weak to ${k}`);
    const hpTxt = m.hp / m.mhp > 0.75 ? 'unhurt' : m.hp / m.mhp > 0.4 ? 'wounded' : 'badly wounded';
    parts.push(`<div class="big">${monImgHTML(m.id, 80)}</div><div style="text-align:center;font-weight:700;font-size:17px;color:#f3d58a">${D.n}</div><div class="desc" style="text-align:center">${hpTxt}${m.asleep || m.sleepT ? ' · asleep' : ''}${tags.length ? '<br>' + tags.join(' · ') : ''}<br>Threat: ${'★'.repeat(clamp(Math.round((D.atk * 1.5 - G.s.ac) / 4 + 3), 1, 5))}</div>`);
  }
  for (const fi of itemsAt(tx, ty)) parts.push(`<div class="row"><div class="ic">${itemIcon(fi.it)}</div><div class="nm"><div style="color:${itemColor(fi.it)}">${esc(itemName(fi.it))}</div></div></div>`);
  const tr = trapAt(tx, ty); if (tr && tr.found) parts.push(`<div class="desc">⚠️ A ${({ dart: 'poison dart', pit: 'pit', tele: 'teleport rune', fire: 'fire rune', alarm: 'alarm' })[tr.type]} trap.</div>`);
  const n = npcAt(tx, ty); if (n) parts.push(`<div class="desc">${n.ch} ${n.n}. Bump into them to chat.</div>`);
  const t = tile(tx, ty);
  const tn = { '#': 'Rock wall', '.': 'Stone floor', '+': 'A closed door', "'": 'An open door', '>': G.depth ? 'Stairs leading down' : 'The Barrow entrance', '<': 'Stairs leading up', ',': 'Grass', '=': 'Dirt road', 'T': 'Trees', 'M': 'Mountains', 'B': 'A building', 'S': 'A shop door', 'f': L.kind === 'forest' ? 'Mushrooms and ferns' : 'Flowers', '~': 'Water', 'E': 'The road out of town', 'Y': 'An ancient waystone' + (G.quest.circle ? ' (awake — bump to travel)' : ' (dormant)'), 'P': 'A stone pedestal', 'G': 'The sealed gate of the Stone Circle', '&': 'The open gate — a road beyond', 'R': 'A carved tablet (bump to read)', 'O': 'A standing stone', 'J': 'A barred cell door' }[t] || (L.kind === 'forest' && t === 'T' ? 'Dense ironwood trees' : L.kind === 'forest' && t === ',' ? 'Forest floor' : undefined);
  if (L.town && (t === 'S' || t === 'B')) { const b = L.bld.find(b => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h); if (b) parts.push(`<div class="desc">${SHOP_INFO[b.id].ic} ${SHOP_INFO[b.id].n} — ${SHOP_INFO[b.id].who}. Tap the door to enter.</div>`); }
  if (L.captive && !L.captive.freed && tx === L.captive.x && ty === L.captive.y) parts.push(`<div class="desc">${L.captive.name}, a captive from Eldermere, chained in the cell.</div>`);
  if (m && m.carry && canSeeTile(tx, ty)) parts.push(`<div class="desc" style="color:#fd4">Carrying: ${m.carry === 'key' ? 'the cell key' : RELICS[m.carry].n}</div>`);
  if (!parts.length) parts.push(`<div class="desc">${tn || '?'}</div>`);
  if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) { }
  sheet('Examine', parts.join(''));
}

// ===================== MODALS =====================
function sheet(title, body, onClose, back) {
  $('modal').innerHTML = `<div class="sheet"><div class="sh">${back ? '<button class="x" id="mback" aria-label="Back" style="margin-right:8px">‹</button>' : ''}<h2 style="flex:1">${title}</h2><button class="x" id="mx">✕</button></div><div class="sb" id="mb">${body}</div></div>`;
  $('modal').classList.add('on');
  $('mx').onclick = () => { closeModal(); if (onClose) onClose(); };
  if (back) $('mback').onclick = () => { UI.onClose = null; $('modal').classList.remove('on'); back(); };
  UI.onClose = onClose || null;
  UI.stopRun();
  return $('mb');
}
function closeModal() { $('modal').classList.remove('on'); $('modal').style.zIndex = ''; $('modal').innerHTML = ''; const f = UI.onClose; UI.onClose = null; UI.refresh(); if (f) f(); if (G && G.pendingLvl && !busy()) setTimeout(() => { if (!busy()) openLevelUp(); }, 200); }
document.addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });
function bind(root, sel, fn) { root.querySelectorAll(sel).forEach(el => el.addEventListener('click', () => fn(el.dataset.i, el))); }

function upgradeBadge(it) {
  if (it.k !== 'eq' || Object.values(G.p.equip).includes(it)) return '';
  const d = upgradeDelta(it);
  if (d === null) return `<span class="ub q" title="Unidentified">?</span>`;
  if (d > 0.5) return `<span class="ub up">▲ ${Math.round(d)}</span>`;
  if (d < -0.5) return `<span class="ub dn">▼</span>`;
  return `<span class="ub eqv">≈</span>`;
}
function itemRow(it, i, right = '') {
  const sub = it.k === 'eq' ? (it.id ? RAR_NAME[it.rar] + (it.cursed ? ' · cursed' : '') : 'Unidentified') + ' · ' + (SLOT_LABEL[BASES[it.b].slot === 'ring' ? 'ring1' : BASES[it.b].slot]) : ({ potion: 'Potion', scroll: 'Scroll', wand: 'Wand', book: 'Spellbook', arrows: 'Ammo' })[it.k] || '';
  return `<div class="row" data-i="${i}"><div class="ic">${itemIcon(it)}</div><div class="nm"><div style="color:${itemColor(it)}">${esc(itemName(it))}</div><div>${sub}</div></div>${upgradeBadge(it)}${right}</div>`;
}
function openInventory() {
  if (busy()) return;
  const p = G.p;
  let h = `<div class="eqgrid">`;
  for (const sl of EQ_SLOTS) { const it = p.equip[sl]; h += `<div class="eq" data-s="${sl}">${it ? `<div class="e">${itemIcon(it, 32)}</div><div class="n" style="color:${itemColor(it)}">${esc(itemName(it))}</div>` : `<div class="e" style="opacity:.22;filter:grayscale(1)">${itemImgHTML({ k: 'eq', b: ({ weapon: 'lsword', shield: 'rshield', bow: 'sbow', armor: 'chain', helm: 'ihelm', cloak: 'cloak', gloves: 'gloves', boots: 'boots', ring1: 'ring', ring2: 'ring', amulet: 'amulet' })[sl] }, 32)}</div><div class="n">${SLOT_LABEL[sl]}</div>`}</div>`; }
  h += `</div><div class="sec">Pack (${p.inv.length}/${MAX_INV}) · 💰 ${p.gold}</div>`;
  if (!p.inv.length) h += `<div class="desc">Your pack is empty.</div>`;
  const order = { eq: 0, wand: 1, potion: 2, scroll: 3, book: 4, arrows: 5 };
  const ud = it => { const d = upgradeDelta(it); return d === null ? 0.1 : d; };
  const sorted = p.inv.map((it, i) => [it, i]).sort((a, b) => ((order[a[0].k] ?? 9) - (order[b[0].k] ?? 9)) || (a[0].k === 'eq' ? (ud(b[0]) > 0.5) - (ud(a[0]) > 0.5) || BASES[a[0].b].slot.localeCompare(BASES[b[0].b].slot) || ud(b[0]) - ud(a[0]) : 0));
  for (const [it, i] of sorted) h += itemRow(it, i);
  const mb = sheet('Inventory', h);
  mb.querySelectorAll('.eq').forEach(el => el.onclick = () => { const it = p.equip[el.dataset.s]; if (it) openItem(it, el.dataset.s, openInventory); });
  bind(mb, '.row', i => openItem(p.inv[+i], null, openInventory));
}
function compareHtml(it) {
  if (it.k !== 'eq' || Object.values(G.p.equip).includes(it)) return '';
  const cur = equippedFor(it);
  const B = BASES[it.b];
  if (!it.id) return `<div class="sec">Compared to what you wear</div><div class="desc"><i>Unknown until identified or equipped.</i></div>`;
  const a = itemStats(it), c = cur ? itemStats(cur) : {};
  if (B.dmg) a._avg = (B.dmg[0] + B.dmg[1]) / 2; if (cur && BASES[cur.b].dmg) c._avg = (BASES[cur.b].dmg[0] + BASES[cur.b].dmg[1]) / 2;
  const keys = [...new Set([...Object.keys(a), ...Object.keys(c)])];
  const lab = k => k === '_avg' ? 'Avg damage' : (MOD_LABEL[k] || k);
  const rows = keys.map(k => [k, (a[k] || 0) - (c[k] || 0)]).filter(([, d]) => Math.abs(d) >= 0.5)
    .map(([k, d]) => `<div style="display:flex;justify-content:space-between;color:${d > 0 ? '#7ee07e' : '#f08a7a'}"><span>${lab(k)}</span><b>${d > 0 ? '+' : ''}${Math.round(d * 10) / 10}</b></div>`).join('');
  const delta = upgradeDelta(it);
  const verdict = delta > 0.5 ? '<b style="color:#7ee07e">▲ Upgrade</b>' : delta < -0.5 ? '<b style="color:#f08a7a">▼ Worse overall</b>' : '<b style="color:#c8bba8">≈ About the same</b>';
  const two = B.slot === 'weapon' && B.two && G.p.equip.shield ? '<div style="color:#fc8;font-size:13px">Two-handed: equipping this removes your shield (counted above).</div>' : '';
  return `<div class="sec">vs. ${cur ? `<span style="color:${itemColor(cur)};text-transform:none;letter-spacing:0">${esc(itemName(cur))}</span>` : 'empty slot'}</div><div class="desc">${verdict}${rows ? '<div style="margin-top:6px;font-size:14px">' + rows + '</div>' : ''}${two}</div>`;
}
function openItem(it, eqSlot, back) {
  const p = G.p;
  let h = `<div class="big">${itemIcon(it, 72)}</div><div style="text-align:center;font-weight:700;font-size:17px;color:${itemColor(it)}">${esc(itemName(it))}</div><div class="desc" style="margin-top:8px">${itemDesc(it)}</div>`;
  if (!eqSlot) h += compareHtml(it);
  const b = [];
  if (eqSlot) b.push(`<button class="btn pri" data-a="uneq">Remove</button>`);
  else {
    if (it.k === 'eq') b.push(`<button class="btn pri" data-a="eq">Equip</button>`);
    if (it.k === 'potion') b.push(`<button class="btn pri" data-a="use">Drink</button>`);
    if (it.k === 'scroll') b.push(`<button class="btn pri" data-a="use">Read</button>`);
    if (it.k === 'wand') b.push(`<button class="btn pri" data-a="zap">Zap</button>`);
    if (it.k === 'book') b.push(`<button class="btn pri" data-a="use">Learn spell</button>`);
    if (['potion', 'scroll', 'wand'].includes(it.k)) b.push(`<button class="btn" data-a="quick">Put on quickbar</button>`);
    b.push(`<button class="btn red" data-a="drop">Drop</button>`);
  }
  const mb = sheet('Item', h + `<div class="btns">${b.join('')}</div>`, null, back);
  mb.querySelectorAll('[data-a]').forEach(el => el.onclick = () => {
    const a = el.dataset.a;
    if (a === 'uneq') { closeModal(); act(() => unequip(eqSlot)); openInventory(); }
    if (a === 'eq') { closeModal(); act(() => equipItem(it)); openInventory(); }
    if (a === 'use') { closeModal(); act(() => useItem(it)); }
    if (a === 'zap') { closeModal(); targetWith(it.k === 'wand' && isKnown(it) && !SPELLS[WANDS[it.b].spell].tgt ? null : 'Tap a foe to zap', m => zapWand(it, m)); }
    if (a === 'drop') { closeModal(); act(() => dropItem(it)); openInventory(); }
    if (a === 'quick') { pickQuickSlot({ t: 'item', key: quickKeyFor(it) }, () => openItem(it, eqSlot, back)); }
  });
}
function targetWith(label, cb) {
  if (!label) { act(() => cb(null)); return; }
  if (!visibleMons().length) { msg('No target in sight.', '#aaa'); UI.refresh(); return; }
  UI.targeting = { label, cb }; UI.refresh();
}
function pickQuickSlot(entry, back) {
  let h = `<div class="desc">Choose a quickbar slot:</div><div class="btns">`;
  for (let i = 0; i < 4; i++) { const q = G.quick[i]; h += `<button class="btn" data-i="${i}">${i + 1}: ${q ? (q.t === 'spell' ? SPELLS[q.id].ic + ' ' + SPELLS[q.id].n : (findQuickItem(q.key) ? itemIcon(findQuickItem(q.key)) + ' ' + esc(itemName(findQuickItem(q.key), true)) : 'empty')) : 'empty'}</button>`; }
  h += '</div>';
  const mb = sheet('Quickbar', h, null, back);
  bind(mb, '[data-i]', i => { G.quick[+i] = entry; saveGame(); if (back) { $('modal').classList.remove('on'); back(); } else closeModal(); });
}
function assignQuick(i) {
  if (busy()) return;
  const p = G.p;
  let h = `<div class="sec">Spells</div>`;
  for (const s of p.spells) h += `<div class="row" data-v="spell:${s}"><div class="ic">${SPELLS[s].ic}</div><div class="nm"><div>${SPELLS[s].n}</div><div>${SPELLS[s].mp} MP</div></div></div>`;
  if (!p.spells.length) h += `<div class="desc">No spells known.</div>`;
  h += `<div class="sec">Items</div>`;
  const seen = new Set();
  for (const it of p.inv) if (['potion', 'scroll', 'wand'].includes(it.k)) { const k = quickKeyFor(it); if (seen.has(k)) continue; seen.add(k); h += `<div class="row" data-v="item:${k}"><div class="ic">${itemIcon(it)}</div><div class="nm"><div style="color:${itemColor(it)}">${esc(itemName(it))}</div></div></div>`; }
  h += `<div class="btns"><button class="btn red" data-v="clear">Clear slot</button></div>`;
  const mb = sheet(`Quickslot ${i + 1}`, h);
  mb.querySelectorAll('[data-v]').forEach(el => el.onclick = () => {
    const v = el.dataset.v;
    if (v === 'clear') G.quick[i] = null;
    else if (v.startsWith('spell:')) G.quick[i] = { t: 'spell', id: v.slice(6) };
    else G.quick[i] = { t: 'item', key: v.slice(5) };
    closeModal(); saveGame();
  });
}
function useQuick(i) {
  if (busy()) return;
  if (G.pendingLvl) { openLevelUp(); return; }
  const q = G.quick[i];
  if (!q) { assignQuick(i); return; }
  UI.stopRun();
  if (q.t === 'spell') {
    const S = SPELLS[q.id];
    if (S.tgt) { const m = UI.targeting ? null : nearestMon(); if (!m) { msg('No target in sight.', '#aaa'); UI.refresh(); return; } act(() => castSpell(q.id, m)); }
    else act(() => castSpell(q.id, null));
    return;
  }
  const it = findQuickItem(q.key);
  if (!it) { msg('You have none of those left.', '#aaa'); UI.refresh(); return; }
  if (it.k === 'wand') { const m = nearestMon(); act(() => zapWand(it, m)); return; }
  act(() => useItem(it));
}
function openMagic() {
  if (busy()) return;
  const p = G.p;
  let h = `<div class="desc" style="margin-bottom:6px">MP ${p.mp}/${G.s.mmp} · Spell power ${spellPower()}</div>`;
  if (!p.spells.length) h += `<div class="desc">You know no spells yet. Gain levels or find spellbooks at the Mage Guild.</div>`;
  const sp = [...p.spells].sort((a, b) => SPELLS[a].tier - SPELLS[b].tier);
  for (const s of sp) { const S = SPELLS[s]; h += `<div class="row ${p.mp < S.mp ? 'dis' : ''}" data-i="${s}"><div class="ic">${S.ic}</div><div class="nm"><div>${S.n}</div><div>${S.desc}</div></div><div class="pr" style="color:#8af">${S.mp}</div></div>`; }
  const mb = sheet('Spells', h);
  bind(mb, '.row', s => {
    const S = SPELLS[s];
    const body = `<div class="big">${S.ic}</div><div style="text-align:center;font-weight:700;font-size:17px;color:#c9f">${S.n}</div><div class="desc" style="text-align:center">Tier ${S.tier} · ${S.mp} MP<br>${S.desc}${S.d ? `<br>Damage ≈ ${Math.round(S.d[0] * (1 + spellPower() * 0.06))}–${Math.round(S.d[1] * (1 + spellPower() * 0.06))}` : ''}</div><div class="btns"><button class="btn pri" data-a="cast">Cast</button><button class="btn" data-a="q">Put on quickbar</button></div>`;
    const mb2 = sheet('Spell', body, null, openMagic);
    mb2.querySelector('[data-a=cast]').onclick = () => { closeModal(); if (S.tgt) { if (p.mp < S.mp) { msg('Not enough mana.', '#88f'); UI.refresh(); return; } targetWith(`Tap a target for ${S.n}`, m => castSpell(s, m)); } else act(() => castSpell(s, null)); };
    mb2.querySelector('[data-a=q]').onclick = () => pickQuickSlot({ t: 'spell', id: s }, openMagic);
  });
}
UI.pickItem = (title, filter, cb) => {
  const p = G.p;
  let h = '';
  p.inv.forEach((it, i) => { if (filter(it)) h += itemRow(it, i); });
  if (!h) h = '<div class="desc">Nothing suitable.</div>';
  const mb = sheet(title, h);
  bind(mb, '.row', i => { const it = p.inv[+i]; closeModal(); cb(it); UI.refresh(); });
};
function openMap() {
  if (busy()) return;
  const L = lvl();
  const mb = sheet(levelName(G.loc) + ' — Map', `<canvas id="mapc" style="width:100%;border-radius:8px;background:#000"></canvas><div class="desc" style="margin-top:8px;font-size:12px">🟡 you · 🔴 monsters · ▼ stairs down · ▲ up · ◆ items</div>`);
  const c = $('mapc'); const w = mb.clientWidth - 28; const s = Math.floor(w / L.w);
  c.width = L.w * s; c.height = L.h * s; c.style.width = (L.w * s) + 'px';
  const x = c.getContext('2d');
  for (let yy = 0; yy < L.h; yy++) for (let xx = 0; xx < L.w; xx++) {
    const i = yy * L.w + xx; if (!L.seen[i]) continue; const t = L.t[i];
    x.fillStyle = { '#': '#4a4037', '.': '#2a2420', '+': '#8a5a2a', "'": '#8a5a2a', '>': '#d8b34a', '<': '#7fb0e0', ',': '#2b4520', '=': '#6e5c40', 'T': '#1c3014', 'M': '#555', 'B': '#7a2f22', 'S': '#d8b34a', 'f': '#2b4520', '~': '#2a5a8a', 'E': '#d8b34a', 'Y': '#6ef', 'P': '#aaa', 'G': '#888', '&': '#6ef', 'R': '#aaa', 'O': '#888', 'J': '#c8a040' }[t] || '#333';
    if (!G.vis[i] && !L.town) x.globalAlpha = 0.7; x.fillRect(xx * s, yy * s, s, s); x.globalAlpha = 1;
  }
  for (const fi of L.items) if (L.seen[idx(fi.x, fi.y)]) { x.fillStyle = '#6af'; x.fillRect(fi.x * s + s * 0.25, fi.y * s + s * 0.25, s * 0.5, s * 0.5); }
  for (const m of L.mons) if (G.vis[idx(m.x, m.y)] || G.detectT) { x.fillStyle = '#e33'; x.beginPath(); x.arc(m.x * s + s / 2, m.y * s + s / 2, s * 0.45, 0, 6.28); x.fill(); }
  x.fillStyle = '#ff0'; x.beginPath(); x.arc(G.p.x * s + s / 2, G.p.y * s + s / 2, s * 0.6, 0, 6.28); x.fill();
  // tap map to travel
  c.onclick = e => { const r = c.getBoundingClientRect(); const tx = Math.floor((e.clientX - r.left) / r.width * L.w), ty = Math.floor((e.clientY - r.top) / r.height * L.h); closeModal(); onTap(tx, ty); };
}
function showLog() {
  if (busy()) return;
  sheet('Message log', G.msgs.slice(-80).reverse().map(m => `<div style="color:${m.c};padding:3px 0;border-bottom:1px solid #2a231d;font-size:14px">${esc(m.t)}</div>`).join(''));
}
function charSheet() {
  const p = G.p, s = G.s;
  const w = weaponOf('weapon'), bw = weaponOf('bow');
  const meleeDmg = w ? `${w.B.dmg[0] + (w.s.dmg || 0) + s.dmg + Math.floor((s.str - 10) / 2)}–${w.B.dmg[1] + (w.s.dmg || 0) + s.dmg + Math.floor((s.str - 10) / 2)}` : '1–3';
  const row = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
  return `<div class="statgrid">${row('Level', p.lvl)}${row('XP', `${p.xp}/${xpNext(p.lvl)}`)}
  ${STATS4.map(k => row(STAT_NAME[k], s[k] + (p.drain[k] ? ` <span style="color:#c8f">(-${p.drain[k]})</span>` : ''))).join('')}
  ${row('Armor', s.ac)}${row('Melee dmg', meleeDmg)}${row('Bow', bw ? bw.B.n : '—')}${row('Arrows', arrowsItem() ? arrowsItem().q : 0)}
  ${row('Fire res', s.rFire + '%')}${row('Cold res', s.rCold + '%')}${row('Shock res', s.rShock + '%')}${row('Speed', '+' + s.speed + '%')}
  ${row('Light', s.light)}${row('Gold find', '+' + s.gold + '%')}${row('Kills', G.kills)}${row('Deepest', G.deep2 ? 'Shadowdeep ' + G.deep2 : 'Barrow ' + G.maxDepth)}${row('Captives freed', (G.quest.freed || 0) + '/10')}</div>`;
}
function openMenu() {
  if (busy()) return;
  const q = G.quest;
  const goal = q.won2 ? 'You freed Eldermere. You are a legend of the North — keep exploring!' : q.circle ? `Free the captives of the Shadowdeep (${q.freed || 0}/10) and reach level 40 (now ${G.p.lvl}). Then see Elder Maren in Eldermere.` : q.won ? `Head west into the Ironwood. Recover the 4 stolen relics (${['sun', 'moon', 'raven', 'wolf'].filter(r => G.quest['relic_' + r]).length}/4 found) and solve the Stone Circle.` : q.won ? 'Victory! The Storm Crown is restored. Keep exploring if you like.' : q.crown ? 'Bring the Storm Crown to Jarl Eirik in Ravensfjord!' : !q.met ? 'Visit Jarl Eirik in his hall at the bottom of the village.' : q.troll && !q.trollPaid ? 'Grimtusk is dead — collect your reward from the Jarl.' : !q.troll ? 'Slay Grimtusk the Troll King (Barrow level 5).' : 'Descend to level 10 and defeat Hrimfang the Frost Jarl.';
  const h = `<div class="sec">Quest</div><div class="desc">📜 ${goal}</div><div class="sec">${esc(G.name)} the ${CLASSES[G.cls].n}${G.hard ? ' · Hardcore' : ''}</div>${charSheet()}
  <div class="btns"><button class="btn" data-a="snd">${SFX.on ? '🔊 Sound on' : '🔇 Sound off'}</button><button class="btn" data-a="help">❓ How to play</button><button class="btn pri" data-a="save">💾 Save / Load</button><button class="btn red" data-a="quit">🚪 Title screen</button></div>`;
  const mb = sheet('Menu', h);
  mb.querySelectorAll('[data-a]').forEach(el => el.onclick = () => {
    const a = el.dataset.a;
    if (a === 'snd') { SFX.toggle(); el.textContent = SFX.on ? '🔊 Sound on' : '🔇 Sound off'; }
    if (a === 'help') showHelp(openMenu);
    if (a === 'save') { saveGame(); openSaves(false, openMenu); }
    if (a === 'quit') { saveGame(); closeModal(); showTitle(); }
  });
}
function showHelp(back) {
  sheet('How to play', `<div class="desc">
  <b>Goal:</b> Ravensfjord is plagued by the creatures of the old Barrow. Slay Grimtusk the Troll King on level 5, then descend to level 10 and take the Storm Crown from Hrimfang the Frost Jarl.<br><br>
  <b>Move:</b> tap any tile to walk there. Swipe for a single step. Keyboard: arrows / WASD / numpad.<br>
  <b>Fight:</b> tap an adjacent foe to strike. With a bow and arrows, tap a distant foe to shoot.<br>
  <b>Examine:</b> long-press anything.<br>
  <b>Quickbar:</b> tap to use (spells and wands auto-target the nearest foe). Long-press a slot to change it.<br>
  <b>🧭 Explore</b> walks you through the level automatically and stops when a foe appears.<br>
  <b>⏳ Rest</b> heals and searches for traps until something shows up. Tapping yourself waits one turn and searches.<br>
  <b>Shops:</b> tap a building door in town.<br>
  <b>Loot:</b> <span style="color:#6af">Magic</span>, <span style="color:#fd4">Rare</span> and <span style="color:#f93">Legendary</span> gear. Unknown items reveal themselves when equipped, but cursed gear sticks. Potions and scrolls are identified when used.<br>
  <b>Death:</b> normally you wake in the Temple and lose half your gold. In Hardcore mode, death is permanent.<br>
  Progress saves automatically on this device.</div>`, null, back);
}

// ===================== TOWN BUILDINGS =====================
UI.openShop = id => {
  UI.stopRun();
  if (id === 'temple') return openTemple();
  if (id === 'sage') return openSage();
  if (id === 'tavern') return openTavern();
  if (id === 'jarl') return openJarl();
  if (id === 'lodge') return openLodge();
  openStore(id, 'buy');
};
function openStore(id, tab) {
  const info = shopInfo(id), p = G.p;
  const stock = shopsHere()[id] || [];
  let h = `<div class="desc" style="margin-bottom:8px">${info.who} · You have <b style="color:#f3d58a">💰 ${p.gold}</b></div><div class="tabs"><button data-t="buy" class="${tab === 'buy' ? 'on' : ''}">Buy</button><button data-t="sell" class="${tab === 'sell' ? 'on' : ''}">Sell</button>${SERV_NAME[id] ? `<button data-t="serv" class="${tab === 'serv' ? 'on' : ''}">${SERV_NAME[id]}</button>` : ''}</div>`;
  if (tab === 'serv') return openServices(id, h);
  if (tab === 'buy') {
    if (!stock.length) h += `<div class="desc">Sold out. Come back after your next trip below.</div>`;
    stock.forEach((it, i) => { const pr = stackKey(it) && it.k !== 'arrows' ? Math.round(buyPrice(it) / it.q) + ' ea' : buyPrice(it); h += itemRow(it, i, `<div class="pr">${pr}</div>`).replace('class="row"', `class="row ${p.gold < (typeof pr === 'number' ? pr : parseInt(pr)) ? 'dis' : ''}"`); });
  } else {
    const buys = SHOP_BUYS[id] || (() => true);
    h += `<div class="desc" style="margin-bottom:6px;font-size:13px;color:#a89a88">${id === 'general' ? 'Gudrun buys anything — but pays less than the specialists.' : `${info.who.split(' ')[0]} only buys ${SHOP_BUYS_TXT[id]}.`}</div>`;
    let any = false;
    p.inv.forEach((it, i) => { if (!buys(it) || (BASES[it.b] && BASES[it.b].quest)) return; any = true; h += itemRow(it, i, `<div class="pr">${sellPrice(it, id)}</div>`); });
    if (!any) h += `<div class="desc">You have nothing ${id === 'general' ? '' : 'this shop wants '}to sell.${id === 'general' ? '' : ' The General Store buys everything else.'}</div>`;
    const junk = junkFor(id), tot = junk.reduce((a, it) => a + sellPrice(it, id), 0);
    h = h.replace('<div class="tabs">', `<div class="btns" style="margin:0 0 10px"><button class="btn pri" id="sellCommon" ${junk.length ? '' : 'disabled'}>${junk.length ? `🧹 Sell junk (${junk.length}) · ${tot}g` : '🧹 No junk to sell here'}</button></div><div class="tabs">`);
  }
  const mb = sheet(`${info.ic} ${info.n}`, h);
  mb.querySelectorAll('[data-t]').forEach(b => b.onclick = () => openStore(id, b.dataset.t));
  if ($('sellCommon')) $('sellCommon').onclick = () => { for (const it of junkFor(id)) sell(id, it, true); saveGame(); openStore(id, 'sell'); };
  bind(mb, '.row', i => {
    const it = tab === 'buy' ? stock[+i] : p.inv[+i];
    const stack = stackKey(it) && it.k !== 'arrows' && it.q > 1;
    let body = `<div class="big">${itemIcon(it, 72)}</div><div style="text-align:center;font-weight:700;font-size:17px;color:${itemColor(it)}">${esc(itemName(it))}</div><div class="desc" style="margin-top:8px">${itemDesc(it)}</div>${tab === 'buy' ? compareHtml(it) : ''}<div class="btns">`;
    if (tab === 'buy') {
      const unit = stack ? Math.round(buyPrice(it) / it.q) : buyPrice(it);
      body += `<button class="btn pri" data-q="1" ${p.gold < unit ? 'disabled' : ''}>Buy${stack ? ' 1' : ''} · ${unit}g</button>`;
      if (stack && it.q >= 3) body += `<button class="btn" data-q="3" ${p.gold < unit * 3 ? 'disabled' : ''}>Buy 3 · ${unit * 3}g</button>`;
    } else {
      const isStack = it.q > 1 && it.k !== 'arrows';
      body += `<button class="btn pri" data-q="s">Sell${isStack ? ' 1' : ''} · ${isStack ? Math.max(1, Math.round(sellPrice(it, id) / it.q)) : sellPrice(it, id)}g</button>`;
      if (isStack) body += `<button class="btn" data-q="sa">Sell all ${it.q} · ${sellPrice(it, id)}g</button>`;
    }
    body += `</div>`;
    const mb2 = sheet(`${info.ic} ${info.n}`, body, null, () => openStore(id, tab));
    mb2.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      const q = b.dataset.q;
      if (q === 's') sell(id, it); else if (q === 'sa') sell(id, it, true); else buy(id, it, +q);
      saveGame(); openStore(id, tab);
    });
  });
}
function openTemple() {
  const p = G.p, s = G.s;
  const healCost = (p.hp < s.mhp || p.st.poison) ? 5 + p.lvl * 3 : 0;
  const cursed = EQ_SLOTS.filter(sl => p.equip[sl] && p.equip[sl].cursed);
  const curseCost = 40 + shopLevel(K(G.loc)) * 15;
  const drained = STATS4.some(k => p.drain[k]);
  const restoreCost = 60 + p.lvl * 8;
  let h = `<div class="desc">${shopInfo('temple').who}: <i>"Odin watches over all who fight in the dark below."</i><br>You have <b style="color:#f3d58a">💰 ${p.gold}</b></div><div class="btns" style="flex-direction:column">`;
  h += `<button class="btn ${healCost ? 'pri' : ''}" data-a="heal" ${healCost && p.gold < healCost ? 'disabled' : ''}>💚 Healing & cure poison${healCost ? ' · ' + healCost + 'g' : ' (you are healthy)'}</button>`;
  h += `<button class="btn" data-a="curse" ${!cursed.length || p.gold < curseCost ? 'disabled' : ''}>✨ Remove curses${cursed.length ? ' (' + cursed.length + ') · ' + curseCost + 'g' : ' (none)'}</button>`;
  h += `<button class="btn" data-a="restore" ${!drained || p.gold < restoreCost ? 'disabled' : ''}>⬆ Restore drained stats${drained ? ' · ' + restoreCost + 'g' : ' (none)'}</button>`;
  h += `<button class="btn" data-a="mana" ${p.mp >= s.mmp || p.gold < 10 + p.lvl * 2 ? 'disabled' : ''}>🔵 Restore mana · ${10 + p.lvl * 2}g</button></div>`;
  const mb = sheet('⛪ Temple of Odin', h);
  mb.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'heal' && healCost) { p.gold -= healCost; p.hp = s.mhp; p.st.poison = 0; msg('You are healed by the grace of Odin.', '#8f8'); SFX.heal(); }
    if (a === 'curse') { p.gold -= curseCost; for (const sl of cursed) { p.equip[sl].cursed = false; if (p.equip[sl].ench < 0) p.equip[sl].ench = 0; } msg('The curses are lifted.', '#ff8'); calc(); SFX.heal(); }
    if (a === 'restore') { p.gold -= restoreCost; for (const k of STATS4) p.drain[k] = 0; calc(); msg('Your strength returns.', '#8f8'); SFX.heal(); }
    if (a === 'mana') { p.gold -= 10 + p.lvl * 2; p.mp = s.mmp; msg('Your mind is refreshed.', '#88f'); SFX.heal(); }
    saveGame(); openTemple();
  });
}
function openSage() {
  const p = G.p;
  const un = p.inv.filter(it => !it.id || !isKnown(it));
  const cost = it => it.k === 'eq' ? 15 + (it.ilvl || 1) * 8 + it.rar * 20 : 20;
  const all = un.reduce((a, it) => a + cost(it), 0), allC = Math.round(all * 0.8);
  let h = `<div class="desc">${shopInfo('sage').who}: <i>"Bring me your mysteries, and coin."</i><br>You have <b style="color:#f3d58a">💰 ${p.gold}</b></div>`;
  if (!un.length) h += `<div class="desc" style="margin-top:10px">You carry nothing unidentified.</div>`;
  else h += `<div class="btns"><button class="btn pri" id="idall" ${p.gold < allC ? 'disabled' : ''}>Identify all (${un.length}) · ${allC}g</button></div><div class="sec">Or one at a time</div>`;
  un.forEach(it => h += itemRow(it, p.inv.indexOf(it), `<div class="pr">${cost(it)}</div>`));
  const mb = sheet('🦉 The Sage', h);
  if ($('idall')) $('idall').onclick = () => { p.gold -= allC; for (const it of un) identifyItem(it); calc(); saveGame(); openSage(); };
  bind(mb, '.row', i => { const it = p.inv[+i]; const c = cost(it); if (p.gold < c) { msg('Not enough gold.', '#f88'); return; } p.gold -= c; identifyItem(it); saveGame(); openSage(); });
}
function openTavern() {
  const p = G.p; const cost = 5 + shopLevel(K(G.loc)) * 2;
  let h = `<div class="desc">${shopInfo('tavern').who} slides a horn of mead your way. <i>"Heard any news? Here's some..."</i><br><br>🍺 <i>"${pick(K(G.loc) === 't2' ? RUMORS2 : RUMORS)}"</i></div>`;
  h += `<div class="btns"><button class="btn pri" id="tstash" style="flex-basis:100%">📦 Storage locker (${(G.stash || []).length}/${MAX_STASH})</button><button class="btn" id="ttrain" style="flex-basis:100%">🏋️ Train with the old champion · ${trainCost()}g</button><button class="btn" id="trest" ${p.gold < cost ? 'disabled' : ''}>🛏️ Rent a bed (full HP & MP) · ${cost}g</button><button class="btn" id="trum">🗣️ Another rumor</button></div>`;
  sheet(K(G.loc) === 't2' ? '🍺 The Drowned Oar' : '🍺 Mead Hall Tavern', h);
  $('trest').onclick = () => { p.gold -= cost; p.hp = G.s.mhp; p.mp = G.s.mmp; p.st.poison = 0; G.turn += 50; msg('You sleep soundly and wake refreshed.', '#8f8'); SFX.heal(); saveGame(); closeModal(); };
  $('trum').onclick = openTavern;
  $('tstash').onclick = () => openStash('pack');
  $('ttrain').onclick = () => {
    const c = trainCost();
    let h2 = `<div class="desc">A scarred old champion will drill you until it sticks. Each session permanently raises one attribute by 1. Every session costs more than the last.<br><br>Cost: <b style="color:#f3d58a">${c}g</b> · You have 💰 ${p.gold} · Sessions so far: ${G.trained || 0}</div><div class="btns">`;
    for (const k of STATS4) h2 += `<button class="btn" data-st="${k}" ${p.gold < c ? 'disabled' : ''}>+1 ${STAT_NAME[k]} (${p[k]})</button>`;
    const mb2 = sheet('🏋️ Training', h2 + '</div>', null, openTavern);
    bind(mb2, '[data-st]', (_, el) => { if (trainStat(el.dataset.st)) { saveGame(); $('ttrain') ; $('modal').classList.remove('on'); openTavern(); document.getElementById('ttrain').click(); } });
  };
}
function openJarl() {
  const q = G.quest, p = G.p;
  let h = '';
  const crown = p.inv.find(i => i.k === 'eq' && i.b === 'crown') || (p.equip.helm && p.equip.helm.b === 'crown' ? p.equip.helm : null);
  if (q.won) h = `<div class="desc">Jarl Eirik: <i>"Hail, ${esc(G.name)}, Storm-King of Ravensfjord! But I have new grief: bandits from the Ironwood stole the four relics of the Stone Circle. Beyond that circle lies Eldermere, and they have not been heard from in a year. Take the western road."</i></div>`;
  else if (crown) {
    h = `<div class="desc">Jarl Eirik rises from his seat as you raise the crown. Thunder rolls over the fjord.<br><br><i>"The Storm Crown! Hrimfang is truly dead? Then the winter is broken. Ravensfjord owes you everything."</i></div><div class="btns"><button class="btn pri" id="jwin">👑 Present the crown</button></div>`;
  } else if (!q.met) {
    h = `<div class="desc">Jarl Eirik, grey-bearded and tired, looks up from a map of the old Barrow.<br><br><i>"Another sword-arm? Good. Our mine became the Barrow when the dead woke. Grimtusk, a troll who calls himself king, nests five levels down. Kill him and I will pay 500 gold. Below him — at the tenth level — Hrimfang the Frost Jarl holds the Storm Crown of my ancestors. Bring it back and you will be a legend."</i></div><div class="btns"><button class="btn pri" id="jok">I will do it</button></div>`;
  } else if (q.troll && !q.trollPaid) {
    h = `<div class="desc"><i>"Grimtusk's head! Ha! Here — 500 gold, and a blade from my own armory. Now... the crown."</i></div><div class="btns"><button class="btn pri" id="jpay">Take reward</button></div>`;
  } else if (!q.troll) h = `<div class="desc"><i>"Grimtusk still lives on the fifth level. Trolls heal fast — fire stops that. Go well."</i></div>`;
  else h = `<div class="desc"><i>"Hrimfang waits on the tenth level. Frost will not touch him; bring fire and courage. And potions. Many potions."</i></div>`;
  sheet('🏰 Jarl\'s Hall', h);
  if ($('jok')) $('jok').onclick = () => { q.met = 1; msg('Quest: slay Grimtusk (level 5), then take the Storm Crown from Hrimfang (level 10).', '#fd4'); saveGame(); openJarl(); };
  if ($('jpay')) $('jpay').onclick = () => { q.trollPaid = 1; p.gold += 500; const it = makeEquip(pick(['lsword', 'baxe', 'whammer', 'rstaff', 'lbow']), 7, { rar: 2, noCurse: 1 }); it.id = true; if (!addInv(it)) lvl().items.push({ x: p.x, y: p.y, it }); msg(`The Jarl gives you 500 gold and ${itemName(it)}!`, '#fd4'); SFX.level(); saveGame(); openJarl(); };
  if ($('jwin')) $('jwin').onclick = () => { q.won = 1; G.won = true; saveGame(); closeModal(); showVictory(); };
}
function showVictory() {
  G.wonShown = true;
  sheet('👑 Chapter 1 complete!', `<div class="big">👑</div><div class="desc" style="text-align:center">The Storm Crown is home. The long winter over Ravensfjord breaks, and the skalds will sing of <b>${esc(G.name)} the ${CLASSES[G.cls].n}</b> for a hundred years.<br><br>Level ${G.p.lvl} · ${G.kills} foes slain · ${G.turn} turns · ${G.deaths} deaths${G.hard ? ' · Hardcore!' : ''}<br><br>Chapter 2 awaits: the Jarl has news, and the western road to the Ironwood is now open.</div>`);
  SFX.level();
}

// ===================== LEVEL UP =====================
function openLevelUp() {
  if (!G.pendingLvl || $('modal').classList.contains('on')) return;
  const p = G.p;
  let h = `<div class="desc" style="text-align:center">You are now level <b style="color:#f3d58a">${p.lvl - G.pendingLvl + 1}</b>. Choose one attribute to raise:</div><div class="btns">`;
  for (const k of STATS4) h += `<button class="btn" data-s="${k}">+1 ${STAT_NAME[k]} (${p[k]})</button>`;
  h += `</div>`;
  const mb = sheet('⭐ Level up!', h);
  bind(mb, '[data-s]', (_, el) => { p[el.dataset.s]++; calc(); chooseSpell(); });
}
function chooseSpell() {
  const p = G.p;
  const maxTier = 1 + Math.floor((p.lvl + (G.cls === 'mage' ? 2 : 0)) / 2.5);
  const opts = shuffle(Object.keys(SPELLS).filter(k => !p.spells.includes(k) && SPELLS[k].tier <= maxTier)).slice(0, G.cls === 'warrior' ? 2 : 3);
  let h = `<div class="desc" style="text-align:center">Choose a new ability:</div>`;
  for (const s of opts) h += `<div class="row" data-i="${s}"><div class="ic">${SPELLS[s].ic}</div><div class="nm"><div>${SPELLS[s].n} <span style="color:#8af">${SPELLS[s].mp} MP</span></div><div>${SPELLS[s].desc}</div></div></div>`;
  h += `<div class="row" data-i="_hp"><div class="ic">❤️</div><div class="nm"><div>Toughness training</div><div>+${G.cls === 'warrior' ? 8 : 5} max HP permanently.</div></div></div>`;
  if (G.cls !== 'warrior') h += `<div class="row" data-i="_mp"><div class="ic">🔷</div><div class="nm"><div>Arcane study</div><div>+${G.cls === 'mage' ? 6 : 4} max MP permanently.</div></div></div>`;
  const mb = sheet('⭐ Level up!', h);
  $('mx').style.display = 'none';
  bind(mb, '.row', s => {
    if (s === '_hp') { p.baseHp += G.cls === 'warrior' ? 8 : 5; }
    else if (s === '_mp') { p.baseMp += G.cls === 'mage' ? 6 : 4; }
    else { p.spells.push(s); msg(`You learn ${SPELLS[s].n}!`, '#c9f'); const free = G.quick.findIndex(q => !q); if (free >= 0) G.quick[free] = { t: 'spell', id: s }; }
    G.pendingLvl--; calc(); p.hp = G.s.mhp; p.mp = G.s.mmp; saveGame(); closeModal();
  });
}

// ===================== DEATH / GAME OVER =====================
UI.deathNotice = (src, lost) => {
  sheet('💀 You have fallen', `<div class="big">⚰️</div><div class="desc" style="text-align:center">Slain by ${esc(src)}.<br><br>The Valkyries decide it is not yet your time. You awaken in the Temple of Odin, healed — but ${lost} gold is gone, the price of your return.</div>`);
};
UI.gameOver = () => {
  const d = G.dead;
  sheet('💀 Rest in Valhalla', `<div class="big">⚰️</div><div class="desc" style="text-align:center"><b>${esc(G.name)} the ${CLASSES[G.cls].n}</b><br>Slain by ${esc(d.src)} on ${DEPTH_NAME(d.depth)}.<br>Level ${d.lvl} · ${d.kills} kills · ${d.turn} turns<br><br>Hardcore death is permanent.</div><div class="btns"><button class="btn pri" id="again">New hero</button></div>`, () => showTitle());
  $('again').onclick = () => { closeModal(); };
};
UI.onLevelChange = () => { UI.cam = null; UI.targeting = null; };

// ===================== TITLE =====================
let selCls = 'warrior';
function showTitle() {
  G = null;
  $('title').classList.remove('hidden');
  const can = hasSave();
  Saves.titleShown = true;
  let h = `<h1>STORMHOLD</h1><div class="sub">A roguelike of the North · in the spirit of Castle of the Winds</div><div class="card">`;
  if (can) h += `<button class="btn pri" id="cont" style="width:100%;margin-bottom:10px">▶ Continue your adventure</button>`;
  h += `<button class="btn" id="loadg" style="width:100%;margin-bottom:18px">📂 Load a saved game</button><div class="sec">${can ? 'Or start a new hero' : 'New hero'}</div>`;
  h += `<input type="text" id="nm" maxlength="16" placeholder="Hero name" value="${esc(randName())}">`;
  for (const k in CLASSES) { const c = CLASSES[k]; h += `<button class="cls ${k === selCls ? 'on' : ''}" data-c="${k}"><img src="${heroDataURL(k)}" width="48" height="48" style="image-rendering:pixelated;flex:none" alt=""><div><b>${c.n}</b><p>${c.desc}</p></div></button>`; }
  h += `<label class="chk"><input type="checkbox" id="hc"> Hardcore (permadeath)</label><button class="btn pri" id="go" style="width:100%">⚔️ Begin${can ? ' (overwrites save)' : ''}</button></div>`;
  $('title').innerHTML = h;
  $('title').querySelectorAll('.cls').forEach(b => b.onclick = () => { selCls = b.dataset.c; $('title').querySelectorAll('.cls').forEach(x => x.classList.toggle('on', x === b)); });
  if ($('cont')) $('cont').onclick = () => { SFX.init(); if (loadGame()) startPlay(); };
  $('loadg').onclick = () => { SFX.init(); openSaves(true); };
  $('go').onclick = () => { SFX.init(); newGame($('nm').value.trim() || 'Hero', selCls, $('hc').checked); saveGame(); startPlay(); setTimeout(showIntro, 300); };
}
function randName() { return pick(['Sigrid', 'Bjorn', 'Astrid', 'Leif', 'Freydis', 'Ragnar', 'Ingrid', 'Halvar', 'Solveig', 'Torvald', 'Gunnhild', 'Erik']); }
function showIntro() {
  sheet('Ravensfjord', `<div class="desc">Winter has not ended in three years. The dead stir in the old Barrow beneath the mountain, and the villagers whisper that the Frost Jarl Hrimfang sits in the deep with the stolen Storm Crown.<br><br>You arrive with little more than your ${CLASSES[G.cls].n.toLowerCase()}'s kit and a single Scroll of Return.<br><br><b>Tips:</b> Visit the <b>Jarl's Hall</b> (bottom) for your quest, browse the shops, then head through the cave at the top of the village. Tap to move, long-press to examine, and use 🧭 Explore to auto-walk.</div><div class="btns"><button class="btn pri" id="ok">Let's go</button></div>`);
  $('ok').onclick = closeModal;
}
function startPlay() {
  $('title').classList.add('hidden'); Saves.titleShown = false;
  UI.cam = null; UI.run = null; UI.targeting = null; FX.list = [];
  resize(); fov(); UI.refresh();
  if (G.pendingLvl) setTimeout(openLevelUp, 300);
}

window.addEventListener('load', () => {
  setupInput(); resize(); showTitle(); requestAnimationFrame(frame); Saves.init();
  document.addEventListener('visibilitychange', () => { if (document.hidden && G) saveGame(); });
});

// ===================== SAVE SLOTS =====================
const Saves = {
  db: null, uid: null, cloud: false, titleShown: false, lastCloud: 0, pending: null,
  async init() {
    try {
      if (!window.claude || typeof window.claude.use !== 'function') return;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const id = await user.id(); if (!id) return;
      this.db = db; this.uid = id; this.cloud = true;
      if (this.onReady) this.onReady();
    } catch (e) { this.cloud = false; }
  },
  ref(slot) { return this.db.collection('data/users/' + this.uid).doc('stormhold_' + slot); },
  async pack(str) {
    try {
      if (typeof CompressionStream === 'undefined') return str;
      const cs = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
      const buf = new Uint8Array(await new Response(cs).arrayBuffer());
      let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return 'gz:' + btoa(bin);
    } catch (e) { return str; }
  },
  async unpack(str) {
    str = (str || '').trim();
    if (!str.startsWith('gz:')) return str;
    const bin = atob(str.slice(3)); const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(ds).text();
  },
  localGet(slot) {
    if (slot === 'auto') { try { const raw = localStorage.getItem(SAVE_KEY), m = localStorage.getItem(SAVE_KEY + '_meta'); return raw ? { meta: m ? JSON.parse(m) : { name: '?', lvl: '?', at: 0 }, data: raw } : null; } catch (e) { return null; } }
    try { const d = localStorage.getItem('stormhold_slot_' + slot); return d ? JSON.parse(d) : null; } catch (e) { return null; } },
  localPut(slot, rec) { try { localStorage.setItem('stormhold_slot_' + slot, JSON.stringify(rec)); return true; } catch (e) { return false; } },
  async cloudGet(slot) {
    if (!this.cloud) return null;
    try { const snap = await this.ref(slot).get(); if (!snap) return null; const v = typeof snap.data === 'function' ? snap.data() : snap; return v && v.data ? v : null; } catch (e) { return null; }
  },
  async get(slot) { // newest of cloud and local
    const [c, l] = [await this.cloudGet(slot), this.localGet(slot)];
    if (c && l) return (c.meta.at || 0) >= (l.meta.at || 0) ? c : l;
    return c || l;
  },
  async put(slot) {
    const rec = { meta: saveMeta(), data: await this.pack(serializeGame()) };
    const okL = this.localPut(slot, rec);
    let okC = false;
    if (this.cloud) { try { await this.ref(slot).set(rec); okC = true; } catch (e) { okC = false; } }
    return { okL, okC };
  },
  async remove(slot) { try { localStorage.removeItem('stormhold_slot_' + slot); } catch (e) { } if (this.cloud) { try { await this.ref(slot).delete(); } catch (e) { } } },
  autoCloud() { // throttle cloud autosaves: at most every 20 s
    if (!this.cloud || !G || G.dead) return;
    const now = Date.now();
    if (now - this.lastCloud < 20000) { if (!this.pending) this.pending = setTimeout(() => { this.pending = null; this.autoCloud(); }, 20000 - (now - this.lastCloud)); return; }
    this.lastCloud = now; this.put('auto').catch(() => { });
  },
  async load(rec) { const raw = await this.unpack(rec.data); deserializeGame(raw); saveGame(); },
};
const SLOT_NAMES = { auto: 'Autosave', s1: 'Slot 1', s2: 'Slot 2', s3: 'Slot 3' };
function fmtMeta(m) {
  if (!m) return '<span style="color:#6a5d50">Empty</span>';
  const d = new Date(m.at);
  return `${esc(m.name)} · Lv ${m.lvl} ${CLASSES[m.cls] ? CLASSES[m.cls].n : ''}${m.hard ? ' (HC)' : ''} · ${m.depth ? 'Barrow ' + m.depth : 'Village'}<br><span style="color:#8a7d6e">${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>`;
}
async function openSaves(fromTitle, back) {
  const where = Saves.cloud ? '☁️ Slots are saved to your Claude account. For a copy that needs no account, use a save file below.' : '📱 Slots are saved in this browser. To keep a copy or move to another device, download a save file below.';
  const mb = sheet('💾 Save & Load', `<div class="desc" style="font-size:13px">${where}</div><div id="slots"><div class="desc" style="margin-top:12px">Loading saves…</div></div>`, null, back);
  $('modal').style.zIndex = 40;
  const recs = {};
  for (const k of Object.keys(SLOT_NAMES)) recs[k] = await Saves.get(k);
  if (!$('slots')) return;
  const hard = G && G.hard && !fromTitle;
  let h = '';
  for (const k of Object.keys(SLOT_NAMES)) {
    const r = recs[k];
    const canSave = G && !fromTitle && k !== 'auto' && !hard;
    h += `<div class="row" style="align-items:flex-start"><div class="ic">${k === 'auto' ? '🔄' : '💾'}</div><div class="nm"><div>${SLOT_NAMES[k]}</div><div>${fmtMeta(r && r.meta)}</div></div>
      <div style="display:flex;flex-direction:column;gap:6px">${canSave ? `<button class="btn pri" style="min-height:38px;padding:4px 12px" data-save="${k}">Save</button>` : ''}${r && !hard ? `<button class="btn" style="min-height:38px;padding:4px 12px" data-load="${k}">Load</button>` : ''}</div></div>`;
  }
  if (hard) h += `<div class="desc" style="margin-top:8px;color:#e99">Hardcore heroes can't use save slots — the game autosaves as you play.</div>`;
  h += `<div class="sec">Save file — no account needed</div><div class="desc" style="font-size:13px">Download your game as a small file to keep on your phone, cloud drive or computer. Load it here (or in any copy of Stormhold) to pick up where you left off.</div><div class="btns">${G && !fromTitle && !hard ? '<button class="btn pri" id="dlsave">⬇️ Download save file</button>' : ''}<button class="btn" id="ulsave">📂 Load save file</button></div><input type="file" id="ulfile" accept=".txt,.json,.stormhold,text/plain" style="display:none"><div id="filemsg"></div>`;
  h += `<div class="sec">Backup code</div><div class="desc" style="font-size:13px">Copy a code of your current game to keep somewhere safe, or paste one to restore it.</div><div class="btns">${G && !fromTitle && !hard ? '<button class="btn" id="exp">📋 Copy backup code</button>' : ''}<button class="btn" id="imp">📥 Restore from code</button></div><div id="codebox"></div>`;
  $('slots').innerHTML = h;
  const status = t => { const d = document.createElement('div'); d.className = 'desc'; d.style.cssText = 'color:#8f8;margin-top:8px'; d.textContent = t; $('slots').prepend(d); };
  mb.querySelectorAll('[data-save]').forEach(b => b.onclick = async () => {
    const k = b.dataset.save;
    if (recs[k] && !b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Overwrite?'; b.classList.add('red'); return; }
    b.disabled = true; b.textContent = 'Saving…';
    const r = await Saves.put(k);
    msg(r.okC ? `Game saved to ${SLOT_NAMES[k]} (cloud).` : r.okL ? `Game saved to ${SLOT_NAMES[k]} on this device.` : 'Save failed!', r.okC || r.okL ? '#8f8' : '#f88');
    openSaves(false, back);
  });
  mb.querySelectorAll('[data-load]').forEach(b => b.onclick = async () => {
    if (G && !fromTitle && !b.dataset.sure) { b.dataset.sure = 1; b.textContent = 'Sure?'; b.classList.add('red'); return; }
    b.disabled = true; b.textContent = 'Loading…';
    try { await Saves.load(recs[b.dataset.load]); closeModal(); startPlay(); msg(`Loaded ${SLOT_NAMES[b.dataset.load]}.`, '#8f8'); UI.refresh(); }
    catch (e) { b.textContent = 'Failed'; }
  });
  const fmsg = (t, ok) => { $('filemsg').innerHTML = `<div class="desc" style="margin-top:6px;color:${ok ? '#8f8' : '#f99'}">${t}</div>`; };
  if ($('dlsave')) $('dlsave').onclick = async () => {
    const data = 'STORMHOLD SAVE v3\n' + (await Saves.pack(serializeGame())) + '\n';
    const fname = `stormhold-${(G.name || 'hero').replace(/[^a-z0-9]+/gi, '_')}-lv${G.p.lvl}.txt`;
    try {
      const dl = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null;
      if (dl) { await dl.save({ filename: fname, data }); fmsg('✓ Save file downloaded: ' + esc(fname), true); return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'text/plain' })); a.download = fname; document.body.appendChild(a); a.click(); a.remove();
      fmsg('✓ Save file downloaded: ' + esc(fname), true);
    } catch (e) { fmsg(e && e.code === 'declined' ? 'Download cancelled.' : 'Downloads aren\'t available here — use “Copy backup code” below instead.', false); }
  };
  $('ulsave').onclick = () => $('ulfile').click();
  $('ulfile').onchange = async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try {
      const txt = (await f.text()).replace(/^STORMHOLD SAVE v\d+\s*/, '').trim();
      const raw = await Saves.unpack(txt); deserializeGame(raw); saveGame();
      closeModal(); startPlay(); msg(`Loaded save file ${f.name}.`, '#8f8'); UI.refresh();
    } catch (err) { fmsg('That file isn\'t a Stormhold save (or it was damaged).', false); }
  };
  if ($('exp')) $('exp').onclick = async () => {
    const code = await Saves.pack(serializeGame());
    $('codebox').innerHTML = `<textarea readonly style="width:100%;height:90px;margin-top:8px;background:#111;color:#cfc;border:1px solid #54463a;border-radius:8px;font-size:11px;user-select:text;-webkit-user-select:text">${esc(code)}</textarea>`;
    const ta = $('codebox').querySelector('textarea'); ta.select();
    try { await navigator.clipboard.writeText(code); $('exp').textContent = '✓ Copied to clipboard'; } catch (e) { $('exp').textContent = 'Select the code above and copy it'; }
  };
  $('imp').onclick = () => {
    $('codebox').innerHTML = `<textarea id="codein" placeholder="Paste your backup code here" style="width:100%;height:90px;margin-top:8px;background:#111;color:#fff;border:1px solid #54463a;border-radius:8px;font-size:12px;user-select:text;-webkit-user-select:text"></textarea><div class="btns"><button class="btn pri" id="codego">Restore this game</button></div>`;
    $('codego').onclick = async () => {
      try { const raw = await Saves.unpack($('codein').value); deserializeGame(raw); saveGame(); closeModal(); startPlay(); msg('Game restored from backup code.', '#8f8'); UI.refresh(); }
      catch (e) { $('codego').textContent = 'That code didn\'t work — check it was copied fully'; }
    };
  };
}
Saves.onReady = () => {
  // a cloud autosave may be newer than this browser's (e.g. played on another device)
  if (Saves.titleShown && !hasSave()) Saves.get('auto').then(r => { if (r && Saves.titleShown) { Saves.load(r).then(() => { G = null; showTitle(); }).catch(() => { }); } });
};

// ===================== CHAPTER 2 DIALOGS =====================
UI.openPedestal = dir => {
  const L = lvl(), ped = L.ped[dir], p = G.p;
  const relics = p.inv.filter(i => i.k === 'relic');
  let h = `<div class="desc">The <b>${DIR_NAME[dir]}</b> pedestal. Its hollow is shaped to hold a relic.<br>Currently: ${ped.r ? `<b style="color:${RELICS[ped.r].col}">${RELICS[ped.r].n}</b>` : '<i>empty</i>'}</div>`;
  if (G.quest.circle) h += `<div class="desc" style="margin-top:8px;color:#fd4">The circle is complete. The gate stands open.</div>`;
  else {
    if (relics.length) { h += `<div class="sec">Place a relic</div>`; relics.forEach(it => h += itemRow(it, p.inv.indexOf(it))); }
    else if (!ped.r) h += `<div class="desc" style="margin-top:8px">You carry no relics. Cutpurses in the Ironwood have them.</div>`;
    if (ped.r) h += `<div class="btns"><button class="btn" id="takeR">Take back the ${RELICS[ped.r].n}</button></div>`;
  }
  const mb = sheet('🗿 Stone Pedestal', h);
  if (G.quest.circle) return;
  bind(mb, '.row', i => { placeRelic(dir, p.inv[+i]); closeModal(); UI.refresh(); });
  if ($('takeR')) $('takeR').onclick = () => { placeRelic(dir, null); closeModal(); UI.refresh(); };
};
UI.readTablet = () => {
  const have = ['sun', 'moon', 'raven', 'wolf'].map(r => `${RELICS[r].n}: ${G.quest['relic_' + r] ? '✔️ recovered' : '❌ stolen'}`).join('<br>');
  sheet('📜 The Carved Tablet', `<div class="desc"><i>Four gifts once rested in the circle, and four they must rest again:</i><br><br>
  ᚠ <i>"The Wolf howls opposite the dawn."</i><br>
  ᚱ <i>"The Raven roosts beside the Wolf, toward the cold."</i><br>
  ᛗ <i>"The Moon never rises."</i><br>
  ᛊ <i>"Only then will the Sun open the way."</i><br><br>
  <span style="color:#a89a88;font-size:13px">The pedestals stand North, East, South and West of the gate. Wrong placements anger the stones.</span><br><br>${have}</div>`);
};
function openLodge() {
  const q = G.quest, p = G.p;
  let h;
  if (q.won2) h = `<div class="desc">Elder Maren: <i>"Eldermere sings your name, ${esc(G.name)}. Every hearth is lit again."</i></div>`;
  else if (!q.met2) h = `<div class="desc">Elder Maren, tired and grey, rises from a table covered in names.<br><br><i>"You came through the Stone Circle? Then the old road lives. A year ago the Chain Cult took ten of our people into the Shadowdeep, beneath the hill. Every level has a Jailer who keeps the key to a cell. Their master, Malgrim the Chain Warden, holds the last captive at the very bottom.<br><br>Free all ten. And grow strong — they say only a hero of the fortieth rank could stand against Malgrim and live."</i></div><div class="btns"><button class="btn pri" id="lok">I will bring them home</button></div>`;
  else if ((q.freed || 0) >= 10 && p.lvl >= 40) h = `<div class="desc">The ten captives stand behind Maren, thin but alive. The whole town has gathered.<br><br><i>"You did it. Every one of them. Eldermere is free."</i></div><div class="btns"><button class="btn pri" id="lwin">🏆 Accept the town's thanks</button></div>`;
  else h = `<div class="desc">Elder Maren: <i>"${(q.freed || 0) >= 10 ? 'All ten are home! But the Cult will return unless you grow mightier still.' : 'Keep going. Each Jailer carries a key.'}"</i><br><br>Captives freed: <b>${q.freed || 0}/10</b><br>Your level: <b>${p.lvl}/40</b></div>`;
  sheet('🏛️ Warden\'s Lodge', h);
  if ($('lok')) $('lok').onclick = () => { q.met2 = 1; msg('Quest: free 10 captives in the Shadowdeep and reach level 40.', '#fd4'); saveGame(); openLodge(); };
  if ($('lwin')) $('lwin').onclick = () => { q.won2 = 1; saveGame(); closeModal(); SFX.level();
    sheet('🏆 Victory!', `<div class="big">🏆</div><div class="desc" style="text-align:center">Ravensfjord's winter is broken and Eldermere's people are home. <b>${esc(G.name)} the ${CLASSES[G.cls].n}</b>, level ${p.lvl}, is a legend of the North.<br><br>${G.kills} foes slain · ${G.turn} turns · ${G.deaths} deaths${G.hard ? ' · Hardcore!' : ''}<br><br>Keep exploring — there is always more loot below.</div>`); };
}

// ===================== STORAGE LOCKER =====================
function openStash(tab) {
  G.stash = G.stash || [];
  const p = G.p, st = G.stash;
  let h = `<div class="desc" style="font-size:13px;margin-bottom:8px">Shared between both taverns. Tap an item to move it.</div><div class="tabs"><button data-t="pack" class="${tab === 'pack' ? 'on' : ''}">Pack ${p.inv.length}/${MAX_INV}</button><button data-t="stash" class="${tab === 'stash' ? 'on' : ''}">Locker ${st.length}/${MAX_STASH}</button></div>`;
  const list = tab === 'pack' ? p.inv : st;
  if (!list.length) h += `<div class="desc">${tab === 'pack' ? 'Your pack is empty.' : 'The locker is empty.'}</div>`;
  list.forEach((it, i) => { if (it.k === 'relic' || it.k === 'key') return; h += itemRow(it, i, `<div class="pr">${tab === 'pack' ? '→📦' : '→🎒'}</div>`); });
  const mb = sheet('📦 Storage Locker', h, null, openTavern);
  mb.querySelectorAll('[data-t]').forEach(b => b.onclick = () => openStash(b.dataset.t));
  bind(mb, '.row', i => {
    const it = list[+i];
    if (tab === 'pack') { if (st.length >= MAX_STASH) { msg('The locker is full.', '#f88'); return; } p.inv.splice(+i, 1); const key = stackKey(it), ex = key && st.find(x => stackKey(x) === key); if (ex) ex.q += it.q; else st.push(it); }
    else { if (!addInv(it)) return; st.splice(+i, 1); }
    saveGame(); openStash(tab);
  });
}

// ===================== SHOP SERVICES =====================
const SERV_NAME = { smith: '✨ Enchant', armor: '✨ Enchant', mage: '🔮 Runes', general: '🎲 Crates' };
const ENCH_SLOTS = { smith: ['weapon', 'bow'], armor: ['armor', 'shield', 'helm', 'cloak', 'gloves', 'boots'] };
function openServices(id, head) {
  const p = G.p, info = shopInfo(id);
  let h = head;
  const eqRow = (sl, it, right, extra) => `<div class="row" data-sl="${sl}"><div class="ic">${itemIcon(it)}</div><div class="nm"><div style="color:${itemColor(it)}">${esc(itemName(it))}</div><div>${extra}</div></div>${right}</div>`;
  if (ENCH_SLOTS[id]) {
    h += `<div class="desc" style="font-size:13px;margin-bottom:6px">${info.who.split(' ')[0]} can hammer extra power into the gear you're <b>wearing</b>: +1 each time, up to +${MAX_ENCH}. Weapons gain to-hit and damage; armor gains Armor. It also breaks curses.</div>`;
    let any = false;
    for (const sl of ENCH_SLOTS[id]) {
      const it = p.equip[sl]; if (!it) continue; any = true;
      const maxed = it.ench >= MAX_ENCH, c = enchantCost(it);
      h += eqRow(sl, it, maxed ? `<div class="pr" style="color:#8a7d6e">MAX</div>` : `<div class="pr" style="${p.gold < c ? 'opacity:.45' : ''}">${c}</div>`, `${SLOT_LABEL[sl]} · ${maxed ? 'fully enchanted' : '→ +' + (Math.max(0, it.ench) + 1)}`);
    }
    if (!any) h += `<div class="desc">You aren't wearing anything ${id === 'smith' ? 'a weaponsmith' : 'an armorer'} can work on.</div>`;
  } else if (id === 'mage') {
    h += `<div class="desc" style="font-size:13px;margin-bottom:6px">Archmage-style runecarving on gear you're <b>wearing</b>:<br>🔄 <b>Reroll</b> — new random magic of the same rarity.<br>⬆️ <b>Imbue</b> — turn a Magic item into a Rare one.<br>Legendaries can't be changed. Enchantment (+N) is kept.</div>`;
    let any = false;
    for (const sl of EQ_SLOTS) {
      const it = p.equip[sl]; if (!it || it.uniq || BASES[it.b].quest || it.rar < 1) continue; any = true;
      const rc = rerollCost(it), ic = imbueCost(it);
      h += `<div class="row" style="flex-wrap:wrap"><div class="ic">${itemIcon(it)}</div><div class="nm"><div style="color:${itemColor(it)}">${esc(itemName(it))}</div><div>${SLOT_LABEL[sl]} · ${RAR_NAME[it.rar]}</div></div>
        <div style="display:flex;gap:6px;flex-basis:100%;margin-top:6px"><button class="btn" style="min-height:38px" data-rr="${sl}" ${p.gold < rc ? 'disabled' : ''}>🔄 Reroll · ${rc}g</button>${it.rar === 1 ? `<button class="btn pri" style="min-height:38px" data-im="${sl}" ${p.gold < ic ? 'disabled' : ''}>⬆️ Imbue · ${ic}g</button>` : ''}</div></div>`;
    }
    if (!any) h += `<div class="desc">Wear some Magic or Rare gear and I can work its runes.</div>`;
  } else if (id === 'general') {
    const c = gambleCost();
    h += `<div class="desc" style="font-size:13px;margin-bottom:10px">Sealed crates from caravans that never arrived. Each holds one piece of gear around item level ${gambleLevel()} — always <span style="color:#6af">Magic</span> or better, with a <span style="color:#fd4">28% Rare</span> and <span style="color:#f93">5% Legendary</span> chance. It arrives unidentified.</div>
      <div class="big">🎁</div><div class="btns"><button class="btn pri" id="gamble" ${p.gold < c ? 'disabled' : ''}>Buy a sealed crate · ${c}g</button></div><div id="gres"></div>`;
  }
  const mb = sheet(`${info.ic} ${info.n}`, h);
  mb.querySelectorAll('[data-t]').forEach(b => b.onclick = () => openStore(id, b.dataset.t));
  bind(mb, '[data-sl]', (_, el) => { const sl = el.dataset.sl, it = p.equip[sl]; if (it && enchantItem(it)) { saveGame(); openStore(id, 'serv'); } else if (it && it.ench < MAX_ENCH) msg('You can\'t afford that yet.', '#f88'); });
  mb.querySelectorAll('[data-rr]').forEach(b => b.onclick = () => { if (rerollItem(p.equip[b.dataset.rr])) { saveGame(); openStore(id, 'serv'); } });
  mb.querySelectorAll('[data-im]').forEach(b => b.onclick = () => { if (imbueItem(p.equip[b.dataset.im])) { saveGame(); openStore(id, 'serv'); } });
  if ($('gamble')) $('gamble').onclick = () => { const it = gambleItem(); if (it) { saveGame(); openStore(id, 'serv'); $('gres').innerHTML = `<div class="sec">You got</div>` + itemRow(it, G.p.inv.indexOf(it)); } };
}
