'use strict';
// ===================== STATE =====================
let G = null;
const DW = 50, DH = 36;          // dungeon size
const TW = 37, TH = 28;          // town size
const EQ_SLOTS = ['weapon', 'shield', 'bow', 'armor', 'helm', 'cloak', 'gloves', 'boots', 'ring1', 'ring2', 'amulet'];
const SLOT_LABEL = { weapon: 'Weapon', shield: 'Shield', bow: 'Bow', armor: 'Armor', helm: 'Helm', cloak: 'Cloak', gloves: 'Gloves', boots: 'Boots', ring1: 'Ring', ring2: 'Ring', amulet: 'Amulet' };
const WEAPON_KEYS = ['hit', 'dmg', 'efire', 'ecold', 'eshock', 'leech'];
const STATS4 = ['str', 'dex', 'int', 'con'];
const STAT_NAME = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence', con: 'Constitution' };
const RAR_NAME = ['Common', 'Magic', 'Rare', 'Legendary'];
const MAX_INV = 40;
const MAX_STASH = 60;
// gold income grows faster past the Barrow so Chapter 2 prices stay reachable
const goldScale = d => Math.round((d + 1) * (d > 10 ? 1 + (d - 10) / 10 : 1));

const lvl = () => G.levels[G.loc];
// ----- world map: level keys are strings: '0' Ravensfjord, '1'..'10' Barrow, 'f1'..'f3' Ironwood, 't2' Eldermere, 's1'..'s10' Shadowdeep
const K = k => String(k);
function kindOf(k) { k = K(k); if (k === '0' || k === 't2') return 'town'; if (k[0] === 'f') return 'forest'; if (k[0] === 's') return 'deep'; return 'barrow'; }
function depthOf(k) { k = K(k); const kd = kindOf(k); if (kd === 'town') return 0; if (kd === 'forest') return 10 + +k.slice(1); if (kd === 'deep') return 13 + +k.slice(1); return +k; }
function homeOf(k) { k = K(k); return (k === 't2' || k[0] === 's') ? 't2' : '0'; }
function linksFor(k) {
  k = K(k);
  if (k === '0') return { '>': '1', 'E': 'f1' };
  if (k === 't2') return { '>': 's1', 'E': 'f3' };
  if (k === 'f1') return { '<': '0', '>': 'f2' };
  if (k === 'f2') return { '<': 'f1', '>': 'f3' };
  if (k === 'f3') return { '<': 'f2', '&': 't2' };
  if (k[0] === 's') { const n = +k.slice(1); return { '<': n === 1 ? 't2' : 's' + (n - 1), '>': n < 10 ? 's' + (n + 1) : null }; }
  const n = +k; return { '<': n === 1 ? '0' : K(n - 1), '>': n < 10 ? K(n + 1) : null };
}
function levelName(k) {
  k = K(k);
  return { '0': 'Ravensfjord', t2: 'Eldermere', f1: 'Ironwood Edge', f2: 'Ironwood Deep', f3: 'The Stone Circle' }[k] || (k[0] === 's' ? 'Shadowdeep ' + k.slice(1) : 'Barrow ' + k);
}
const RELICS = { sun: { n: 'Sun Disk', col: '#f4c430' }, moon: { n: 'Moon Shard', col: '#cfe3ff' }, raven: { n: 'Raven Feather', col: '#4a4a6a' }, wolf: { n: 'Wolf Fang', col: '#e8e0d0' } };
const CIRCLE_SOLUTION = { N: 'raven', E: 'sun', S: 'moon', W: 'wolf' };
const DIR_NAME = { N: 'North', E: 'East', S: 'South', W: 'West' };
const P = () => G.p;
const idx = (x, y) => y * lvl().w + x;
const inb = (x, y) => { const L = lvl(); return x >= 0 && y >= 0 && x < L.w && y < L.h; };
const tile = (x, y) => inb(x, y) ? lvl().t[idx(x, y)] : '#';
const OPAQUE = new Set(['#', '+', 'B', 'T', 'M', 'J', 'G', 'O']);
const WALK = new Set(['.', "'", '>', '<', ',', '=', '+', 'f', ':', 'E', '&']);
const isOpaque = (x, y) => OPAQUE.has(tile(x, y));
const isWalk = (x, y) => WALK.has(tile(x, y));
function monAt(x, y) { for (const m of lvl().mons) if (m.x === x && m.y === y) return m; return null; }
function npcAt(x, y) { const L = lvl(); if (!L.npcs) return null; for (const n of L.npcs) if (n.x === x && n.y === y) return n; return null; }
function itemsAt(x, y) { return lvl().items.filter(i => i.x === x && i.y === y); }
function trapAt(x, y) { return lvl().traps.find(t => t.x === x && t.y === y); }
const isFree = (x, y) => isWalk(x, y) && !monAt(x, y) && !(G.p.x === x && G.p.y === y) && !npcAt(x, y);

function msg(t, c) { G.msgs.push({ t, c: c || '#ddd', turn: G.turn }); if (G.msgs.length > 120) G.msgs.shift(); UI.logDirty = true; }

// ===================== NEW GAME =====================
function newGame(name, cls, hard) {
  const c = CLASSES[cls];
  G = {
    v: 3, name: name || 'Hero', cls, hard: !!hard, turn: 0, depth: 0, loc: '0', maxDepth: 0, deep2: 0, levels: {}, msgs: [], known: {}, flav: {},
    quest: { troll: 0, trollPaid: 0, crown: 0, won: 0, met: 0, circle: 0, freed: 0, won2: 0, met2: 0 }, shops: {}, restock: { '0': true, t2: true }, uid: 1, quick: [null, null, null, null],
    foundU: [], kills: 0, deaths: 0, pendingLvl: 0,
    p: { x: 0, y: 0, lvl: 1, xp: 0, str: c.str, dex: c.dex, int: c.int, con: c.con, drain: { str: 0, dex: 0, int: 0, con: 0 },
      baseHp: c.hp, baseMp: c.mp, hp: 1, mp: 0, gold: 75, spells: [...c.spells], equip: {}, inv: [], st: {} },
  };
  G.flav.potion = {}; G.flav.scroll = {}; G.flav.wand = {};
  const pl = shuffle([...POTION_LOOKS]), sl = shuffle([...SCROLL_LOOKS]), wl = shuffle([...WAND_LOOKS]);
  Object.keys(POTIONS).forEach((k, i) => G.flav.potion[k] = pl[i % pl.length]);
  Object.keys(SCROLLS).forEach((k, i) => G.flav.scroll[k] = sl[i % sl.length]);
  Object.keys(WANDS).forEach((k, i) => G.flav.wand[k] = wl[i % wl.length]);
  for (const k of c.kit) {
    const [id, q] = k; let it;
    if (id.startsWith('P:')) { it = makeCons('potion', id.slice(2), q); G.known['potion:' + id.slice(2)] = 1; }
    else if (id.startsWith('S:')) { it = makeCons('scroll', id.slice(2), q); G.known['scroll:' + id.slice(2)] = 1; }
    else if (id.startsWith('A:')) it = makeArrows(q);
    else it = makeEquip(id, 1, { rar: 0, noCurse: 1 });
    it.id = true;
    if (it.k === 'eq') { const s = BASES[it.b].slot; G.p.equip[s === 'ring' ? 'ring1' : s] = it; } else addInv(it, true);
  }
  G.p.inv.push(Object.assign(makeCons('scroll', 'ret', 1), { id: true })); G.known['scroll:ret'] = 1;
  G.quick[0] = { t: 'item', key: 'potion:heal' };
  G.p.spells.forEach((s, i) => { if (i < 3) G.quick[i + 1] = { t: 'spell', id: s }; });
  if (cls === 'warrior') G.quick[1] = { t: 'item', key: 'scroll:ret' };
  calc(); G.p.hp = G.s.mhp; G.p.mp = G.s.mmp;
  G.levels['0'] = genTown(1);
  placePlayer(G.levels['0'].start.x, G.levels['0'].start.y);
  genShops('0');
  msg(`Welcome, ${G.name}. The village of Ravensfjord lies in the shadow of the old Barrow.`, '#fd8');
  msg('Visit the Jarl\'s Hall (bottom) for your quest. Tap to move, tap foes to attack.', '#fd8');
  fov();
}

function placePlayer(x, y) { G.p.x = x; G.p.y = y; }

// ===================== ITEMS =====================
function addMods(a, b) { for (const k in b) a[k] = (a[k] || 0) + b[k]; return a; }
function rollRarity(L) {
  const r = Math.random();
  if (r < 0.008 + L * 0.004) return 3;
  if (r < 0.06 + L * 0.014) return 2;
  if (r < 0.28 + L * 0.02) return 1;
  return 0;
}
function makeEquip(b, L, o = {}) {
  const B = BASES[b];
  const it = { uid: G.uid++, k: 'eq', b, ench: 0, mods: {}, rar: 0, id: false, cursed: false, ilvl: L };
  if (B.quest) { it.id = true; it.rar = 3; return it; }
  let rar = o.rar != null ? o.rar : rollRarity(L);
  if (rar === 3) { const u = makeUnique(L, b); if (u) return u; rar = 2; }
  if (B.jewel && rar === 0) rar = 1;
  it.rar = rar;
  const t = SLOT_TYPE(B.slot);
  if (rar >= 1) {
    const usePre = rar === 2 || chance(0.5), useSuf = rar === 2 || !usePre;
    if (usePre) { const ps = PREFIXES.filter(p => p.t.includes(t) && (p.min || 0) <= L); if (ps.length) { const p = pick(ps); it.pre = p.n; addMods(it.mods, p.m(L)); } }
    if (useSuf) { const ss = SUFFIXES.filter(p => p.t.includes(t) && (p.min || 0) <= L); if (ss.length) { const s = pick(ss); it.suf = s.n; addMods(it.mods, s.m(L)); } }
    if (rar === 2) { const ss = SUFFIXES.filter(p => p.t.includes(t) && (p.min || 0) <= L && p.n !== it.suf); addMods(it.mods, pick(ss).m(L)); }
    if (!B.jewel) it.ench = rnd(1, Math.min(5, 1 + (L / 3 | 0))) + (rar === 2 ? 1 : 0);
  }
  if (!o.noCurse && rar <= 1 && chance(0.09)) {
    it.cursed = true; it.rar = 1; it.pre = null; it.suf = null; it.mods = {};
    it.ench = -rnd(1, 3);
    if (B.jewel) { it.mods[pick(STATS4)] = -rnd(1, 3); it.suf = 'of Woe'; }
  }
  it.id = it.rar === 0 && !it.cursed;
  if (o.id) it.id = true;
  return it;
}
function makeUnique(L, prefBase) {
  let c = UNIQUES.filter(u => u.lvl <= L + 1 && !G.foundU.includes(u.n));
  if (!c.length) return null;
  if (prefBase) { const pc = c.filter(u => u.b === prefBase); if (pc.length && chance(0.5)) c = pc; }
  const u = pick(c);
  G.foundU.push(u.n);
  return { uid: G.uid++, k: 'eq', b: u.b, ench: u.ench || 0, mods: Object.assign({}, u.mods), rar: 3, uniq: u.n, id: false, cursed: false, ilvl: u.lvl };
}
function makeCons(k, b, q = 1) {
  const it = { uid: G.uid++, k, b, q, id: false };
  if (k === 'wand') { it.chg = rnd(...WANDS[b].ch); it.q = 1; }
  return it;
}
function makeArrows(q) { return { uid: G.uid++, k: 'arrows', b: 'arrows', q, id: true }; }
function makeBook(sp) { return { uid: G.uid++, k: 'book', b: sp, q: 1, id: true }; }
function makeGold(n) { return { uid: G.uid++, k: 'gold', b: 'gold', q: n, id: true }; }

function randomItem(L, kindHint) {
  const r = kindHint || wpick(['eq', 'potion', 'scroll', 'wand', 'book', 'arrows'], k => ({ eq: 42, potion: 26, scroll: 20, wand: 5, book: 4, arrows: 3 })[k]);
  if (r === 'eq') {
    const bs = Object.keys(BASES).filter(b => BASES[b].lvl <= L + 1 && !BASES[b].quest);
    const b = wpick(bs, b => 1 + (BASES[b].lvl >= L - 2 ? 2 : 0));
    return makeEquip(b, L);
  }
  if (r === 'potion') { const ks = Object.keys(POTIONS).filter(k => POTIONS[k].lvl <= L); return makeCons('potion', wpick(ks, k => POTIONS[k].w)); }
  if (r === 'scroll') { const ks = Object.keys(SCROLLS).filter(k => SCROLLS[k].lvl <= L); return makeCons('scroll', wpick(ks, k => SCROLLS[k].w)); }
  if (r === 'wand') { const ks = Object.keys(WANDS).filter(k => WANDS[k].lvl <= L); return makeCons('wand', wpick(ks, k => WANDS[k].w)); }
  if (r === 'book') { const ks = Object.keys(SPELLS).filter(k => SPELLS[k].tier <= 1 + (L / 2 | 0) + 1); return makeBook(pick(ks)); }
  return makeArrows(rnd(8, 20));
}

function isKnown(it) {
  if (it.k === 'potion' || it.k === 'scroll' || it.k === 'wand') return !!G.known[it.k + ':' + it.b];
  return true;
}
function itemIcon(it, size) { return itemImgHTML(it, size || 32); }
function itemColor(it) {
  if (it.k === 'relic' || it.k === 'key') return '#ffcf5a';
  if (it.k === 'eq') { if (it.id && it.cursed) return '#e55'; return ['#e8e8e8', '#6af', '#fd4', '#f93'][it.rar]; }
  if (it.k === 'book') return '#c9f';
  if (it.k === 'gold') return '#fd4';
  return '#e8e8e8';
}
function itemName(it, noQty) {
  const q = (!noQty && it.q > 1) ? it.q + '× ' : '';
  switch (it.k) {
    case 'eq': {
      const B = BASES[it.b];
      if (!it.id) return B.n + (it.rar > 0 || it.cursed ? ' ?' : '');
      if (it.uniq) return it.uniq;
      const e = it.ench > 0 ? '+' + it.ench + ' ' : it.ench < 0 ? it.ench + ' ' : '';
      return e + (it.pre ? it.pre + ' ' : '') + B.n + (it.suf ? ' ' + it.suf : '');
    }
    case 'potion': return q + (isKnown(it) ? 'Potion of ' + POTIONS[it.b].n : G.flav.potion[it.b] + ' Potion');
    case 'scroll': return q + (isKnown(it) ? 'Scroll of ' + SCROLLS[it.b].n : 'Scroll "' + G.flav.scroll[it.b] + '"');
    case 'wand': return isKnown(it) ? 'Wand of ' + WANDS[it.b].n + (it.id ? ' (' + it.chg + ')' : '') : G.flav.wand[it.b] + ' Wand';
    case 'book': return 'Tome: ' + SPELLS[it.b].n;
    case 'arrows': return 'Arrows ×' + it.q;
    case 'gold': return it.q + ' gold';
    case 'chest': return 'Treasure Chest';
    case 'relic': return RELICS[it.b].n;
    case 'key': return 'Cell Key (' + levelName(it.b) + ')';
  }
  return '?';
}
function itemStats(it) {
  const B = BASES[it.b];
  const s = Object.assign({}, B.mods || {});
  addMods(s, it.mods || {});
  if (B.slot === 'weapon' || B.slot === 'bow') { s.hit = (s.hit || 0) + it.ench; s.dmg = (s.dmg || 0) + it.ench; }
  else if (B.ac != null) s.ac = (s.ac || 0) + B.ac + it.ench;
  return s;
}
const MOD_LABEL = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence', con: 'Constitution', ac: 'Armor', hit: 'To-hit', dmg: 'Damage', mhp: 'Max HP', mmp: 'Max MP',
  efire: 'Fire damage', ecold: 'Cold damage', eshock: 'Lightning damage', rFire: 'Fire resist %', rCold: 'Cold resist %', rShock: 'Lightning resist %',
  regen: 'Regeneration', leech: 'Life steal %', light: 'Light radius', gold: 'Gold find %', speed: 'Speed %' };
function itemDesc(it) {
  const lines = [];
  if (it.k === 'eq') {
    const B = BASES[it.b];
    lines.push(`<span style="color:${itemColor(it)}">${it.id ? RAR_NAME[it.rar] : (it.rar > 0 || it.cursed ? 'Unidentified' : 'Common')}</span> · ${SLOT_LABEL[B.slot === 'ring' ? 'ring1' : B.slot] || B.slot}${B.two ? ' · two-handed' : ''}`);
    if (B.dmg) lines.push(`Damage ${B.dmg[0]}–${B.dmg[1]}`);
    if (B.ac != null) lines.push(`Base armor ${B.ac}`);
    if (it.id) {
      const s = itemStats(it);
      for (const k in s) { if (!s[k]) continue; if (k === 'ac' && B.ac != null && s[k] === B.ac) continue; lines.push(`${s[k] > 0 ? '+' : ''}${s[k]} ${MOD_LABEL[k] || k}`); }
      if (it.cursed) lines.push('<span style="color:#e55">Cursed — cannot be removed</span>');
    } else if (it.rar > 0 || it.cursed) lines.push('<i>Its powers are unknown. Equip it or have the Sage look at it.</i>');
    if (B.quest) lines.push('<i>The ancient crown of the Storm Kings. Bring it to the Jarl!</i>');
  } else if (it.k === 'potion') lines.push(isKnown(it) ? POTIONS[it.b].desc : 'An unknown potion. Drink to find out.');
  else if (it.k === 'scroll') lines.push(isKnown(it) ? SCROLLS[it.b].desc : 'Runes you cannot read yet. Read it to find out.');
  else if (it.k === 'wand') { if (isKnown(it)) { lines.push('Casts ' + SPELLS[WANDS[it.b].spell].n + '. ' + SPELLS[WANDS[it.b].spell].desc); lines.push(it.id ? it.chg + ' charges' : 'Charges unknown'); } else lines.push('Zap it at a foe to learn what it does.'); }
  else if (it.k === 'book') { const S = SPELLS[it.b]; lines.push(`Teaches ${S.n} (tier ${S.tier}, ${S.mp} MP).`); lines.push(S.desc); if (G.p.spells.includes(it.b)) lines.push('<i>You already know this spell.</i>'); }
  else if (it.k === 'arrows') lines.push('Ammunition for a bow. Tap a distant foe with a bow equipped to shoot.');
  else if (it.k === 'relic') lines.push('A sacred relic stolen from the Stone Circle in the Ironwood. Place it on the right pedestal.');
  else if (it.k === 'key') lines.push(`Opens the prisoner's cell on ${levelName(it.b)}. Bump the barred cell door to use it.`);
  lines.push(`Value: ${itemValue(it)} gold`);
  return lines.join('<br>');
}
// rough usefulness score so gear can be compared at a glance
function itemScore(it) {
  if (!it || it.k !== 'eq') return 0;
  if (!it.id) return null;
  if (it.cursed) return -50;
  const B = BASES[it.b], s = itemStats(it), g = k => s[k] || 0;
  let v = 0;
  if (B.dmg) v += (B.dmg[0] + B.dmg[1]) / 2 * 2;
  v += g('dmg') * 2 + g('hit') * 0.7 + g('ac') * 2;
  v += (g('str') + g('dex') + g('int') + g('con')) * 2.5;
  v += (g('mhp') + g('mmp')) * 0.4 + (g('efire') + g('ecold') + g('eshock')) * 0.9;
  v += (g('rFire') + g('rCold') + g('rShock')) * 0.12 + g('regen') * 6 + g('leech') * 0.4 + g('light') * 1.5 + g('gold') * 0.08 + g('speed') * 0.8;
  return v;
}
// how much better (positive) or worse (negative) than what is worn in that slot
function upgradeDelta(it) {
  if (it.k !== 'eq') return null;
  const sc = itemScore(it); if (sc === null) return null;
  const B = BASES[it.b], e = G.p.equip;
  let cur;
  if (B.slot === 'ring') cur = Math.min(e.ring1 ? itemScore(e.ring1) : 0, e.ring2 ? itemScore(e.ring2) : 0);
  else { cur = e[B.slot] ? itemScore(e[B.slot]) : 0; if (B.slot === 'weapon' && B.two && e.shield) cur += itemScore(e.shield); }
  return sc - (cur || 0);
}
function equippedFor(it) {
  const B = BASES[it.b], e = G.p.equip;
  if (B.slot === 'ring') { if (!e.ring1 || !e.ring2) return null; return itemScore(e.ring1) <= itemScore(e.ring2) ? e.ring1 : e.ring2; }
  return e[B.slot] || null;
}
function itemValue(it) {
  switch (it.k) {
    case 'eq': { const B = BASES[it.b]; let v = B.v * (1 + 0.6 * Object.keys(it.mods || {}).length + Math.max(0, it.ench) * 0.35); if (it.uniq) v *= 3; if (it.cursed) v *= 0.1; return Math.max(1, Math.round(v)); }
    case 'potion': return POTIONS[it.b].v * it.q;
    case 'scroll': return SCROLLS[it.b].v * it.q;
    case 'wand': return Math.round(WANDS[it.b].v * (0.3 + 0.1 * it.chg));
    case 'book': { const t = SPELLS[it.b].tier; return 40 + t * t * 55; }
    case 'arrows': return it.q;
    case 'gold': return it.q;
    case 'relic': case 'key': return 0;
  }
  return 1;
}
function stackKey(it) { return (it.k === 'potion' || it.k === 'scroll' || it.k === 'arrows') ? it.k + ':' + it.b : null; }
function addInv(it, silent) {
  const p = G.p;
  if (it.k === 'gold') { p.gold += it.q; return true; }
  const key = stackKey(it);
  if (key) { const ex = p.inv.find(i => stackKey(i) === key); if (ex) { ex.q += it.q; return true; } }
  if (p.inv.length >= MAX_INV && it.k !== 'relic' && it.k !== 'key') { if (!silent) msg('Your pack is full!', '#f88'); return false; }
  p.inv.push(it); return true;
}
function removeOne(it) {
  const p = G.p;
  if (it.q > 1 && stackKey(it)) { it.q--; return; }
  const i = p.inv.indexOf(it); if (i >= 0) p.inv.splice(i, 1);
}
function findQuickItem(key) {
  const p = G.p;
  if (key.startsWith('wand:')) return p.inv.find(i => i.k === 'wand' && i.uid === +key.slice(5));
  return p.inv.find(i => stackKey(i) === key);
}
function quickKeyFor(it) { return it.k === 'wand' ? 'wand:' + it.uid : stackKey(it); }

// ===================== DERIVED STATS =====================
function calc() {
  const p = G.p;
  const s = { ac: 0, hit: 0, dmg: 0, mhp: 0, mmp: 0, efire: 0, ecold: 0, eshock: 0, rFire: 0, rCold: 0, rShock: 0, regen: 0, leech: 0, light: 0, gold: 0, speed: 0 };
  for (const k of STATS4) s[k] = p[k] - p.drain[k];
  for (const sl of EQ_SLOTS) {
    const it = p.equip[sl]; if (!it) continue;
    const m = itemStats(it); const isW = sl === 'weapon' || sl === 'bow';
    for (const k in m) { if (isW && WEAPON_KEYS.includes(k)) continue; s[k] = (s[k] || 0) + m[k]; }
  }
  if (p.st.shield) s.ac += 5 * (p.st.shieldN || 1);
  if (p.st.resist) { s.rFire += 50; s.rCold += 50; s.rShock += 50; }
  s.rFire = Math.min(85, s.rFire); s.rCold = Math.min(85, s.rCold); s.rShock = Math.min(85, s.rShock);
  s.ac += Math.floor((s.dex - 10) / 3);
  s.mhp = Math.max(5, p.baseHp + s.mhp + Math.floor((s.con - 10) * p.lvl / 2.5));
  s.mmp = Math.max(0, p.baseMp + s.mmp + Math.floor((s.int - 10) * p.lvl / 2.5));
  s.light = 6 + s.light;
  s.speed = Math.min(40, s.speed);
  G.s = s;
  if (p.hp > s.mhp) p.hp = s.mhp;
  if (p.mp > s.mmp) p.mp = s.mmp;
  return s;
}
const xpNext = l => Math.floor(12 * Math.pow(l, 1.6));
function spellPower() { return G.p.lvl + Math.max(0, Math.floor((G.s.int - 10) / 2)); }

// ===================== LEVEL GENERATION =====================
function blankLevel(w, h, depth, fill) {
  return { depth, w, h, t: new Array(w * h).fill(fill), seen: new Array(w * h).fill(0), mons: [], items: [], traps: [], up: null, down: null };
}
function genDungeon(key) {
  key = K(key); const depth = depthOf(key), kind = kindOf(key), links = linksFor(key);
  const L = blankLevel(DW, DH, depth, '#'); L.key = key; L.kind = kind;
  const set = (x, y, c) => { L.t[y * DW + x] = c; };
  const get = (x, y) => L.t[y * DW + x];
  const rooms = [];
  const target = rnd(9, 13);
  for (let tries = 0; tries < 400 && rooms.length < target; tries++) {
    const w = rnd(4, 10), h = rnd(4, 7);
    const x = rnd(1, DW - w - 2), y = rnd(1, DH - h - 2);
    if (rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
    rooms.push({ x, y, w, h, cx: x + (w / 2 | 0), cy: y + (h / 2 | 0) });
  }
  for (const r of rooms) for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) set(xx, yy, '.');
  rooms.sort((a, b) => a.cx - b.cx);
  const corridor = (a, b) => {
    let x = a.cx, y = a.cy;
    const hFirst = chance(0.5);
    const stepX = () => { while (x !== b.cx) { x += Math.sign(b.cx - x); if (get(x, y) === '#') set(x, y, ':'); } };
    const stepY = () => { while (y !== b.cy) { y += Math.sign(b.cy - y); if (get(x, y) === '#') set(x, y, ':'); } };
    if (hFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
  };
  for (let i = 0; i < rooms.length - 1; i++) corridor(rooms[i], rooms[i + 1]);
  for (let i = 0; i < 3; i++) corridor(pick(rooms), pick(rooms));
  // doors where corridors meet rooms
  for (const r of rooms) {
    for (let xx = r.x - 1; xx <= r.x + r.w; xx++) for (const yy of [r.y - 1, r.y + r.h]) tryDoor(xx, yy);
    for (let yy = r.y; yy < r.y + r.h; yy++) for (const xx of [r.x - 1, r.x + r.w]) tryDoor(xx, yy);
  }
  function tryDoor(x, y) {
    if (x < 1 || y < 1 || x >= DW - 1 || y >= DH - 1) return;
    if (get(x, y) !== ':') return;
    const hw = get(x - 1, y) === '#' && get(x + 1, y) === '#', vw = get(x, y - 1) === '#' && get(x, y + 1) === '#';
    if ((hw || vw) && chance(0.55)) set(x, y, chance(0.75) ? '+' : "'");
  }
  for (let i = 0; i < L.t.length; i++) if (L.t[i] === ':') L.t[i] = '.';
  // stairs
  const first = rooms[0], last = rooms[rooms.length - 1];
  L.up = { x: first.cx, y: first.cy }; set(L.up.x, L.up.y, '<');
  if (links['>']) { L.down = { x: last.cx, y: last.cy }; set(L.down.x, L.down.y, '>'); }
  for (const r of rooms) r.lit = chance(kind === 'deep' ? 0.3 : 0.75 - depth * 0.05);
  L.rooms = rooms;
  G.levels[key] = L; // register for helpers
  const prevLoc = G.loc; G.loc = key;
  const freeSpot = (minD) => {
    for (let t = 0; t < 500; t++) {
      const r = pick(rooms); const x = rnd(r.x, r.x + r.w - 1), y = rnd(r.y, r.y + r.h - 1);
      if (get(x, y) !== '.') continue;
      if (monAt(x, y)) continue;
      if (minD && dist(x, y, L.up.x, L.up.y) < minD) continue;
      return { x, y };
    }
    return null;
  };
  // monsters
  const zone = kind === 'deep' ? 'deep' : 'barrow';
  const nm = kind === 'deep' ? 16 + (depth - 13) : 7 + Math.floor(depth * 1.6);
  for (let i = 0; i < nm; i++) spawnMonster(depth, freeSpot(7), true, zone);
  if (key === '5') { const s = { x: L.down.x + 1, y: L.down.y }; const ok = get(s.x, s.y) === '.' ? s : freeSpot(10); addMon('grimtusk', ok.x, ok.y, true); }
  if (key === '10') { addMon('hrimfang', last.cx, last.cy, true); }
  if (kind === 'deep') {
    carveCell(L, rooms, set, get);
    if (key === 's10') { const w = addMon('warden', last.cx, last.cy, true); w.carry = 'key'; }
    else { const sp = freeSpot(12) || freeSpot(); if (sp) { const j = addMon('jailer', sp.x, sp.y, true); j.carry = 'key'; } }
  }
  // items
  const ni = rnd(5, 8) + (depth / 2 | 0);
  for (let i = 0; i < ni; i++) { const s = freeSpot(); if (s) L.items.push({ x: s.x, y: s.y, it: randomItem(depth) }); }
  const ng = rnd(4, 7);
  for (let i = 0; i < ng; i++) { const s = freeSpot(); if (s) L.items.push({ x: s.x, y: s.y, it: makeGold(rnd(3, 12) * goldScale(depth)) }); }
  const nc = rnd(0, 2);
  for (let i = 0; i < nc; i++) { const s = freeSpot(6); if (s) L.items.push({ x: s.x, y: s.y, it: { uid: G.uid++, k: 'chest', b: 'chest', q: 1, id: true } }); }
  // traps
  const nt = rnd(2, 4) + (depth / 2 | 0);
  for (let i = 0; i < nt; i++) {
    for (let t = 0; t < 50; t++) {
      const x = rnd(1, DW - 2), y = rnd(1, DH - 2);
      if (get(x, y) !== '.' || trapAt(x, y) || dist(x, y, L.up.x, L.up.y) < 4) continue;
      const types = links['>'] ? ['dart', 'pit', 'tele', 'fire', 'alarm'] : ['dart', 'tele', 'fire', 'alarm'];
      L.traps.push({ x, y, type: pick(types), found: false }); break;
    }
  }
  G.loc = prevLoc;
  return L;
}
// a locked cell (3x3) carved off a room wall, with a captive villager inside
function carveCell(L, rooms, set, get) {
  const solid = (x, y) => x > 0 && y > 0 && x < L.w - 1 && y < L.h - 1 && get(x, y) === '#';
  for (let t = 0; t < 400; t++) {
    const r = pick(rooms.slice(1));
    const side = rnd(0, 3);
    let dx = 0, dy = 0, doorX, doorY;
    if (side === 0) { doorX = rnd(r.x, r.x + r.w - 1); doorY = r.y - 1; dy = -1; }
    else if (side === 1) { doorX = rnd(r.x, r.x + r.w - 1); doorY = r.y + r.h; dy = 1; }
    else if (side === 2) { doorX = r.x - 1; doorY = rnd(r.y, r.y + r.h - 1); dx = -1; }
    else { doorX = r.x + r.w; doorY = rnd(r.y, r.y + r.h - 1); dx = 1; }
    if (!solid(doorX, doorY)) continue;
    const cx = doorX + dx * 2, cy = doorY + dy * 2; // cell centre
    let ok = true;
    for (let yy = cy - 2; yy <= cy + 2 && ok; yy++) for (let xx = cx - 2; xx <= cx + 2; xx++) { if (xx === doorX && yy === doorY) continue; if (!solid(xx, yy)) { ok = false; break; } }
    if (!ok) continue;
    for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) set(xx, yy, '.');
    set(doorX, doorY, 'J');
    L.captive = { x: cx, y: cy, freed: false, door: { x: doorX, y: doorY }, name: pick(['Astrid', 'Bjorn', 'Gudrun', 'Hakon', 'Ingrid', 'Kari', 'Leif', 'Solveig', 'Tove', 'Ulf', 'Yrsa', 'Arne']) };
    return true;
  }
  return false;
}
function zoneOf(k) { return MONSTERS[k].zone || 'barrow'; }
function monPool(depth, zone = 'barrow') {
  let pool = Object.keys(MONSTERS).filter(k => { const d = MONSTERS[k].d; return zoneOf(k) === zone && d <= depth && d >= depth - 3; });
  if (!pool.length) pool = Object.keys(MONSTERS).filter(k => zoneOf(k) === zone && MONSTERS[k].d < 99);
  return pool;
}
function spawnMonster(depth, spot, asleep, zone) {
  if (!spot) return;
  zone = zone || (lvl() && lvl().kind === 'forest' ? 'forest' : lvl() && lvl().kind === 'deep' ? 'deep' : 'barrow');
  let pool = monPool(depth, zone);
  if (chance(0.08)) pool = monPool(depth + 1, zone);
  const id = wpick(pool, k => 1 + (MONSTERS[k].d === depth ? 2 : 0));
  const D = MONSTERS[id];
  addMon(id, spot.x, spot.y, asleep);
  if (D.pack) {
    const n = rnd(D.pack[0], D.pack[1]) - 1;
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < 10; t++) { const x = spot.x + rnd(-2, 2), y = spot.y + rnd(-2, 2); if (inb(x, y) && isFree(x, y)) { addMon(id, x, y, asleep); break; } }
    }
  }
}
function addMon(id, x, y, asleep) {
  const D = MONSTERS[id];
  const m = { id, x, y, hp: D.hp, mhp: D.hp, en: rnd(0, 99), asleep: !!asleep && !D.boss && chance(0.7), track: 0, uid: G.uid++, sleepT: 0, slow: 0 };
  if (D.boss) m.asleep = false;
  lvl().mons.push(m); return m;
}

// ===================== FOREST =====================
const FW = 56, FH = 40;
function genForest(key) {
  key = K(key);
  const n = +key.slice(1), depth = depthOf(key);
  let L, tries = 0;
  for (;;) {
    tries++;
    L = blankLevel(FW, FH, depth, 'T'); L.key = key; L.kind = 'forest';
    let g = new Uint8Array(FW * FH);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) g[y * FW + x] = (x < 2 || y < 2 || x >= FW - 2 || y >= FH - 2) ? 1 : (Math.random() < 0.43 ? 1 : 0);
    for (let it = 0; it < 5; it++) {
      const ng = new Uint8Array(FW * FH);
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
        if (x < 1 || y < 1 || x >= FW - 1 || y >= FH - 1) { ng[y * FW + x] = 1; continue; }
        let c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) c += g[(y + dy) * FW + x + dx];
        ng[y * FW + x] = c >= 5 || (it < 2 && c <= 1) ? 1 : 0;
      }
      g = ng;
    }
    for (let i = 0; i < g.length; i++) L.t[i] = g[i] ? 'T' : ',';
    // keep the largest open region
    const reg = new Int32Array(FW * FH).fill(-1); let best = -1, bestN = 0, id = 0;
    for (let i = 0; i < L.t.length; i++) {
      if (L.t[i] !== ',' || reg[i] >= 0) continue;
      const q = [i]; reg[i] = id; let cnt = 0;
      while (q.length) { const c = q.pop(); cnt++; const cx = c % FW, cy = c / FW | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy, ni = ny * FW + nx; if (nx >= 0 && ny >= 0 && nx < FW && ny < FH && L.t[ni] === ',' && reg[ni] < 0) { reg[ni] = id; q.push(ni); } } }
      if (cnt > bestN) { bestN = cnt; best = id; } id++;
    }
    for (let i = 0; i < L.t.length; i++) if (L.t[i] === ',' && reg[i] !== best) L.t[i] = 'T';
    if (bestN >= 650 || tries > 20) break;
  }
  const set = (x, y, c) => { if (x > 0 && y > 0 && x < FW - 1 && y < FH - 1) L.t[y * FW + x] = c; };
  const get = (x, y) => (x < 0 || y < 0 || x >= FW || y >= FH) ? 'T' : L.t[y * FW + x];
  G.levels[key] = L; const prevLoc = G.loc; G.loc = key;
  const walkPass = (x, y) => isWalk(x, y);
  // entrance on the east side (from town / previous area), exit far away
  let ent = null;
  for (let x = FW - 2; x > 0 && !ent; x--) for (let y = 2; y < FH - 2; y++) if (get(x, y) === ',') { ent = { x, y }; break; }
  set(ent.x, ent.y, '<'); L.up = ent;
  let D = bfs(ent.x, ent.y, walkPass);
  let far = null, fd = -1;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const d = D[y * FW + x]; if (d > fd) { fd = d; far = { x, y }; } }
  if (key === 'f3') {
    // the Stone Circle clearing
    const c = far.x < 10 ? { x: 10, y: far.y } : far; c.y = clamp(c.y, 9, FH - 10); c.x = clamp(c.x, 9, FW - 10);
    for (let y = c.y - 7; y <= c.y + 7; y++) for (let x = c.x - 7; x <= c.x + 7; x++) if ((x - c.x) ** 2 + (y - c.y) ** 2 <= 46) set(x, y, ',');
    // connect clearing to the forest along a line
    const pts = line(c.x, c.y, ent.x, ent.y);
    for (const [x, y] of pts) { if (get(x, y) === ',' && Math.hypot(x - c.x, y - c.y) > 8 && D[y * FW + x] >= 0) break; set(x, y, ','); set(x + 1, y, ','); set(x, y + 1, ','); }
    L.ped = { N: { x: c.x, y: c.y - 3, r: null }, E: { x: c.x + 3, y: c.y, r: null }, S: { x: c.x, y: c.y + 3, r: null }, W: { x: c.x - 3, y: c.y, r: null } };
    for (const k in L.ped) set(L.ped[k].x, L.ped[k].y, 'P');
    set(c.x, c.y, 'G'); L.gate = { x: c.x, y: c.y };
    set(c.x, c.y + 6, 'R'); L.tablet = { x: c.x, y: c.y + 6 };
    for (const [dx, dy] of [[-4, -4], [4, -4], [-4, 4], [4, 4], [-6, 0], [6, 0], [0, -6]]) set(c.x + dx, c.y + dy, 'O');
    L.circle = c;
  } else { set(far.x, far.y, '>'); L.down = far; }
  // trail from entrance to exit/circle
  D = bfs(ent.x, ent.y, walkPass);
  const goal = L.down || { x: L.circle.x, y: L.circle.y + 7 };
  let cx = goal.x, cy = goal.y;
  for (let guard = 0; guard < 2000 && D[cy * FW + cx] > 0; guard++) {
    let nb = null, bd = D[cy * FW + cx];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (dx && dy) continue; const nx = cx + dx, ny = cy + dy; const d = D[ny * FW + nx]; if (d >= 0 && d < bd) { bd = d; nb = [nx, ny]; } }
    if (!nb) break; [cx, cy] = nb; if (get(cx, cy) === ',') set(cx, cy, '=');
  }
  // ponds (kept only if they don't cut the trail)
  for (let i = 0; i < rnd(2, 4); i++) {
    const px = rnd(6, FW - 7), py = rnd(6, FH - 7), r = rnd(2, 3); const changed = [];
    if (L.circle && Math.hypot(px - L.circle.x, py - L.circle.y) < 12) continue;
    for (let y = py - r; y <= py + r; y++) for (let x = px - r; x <= px + r; x++) if ((x - px) ** 2 + (y - py) ** 2 <= r * r + 1 && get(x, y) === ',') { changed.push([x, y]); set(x, y, '~'); }
    const D2 = bfs(ent.x, ent.y, walkPass); const tgt = L.down || L.tablet;
    if (D2[tgt.y * FW + tgt.x] < 0 && !(L.ped && D2[(L.tablet.y - 1) * FW + L.tablet.x] >= 0)) for (const [x, y] of changed) set(x, y, ',');
  }
  for (let i = 0; i < 40; i++) { const x = rnd(2, FW - 3), y = rnd(2, FH - 3); if (get(x, y) === ',') set(x, y, 'f'); }
  L.seen = new Array(FW * FH).fill(0);
  const freeSpot = (minD) => { for (let t = 0; t < 800; t++) { const x = rnd(2, FW - 3), y = rnd(2, FH - 3); if ((get(x, y) === ',' || get(x, y) === 'f') && !monAt(x, y) && dist(x, y, ent.x, ent.y) >= (minD || 0)) return { x, y }; } return null; };
  for (let i = 0; i < 13 + n * 3; i++) spawnMonster(depth, freeSpot(9), chance(0.6), 'forest');
  // thieves carrying the stolen relics
  const thieves = { f1: ['sun'], f2: ['moon', 'raven'], f3: [] }[key];
  for (const r of thieves) if (!G.quest['relic_' + r]) { const sp = freeSpot(14); if (sp) { const m = addMon('thief', sp.x, sp.y, false); m.carry = r; } }
  if (key === 'f3' && !G.quest.relic_wolf) { const c = L.circle; const sp = freeSpot(14) || { x: c.x, y: c.y + 4 }; const m = addMon('sigrun', sp.x, sp.y, true); m.carry = 'wolf'; }
  for (let i = 0; i < rnd(7, 10); i++) { const sp = freeSpot(); if (sp) L.items.push({ x: sp.x, y: sp.y, it: randomItem(depth) }); }
  for (let i = 0; i < rnd(4, 7); i++) { const sp = freeSpot(); if (sp) L.items.push({ x: sp.x, y: sp.y, it: makeGold(rnd(5, 12) * goldScale(depth)) }); }
  for (let i = 0; i < rnd(1, 2); i++) { const sp = freeSpot(10); if (sp) L.items.push({ x: sp.x, y: sp.y, it: { uid: G.uid++, k: 'chest', b: 'chest', q: 1, id: true } }); }
  G.loc = prevLoc;
  return L;
}
function genLevel(key) { const k = kindOf(key); return k === 'town' ? genTown(key === 't2' ? 2 : 1) : k === 'forest' ? genForest(key) : genDungeon(key); }
const TOWN_VER = 3;
function genTown(ch = 1) {
  const L = blankLevel(TW, TH, 0, ',');
  L.town = true; L.tv = TOWN_VER; L.ch = ch; L.key = ch === 2 ? 't2' : '0'; L.kind = 'town';
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < TW && y < TH) L.t[y * TW + x] = c; };
  const get = (x, y) => (x < 0 || y < 0 || x >= TW || y >= TH) ? 'T' : L.t[y * TW + x];
  for (let x = 0; x < TW; x++) { set(x, 0, 'M'); set(x, 1, 'M'); set(x, TH - 1, 'T'); }
  for (let y = 0; y < TH; y++) { set(0, y, 'T'); set(TW - 1, y, 'T'); }
  // roads
  for (let y = 2; y <= 19; y++) { set(17, y, '='); set(18, y, '='); }
  for (let x = 2; x <= 34; x++) { set(x, 9, '='); set(x, 10, '='); set(x, 17, '='); set(x, 18, '='); }
  for (let x = 11; x <= 25; x++) { set(x, 19, '='); set(x, 25, '='); set(x, 26, '='); }
  for (let y = 19; y <= 26; y++) { set(11, y, '='); set(25, y, '='); }
  L.doors = {}; L.bld = [];
  const B = (id, x, y, w, h) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, 'B');
    const dx = x + (w / 2 | 0), dy = y + h - 1;
    set(dx, dy, 'S'); L.doors[dy * TW + dx] = id;
    for (let yy = dy + 1; get(dx, yy) !== '=' && yy < TH - 1; yy++) set(dx, yy, '=');
    L.bld.push({ id, x, y, w, h, door: { x: dx, y: dy } });
  };
  B('general', 2, 4, 7, 4); B('smith', 10, 4, 7, 4); B('armor', 20, 4, 7, 4); B('alch', 28, 4, 7, 4);
  B('mage', 2, 12, 7, 4); B('temple', 10, 12, 7, 4); B('sage', 20, 12, 7, 4); B('tavern', 28, 12, 7, 4);
  B(ch === 2 ? 'lodge' : 'jarl', 13, 20, 11, 5);
  // west road out of town + waystone
  set(0, 9, 'E'); set(1, 9, '='); set(0, 10, 'T'); set(1, 10, '=');
  set(14, 18, 'Y'); L.way = { x: 14, y: 18 };
  set(18, 1, '>'); L.down = { x: 18, y: 1 }; L.start = { x: 18, y: 3 };
  // decorations (not walkable)
  for (const [x, y] of [[16, 8], [19, 8], [16, 16], [19, 16], [10, 24], [26, 24]]) set(x, y, 'L');
  for (const [x, y] of [[35, 14], [35, 15], [27, 15], [9, 7]]) set(x, y, 'X');
  if (ch === 1) {
    set(30, 22, 'W');
    for (let x = 2; x <= 8; x++) set(x, 22, 'F');
    for (let x = 28; x <= 34; x++) set(x, 25, 'F');
  } else {
    for (let y = 20; y <= 26; y++) for (let x = 27; x <= 35; x++) if (((x - 31.5) / 4.6) ** 2 + ((y - 23.5) / 3.4) ** 2 <= 1) set(x, y, '~');
    for (let y = 20; y <= 26; y++) for (let x = 2; x <= 9; x++) if (((x - 5.5) / 3.6) ** 2 + ((y - 23) / 2.6) ** 2 <= 1) set(x, y, '~');
  }
  // trees and bushes on open snow, never touching roads or buildings
  const nearBusy = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = get(x + dx, y + dy); if (c === '=' || c === 'B' || c === 'S' || c === '>' || c === 'L' || c === 'W') return true; } return false; };
  for (let i = 0, n = 0; i < 400 && n < 34; i++) { const x = rnd(1, TW - 2), y = rnd(2, TH - 2); if (get(x, y) === ',' && !nearBusy(x, y) && !nearBusy(x, y + 1)) { set(x, y, 'T'); n++; } }
  for (let i = 0, n = 0; i < 200 && n < 10; i++) { const x = rnd(1, TW - 2), y = rnd(2, TH - 2); if (get(x, y) === ',' && !nearBusy(x, y)) { set(x, y, 'f'); n++; } }
  L.seen.fill(1);
  L.npcs = ch === 1 ? [{ x: 8, y: 10, ch: '🧑‍🌾', n: 'Villager' }, { x: 24, y: 9, ch: '👵', n: 'Old Woman' }, { x: 15, y: 17, ch: '🧒', n: 'Child' }, { x: 30, y: 10, ch: '🐕', n: 'Village Dog' }]
    : [{ x: 8, y: 10, ch: '🧑‍🌾', n: 'Fisherman' }, { x: 24, y: 9, ch: '👵', n: 'Grieving Mother' }, { x: 30, y: 17, ch: '🐕', n: 'Stray Dog' }];
  return L;
}
const SHOP_WHO2 = { general: 'Hallveig the Trader', smith: 'Dvalin the Smith', armor: 'Ragna the Armorer', alch: 'Mother Grima', mage: 'Magister Orm', temple: 'Sister Frida', sage: 'Old Kvasir', tavern: 'Ottar the Innkeep' };
function shopInfo(id) { const i = SHOP_INFO[id]; return (G && G.loc === 't2' && SHOP_WHO2[id]) ? Object.assign({}, i, { who: SHOP_WHO2[id] }) : i; }
const SHOP_INFO = {
  lodge: { n: "Warden's Lodge", ic: '🏛️', who: 'Elder Maren' },
  general: { n: 'General Store', ic: '🏪', who: 'Gudrun the Trader' },
  smith: { n: 'Blacksmith', ic: '⚒️', who: 'Brokk the Smith' },
  armor: { n: 'Armorer', ic: '🛡️', who: 'Sindri the Armorer' },
  alch: { n: 'Alchemist', ic: '⚗️', who: 'Old Hild' },
  mage: { n: 'Mage Guild', ic: '📚', who: 'Archmage Vali' },
  temple: { n: 'Temple of Odin', ic: '⛪', who: 'High Priestess Eir' },
  sage: { n: 'The Sage', ic: '🦉', who: 'Mimir the Sage' },
  tavern: { n: 'Mead Hall Tavern', ic: '🍺', who: 'Ulf the Barkeep' },
  jarl: { n: "Jarl's Hall", ic: '🏰', who: 'Jarl Eirik' },
};
function shopLevel(town) { return town === 't2' ? 13 + Math.max(1, G.deep2 || 0) : Math.max(1, G.maxDepth); }
function shopsHere() { const k = lvl().key || K(G.loc); return (G.shops[k] = G.shops[k] || {}); }
function genShops(town) {
  town = K(town || G.loc);
  const D = shopLevel(town);
  const S = {};
  const ided = it => { it.id = true; return it; };
  S.general = [makeCons('potion', D >= 12 ? 'heal2' : 'heal', 6), makeCons('potion', 'cure', 3), makeCons('potion', 'mana', 3), makeCons('scroll', 'identify', 5), makeCons('scroll', 'ret', 4), makeCons('scroll', 'teleport', 2), makeArrows(30), makeArrows(30),
    makeEquip('cloak', 1, { rar: 0, noCurse: 1 }), makeEquip('boots', 1, { rar: 0, noCurse: 1 }), makeEquip('gloves', 1, { rar: 0, noCurse: 1 }), makeEquip('cap', 1, { rar: 0, noCurse: 1 }), makeEquip('dagger', 1, { rar: 0, noCurse: 1 })].map(ided);
  const eqShop = (slots, n) => {
    const out = [];
    const bs = Object.keys(BASES).filter(b => slots.includes(BASES[b].slot) && BASES[b].lvl <= D + 2 && !BASES[b].quest);
    for (let i = 0; i < n; i++) { const r = Math.random(); out.push(ided(makeEquip(pick(bs), D + 1, { rar: r < 0.6 ? 0 : r < 0.92 ? 1 : 2, noCurse: 1 }))); }
    return out.sort((a, b) => itemValue(a) - itemValue(b));
  };
  S.smith = eqShop(['weapon'], 8).concat(eqShop(['bow'], 2));
  S.armor = eqShop(['armor', 'shield', 'helm', 'boots', 'gloves', 'cloak'], 10);
  S.alch = [];
  for (const k of Object.keys(POTIONS)) if (!POTIONS[k].bad && POTIONS[k].lvl <= D + 1 && (POTIONS[k].w > 2 || chance(0.35))) S.alch.push(ided(makeCons('potion', k, POTIONS[k].w > 5 ? rnd(2, 5) : 1)));
  for (const k of Object.keys(SCROLLS)) if (!SCROLLS[k].bad && SCROLLS[k].lvl <= D + 1) S.alch.push(ided(makeCons('scroll', k, rnd(1, 4))));
  S.mage = [];
  const books = shuffle(Object.keys(SPELLS).filter(k => SPELLS[k].tier <= 2 + (D / 2 | 0) && !G.p.spells.includes(k))).slice(0, 5);
  for (const b of books) S.mage.push(makeBook(b));
  const wands = shuffle(Object.keys(WANDS).filter(k => WANDS[k].lvl <= D + 1)).slice(0, 3);
  for (const w of wands) S.mage.push(ided(makeCons('wand', w)));
  for (let i = 0; i < 3; i++) S.mage.push(ided(makeEquip(pick(['ring', 'amulet']), D + 1, { rar: chance(0.25) ? 2 : 1, noCurse: 1 })));
  G.shops[town] = S;
  if (typeof G.restock !== 'object') G.restock = {};
  G.restock[town] = false;
}

// ===================== FOV =====================
function line(x0, y0, x1, y1) {
  const pts = []; let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
  let x = x0, y = y0;
  while (!(x === x1 && y === y1)) { const e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; } pts.push([x, y]); }
  return pts;
}
function los(x0, y0, x1, y1) {
  const pts = line(x0, y0, x1, y1);
  for (let i = 0; i < pts.length - 1; i++) if (isOpaque(pts[i][0], pts[i][1])) return false;
  return true;
}
function fov() {
  const L = lvl(); const p = G.p;
  G.vis = new Uint8Array(L.w * L.h);
  if (L.town) { G.vis.fill(1); return; }
  const r = G.s.light + (L.kind === 'forest' ? 2 : 0);
  for (let y = p.y - r; y <= p.y + r; y++) for (let x = p.x - r; x <= p.x + r; x++) {
    if (!inb(x, y)) continue;
    const dx = x - p.x, dy = y - p.y; if (dx * dx + dy * dy > r * r + r) continue;
    if (los(p.x, p.y, x, y) || losLoose(p.x, p.y, x, y)) { G.vis[y * L.w + x] = 1; L.seen[y * L.w + x] = 1; }
  }
  if (L.rooms) for (const rm of L.rooms) {
    if (!rm.lit || p.x < rm.x - 1 || p.x > rm.x + rm.w || p.y < rm.y - 1 || p.y > rm.y + rm.h) continue;
    for (let y = rm.y - 1; y <= rm.y + rm.h; y++) for (let x = rm.x - 1; x <= rm.x + rm.w; x++) { G.vis[y * L.w + x] = 1; L.seen[y * L.w + x] = 1; }
  }
}
function losLoose(x0, y0, x1, y1) { // reverse line helps symmetric wall visibility
  const pts = line(x1, y1, x0, y0);
  for (let i = 0; i < pts.length - 1; i++) if (isOpaque(pts[i][0], pts[i][1])) return false;
  return true;
}
const canSeeTile = (x, y) => G.vis && G.vis[idx(x, y)];
function visibleMons() { return lvl().mons.filter(m => canSeeTile(m.x, m.y)); }
function hostilesInView() { return visibleMons().length; }
function nearestMon() {
  let best = null, bd = 99;
  for (const m of visibleMons()) { const d = dist(m.x, m.y, G.p.x, G.p.y); if (d < bd) { bd = d; best = m; } }
  return best;
}

// ===================== PATHING =====================
function bfs(sx, sy, passFn, maxD = 200) {
  const L = lvl(); const D = new Int16Array(L.w * L.h).fill(-1);
  const q = [sx, sy]; D[sy * L.w + sx] = 0; let h = 0;
  while (h < q.length) {
    const x = q[h++], y = q[h++]; const d = D[y * L.w + x]; if (d >= maxD) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h) continue;
      const i = ny * L.w + nx; if (D[i] >= 0) continue;
      if (!passFn(nx, ny)) continue;
      D[i] = d + 1; q.push(nx, ny);
    }
  }
  return D;
}
function pathTo(tx, ty, allowTraps) {
  const L = lvl();
  const pass = (x, y) => (L.seen[idx(x, y)] && isWalk(x, y) && !('E&'.includes(tile(x, y)) && !(x === tx && y === ty)) && (allowTraps || !(trapAt(x, y) && trapAt(x, y).found && !(x === tx && y === ty)))) || (x === tx && y === ty && isWalk(x, y));
  const D = bfs(tx, ty, pass);
  if (D[idx(G.p.x, G.p.y)] < 0) return allowTraps ? null : pathTo(tx, ty, true);
  const path = []; let x = G.p.x, y = G.p.y;
  while (!(x === tx && y === ty)) {
    let best = null, bd = D[idx(x, y)];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue;
      const d = D[idx(nx, ny)]; if (d >= 0 && d < bd) { bd = d; best = [nx, ny]; }
    }
    if (!best) return null;
    path.push(best); x = best[0]; y = best[1];
    if (path.length > 300) return null;
  }
  return path;
}
function exploreTarget() {
  const L = lvl();
  const pass = (x, y) => L.seen[idx(x, y)] && isWalk(x, y) && !'E&<>'.includes(tile(x, y));
  const D = bfs(G.p.x, G.p.y, pass);
  let best = null, bd = 9999;
  // items first (visible/seen)
  for (const fi of L.items) { const d = D[idx(fi.x, fi.y)]; if (d > 0 && d < bd && !fi.skip) { bd = d; best = [fi.x, fi.y]; } }
  if (best && bd < 25) return best;
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const i = idx(x, y); const d = D[i]; if (d <= 0 || d >= bd) continue;
    let frontier = false;
    for (let dy = -1; dy <= 1 && !frontier; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && !L.seen[idx(nx, ny)]) { frontier = true; break; } }
    if (frontier) { bd = d; best = [x, y]; }
  }
  return best;
}

// ===================== PLAYER ACTIONS =====================
function actCost() { const p = G.p; let c = 100; if (p.st.haste) c *= 0.5; if (p.st.slow) c *= 2; c *= (1 - G.s.speed / 100); return c; }

function playerStep(dx, dy) {
  const p = G.p;
  if (G.pendingLvl) return false;
  if (p.st.confuse && chance(0.5)) { dx = rnd(-1, 1); dy = rnd(-1, 1); if (!dx && !dy) dx = 1; msg('You stumble around in confusion.', '#c9f'); }
  if (dx) p.face = dx;
  const nx = p.x + dx, ny = p.y + dy;
  const m = monAt(nx, ny);
  if (m) { playerMelee(m); endTurn(); return true; }
  const n = npcAt(nx, ny);
  if (n) { talkNpc(n); [n.x, n.y] = [p.x, p.y]; p.x = nx; p.y = ny; endTurn(); return true; }
  const t = tile(nx, ny);
  if (t === 'S') { const id = lvl().doors[idx(nx, ny)]; UI.openShop(id); return false; }
  if (t === 'P') { const L = lvl(); const dir = Object.keys(L.ped).find(k => L.ped[k].x === nx && L.ped[k].y === ny); UI.openPedestal(dir); return false; }
  if (t === 'R') { UI.readTablet(); return false; }
  if (t === 'G') { msg('A great stone gate, sealed by old magic. The pedestals around it are empty.', '#bcd'); return false; }
  if (t === 'O') { msg('A weathered standing stone, carved with runes.', '#bcd'); return false; }
  if (t === 'Y') { useWaystone(); return false; }
  if (t === 'J') { openCell(); endTurn(); return true; }
  if (t === 'E' && K(G.loc) === '0' && !G.quest.won) { msg('Guard: "The western road is closed until the Frost Jarl falls. Jarl\'s orders."', '#fc8'); return false; }
  if (t === '+') { lvl().t[idx(nx, ny)] = "'"; msg('You open the door.'); endTurn(); return true; }
  if (!isWalk(nx, ny)) return false;
  p.x = nx; p.y = ny;
  onEnterTile();
  endTurn();
  return true;
}
function onEnterTile() {
  const p = G.p, L = lvl();
  const tr = trapAt(p.x, p.y);
  if (tr) triggerTrap(tr);
  if (G.depth !== (L.depth)) return; // fell
  const here = itemsAt(p.x, p.y);
  for (const fi of here) {
    if (fi.it.k === 'chest') {
      L.items.splice(L.items.indexOf(fi), 1);
      msg('You pry open the chest!', '#fd4'); SFX.coin();
      const n = rnd(2, 3);
      for (let i = 0; i < n; i++) { const it = randomItem(G.depth + 1); if (!addInv(it)) L.items.push({ x: p.x, y: p.y, it }); else msg('Found: ' + itemName(it), itemColor(it)); }
      const g = rnd(10, 25) * goldScale(G.depth); p.gold += g; msg(`+${g} gold`, '#fd4');
      continue;
    }
    if (fi.it.k === 'gold') { const g = Math.round(fi.it.q * (1 + G.s.gold / 100)); p.gold += g; msg(`You pick up ${g} gold.`, '#fd4'); SFX.coin(); L.items.splice(L.items.indexOf(fi), 1); continue; }
    if (addInv(fi.it, true)) { msg('You pick up ' + itemName(fi.it) + '.', itemColor(fi.it)); SFX.pick(); L.items.splice(L.items.indexOf(fi), 1); }
    else { msg('Your pack is full — ' + itemName(fi.it) + ' stays here.', '#f88'); fi.skip = true; }
  }
  const tHere = tile(p.x, p.y);
  if (tHere === 'E' || tHere === '&') { const to = linksFor(G.loc)[tHere]; if (to) { SFX.stairs(); changeLevel(to, 'travel'); return; } }
  if (L.town && tHere === '>') msg(K(G.loc) === 't2' ? 'The mouth of the Shadowdeep. Tap ⬇ to descend.' : 'The entrance to the Barrow. Tap ⬇ to descend.', '#9cf');
}
function triggerTrap(tr) {
  const p = G.p;
  if (tr.found && chance(0.6)) { msg('You carefully step around the trap.'); return; }
  tr.found = true;
  SFX.trap();
  switch (tr.type) {
    case 'dart': msg('A poisoned dart hits you!', '#f88'); hurtPlayer(rnd(2, 4) + G.depth, 'a poison dart'); poisonPlayer(6 + G.depth, 1 + (G.depth / 3 | 0)); break;
    case 'pit':
      msg('The floor gives way — you fall to the level below!', '#f88');
      hurtPlayer(rnd(2, 6), 'a fall');
      if (p.hp > 0) { lvl().traps.splice(lvl().traps.indexOf(tr), 1); const nx = linksFor(G.loc)['>']; if (nx) changeLevel(nx, 'fall'); }
      break;
    case 'tele': msg('A rune flares — you are teleported!', '#c9f'); teleportPlayer(12); break;
    case 'fire': { msg('A fire rune explodes beneath you!', '#f84'); let d = rnd(3, 8) + G.depth * 2; d = Math.round(d * (1 - G.s.rFire / 100)); hurtPlayer(d, 'a fire rune'); FX.burst(p.x, p.y, '#f80'); break; }
    case 'alarm': msg('A shrieking alarm wakes the dungeon!', '#f88'); for (const m of lvl().mons) { m.asleep = false; m.track = 20; } break;
  }
}
function searchAround(radius, ch) {
  let found = 0;
  for (const tr of lvl().traps) if (!tr.found && dist(tr.x, tr.y, G.p.x, G.p.y) <= radius && chance(ch)) { tr.found = true; found++; }
  if (found) msg(`You discover ${found > 1 ? found + ' traps' : 'a trap'}!`, '#fc6');
  return found;
}
function useWaystone() {
  if (!G.quest.circle) { msg('An old waystone, cold and silent. It may wake once the road west is open.', '#bcd'); return; }
  msg('The waystone hums and the world folds around you...', '#c9f'); SFX.spell();
  changeLevel(K(G.loc) === 't2' ? '0' : 't2', 'way');
}
function openCell() {
  const L = lvl(), c = L.captive; if (!c) return;
  const key = G.p.inv.find(i => i.k === 'key' && i.b === L.key);
  if (!key) { msg(`${c.name} grips the bars: "The Jailer has the key! Please hurry!"`, '#fc8'); return; }
  G.p.inv.splice(G.p.inv.indexOf(key), 1);
  L.t[idx(c.door.x, c.door.y)] = "'"; c.freed = true; G.quest.freed = (G.quest.freed || 0) + 1;
  msg(`You unlock the cell. ${c.name} is free! "Thank you — I'll run for Eldermere!" (${G.quest.freed}/10 freed)`, '#8f8');
  FX.burst(c.x, c.y, '#8f8'); SFX.level();
  gainXp(150 + depthOf(G.loc) * 25);
  fov();
}
function relicState(r) { return G.quest['relic_' + r]; }
function placeRelic(dir, it) {
  const L = lvl(); const ped = L.ped[dir];
  if (ped.r) { // take back the current relic
    const back = { uid: G.uid++, k: 'relic', b: ped.r, q: 1, id: true }; if (!addInv(back)) return; ped.r = null;
  }
  if (it) { G.p.inv.splice(G.p.inv.indexOf(it), 1); ped.r = it.b; msg(`You set the ${RELICS[it.b].n} on the ${DIR_NAME[dir]} pedestal.`, RELICS[it.b].col); SFX.pick(); }
  checkCircle();
}
function checkCircle() {
  const L = lvl(); if (!L.ped || G.quest.circle) return;
  if (!Object.values(L.ped).every(p => p.r)) return;
  const ok = Object.keys(CIRCLE_SOLUTION).every(d => L.ped[d].r === CIRCLE_SOLUTION[d]);
  if (!ok) {
    msg('The stones grind... then a jolt of wild magic lashes out! The order is wrong.', '#f88');
    hurtPlayer(rnd(10, 20), 'the angry stones'); FX.burst(L.gate.x, L.gate.y, '#f66', 1.5); return;
  }
  G.quest.circle = 1;
  L.t[idx(L.gate.x, L.gate.y)] = '&';
  msg('The relics blaze with light! The great gate grinds open onto a road beyond the winter...', '#fd4');
  msg('Step through the gate to reach Eldermere. (Waystones in both towns now connect them.)', '#fd4');
  FX.burst(L.gate.x, L.gate.y, '#fd4', 2); SFX.level();
  gainXp(1500);
  saveGame();
}
function talkNpc(n) { msg(`${n.n}: "${pick(K(G.loc) === 't2' ? RUMORS2 : RUMORS)}"`, '#bdf'); }

function weaponOf(sl) { const it = G.p.equip[sl]; return it ? { it, B: BASES[it.b], s: itemStats(it) } : null; }
function monRes(D, elem) { return (D.res && D.res[elem] != null) ? D.res[elem] : 1; }
function playerAttackRoll(m, w, ranged) {
  const p = G.p, s = G.s, D = MONSTERS[m.id];
  const ws = w ? w.s : {};
  const hit = p.lvl + Math.floor((s.dex - 10) / 2) + s.hit + (ws.hit || 0) + (G.cls === 'warrior' ? 2 : 0) + (ranged && G.cls === 'rogue' ? 3 : 0);
  const sleeping = m.asleep || m.sleepT > 0;
  const ch = sleeping ? 1 : clamp(0.72 + 0.025 * (hit - D.def * 1.5), 0.15, 0.97);
  if (!chance(ch)) { msg(`You miss the ${D.n}.`, '#aaa'); FX.text(m.x, m.y, 'miss', '#aaa'); SFX.miss(); m.asleep = false; m.track = 10; return; }
  const base = w ? w.B.dmg : [1, 3];
  let dmg = rnd(base[0], base[1]) + (ws.dmg || 0) + s.dmg;
  if (!ranged) dmg += Math.floor((s.str - 10) / 2) + (G.cls === 'warrior' ? Math.floor(p.lvl / 3) : 0);
  else dmg += Math.floor((s.dex - 10) / 3);
  let crit = false;
  const critCh = 0.05 + (G.cls === 'rogue' ? 0.12 : 0) + Math.max(0, s.dex - 10) * 0.01;
  if (chance(critCh)) { dmg *= 2; crit = true; }
  if (sleeping) dmg = Math.round(dmg * (G.cls === 'rogue' ? 2.5 : 1.5));
  dmg = Math.max(1, dmg);
  let total = dmg;
  const el = [['efire', 'fire'], ['ecold', 'cold'], ['eshock', 'shock']];
  let elCol = null;
  for (const [k, e] of el) { const v = (s[k] || 0) + (ws[k] || 0); if (v > 0) { total += Math.round(rnd(Math.ceil(v / 2), v) * monRes(D, e)); elCol = { fire: '#f84', cold: '#8df', shock: '#ff6' }[e]; } }
  total = Math.round(total * (monRes(D, 'phys')));
  const leech = (s.leech || 0) + (ws.leech || 0);
  msg(`${crit ? 'Critical! ' : ''}${sleeping && G.cls === 'rogue' ? 'Sneak attack! ' : ''}You hit the ${D.n} for ${total}.`, crit ? '#ff8' : '#fff');
  SFX.hit();
  if (leech > 0) { const h = Math.max(1, Math.floor(total * leech / 100)); G.p.hp = Math.min(G.s.mhp, G.p.hp + h); }
  damageMon(m, total, null, elCol || (crit ? '#ff6' : '#fff'));
}
function playerMelee(m) { playerAttackRoll(m, weaponOf('weapon'), false); }
function arrowsItem() { return G.p.inv.find(i => i.k === 'arrows'); }
function canShoot(m) {
  if (!G.p.equip.bow || !arrowsItem()) return false;
  return dist(m.x, m.y, G.p.x, G.p.y) <= 9 && canSeeTile(m.x, m.y);
}
function playerShoot(m) {
  const a = arrowsItem(); a.q--; if (a.q <= 0) G.p.inv.splice(G.p.inv.indexOf(a), 1);
  FX.bolt(G.p.x, G.p.y, m.x, m.y, '#ddd', 'arrow');
  SFX.shoot();
  const mx = m.x, my = m.y;
  playerAttackRoll(m, weaponOf('bow'), true);
  if (chance(0.55) && isWalk(mx, my)) {
    const ex = lvl().items.find(i => i.x === mx && i.y === my && i.it.k === 'arrows');
    if (ex) ex.it.q++; else lvl().items.push({ x: mx, y: my, it: makeArrows(1) });
  }
  endTurn();
}
function damageMon(m, dmg, elem, col) {
  const D = MONSTERS[m.id];
  if (elem) dmg = Math.round(dmg * monRes(D, elem));
  m.hp -= dmg; m.asleep = false; m.sleepT = 0; m.track = 15;
  FX.text(m.x, m.y, dmg > 0 ? '-' + dmg : 'immune', col || '#fff');
  FX.flash(m);
  if (m.hp <= 0) killMon(m);
}
function killMon(m) {
  const L = lvl(), D = MONSTERS[m.id];
  const i = L.mons.indexOf(m); if (i >= 0) L.mons.splice(i, 1);
  G.kills++;
  msg(`The ${D.n} dies.`, '#fc8'); SFX.kill();
  FX.burst(m.x, m.y, D.boss ? '#fd4' : '#a33');
  gainXp(D.xp);
  const drop = it => { L.items.push({ x: m.x, y: m.y, it }); };
  if (m.carry === 'key') { drop({ uid: G.uid++, k: 'key', b: K(G.loc), q: 1, id: true }); msg('The Jailer drops a heavy iron key.', '#fd4'); }
  else if (m.carry) { drop({ uid: G.uid++, k: 'relic', b: m.carry, q: 1, id: true }); G.quest['relic_' + m.carry] = 1; msg(`The ${RELICS[m.carry].n} falls from the thief's sack!`, '#fd4'); }
  if (m.id === 'sigrun') { msg('Sigrun the Bandit Queen falls! Her gang scatters.', '#fd4'); const u = makeUnique(14); drop(u || makeEquip('mithsword', 14, { rar: 2 })); drop(makeGold(1200)); }
  if (m.id === 'warden') { G.quest.wardenDead = 1; msg('Malgrim the Chain Warden crashes down, his chains falling silent!', '#fd4'); for (let i = 0; i < 2; i++) { const u = makeUnique(22); if (u) drop(u); } drop(makeGold(5000)); drop(makeCons('potion', 'heal3', 3)); }
  if (m.id === 'grimtusk') {
    G.quest.troll = 1; msg('Grimtusk the Troll King is slain! Return to the Jarl for your reward.', '#fd4');
    const u = makeUnique(6); drop(u || makeEquip(pick(['gsword', 'plate', 'tshield']), 6, { rar: 2 })); drop(makeGold(400)); drop(makeCons('potion', 'heal2', 2));
  } else if (m.id === 'hrimfang') {
    G.quest.crown = 1; msg('Hrimfang falls! The Storm Crown clatters to the floor. Bring it to Jarl Eirik!', '#fd4');
    drop(makeEquip('crown', 10)); drop(makeGold(1500)); const u = makeUnique(10); if (u) drop(u);
  } else {
    const dl = Math.max(G.depth, D.d);
    if (chance(0.22 + G.depth * 0.01)) drop(randomItem(dl));
    if (chance(0.35)) drop(makeGold(rnd(2, 8) * goldScale(G.depth)));
  }
}
function gainXp(x) {
  const p = G.p; p.xp += x;
  while (p.xp >= xpNext(p.lvl)) {
    p.xp -= xpNext(p.lvl); p.lvl++;
    const c = CLASSES[G.cls];
    p.baseHp += rnd(c.hpL[0], c.hpL[1]) + Math.max(0, Math.floor((G.s.con - 10) / 3));
    p.baseMp += c.mpL + Math.max(0, Math.floor((G.s.int - 10) / 4));
    calc(); p.hp = G.s.mhp; p.mp = G.s.mmp;
    G.pendingLvl++;
    msg(`You reach level ${p.lvl}! You feel restored.`, '#8f8'); SFX.level();
    FX.burst(p.x, p.y, '#8f8');
  }
}
function hurtPlayer(dmg, src) {
  const p = G.p;
  p.hp -= dmg; FX.text(p.x, p.y, '-' + dmg, '#f55'); FX.hurt();
  UI.stopRun();
  if (p.hp <= 0) die(src);
}
function poisonPlayer(t, d) { const p = G.p; if (!p.st.poison || p.st.poison < t) { p.st.poison = t; p.st.poisonD = Math.max(d, p.st.poisonD || 0); msg('You are poisoned!', '#8f6'); } }

function monAttack(m) {
  const D = MONSTERS[m.id], s = G.s, p = G.p;
  const ch = clamp(0.8 + 0.025 * (D.atk * 1.5 - s.ac), 0.08, 0.95);
  FX.lunge(m);
  if (!chance(ch)) { msg(`The ${D.n} misses you.`, '#999'); return; }
  let dmg = rnd(D.dmg[0], D.dmg[1]) - rnd(0, Math.floor(s.ac / 6));
  dmg = Math.max(1, dmg);
  if (D.burn) { dmg += Math.round(rnd(2, 6) * (1 - s.rFire / 100)); }
  msg(`The ${D.n} hits you for ${dmg}.`, '#f99');
  hurtPlayer(dmg, 'a ' + D.n);
  if (p.hp <= 0) return;
  if (D.poison && chance(D.poison[0])) poisonPlayer(D.poison[1], D.poison[2]);
  if (D.drain && chance(0.2)) { const st = pick(STATS4); if (p.drain[st] < 6) { p.drain[st]++; msg(`You feel your ${STAT_NAME[st]} drain away!`, '#c8f'); calc(); } }
  if (D.manaburn) { const b = Math.min(p.mp, rnd(2, 6)); if (b) { p.mp -= b; msg('Your mana is sapped!', '#88f'); } }
  if (D.leech) { m.hp = Math.min(m.mhp, m.hp + Math.ceil(dmg / 2)); }
  if (D.slows && chance(0.2)) { p.st.slow = 5; msg('Its gaze slows you!', '#c9f'); }
}
function monRanged(m) {
  const D = MONSTERS[m.id], R = D.ranged, s = G.s;
  FX.bolt(m.x, m.y, G.p.x, G.p.y, R.col, R.elem === 'phys' ? 'arrow' : 'orb');
  let dmg = rnd(R.d[0], R.d[1]);
  if (R.elem === 'phys') {
    const ch = clamp(0.75 + 0.025 * (D.atk * 1.5 - s.ac), 0.08, 0.9);
    if (!chance(ch)) { msg(`The ${D.n} ${R.verb} — it misses.`, '#999'); return; }
    dmg = Math.max(1, dmg - rnd(0, Math.floor(s.ac / 6)));
  } else {
    const rk = { fire: 'rFire', cold: 'rCold', shock: 'rShock' }[R.elem];
    if (rk) dmg = Math.max(1, Math.round(dmg * (1 - s[rk] / 100)));
  }
  msg(`The ${D.n} ${R.verb}! (${dmg})`, '#f99');
  hurtPlayer(dmg, 'a ' + D.n);
}

// ===================== MONSTER AI =====================
function monsterTurns(cost) {
  const L = lvl(); const p = G.p;
  const pass = (x, y) => isWalk(x, y) || tile(x, y) === '+';
  G.flow = bfs(p.x, p.y, pass, 30);
  for (const m of [...L.mons]) {
    if (p.hp <= 0 || lvl() !== L) break;
    if (!L.mons.includes(m)) continue;
    const D = MONSTERS[m.id];
    m.en += D.spd * (m.slow ? 0.5 : 1) * cost / 100;
    let guard = 0;
    while (m.en >= 100 && guard++ < 4) {
      m.en -= 100; monAct(m, D);
      if (p.hp <= 0 || !L.mons.includes(m) || lvl() !== L) break;
    }
  }
}
function monAct(m, D) {
  const p = G.p;
  if (D.regen && m.hp < m.mhp) m.hp = Math.min(m.mhp, m.hp + D.regen);
  if (m.sleepT > 0) { m.sleepT--; return; }
  const seen = canSeeTile(m.x, m.y);
  const d = dist(m.x, m.y, p.x, p.y);
  if (m.asleep) {
    const stealth = G.cls === 'rogue' ? 0.06 : 0.15;
    if (seen && d <= 8 && chance(stealth + (d <= 2 ? 0.2 : 0))) { m.asleep = false; m.track = 10; }
    return;
  }
  if (seen) m.track = 12; else if (m.track > 0) m.track--;
  if (D.summon && seen && chance(0.07)) {
    let n = 0;
    for (let t = 0; t < 20 && n < 2; t++) { const x = m.x + rnd(-2, 2), y = m.y + rnd(-2, 2); if (inb(x, y) && isFree(x, y)) { addMon(D.summon, x, y, false).track = 10; n++; } }
    if (n) { msg(`${D.n} calls forth Frost Hounds!`, '#8df'); return; }
  }
  if (D.flee && m.track > 0 && d <= 6) {
    const L = lvl(); let best = null, bd = G.flow[idx(m.x, m.y)];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = m.x + dx, ny = m.y + dy; if (!inb(nx, ny) || !isWalk(nx, ny) || monAt(nx, ny) || (nx === p.x && ny === p.y)) continue;
      const v = G.flow[ny * L.w + nx]; if (v > bd) { bd = v; best = [nx, ny]; }
    }
    if (best && !(d === 1 && chance(0.35))) { m.x = best[0]; m.y = best[1]; if (chance(0.08)) msg(pick(['The Cutpurse cackles: "Catch me if you can!"', 'The Cutpurse darts away, clutching a sack.', '"Finders keepers!"']), '#c9f'); return; }
  }
  if (D.ranged && seen && d > 1 && d <= D.ranged.r && los(m.x, m.y, p.x, p.y) && chance(D.ranged.c)) { monRanged(m); return; }
  if (d === 1) { monAttack(m); return; }
  if (D.erratic && chance(D.erratic)) { monRandomStep(m); return; }
  if (m.track > 0) {
    const L = lvl(); let best = null, bd = G.flow[idx(m.x, m.y)];
    if (bd < 0) bd = 999;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = m.x + dx, ny = m.y + dy; if (!inb(nx, ny)) continue;
      const v = G.flow[ny * L.w + nx]; if (v < 0 || v >= bd) continue;
      if (monAt(nx, ny) || (nx === p.x && ny === p.y)) continue;
      bd = v; best = [nx, ny];
    }
    if (best) {
      if (tile(best[0], best[1]) === '+') { lvl().t[idx(best[0], best[1])] = "'"; return; }
      m.x = best[0]; m.y = best[1]; return;
    }
  }
  if (chance(0.3)) monRandomStep(m);
}
function monRandomStep(m) {
  const dx = rnd(-1, 1), dy = rnd(-1, 1); const nx = m.x + dx, ny = m.y + dy;
  if (isFree(nx, ny)) { m.x = nx; m.y = ny; }
}

// ===================== TURN =====================
function endTurn(costOverride) {
  const p = G.p;
  const cost = costOverride || actCost();
  G.turn++;
  const st = p.st;
  // regen
  const s = G.s;
  G.regH = (G.regH || 0) + (1 + s.regen * 2 + Math.max(0, s.con - 10) * 0.1) * (cost / 100);
  const hNeed = Math.max(3, 14 - p.lvl / 2);
  while (G.regH >= hNeed) { G.regH -= hNeed; if (p.hp < s.mhp && !st.poison) p.hp++; }
  G.regM = (G.regM || 0) + (1 + Math.max(0, s.int - 10) * 0.12 + s.regen) * (cost / 100);
  const mNeed = Math.max(3, 10 - p.lvl / 4);
  while (G.regM >= mNeed) { G.regM -= mNeed; if (p.mp < s.mmp) p.mp++; }
  if (st.poison) { st.poison--; p.hp -= st.poisonD; FX.text(p.x, p.y, '-' + st.poisonD, '#8f6'); if (p.hp <= 0) { die('poison'); return; } if (!st.poison) msg('The poison wears off.', '#8f8'); }
  for (const k of ['haste', 'shield', 'resist', 'slow', 'confuse']) if (st[k]) { st[k]--; if (!st[k]) { if (k === 'shield') st.shieldN = 0; msg({ haste: 'You slow down.', shield: 'Your magical shield fades.', resist: 'Your resistance fades.', slow: 'You can move freely again.', confuse: 'Your head clears.' }[k], '#aaa'); calc(); } }
  if (G.detectT) G.detectT--;
  // passive trap search
  if (!lvl().town) searchAround(1, (G.cls === 'rogue' ? 0.3 : 0.1) + Math.max(0, s.dex - 10) * 0.01);
  if (lvl().town) townTurn(); else monsterTurns(cost);
  if (p.hp <= 0) return;
  // wandering spawns
  if (!lvl().town && G.turn % 120 === 0 && lvl().mons.length < 28) {
    const L = lvl();
    for (let t = 0; t < 30; t++) { const x = rnd(1, L.w - 2), y = rnd(1, L.h - 2); if ((tile(x, y) === '.' || tile(x, y) === ',') && !canSeeTile(x, y) && isFree(x, y) && dist(x, y, p.x, p.y) > 10) { spawnMonster(G.depth, { x, y }, false); break; } }
  }
  fov();
  if (G.turn % 40 === 0) saveGame();
  UI.dirty = true;
}
function townTurn() {
  const L = lvl();
  for (const n of L.npcs) if (chance(0.4)) { const nx = n.x + rnd(-1, 1), ny = n.y + rnd(-1, 1); if ((tile(nx, ny) === ',' || tile(nx, ny) === '=') && isFree(nx, ny)) { n.x = nx; n.y = ny; } }
}
function die(src) {
  const p = G.p;
  p.hp = 0; G.deaths++;
  UI.stopRun();
  SFX.die();
  if (G.hard) { G.dead = { src, depth: G.depth, where: levelName(G.loc), lvl: p.lvl, turn: G.turn, kills: G.kills }; deleteSave(); UI.gameOver(); return; }
  const lost = Math.floor(p.gold / 2);
  p.gold -= lost;
  p.st = {}; p.hp = 1;
  msg(`You were slain by ${src}...`, '#f55');
  changeLevel(homeOf(G.loc), 'temple');
  calc(); p.hp = G.s.mhp; p.mp = G.s.mmp;
  UI.deathNotice(src, lost);
}

// ===================== LEVEL CHANGE =====================
function findTile(L, ch) { const i = L.t.indexOf(ch); return i < 0 ? null : { x: i % L.w, y: (i / L.w) | 0 }; }
function changeLevel(key, how) {
  key = K(key);
  const from = K(G.loc);
  if (!G.levels[key]) G.levels[key] = genLevel(key);
  G.loc = key; G.depth = depthOf(key);
  const L = lvl(); const p = G.p, kind = kindOf(key);
  if (!L.key) { L.key = key; L.kind = kind; }
  if (kind === 'barrow' && +key > G.maxDepth) G.maxDepth = +key;
  if (kind === 'deep') G.deep2 = Math.max(G.deep2 || 0, +key.slice(1));
  if (kind !== 'town') { if (typeof G.restock !== 'object') G.restock = {}; G.restock['0'] = true; G.restock.t2 = true; }
  let pos = null;
  if (kind === 'town') {
    if (how === 'temple') { const b = L.bld.find(b => b.id === 'temple'); pos = { x: b.door.x, y: b.door.y + 1 }; }
    else if (how === 'way') pos = { x: L.way.x + 1, y: L.way.y };
    if (!G.shops[key] || (G.restock && G.restock[key] !== false)) genShops(key);
  }
  if (!pos && how === 'return') pos = kind === 'town' ? L.start : (L.up || findTile(L, '<'));
  if (!pos && how === 'fall') { for (let t = 0; t < 800 && !pos; t++) { const x = rnd(1, L.w - 2), y = rnd(1, L.h - 2); if ((tile(x, y) === '.' || tile(x, y) === ',') && !monAt(x, y)) pos = { x, y }; } }
  if (!pos) { // arrive at the tile that links back to where we came from
    const links = linksFor(key);
    for (const ch in links) if (links[ch] === from) { pos = ch === '<' ? (L.up || findTile(L, '<')) : ch === '>' ? (L.down || findTile(L, '>')) : findTile(L, ch); if (pos) break; }
    if (pos && (tile(pos.x, pos.y) === 'E' || tile(pos.x, pos.y) === '&')) { // step off travel tiles
      let best = null; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = pos.x + dx, ny = pos.y + dy; if (inb(nx, ny) && isWalk(nx, ny) && !'E&'.includes(tile(nx, ny)) && !monAt(nx, ny)) { best = { x: nx, y: ny }; if (!dy) break; } } if (best) pos = best;
    }
  }
  if (!pos) pos = L.start || L.up || findTile(L, '<') || { x: 2, y: 2 };
  if (monAt(pos.x, pos.y)) { const m = monAt(pos.x, pos.y); for (let t = 0; t < 30; t++) { const x = pos.x + rnd(-2, 2), y = pos.y + rnd(-2, 2); if (isFree(x, y)) { m.x = x; m.y = y; break; } } }
  p.x = pos.x; p.y = pos.y;
  for (const m of L.mons) if (dist(m.x, m.y, p.x, p.y) <= 2 && !MONSTERS[m.id].boss) { const s = freeNear(m.x, m.y, 4); if (s) { m.x = s.x; m.y = s.y; } }
  calc(); fov();
  if (kind === 'town') msg(`You arrive in ${levelName(key)}.`, '#9cf');
  else if (how !== 'fall') msg(kind === 'forest' ? `You follow the trail into ${levelName(key)}.` : `You ${how === 'up' ? 'climb up to' : 'enter'} ${levelName(key)}.`, '#9cf');
  if (key === '5' && from !== '6' && !G.quest.troll) msg('You smell troll-stench. Grimtusk is near...', '#fc6');
  if (key === '10' && !G.quest.crown) msg('A bitter wind howls. The Frost Jarl awaits.', '#8df');
  if (key === 'f1' && from === '0') msg('The Ironwood. Bandits stole four relics from the Stone Circle — Cutpurses (💰) carry them and will run from you.', '#fd8');
  if (key === 'f3' && !G.quest.circle) msg('Ancient standing stones loom ahead. A carved tablet stands south of the circle.', '#fd8');
  if (kind === 'deep' && L.captive && !L.captive.freed) msg(`Somewhere on this level, ${L.captive.name} cries for help. The Jailer has the key.`, '#fc8');
  if (key === 's10' && !G.quest.wardenDead) msg('Chains rattle in the dark. Malgrim the Chain Warden is here.', '#f88');
  saveGame();
  UI.dirty = true; UI.onLevelChange();
}
function freeNear(x, y, minD) {
  for (let t = 0; t < 60; t++) { const nx = x + rnd(-minD - 2, minD + 2), ny = y + rnd(-minD - 2, minD + 2); if (inb(nx, ny) && isFree(nx, ny) && dist(nx, ny, G.p.x, G.p.y) >= minD) return { x: nx, y: ny }; }
  return null;
}
function useStairs() {
  const t = tile(G.p.x, G.p.y), to = linksFor(G.loc)[t];
  if ((t === '>' || t === '<') && to) { changeLevel(to, t === '>' ? 'down' : 'up'); return true; }
  return false;
}
function teleportPlayer(minD, maxD) {
  const p = G.p;
  for (let t = 0; t < 500; t++) {
    const x = rnd(1, lvl().w - 2), y = rnd(1, lvl().h - 2);
    const d = dist(x, y, p.x, p.y);
    if (d < minD || (maxD && d > maxD)) continue;
    if (!isFree(x, y) || tile(x, y) === 'S') continue;
    FX.burst(p.x, p.y, '#c9f'); p.x = x; p.y = y; FX.burst(x, y, '#c9f');
    fov(); return true;
  }
  return false;
}
function runeOfReturn() {
  if (!lvl().town) { msg('The rune glows and the world dissolves around you...', '#c9f'); changeLevel(homeOf(G.loc), 'return'); return true; }
  if (K(G.loc) === 't2' && G.deep2 > 0) { msg('The rune pulls you down into the Shadowdeep...', '#c9f'); changeLevel('s' + G.deep2, 'return'); return true; }
  if (K(G.loc) === '0' && G.maxDepth > 0) { msg('The rune pulls you down into the deep...', '#c9f'); changeLevel(G.maxDepth, 'return'); return true; }
  msg('The rune flickers — you have not been anywhere to return to.', '#aaa'); return false;
}

// ===================== MAGIC / EFFECTS =====================
function spellDmg(S, power) { const k = 1 + power * 0.06; return Math.round(rnd(S.d[0], S.d[1]) * k); }
const ELEM_COL = { magic: '#c8f', cold: '#8df', fire: '#f84', shock: '#ff6' };
function doEffect(sid, power, target) {
  const S = SPELLS[sid], p = G.p;
  switch (S.eff) {
    case 'bolt': {
      if (!target) return false;
      FX.bolt(p.x, p.y, target.x, target.y, ELEM_COL[S.elem], 'orb');
      const d = spellDmg(S, power); msg(`${S.n} strikes the ${MONSTERS[target.id].n}!`, ELEM_COL[S.elem]);
      damageMon(target, d, S.elem, ELEM_COL[S.elem]); return true;
    }
    case 'beam': {
      if (!target) return false;
      const dx = target.x - p.x, dy = target.y - p.y; const k = 10 / Math.max(Math.abs(dx), Math.abs(dy));
      const pts = line(p.x, p.y, p.x + Math.round(dx * k), p.y + Math.round(dy * k));
      let end = pts[0];
      const hits = [];
      for (const [x, y] of pts) { if (!inb(x, y) || isOpaque(x, y)) break; end = [x, y]; const m = monAt(x, y); if (m) hits.push(m); }
      FX.bolt(p.x, p.y, end[0], end[1], ELEM_COL[S.elem], 'beam');
      for (const m of hits) damageMon(m, spellDmg(S, power), S.elem, ELEM_COL[S.elem]);
      msg(`Lightning tears through ${hits.length} foe${hits.length === 1 ? '' : 's'}!`, ELEM_COL[S.elem]); return true;
    }
    case 'ball': {
      if (!target) return false;
      const tx = target.x, ty = target.y;
      FX.bolt(p.x, p.y, tx, ty, ELEM_COL[S.elem], 'orb'); FX.burst(tx, ty, ELEM_COL[S.elem], 1.6);
      const d = spellDmg(S, power);
      msg(`${S.n} explodes!`, ELEM_COL[S.elem]);
      for (const m of [...lvl().mons]) { const dd = dist(m.x, m.y, tx, ty); if (dd <= 1) damageMon(m, dd === 0 ? d : Math.round(d * 0.6), S.elem, ELEM_COL[S.elem]); }
      return true;
    }
    case 'chain': {
      if (!target) return false;
      const hit = [target]; let cur = target;
      while (hit.length < 4) {
        let nb = null, nd = 99;
        for (const m of visibleMons()) { if (hit.includes(m)) continue; const dd = dist(m.x, m.y, cur.x, cur.y); if (dd < nd && dd <= 5) { nd = dd; nb = m; } }
        if (!nb) break; hit.push(nb); cur = nb;
      }
      let px = p.x, py = p.y; let d = spellDmg(S, power);
      for (const m of hit) { FX.bolt(px, py, m.x, m.y, ELEM_COL.shock, 'beam'); px = m.x; py = m.y; damageMon(m, d, 'shock', ELEM_COL.shock); d = Math.round(d * 0.85); }
      msg(`Chain lightning arcs through ${hit.length} foes!`, ELEM_COL.shock); return true;
    }
    case 'sleep': {
      if (!target) return false; const D = MONSTERS[target.id];
      FX.bolt(p.x, p.y, target.x, target.y, '#99f', 'orb');
      if (D.boss || D.undead || chance(D.d * 0.04)) { msg(`The ${D.n} resists!`, '#aaa'); return true; }
      target.sleepT = 8 + Math.floor(power / 2); target.track = 0; msg(`The ${D.n} falls asleep.`, '#99f'); FX.text(target.x, target.y, 'Zzz', '#99f'); return true;
    }
    case 'slow': {
      if (!target) return false; const D = MONSTERS[target.id];
      FX.bolt(p.x, p.y, target.x, target.y, '#c9f', 'orb');
      if (D.boss && chance(0.6)) { msg(`The ${D.n} resists!`, '#aaa'); return true; }
      target.slow = 1; msg(`The ${D.n} slows down.`, '#c9f'); FX.text(target.x, target.y, 'slowed', '#c9f'); return true;
    }
    case 'buff': {
      if (S.buff === 'shield') { p.st.shield = S.dur; p.st.shieldN = Math.min(3, (p.st.shieldN || 0) + 1); msg(`A shimmering shield surrounds you (×${p.st.shieldN}).`, '#9cf'); }
      if (S.buff === 'resist') { p.st.resist = S.dur; msg('You feel protected from the elements.', '#9cf'); }
      if (S.buff === 'haste') { p.st.haste = S.dur; msg('You feel yourself speed up!', '#9cf'); }
      FX.burst(p.x, p.y, '#9cf'); calc(); return true;
    }
    case 'heal': { const a = Math.max(S.min, Math.round(G.s.mhp * S.pct)); healPlayer(a); return true; }
    case 'cure': { if (p.st.poison) { p.st.poison = 0; msg('The poison leaves your body.', '#8f8'); } else msg('You feel clean.', '#8f8'); FX.burst(p.x, p.y, '#8f8'); return true; }
    case 'phase': { teleportPlayer(3, 8); msg('You blink away.', '#c9f'); return true; }
    case 'teleport': { if (lvl().town) { msg('The magic fizzles here.'); return true; } teleportPlayer(14); msg('You teleport!', '#c9f'); return true; }
    case 'return': return runeOfReturn();
    case 'detect': { G.detectT = 40; msg('You sense the creatures of this level.', '#c9f'); return true; }
    case 'mapping': { mapLevel(); msg('The layout of the level fills your mind.', '#c9f'); return true; }
  }
  return false;
}
function healPlayer(a) { const p = G.p; const before = p.hp; p.hp = Math.min(G.s.mhp, p.hp + a); FX.text(p.x, p.y, '+' + (p.hp - before), '#6f6'); FX.burst(p.x, p.y, '#6f6'); msg(`You feel better (+${p.hp - before} HP).`, '#8f8'); SFX.heal(); }
function mapLevel() {
  const L = lvl();
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    const t = L.t[idx(x, y)];
    if (t !== '#') { L.seen[idx(x, y)] = 1; continue; }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inb(x + dx, y + dy) && L.t[idx(x + dx, y + dy)] !== '#') L.seen[idx(x, y)] = 1;
  }
}

function castSpell(sid, target) {
  const S = SPELLS[sid], p = G.p;
  if (p.mp < S.mp) { msg(`Not enough mana for ${S.n} (${S.mp} MP).`, '#88f'); return false; }
  if (S.eff === 'identify') {
    if (!p.inv.some(i => !i.id || !isKnown(i))) { msg('You have nothing unidentified.', '#aaa'); return false; }
    UI.pickItem('Identify which item?', i => !i.id || !isKnown(i), it => { identifyItem(it); p.mp -= S.mp; SFX.spell(); endTurn(); UI.refresh(); });
    return false;
  }
  if (S.tgt && !target) { msg('No target in sight.', '#aaa'); return false; }
  const ok = doEffect(sid, spellPower(), target);
  if (ok === false) return false;
  p.mp -= S.mp; SFX.spell();
  if (G.levels[G.loc] && G.p.hp > 0) endTurn();
  return true;
}
function identifyItem(it) {
  it.id = true;
  if (it.k === 'potion' || it.k === 'scroll' || it.k === 'wand') G.known[it.k + ':' + it.b] = 1;
  msg('It is: ' + itemName(it) + '.', itemColor(it));
}

function useItem(it, target) {
  const p = G.p;
  if (it.k === 'potion') { drink(it); return true; }
  if (it.k === 'scroll') return readScroll(it);
  if (it.k === 'wand') return zapWand(it, target);
  if (it.k === 'book') {
    if (p.spells.includes(it.b)) { msg('You already know that spell.', '#aaa'); return false; }
    removeOne(it); p.spells.push(it.b); msg(`You study the tome and learn ${SPELLS[it.b].n}!`, '#c9f'); SFX.level();
    const free = G.quick.findIndex(q => !q); if (free >= 0) G.quick[free] = { t: 'spell', id: it.b };
    endTurn(); return true;
  }
  return false;
}
function drink(it) {
  const p = G.p, k = it.b, wasKnown = isKnown(it);
  removeOne(it); G.known['potion:' + k] = 1; SFX.drink();
  switch (k) {
    case 'heal': healPlayer(20 + Math.round(G.s.mhp * 0.15)); break;
    case 'heal2': healPlayer(50 + Math.round(G.s.mhp * 0.4)); if (p.st.poison) p.st.poison = 0; break;
    case 'heal3': healPlayer(120 + Math.round(G.s.mhp * 0.6)); p.st.poison = 0; break;
    case 'mana': { const a = 12 + Math.round(G.s.mmp * 0.15); p.mp = Math.min(G.s.mmp, p.mp + a); msg('Your mind tingles with magic.', '#88f'); FX.burst(p.x, p.y, '#88f'); break; }
    case 'mana2': { const a = 35 + Math.round(G.s.mmp * 0.4); p.mp = Math.min(G.s.mmp, p.mp + a); msg('Magic surges through you!', '#88f'); FX.burst(p.x, p.y, '#88f'); break; }
    case 'cure': p.st.poison = 0; healPlayer(8); break;
    case 'haste': p.st.haste = 25; msg('You feel very fast!', '#9cf'); break;
    case 'resist': p.st.resist = 80; msg('You feel protected from the elements.', '#9cf'); calc(); break;
    case 'str': case 'dex': case 'int': case 'con': p[k]++; msg(`You feel your ${STAT_NAME[k]} increase permanently!`, '#8f8'); SFX.level(); calc(); break;
    case 'xp': msg('Visions of battle fill your mind!', '#8f8'); gainXp(xpNext(p.lvl)); break;
    case 'sick': msg('Ugh — that was poison!', '#8f6'); poisonPlayer(10, 1 + (G.depth / 3 | 0)); break;
    case 'confuse': msg('The world spins!', '#c9f'); p.st.confuse = 8; break;
  }
  if (!wasKnown) msg(`(That was a Potion of ${POTIONS[k].n}.)`, '#aaa');
  endTurn();
}
function readScroll(it) {
  const p = G.p, k = it.b;
  if (k === 'identify') {
    const cands = p.inv.filter(i => i !== it && (!i.id || !isKnown(i)));
    if (!cands.length && !(it.q > 1 && !isKnown(it))) { G.known['scroll:identify'] = 1; removeOne(it); msg('Scroll of Identify — but you have nothing to identify.', '#aaa'); endTurn(); return true; }
    G.known['scroll:identify'] = 1;
    UI.pickItem('Identify which item?', i => i !== it && (!i.id || !isKnown(i)), tgt => { removeOne(it); identifyItem(tgt); endTurn(); UI.refresh(); });
    return true;
  }
  if (k === 'enchw' && !p.equip.weapon) { msg('You have no weapon to enchant.', '#aaa'); return false; }
  removeOne(it); const wasKnown = isKnown(it); G.known['scroll:' + k] = 1; SFX.spell();
  switch (k) {
    case 'ret': runeOfReturn(); break;
    case 'teleport': if (lvl().town) msg('The scroll crumbles uselessly.'); else { teleportPlayer(14); msg('You are teleported!', '#c9f'); } break;
    case 'mapping': mapLevel(); msg('A map forms in your mind.', '#c9f'); break;
    case 'uncurse': { let n = 0; for (const sl of EQ_SLOTS) { const e = p.equip[sl]; if (e && e.cursed) { e.cursed = false; if (e.ench < 0) e.ench = 0; n++; } } msg(n ? 'A malevolent aura lifts from your gear.' : 'You feel as if someone is watching over you.', '#ff8'); calc(); break; }
    case 'enchw': { const w = p.equip.weapon; if (w.ench >= 8 && chance(0.5)) msg('The weapon glows briefly, but nothing happens.'); else { w.ench++; w.cursed = false; msg(`Your ${BASES[w.b].n} glows blue! (+${w.ench})`, '#6af'); } calc(); break; }
    case 'encha': { const sls = ['armor', 'shield', 'helm', 'cloak', 'gloves', 'boots'].filter(s => p.equip[s]); if (!sls.length) msg('Your skin tingles, then nothing.'); else { const a = p.equip[pick(sls)]; a.ench++; a.cursed = false; msg(`Your ${BASES[a.b].n} glows silver! (+${a.ench})`, '#6af'); } calc(); break; }
    case 'detect': G.detectT = 50; msg('You sense the creatures of this level.', '#c9f'); break;
    case 'protect': p.st.shield = 80; p.st.shieldN = 3; msg('A powerful ward surrounds you!', '#9cf'); calc(); break;
    case 'storm': { const vm = visibleMons(); if (!vm.length) msg('Flames roar harmlessly around you.', '#f84'); for (const m of vm) { FX.burst(m.x, m.y, '#f80'); damageMon(m, rnd(10, 20) + G.depth * 3, 'fire', '#f84'); } break; }
    case 'summon': { msg('Monsters appear around you!', '#f88'); for (let i = 0; i < 3; i++) { const s = freeNear(p.x, p.y, 1); if (s && !lvl().town) { const pool = monPool(Math.max(1, G.depth)); addMon(pick(pool), s.x, s.y, false).track = 10; } } break; }
    case 'aggr': msg('A piercing scream echoes through the halls!', '#f88'); for (const m of lvl().mons) { m.asleep = false; m.track = 25; } break;
  }
  if (!wasKnown) msg(`(That was a Scroll of ${SCROLLS[k].n}.)`, '#aaa');
  if (G.p.hp > 0) endTurn();
  return true;
}
function zapWand(it, target) {
  if (it.chg <= 0) { msg('The wand is out of charges.', '#aaa'); it.id = true; return false; }
  const W = WANDS[it.b]; const S = SPELLS[W.spell];
  if (S.tgt && !target) { msg('No target in sight.', '#aaa'); return false; }
  it.chg--; G.known['wand:' + it.b] = 1; it.id = true; SFX.spell();
  doEffect(W.spell, Math.max(6, G.p.lvl + 2), target);
  endTurn(); return true;
}

// ===================== EQUIPMENT =====================
function equipItem(it) {
  const p = G.p, B = BASES[it.b];
  let slot = B.slot;
  if (slot === 'ring') slot = !p.equip.ring1 ? 'ring1' : !p.equip.ring2 ? 'ring2' : 'ring1';
  const cur = p.equip[slot];
  if (cur && cur.cursed) { msg(`Your ${itemName(cur)} is cursed — you can't remove it!`, '#e55'); return false; }
  if (slot === 'weapon' && B.two && p.equip.shield) { if (p.equip.shield.cursed) { msg('Your cursed shield won\'t let go!', '#e55'); return false; } }
  if (slot === 'shield' && p.equip.weapon && BASES[p.equip.weapon.b].two) { if (p.equip.weapon.cursed) { msg('Your cursed weapon needs both hands!', '#e55'); return false; } }
  const i = p.inv.indexOf(it); if (i >= 0) p.inv.splice(i, 1);
  if (cur) p.inv.push(cur);
  if (slot === 'weapon' && B.two && p.equip.shield) { p.inv.push(p.equip.shield); p.equip.shield = null; }
  if (slot === 'shield' && p.equip.weapon && BASES[p.equip.weapon.b].two) { p.inv.push(p.equip.weapon); p.equip.weapon = null; }
  p.equip[slot] = it;
  const wasId = it.id; it.id = true;
  msg(`You equip ${itemName(it)}.`, itemColor(it));
  if (it.cursed) { msg('It\'s cursed! A chill grips you.', '#e55'); SFX.trap(); }
  else if (!wasId && it.rar > 0) msg(`It is ${RAR_NAME[it.rar].toLowerCase()}!`, itemColor(it));
  calc(); endTurn(); return true;
}
function unequip(slot) {
  const p = G.p, it = p.equip[slot];
  if (!it) return;
  if (it.cursed) { msg('It\'s cursed — it won\'t come off!', '#e55'); return; }
  if (p.inv.length >= MAX_INV) { msg('Your pack is full.', '#f88'); return; }
  p.equip[slot] = null; p.inv.push(it); calc(); msg(`You remove ${itemName(it)}.`); endTurn();
}
function dropItem(it) {
  const p = G.p; const i = p.inv.indexOf(it); if (i < 0) return;
  p.inv.splice(i, 1); lvl().items.push({ x: p.x, y: p.y, it, skip: true }); msg(`You drop ${itemName(it)}.`); endTurn();
}

// ===================== SHOPS =====================
function buyPrice(it) { return Math.max(1, Math.round(itemValue(it) * 1.1)); }
const EQ_SLOT = it => it.k === 'eq' ? BASES[it.b].slot : null;
const SHOP_BUYS = {
  general: it => it.k !== 'relic' && it.k !== 'key',
  smith: it => ['weapon', 'bow'].includes(EQ_SLOT(it)) || it.k === 'arrows',
  armor: it => ['armor', 'shield', 'helm', 'boots', 'gloves', 'cloak'].includes(EQ_SLOT(it)),
  alch: it => it.k === 'potion' || it.k === 'scroll',
  mage: it => it.k === 'wand' || it.k === 'book' || ['ring', 'amulet'].includes(EQ_SLOT(it)),
};
const SHOP_BUYS_TXT = { smith: 'weapons, bows and arrows', armor: 'armor, shields, helms, boots, gloves and cloaks', alch: 'potions and scrolls', mage: 'wands, spellbooks, rings and amulets' };
function sellPrice(it, shop) {
  if (BASES[it.b] && BASES[it.b].quest) return 0;
  const k = shop === 'general' ? 0.35 : 0.5; // the general store buys anything, but pays less
  if (it.k === 'eq' && !it.id) return Math.max(1, Math.round(BASES[it.b].v * k * (1 + 0.5 * it.rar)));
  if ((it.k === 'potion' || it.k === 'scroll' || it.k === 'wand') && !isKnown(it)) return 8;
  return Math.max(1, Math.round(itemValue(it) * k));
}
function buy(shop, it, qty = 1) {
  const p = G.p;
  const unit = it.q > 1 ? Math.round(buyPrice(it) / it.q) : buyPrice(it);
  const stack = stackKey(it) && it.k !== 'arrows';
  const cost = stack ? unit * qty : buyPrice(it);
  if (p.gold < cost) { msg('You can\'t afford that.', '#f88'); return false; }
  let got;
  if (stack) { got = Object.assign({}, it, { uid: G.uid++, q: qty }); } else got = it;
  if (!addInv(got)) return false;
  p.gold -= cost;
  if (stack) { it.q -= qty; if (it.q <= 0) shopsHere()[shop].splice(shopsHere()[shop].indexOf(it), 1); }
  else shopsHere()[shop].splice(shopsHere()[shop].indexOf(it), 1);
  if (it.k === 'potion' || it.k === 'scroll' || it.k === 'wand') G.known[it.k + ':' + it.b] = 1;
  got.id = true;
  msg(`Bought ${itemName(got)} for ${cost} gold.`, '#fd4'); SFX.coin();
  return true;
}
// sell one item, or a whole stack when all=true
function sell(shop, it, all) {
  const p = G.p; const price = sellPrice(it, shop);
  if (BASES[it.b] && BASES[it.b].quest) { msg('You cannot sell the Storm Crown!', '#f88'); return; }
  const stock = (shopsHere()[shop] = shopsHere()[shop] || []);
  if (it.q > 1 && stackKey(it) && it.k !== 'arrows' && !all) {
    const unitV = Math.max(1, Math.round(price / it.q)); it.q--; p.gold += unitV; msg(`Sold one for ${unitV} gold.`, '#fd4');
    const one = Object.assign({}, it, { uid: G.uid++, q: 1 }); one.id = true; stock.push(one);
  } else {
    p.inv.splice(p.inv.indexOf(it), 1); p.gold += price; msg(`Sold ${itemName(it)} for ${price} gold.`, '#fd4');
    it.id = true; stock.push(it);
  }
  SFX.coin();
}
// what the one-tap "sell junk" button sells in each shop
function junkFor(shop) {
  const buys = SHOP_BUYS[shop] || (() => true);
  return G.p.inv.filter(it => {
    if (!buys(it) || it.k === 'relic' || it.k === 'key') return false;
    if (it.k === 'eq') return it.id && it.rar < 3 && !BASES[it.b].quest && upgradeDelta(it) <= 0.5;
    if (it.k === 'potion') return isKnown(it) && POTIONS[it.b].bad;
    if (it.k === 'scroll') return isKnown(it) && SCROLLS[it.b].bad;
    if (it.k === 'wand') return it.id && it.chg <= 0;
    if (it.k === 'book') return G.p.spells.includes(it.b);
    return false;
  });
}

// ===================== GOLD SERVICES (long-term gold sinks) =====================
const MAX_ENCH = 10;
function enchantCost(it) { const B = BASES[it.b]; const n = Math.max(0, it.ench) + 1; return Math.round((120 + B.v * 0.35) * n * n); }
function enchantItem(it) {
  const c = enchantCost(it); if (G.p.gold < c || it.ench >= MAX_ENCH) return false;
  G.p.gold -= c; it.ench = Math.max(0, it.ench) + 1; it.cursed = false; it.id = true; calc();
  msg(`The smith works the ${BASES[it.b].n} — it is now +${it.ench}!`, '#6af'); SFX.coin(); return true;
}
function trainCost() { return Math.round(400 * Math.pow(1.3, G.trained || 0)); }
function trainStat(st) { const c = trainCost(); if (G.p.gold < c) return false; G.p.gold -= c; G.p[st]++; G.trained = (G.trained || 0) + 1; calc(); msg(`Hard training pays off: +1 ${STAT_NAME[st]}.`, '#8f8'); SFX.level(); return true; }
function gambleLevel() { return shopLevel(K(G.loc)) + 2; }
function gambleCost() { const L = gambleLevel(); return Math.round(250 + L * L * 5); }
function gambleItem() {
  const c = gambleCost(); if (G.p.gold < c) return null; if (G.p.inv.length >= MAX_INV) { msg('Your pack is full.', '#f88'); return null; }
  const L = gambleLevel(); const r = Math.random();
  const rar = r < 0.05 ? 3 : r < 0.33 ? 2 : 1;
  const bs = Object.keys(BASES).filter(b => BASES[b].lvl <= L && BASES[b].lvl >= L - 8 && !BASES[b].quest);
  const it = makeEquip(pick(bs.length ? bs : Object.keys(BASES).filter(b => !BASES[b].quest)), L, { rar, noCurse: 1 });
  G.p.gold -= c; addInv(it); SFX.coin();
  msg(`You crack open the crate: ${itemName(it)}!`, itemColor(it)); return it;
}
function rerollCost(it) { return Math.round(itemValue(it) * 0.45 + 300); }
function imbueCost(it) { return Math.round(itemValue(it) * 1.2 + 800); }
function reforge(it, rar) {
  const L = Math.max(it.ilvl || 1, shopLevel(K(G.loc)));
  const n = makeEquip(it.b, L, { rar, noCurse: 1 });
  it.pre = n.pre; it.suf = n.suf; it.mods = n.mods; it.rar = rar; it.id = true; it.cursed = false; if (it.ench < 0) it.ench = 0; it.ilvl = L;
  calc();
}
function rerollItem(it) { const c = rerollCost(it); if (G.p.gold < c) return false; G.p.gold -= c; reforge(it, it.rar); msg(`Runes swirl — it becomes ${itemName(it)}.`, itemColor(it)); SFX.spell(); return true; }
function imbueItem(it) { const c = imbueCost(it); if (G.p.gold < c) return false; G.p.gold -= c; reforge(it, 2); msg(`Power floods the item — ${itemName(it)} is now Rare!`, itemColor(it)); SFX.level(); return true; }

// ===================== SAVE / LOAD =====================
const SAVE_KEY = 'stormhold_save_v2';
function serializeGame() {
  const out = Object.assign({}, G); delete out.vis; delete out.flow; delete out.s;
  out.levels = {};
  for (const d in G.levels) { const L = G.levels[d]; const o = Object.assign({}, L, { t: L.t.join(''), seen: L.seen.map(v => v ? 1 : 0).join('') }); for (const k of Object.keys(o)) if (k[0] === '_') delete o[k]; out.levels[d] = o; }
  return JSON.stringify(out, (k, v) => (k === 'smoke' || (k && k[0] === '_' && k !== '_')) ? undefined : v);
}
function deserializeGame(raw) {
  const g = JSON.parse(raw);
  if (!g || !g.p || !g.levels) throw new Error('bad save');
  for (const d in g.levels) { const L = g.levels[d]; L.t = L.t.split(''); L.seen = L.seen.split('').map(Number); }
  G = g; G.dead = null;
  if (G.loc == null) G.loc = G.depth;
  G.loc = K(G.loc); G.depth = depthOf(G.loc); G.deep2 = G.deep2 || 0;
  for (const k in G.levels) { const L = G.levels[k]; if (!L.key) { L.key = K(k); L.kind = kindOf(k); } }
  Object.assign(G.quest, Object.assign({ circle: 0, freed: 0, won2: 0, met2: 0 }, G.quest));
  if (G.shops && G.shops.general) G.shops = { '0': G.shops };
  if (typeof G.restock !== 'object') G.restock = { '0': true, t2: true };
  if (!G.levels['0'] || G.levels['0'].tv !== TOWN_VER) { G.levels['0'] = genTown(1); if (G.loc === '0') { G.p.x = G.levels['0'].start.x; G.p.y = G.levels['0'].start.y; } }
  calc(); fov(); return true;
}
function saveMeta() { return { name: G.name, cls: G.cls, lvl: G.p.lvl, depth: G.depth, where: levelName(G.loc), maxDepth: G.maxDepth, hard: !!G.hard, at: Date.now() }; }
function saveGame() {
  if (!G || G.dead) return;
  try { localStorage.setItem(SAVE_KEY, serializeGame()); localStorage.setItem(SAVE_KEY + '_meta', JSON.stringify(saveMeta())); } catch (e) { /* storage unavailable */ }
  if (typeof Saves !== 'undefined') Saves.autoCloud();
}
function loadGame() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false; return deserializeGame(raw); } catch (e) { return false; }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function deleteSave() { try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(SAVE_KEY + '_meta'); } catch (e) { } if (typeof Saves !== 'undefined') Saves.remove('auto'); }
