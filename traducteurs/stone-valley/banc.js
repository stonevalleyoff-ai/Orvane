// Orvane × Stone Valley — LE BANC D'ESSAI (banc.js) : le traducteur dans un bac à sable qui imite le jeu.
//   node banc.js [chemin/vers/index.html]
// 1. fait vivre le monde 20 cycles sous la chasse de dix comptes → l'instantané « courant » (et le précédent) ;
// 2. charge tampon.js, correspondance.js et orvane-sv.js dans un contexte VM où SPEC, POIDS_ESPECE, SEED, biomesGraine,
//    chanceVariante, biomeIci, beasts, P, localStorage et fetch sont des doublures ;
// 3. vérifie : orvaneAppliquer() règle poids et caps ; orvaneVariante() tire les variantes aux fréquences exposées ;
//    orvaneEvenement() + rencontres → orvaneLot() valide contre pression.schema.json ; le lot repasse par le tampon
//    et le moteur : la boucle est fermée.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ici = p => path.join(__dirname, p), racine = p => path.join(__dirname, '../..', p);
const Orvane = require(racine('moteur/orvane.js')), Tampon = require(racine('tampon/tampon.js'));
const gen0 = JSON.parse(fs.readFileSync(ici('generation-0.json'))), profil = JSON.parse(fs.readFileSync(ici('profil.json')));
let ok = true; const verif = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) ok = false; };

// --- 1. vingt cycles de chasse ---
const lotChasse = { orvane: '0.1', monde: 'sv-1', instantane: 0, source: { jeu: 'stone-valley', compte: 'c' }, periode: { debut: '2026-01-01T00:00:00Z', fin: '2026-01-02T00:00:00Z' },
  evenements: [{ taxon: 'brouteur', biome: 'prairie', action: 'rencontre', n: 60 }, { taxon: 'brouteur', phenotype: 'base', biome: 'prairie', action: 'prelevement', n: 8 },
    { taxon: 'crapaud', biome: 'tourbiere', action: 'rencontre', n: 20 }, { taxon: 'crapaud', phenotype: 'base', biome: 'tourbiere', action: 'prelevement', n: 4 },
    { taxon: 'crapaud', phenotype: 'geant', biome: 'tourbiere', action: 'capture', n: 1 }, { taxon: 'spectre', phenotype: 'base', biome: 'lande', action: 'prelevement', n: 2 }] };
let inst = gen0, precedent = null, etat = {};
for (let k = 0; k < 20; k++) { const lots = Array.from({ length: 10 }, (_, i) => ({ ...lotChasse, instantane: inst.cycle.n, source: { jeu: 'stone-valley', compte: 'c' + i } }));
  const r = Tampon.agreger(lots, inst, profil, etat); etat = r.etat; precedent = inst; inst = Orvane.cycle(inst, r.pressions); }
inst.cycle.date = new Date(Date.now() - 36e5).toISOString();   // reçu il y a une heure
const eff = (I, id, b) => I.taxons.find(t => t.id === id)?.populations.find(p => p.biome === b)?.effectif;
console.log(`monde après 20 cycles : brouteur@prairie ${eff(gen0, 'brouteur', 'prairie')} → ${eff(inst, 'brouteur', 'prairie')}, crapaud@tourbiere ${eff(gen0, 'crapaud', 'tourbiere')} → ${eff(inst, 'crapaud', 'tourbiere')}, spectre@lande ${eff(gen0, 'spectre', 'lande')} → ${eff(inst, 'spectre', 'lande')}`);

// --- 2. le bac à sable ---
const src = fs.readFileSync(process.argv[2] || '/tmp/sv/index.html', 'utf8');
const bac = new Proxy({}, { has: () => true, get: (t, k) => k === Symbol.unscopables ? undefined : 1 });
const SPEC = []; const re = /\{ id:'([a-z_]+)',\s*n:/g; let m;
while ((m = re.exec(src))) { let i = m.index, p = 0; do { const c = src[i]; if (c === '{') p++; else if (c === '}') p--; i++; } while (p && i < src.length);
  const txt = src.slice(m.index, i); if (!/cap:/.test(txt) || !/mat:/.test(txt)) continue; try { const o = vm.runInNewContext('(' + txt + ')', bac); if (!SPEC.some(e => e.id === o.id)) SPEC.push(o); } catch (e) { } }
const POIDS_ESPECE = vm.runInNewContext('(' + src.match(/const POIDS_ESPECE = (\{[\s\S]*?\});/)[1] + ')');
const poidsAvant = { ...POIDS_ESPECE }, capAvant = Object.fromEntries(SPEC.map(s => [s.id, s.cap]));
const fichiers = { 'orvane/instantane.json': inst, 'orvane/generation-0.json': gen0, 'orvane/profil.json': profil };
const memoire = {};
const ctx = vm.createContext({ console, Math, Date, JSON, Object, Array, Number, String, Set, Map, WeakSet, Promise, setInterval: () => 0,
  SPEC, POIDS_ESPECE, SEED: 884120, biomesGraine: () => [9], profondeur: () => 3, chanceVariante: () => 1 + 2 * 3 / 20, familleBete: sp => sp.fam === 'tellurien' ? 'tellurien' : 'rampant',
  biomeIci: 9, P: { x: 0, y: 0 }, beasts: [],
  localStorage: { getItem: k => memoire[k] ?? null, setItem: (k, v) => { memoire[k] = v; } },
  fetch: async f => ({ ok: !!fichiers[f], json: async () => fichiers[f] }), window: {} });
ctx.globalThis = ctx;
for (const f of [racine('tampon/tampon.js'), ici('correspondance.js'), ici('orvane-sv.js')]) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });

(async () => {
  await ctx.OrvaneSV.charger();
  ctx.OrvaneSV.S.precedent = precedent;                // le banc impose le précédent : l'interpolation a de quoi travailler
  verif(ctx.OrvaneSV.S.courant?.cycle.n === inst.cycle.n, `instantané courant reçu (cycle ${inst.cycle.n}), génération 0 et profil chargés`);
  console.log(`avancement entre les deux instantanés : ${ctx.OrvaneSV.avancement().toFixed(2)} (reçu il y a 1 h, propagation sur ${profil.exposition.propagation_cycles} cycles)`);

  // --- 3a. appliquer ---
  ctx.orvaneAppliquer();
  const sp = id => SPEC.find(s => s.id === id);
  console.log('  poids   brouteur', poidsAvant.brouteur, '→', POIDS_ESPECE.brouteur?.toFixed(3), '· spectre', poidsAvant.spectre, '→', POIDS_ESPECE.spectre?.toFixed(3), '· glaneur', poidsAvant.glaneur, '→', POIDS_ESPECE.glaneur?.toFixed(3));
  console.log('  cap     brouteur', capAvant.brouteur, '→', sp('brouteur').cap, '· crapaud', capAvant.crapaud, '→', sp('crapaud').cap, '· spectre', capAvant.spectre, '→', sp('spectre').cap, '· traceur (automate)', capAvant.traceur, '→', sp('traceur').cap);
  verif(POIDS_ESPECE.brouteur < poidsAvant.brouteur && sp('brouteur').cap < capAvant.brouteur, 'brouteur chassé : poids et cap en baisse');
  { const ratio = eff(inst, 'crapaud', 'tourbiere') / eff(gen0, 'crapaud', 'tourbiere'); verif(sp('crapaud').cap === Math.max(1, Math.round(capAvant.crapaud * Math.min(2, ratio))), `crapaud : cap = cap0 × ${ratio.toFixed(2)} (chassé, mais il pond 40 petits : il prospère quand même)`); }
  verif(sp('traceur').cap === capAvant.traceur && Math.abs(POIDS_ESPECE.glaneur / poidsAvant.glaneur - 1) < .3, 'automates intouchés ; glaneur (non chassé) suit seulement la vie du monde');

  // --- 3b. variantes ---
  let g = 12345; const r = () => { g = (Math.imul(g, 1664525) + 1013904223) >>> 0; return g / 4294967296; };
  const N = 200000, cpt = {}; for (let i = 0; i < N; i++) { const v = ctx.orvaneVariante(sp('crapaud'), r); cpt[v] = (cpt[v] || 0) + 1; }
  const tc = inst.taxons.find(t => t.id === 'crapaud'), expo = Tampon.exposer(tc, profil, inst.catalogue.traits);
  console.log('  variantes tirées sur 200 000 naissances de crapaud :', Object.entries(cpt).map(([k, v]) => `${k}:${v}`).join(' '), '· exposé :', Object.entries(expo).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${(v * 100).toFixed(3)}%`).join(' '));
  const part = 1 - (cpt.null || 0) / N, attendu = (1 - expo.base) * (1 + 2 * 3 / 20);
  verif(Math.abs(part - attendu) < attendu * .3 + .0005, `part de variantes ${(part * 100).toFixed(3)} % ≈ attendue ${(attendu * 100).toFixed(3)} % (exposé × chanceVariante)`);
  verif(ctx.orvaneVariante({ id: 'tisseuse', fam: 'automate' }, r) === undefined, 'espèce inconnue d\'Orvane : le jeu tire comme avant (undefined)');

  // --- 3c. pressions ---
  const b = v => ({ sp: sp('crapaud'), variante: v, x: 3, y: 4, tame: false, dead: 0 });
  for (let i = 0; i < 14; i++) ctx.orvaneEvenement('prelevement', b(null), 'chassé');
  ctx.orvaneEvenement('prelevement', b('albinos'), 'flèche'); ctx.orvaneEvenement('prelevement', b(null), 'faim'); ctx.orvaneEvenement('capture', b('geant-cornes'));
  ctx.beasts = [b(null), b('dore'), { sp: sp('brouteur'), x: 40, y: 40, tame: false, dead: 0 }, { sp: sp('traceur'), x: 1, y: 1 }]; ctx.OrvaneSV.releverRencontres(); ctx.OrvaneSV.releverRencontres();
  const lot = ctx.orvaneLot(); console.log('  lot :', lot.evenements.map(e => `${e.action}${e.phenotype ? '/' + e.phenotype : ''}×${e.n}`).join(' '));
  verif(lot.evenements.find(e => e.action === 'prelevement' && e.phenotype === 'base')?.n === 14, '14 prélèvements de base (la mort de faim ignorée)');
  verif(lot.evenements.find(e => e.action === 'prelevement' && e.phenotype === 'albinisme')?.n === 1 && lot.evenements.find(e => e.action === 'capture' && e.phenotype === 'gigantisme')?.n === 1, 'variantes reconnues : albinos → albinisme, geant-cornes → gigantisme');
  verif(lot.evenements.find(e => e.action === 'rencontre')?.n === 2 && lot.evenements.every(e => e.biome === 'tourbiere'), '2 rencontres (le lointain et l\'automate exclus, pas de double compte) · biome : tourbière');
  // validation contre le schéma
  const S = JSON.parse(fs.readFileSync(racine('schemas/pression.schema.json')));
  const val = (s, v, p) => { const t = Array.isArray(s.type) ? s.type : [s.type], ty = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
    if (s.type && !t.includes(ty === 'number' && t.includes('integer') && Number.isInteger(v) ? 'integer' : ty)) return [p + ': type ' + ty]; if (s.enum && !s.enum.includes(v)) return [p + ': hors enum ' + v]; let e = [];
    if (ty === 'object') { for (const r of s.required || []) if (!(r in v)) e.push(p + ': manque ' + r); for (const k in v) { const ps = s.properties?.[k]; if (ps) e.push(...val(ps, v[k], p + '.' + k)); else if (s.additionalProperties === false) e.push(p + ': inconnu ' + k); } }
    if (ty === 'array') v.forEach((x, i) => e.push(...val(s.items, x, p + '[' + i + ']'))); return e; };
  const erreurs = val(S, JSON.parse(JSON.stringify(lot)), 'lot'); verif(!erreurs.length, 'le lot respecte pression.schema.json' + (erreurs.length ? ' — ' + erreurs.join(' ; ') : ''));
  // et retour dans le moteur
  const r2 = Tampon.agreger([lot], inst, profil, {}), suivant = Orvane.cycle(inst, r2.pressions);
  const retrait = r2.pressions.taxons.crapaud?.tourbiere?.retrait || {}; console.log('  retrait intégré :', JSON.stringify(retrait));
  verif(suivant.cycle.pressions_recues === lot.evenements.length && (retrait.base || 0) > 0, 'la boucle est fermée : le moteur a intégré le lot du jeu');
  console.log(ok ? '\nTOUT PASSE' : '\nÉCHECS'); process.exit(ok ? 0 : 1);
})();
