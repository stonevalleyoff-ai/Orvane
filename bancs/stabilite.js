// Orvane — LES BANCS DE STABILITÉ (bancs/stabilite.js, docs/13)
// Ce que la phase 1 doit tenir avant d'aller plus loin, vérifié sur le moteur seul (sans jeu) :
//  1. mille cycles sans joueurs : des nombres sains, ni explosion ni effondrement, les espèces du départ tiennent ;
//  2. mille cycles où des joueurs chassent chaque soir : une saison de chasse se soutient, rien ne s'effondre, aucune
//     espèce ne s'éteint ; les chassées rapetissent et se méfient ; quand les joueurs partent, elles se remettent et oublient ;
//  3. un monde né de la genèse (lignées, hybrides, organes) : il garde sa diversité ;
//  4. le jour un : les ajouts de la phase 1 démarrent neutres (un cycle avec ou sans eux donne presque le même monde) ;
//  5. la réponse à la sélection : une chasse des plus grands déplace la taille moyenne de h² × S (équation du sélectionneur) ;
//  6. le déterminisme : même état, mêmes pressions, même monde, au caractère près.
//   node bancs/stabilite.js [--cycles 1000] [--monde sv-1] [--genese genese-7] [--cycles-genese 300] [--court] [--sortie rapport.json]
// --court : 200 cycles (100 pour le monde de genèse), une vérification rapide. Sortie : 0 si tout passe, 1 sinon.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const racine = p => path.join(__dirname, '..', p);
const Orvane = require(racine('moteur/orvane.js')), Tampon = require(racine('tampon/tampon.js')), CAT = require(racine('moteur/catalogue.js'));
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf(k); return i >= 0 && a[i + 1] != null ? a[i + 1] : d; }, court = a.includes('--court');
const CYCLES = court ? 200 : +arg('--cycles', 1000), CG = court ? 100 : +arg('--cycles-genese', 300);
const MONDE = arg('--monde', 'sv-1'), GENESE = arg('--genese', 'genese-7'), SORTIE = arg('--sortie', null);
const lire = id => JSON.parse(fs.readFileSync(racine(`mondes/${id}/${'instantane.json'}`), 'utf8'));
const lireP = id => JSON.parse(fs.readFileSync(racine(`mondes/${id}/profil.json`), 'utf8'));

let ok = true; const rapport = { cycles: CYCLES, verifications: [], series: {} };
const verif = (c, m) => { ok = ok && !!c; rapport.verifications.push({ ok: !!c, m }); console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const pct = x => (x * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %';
const fx = (x, d = 2) => (+x).toLocaleString('fr-FR', { maximumFractionDigits: d });
const vivants = I => I.taxons.filter(t => !t.eteint);
const total = t => t.populations.reduce((s, p) => s + p.effectif, 0);
const totalMonde = I => vivants(I).reduce((s, t) => s + total(t), 0);
const empreinte = I => crypto.createHash('sha256').update(JSON.stringify(I)).digest('hex').slice(0, 16);

// --- des nombres sains : rien d'infini, de négatif ou hors de ses bornes ---
function sain(I) {
  const P = [], fini = (v, q) => { if (!Number.isFinite(v)) P.push(q + ' n\'est pas un nombre'); return Number.isFinite(v); };
  for (const t of I.taxons) {
    if (t.phenotypes.length > Orvane.REGLES.max_phenotypes + 1) P.push(`${t.id} : ${t.phenotypes.length} phénotypes`);
    if (t.plan.corps?.organes?.length > 16) P.push(`${t.id} : ${t.plan.corps.organes.length} organes`);
    if (t.eteint) continue;
    const s = t.phenotypes.reduce((x, p) => x + p.frequence, 0); if (fini(s, t.id + ' fréquences') && Math.abs(s - 1) > .01) P.push(`${t.id} : les fréquences font ${fx(s, 4)}`);
    for (const p of t.populations) { const q = `${t.id}@${p.biome}`;
      if (fini(p.effectif, q) && p.effectif < 0) P.push(q + ' : effectif négatif');
      for (const [k, v] of Object.entries(p.alleles || {})) if (!(v >= 0 && v <= 1)) P.push(`${q} : allèle ${k} = ${v}`);
      for (const [k, x] of Object.entries(p.quant || {})) { if (!(Math.abs(x.m) <= 8)) P.push(`${q} : ${k} m = ${x.m}`); if (!(x.g > 0 && x.g <= 4)) P.push(`${q} : ${k} g = ${x.g}`); }
      for (const k of ['flux', 'mefiance', 'habituation']) if (p[k] != null && !(p[k] >= 0 && p[k] <= 1)) P.push(`${q} : ${k} = ${p[k]}`);
      if (p.divergence != null) fini(p.divergence, q + ' divergence'); }
  }
  for (const b of I.biomes) if (!(b.capacite > 0)) P.push(`${b.id} : capacité ${b.capacite}`);
  return P;
}
// --- une course : n cycles, des pressions données par cycle ; ce qu'on en garde ---
function courir(I, n, pressionsDe = () => ({}), suivre = null) {
  const ev = {}, pb = new Set(), T0 = Object.fromEntries(vivants(I).map(t => [t.id, total(t)])), suivi = {}, monde = [];
  let pire = null; const t0 = Date.now();
  for (let k = 1; k <= n; k++) {
    I = Orvane.cycle(I, pressionsDe(I, k));
    for (const e of I.evenements) ev[e.type] = (ev[e.type] || 0) + 1;
    if (k % 10 === 0 || k === n) { for (const p of sain(I)) pb.add(p); monde.push(Math.round(totalMonde(I)));
      for (const t of vivants(I)) { const s = suivi[t.id] ??= { min: Infinity, max: 0 }, v = total(t); s.min = Math.min(s.min, v); s.max = Math.max(s.max, v); } }
    if (suivre) suivre(I, k);
  }
  return { I, ev, problemes: [...pb], T0, suivi, monde, ms: (Date.now() - t0) / n };
}
const especes = (I, T0) => Object.keys(T0).filter(id => T0[id] >= 50);
const tient = (R, id) => { const t = R.I.taxons.find(x => x.id === id); return t && !t.eteint ? total(t) : 0; };

// --- des joueurs : chaque soir, dix comptes passent, chassent les brouteurs, glaneurs, crapauds et bosseus (les plus
// grands d'abord : les bêtes prises ont un écart-type de taille de plus que leur population), en capturent un parfois, et croisent sans rien faire d'autres bêtes. Comme dans un jeu, ils croisent
// d'autant moins de bêtes qu'il y en a moins (l'île suit la population), et en prennent d'autant moins qu'elles fuient
// de loin (la méfiance, docs/12 : × 2,2^méfiance × 0,5^habituation sur la distance de fuite). La chasse est soutenable :
// à eux dix, ils prennent chaque soir 0,6 % de la population de départ (0,3 % pour le bosseu, qui se reproduit à peine
// plus qu'il ne meurt). Au-delà de ce qu'une espèce renouvelle (sa croissance moins sa mortalité, moins la place que lui
// laissent les autres), une chasse acharnée finit par l'éteindre : c'est voulu, et le tampon fait que cela prend des
// dizaines de cycles, pas un soir.
// Sur un autre monde que sv-1, les quatre plus grandes populations d'herbivores et d'omnivores sont chassées, les trois
// suivantes croisées.
let CHASSE = [['brouteur', 'prairie', 40, .006], ['glaneur', 'prairie', 50, .006], ['crapaud', 'tourbiere', 20, .006], ['bosseu', 'prairie', 20, .003]];
let PASSANTS = [['trottin_huppe', 'prairie', 30], ['lentigrade', 'prairie', 15], ['carillonneur', 'lande', 15]];
function choisir(I) {
  if ([...CHASSE, ...PASSANTS].every(([t, b]) => pop(I, t, b))) return;
  const L = vivants(I).filter(t => t.plan.regime === 'herbivore' || t.plan.regime === 'omnivore').map(t => [t.id, t.populations.slice().sort((a, b) => b.effectif - a.effectif)[0]])
    .filter(([, p]) => p?.quant).sort((a, b) => b[1].effectif - a[1].effectif);
  CHASSE = L.slice(0, 4).map(([t, p]) => [t, p.biome, 30, .005]); PASSANTS = L.slice(4, 7).map(([t, p]) => [t, p.biome, 20]);
}
let N0 = null;
function lots(I, k) {
  N0 ??= Object.fromEntries([...CHASSE, ...PASSANTS].map(([t, b]) => [t + '@' + b, pop(I, t, b)?.effectif || 1]));
  const ici = (t, b) => { const p = pop(I, t, b); if (!p) return [0, 1]; return [Math.min(1.5, p.effectif / N0[t + '@' + b]), 2.2 ** (p.mefiance || 0) * .5 ** (p.habituation || 0)]; };
  return Array.from({ length: 10 }, (_, c) => ({ monde: I.monde.id, source: { jeu: 'banc', compte: 'joueur-' + c }, evenements: [
    ...CHASSE.flatMap(([id, biome, r, taux]) => { const [rho, f] = ici(id, biome), n = taux * N0[id + '@' + biome] / 10, taxon = tenant(I, id, biome)?.t.id || id;
      return rho ? [{ taxon, biome, action: 'rencontre', n: r * rho }, { taxon, biome, action: 'prelevement', n: n * rho / f, q: { taille: mTaille(I, id, biome) + 1 } },
      ...((c + k) % 4 === 0 ? [{ taxon, biome, action: 'capture', n: n * rho / f / 4 }] : [])] : []; }),
    ...PASSANTS.map(([id, biome, r]) => ({ taxon: tenant(I, id, biome)?.t.id || id, biome, action: 'rencontre', n: r * ici(id, biome)[0] }))] }));
}
// la population d'un taxon dans un biome — ou, s'il l'a perdue, celle de sa lignée fille la plus nombreuse dans ce biome :
// une population chassée longtemps peut diverger au point de devenir une lignée, et les joueurs chassent alors celle-ci
const tenant = (I, id, bid) => { let best = null;
  for (const t of I.taxons) if (!t.eteint && (t.id === id || t.id.startsWith(id + '.'))) { const p = t.populations.find(q => q.biome === bid);
    if (p && (!best || (t.id === id ? Infinity : p.effectif) > (best.t.id === id ? Infinity : best.p.effectif))) best = { t, p }; }
  return best; };
const pop = (I, id, bid) => tenant(I, id, bid)?.p;
const mTaille = (I, id, bid) => pop(I, id, bid)?.quant?.taille?.m ?? 0;

(async () => {
  const I0 = lire(MONDE), profil = lireP(MONDE); choisir(I0);
  console.log(`Orvane — bancs de stabilité (${CYCLES} cycles, monde ${MONDE} : ${vivants(I0).length} espèces, ${I0.biomes.length} biomes)`);

  // === 1. sans joueurs ===
  console.log(`\n1. ${CYCLES} cycles sans joueurs`);
  const PAS = CYCLES < 50 ? 1 : 10, suiviCh = {}, noter = (I, k) => { if (k % PAS) return; for (const [id, b] of CHASSE) (suiviCh[id + '@' + b] ??= []).push(pop(I, id, b)?.effectif || 0); };
  const A = courir(I0, CYCLES, () => ({}), (I, k) => noter(I, k)), SA = JSON.parse(JSON.stringify(suiviCh)); for (const k in suiviCh) delete suiviCh[k];
  rapport.series.sansJoueurs = A.monde;
  verif(!A.problemes.length, `des nombres sains à chaque relevé${A.problemes.length ? ' — ' + A.problemes.slice(0, 4).join(' ; ') : ''} (${fx(A.ms, 0)} ms par cycle)`);
  const E0 = especes(I0, A.T0), eteintes = E0.filter(id => !tient(A, id));
  verif(!eteintes.length, `les ${E0.length} espèces du départ (50 bêtes et plus) sont toutes là après ${CYCLES} cycles${eteintes.length ? ' — éteintes : ' + eteintes.join(', ') : ''}`);
  const rap = id => A.suivi[id] ? [A.suivi[id].min / A.T0[id], A.suivi[id].max / A.T0[id]] : [0, 0];
  const explo = E0.filter(id => rap(id)[1] > 10), effo = E0.filter(id => rap(id)[0] < .1);
  const Mn = Math.min(...A.monde) / totalMonde(I0), Mx = Math.max(...A.monde) / totalMonde(I0);
  verif(!explo.length && !effo.length && Mn > .5 && Mx < 2, `ni explosion ni effondrement : chaque espèce reste entre le dixième et dix fois son effectif de départ ; le monde entre ${fx(Mn)} et ${fx(Mx)} fois le sien${explo.length + effo.length ? ' — ' + [...explo, ...effo].join(', ') : ''}`);
  const tard = A.monde.slice(-Math.floor(A.monde.length / 2)), moy = tard.reduce((s, x) => s + x, 0) / tard.length;
  const pente = (tard[tard.length - 1] - tard[0]) / moy;
  verif(Math.abs(pente) < .3, `pas de dérive : sur la seconde moitié, le monde varie de ${pct(pente)} (moins de 30 %)`);
  const bruts = (A.ev.explosion || 0) + (A.ev.effondrement || 0);
  verif(bruts <= CYCLES / 10, `${bruts} sursauts brusques (explosion ou effondrement d'une population en un cycle) pour ${A.ev.catastrophe || 0} catastrophes et ${A.ev.epidemie || 0} épidémies`);
  const sansMef = vivants(A.I).every(t => t.populations.every(p => !p.mefiance && !p.habituation));
  verif(sansMef, 'sans joueurs, aucune population n\'apprend ni méfiance ni habituation');

  // === 2. avec des joueurs ===
  console.log(`\n2. ${CYCLES} cycles de chasse, dix joueurs chaque soir, puis 60 cycles sans eux`);
  let et = {}; const pressions = (I, k) => { const r = Tampon.agreger(lots(I, k), I, profil, et); et = r.etat; return r.pressions; };
  const B = courir(I0, CYCLES, pressions, (I, k) => noter(I, k)), SB = suiviCh;
  verif(!B.problemes.length, `des nombres sains à chaque relevé${B.problemes.length ? ' — ' + B.problemes.slice(0, 4).join(' ; ') : ''} (${fx(B.ms, 0)} ms par cycle, tampon compris)`);
  // ce que deviennent les populations chassées : rapportées à ce qu'elles sont, au même cycle, dans le monde sans joueurs
  const chassees = CHASSE.map(c => c[0]), cle = ([id, b]) => id + '@' + b, a300 = Math.min(300 / PAS - 1, SA[cle(CHASSE[0])].length - 1);
  const rapA = (c, i) => SB[cle(c)][i] / Math.max(1, SA[cle(c)][i]), fin = SA[cle(CHASSE[0])].length - 1;
  verif(CHASSE.every(c => rapA(c, a300) > .25), `une saison de chasse se soutient : après ${(a300 + 1) * PAS} cycles, ${CHASSE.map(c => `${c[0]} de ${c[1]} à ${pct(rapA(c, a300))}`).join(', ')} de ce qu'ils sont sans joueurs`);
  const chute = c => { let pire = 0; const S = SB[cle(c)]; for (let i = 5; i < S.length; i++) if (S[i - 5] >= 50) pire = Math.max(pire, 1 - S[i] / S[i - 5]); return pire; };
  const filles = CHASSE.map(([id, b]) => tenant(B.I, id, b)?.t.id).filter(x => x && !CHASSE.some(c => c[0] === x));
  verif(CHASSE.every(c => chute(c) < .4), `jamais d'effondrement : au pire, une population chassée perd ${pct(Math.max(...CHASSE.map(chute)))} en ${5 * PAS} cycles ; au bout de ${CYCLES} cycles, ${CHASSE.map(c => `${c[0]} ${pct(rapA(c, fin))}`).join(', ')}${filles.length ? ` (${filles.join(', ')} : devenue${filles.length > 1 ? 's' : ''} une lignée à force d'être chassée${filles.length > 1 ? 's' : ''})` : ''}`);
  const E0b = especes(I0, B.T0), perdues = E0b.filter(id => !tient(B, id) && !B.I.taxons.some(t => !t.eteint && t.id.startsWith(id + '.')));
  verif(!perdues.length, `aucune espèce ne s'éteint (${E0b.length}, chassées comprises)${perdues.length ? ' — éteintes : ' + perdues.join(', ') : ''}`);
  const [c0, b0] = CHASSE[0], [p0, q0] = PASSANTS[0], dm = mTaille(B.I, c0, b0) - mTaille(A.I, c0, b0), mef = pop(B.I, c0, b0)?.mefiance || 0, hab = pop(B.I, p0, q0)?.habituation || 0;
  verif(dm < -.1 && mef > .2 && mef < 1 && hab > .3, `${c0} (${b0}), chassé parmi les plus grands : ${fx(dm)} σ de taille, ${pct(mef)} de méfiance ; ${p0} (${q0}), croisé sans suite : ${pct(hab)} d'habituation`);
  // les joueurs partent : soixante cycles de plus, à côté de soixante cycles du monde qui n'en a jamais eu (mêmes saisons)
  const C = courir(B.I, 60), A2 = courir(A.I, 60), partDe = (X, Y) => CHASSE.reduce((s, [id, b]) => s + (pop(X, id, b)?.effectif || 0) / Math.max(1, pop(Y, id, b)?.effectif || 0), 0) / CHASSE.length;
  const mefMax = I => Math.max(...vivants(I).flatMap(t => t.populations.map(p => p.mefiance || 0))), g0 = partDe(B.I, A.I), g1 = partDe(C.I, A2.I);
  verif(mefMax(B.I) > .2 && mefMax(C.I) < .05 && g1 > g0, `les joueurs partis, la méfiance retombe (de ${pct(mefMax(B.I))} à ${pct(mefMax(C.I))} en soixante cycles) et les populations chassées se remettent : en moyenne, de ${pct(g0)} à ${pct(g1)} de ce qu'elles seraient sans joueurs`);
  rapport.series.avecJoueurs = B.monde;

  // === 3. un monde né de la genèse ===
  if (GENESE && fs.existsSync(racine(`mondes/${GENESE}/instantane.json`))) {
    const G0 = lire(GENESE); console.log(`\n3. ${CG} cycles du monde ${GENESE} (${vivants(G0).length} lignées)`);
    const G = courir(G0, CG), n0 = vivants(G0).length, n1 = vivants(G.I).length, org = vivants(G.I).filter(t => t.plan.corps?.organes?.length).length;
    verif(!G.problemes.length, `des nombres sains${G.problemes.length ? ' — ' + G.problemes.slice(0, 4).join(' ; ') : ''} (${fx(G.ms, 0)} ms par cycle)`);
    const Mg = G.monde.map(x => x / totalMonde(G0));
    verif(n1 >= n0 * .6 && n1 <= Math.max(n0 * 1.5, Orvane.REGLES.max_taxons) && Math.min(...Mg) > .5 && Math.max(...Mg) < 2,
      `la diversité tient : ${n0} → ${n1} lignées vivantes (${G.ev.separation || 0} séparations, ${G.ev.extinction || 0} extinctions de populations, ${G.ev.hybridation || 0} zones hybrides) ; le monde entre ${fx(Math.min(...Mg))} et ${fx(Math.max(...Mg))} fois son effectif`);
    verif(org > 0, `${org} lignées portent des organes`);
    const sG = (G.ev.explosion || 0) + (G.ev.effondrement || 0), nP = vivants(G.I).reduce((s, t) => s + t.populations.length, 0);
    verif(sG <= CG, `${sG} sursauts brusques en ${CG} cycles pour ${nP} populations (moins d'un par cycle), ${G.ev.epidemie || 0} épidémies`);
    rapport.series.genese = G.monde;
  }

  // === 4. le jour un : les ajouts démarrent neutres ===
  console.log('\n4. le jour un');
  const OFF = { genetique: false, sexe: false, hybride: false, mefiance: false }, Ia = Orvane.cycle(I0, {}), Ib = Orvane.cycle(I0, {}, OFF);
  let ecart = 0, ou = '';                                              // (une bête d'écart sur une population de 17 n'en est pas un : l'arrondi)
  for (const t of vivants(Ia)) for (const p of t.populations) { const q = Ib.taxons.find(x => x.id === t.id)?.populations.find(x => x.biome === p.biome);
    const d = Math.abs(p.effectif - (q?.effectif ?? 0)), e = d <= 1 ? 0 : d / Math.max(1, p.effectif); if (e > ecart) { ecart = e; ou = ` (${t.id} de ${p.biome})`; } }
  verif(ecart < .02, `un cycle avec ou sans les ajouts de la phase 1 (génétique continue, allèles, hybrides, méfiance) : au plus ${pct(ecart)} d'écart sur une population${ou}`);
  const NC = Math.min(100, CYCLES), cent = o => { let I = I0; for (let k = 0; k < NC; k++) I = Orvane.cycle(I, {}, o); return totalMonde(I); }, Wa = cent({}), Wb = cent(OFF);
  verif(Math.abs(Wa / Wb - 1) < .25, `${NC} cycles plus tard, le monde avec les ajouts fait ${fx(Wa / Wb)} fois le monde sans eux`);

  // === 5. la réponse à la sélection : R = h² S ===
  console.log('\n5. la réponse à la sélection (R = h² S)');
  // deux mondes jumeaux : dans l'un, les joueurs prennent chaque cycle 3 % d'une population (les brouteurs de prairie) parmi les plus grands
  // (le dixième du haut : z = m + 1,755 σ), dans l'autre autant au hasard (z = m) ; même nombre de morts, même densité
  const T = 30, part = .03; let Is = I0, Ic = I0, Ratt = 0, Sc = 0;
  for (let k = 0; k < T; k++) {
    const ps = pop(Is, c0, b0), pc = pop(Ic, c0, b0), x = ps.quant.taille, zr = x.m + 1.755 * Math.sqrt(x.v), n = Math.round(ps.effectif * part);
    const P = z => ({ taxons: { [c0]: { [b0]: { retrait: { '*': n }, deplacement: [], q: { taille: z } } } } });
    Is = Orvane.cycle(Is, P(zr)); Ic = Orvane.cycle(Ic, P(pc.quant.taille.m));
    const e = pop(Is, c0, b0).effectif, S = -(zr - x.m) * n / Math.max(1, ps.effectif - n);   // le différentiel de sélection sur les survivants
    Ratt += (x.g / x.v) * S * (ps.effectif - n) / Math.max(1, e); Sc += S;                                 // h² S, pour la part de la population qui a survécu
  }
  const Robs = mTaille(Is, c0, b0) - mTaille(Ic, c0, b0), h2 = pop(I0, c0, b0).quant.taille;
  verif(Math.abs(Robs / Ratt - 1) < .15, `${T} cycles, 3 % de la population ${c0} (${b0}) pris parmi les plus grands : S cumulé ${fx(Sc, 3)} σ, h² ${fx(h2.g / h2.v, 2)} ; réponse attendue ${fx(Ratt, 3)} σ, observée ${fx(Robs, 3)} σ (${pct(Robs / Ratt - 1)} d'écart)`);
  const dRel = Math.exp((CAT.QUANT.taille.echelle || .05) * Robs) - 1;
  verif(dRel < -.005, `en longueur, ${c0} (${b0}) y perd ${pct(-dRel)} (le critère de sortie de la phase 1 : une chasse des grands se mesure)`);

  // === 6. le déterminisme ===
  console.log('\n6. le déterminisme');
  const ND = Math.min(40, CYCLES), D = () => { let e2 = {}, I = I0; for (let k = 1; k <= ND; k++) { const r = Tampon.agreger(lots(I, k), I, profil, e2); e2 = r.etat; I = Orvane.cycle(I, r.pressions); } return empreinte(I); };
  const d1 = D(), d2 = D();
  verif(d1 === d2, `deux fois ${ND} cycles de chasse depuis le même état : le même monde (${d1})`);

  if (SORTIE) fs.writeFileSync(SORTIE, JSON.stringify({ ...rapport, ok }, null, 1));
  console.log(ok ? '\nTOUT PASSE' : '\nÉCHECS'); process.exit(ok ? 0 : 1);
})();
