// Orvane — LE MOTEUR (moteur/orvane.js) — v0
// Un cycle : instantané + pressions (déjà passées au tampon) → instantané suivant. Déterministe : même graine,
// même état, mêmes pressions ⇒ même résultat. Node (require) ou navigateur (globalThis.Orvane). Zéro dépendance.
//
// CE QUE V0 SIMULE, par taxon × biome :
//  - une croissance logistique : les naissances baissent à mesure que la biomasse du biome approche sa capacité
//    (toutes les espèces du biome se partagent la même capacité : c'est la compétition) ;
//  - une mortalité naturelle tirée de la longévité ; une pénalité hors de la niche (axes du biome éloignés) ;
//  - des phénotypes : chaque combinaison de traits a son propre plan corporel (écarts) et son propre coût de
//    reproduction. Un trait ne « sert » à rien par lui-même : il pèse par son coût et ses écarts (une portée
//    plus grande, une maturité plus tardive…). Ce sont les pressions extérieures qui lui donnent sa valeur ;
//  - la mutation (un peu de chaque naissance change de phénotype), l'apparition de nouveaux traits admissibles ;
//  - la migration vers les biomes voisins en cas de surpeuplement, les déplacements imposés ;
//  - la séparation d'une lignée installée depuis longtemps dans un biome éloigné de sa niche ;
//  - l'habitat : la capacité d'un biome encaisse les pertes et regagne lentement sa valeur de base.
// PAS ENCORE : les relations proie-prédateur, les saisons, les maladies. (v1)
//
// FORMAT DES PRESSIONS reçues (sortie du tampon) :
//  { taxons: { [taxon]: { [biome]: { retrait: { [phenotype|'*']: n }, deplacement: [{ vers, n }] } } },
//    biomes: { [biome]: { habitat: ±n } } }
//  retrait > 0 : individus retirés (chasse, capture) ; < 0 : individus rendus ou aidés (libération, nourrissage).
(function (racine) {
'use strict';
const CAT = typeof require === 'function' ? require('./catalogue.js') : racine.OrvaneCatalogue;
const AXES = ['temperature', 'humidite', 'altitude', 'lumiere', 'couvert'];
const REGLES = {
  mutation: .004,            // part des naissances qui changent de phénotype (vers un phénotype existant)
  nouveau_trait: .03,        // chance, par taxon et par cycle, qu'un trait admissible apparaisse
  migration: .02,            // part de la population qui part vers un voisin quand le biome est saturé
  seuil_surpeuple: .85,      // saturation (biomasse / capacité) au-delà de laquelle on migre
  separation: { cycles: 30, effectif: 60, distance: .35, chance: .01 },   // installée depuis 30 cycles, loin de sa niche : ~1 chance sur 100 par cycle
  memoire_eteint: 10,        // un taxon éteint reste listé autant de cycles
  regain_habitat: .02,       // part de l'écart à la capacité de base regagné par cycle
  effondrement: -.25, explosion: .4,   // tendances qui font un événement
  menace: 50                 // effectif total sous lequel un taxon est « menacé »
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clone = o => JSON.parse(JSON.stringify(o));
const dist = (a, b) => Math.sqrt(AXES.reduce((s, k) => s + ((a[k] ?? .5) - (b[k] ?? .5)) ** 2, 0));
function rng(graine, n) {           // un générateur par cycle, semé par la graine du monde et le numéro de cycle
  let g = ((graine >>> 0) ^ Math.imul(n + 1, 0x9e3779b9)) >>> 0;
  return () => { g = (Math.imul(g, 1664525) + 1013904223) >>> 0; return g / 4294967296; };
}

// --- le plan corporel d'un phénotype : plan de base × écarts de ses traits ---
function planDe(plan, traits, cat) {
  const p = { ...plan };
  for (const id of traits) { const t = cat[id]; if (!t) continue;
    for (const k in t.ecarts || {}) if (typeof p[k] === 'number') p[k] *= t.ecarts[k];
    Object.assign(p, t.fixe || {}); }
  for (const k of ['sociabilite', 'temperament', 'perception']) if (typeof p[k] === 'number') p[k] = clamp(p[k], 0, 1);
  return p;
}
const coutDe = (traits, cat) => clamp(traits.reduce((s, id) => s + (cat[id]?.cout || 0), 0), 0, .95);
const ecartsDe = (traits, cat) => { const e = {}; for (const id of traits) for (const k in cat[id]?.ecarts || {}) e[k] = (e[k] ?? 1) * cat[id].ecarts[k]; return e; };
// taux intrinsèques, par cycle
const croissance = p => clamp(.6 * Math.log(1 + (p.portee || 2)) / Math.max(1, p.maturite || 1), .02, .35);
const mortalite = p => 1 / Math.max(2, p.longevite || 20);
// convenance d'un biome (0..1) : 1 dans la niche, décroît avec la distance ; nulle si le milieu est impossible
function convenance(plan, biome) {
  const loco = plan.locomotion || [], m = biome.milieu;
  const terre = loco.some(l => ['marche', 'course', 'saut', 'reptation', 'fouissage', 'grimpe'].includes(l));
  const ok = m === 'aquatique' ? loco.includes('nage') : m === 'aerien' ? loco.includes('vol')
    : m === 'souterrain' ? loco.includes('fouissage') || terre : m === 'amphibie' ? terre || loco.includes('nage') : terre || loco.includes('vol');
  if (!ok) return 0;
  if (!plan.niche) return 1;
  const d = dist(plan.niche, biome.axes), tol = plan.tolerance || .35;
  return Math.exp(-(d * d) / (2 * tol * tol));
}
const biomasse = (plans, N) => N.reduce((s, n, i) => s + n * (plans[i].masse_kg || 1), 0);

// --- un cycle ---
function cycle(inst, pressions = {}, opt = {}) {
  const n = inst.cycle.n + 1, R = rng(inst.monde.graine, n);
  const cat = { ...CAT.TRAITS, ...(inst.catalogue?.traits || {}) };
  const biomes = Object.fromEntries(inst.biomes.map(b => [b.id, clone(b)]));
  const ev = [], taxons = clone(inst.taxons);
  const prT = pressions.taxons || {}, prB = pressions.biomes || {};

  // 1. l'habitat : les pertes et gains du cycle, puis un lent retour vers la capacité de base
  for (const b of Object.values(biomes)) {
    b.capacite_base ??= b.capacite;
    b.capacite = Math.max(0, b.capacite + (prB[b.id]?.habitat || 0) * (opt.unite_habitat ?? 1));
    b.capacite += (b.capacite_base - b.capacite) * REGLES.regain_habitat;
  }

  // 2. l'état de départ : par taxon, les plans de chaque phénotype ; par biome, la biomasse totale
  const etat = new Map(), B = {};
  for (const t of taxons) {
    if (t.eteint) continue;
    const plans = t.phenotypes.map(p => planDe(t.plan, p.traits, cat));
    const pops = {};
    for (const pop of t.populations) {
      const N = t.phenotypes.map(p => pop.effectif * (p.frequence_par_biome?.[pop.biome] ?? p.frequence));
      pops[pop.biome] = { N, depuis: pop.depuis ?? t.apparu, avant: pop.effectif };
      B[pop.biome] = (B[pop.biome] || 0) + biomasse(plans, N);
    }
    etat.set(t.id, { plans, pops, couts: t.phenotypes.map(p => coutDe(p.traits, cat)) });
  }

  // 3. la dynamique, taxon par taxon
  const migrations = [];      // { taxon, vers, N[] } à appliquer après la boucle
  for (const t of taxons) {
    if (t.eteint) continue;
    const E = etat.get(t.id), K = t.phenotypes.length;
    for (const [bid, pop] of Object.entries(E.pops)) {
      const b = biomes[bid]; if (!b) { delete E.pops[bid]; continue; }
      const conv = convenance(t.plan, b), sat = b.capacite > 0 ? B[bid] / b.capacite : 9;
      const pr = prT[t.id]?.[bid] || {}, ret = pr.retrait || {};
      const tot = pop.N.reduce((a, x) => a + x, 0) || 1;
      const nais = new Array(K).fill(0), suiv = new Array(K).fill(0);
      for (let i = 0; i < K; i++) {
        const Np = pop.N[i]; if (Np <= 0) continue;
        const r = croissance(E.plans[i]) * (1 - E.couts[i]) * conv, m = mortalite(E.plans[i]) + (conv < .3 ? .08 : 0);
        nais[i] = Np * r * Math.max(0, 1 - sat);
        let ext = (ret[t.phenotypes[i].id] || 0) + (ret['*'] || 0) * Np / tot;   // retraits (ou apports) extérieurs
        ext = clamp(ext, -Np, Np + nais[i]);
        suiv[i] = Math.max(0, Np + nais[i] - Np * m - ext);
      }
      // mutation : un peu de chaque naissance va vers un autre phénotype du taxon
      if (K > 1) for (let i = 0; i < K; i++) { const q = nais[i] * REGLES.mutation; if (q > 0) { const j = (i + 1 + Math.floor(R() * (K - 1))) % K; suiv[i] -= q; suiv[j] += q; } }
      // déplacements imposés (le joueur emporte des bêtes ailleurs)
      for (const d of pr.deplacement || []) if (biomes[d.vers] && d.n > 0) {
        const part = Math.min(1, d.n / Math.max(1, suiv.reduce((a, x) => a + x, 0)));
        migrations.push({ taxon: t.id, vers: d.vers, N: suiv.map(x => x * part) }); for (let i = 0; i < K; i++) suiv[i] *= 1 - part;
      }
      // migration naturelle : saturé, on essaime vers un voisin
      if (sat > REGLES.seuil_surpeuple && (b.voisins || []).length) {
        const vers = b.voisins[Math.floor(R() * b.voisins.length)];
        if (biomes[vers] && convenance(t.plan, biomes[vers]) > 0) {
          const part = REGLES.migration * clamp((sat - REGLES.seuil_surpeuple) / (1 - REGLES.seuil_surpeuple), 0, 2);
          migrations.push({ taxon: t.id, vers, N: suiv.map(x => x * part) }); for (let i = 0; i < K; i++) suiv[i] *= 1 - part;
        }
      }
      pop.N = suiv;
    }
    // un nouveau trait, parfois : sur le phénotype le plus nombreux du biome le plus peuplé
    if (R() < REGLES.nouveau_trait) {
      const [bid, pop] = Object.entries(E.pops).sort((a, b) => b[1].N.reduce((x, y) => x + y, 0) - a[1].N.reduce((x, y) => x + y, 0))[0] || [];
      if (pop) {
        const i = pop.N.indexOf(Math.max(...pop.N)), base = t.phenotypes[i].traits;
        const cands = Object.keys(CAT.TRAITS).filter(id => CAT.admissible(id, base));
        if (cands.length) {
          const id = cands[Math.floor(R() * cands.length)], traits = [...base, id].sort(), pid = traits.join('+');
          if (!t.phenotypes.some(p => p.id === pid)) {
            t.phenotypes.push({ id: pid, frequence: 0, traits });
            E.plans.push(planDe(t.plan, traits, cat)); E.couts.push(coutDe(traits, cat));
            for (const p of Object.values(E.pops)) p.N.push(0);
            const q = Math.max(1, .002 * pop.N.reduce((a, x) => a + x, 0)); pop.N[i] -= Math.min(q, pop.N[i]); pop.N[pop.N.length - 1] += q;
            ev.push({ type: 'nouveau_trait', taxon: t.id, biome: bid, detail: `${id} apparaît chez « ${t.phenotypes[i].id} »` });
          }
        }
      }
    }
  }
  // 4. les arrivées
  for (const mg of migrations) {
    const E = etat.get(mg.taxon), t = taxons.find(x => x.id === mg.taxon);
    if (!E.pops[mg.vers]) E.pops[mg.vers] = { N: new Array(t.phenotypes.length).fill(0), depuis: n, avant: 0 };
    mg.N.forEach((x, i) => { E.pops[mg.vers].N[i] += x; });
  }

  // 5. séparation de lignées, extinctions, écriture des taxons
  const nouveaux = [];
  for (const t of taxons) {
    if (t.eteint) continue;
    const E = etat.get(t.id);
    for (const [bid, pop] of Object.entries(E.pops)) {
      const eff = pop.N.reduce((a, x) => a + x, 0), b = biomes[bid];
      const s = REGLES.separation, nid = `${t.id}.${bid}`;
      if (n - pop.depuis >= s.cycles && eff >= s.effectif && t.plan.niche && dist(t.plan.niche, b.axes) >= s.distance
        && !taxons.some(x => x.id === nid) && R() < s.chance) {
        const k = .7 + R() * .6, plan = { ...t.plan, masse_kg: +(t.plan.masse_kg * k).toFixed(3), taille_m: +(t.plan.taille_m * Math.cbrt(k)).toFixed(3),
          temperament: clamp(t.plan.temperament + (R() - .5) * .3, 0, 1), sociabilite: clamp(t.plan.sociabilite + (R() - .5) * .3, 0, 1),
          niche: { ...b.axes }, tolerance: t.plan.tolerance || .35 };
        nouveaux.push({ id: nid, nom: `${(t.nom || t.id).replace(/\s*\(.*\)$/, '')} (${b.nom || bid})`, parent: t.id, apparu: n, eteint: null, statut: 'croissance', plan,
          _E: { plans: t.phenotypes.map(p => planDe(plan, p.traits, cat)), couts: E.couts.slice(), pops: { [bid]: { N: pop.N.slice(), depuis: n, avant: pop.avant } } },
          phenotypes: clone(t.phenotypes) });
        ev.push({ type: 'separation', taxon: nid, biome: bid, detail: `lignée issue de ${t.id}, ${k < 1 ? 'plus petite' : 'plus grande'}` });
        delete E.pops[bid];
      }
    }
  }
  for (const nt of nouveaux) { etat.set(nt.id, nt._E); delete nt._E; taxons.push(nt); }

  const sortie = [];
  for (const t of taxons) {
    if (t.eteint) { if (n - t.eteint <= REGLES.memoire_eteint) sortie.push(t); continue; }
    const E = etat.get(t.id), K = t.phenotypes.length, totP = new Array(K).fill(0);
    t.populations = [];
    for (const [bid, pop] of Object.entries(E.pops)) {
      let eff = pop.N.reduce((a, x) => a + x, 0);
      if (eff < 2) { if (pop.avant >= 2) ev.push({ type: 'extinction', taxon: t.id, biome: bid, detail: 'la population disparaît' }); continue; }
      const tend = pop.avant > 0 ? (eff - pop.avant) / pop.avant : 1;
      if (pop.avant < 2) ev.push({ type: 'migration', taxon: t.id, biome: bid, detail: 'une population s\'installe' });   // (les arrivées trop maigres pour durer ne comptent pas)
      if (pop.avant >= 20 && tend <= REGLES.effondrement) ev.push({ type: 'effondrement', taxon: t.id, biome: bid, detail: `${Math.round(tend * 100)} % sur le cycle` });
      if (pop.avant >= 20 && tend >= REGLES.explosion) ev.push({ type: 'explosion', taxon: t.id, biome: bid, detail: `+${Math.round(tend * 100)} % sur le cycle` });
      const ret = prT[t.id]?.[bid]?.retrait || {}, extPos = Object.values(ret).reduce((a, x) => a + Math.max(0, x), 0);
      const mortsNat = pop.N.reduce((a, x, i) => a + x * mortalite(E.plans[i]), 0);
      const p = { biome: bid, effectif: Math.round(eff), tendance: +tend.toFixed(3), depuis: pop.depuis };
      if (extPos > 0) p.pression = +clamp(extPos / (extPos + mortsNat), 0, 1).toFixed(3);
      t.populations.push(p); pop.N.forEach((x, i) => { totP[i] += x; });
    }
    const total = totP.reduce((a, x) => a + x, 0);
    if (!t.populations.length) { t.eteint = n; t.statut = 'eteint'; t.phenotypes.forEach(p => { p.frequence = 0; delete p.frequence_par_biome; }); ev.push({ type: 'extinction', taxon: t.id, detail: 'le taxon s\'éteint' }); sortie.push(t); continue; }
    // les phénotypes : fréquences globales et par biome ; on oublie ceux qui ont disparu (jamais le premier, le plan de base)
    const garde = [];
    t.phenotypes.forEach((p, i) => {
      if (i > 0 && totP[i] < .5) return;
      const f = total ? totP[i] / total : 0;
      const q = { id: p.id, frequence: +f.toFixed(4), traits: p.traits, cout_total: +E.couts[i].toFixed(3) };
      if (t.populations.length > 1) { q.frequence_par_biome = {}; for (const pop of t.populations) { const N = E.pops[pop.biome].N, s = N.reduce((a, x) => a + x, 0); q.frequence_par_biome[pop.biome] = +(s ? N[i] / s : 0).toFixed(4); } }
      const ec = ecartsDe(p.traits, cat); if (Object.keys(ec).length) q.ecarts = ec;
      q.selection = +(f - (p.frequence || 0)).toFixed(4);
      garde.push(q);
    });
    t.phenotypes = garde;
    const avant = Object.values(E.pops).reduce((a, p) => a + p.avant, 0), tend = avant > 0 ? (total - avant) / avant : 1;
    t.statut = total < REGLES.menace ? 'menace' : tend > .05 ? 'croissance' : tend < -.05 ? 'declin' : 'stable';
    sortie.push(t);
  }

  // 6. le catalogue de l'instantané : les traits réellement portés
  const traits = {}; for (const t of sortie) for (const p of t.phenotypes) for (const id of p.traits) if (cat[id]) traits[id] = cat[id];
  const duree = opt.duree_ms ?? 86400000, d0 = Date.parse(inst.cycle.date);
  return {
    orvane: inst.orvane || '0.1', monde: inst.monde,
    cycle: { n, date: new Date(Number.isFinite(d0) ? d0 + duree : Date.now()).toISOString(), pressions_recues: pressions.nombre ?? 0 },
    biomes: Object.values(biomes), catalogue: { version: inst.catalogue?.version || '0.1', traits },
    taxons: sortie, evenements: ev
  };
}

const API = { cycle, REGLES, planDe, coutDe, croissance, mortalite, convenance, rng };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.Orvane = API;

// --- ligne de commande : node moteur/orvane.js <instantane.json> [--cycles N] [--lot pression.json --profil profil.json --comptes K] [--sortie fichier.json] ---
if (typeof require === 'function' && typeof module !== 'undefined' && require.main === module) {
  const fs = require('fs'), path = require('path'), a = process.argv.slice(2), arg = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  let inst = JSON.parse(fs.readFileSync(a[0], 'utf8'));
  const cycles = +(arg('--cycles') || 30), comptes = +(arg('--comptes') || 1);
  const lot = arg('--lot') && JSON.parse(fs.readFileSync(arg('--lot'), 'utf8')), profil = arg('--profil') && JSON.parse(fs.readFileSync(arg('--profil'), 'utf8'));
  const tampon = lot && require(path.join(__dirname, '..', 'tampon', 'tampon.js'));
  let etatTampon = {};
  const ligne = s => { const cols = [`c${String(s.cycle.n).padStart(3)}`]; for (const t of s.taxons) { if (t.eteint) { cols.push(`${t.id}: éteint`); continue; }
    cols.push(`${t.id} ${t.populations.map(p => `${p.biome.slice(0, 7)}=${p.effectif}`).join(' ')} | ${t.phenotypes.filter(p => p.frequence >= .005).map(p => `${p.id}:${(p.frequence * 100).toFixed(1)}%`).join(' ')}`); }
    return cols.join('  ·  '); };
  console.log(ligne(inst));
  for (let k = 0; k < cycles; k++) {
    let pressions = {};
    if (lot) { const lots = Array.from({ length: comptes }, (_, i) => ({ ...lot, instantane: inst.cycle.n, source: { ...lot.source, compte: `${lot.source.compte}#${i}` } }));
      const r = tampon.agreger(lots, inst, profil, etatTampon); pressions = r.pressions; etatTampon = r.etat; }
    inst = cycle(inst, pressions);
    console.log(ligne(inst)); for (const e of inst.evenements) console.log(`      ★ ${e.type} — ${e.taxon}${e.biome ? ' @' + e.biome : ''} : ${e.detail || ''}`);
  }
  if (arg('--sortie')) { fs.writeFileSync(arg('--sortie'), JSON.stringify(inst, null, 1)); console.log('→', arg('--sortie')); }
}
})(globalThis);
