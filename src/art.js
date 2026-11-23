'use strict';
// ===================== PIXEL ART ENGINE =====================
const PX = 16; // art pixels per tile
const OUTLINE = '#120c0a';
function pcan(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function srand(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; }; }
function shade(hex, f) { // f<1 darker, f>1 lighter
  let h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f < 1) { r *= f; g *= f; b *= f; } else { r += (255 - r) * (f - 1); g += (255 - g) * (f - 1); b += (255 - b) * (f - 1); }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// ---------- sprites from templates ----------
const spriteCache = new Map();
function tplSprite(tpl, pal, flip, key) {
  const k = key + (flip ? '|f' : '');
  let c = spriteCache.get(k); if (c) return c;
  c = pcan(16, 16); const x = c.getContext('2d');
  tpl.forEach((row, yy) => { for (let xx = 0; xx < 16; xx++) { const ch = row[xx]; if (ch === '.') continue; x.fillStyle = ch === 'k' ? OUTLINE : (pal[ch] || '#f0f'); x.fillRect(flip ? 15 - xx : xx, yy, 1, 1); } });
  spriteCache.set(k, c); return c;
}
const MON_SPRITE_ID = { grimtusk: 'grimtusk', hrimfang: 'hrimfang' };
function monSprite(id, flip) {
  const P = MON_PAL[id] || MON_PAL.rat;
  return tplSprite(MON_TPL[P[0]], P[1], flip, 'm:' + id);
}
function monScale(id) { const P = MON_PAL[id]; return P ? P[2] : 1; }
function npcSprite(n, flip) { const id = { '🧑‍🌾': 'npc_farmer', '👵': 'npc_old', '🧒': 'npc_child', '🐕': 'npc_dog' }[n.ch] || 'npc_farmer'; return tplSprite(MON_TPL[MON_PAL[id][0]], MON_PAL[id][1], flip, 'm:' + id); }
const CROWN = ['k.k.k.k', 'kakakak', 'kaaaaak', 'kkkkkkk'];
function drawCrown(ctx, X, Y, s) { CROWN.forEach((r, yy) => [...r].forEach((ch, xx) => { if (ch === '.') return; ctx.fillStyle = ch === 'k' ? OUTLINE : '#f4c430'; ctx.fillRect(X + xx * s, Y + yy * s, s, s); })); }

// ---------- items ----------
const STEEL = { 1: '#c8d0d8', 2: '#7a8490', w: '#ffffff', 3: '#8a5428', 4: '#4a2a12', a: '#e0b040' };
const LEATHER = { 1: '#9a6232', 2: '#6a3e1c', w: '#c89060', 3: '#5a3418', 4: '#3a2210', a: '#c8a050' };
const ITEM_ART = {
  dagger: ['dagger', STEEL], ssword: ['sword', STEEL], lsword: ['sword', STEEL], gsword: ['sword', Object.assign({}, STEEL, { a: '#c84030' })], rblade: ['sword', Object.assign({}, STEEL, { 1: '#9ee0ff', 2: '#4a90c0', a: '#6ef' })],
  haxe: ['axe', STEEL], baxe: ['axe', Object.assign({}, STEEL, { 1: '#b8c0c8' })], mace: ['mace', STEEL], whammer: ['mace', Object.assign({}, STEEL, { 1: '#9aa2ac' })],
  spear: ['spear', STEEL], glaive: ['spear', Object.assign({}, STEEL, { 1: '#e0c070', 2: '#a08040' })],
  staff: ['staff', { 3: '#8a5428', 4: '#5a3418', a: '#6ad0ff', w: '#fff' }], rstaff: ['staff', { 3: '#5a3a6a', 4: '#3a2048', a: '#e070ff', w: '#fff' }],
  sbow: ['bow', { 3: '#8a5428', a: '#c8a050', w: '#ddd' }], lbow: ['bow', { 3: '#6a3e1c', a: '#c8a050', w: '#eee' }], ebow: ['bow', { 3: '#c8d8a0', a: '#7ad07a', w: '#fff' }],
  robe: ['robe', { 1: '#4a6ad0', 2: '#2a3a8a', w: '#8aa8ff', a: '#e0c040' }], padded: ['armor', Object.assign({}, LEATHER, { 1: '#b8a080', 2: '#8a7258' })], leather: ['armor', LEATHER], studded: ['armor', Object.assign({}, LEATHER, { w: '#ddd' })],
  chain: ['armor', STEEL], scale: ['armor', Object.assign({}, STEEL, { 1: '#a8b4a0', 2: '#6a7a60' })], email: ['armor', Object.assign({}, STEEL, { 1: '#d8f0e0', 2: '#8ab8a0', a: '#7ad07a' })],
  plate: ['armor', Object.assign({}, STEEL, { 1: '#d8dee4' })], rplate: ['armor', Object.assign({}, STEEL, { 1: '#a8c8e8', 2: '#5a7aa8', a: '#6ef' })],
  buckler: ['shield', { 1: '#8a5428', 2: '#5a3418', w: '#c89060', a: '#c8d0d8' }], rshield: ['shield', { 1: '#a83a2a', 2: '#6a2418', w: '#e07060', a: '#e0c040' }],
  kshield: ['shield', { 1: '#3a5ab0', 2: '#223a7a', w: '#7a9ae0', a: '#e0e0e0' }], tshield: ['shield', { 1: '#9aa2ac', 2: '#5e6670', w: '#fff', a: '#c84030' }],
  cap: ['helm', LEATHER], ihelm: ['helm', STEEL], hhelm: ['helm', Object.assign({}, STEEL, { w: '#f0e8d0' })], crown: ['crown', { 1: '#f4c430', 2: '#b08820', w: '#fff', a: '#6ef' }],
  boots: ['boots', LEATHER], iboots: ['boots', STEEL], gloves: ['gloves', LEATHER], gaunt: ['gloves', STEEL],
  cloak: ['cloak', { 1: '#5a7a3a', 2: '#3a5226', a: '#c8a050' }], fcloak: ['cloak', { 1: '#a88a6a', 2: '#7a6048', a: '#e8e0d0' }],
  mithsword: ['sword', Object.assign({}, STEEL, { 1: '#e0f0ff', 2: '#8ab0d0' })], dbaxe: ['axe', Object.assign({}, STEEL, { 1: '#e8e0cc', 2: '#b0a890', 3: '#5a3a22' })],
  starham: ['mace', Object.assign({}, STEEL, { 1: '#c8c0ff', 2: '#7a70c0', a: '#fff' })], archstaff: ['staff', { 3: '#3a2a5a', 4: '#22183a', a: '#ffd040', w: '#fff' }],
  halberd: ['spear', Object.assign({}, STEEL, { 1: '#9ee0ff', 2: '#4a90c0' })], voidblade: ['sword', Object.assign({}, STEEL, { 1: '#8a5ad0', 2: '#4a2a8a', w: '#e0c8ff', a: '#c3f' })],
  agsword: ['sword', Object.assign({}, STEEL, { 1: '#f0e0a0', 2: '#b0a060', a: '#c83030' })], dbow: ['bow', { 3: '#e8e0cc', a: '#c83030', w: '#eee' }], stormbow: ['bow', { 3: '#5a7ab0', a: '#ffe860', w: '#fff' }],
  mithmail: ['armor', Object.assign({}, STEEL, { 1: '#e0f0ff', 2: '#8ab0d0' })], archrobe: ['robe', { 1: '#6a3ab0', 2: '#3a1a70', w: '#c8a0ff', a: '#ffd040' }],
  dscale: ['armor', Object.assign({}, STEEL, { 1: '#c83a2a', 2: '#7a1e1a', a: '#f0a040' })], starplate: ['armor', Object.assign({}, STEEL, { 1: '#c8c0ff', 2: '#7a70c0', a: '#fff' })],
  mithshield: ['shield', { 1: '#e0f0ff', 2: '#8ab0d0', w: '#fff', a: '#3a6ad0' }], dshield: ['shield', { 1: '#c83a2a', 2: '#7a1e1a', w: '#f08070', a: '#f0c040' }],
  mithhelm: ['helm', Object.assign({}, STEEL, { 1: '#e0f0ff', 2: '#8ab0d0' })], warhelm: ['helm', Object.assign({}, STEEL, { 1: '#4a4a56', 2: '#2e2e38', w: '#e0c040' })],
  mithboots: ['boots', Object.assign({}, STEEL, { 1: '#e0f0ff', 2: '#8ab0d0' })], mithgaunt: ['gloves', Object.assign({}, STEEL, { 1: '#e0f0ff', 2: '#8ab0d0' })],
  scloak: ['cloak', { 1: '#2a2a3a', 2: '#18181e', a: '#8a5ad0' }],
  ring: ['ring', { 1: '#e0b040', 2: '#a07820', a: '#c83030', w: '#fff' }], amulet: ['amulet', { 1: '#e0b040', 2: '#a07820', a: '#3a8ae0', w: '#fff' }],
};
const POTION_COL = { 'Crimson': '#d03030', 'Azure': '#3a7ae0', 'Bubbling Green': '#4ac04a', 'Murky': '#6a6a40', 'Golden': '#e8c040', 'Violet': '#9a4ad0', 'Smoky': '#8a8a98', 'Milky': '#e8e8e0', 'Fizzing Orange': '#f08a2a', 'Silver': '#c8d0d8', 'Inky Black': '#2a2a3a', 'Rose': '#e87aa0', 'Glowing Teal': '#3ad0c0', 'Amber': '#d0902a', 'Swirling': '#c060e0' };
const WAND_COL = { Ash: '#c8b898', Oak: '#8a5a2a', Yew: '#6a4a2a', Bone: '#e8e0c8', Iron: '#7a8490', Birch: '#e8e4dc', Rowan: '#a84a2a', Ebony: '#2a2228', Crystal: '#bfefff', Copper: '#c87a3a' };
function itemArt(it) {
  if (it.k === 'eq') { const a = ITEM_ART[it.b] || ['sword', STEEL]; return [a[0], a[1], 'i:' + it.b]; }
  if (it.k === 'potion') { const col = POTION_COL[G.flav.potion[it.b]] || '#d03030'; return ['potion', { a: col, 1: shade(col, 0.7), w: '#fff', 3: '#8a5428' }, 'p:' + col]; }
  if (it.k === 'scroll') return ['scroll', { 1: '#efe2c0', a: '#8a5a3a', 3: '#c8a878' }, 'scroll'];
  if (it.k === 'wand') { const col = WAND_COL[G.flav.wand[it.b]] || '#8a5a2a'; return ['wand', { 3: col, 4: shade(col, 0.6), a: '#9ef4ff', w: '#fff' }, 'w:' + col]; }
  if (it.k === 'book') { const t = SPELLS[it.b].tier; const col = ['#7a3aa0', '#2a6ab0', '#2a8a4a', '#b03a2a', '#c08a20', '#6a2a8a'][(t - 1) % 6]; return ['book', { 1: col, 2: shade(col, 0.6), a: '#e0c040', w: '#efe2c0' }, 'b:' + col]; }
  if (it.k === 'arrows') return ['arrows', { 3: '#a87038', a: '#e8e0d0', w: '#c8d0d8' }, 'arrows'];
  if (it.k === 'gold') return ['gold', { 1: '#f4c430', 2: '#b08820', w: '#fff6c0' }, 'gold'];
  if (it.k === 'relic') { const col = RELICS[it.b].col; return [{ sun: 'gold', moon: 'ring', raven: 'arrows', wolf: 'dagger' }[it.b] === 'gold' ? 'amulet' : 'amulet', { 1: '#e0b040', 2: '#a07820', a: col, w: '#fff' }, 'r:' + it.b]; }
  if (it.k === 'key') return ['ring', { 1: '#a8a8b0', 2: '#6a6a74', a: '#c8a040', w: '#fff' }, 'key'];
  if (it.k === 'chest') return ['chest', { 3: '#9a6232', 4: '#6a3e1c', a: '#e0c040', w: '#c89060' }, 'chest'];
  return ['gold', { 1: '#f0f' }, '?'];
}
function itemSprite(it) { const [t, pal, key] = itemArt(it); return tplSprite(ITEM_TPL[t], pal, false, key); }
const itemURLCache = new Map();
function itemImgHTML(it, size = 28) {
  const [, , key] = itemArt(it);
  let url = itemURLCache.get(key);
  if (!url) { const c = pcan(48, 48); const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(itemSprite(it), 0, 0, 48, 48); url = c.toDataURL(); itemURLCache.set(key, url); }
  return `<img src="${url}" width="${size}" height="${size}" style="image-rendering:pixelated;vertical-align:middle" alt="">`;
}
const monURLCache = new Map();
function monImgHTML(id, size = 64) {
  let url = monURLCache.get(id);
  if (!url) { const c = pcan(64, 64); const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(monSprite(id), 0, 0, 64, 64); url = c.toDataURL(); monURLCache.set(id, url); }
  return `<img src="${url}" width="${size}" height="${size}" style="image-rendering:pixelated" alt="">`;
}

// ---------- dungeon themes ----------
function dungeonTheme(d, kind) {
  if (kind === 'deep') return { floor: ['#2f2a2c', '#2a2527', '#353032'], mortar: '#151012', wall: ['#4e3a3e', '#443236', '#5a444a'], wallTop: '#110c0e', wallDark: '#2e2024', accent: '#8a2a2a' };
  if (d <= 3) return { floor: ['#3b342d', '#36302a', '#403830'], mortar: '#241e1a', wall: ['#6a5a4a', '#5e5042', '#74644f'], wallTop: '#231d19', wallDark: '#3e342b', accent: null };
  if (d <= 6) return { floor: ['#343a36', '#2f3531', '#3a403b'], mortar: '#1e2320', wall: ['#56625a', '#4c5850', '#606c63'], wallTop: '#1a1f1c', wallDark: '#353e38', accent: '#4f8a3a' };
  if (d <= 9) return { floor: ['#33303c', '#2e2b36', '#383442'], mortar: '#1c1a22', wall: ['#57526a', '#4d495e', '#625c76'], wallTop: '#1a1820', wallDark: '#38344a', accent: '#7a4ab0' };
  return { floor: ['#3a4a5c', '#354456', '#405266'], mortar: '#223040', wall: ['#7a9ab8', '#6a8aa8', '#8aaac8'], wallTop: '#22324a', wallDark: '#4a6a8a', accent: '#dff4ff' };
}
function isWallCh(c) { return c === '#'; }
function drawFloorPx(x, X, Y, th, r) {
  // 2x2 flagstones with mortar
  x.fillStyle = th.mortar; x.fillRect(X, Y, 16, 16);
  const off = r() < 0.5 ? 0 : 4;
  for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
    const c = th.floor[(r() * th.floor.length) | 0];
    const bx = X + sx * 8, by = Y + sy * 8;
    x.fillStyle = c; x.fillRect(bx + 1, by + 1, 7, 7);
    x.fillStyle = shade(c, 1.08); x.fillRect(bx + 1, by + 1, 7, 1);
    x.fillStyle = shade(c, 0.85); x.fillRect(bx + 1, by + 7, 7, 1);
    if (r() < 0.25) { x.fillStyle = shade(c, 0.8); x.fillRect(bx + 2 + ((r() * 4) | 0), by + 3 + ((r() * 3) | 0), 2, 1); }
  }
  if (th.accent && r() < 0.18) { x.fillStyle = th.accent; const n = 2 + (r() * 3 | 0); for (let i = 0; i < n; i++) x.fillRect(X + (r() * 15 | 0), Y + (r() * 15 | 0), 1, 1); }
  if (r() < 0.05) { x.fillStyle = '#d8d0c0'; x.fillRect(X + 4 + (r() * 6 | 0), Y + 9, 3, 1); x.fillRect(X + 5 + (r() * 4 | 0), Y + 10, 1, 1); } // bone bits
  void off;
}
function drawWallFacePx(x, X, Y, th, r) {
  x.fillStyle = th.mortar; x.fillRect(X, Y, 16, 16);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 4 : 0;
    for (let b = -1; b < 2; b++) {
      const bx = X + b * 8 + off, by = Y + row * 4;
      const c = th.wall[(r() * th.wall.length) | 0];
      const x0 = Math.max(X, bx + 1), x1 = Math.min(X + 16, bx + 8);
      if (x1 <= x0) continue;
      x.fillStyle = c; x.fillRect(x0, by + 1, x1 - x0, 3);
      x.fillStyle = shade(c, 1.12); x.fillRect(x0, by + 1, x1 - x0, 1);
    }
  }
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(X, Y + 13, 16, 3); // ground shadow
  if (th.accent && r() < 0.3) { x.fillStyle = th.accent; x.fillRect(X + (r() * 14 | 0), Y + 12 + (r() * 2 | 0), 2, 1); }
}
function drawWallTopPx(x, X, Y, th, r, edges) {
  x.fillStyle = th.wallTop; x.fillRect(X, Y, 16, 16);
  x.fillStyle = shade(th.wallTop, 1.15);
  for (let i = 0; i < 3; i++) x.fillRect(X + (r() * 14 | 0), Y + (r() * 14 | 0), 2, 1);
  // rim where the wall meets floor on left/right/top
  x.fillStyle = th.wallDark;
  if (edges.l) x.fillRect(X, Y, 2, 16);
  if (edges.r) x.fillRect(X + 14, Y, 2, 16);
  if (edges.u) x.fillRect(X, Y, 16, 2);
}
function drawDoorPx(x, X, Y, open) {
  x.fillStyle = '#1a120c'; x.fillRect(X + 1, Y, 14, 16);
  x.fillStyle = '#5a4a3a'; x.fillRect(X, Y, 2, 16); x.fillRect(X + 14, Y, 2, 16); x.fillRect(X, Y, 16, 2);
  if (open) { x.fillStyle = '#7a4a22'; x.fillRect(X + 2, Y + 2, 3, 14); x.fillStyle = '#4a2a12'; x.fillRect(X + 4, Y + 2, 1, 14); return; }
  for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#7a4a22' : '#8a5428'; x.fillRect(X + 2 + i * 3, Y + 2, 3, 14); x.fillStyle = '#4a2a12'; x.fillRect(X + 2 + i * 3, Y + 2, 1, 14); }
  x.fillStyle = '#3a3a40'; x.fillRect(X + 2, Y + 5, 12, 2); x.fillRect(X + 2, Y + 11, 12, 2);
  x.fillStyle = '#e0b040'; x.fillRect(X + 11, Y + 8, 2, 2);
}
function drawStairsPx(x, X, Y, down, th) {
  if (down) {
    x.fillStyle = '#0a0806'; x.fillRect(X + 2, Y + 2, 12, 12);
    for (let i = 0; i < 4; i++) { const w = 12 - i * 2; x.fillStyle = shade(th.wall[0], 1 - i * 0.18); x.fillRect(X + 2 + i, Y + 2 + i * 3, w, 2); }
    x.fillStyle = '#e0b040'; x.fillRect(X + 2, Y + 2, 12, 1);
  } else {
    for (let i = 0; i < 5; i++) { x.fillStyle = shade(th.wall[2], 1.25 - i * 0.12); x.fillRect(X + 2, Y + 2 + i * 3, 12, 2); x.fillStyle = shade(th.wall[2], 0.7); x.fillRect(X + 2, Y + 4 + i * 3, 12, 1); }
    x.fillStyle = '#9ad0ff'; x.fillRect(X + 2, Y + 14, 12, 1);
  }
}
function drawBarsPx(x, X, Y) {
  x.fillStyle = '#1a1416'; x.fillRect(X, Y, 16, 16);
  x.fillStyle = '#2a2224'; x.fillRect(X + 1, Y + 1, 14, 14);
  for (let i = 0; i < 5; i++) { x.fillStyle = OUTLINE; x.fillRect(X + 1 + i * 3, Y, 2, 16); x.fillStyle = '#8a8a94'; x.fillRect(X + 1 + i * 3, Y, 1, 16); }
  x.fillStyle = OUTLINE; x.fillRect(X, Y + 3, 16, 2); x.fillRect(X, Y + 11, 16, 2); x.fillStyle = '#6a6a74'; x.fillRect(X, Y + 3, 16, 1); x.fillRect(X, Y + 11, 16, 1);
  x.fillStyle = '#c8a040'; x.fillRect(X + 12, Y + 7, 2, 3);
}
function renderDungeonArt(L) {
  const th = dungeonTheme(L.depth, L.kind);
  const c = pcan(L.w * PX, L.h * PX); const x = c.getContext('2d');
  const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= L.w || yy >= L.h) ? '#' : L.t[yy * L.w + xx];
  L._torches = [];
  for (let yy = 0; yy < L.h; yy++) for (let xx = 0; xx < L.w; xx++) {
    const t = at(xx, yy), X = xx * PX, Y = yy * PX, r = srand(xx * 7919 + yy * 104729 + L.depth * 31);
    if (t === '#' || t === 'J') {
      const below = at(xx, yy + 1);
      if (!isWallCh(below)) { drawWallFacePx(x, X, Y, th, r); if (r() < 0.09 && below === '.') L._torches.push([xx, yy]); }
      else drawWallTopPx(x, X, Y, th, r, { l: !isWallCh(at(xx - 1, yy)), r: !isWallCh(at(xx + 1, yy)), u: !isWallCh(at(xx, yy - 1)) });
      continue;
    }
    drawFloorPx(x, X, Y, th, r);
    // soft shadow under walls
    if (isWallCh(at(xx, yy - 1))) { x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(X, Y, 16, 3); }
    if (t === '+' || t === "'") drawDoorPx(x, X, Y, t === "'");
    if (t === '>' || t === '<') drawStairsPx(x, X, Y, t === '>', th);
  }
  // cell doors (iron bars) drawn over walls
  for (let yy = 0; yy < L.h; yy++) for (let xx = 0; xx < L.w; xx++) if (at(xx, yy) === 'J') drawBarsPx(x, xx * PX, yy * PX);
  return c;
}

// ---------- town (snowy Norse village) ----------
const SNOW = ['#e9eff5', '#e2e9f1', '#edf2f7'];
const GRASS = ['#4e7a3a', '#4a7436', '#53803e'];
function drawGrassPx(x, X, Y, r) {
  x.fillStyle = GRASS[(r() * 3) | 0]; x.fillRect(X, Y, 16, 16);
  x.fillStyle = '#3e6a2e'; for (let i = 0; i < 5; i++) x.fillRect(X + (r() * 15 | 0), Y + (r() * 14 | 0), 1, 2);
  x.fillStyle = '#6a9a4a'; for (let i = 0; i < 3; i++) x.fillRect(X + (r() * 15 | 0), Y + (r() * 15 | 0), 1, 1);
  if (r() < 0.08) { x.fillStyle = pick(['#f4e060', '#f0f0f0', '#e870a0']); x.fillRect(X + 3 + (r() * 9 | 0), Y + 3 + (r() * 9 | 0), 2, 2); }
}
function drawLeafTreePx(x, X, Y, r, dark) {
  x.fillStyle = 'rgba(20,40,20,.35)'; x.fillRect(X + 2, Y + 12, 13, 3);
  x.fillStyle = '#5a3a22'; x.fillRect(X + 7, Y + 10, 3, 5);
  const cols = dark ? ['#1e3a22', '#24442a', '#2e5434'] : ['#2e6a2e', '#3a7a36', '#4a8a3e'];
  x.fillStyle = OUTLINE; x.beginPath(); x.arc(X + 8, Y + 7, 7.2, 0, 6.29); x.fill();
  x.fillStyle = cols[0]; x.beginPath(); x.arc(X + 8, Y + 7, 6.4, 0, 6.29); x.fill();
  x.fillStyle = cols[1]; x.beginPath(); x.arc(X + 7, Y + 6, 4.5, 0, 6.29); x.fill();
  x.fillStyle = cols[2]; for (let i = 0; i < 5; i++) x.fillRect(X + 3 + (r() * 8 | 0), Y + 2 + (r() * 6 | 0), 2, 1);
  if (!dark && r() < 0.3) { x.fillStyle = '#c83030'; x.fillRect(X + 4 + (r() * 7 | 0), Y + 4 + (r() * 5 | 0), 1, 1); x.fillRect(X + 5 + (r() * 6 | 0), Y + 3 + (r() * 6 | 0), 1, 1); }
}
function drawWaterPx(x, X, Y, r, at, xx, yy) {
  x.fillStyle = '#2a5a8a'; x.fillRect(X, Y, 16, 16);
  x.fillStyle = '#3a6a9a'; for (let i = 0; i < 3; i++) x.fillRect(X + (r() * 12 | 0), Y + (r() * 15 | 0), 4, 1);
  x.fillStyle = '#8ab8e0'; x.fillRect(X + (r() * 12 | 0), Y + (r() * 15 | 0), 2, 1);
  const shore = c => c !== '~';
  x.fillStyle = '#c8b080';
  if (shore(at(xx, yy - 1))) x.fillRect(X, Y, 16, 2);
  if (shore(at(xx, yy + 1))) x.fillRect(X, Y + 14, 16, 2);
  if (shore(at(xx - 1, yy))) x.fillRect(X, Y, 2, 16);
  if (shore(at(xx + 1, yy))) x.fillRect(X + 14, Y, 2, 16);
}
function drawWaystonePx(x, X, Y) {
  x.fillStyle = 'rgba(40,40,60,.3)'; x.fillRect(X + 3, Y + 13, 11, 3);
  x.fillStyle = OUTLINE; x.fillRect(X + 4, Y + 1, 8, 14);
  x.fillStyle = '#7a8490'; x.fillRect(X + 5, Y + 2, 6, 12); x.fillStyle = '#5e6670'; x.fillRect(X + 9, Y + 2, 2, 12);
  x.fillStyle = '#6ef'; x.fillRect(X + 7, Y + 4, 1, 3); x.fillRect(X + 6, Y + 5, 3, 1); x.fillRect(X + 7, Y + 9, 1, 3); x.fillRect(X + 6, Y + 10, 1, 1); x.fillRect(X + 8, Y + 10, 1, 1);
}
function drawSignpostPx(x, X, Y, back) {
  x.fillStyle = OUTLINE; x.fillRect(X + 7, Y + 4, 3, 12);
  x.fillStyle = '#8a5428'; x.fillRect(X + 8, Y + 5, 1, 11);
  x.fillStyle = OUTLINE; x.fillRect(X + 2, Y + 2, 12, 6);
  x.fillStyle = '#b8864a'; x.fillRect(X + 3, Y + 3, 10, 4);
  x.fillStyle = OUTLINE; if (back) { x.fillRect(X + 4, Y + 4, 1, 2); x.fillRect(X + 5, Y + 3, 1, 4); x.fillRect(X + 6, Y + 5, 5, 1); } else { x.fillRect(X + 11, Y + 4, 1, 2); x.fillRect(X + 10, Y + 3, 1, 4); x.fillRect(X + 5, Y + 5, 5, 1); }
}
function drawSnowPx(x, X, Y, r) {
  x.fillStyle = SNOW[(r() * 3) | 0]; x.fillRect(X, Y, 16, 16);
  x.fillStyle = '#d2dce8'; for (let i = 0; i < 4; i++) x.fillRect(X + (r() * 15 | 0), Y + (r() * 15 | 0), 2, 1);
  x.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) x.fillRect(X + (r() * 15 | 0), Y + (r() * 15 | 0), 1, 1);
  if (r() < 0.12) { x.fillStyle = '#5a7a4a'; const gx = X + 3 + (r() * 9 | 0), gy = Y + 4 + (r() * 8 | 0); x.fillRect(gx, gy, 1, 2); x.fillRect(gx + 2, gy + 1, 1, 2); }
}
function drawRoadPx(x, X, Y, r, at, xx, yy, green) {
  x.fillStyle = '#7a6c5e'; x.fillRect(X, Y, 16, 16);
  for (let i = 0; i < 7; i++) { const cx = X + (r() * 13 | 0), cy = Y + (r() * 13 | 0); const c = ['#8a7c6c', '#6e6052', '#968878'][(r() * 3) | 0]; x.fillStyle = c; x.fillRect(cx, cy, 3, 2); x.fillStyle = '#5a4e42'; x.fillRect(cx, cy + 2, 3, 1); }
  // snowy / grassy edges toward non-road
  x.fillStyle = green ? '#4a7436' : '#e2e9f1';
  const isRoad = c => c === '=' || c === '>' || c === 'S' || c === 'E';
  if (!isRoad(at(xx, yy - 1))) for (let i = 0; i < 16; i++) x.fillRect(X + i, Y, 1, 1 + (r() * 3 | 0));
  if (!isRoad(at(xx, yy + 1))) for (let i = 0; i < 16; i++) { const h = 1 + (r() * 2 | 0); x.fillRect(X + i, Y + 16 - h, 1, h); }
  if (!isRoad(at(xx - 1, yy))) for (let i = 0; i < 16; i++) x.fillRect(X, Y + i, 1 + (r() * 3 | 0), 1);
  if (!isRoad(at(xx + 1, yy))) for (let i = 0; i < 16; i++) { const w = 1 + (r() * 2 | 0); x.fillRect(X + 16 - w, Y + i, w, 1); }
}
function drawPinePx(x, X, Y, r) {
  const cx = X + 8;
  x.fillStyle = 'rgba(60,80,110,.25)'; x.fillRect(X + 3, Y + 14, 11, 2);
  x.fillStyle = '#5a3a22'; x.fillRect(cx - 1, Y + 12, 3, 3);
  const layers = [[2, 5], [5, 8], [8, 12]];
  layers.forEach(([y0, y1], i) => {
    for (let yy = y0; yy <= y1; yy++) {
      const half = 1 + ((yy - y0) * (2 + i)) / 2.2 | 0;
      x.fillStyle = OUTLINE; x.fillRect(cx - half - 1, Y + yy, half * 2 + 3, 1);
      x.fillStyle = yy === y0 + 1 ? '#f4f8fc' : (yy % 2 ? '#2e5a3a' : '#264c32'); x.fillRect(cx - half, Y + yy, half * 2 + 1, 1);
      if (yy === y0 + 2) { x.fillStyle = '#e8f0f6'; x.fillRect(cx - half + 1, Y + yy, Math.max(1, half), 1); }
    }
  });
  x.fillStyle = '#f4f8fc'; x.fillRect(cx, Y + 1, 1, 1);
}
function drawMountainPx(x, X, Y, r) {
  x.fillStyle = '#5a6470'; x.fillRect(X, Y, 16, 16);
  const peak = 2 + (r() * 4 | 0), pc = X + 4 + (r() * 8 | 0);
  for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) {
    const d = Math.abs(X + xx - pc) - (yy - peak);
    if (d > 0 && yy < 10) { x.fillStyle = '#3e4650'; x.fillRect(X + xx, Y + yy, 1, 1); continue; }
    if (yy < peak + 4 && d <= 0) { x.fillStyle = (X + xx) < pc ? '#ffffff' : '#d6e0ec'; x.fillRect(X + xx, Y + yy, 1, 1); }
    else if (d <= 0) { x.fillStyle = (X + xx) < pc ? '#78828e' : '#5e6874'; x.fillRect(X + xx, Y + yy, 1, 1); }
  }
}
function drawCavePx(x, X, Y) {
  x.fillStyle = '#4e5864'; x.fillRect(X, Y, 16, 16);
  x.fillStyle = '#6e7884'; x.fillRect(X, Y, 16, 3);
  x.fillStyle = '#0a0806'; x.fillRect(X + 3, Y + 5, 10, 11); x.fillRect(X + 4, Y + 4, 8, 1); x.fillRect(X + 5, Y + 3, 6, 1);
  x.fillStyle = '#8a929c'; x.fillRect(X + 2, Y + 5, 1, 11); x.fillRect(X + 13, Y + 5, 1, 11); x.fillRect(X + 3, Y + 4, 1, 1); x.fillRect(X + 12, Y + 4, 1, 1);
  x.fillStyle = '#e8eef4'; x.fillRect(X, Y, 16, 1);
}
function drawBushPx(x, X, Y, r) {
  drawSnowPx(x, X, Y, r);
  x.fillStyle = OUTLINE; x.fillRect(X + 3, Y + 7, 10, 7); x.fillRect(X + 4, Y + 6, 8, 1);
  x.fillStyle = '#3a6a42'; x.fillRect(X + 4, Y + 7, 8, 6);
  x.fillStyle = '#f4f8fc'; x.fillRect(X + 4, Y + 7, 8, 2); x.fillRect(X + 5, Y + 6, 6, 1);
  x.fillStyle = '#c83030'; x.fillRect(X + 6, Y + 10, 1, 1); x.fillRect(X + 9, Y + 11, 1, 1);
}
function drawWellPx(x, X, Y) {
  x.fillStyle = 'rgba(60,80,110,.25)'; x.fillRect(X + 2, Y + 13, 13, 3);
  x.fillStyle = OUTLINE; x.fillRect(X + 2, Y + 7, 12, 8);
  x.fillStyle = '#7a8490'; x.fillRect(X + 3, Y + 8, 10, 6); x.fillStyle = '#5e6670'; for (let i = 0; i < 3; i++) x.fillRect(X + 3 + i * 4, Y + 10, 3, 1);
  x.fillStyle = '#1a2a3a'; x.fillRect(X + 4, Y + 8, 8, 2);
  x.fillStyle = '#5a3a22'; x.fillRect(X + 3, Y + 2, 1, 6); x.fillRect(X + 12, Y + 2, 1, 6);
  x.fillStyle = '#8a5428'; x.fillRect(X + 2, Y + 1, 12, 2); x.fillStyle = '#f4f8fc'; x.fillRect(X + 2, Y, 12, 1);
}
function drawLampPx(x, X, Y) {
  x.fillStyle = 'rgba(60,80,110,.25)'; x.fillRect(X + 5, Y + 14, 6, 2);
  x.fillStyle = OUTLINE; x.fillRect(X + 7, Y + 5, 2, 10); x.fillRect(X + 5, Y + 1, 6, 5);
  x.fillStyle = '#ffd860'; x.fillRect(X + 6, Y + 2, 4, 3);
  x.fillStyle = '#3a3a40'; x.fillRect(X + 5, Y + 1, 6, 1); x.fillStyle = '#f4f8fc'; x.fillRect(X + 5, Y, 6, 1);
}
function drawBarrelPx(x, X, Y) {
  x.fillStyle = 'rgba(60,80,110,.25)'; x.fillRect(X + 3, Y + 13, 11, 3);
  x.fillStyle = OUTLINE; x.fillRect(X + 3, Y + 4, 10, 11);
  x.fillStyle = '#8a5428'; x.fillRect(X + 4, Y + 5, 8, 9); x.fillStyle = '#6a3e1c'; x.fillRect(X + 6, Y + 5, 1, 9); x.fillRect(X + 9, Y + 5, 1, 9);
  x.fillStyle = '#4a4a50'; x.fillRect(X + 4, Y + 7, 8, 1); x.fillRect(X + 4, Y + 12, 8, 1);
  x.fillStyle = '#f4f8fc'; x.fillRect(X + 4, Y + 4, 8, 1);
}
function drawFencePx(x, X, Y, r) {
  drawSnowPx(x, X, Y, r);
  x.fillStyle = OUTLINE; x.fillRect(X, Y + 6, 16, 3); x.fillRect(X, Y + 10, 16, 2);
  x.fillStyle = '#8a5428'; x.fillRect(X, Y + 7, 16, 1); x.fillRect(X, Y + 10, 16, 1);
  for (const px of [2, 10]) { x.fillStyle = OUTLINE; x.fillRect(X + px - 1, Y + 3, 4, 11); x.fillStyle = '#9a6232'; x.fillRect(X + px, Y + 4, 2, 9); x.fillStyle = '#f4f8fc'; x.fillRect(X + px, Y + 3, 2, 1); }
}
// shop sign icons (8x8)
const SIGN_ICON = {
  general: ['..kkkk..', '.k3333k.', 'k333333k', 'k3aa333k', 'k3aa333k', 'k333333k', '.k3333k.', '..kkkk..'],
  smith: ['........', 'kkkkkkk.', 'k11111kk', '.k1111k.', '..k11k..', '..k11k..', '.k1111k.', 'kkkkkkkk'],
  armor: ['kkkkkkkk', 'k1aa111k', 'k1aa111k', 'k111111k', '.k1111k.', '.k1111k.', '..k11k..', '...kk...'],
  alch: ['...kk...', '...kk...', '..k..k..', '.k....k.', 'kaaaaaak', 'kaaaaaak', '.kaaaak.', '..kkkk..'],
  mage: ['...k....', '..kak...', 'kkkaakkk', '.kaaaak.', '..kaak..', '.kakkak.', '.kk..kk.', '........'],
  temple: ['...kk...', '..kaak..', '..kaak..', '.ka..ak.', '.ka..ak.', 'kaaaaaak', 'kkkkkkkk', '........'],
  sage: ['k.kkkk.k', 'kk3333kk', 'k3w33w3k', 'k3k33k3k', 'k33aa33k', '.k3333k.', '.k3333k.', '..kkkk..'],
  tavern: ['.kkkkk..', 'kwwwwwk.', 'kaaaaakk', 'kaaaaak.k', 'kaaaaakk', 'kaaaaak.', 'kaaaaak.', '.kkkkk..'],
  lodge: ['..kkkk..', '.k3333k.', 'k3a33a3k', 'k333333k', '.k3aa3k.', '..k33k..', '...kk...', '........'],
  jarl: ['........', 'k.k.k.kk', 'kakakakk', 'kaaaaaak', 'kaaaaaak', 'kkkkkkkk', '........', '........'],
};
const BLD_STYLE = {
  general: { wall: '#8a5428', roof: '#6a4a2a', trim: '#c8a050' },
  smith: { wall: '#6a5a4a', roof: '#4a4a50', trim: '#d0602a', stone: true, chimney: true },
  armor: { wall: '#7a4a22', roof: '#5a4a3a', trim: '#9aa2ac' },
  alch: { wall: '#6a5a3a', roof: '#4a6a3a', trim: '#7ad07a', chimney: true },
  mage: { wall: '#4a3a6a', roof: '#3a2a5a', trim: '#c08aff', tower: true },
  temple: { wall: '#8a8a90', roof: '#5a3a2a', trim: '#e0c040', stone: true, tall: true },
  sage: { wall: '#7a5a3a', roof: '#4a5a6a', trim: '#e8d8a0' },
  tavern: { wall: '#8a5428', roof: '#7a3a2a', trim: '#e8a040', chimney: true },
  jarl: { wall: '#7a4a22', roof: '#5a3a2a', trim: '#e0c040', big: true },
  lodge: { wall: '#6a5a3a', roof: '#3a5a3a', trim: '#8ac060', big: true },
};
function drawBuildingPx(x, b, L) {
  const st = BLD_STYLE[b.id] || BLD_STYLE.general; const green = L.ch === 2;
  const X = b.x * PX, Y = b.y * PX, W = b.w * PX, H = b.h * PX;
  const r = srand(b.x * 31 + b.y * 17);
  const roofH = Math.round(H * (st.tall ? 0.62 : 0.52));
  // shadow
  x.fillStyle = 'rgba(60,80,110,.28)'; x.fillRect(X + 3, Y + H - 2, W, 5);
  // wall
  const wy = Y + roofH - 2;
  x.fillStyle = OUTLINE; x.fillRect(X, wy, W, H - roofH + 2);
  if (st.stone) {
    x.fillStyle = st.wall; x.fillRect(X + 1, wy + 1, W - 2, H - roofH);
    for (let yy = wy + 2; yy < Y + H - 1; yy += 4) for (let xx = X + 1 + ((yy / 4) % 2 ? 0 : 4); xx < X + W - 2; xx += 8) { x.fillStyle = shade(st.wall, 0.75); x.fillRect(xx, yy, 1, 3); x.fillRect(X + 1, yy + 3, W - 2, 1); x.fillStyle = shade(st.wall, 1.1); x.fillRect(xx + 1, yy, 6, 1); }
  } else {
    for (let xx = X + 1; xx < X + W - 1; xx += 3) { x.fillStyle = (xx / 3) % 2 ? st.wall : shade(st.wall, 0.88); x.fillRect(xx, wy + 1, 3, H - roofH); x.fillStyle = shade(st.wall, 0.6); x.fillRect(xx, wy + 1, 1, H - roofH); }
    // timber posts
    x.fillStyle = shade(st.wall, 0.5);
    for (const px of [X + 1, X + W - 4, X + (W / 2 | 0) - 1]) x.fillRect(px, wy + 1, 3, H - roofH);
  }
  // snow drift / grass at base
  x.fillStyle = green ? '#3e6a2e' : '#e8eef4'; for (let xx = X; xx < X + W; xx++) x.fillRect(xx, Y + H - 2 - (r() * 2 | 0), 1, 2);
  // windows with warm light
  const doorX = b.door.x * PX;
  const nwin = st.big ? 0 : 2;
  for (let i = 0; i < nwin; i++) {
    let wx = X + Math.round((i + 0.5) * W / nwin) - 4;
    if (Math.abs(wx + 4 - (doorX + 8)) < 14) continue;
    const wyy = wy + Math.round((H - roofH) * 0.3);
    x.fillStyle = OUTLINE; x.fillRect(wx - 1, wyy - 1, 10, 9);
    x.fillStyle = '#ffd070'; x.fillRect(wx, wyy, 8, 7);
    x.fillStyle = '#ffeaa0'; x.fillRect(wx + 1, wyy + 1, 3, 2);
    x.fillStyle = shade(st.wall, 0.5); x.fillRect(wx + 3, wyy, 2, 7); x.fillRect(wx, wyy + 3, 8, 1);
    x.fillStyle = '#f4f8fc'; x.fillRect(wx - 1, wyy - 2, 10, 1);
  }
  // roof (gabled, snow-covered turf)
  const ry = Y - (st.tall ? 10 : 6);
  const rh = roofH - (ry - Y);
  for (let yy = 0; yy < rh; yy++) {
    const inset = Math.max(0, Math.round((rh - yy) * 0.18)) - 2;
    const x0 = X + inset, x1 = X + W - inset;
    x.fillStyle = OUTLINE; x.fillRect(x0 - 1, ry + yy, x1 - x0 + 2, 1);
    const snowLine = green ? 0 : rh * 0.55;
    if (yy < snowLine) { x.fillStyle = yy % 3 === 0 ? '#ffffff' : (yy % 3 === 1 ? '#eef3f8' : '#dfe8f2'); }
    else { x.fillStyle = (yy % 2) ? st.roof : shade(st.roof, 0.85); }
    x.fillRect(x0, ry + yy, x1 - x0, 1);
    if (yy >= snowLine && yy < snowLine + 2) { // icicles / snow overhang
      x.fillStyle = '#f4f8fc'; for (let xx = x0; xx < x1; xx += 2 + (r() * 3 | 0)) x.fillRect(xx, ry + yy, 1, 1 + (r() * 2 | 0));
    }
  }
  x.fillStyle = OUTLINE; x.fillRect(X - 3, ry + rh, W + 6, 2); x.fillStyle = shade(st.roof, 0.6); x.fillRect(X - 2, ry + rh, W + 4, 1);
  // dragon-head gable ends
  // ridge beam + snow lumps
  x.fillStyle = shade(st.roof, 0.7); x.fillRect(X + 2, ry + 1, W - 4, 1);
  if (!green) { x.fillStyle = '#c8d6e6'; for (let xx = X + 2; xx < X + W - 4; xx += 5 + (r() * 6 | 0)) x.fillRect(xx, ry + 3 + (r() * 4 | 0), 3, 1); }
  else for (let yy = ry + 3; yy < ry + rh; yy += 3) { x.fillStyle = shade(st.roof, 0.7); x.fillRect(X, yy, W, 1); }
  if (!st.stone) for (const gx of [X - 2, X + W - 2]) { x.fillStyle = OUTLINE; x.fillRect(gx, ry - 4, 4, 6); x.fillStyle = st.trim; x.fillRect(gx + 1, ry - 3, 2, 4); x.fillRect(gx + (gx < X ? -1 : 2), ry - 4, 2, 2); }
  if (st.chimney) { const cx = X + W - 14; x.fillStyle = OUTLINE; x.fillRect(cx - 1, ry - 6, 8, 10); x.fillStyle = '#6a6a70'; x.fillRect(cx, ry - 5, 6, 9); x.fillStyle = '#f4f8fc'; x.fillRect(cx, ry - 6, 6, 1); b.smoke = [cx + 3, ry - 7]; }
  if (st.tower) { const tx = X + 6; x.fillStyle = OUTLINE; x.fillRect(tx - 1, ry - 14, 12, 16); x.fillStyle = st.wall; x.fillRect(tx, ry - 12, 10, 14); for (let i = 0; i < 6; i++) { x.fillStyle = OUTLINE; x.fillRect(tx + 5 - i, ry - 14 - 6 + i, i * 2 + 1, 1); x.fillStyle = st.roof; x.fillRect(tx + 5 - i + (i ? 1 : 0), ry - 14 - 6 + i, Math.max(1, i * 2 - 1), 1); } x.fillStyle = '#ffd070'; x.fillRect(tx + 3, ry - 8, 4, 4); }
  if (st.tall) { const sx = X + W / 2 - 1; x.fillStyle = OUTLINE; x.fillRect(sx - 1, ry - 14, 4, 14); x.fillStyle = st.trim; x.fillRect(sx, ry - 13, 2, 12); x.fillRect(sx - 3, ry - 10, 8, 2); }
  if (st.big) { for (let i = 0; i < 4; i++) { const sx = X + 14 + i * ((W - 28) / 3); x.fillStyle = OUTLINE; x.fillRect(sx - 5, wy + 8, 11, 11); x.fillStyle = ['#a83a2a', '#3a5ab0', '#e0c040', '#3a7a3a'][i]; x.fillRect(sx - 4, wy + 9, 9, 9); x.fillStyle = '#ddd'; x.fillRect(sx - 1, wy + 12, 3, 3); } }
  // door
  const dy = b.door.y * PX;
  x.fillStyle = OUTLINE; x.fillRect(doorX + 2, dy + 2, 12, 14);
  x.fillStyle = '#3a2210'; x.fillRect(doorX + 3, dy + 3, 10, 13);
  x.fillStyle = '#5a3418'; x.fillRect(doorX + 4, dy + 4, 3, 12); x.fillRect(doorX + 9, dy + 4, 3, 12);
  x.fillStyle = st.trim; x.fillRect(doorX + 2, dy + 1, 12, 1); x.fillRect(doorX + 10, dy + 9, 1, 2);
  // hanging sign next to door
  const icon = SIGN_ICON[b.id];
  if (icon) {
    const sx = doorX + (doorX + 30 < X + W ? 16 : -16), sy = dy - 3;
    x.fillStyle = OUTLINE; x.fillRect(sx - 1, sy - 1, 14, 13); x.fillStyle = '#b8864a'; x.fillRect(sx, sy, 12, 11); x.fillStyle = '#8a5a2a'; x.fillRect(sx, sy + 10, 12, 1);
    icon.forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch === '.' || xx > 7) return; x.fillStyle = ch === 'k' ? OUTLINE : ch === 'a' ? st.trim : ch === 'w' ? '#fff' : ch === '1' ? '#c8d0d8' : '#8a5a2a'; x.fillRect(sx + 2 + xx, sy + 1 + yy, 1, 1); }));
  }
}
function renderTownArt(L) {
  const c = pcan(L.w * PX, L.h * PX); const x = c.getContext('2d');
  const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= L.w || yy >= L.h) ? 'T' : L.t[yy * L.w + xx];
  const green = L.ch === 2;
  // ground first
  for (let yy = 0; yy < L.h; yy++) for (let xx = 0; xx < L.w; xx++) {
    const t = at(xx, yy), X = xx * PX, Y = yy * PX, r = srand(xx * 7919 + yy * 104729 + 5);
    if (t === '=' || t === 'S' || t === 'E') drawRoadPx(x, X, Y, r, at, xx, yy, green); else if (t === '~') drawWaterPx(x, X, Y, r, at, xx, yy); else if (green) drawGrassPx(x, X, Y, r); else drawSnowPx(x, X, Y, r);
  }
  for (let yy = 0; yy < L.h; yy++) for (let xx = 0; xx < L.w; xx++) {
    const t = at(xx, yy), X = xx * PX, Y = yy * PX, r = srand(xx * 31 + yy * 977 + 11);
    if (t === 'M') drawMountainPx(x, X, Y, r);
    else if (t === '>') drawCavePx(x, X, Y);
    else if (t === 'f') { if (green) { x.fillStyle = '#f4e060'; x.fillRect(X + 5, Y + 6, 2, 2); x.fillStyle = '#e870a0'; x.fillRect(X + 9, Y + 9, 2, 2); x.fillStyle = '#f0f0f0'; x.fillRect(X + 4, Y + 11, 2, 2); } else drawBushPx(x, X, Y, r); }
    else if (t === 'Y') drawWaystonePx(x, X, Y);
    else if (t === 'E') drawSignpostPx(x, X, Y, true);
    else if (t === 'W') drawWellPx(x, X, Y);
    else if (t === 'X') drawBarrelPx(x, X, Y);
    else if (t === 'F') drawFencePx(x, X, Y, r);
  }
  // trees and lamps sorted top-down so overlaps look right
  for (let yy = 0; yy < L.h; yy++) for (let xx = 0; xx < L.w; xx++) {
    const t = at(xx, yy), X = xx * PX, Y = yy * PX, r = srand(xx * 13 + yy * 7);
    if (t === 'T') { if (green) drawLeafTreePx(x, X, Y, r); else drawPinePx(x, X, Y, r); }
    if (t === 'L') drawLampPx(x, X, Y);
  }
  for (const b of L.bld) drawBuildingPx(x, b, L);
  return c;
}
function drawForestFloorPx(x, X, Y, r) {
  const c = ['#2e4a26', '#2a4422', '#33502a'][(r() * 3) | 0]; x.fillStyle = c; x.fillRect(X, Y, 16, 16);
  x.fillStyle = '#24381e'; for (let i = 0; i < 5; i++) x.fillRect(X + (r() * 15 | 0), Y + (r() * 14 | 0), 1, 2);
  if (r() < 0.25) { x.fillStyle = pick(['#7a5a2a', '#8a6a30', '#6a4a22']); x.fillRect(X + (r() * 13 | 0), Y + (r() * 13 | 0), 2, 1); } // fallen leaves
}
function drawCanopyPx(x, X, Y, r, at, xx, yy) {
  x.fillStyle = '#16260f'; x.fillRect(X, Y, 16, 16);
  const cols = ['#1f3a1c', '#244222', '#2c4e28', '#1a3218'];
  for (let i = 0; i < 6; i++) { x.fillStyle = cols[(r() * 4) | 0]; x.beginPath(); x.arc(X + 2 + r() * 12, Y + 2 + r() * 12, 3 + r() * 3, 0, 6.29); x.fill(); }
  x.fillStyle = '#3a5e30'; for (let i = 0; i < 4; i++) x.fillRect(X + (r() * 14 | 0), Y + (r() * 14 | 0), 2, 1);
  // edges where the canopy meets open ground: trunks + shadow
  if (at(xx, yy + 1) !== 'T') { x.fillStyle = OUTLINE; x.fillRect(X, Y + 13, 16, 3); x.fillStyle = '#4a3220'; x.fillRect(X + 4 + (r() * 6 | 0), Y + 12, 3, 4); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(X, Y + 15, 16, 1); }
}
function drawStonePx(x, X, Y, kind) {
  x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(X + 2, Y + 12, 13, 4);
  x.fillStyle = OUTLINE; x.fillRect(X + 3, Y + (kind === 'O' ? 0 : 4), 10, kind === 'O' ? 15 : 11);
  x.fillStyle = '#8a8e92'; x.fillRect(X + 4, Y + (kind === 'O' ? 1 : 5), 8, kind === 'O' ? 13 : 9);
  x.fillStyle = '#a8acb0'; x.fillRect(X + 4, Y + (kind === 'O' ? 1 : 5), 3, kind === 'O' ? 13 : 9);
  x.fillStyle = '#5a8a3a'; x.fillRect(X + 9, Y + 12, 3, 2);
  if (kind === 'O') { x.fillStyle = '#4a5a6a'; x.fillRect(X + 7, Y + 4, 2, 1); x.fillRect(X + 7, Y + 7, 2, 1); x.fillRect(X + 6, Y + 5, 1, 2); }
}
function drawPedestalPx(x, X, Y) {
  x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(X + 2, Y + 12, 13, 4);
  x.fillStyle = OUTLINE; x.fillRect(X + 2, Y + 8, 12, 7); x.fillRect(X + 4, Y + 5, 8, 4);
  x.fillStyle = '#9a9ea2'; x.fillRect(X + 3, Y + 9, 10, 5); x.fillStyle = '#b8bcc0'; x.fillRect(X + 5, Y + 6, 6, 3);
  x.fillStyle = '#6ef'; x.fillRect(X + 7, Y + 10, 2, 3);
}
function drawGatePx(x, X, Y) {
  x.fillStyle = OUTLINE; x.fillRect(X + 1, Y, 14, 16);
  x.fillStyle = '#7a7e82'; x.fillRect(X + 2, Y + 1, 12, 15); x.fillStyle = '#5a5e62'; x.fillRect(X + 4, Y + 4, 8, 12);
  x.fillStyle = '#3a3e42'; x.fillRect(X + 7, Y + 4, 2, 12);
  x.fillStyle = '#e0c040'; x.fillRect(X + 6, Y + 2, 4, 1);
}
function drawTabletPx(x, X, Y) {
  x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(X + 2, Y + 13, 13, 3);
  x.fillStyle = OUTLINE; x.fillRect(X + 2, Y + 2, 12, 13);
  x.fillStyle = '#9a9488'; x.fillRect(X + 3, Y + 3, 10, 11);
  x.fillStyle = '#5a5448'; for (let i = 0; i < 4; i++) x.fillRect(X + 4, Y + 5 + i * 2, 4 + (i * 3) % 5, 1);
}
function renderForestArt(L) {
  const c = pcan(L.w * PX, L.h * PX); const x = c.getContext('2d');
  const at = (xx, yy) => (xx < 0 || yy < 0 || xx >= L.w || yy >= L.h) ? 'T' : L.t[yy * L.w + xx];
  for (let yy = 0; yy < L.h; yy++) for (let xx = 0; xx < L.w; xx++) {
    const t = at(xx, yy), X = xx * PX, Y = yy * PX, r = srand(xx * 7919 + yy * 104729 + L.depth * 77);
    if (t === 'T') { drawCanopyPx(x, X, Y, r, at, xx, yy); continue; }
    if (t === '~') { drawWaterPx(x, X, Y, r, at, xx, yy); continue; }
    drawForestFloorPx(x, X, Y, r);
    if (t === '=' || t === '<' || t === '>') { x.fillStyle = '#5a4a32'; x.fillRect(X + 2, Y + 2, 12, 12); x.fillStyle = '#6a5838'; for (let i = 0; i < 4; i++) x.fillRect(X + 2 + (r() * 10 | 0), Y + 2 + (r() * 10 | 0), 2, 1); }
    if (t === 'f') { if (r() < 0.5) { x.fillStyle = OUTLINE; x.fillRect(X + 5, Y + 6, 6, 4); x.fillStyle = '#c83a2a'; x.fillRect(X + 6, Y + 7, 4, 2); x.fillStyle = '#fff'; x.fillRect(X + 7, Y + 7, 1, 1); x.fillStyle = '#e8dcc0'; x.fillRect(X + 7, Y + 10, 2, 3); } else { x.fillStyle = '#3e7a34'; for (let i = 0; i < 5; i++) x.fillRect(X + 4 + i * 2, Y + 6 + (i % 2) * 2, 1, 6); } }
    if (t === '<' || t === '>') drawSignpostPx(x, X, Y, t === '<');
    if (t === 'P') drawPedestalPx(x, X, Y);
    if (t === 'G') drawGatePx(x, X, Y);
    if (t === '&') { drawGatePx(x, X, Y); x.fillStyle = '#1a2a4a'; x.fillRect(X + 4, Y + 4, 8, 12); }
    if (t === 'R') drawTabletPx(x, X, Y);
    if (t === 'O') drawStonePx(x, X, Y, 'O');
  }
  if (L.circle) { // worn stone ring on the ground
    const cx = L.circle.x * PX + 8, cy = L.circle.y * PX + 8; x.strokeStyle = 'rgba(160,160,150,.35)'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, 3 * PX, 0, 6.29); x.stroke();
  }
  return c;
}
function levelArt(L) {
  const sig = L.t.join('');
  if (!L._art || L._artSig !== sig) { L._art = L.town ? renderTownArt(L) : L.kind === 'forest' ? renderForestArt(L) : renderDungeonArt(L); L._artSig = sig; }
  return L._art;
}
