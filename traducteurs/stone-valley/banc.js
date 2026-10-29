// Orvane × Stone Valley — LE BANC D'ESSAI (banc.js) : le traducteur dans un bac à sable qui imite le jeu.
//   node banc.js <chemin/vers/stonevalley/index.html>
// 1. le jour un : le monde à sa génération 0 ne change RIEN au jeu (poids, comptes, taux de variantes) ;
// 2. vingt cycles de chasse par dix comptes → l'instantané « courant » ; orvaneAppliquer() règle poids et caps ;
//    orvaneVariante() tire aux fréquences exposées (mode relatif) ;
// 3. les lignées (§210) : une séparation proche du parent est rendue par lui, une lignée qui a changé de forme est
//    construite ; elles prennent sols, taille, couleurs, prédateurs ; specById résout une lignée inconnue ;
// 4. les pressions : causes (« proie » et « faim » ignorées, « compagne » comptée), rencontres, lot valide contre
//    pression.schema.json, envoi espacé d'une demi-heure, lot gardé si le serveur refuse ; la boucle est fermée ;
// 5. un monde refait de zéro (même id, autre naissance) : le traducteur repart de sa nouvelle génération 0 ;
// 6. les conduites (§211) : phénotype exact à la naissance, conduites à leur fréquence réelle, robes au taux du jeu ;
// 7. la génétique continue (§212) : jour un inchangé, chasse des grands → la population rapetisse, le jeu le montre, le lot le rapporte ;
// 8. la reproduction sexuée (§213) : réservoir récessif, choix du partenaire, un petit tient de sa mère sans changer les taux ;
// 9. l'isolement et les hybrides (§214) : isolement reproductif, écart génétique, zone hybride et introgression, hybrides dans le jeu.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
if (!process.argv[2]) { console.error('usage : node banc.js <chemin/vers/stonevalley/index.html>'); process.exit(2); }
const ici = p => path.join(__dirname, p), racine = p => path.join(__dirname, '../..', p);
const Orvane = require(racine('moteur/orvane.js')), Tampon = require(racine('tampon/tampon.js')), Corps = require(racine('moteur/corps.js'));
const lireJ = f => JSON.parse(fs.readFileSync(f, 'utf8'));
// la génération 0 publiée (l'équilibre après rodage) ; à défaut, l'amorce
const gen0 = fs.existsSync(racine('mondes/sv-1/generation-0.json')) ? lireJ(racine('mondes/sv-1/generation-0.json')) : lireJ(ici('generation-0.json'));
const profil = lireJ(ici('profil.json'));
let ok = true; const verif = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) ok = false; };
const pct = v => v == null ? '?' : (v * 100).toFixed(2).replace('.', ',') + ' %';

// --- le bac à sable : les fiches du jeu, et des doublures pour le reste ---
const src = fs.readFileSync(process.argv[2], 'utf8');
const bac = new Proxy({}, { has: () => true, get: (t, k) => k === Symbol.unscopables ? undefined : 1 });
const SPEC = []; const re = /\{ id:'([a-z_]+)',\s*n:/g; let m;
while ((m = re.exec(src))) { let i = m.index, p = 0; do { const c = src[i]; if (c === '{') p++; else if (c === '}') p--; i++; } while (p && i < src.length);
  const txt = src.slice(m.index, i); if (!/cap:/.test(txt) || !/mat:/.test(txt)) continue; try { const o = vm.runInNewContext('(' + txt + ')', bac); if (!SPEC.some(e => e.id === o.id)) SPEC.push(o); } catch (e) { } }
const extraire = nom => vm.runInNewContext('(' + src.match(new RegExp('const ' + nom + ' = ([\\[{][\\s\\S]*?[\\]}]);'))[1] + ')');
const POIDS0 = extraire('POIDS_ESPECE'), RARES = extraire('RARES'), ORNEMENTS_DE = extraire('ORNEMENTS_DE');
for (const sp of SPEC) if (sp.biome) { const h = RARES.find(r => r.b === sp.biome)?.coul; if (h) sp.pierre = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
const CAP0 = Object.fromEntries(SPEC.map(s => [s.id, s.cap]));
const famille = sp => ['automate', 'coursier', 'tellurien', 'doux', 'trottin'].includes(sp.fam) ? sp.fam : 'rampant';
function bac2(fichiers, rpc) {
  const POIDS_ESPECE = { ...POIDS0 }; for (const sp of SPEC) sp.cap = CAP0[sp.id];
  for (let i = SPEC.length - 1; i >= 0; i--) if (SPEC[i].orvane) SPEC.splice(i, 1);
  for (const sp of SPEC) if (Array.isArray(sp.chasse)) sp.chasse = sp.chasse.filter(id => !id.includes('.'));
  const specById = {}; SPEC.forEach(sp => specById[sp.id] = sp);
  const memoire = {};
  const ctx = vm.createContext({ console, Math, Date, JSON, Object, Array, Number, String, Set, Map, WeakSet, Promise, Proxy, Reflect, setInterval: () => 0,
    SPEC, specById, POIDS_ESPECE, RARES, ORNEMENTS_DE, DESSINS: {}, INGR: {}, SEED: 884120, RaresIle: [9], biomesGraine: () => [9], profondeur: () => 3,
    chanceVariante: () => 1 + 2 * 3 / 20, familleBete: famille, biomeIci: 9, bAt: () => 9, P: { x: 0, y: 0 }, beasts: [],
    osOrvane: () => [], dessinOrvane: () => null,                       // lignees.js est là : les lignées qui ont changé de corps sont construites
    localStorage: { getItem: k => memoire[k] ?? null, setItem: (k, v) => { memoire[k] = v; } },
    fetch: async f => ({ ok: !!fichiers[f], json: async () => fichiers[f] }), window: {} });
  ctx.globalThis = ctx;
  for (const f of [racine('moteur/corps.js'), racine('tampon/tampon.js'), ici('correspondance.js'), ici('orvane-sv.js')]) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  return ctx;
}
const sp = id => SPEC.find(s => s.id === id);

(async () => {
  // === 1. le jour un ===
  console.log('1. le jour un : la génération 0');
  { const ctx = bac2({ 'orvane/instantane.json': gen0, 'orvane/generation-0.json': gen0, 'orvane/profil.json': profil });
    await ctx.OrvaneSV.charger(); ctx.orvaneEspeces(); ctx.orvaneAppliquer();
    const P = ctx.POIDS_ESPECE, diffP = Object.keys(POIDS0).filter(k => Math.abs((P[k] ?? -1) - POIDS0[k]) > 1e-9), diffC = SPEC.filter(s => s.cap !== CAP0[s.id]).map(s => s.id);
    verif(!diffP.length && !diffC.length, `poids et comptes inchangés sur une île à tourbière (${diffP.length + diffC.length} écarts${diffP.length + diffC.length ? ' : ' + [...diffP, ...diffC].join(', ') : ''})`);
    let g = 7; const r = () => { g = (Math.imul(g, 1664525) + 1013904223) >>> 0; return g / 4294967296; };
    for (const id of ['brouteur', 'crapaud', 'sterne']) {
      const N = 400000; let n = 0; for (let i = 0; i < N; i++) if (ctx.orvaneVariante(sp(id), r)) n++;
      const k = 1 + 2 * 3 / 20, attendu = 1 - (1 - k / 1140) * (1 - k / 18000);
      verif(Math.abs(n / N - attendu) < attendu * .15, `${id} : ${(n / N * 100).toFixed(3)} % de variantes, la règle du jeu en donne ${(attendu * 100).toFixed(3)} %`);
    }
  }

  // === 2. vingt cycles de chasse ===
  const lotChasse = { orvane: '0.1', monde: 'sv-1', instantane: 0, source: { jeu: 'stone-valley', compte: 'c' }, periode: { debut: '2026-01-01T00:00:00Z', fin: '2026-01-02T00:00:00Z' },
    evenements: [{ taxon: 'brouteur', biome: 'prairie', action: 'rencontre', n: 60 }, { taxon: 'brouteur', phenotype: 'base', biome: 'prairie', action: 'prelevement', n: 8 },
      { taxon: 'crapaud', biome: 'tourbiere', action: 'rencontre', n: 20 }, { taxon: 'crapaud', phenotype: 'base', biome: 'tourbiere', action: 'prelevement', n: 1 },
      { taxon: 'spectre', phenotype: 'base', biome: 'lande', action: 'prelevement', n: 2 }] };   // (le crapaud de tourbière n'est que 500 : une chasse légère)
  let inst = gen0, avant = gen0, etat = {};
  for (let k = 0; k < 20; k++) { const lots = Array.from({ length: 10 }, (_, i) => ({ ...lotChasse, instantane: inst.cycle.n, source: { jeu: 'stone-valley', compte: 'c' + i } }));
    const r = Tampon.agreger(lots, inst, profil, etat, gen0); etat = r.etat; avant = inst; inst = Orvane.cycle(inst, r.pressions); }
  inst.cycle.date = new Date(Date.now() - 36e5).toISOString();   // reçu il y a une heure
  inst.precedent = { cycle: avant.cycle.n, taxons: avant.taxons.map(t => ({ id: t.id, populations: t.populations.map(p => ({ biome: p.biome, effectif: p.effectif })), phenotypes: t.phenotypes.map(p => ({ id: p.id, frequence: p.frequence })) })) };
  // deux lignées, comme le moteur les fait naître : l'une proche de son parent, l'autre qui a changé de forme
  const crapaud = inst.taxons.find(t => t.id === 'crapaud'), brouteur = inst.taxons.find(t => t.id === 'brouteur');
  const fille = (t, biome, corps, k) => ({ ...JSON.parse(JSON.stringify(t)), id: `${t.id}.${biome}`, nom: `${t.nom} (${biome === 'sylve' ? 'Sylve fongique' : 'Tourbière'})`, parent: t.id, apparu: inst.cycle.n,
    plan: { ...t.plan, masse_kg: t.plan.masse_kg * k, corps }, populations: [{ biome, effectif: 300, tendance: 0, depuis: inst.cycle.n }] });
  const cBip = Corps.normaliser({ ...crapaud.plan.corps, forme: 'bipede', pattes: 2, crete: .6, couleurs: { ...crapaud.plan.corps.couleurs, robe: [150, 60, 170] } });
  const cProche = Corps.normaliser({ ...brouteur.plan.corps, long: brouteur.plan.corps.long + .05 });
  inst.taxons.push(fille(crapaud, 'sylve', cBip, .5), fille(brouteur, 'tourbiere', cProche, 1.7));
  const eff = (I, id, b) => I.taxons.find(t => t.id === id)?.populations.find(p => p.biome === b)?.effectif;
  console.log(`\n2. après 20 cycles de chasse : brouteur@prairie ${eff(gen0, 'brouteur', 'prairie')} → ${eff(inst, 'brouteur', 'prairie')}, crapaud@tourbiere ${eff(gen0, 'crapaud', 'tourbiere')} → ${eff(inst, 'crapaud', 'tourbiere')}`);
  const appels = [];
  let reponse = { ok: true };
  const rpc = async (nom, args) => { appels.push(nom); if (reponse === 'panne') throw new Error('HTTP 404'); return reponse; };
  const ctx = bac2({ 'orvane/instantane.json': inst, 'orvane/generation-0.json': gen0, 'orvane/profil.json': profil });
  await ctx.OrvaneSV.charger(); ctx.orvaneEspeces();
  verif(ctx.OrvaneSV.S.courant?.cycle.n === inst.cycle.n, `instantané reçu (cycle ${inst.cycle.n}), avancement ${ctx.OrvaneSV.avancement().toFixed(2)}`);
  ctx.orvaneAppliquer();
  const P = ctx.POIDS_ESPECE;
  console.log('  poids   brouteur', POIDS0.brouteur, '→', P.brouteur?.toFixed(3), '· spectre', POIDS0.spectre, '→', P.spectre?.toFixed(3), '· glaneur', POIDS0.glaneur, '→', P.glaneur?.toFixed(3));
  verif(P.brouteur < POIDS0.brouteur && sp('brouteur').cap < CAP0.brouteur, 'brouteur chassé : poids et cap en baisse');
  verif(sp('traceur').cap === CAP0.traceur, 'automates intouchés');
  verif(['varan', 'cerf', 'sterne', 'dragon', 'sika', 'salamandre'].every(id => sp(id).cap > 0 || !ctx.OrvaneSV.effectifSur(gen0, id, ctx.OrvaneSV.biomesIle())), 'les espèces rares dès le départ ne sont pas rayées (seuil relatif)');
  { let g = 12345; const r = () => { g = (Math.imul(g, 1664525) + 1013904223) >>> 0; return g / 4294967296; };
    const N = 200000, cpt = {}; for (let i = 0; i < N; i++) { const v = ctx.orvaneVariante(sp('crapaud'), r); cpt[v] = (cpt[v] || 0) + 1; }
    console.log('  variantes sur 200 000 naissances de crapaud :', Object.entries(cpt).map(([k, v]) => `${k}:${v}`).join(' '));
    verif(Object.keys(cpt).every(k => k === 'null' || /^(albinos|melanique|dore)?(\|?(geant|nain)-(cornes|epines))?$/.test(k)), 'variantes du jeu, ornements de sa famille (tellurien : cornes, épines)');
    verif(ctx.orvaneVariante({ id: 'tisseuse', fam: 'automate' }, r) === undefined, 'espèce inconnue d\'Orvane : le jeu tire comme avant'); }

  // === 3. les lignées ===
  console.log('\n3. les lignées');
  const L1 = SPEC.find(s => s.id === 'crapaud.sylve'), L2 = SPEC.find(s => s.id === 'brouteur.tourbiere');
  verif(L1 && L2 && ctx.specById['crapaud.sylve'] === L1, 'deux lignées inscrites dans SPEC et specById');
  verif(L1?.orvane.genere === true && L2?.orvane.genere === false, `« ${L1?.n} » (bipède) est construite ; « ${L2?.n} » (proche du parent) est rendue par le brouteur`);
  verif(L1?.sz < sp('crapaud').sz && L2?.sz > sp('brouteur').sz, `tailles d'après la masse : ${sp('crapaud').sz} → ${L1?.sz}, ${sp('brouteur').sz} → ${L2?.sz}`);
  verif(L1?.bio.join() === '11' && L1?.biome === 11 && L2?.bio.join() === '9', 'sols de la lignée : sylve (Tellurien de sylve), tourbière');
  verif(L1 && String(L1.shell) === '150,60,170' && L1.fam === sp('crapaud').fam && L1.diet === sp('crapaud').diet, 'couleurs du corps, conduite de l\'ancêtre');
  verif(SPEC.filter(s => s.chasse && s.chasse.includes('brouteur')).every(s => s.chasse.includes('brouteur.tourbiere')), 'les prédateurs du brouteur chassent aussi sa lignée');
  ctx.RaresIle = [11]; ctx.orvaneAppliquer();
  verif(L1.cap > 0, `sur une île à sylve, la lignée du crapaud vit (cap ${L1.cap})`);
  ctx.RaresIle = [9]; ctx.orvaneAppliquer();
  verif(L1.cap === 0 && L2.cap > 0 && P['brouteur.tourbiere'] > 0, `sur une île à tourbière : pas de crapaud de sylve, le brouteur de tourbière (cap ${L2.cap}, poids ${P['brouteur.tourbiere']})`);
  const inconnu = ctx.specById['felin.cerisaie'];
  verif(inconnu && inconnu.id === 'felin.cerisaie' && inconnu.orvane.base === 'felin' && inconnu.n === 'Félin de brume de cerisaie', `une lignée inconnue est rendue par son parent : « ${inconnu?.n} »`);
  verif(ctx.specById['rien.du.tout'] === undefined && ctx.specById.brouteur === sp('brouteur'), 'specById ne résout que ce qu\'il peut');

  // === 4. les pressions ===
  console.log('\n4. les pressions');
  const b = (v, s = 'crapaud') => ({ sp: sp(s), variante: v, x: 3, y: 4, tame: false, dead: 0 });
  for (let i = 0; i < 14; i++) ctx.orvaneEvenement('prelevement', b(null), 'chassé');
  ctx.orvaneEvenement('prelevement', b('albinos'), 'flèche'); ctx.orvaneEvenement('prelevement', b(null), 'faim'); ctx.orvaneEvenement('prelevement', b(null), 'proie');
  ctx.orvaneEvenement('prelevement', b(null), 'compagne'); ctx.orvaneEvenement('capture', b('geant-cornes', 'brouteur'));
  ctx.orvaneEvenement('prelevement', { sp: L2, variante: null, x: 1, y: 1 }, 'flèche');
  ctx.beasts = [b(null), b('dore'), { sp: sp('brouteur'), x: 40, y: 40, tame: false, dead: 0 }, { sp: sp('traceur'), x: 1, y: 1 }]; ctx.OrvaneSV.releverRencontres(); ctx.OrvaneSV.releverRencontres();
  const lot = ctx.orvaneLot(); console.log('  lot :', lot.evenements.map(e => `${e.taxon}:${e.action}${e.phenotype ? '/' + e.phenotype : ''}×${e.n}`).join(' '));
  verif(lot.evenements.find(e => e.taxon === 'crapaud' && e.action === 'prelevement' && e.phenotype === 'base')?.n === 15, '15 prélèvements de base : 14 au joueur, 1 à sa compagne ; ni la faim ni la proie d\'un chasseur');
  verif(lot.evenements.find(e => e.action === 'prelevement' && e.phenotype === 'albinisme')?.n === 1 && lot.evenements.find(e => e.action === 'capture' && e.phenotype === 'gigantisme')?.n === 1, 'variantes reconnues : albinos → albinisme, geant-cornes → gigantisme');
  verif(lot.evenements.find(e => e.taxon === 'brouteur.tourbiere')?.n === 1, 'un prélèvement sur une lignée va à la lignée');
  verif(lot.evenements.find(e => e.action === 'rencontre')?.n === 2, '2 rencontres (le lointain et l\'automate exclus, pas de double compte)');
  const S = lireJ(racine('schemas/pression.schema.json'));
  const val = (s, v, p) => { const t = Array.isArray(s.type) ? s.type : [s.type], ty = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
    if (s.type && !t.includes(ty === 'number' && t.includes('integer') && Number.isInteger(v) ? 'integer' : ty)) return [p + ': type ' + ty]; if (s.enum && !s.enum.includes(v)) return [p + ': hors enum ' + v]; let e = [];
    if (ty === 'object') { for (const r of s.required || []) if (!(r in v)) e.push(p + ': manque ' + r); for (const k in v) { const ps = s.properties?.[k]; if (ps) e.push(...val(ps, v[k], p + '.' + k)); else if (s.additionalProperties === false) e.push(p + ': en trop ' + k); } }
    if (ty === 'array') v.forEach((x, i) => e.push(...val(s.items, x, p + '[' + i + ']'))); return e; };
  const erreurs = val(S, JSON.parse(JSON.stringify(lot)), 'lot'); verif(!erreurs.length, 'le lot respecte pression.schema.json' + (erreurs.length ? ' — ' + erreurs.join(' ; ') : ''));
  // l'envoi : une fois par demi-heure ; un refus garde le lot ; une panne réessaie dans cinq minutes
  verif(await ctx.orvaneEnvoyer(rpc, 'uid-1') === true && !ctx.orvaneLot(), 'envoi accepté : le lot part et se vide');
  ctx.orvaneEvenement('prelevement', b(null), 'flèche');
  verif(await ctx.orvaneEnvoyer(rpc, 'uid-1') === false && appels.length === 1 && ctx.orvaneLot(), 'cinq secondes plus tard : rien ne part (une demi-heure entre deux envois), le lot attend');
  ctx.OrvaneSV.S.dernierEnvoi = 0; reponse = { ok: false, erreur: 'trop de dépôts aujourd\'hui' };
  verif(await ctx.orvaneEnvoyer(rpc, 'uid-1') === false && ctx.orvaneLot()?.evenements.length === 1, 'refus du serveur : le lot est gardé');
  ctx.OrvaneSV.S.dernierEnvoi = 0; reponse = 'panne';
  verif(await ctx.orvaneEnvoyer(rpc, 'uid-1') === false && Date.now() - ctx.OrvaneSV.S.dernierEnvoi > 24 * 6e4, 'panne : nouvel essai dans cinq minutes, pas à chaque sauvegarde');
  const r2 = Tampon.agreger([lot], inst, profil, {}, gen0), suivant = Orvane.cycle(inst, r2.pressions);
  verif(suivant.cycle.pressions_recues === lot.evenements.length && (r2.pressions.taxons.crapaud?.tourbiere?.retrait?.base || 0) > 0, 'la boucle est fermée : le moteur a intégré le lot du jeu');

  // === 5. un monde refait de zéro ===
  console.log('\n5. un monde refait de zéro');
  const neuf = JSON.parse(JSON.stringify(gen0)); neuf.monde.ne = '2027-01-01T00:00:00Z'; neuf.cycle.n = 2;
  const g0neuf = JSON.parse(JSON.stringify(neuf)); g0neuf.cycle.n = 0;
  const f2 = { 'orvane/instantane.json': neuf, 'orvane/generation-0.json': g0neuf, 'orvane/profil.json': profil };
  ctx.fetch = async f => ({ ok: !!f2[f], json: async () => f2[f] });
  await ctx.OrvaneSV.charger();
  verif(ctx.OrvaneSV.S.courant.cycle.n === 2 && ctx.OrvaneSV.S.gen0.monde.ne === neuf.monde.ne, `même id, autre naissance : on prend le cycle 2 du nouveau monde (l'ancien était au cycle ${inst.cycle.n}) et sa génération 0`);

  // === 6. les conduites (§211) ===
  console.log('\n6. les conduites');
  { const c6 = bac2({ 'orvane/instantane.json': gen0, 'orvane/generation-0.json': gen0, 'orvane/profil.json': profil });
    await c6.OrvaneSV.charger(); c6.orvaneEspeces();
    let g = 99; const r = () => { g = (Math.imul(g, 1664525) + 1013904223) >>> 0; return g / 4294967296; };
    const tg = gen0.taxons.find(t => t.id === 'glaneur'), part = id => tg.phenotypes.filter(p => p.traits.includes(id)).reduce((a, p) => a + p.frequence, 0);
    const N = 200000, n = {}, phs = new Set(); let variantes = 0, mauvais = 0;
    for (let i = 0; i < N; i++) { const b = { sp: sp('glaneur') }; b.variante = c6.orvaneVariante(b.sp, r); c6.orvaneNaissance(b); if (b.variante) variantes++;
      if (!tg.phenotypes.some(p => p.id === b.phen)) mauvais++; else phs.add(b.phen);
      for (const c of b.conduites || []) n[c.id] = (n[c.id] || 0) + 1; }
    console.log('  sur 200 000 glaneurs :', Object.entries(n).map(([k, v]) => `${k} ${(v / N * 100).toFixed(2)} %`).join(', '));
    verif(!mauvais && phs.size > 3, `chaque bête porte un phénotype exact d'Orvane (${phs.size} différents)`);
    verif(Math.abs(n.crocs / N - part('crocs-allonges')) < part('crocs-allonges') * .2 && Math.abs(n.camouflage / N - part('camouflage')) < part('camouflage') * .2,
      `conduites à leur fréquence réelle : crocs ${(n.crocs / N * 100).toFixed(2)} % (monde ${(part('crocs-allonges') * 100).toFixed(2)} %), camouflés ${(n.camouflage / N * 100).toFixed(2)} % (monde ${(part('camouflage') * 100).toFixed(2)} %)`);
    const k = 1 + 2 * 3 / 20, attendu = 1 - (1 - k / 1140) * (1 - k / 18000);
    verif(Math.abs(variantes / N - attendu) < attendu * .15, `et les robes restent au taux du jeu : ${(variantes / N * 100).toFixed(3)} % (règle du jeu ${(attendu * 100).toFixed(3)} %)`);
    const cat = c6.OrvaneSV.S.courant.catalogue.traits, Cr = c6.OrvaneSV_Corr;
    const cj = Cr.conduitesDe(['jet-glandulaire', 'glande-irritante', 'melanisme'], { ...cat, 'jet-glandulaire': require(racine('moteur/catalogue.js')).TRAITS['jet-glandulaire'], 'glande-irritante': require(racine('moteur/catalogue.js')).TRAITS['glande-irritante'] }, ['marche', 'fouissage']);
    verif(cj.map(c => c.id).join() === 'crachat,glande,terrier' && cj[0].presage, 'du catalogue aux conduites : jet → crachat (avec son présage), glande → glande, fouissage → terrier ; la robe n\'agit pas');
    // un prélèvement rapporte le phénotype exact
    const b = { sp: sp('glaneur'), x: 1, y: 1, variante: null, phen: 'camouflage', conduites: [{ id: 'camouflage' }] };
    c6.OrvaneSV.S.lot = {}; c6.orvaneEvenement('prelevement', b, 'flèche');
    verif(c6.orvaneLot()?.evenements[0]?.phenotype === 'camouflage', 'un glaneur camouflé abattu est rapporté « camouflage » à Orvane, pas « base »');
  }

  // === 7. la génétique continue (§212, docs/8) ===
  console.log('\n7. la génétique continue');
  { const G = id => (I, b) => I.taxons.find(t => t.id === id).populations.find(p => p.biome === b);
    const jour1 = Orvane.cycle(gen0, {});                                // le premier cycle du moteur : les populations reçoivent leurs traits continus
    const c7 = bac2({ 'orvane/instantane.json': jour1, 'orvane/generation-0.json': gen0, 'orvane/profil.json': profil });
    await c7.OrvaneSV.charger(); c7.orvaneEspeces(); c7.orvaneAppliquer();
    const naitre = (ctx, id, n) => Array.from({ length: n }, () => { const b = { sp: sp(id), x: 1, y: 1 }; b.variante = ctx.orvaneVariante(b.sp, Math.random); ctx.orvaneNaissance(b); return b; });
    const B1 = naitre(c7, 'brouteur', 4000), sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return [m, Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length)]; };
    const [mz, sz] = sd(B1.map(b => b.q.taille));
    verif(B1.every(b => b.q && b.tq === undefined && b.vq === undefined && b.fq === undefined), 'jour un, variation 0 : chaque bête porte ses valeurs (b.q), aucune ne change de taille, d\'allure ni d\'audace');
    verif(Math.abs(sz - 1) < .06, `les valeurs tirées suivent la loi de la population : taille moyenne ${mz.toFixed(2)}, écart-type ${sz.toFixed(2)} (attendu 1)`);
    // les joueurs prennent les plus grands : z moyen des abattus = moyenne + 1, 8 % de la population par cycle
    const h0 = G('brouteur')(jour1, 'prairie'), prev = { m: h0.quant.taille.m, g: h0.quant.taille.g, v: h0.quant.taille.v };
    let I = jour1, e7 = {}, dm1 = null;
    for (let k = 0; k < 30; k++) { const p = G('brouteur')(I, 'prairie'), z = p.quant.taille.m + 1;
      const lots = Array.from({ length: 10 }, (_, i) => ({ ...lotChasse, instantane: I.cycle.n, source: { jeu: 'stone-valley', compte: 'g' + i },
        evenements: [{ taxon: 'brouteur', biome: 'prairie', action: 'rencontre', n: 60 }, { taxon: 'brouteur', phenotype: 'base', biome: 'prairie', action: 'prelevement', n: 8, q: { taille: +z.toFixed(2) } }] }));
      const r = Tampon.agreger(lots, I, profil, e7, gen0); e7 = r.etat;
      if (!k) verif(Math.abs((r.pressions.taxons.brouteur?.prairie?.q?.taille ?? 0) - z) < .02, `le tampon passe au moteur le z moyen des abattus (${r.pressions.taxons.brouteur?.prairie?.q?.taille})`);
      const avant = G('brouteur')(I, 'prairie').quant.taille; I = Orvane.cycle(I, r.pressions); if (!k) dm1 = G('brouteur')(I, 'prairie').quant.taille.m - avant.m; }
    const apres = G('brouteur')(I, 'prairie').quant.taille;
    verif(dm1 < 0 && apres.m < prev.m - .25, `chasser les plus grands les fait rapetisser : taille ${prev.m.toFixed(2)} → ${apres.m.toFixed(2)} écart-type en 30 cycles (${((Math.exp(.05 * (apres.m - prev.m)) - 1) * 100).toFixed(1)} % de longueur)`);
    const temoin = G('brouteur')(Array.from({ length: 30 }).reduce(x => Orvane.cycle(x, {}), jour1), 'prairie').quant.taille;
    verif(Math.abs(temoin.m - prev.m) < .15, `sans chasse sélective, elle ne bouge presque pas (${prev.m.toFixed(2)} → ${temoin.m.toFixed(2)})`);
    // le jeu montre l'écart de la population : plus petits dès l'île suivante, toutes les bêtes de la même façon
    const c7b = bac2({ 'orvane/instantane.json': I, 'orvane/generation-0.json': gen0, 'orvane/profil.json': profil });
    await c7b.OrvaneSV.charger(); c7b.orvaneEspeces(); c7b.orvaneAppliquer();
    const L = c7b.OrvaneSV.loiQ(sp('brouteur')), B2 = naitre(c7b, 'brouteur', 500), tq = B2.map(b => b.tq);
    verif(L && L.taille.d < -.1 && tq.every(x => x && x < 1 && Math.abs(x - tq[0]) < 1e-9), `le jeu montre l'écart de la population de l'île (d = ${L?.taille.d.toFixed(2)}) : toutes ses bêtes à ×${tq[0]} de taille`);
    const mots = c7b.OrvaneSV.quantMots(B2[0]);
    verif(L.taille.d > -.6 || mots.includes('l\'espèce a rapetissé ici'), `le panneau de la bête le dit : « ${mots.join(' · ') || '—'} »`);
    // variation 1 : la variation naturelle se voit, bête par bête
    c7b.OrvaneSV.S.profil = { ...profil, exposition: { ...profil.exposition, quantitatifs: { ...profil.exposition.quantitatifs, variation: 1 } } };
    const B3 = naitre(c7b, 'brouteur', 4000), [, sl] = sd(B3.map(b => Math.log(b.tq || 1) / .05));
    verif(Math.abs(sl - Math.sqrt(L.taille.v)) < .08, `variation 1 : les tailles s'étalent comme la population (écart-type ${sl.toFixed(2)}, loi ${Math.sqrt(L.taille.v).toFixed(2)})`);
    // le rapport : la valeur exacte des bêtes prélevées
    c7b.OrvaneSV.S.lot = {}; c7b.OrvaneSV.S.lotQ = {};
    const grands = B3.filter(b => b.q.taille > L.taille.m + 1).slice(0, 10); for (const b of grands) c7b.orvaneEvenement('prelevement', b, 'flèche');
    const evs = c7b.orvaneLot()?.evenements.filter(e => e.action === 'prelevement') || [], zm = grands.reduce((a, b) => a + b.q.taille, 0) / grands.length;
    const ev = { q: { taille: +(evs.reduce((a, e) => a + e.n * e.q.taille, 0) / evs.reduce((a, e) => a + e.n, 0)).toFixed(2) } };
    verif(evs.length && Math.abs(ev.q.taille - zm) < .02 && !val(S, JSON.parse(JSON.stringify(c7b.orvaneLot())), 'lot').length, `dix grands abattus : le lot rapporte leur taille moyenne (${ev?.q.taille}, réelle ${zm.toFixed(2)}) et respecte le schéma`);
  }

  // === 8. la reproduction sexuée (§213, docs/9) ===
  console.log('\n8. la reproduction sexuée');
  { const fr = (I, id, tr) => I.taxons.find(x => x.id === id).phenotypes.filter(p => p.traits.includes(tr)).reduce((s, p) => s + p.frequence, 0);
    // le réservoir récessif : tous les brouteurs albinos abattus quinze cycles ; les porteurs cachés les font revenir
    let I = gen0; const f0 = fr(gen0, 'brouteur', 'albinisme');
    for (let k = 0; k < 45; k++) { const t = I.taxons.find(x => x.id === 'brouteur'), pr = { taxons: { brouteur: {} } };
      if (k < 15) for (const p of t.populations) pr.taxons.brouteur[p.biome] = { retrait: Object.fromEntries(t.phenotypes.filter(q => q.traits.includes('albinisme')).map(q => [q.id, p.effectif * (q.frequence_par_biome?.[p.biome] ?? q.frequence) * 1.2])) };
      I = Orvane.cycle(I, k < 15 ? pr : {}); if (k === 14) var fChasse = fr(I, 'brouteur', 'albinisme'); }
    const fApres = fr(I, 'brouteur', 'albinisme');
    verif(fChasse < f0 / 5 && fApres > fChasse * 3, `albinisme récessif : ${(f0 * 100).toFixed(2)} % → ${(fChasse * 100).toFixed(2)} % après 15 cycles d'abattage → ${(fApres * 100).toFixed(2)} % trente cycles plus tard (les porteurs cachés)`);
    // le choix du partenaire : la robe dorée (attrait 1,6) gagne contre son coût en survie. On la suit dans la population
    // de la tourbière (430 crapauds), trente cycles, avec et sans choix, sur trois graines : sur cent cycles, la dérive d'une
    // si petite population l'emporte (une histoire de plus ou de moins, et le résultat s'inverse)
    const pD = I => I.taxons.find(x => x.id === 'crapaud').populations.find(p => p.biome === 'tourbiere').alleles['robe-doree'];
    const essai = (at, d) => { Orvane.REGLES.sexe.attrait = at; let J = { ...gen0, monde: { ...gen0.monde, graine: gen0.monde.graine + d } };
      for (let k = 0; k < 30; k++) J = Orvane.cycle(J, {}); Orvane.REGLES.sexe.attrait = 1; return pD(J); };
    const paires = [0, 1, 2].map(d => [essai(0, d), essai(1, d)]), p0 = pD(gen0), moy = k => paires.reduce((a, x) => a + x[k], 0) / 3;
    verif(paires.every(([sans, avec]) => avec > sans * 1.004), `choix du partenaire : à la tourbière, l'allèle de la robe dorée passe de ${pct(p0)} à ${pct(moy(1))} en 30 cycles, ${pct(moy(0))} si les partenaires ne choisissent pas ; plus haut avec le choix sur chacune des trois graines`);
    // dans le jeu : un petit tient de sa mère, et les taux d'ensemble ne bougent pas
    const c8 = bac2({ 'orvane/instantane.json': gen0, 'orvane/generation-0.json': gen0, 'orvane/profil.json': profil });
    await c8.OrvaneSV.charger(); c8.orvaneEspeces(); c8.orvaneAppliquer();
    const ne = (id, mere) => { const b = { sp: sp(id), x: 1, y: 1 }; b.variante = c8.orvaneVariante(b.sp, Math.random); c8.orvaneNaissance(b, mere || null); return b; };
    const N = 20000, albinos = { sp: sp('brouteur'), phen: 'albinisme', variante: 'albinos', traits: [] };
    const nA = Array.from({ length: N }, () => ne('brouteur', albinos)).filter(b => /albinos/.test(b.variante || '')).length, nT = Array.from({ length: N }, () => ne('brouteur')).filter(b => /albinos/.test(b.variante || '')).length;
    verif(nA > nT * 10, `une mère albinos a ${(nA / N * 100).toFixed(1)} % de petits albinos (récessif : il faut que le père porte l'allèle) ; sans mère connue, ${(nT / N * 100).toFixed(2)} %`);
    const R = profil.exposition.traits_rendus, L = [];
    for (const t of gen0.taxons) { if (!sp(t.id)) continue; const m = {}; for (const ph of t.phenotypes) for (const x of ph.traits) if (!R.includes(x)) m[x] = (m[x] || 0) + ph.frequence; for (const [x, f] of Object.entries(m)) if (f > .02 && f < .6) L.push([t.id, x, f]); }
    L.sort((a, b) => b[2] - a[2]); const [tid, tr, f] = L[0];
    const meres = Array.from({ length: N }, () => ne(tid)), petits = meres.map(m => ne(tid, m)), a = (B, x) => B.filter(b => (b.traits || []).includes(x)).length / B.length;
    const avecM = meres.filter(m => m.traits.includes(tr)), sansM = meres.filter(m => !m.traits.includes(tr)), pAvec = a(avecM.map(m => ne(tid, m)), tr), pSans = a(sansM.slice(0, 4000).map(m => ne(tid, m)), tr);
    verif(Math.abs(a(petits, tr) - a(meres, tr)) < .012 && pAvec > pSans * 1.5, `${tid}, ${tr} : les mères ${(a(meres, tr) * 100).toFixed(1)} %, leurs petits ${(a(petits, tr) * 100).toFixed(1)} % (le taux ne bouge pas) ; ${(pAvec * 100).toFixed(0)} % chez les petits d'une mère qui le porte, ${(pSans * 100).toFixed(0)} % sinon`);
    const Lq = c8.OrvaneSV.loiQ(sp('brouteur')), Mq = Array.from({ length: 6000 }, () => ne('brouteur')), Pq = Mq.map(m => ne('brouteur', m));
    const xs = Mq.map(m => m.q.taille), ys = Pq.map(p => p.q.taille), mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, x) => s + x, 0) / ys.length;
    const pente = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0), h2 = Lq.taille.g / Lq.taille.v;
    verif(Math.abs(pente - h2 / 2) < .05, `la taille d'un petit suit celle de sa mère : pente ${pente.toFixed(2)} (h²/2 = ${(h2 / 2).toFixed(2)})`);
  }

  // === 9. l'isolement et les hybrides (§214, docs/10) ===
  console.log('\n9. l\'isolement et les hybrides');
  { const T = new Map(gen0.taxons.map(t => [t.id, t])), br = T.get('brouteur'), n0 = gen0.cycle.n;
    const fille = JSON.parse(JSON.stringify(br)); fille.id = 'brouteur.lande'; fille.nom = 'Brouteur de lande'; fille.parent = 'brouteur'; fille.apparu = n0 - 40;
    fille.plan = { ...br.plan, masse_kg: br.plan.masse_kg * 1.1, corps: Corps.normaliser({ ...br.plan.corps, long: Math.min(1, br.plan.corps.long + .04) }) };
    const T2 = new Map([...T, [fille.id, fille]]), iso = n => Orvane.isolement(br, fille, T2, n);
    verif(Orvane.isolement(br, br, T2, n0) === 0 && Orvane.isolement(br, T.get('traqueur'), T2, n0) === 1 && iso(n0) < iso(n0 + 400) && iso(n0 + 400) < 1,
      `isolement reproductif : 0 avec soi, 1 avec une espèce sans parenté, ${iso(n0).toFixed(2)} pour une lignée fille de 40 cycles, ${iso(n0 + 400).toFixed(2)} 400 cycles plus tard`);
    const a = { albinisme: .1, melanisme: .02 };
    verif(Orvane.divergence(a, null, a, null) === 0 && Orvane.divergence(a, null, { albinisme: .6 }, null) > .1, 'l\'écart génétique est nul entre deux populations identiques, net entre deux qui ont divergé');
    // une lignée fille retrouve sa mère dans la prairie : zone hybride, et ses gènes passent chez la mère
    const g = JSON.parse(JSON.stringify(gen0)), pm = g.taxons.find(t => t.id === 'brouteur').populations.find(p => p.biome === 'prairie'), pf = JSON.parse(JSON.stringify(pm));
    pf.effectif = Math.round(pm.effectif * .6); pf.alleles = Object.fromEntries(Object.entries(pf.alleles || {}).map(([k, v]) => [k, Math.min(.9, v * 6)])); pf.depuis = fille.apparu;
    g.taxons.push({ ...fille, populations: [pf] });
    const ecart = I => Orvane.divergence(I.taxons.find(t => t.id === 'brouteur').populations.find(p => p.biome === 'prairie').alleles, null, I.taxons.find(t => t.id === 'brouteur.lande').populations.find(p => p.biome === 'prairie').alleles, null);
    let Ia = g, Ib = g; for (let k = 0; k < 30; k++) { Ia = Orvane.cycle(Ia, {}); Ib = Orvane.cycle(Ib, {}, { hybride: false }); }
    const z = Ia.taxons.find(t => t.id === 'brouteur').populations.find(p => p.biome === 'prairie').hybride;
    verif(z && z.avec === 'brouteur.lande' && z.part > .005 && ecart(Ia) < ecart(Ib), `zone hybride : ${pct(z?.part)} des naissances de la mère ont un père de la lignée fille (isolement ${z?.isolement}) ; écart génétique ${ecart(Ia).toFixed(3)} contre ${ecart(Ib).toFixed(3)} sans croisements`);
    // dans le jeu : sur l'île, une part des brouteurs naît hybride, et le dit
    const c9 = bac2({ 'orvane/instantane.json': Ia, 'orvane/generation-0.json': gen0, 'orvane/profil.json': profil });
    await c9.OrvaneSV.charger(); c9.orvaneEspeces(); c9.orvaneAppliquer();
    const Z = c9.OrvaneSV.zoneHybride(sp('brouteur')), N = 20000;
    let h = 0, mot = ''; for (let i = 0; i < N; i++) { const b = { sp: sp('brouteur'), x: 1, y: 1 }; b.variante = c9.orvaneVariante(b.sp, Math.random); c9.orvaneNaissance(b); if (b.hybride) { h++; mot ||= c9.OrvaneSV.quantMots(b)[0]; } }
    verif(Z && Math.abs(h / N - Z.part) < Math.max(.002, Z.part * .2) && /hybride/.test(mot), `sur une île à prairie, ${pct(h / N)} des brouteurs naissent hybrides (la zone en annonce ${pct(Z?.part)}) ; le panneau dit « ${mot} »`);
  }

  // === 10. les organes (§215, docs/11) ===
  console.log('\n10. les organes');
  { const C = Corps.normaliser({ forme: 'quadrupede', cornes: .5, carapace: .1, crete: .3 });
    verif(C.organes.length === 2 && C.organes.some(o => o.type === 'cornes' && o.taille === .5 && o.nombre === 2) && C.cornes === .5 && C.carapace === 0,
      `un corps d'avant se lit en organes : ${C.organes.map(o => o.type + ' ' + o.taille).join(', ')} (la carapace à 0,1 n'en était pas une)`);
    let g = 11; const R = () => { g = (Math.imul(g, 1664525) + 1013904223) >>> 0; return g / 4294967296; };
    const nu = Corps.normaliser({ forme: 'quadrupede' }), N = 4000, vus = {}; let neuf = 0;
    for (let i = 0; i < N; i++) { const d = Corps.deriver(nu, { regime: 'herbivore', locomotion: ['marche'] }, { axes: {}, milieu: 'terre' }, R); if (d.organes.length) { neuf++; for (const o of d.organes) vus[o.type] = (vus[o.type] || 0) + 1; } }
    const eau = {}; for (let i = 0; i < N; i++) for (const o of Corps.deriver(nu, { regime: 'carnivore', locomotion: ['nage'] }, { axes: {}, milieu: 'aquatique' }, R).organes) eau[o.type] = (eau[o.type] || 0) + 1;
    const top = O => Object.entries(O).sort((a, b) => b[1] - a[1])[0]?.[0];
    verif(neuf / N > .03 && neuf / N < .1 && Object.keys(vus).length >= 8 && top(eau) === 'nageoires',
      `un organe neuf reste rare : ${pct(neuf / N)} des séparations en font naître un, de ${Object.keys(vus).length} types ; dans l'eau, ce sont d'abord des ${top(eau)}`);
    const M = Corps.normaliser({ forme: 'quadrupede', queue: .6, organes: [{ type: 'massue', taille: .8, forme: 'cloutee' }, { type: 'cornes', taille: .5, nombre: 1, forme: 'droites' }] }), D = Corps.decrire(M);
    verif(/massue clout/.test(D) && /une corne/.test(D) && Corps.distance(M, M) === 0 && Corps.distance(M, nu) > Corps.distance(Corps.normaliser({ forme: 'quadrupede', queue: .6 }), nu),
      `« ${D} » ; deux corps qui diffèrent par leurs organes s'écartent`);
    // l'instantané porte le catalogue des organes ; le jeu y lit leurs conduites, à la force de leur taille
    const I1 = Orvane.cycle(gen0, {}), K = I1.catalogue.organes;
    const types = new Set(I1.taxons.flatMap(t => t.plan.corps ? Corps.normaliser(t.plan.corps).organes.map(o => o.type) : []));
    verif(K && Object.keys(K).length >= 15 && [...types].every(x => K[x]), `l'instantané porte catalogue.organes (${Object.keys(K || {}).length} types) ; tous les organes des lignées y sont`);
    const c10 = bac2({ 'orvane/instantane.json': I1, 'orvane/generation-0.json': gen0, 'orvane/profil.json': profil });
    await c10.OrvaneSV.charger(); c10.orvaneEspeces(); c10.orvaneAppliquer();
    const lignee = (org) => ({ id: 'essai', orvane: { corps: { forme: 'quadrupede', queue: .6, organes: org }, locomotion: ['marche'] } });
    const cd = c10.OrvaneSV.conduitesPour(lignee([{ type: 'massue', taille: .8 }, { type: 'aiguillon', taille: .5 }, { type: 'plaques', taille: .25 }]), []);
    const petite = c10.OrvaneSV.conduitesPour(lignee([{ type: 'massue', taille: .35 }]), []).find(x => x.id === 'charge');
    const ch = cd.find(x => x.id === 'charge'), sansOrganes = SPEC.filter(s => !s.orvane).every(s => !c10.OrvaneSV.conduitesPour(s, []).some(x => x.organe));
    verif(ch && ch.organe === 'massue' && ch.force > petite.force && cd.some(x => x.id === 'dard' && x.effet === 'venin') && !cd.some(x => x.organe === 'plaques') && sansOrganes,
      `une massue fait charger (force ${ch?.force}, ${petite?.force} si elle est petite), un aiguillon pique ; des plaques trop petites ne font rien ; une espèce du jeu n'en tire rien`);
    const I2 = JSON.parse(JSON.stringify(I1)); I2.catalogue.organes.massue.conduite.force = 2; delete I2.catalogue.organes.aiguillon.conduite;
    const c10b = bac2({ 'orvane/instantane.json': I2, 'orvane/generation-0.json': gen0, 'orvane/profil.json': profil });
    await c10b.OrvaneSV.charger(); c10b.orvaneEspeces(); c10b.orvaneAppliquer();
    const cd2 = c10b.OrvaneSV.conduitesPour(lignee([{ type: 'massue', taille: .8 }, { type: 'aiguillon', taille: .5 }]), []);
    verif(cd2.find(x => x.id === 'charge')?.force > ch.force && !cd2.some(x => x.id === 'dard'), 'le jeu lit les conduites des organes dans l\'instantané : changer le catalogue suffit');
    // le dessin : chaque organe, à chaque forme de corps, sans valeur perdue
    const lg = vm.createContext({ t: 3, echB: () => 1, Math, Number, Array, Object, Set, OrvaneCorps: Corps });
    vm.runInContext(fs.readFileSync(path.join(path.dirname(process.argv[2]), 'lignees.js'), 'utf8'), lg);
    let faux = 0, boites = 0;
    for (const forme of Corps.FORMES) {
      const org = Object.entries(Corps.ORGANES_CAT).map(([type, T], i) => ({ type, taille: .4 + (i % 4) * .15, place: T.places[i % T.places.length], forme: T.formes[i % T.formes.length], nombre: T.nombre[i % 2] }));
      const spx = { id: 'dessin-' + forme, shell: [150, 120, 90], dark: [90, 70, 50], oeil: [20, 20, 20], orvane: { corps: Corps.normaliser({ forme, organes: org }), traits: [] } };
      const f = { sp: spx, x: 0, y: 0, etat: 'errer', ph: 1 }; for (let i = 0; i < 3; i++) { lg.t += .1; f.x += .05; for (const o of lg.osOrvane(f)) { boites++; for (const v of [...o.a, ...o.b, o.w, o.h, ...o.c]) if (!Number.isFinite(v)) faux++; } }
      const fin = (...v) => { if (!v.flat().every(Number.isFinite)) faux++; };
      lg.dessinOrvane({ disque: fin, ligne: fin, net: fin }, spx);
    }
    verif(!faux && boites > 500, `les ${Object.keys(Corps.ORGANES_CAT).length} organes se dessinent sur les ${Corps.FORMES.length} formes de corps (${boites} boîtes, aucune valeur perdue)`);
  }

  // === 11. la méfiance et l'habituation (§216, docs/12) ===
  console.log('\n11. la méfiance et l\'habituation');
  { const I0 = Orvane.cycle(gen0, {}), sans = I0.taxons.every(t => t.populations.every(p => p.mefiance == null && p.habituation == null));
    verif(sans, 'le jour un : sans contact avec les joueurs, aucune population n\'a rien appris');
    // la boucle entière : des lots de jeu, le tampon, le moteur
    const lotDe = (c, R, D) => ({ monde: gen0.monde.id, source: { compte: c }, evenements: [{ taxon: 'crapaud', biome: 'tourbiere', action: 'rencontre', n: R }, ...(D ? [{ taxon: 'crapaud', phenotype: 'base', biome: 'tourbiere', action: 'prelevement', n: D }] : [])] });
    const popC = I => I.taxons.find(t => t.id === 'crapaud').populations.find(p => p.biome === 'tourbiere');
    let I = gen0, et = {}, evts = [];
    for (let k = 0; k < 5; k++) { const r = Tampon.agreger([lotDe('a', 30, 6)], I, profil, et, gen0); et = r.etat; I = Orvane.cycle(I, r.pressions); evts.push(...I.evenements.filter(e => e.type === 'mefiance')); }
    const mC = popC(I).mefiance || 0;
    for (let k = 0; k < 6; k++) I = Orvane.cycle(I, {});
    const mA = popC(I).mefiance || 0;
    verif(mC > .5 && evts.length === 1 && Math.abs(mA / mC - .5) < .05, `cinq soirs de chasse (6 crapauds pris pour 30 rencontres) : méfiance ${mC.toFixed(2)}, un événement ; six cycles sans joueurs : ${mA.toFixed(2)} (la moitié)`);
    let J = gen0, et2 = {}; for (let k = 0; k < 8; k++) { const r = Tampon.agreger([lotDe('a', 40, 0)], J, profil, et2, gen0); et2 = r.etat; J = Orvane.cycle(J, r.pressions); }
    const hJ = popC(J).habituation || 0, r1 = Tampon.agreger([lotDe('a', 20, 4)], J, profil, et2, gen0), J2 = Orvane.cycle(J, r1.pressions);
    verif(hJ > .5 && !popC(J).mefiance && (popC(J2).habituation || 0) < hJ * .7, `huit soirs de rencontres sans suite : habituation ${hJ.toFixed(2)} ; une chasse la défait (${(popC(J2).habituation || 0).toFixed(2)})`);
    const [mHardi] = Orvane.apprendre(0, 0, { rencontres: 30, danger: 6 }, 1.5), [mTimide] = Orvane.apprendre(0, 0, { rencontres: 30, danger: 6 }, -1.5);
    verif(mHardi < mTimide, `la même chasse rend une population audacieuse moins méfiante (${mHardi.toFixed(2)}) qu'une timide (${mTimide.toFixed(2)})`);
    const r2 = Tampon.agreger([lotDe('a', 30, 6), lotDe('b', 600, 20)], gen0, profil, {}, gen0).pressions.taxons.crapaud.tourbiere.contact;
    verif(r2.rencontres === 90 && r2.danger === 8, `le tampon compte les contacts ; un compte qui court partout ne pèse pas plus qu'un autre (${r2.rencontres} rencontres, ${r2.danger} contacts qui finissent mal)`);
    // dans le jeu : une population méfiante fuit de plus loin, une habituée laisse approcher
    const essai = async (m, h, X) => { const G = JSON.parse(JSON.stringify(gen0)), q = popC(G); if (m) q.mefiance = m; if (h) q.habituation = h;
      const P2 = X ? { ...profil, exposition: { ...profil.exposition, mefiance: X } } : profil;
      const c = bac2({ 'orvane/instantane.json': G, 'orvane/generation-0.json': gen0, 'orvane/profil.json': P2 }); await c.OrvaneSV.charger(); c.orvaneEspeces(); c.orvaneAppliquer();
      const B = Array.from({ length: 3000 }, () => { const x = { sp: sp('crapaud'), x: 3, y: 4 }; x.variante = c.orvaneVariante(x.sp, Math.random); c.orvaneNaissance(x); return x; });
      return { f: B.reduce((a, x) => a + (x.fq || 1), 0) / B.length, mot: c.OrvaneSV.quantMots(B[0]).join(' · ') }; };
    const T0 = await essai(0, 0), Tm = await essai(.6, 0), Th = await essai(0, .5), Toff = await essai(.6, 0, { rendue: false });
    verif(Math.abs(Tm.f / T0.f - 2.2 ** .6) < .03 && Math.abs(Th.f / T0.f - .5 ** .5) < .02 && Math.abs(Toff.f - T0.f) < 1e-9 && /chasseurs/.test(Tm.mot) && /habitu/.test(Th.mot),
      `sur l'île, méfiance 0,6 : les crapauds fuient de ${(Tm.f / T0.f).toFixed(2)} fois plus loin (« ${Tm.mot} ») ; habituation 0,5 : ${(Th.f / T0.f).toFixed(2)} fois (« ${Th.mot} ») ; le profil peut l'éteindre`);
  }

  // === 12. le bestiaire d'Orvane (§217) : un monde né de la genèse, sans la faune du jeu ===
  console.log('\n12. le bestiaire d\'Orvane');
  { const Gd = racine('mondes/genese-7'), G = lireJ(path.join(Gd, 'instantane.json')), G0 = lireJ(path.join(Gd, 'generation-0.json'));
    const PG = { ...profil, exposition: { ...profil.exposition, bestiaire: 'orvane' } }, { FAUNE, GROUPE: GR } = require(ici('correspondance.js')), F = Object.keys(FAUNE);
    const c12 = bac2({ 'orvane/instantane.json': G, 'orvane/generation-0.json': G0, 'orvane/profil.json': PG });
    await c12.OrvaneSV.charger(); c12.orvaneEspeces(); c12.orvaneAppliquer();
    const L = SPEC.filter(x => x.orvane && x.cap > 0), faune = SPEC.filter(x => !x.orvane && F.includes(x.id)), autres = SPEC.filter(x => !x.orvane && !F.includes(x.id));
    const sols = new Set([1, 2, 3, 4, 5, 6, 7, 9]), avant = {};                  // les sols communs, et la tourbière (RaresIle)
    for (const x of faune) if ((x.bio || []).some(b => sols.has(b))) avant[GR[FAUNE[x.id]]] = (avant[GR[FAUNE[x.id]]] || 0) + CAP0[x.id];
    // (le régime de fait : dans genese-7, presque tous les carnivores digèrent aussi les plantes, estomac-large ; un groupe sans
    // trois lignées sur l'île ne peut pas remplir sa part, et l'île a moins de chasseurs : c'est le monde)
    const apres = {}, nL = {}; for (const x of L) { const g = GR[Tampon.regimeDe(G.taxons.find(t => t.id === x.orvane.taxon), G.catalogue?.traits)]; apres[g] = (apres[g] || 0) + x.cap; nL[g] = (nL[g] || 0) + 1; }
    const somme = o => Object.values(o).reduce((a, v) => a + v, 0), proche = Object.keys(avant).every(g => ((apres[g] || 0) >= avant[g] * .5 || (nL[g] || 0) < 3) && (apres[g] || 0) <= avant[g] * 2.2 + L.length / 3);
    const douxL = L.filter(x => x.fam === 'doux');
    verif(douxL.length > 0, `${douxL.length} lignées paisibles y sont des Doux (gabarit cotonnier) : les premières îles en auront`);
    verif(faune.every(x => x.cap === 0) && autres.every(x => x.cap === CAP0[x.id]) && L.length >= 10 && proche,
      `sur une île à tourbière : la faune du jeu s'efface (${faune.length} espèces), les automates et les autres restent ; ${L.length} lignées prennent sa place, ${somme(apres)} bêtes au plus pour ${somme(avant)} (${Object.keys(avant).map(g => `${g} ${apres[g] || 0}/${avant[g]}`).join(', ')})`);
    const c12b = bac2({ 'orvane/instantane.json': G, 'orvane/generation-0.json': G0, 'orvane/profil.json': profil });
    await c12b.OrvaneSV.charger(); c12b.orvaneEspeces(); c12b.orvaneAppliquer();
    verif(SPEC.filter(x => !x.orvane && F.includes(x.id)).every(x => x.cap === CAP0[x.id]), 'sans le réglage, un monde de genèse laisse la faune du jeu telle quelle (comme avant)');
  }

  // === 13. le monde d'Orvane : un monde pour tous les jeux (hebergement/LISEZ-MOI.md) ===
  console.log('\n13. le monde d\'Orvane, où tous les jeux se branchent');
  { const Ud = racine('mondes/orvane'), U = lireJ(path.join(Ud, 'instantane.json')), U0 = lireJ(path.join(Ud, 'generation-0.json')), PU = lireJ(path.join(Ud, 'profil.json'));
    const { EXPOSITION } = require(ici('correspondance.js'));
    // le tampon lit chaque lot avec l'exposition de son jeu
    // (une variante minoritaire, de 2 à 30 % : c'est elle qu'un jeu montre plus rare qu'elle n'est)
    const rare = x => x.phenotypes.slice(1).find(p => p.frequence > .02 && p.frequence < .3);
    const t = U.taxons.find(x => !x.eteint && rare(x) && x.phenotypes[0].frequence > .3 && x.populations.some(p => p.effectif > 5000)), V = rare(t);
    const b = t.populations.reduce((a, p) => p.effectif > a.effectif ? p : a).biome, v = V.id;
    const lotDe = (jeu, compte, n = 10) => ({ orvane: '0.1', monde: U.monde.id, jeu, instantane: U.cycle.n, source: { compte }, evenements: [{ taxon: t.id, biome: b, action: 'rencontre', n: 40 },
      { taxon: t.id, biome: b, action: 'prelevement', phenotype: t.phenotypes[0].id, n }, { taxon: t.id, biome: b, action: 'prelevement', phenotype: v, n }] });
    const jeux = { a: { exposition: { mode: 'compression', compression: { defaut: .1 }, propagation_cycles: 1 } } };
    const retraitDe = (lots, P = PU) => Tampon.agreger(lots, U, P, {}, U0, jeux).pressions.taxons[t.id]?.[b]?.retrait || {};
    const A = retraitDe([lotDe('a', 'a:1')]), B = retraitDe([lotDe('b', 'b:1')]), part = R => (R[v] || 0) / ((R[v] || 0) + (R[t.phenotypes[0].id] || 0));
    verif(Tampon.vueJeu(PU, jeux, 'a').exposition === jeux.a.exposition && Tampon.vueJeu(PU, jeux, 'inconnu').exposition === Tampon.NEUTRE,
      'chaque jeu a sa vue du monde ; un jeu inconnu (ou un lot sans jeu) est lu tel quel');
    verif(part(A) > part(B) * 1.5, `les mêmes prises, de deux jeux : la variante (${t.nom}, ${pct(V.frequence)} du taxon) pèse ${pct(part(A))} des pertes venues du jeu qui la montre dix fois moins, ${pct(part(B))} de celui qui montre tout`);
    // la part maximale d'un seul jeu
    const PJ = pj => ({ ...PU, influence: { ...PU.influence, memoire_cycles: 1, plafonds: { par_compte_cycle: null, part_max_compte: null, part_max_jeu: pj, part_max_population: null } } });
    const lots9 = [...Array.from({ length: 9 }, (_, i) => lotDe('a', 'a:' + i)), lotDe('b', 'b:1')], somme = R => Object.values(R).reduce((x, y) => x + y, 0);
    const libre = somme(retraitDe(lots9, PJ(null))), borne = somme(retraitDe(lots9, PJ(.5))), seulB = somme(retraitDe([lotDe('b', 'b:1')], PJ(.5)));
    verif(Math.abs((borne - seulB) - .5 * libre) < .02 * libre, `un jeu de neuf joueurs face à un jeu d'un seul : sa part est ramenée de ${pct((libre - seulB) / libre)} à la moitié de la pression d'avant le plafond (part_max_jeu = 0,5)`);
    // Stone Valley dans le monde d'Orvane : ses sols, son bestiaire, ses dépôts
    const c13 = bac2({ 'orvane/instantane.json': U, 'orvane/generation-0.json': U0, 'orvane/profil.json': PU });
    await c13.OrvaneSV.charger(); c13.orvaneEspeces(); c13.orvaneAppliquer();
    const ile = [...c13.OrvaneSV.biomesIle()], L = SPEC.filter(x => x.orvane && x.cap > 0);
    verif(ile.includes('marais') && ile.includes('foret') && ile.every(id => U.biomes.some(x => x.id === id)) && c13.OrvaneSV.S.profil.exposition.bestiaire === 'orvane',
      `les sols de l'île sont des biomes du monde (${ile.join(', ')}) ; sans jeux.json, le jeu montre le monde à sa façon (Corr.EXPOSITION)`);
    verif(L.length >= 10 && L.some(x => x.fam === 'doux') && SPEC.filter(x => !x.orvane && require(ici('correspondance.js')).FAUNE[x.id]).every(x => x.cap === 0),
      `la faune du jeu cède sa place à ${L.length} lignées du monde, dont ${L.filter(x => x.fam === 'doux').length} Doux`);
    const c13b = bac2({ 'orvane/instantane.json': U, 'orvane/generation-0.json': U0, 'orvane/profil.json': PU, 'orvane/jeux.json': [{ id: 'stone-valley', exposition: { ...EXPOSITION, bestiaire: 'jeu' } }] });
    await c13b.OrvaneSV.charger();
    verif(c13b.OrvaneSV.S.profil.exposition.bestiaire === 'jeu', 'avec jeux.json, le jeu prend l\'exposition que le tampon utilise');
    const envois = []; c13.ORVANE_DEPOT = { url: 'https://orvane.exemple', cle: 'sb_publishable_x', jeu: 'orv_essai' };
    c13.fetch = async (u, o) => { envois.push({ u, corps: JSON.parse(o.body), apikey: o.headers.apikey }); return { ok: true, json: async () => ({ ok: true }) }; };
    const bete = L[0]; for (let i = 0; i < 450; i++) c13.OrvaneSV.S.lot[[bete.orvane.taxon, '', 'marais', 'rencontre', 'x' + i].join('|')] = 1;
    const parti = await c13.orvaneEnvoyer(null, 'joueur-1', true), E = envois[0];
    verif(parti && E && E.u === 'https://orvane.exemple/rest/v1/rpc/orvane_deposer' && E.apikey === 'sb_publishable_x' && E.corps.p_cle === 'orv_essai' && E.corps.p_lot.monde === U.monde.id
      && E.corps.p_lot.evenements.length === 400 && Object.keys(c13.OrvaneSV.S.lot).length === 50,
      `le lot part vers le Supabase d'Orvane avec la clé du jeu, 400 événements à la fois (${Object.keys(c13.OrvaneSV.S.lot).length} attendent le suivant)`);
  }

  console.log(ok ? '\nTOUT PASSE' : '\nÉCHECS'); process.exit(ok ? 0 : 1);
})();
