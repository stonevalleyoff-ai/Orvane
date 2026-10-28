// Orvane — LE TAMPON (tampon/tampon.js) — v0
// Entre le moteur et un jeu, dans les deux sens, réglé par le profil du jeu (schemas/profil.schema.json).
//  - exposer(taxon, profil, cat, biome, ref) : Orvane → jeu. Les fréquences réelles des phénotypes deviennent les
//                                   fréquences que le jeu montre. Deux modes (profil.exposition.mode) :
//                                   « compression » (20 % → 2 %, traits non rendus fondus dans le phénotype de base) ;
//                                   « relatif » : les taux propres du jeu, multipliés par l'écart depuis la génération 0
//                                   (ref) — le jour un, rien ne change. (Le lissage entre deux instantanés est du côté du
//                                   traducteur : il interpole ce que lui renvoie exposer() sur propagation_cycles.)
//  - agreger(lots, inst, profil, etat) : jeu → Orvane. Des lots de pressions bruts (schemas/pression.schema.json)
//                                   deviennent les pressions du moteur :
//      1. rapporter l'activité d'un compte à une activité normale (exposition_ref rencontres par cycle) ;
//      2. dénormaliser : les prélèvements par phénotype sont redistribués selon les fréquences RÉELLES, à taux
//         par tête constant (une variante montrée à 2 % mais réelle à 20 % voit ses pertes ×10) ;
//      3. plafonner : par compte, part maximale d'un seul compte, part maximale d'une population ;
//      4. lisser sur memoire_cycles (moyenne mobile exponentielle, gardée dans « etat »).
//      Les traits continus (docs/8) : le z moyen des bêtes retirées (événements « q »), pondéré et lissé de même.
//  - quantDe(taxon, biomes, ref) : Orvane → jeu, la loi d'où tirer chaque bête pour les traits continus.
//  - sachantMere(e, dom, montre), exprimer(porte, cat) : l'hérédité côté jeu (docs/9), un petit qui ressemble à sa mère.
(function (racine) {
'use strict';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// facteur de compression d'un phénotype : le plus sévère de ses traits, sinon de leurs domaines, sinon le défaut
function compression(p, profil, cat) {
  const c = profil.exposition.compression, r = profil.exposition.traits_rendus;
  if (r && p.traits.some(id => !r.includes(id))) return 0;
  let k = c.defaut;
  for (const id of p.traits) { if (c.par_trait?.[id] != null) k = Math.min(k, c.par_trait[id]);
    else if (cat?.[id] && c.par_domaine?.[cat[id].domaine] != null) k = Math.min(k, c.par_domaine[cat[id].domaine]); }
  return k;
}
// Orvane → jeu : { [phenotype]: fréquence exposée }, somme 1, le premier phénotype (base) absorbe le reste.
// La compression porte sur la COTE (f / (1 − f)), pas sur la fréquence : une variante rare reste rare
// (20 % → 2,4 % avec k = 0,1), mais une variante devenue majoritaire le reste dans le jeu (99 % → 91 %).
function exposer(taxon, profil, cat, biome, ref) {
  if (profil.exposition.mode === 'relatif') return exposerRelatif(taxon, profil, ref);
  const e = {}; let reste = 1;
  const kb = biome && profil.exposition.compression.par_biome?.[biome];
  taxon.phenotypes.forEach((p, i) => { if (i === 0) return;
    const f = (biome && p.frequence_par_biome?.[biome]) ?? p.frequence, k = compression(p, profil, cat) * (kb ?? 1);
    const v = f >= 1 ? 1 : +(f * k / (f * k + 1 - f)).toFixed(5); e[p.id] = v; reste -= v; });
  if (reste < 0) { const s = 1 - reste; for (const k in e) e[k] = +(e[k] / s).toFixed(5); reste = 0; }   // plusieurs variantes majoritaires : on renormalise
  e[taxon.phenotypes[0].id] = +Math.max(0, reste).toFixed(5);
  return e;
}

// Orvane → jeu, mode « relatif » : le jeu garde ses taux d'avant Orvane (profil.exposition.taux_jeu, par trait rendu) et
// ne suit que l'ÉCART du monde depuis la génération 0 (ref : le même taxon à la génération 0, ou son plus proche ancêtre).
// Sur la cote : cote(jeu) = cote(taux du jeu) × cote(fréquence aujourd'hui) / cote(fréquence à la génération 0).
// Le jour un, le jeu est donc exactement ce qu'il était ; une variante deux fois plus répandue l'est deux fois plus
// dans le jeu ; une variante devenue majoritaire le devient aussi (de 1 % à 99 % : ×9801 sur la cote).
// Les phénotypes sont regroupés par leurs traits RENDUS (un nain aux crocs longs se montre nain) ; une combinaison
// absente de la génération 0 garde le taux du jeu, jusqu'à ce qu'Orvane l'installe au-delà de reference_min. Une clé
// « ~trait » est une variante tirée sans phénotype Orvane derrière (le jeu la connaissait, le monde ne l'a pas).
function signature(p, X) {
  const T = X.taux_jeu || {}, R = X.traits_rendus || Object.keys(T);
  return p.traits.filter(t => R.includes(t) && T[t] != null).sort().join('+');
}
// Les deux tirages du mode relatif : G, la chance de chaque signature RENDUE dans le jeu (les taux du jeu × l'écart depuis
// la génération 0) ; M, la part réelle de chaque ensemble de traits NON rendus (ce que le jeu peut faire agir, docs/7).
// Une bête qui naît tire l'un puis l'autre, indépendamment : sa robe rare reste rare, ses conduites ont leur fréquence réelle.
// phen : (signature|non rendus) → l'identifiant du phénotype Orvane qui porte exactement cette combinaison.
const nonRendus = (p, X) => { const T = X.taux_jeu || {}, R = X.traits_rendus || Object.keys(T); return p.traits.filter(t => !(R.includes(t) && T[t] != null)).sort().join('+'); };
function partsRelatif(taxon, profil, ref) {
  const X = profil.exposition, T = X.taux_jeu || {}, R = X.traits_rendus || Object.keys(T), fmin = X.reference_min ?? .01, cote = f => f / Math.max(1e-9, 1 - f);
  const now = {}, avant = {};
  taxon.phenotypes.forEach((p, i) => { const s = i ? signature(p, X) : ''; if (s) now[s] = (now[s] || 0) + p.frequence; });
  if (ref) ref.phenotypes.forEach((p, i) => { const s = i ? signature(p, X) : ''; if (s) avant[s] = (avant[s] || 0) + p.frequence; });
  // les signatures : celles que porte le monde, et chaque trait rendu seul (le jeu les tirait avant Orvane)
  const sigs = new Set([...Object.keys(now), ...Object.keys(T).filter(t => R.includes(t))]), G = { '': 1 };
  for (const s of sigs) {
    const r0 = s.split('+').reduce((a, t) => a * T[t], 1), fn = Math.min(.999999, now[s] || 0), fa = avant[s] || 0;
    // présente à la génération 0 : on suit son écart (éteinte dans Orvane, elle disparaît du jeu) ;
    // absente : le jeu garde son propre taux, jusqu'à ce qu'Orvane l'installe au-delà de reference_min
    const o = fa > 0 ? cote(r0) * cote(fn) / cote(fa) : cote(r0) * Math.max(1, cote(fn) / cote(fmin));
    G[s] = o / (1 + o); G[''] -= G[s];
  }
  if (G[''] < 0) { const z = 1 - G['']; for (const k in G) if (k) G[k] /= z; G[''] = 0; }
  const M = {}, phen = {};
  taxon.phenotypes.forEach((p, i) => { const s = i ? signature(p, X) : '', A = i ? nonRendus(p, X) : ''; M[A] = (M[A] || 0) + p.frequence; phen[s + '|' + A] = p.id; });
  return { G, M, phen };
}
function exposerRelatif(taxon, profil, ref) {
  const X = profil.exposition, { G, M, phen } = partsRelatif(taxon, profil, ref);
  if (X.non_rendus === 'base') {   // les traits non rendus fondus dans le plan de base : seule la signature compte
    const now = {}; taxon.phenotypes.forEach((p, i) => { const s = i ? signature(p, X) : ''; if (s) now[s] = (now[s] || 0) + p.frequence; });
    const e = {}; let reste = 1;
    taxon.phenotypes.forEach((p, i) => { if (!i) return; const s = signature(p, X), v = s && now[s] > 0 ? G[s] * p.frequence / now[s] : 0; e[p.id] = +v.toFixed(7); reste -= v; });
    for (const s in G) if (s && !(now[s] > 0) && G[s] > 0) { e['~' + s] = +G[s].toFixed(7); reste -= G[s]; }
    e[taxon.phenotypes[0].id] = +Math.max(0, reste).toFixed(7);
    return e;
  }
  // 'reel' : la chance de montrer EXACTEMENT ce phénotype = G(sa signature) × M(ses traits non rendus) ; « ~signature » :
  // une robe que le jeu tire sans phénotype Orvane derrière. Le total peut rester sous 1 : ce sont les combinaisons
  // (une robe × des conduites) qu'Orvane ne porte pas ; le jeu les montre quand même, et les rapporte au plus proche.
  const e = {};
  taxon.phenotypes.forEach((p, i) => { const s = i ? signature(p, X) : '', A = i ? nonRendus(p, X) : ''; e[p.id] = +((G[s] || 0) * (M[A] || 0)).toFixed(7); });
  for (const s in G) if (s && !phen[s + '|'] && G[s] > 0) e['~' + s] = +(G[s] * (M[''] || 0)).toFixed(7);
  return e;
}
// le taxon de référence d'un taxon à la génération 0 : lui-même, ou son plus proche ancêtre qui y était
function referenceDe(tid, inst, gen0) {
  if (!gen0) return null;
  const G = new Map(gen0.taxons.map(t => [t.id, t])), I = new Map(inst.taxons.map(t => [t.id, t])), vus = new Set();
  let id = tid; while (id && !vus.has(id)) { vus.add(id); if (G.has(id)) return G.get(id); id = (I.get(id) || G.get(id))?.parent || (id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : null); }
  return null;
}

// Orvane → jeu, les traits continus (docs/8) : sur les populations de ces biomes (toutes, si aucune n'y vit), pondérées
// par leur effectif, la loi d'où tirer chaque bête — moyenne m, variance v — et l'écart d de la moyenne depuis la
// génération 0 (ref : le même taxon à la génération 0 ; une lignée née depuis part de 0, son plan porte ce qu'elle avait
// acquis). Le jeu montre d + variation × (z − m) (profil.quantitatifs.variation) et rapporte z, la valeur tirée.
function quantDe(taxon, biomes, ref) {
  const dans = !biomes ? () => true : typeof biomes.has === 'function' ? b => biomes.has(b) : b => biomes.includes(b);   // un tableau ou un Set
  const melange = t => { if (!t) return null; let pops = t.populations.filter(p => p.quant && dans(p.biome));
    if (!pops.length) pops = t.populations.filter(p => p.quant); if (!pops.length) return null;
    const W = pops.reduce((a, p) => a + Math.max(1, p.effectif), 0), o = {};
    for (const k of Object.keys(pops[0].quant)) { let m = 0, m2 = 0;
      for (const p of pops) { const x = p.quant[k] || { m: 0, v: 1 }, w = Math.max(1, p.effectif) / W; m += w * x.m; m2 += w * (x.v + x.m * x.m); }
      o[k] = { m, v: Math.max(1e-4, m2 - m * m), g: pops.reduce((a, p) => a + Math.max(1, p.effectif) / W * (p.quant[k]?.g ?? .4), 0) }; }
    return o; };
  const Q = melange(taxon); if (!Q) return null;
  const Q0 = ref && ref.id === taxon.id ? melange(ref) : null;
  for (const k in Q) Q[k].d = Q[k].m - (Q0?.[k]?.m ?? 0);
  return Q;
}

// L'hérédité côté jeu (docs/9) : la part des petits d'une mère qui montrent un trait, sachant si elle le montre, le père
// tiré au hasard dans une population où la part e le montre (Hardy-Weinberg). Sur toutes les mères, on retrouve e : les
// taux d'ensemble ne bougent pas, seuls les petits ressemblent à leur mère.
function sachantMere(e, dom, montre) {
  e = clamp(e, 0, .999999); if (e <= 0) return 0;
  if (dom) { const p = 1 - Math.sqrt(1 - e); return montre ? 1 - (1 - p) * (1 - p) / (2 - p) : p; }
  const q = Math.sqrt(e); return montre ? q : q * q / (1 + q);
}
// ce qui se voit d'un jeu de traits portés : dans l'ordre du catalogue de l'instantané, un trait reste si ce qu'il exige
// est là et si rien de gardé ne l'exclut (l'albinisme efface les autres robes, un jet sans glande ne se voit pas)
function exprimer(porte, cat) {
  const ordre = Object.keys(cat || {}), rang = id => { const i = ordre.indexOf(id); return i < 0 ? 999 : i; }, garde = [];
  for (const id of [...porte].sort((a, b) => rang(a) - rang(b) || (a < b ? -1 : 1))) { const t = cat?.[id] || {};
    if ((t.exige || []).some(x => !garde.includes(x))) continue;
    if ((t.exclut || []).some(x => garde.includes(x)) || garde.some(x => (cat?.[x]?.exclut || []).includes(id))) continue;
    garde.push(id); }
  return garde.sort();
}

// jeu → Orvane (gen0 : la génération 0 du monde, pour le mode relatif)
function agreger(lots, inst, profil, etat = {}, gen0 = null) {
  const relatif = profil.exposition.mode === 'relatif';
  const I = profil.influence, poids = I.poids || {}, cat = inst.catalogue?.traits || {};
  const taxons = Object.fromEntries(inst.taxons.map(t => [t.id, t]));
  const parCompte = {};        // compte → taxon → biome → { retrait: {pheno|'*': n}, deplacement: [], rencontres }
  const Q = {};                // taxon → biome → trait → { s: Σ poids × z, w: Σ poids } : la valeur des bêtes retirées
  const biomes = {};           // biome → { habitat }
  let nombre = 0;
  for (const lot of lots) {
    if (lot.monde !== inst.monde.id) continue;
    const C = parCompte[lot.source.compte] ??= {};
    for (const e of lot.evenements) {
      nombre++;
      if (e.action === 'habitat_perdu' || e.action === 'habitat_gagne') { (biomes[e.biome] ??= { habitat: 0 }).habitat += e.n * (poids[e.action] ?? (e.action === 'habitat_perdu' ? 5 : -5)) * -1; continue; }
      if (!taxons[e.taxon]) continue;
      const T = (C[e.taxon] ??= {})[e.biome] ??= { retrait: {}, brut: {}, deplacement: [], rencontres: 0 };
      if (e.action === 'rencontre') { T.rencontres += e.n; continue; }
      if (e.action === 'deplacement') { T.deplacement.push({ vers: e.vers, n: e.n * (poids.deplacement ?? 1) }); continue; }
      const w = poids[e.action]; if (w == null || !w) continue;
      const k = e.phenotype || '*'; T.brut[k] = (T.brut[k] || 0) + e.n * w * (e.age === 'adulte' ? 1.2 : e.age === 'jeune' ? .8 : 1);
      if (w > 0 && e.q && typeof e.q === 'object') for (const [tr, z] of Object.entries(e.q)) if (Number.isFinite(z) && Math.abs(z) < 10) {
        const A = ((Q[e.taxon] ??= {})[e.biome] ??= {})[tr] ??= { s: 0, w: 0 }; A.s += e.n * w * z; A.w += e.n * w; }
    }
  }
  // par compte : activité, dénormalisation, plafond par compte
  for (const [compte, C] of Object.entries(parCompte)) for (const [tid, Bs] of Object.entries(C)) {
    const t = taxons[tid]; let totalCompte = 0;
    for (const [bid, T] of Object.entries(Bs)) {
      const act = I.exposition_ref && T.rencontres > I.exposition_ref ? I.exposition_ref / T.rencontres : 1;
      const brut = T.brut, parPheno = Object.keys(brut).filter(k => k !== '*');
      if (I.denormaliser !== false && parPheno.length) {
        const expo = relatif ? exposer(t, profil, cat, null, referenceDe(tid, inst, gen0)) : exposer(t, profil, cat, bid), total = parPheno.reduce((a, k) => a + brut[k], 0), L = I.pseudo_comptes ?? 20;
        const w = {}; let z = 0;                       // taux par tête observé (lissé par L prélèvements fictifs) × fréquence réelle
        for (const p of t.phenotypes) { const fr = (relatif ? null : p.frequence_par_biome?.[bid]) ?? p.frequence, ex = expo[p.id] || 0;
          const taux = ex > 0 ? ((brut[p.id] || 0) + L * ex) / (ex * (total + L)) : (brut[p.id] ? 1 : 0); w[p.id] = taux * fr; z += w[p.id]; }
        for (const p of t.phenotypes) if (z > 0 && w[p.id]) T.retrait[p.id] = total * w[p.id] / z * act;
      } else for (const k of parPheno) T.retrait[k] = brut[k] * act;
      if (brut['*']) T.retrait['*'] = brut['*'] * act;
      totalCompte += Object.values(T.retrait).reduce((a, x) => a + Math.max(0, x), 0);
    }
    const cap = I.plafonds.par_compte_cycle;
    if (cap != null && totalCompte > cap) for (const T of Object.values(Bs)) for (const k in T.retrait) if (T.retrait[k] > 0) T.retrait[k] *= cap / totalCompte;
  }
  // somme des comptes, avec la part maximale d'un seul compte
  const out = {};
  for (const tid of new Set(Object.values(parCompte).flatMap(C => Object.keys(C)))) {
    const contrib = Object.entries(parCompte).filter(([, C]) => C[tid]).map(([c, C]) => [c, Object.values(C[tid]).reduce((a, T) => a + Object.values(T.retrait).reduce((x, y) => x + Math.max(0, y), 0), 0)]);
    const total = contrib.reduce((a, [, v]) => a + v, 0), part = I.plafonds.part_max_compte, fact = {};
    for (const [c, v] of contrib) fact[c] = part != null && contrib.length > 1 && v > part * total ? part * total / v : 1;
    for (const [c, C] of Object.entries(parCompte)) if (C[tid]) for (const [bid, T] of Object.entries(C[tid])) {
      const O = (out[tid] ??= {})[bid] ??= { retrait: {}, deplacement: [] };
      for (const k in T.retrait) O.retrait[k] = (O.retrait[k] || 0) + T.retrait[k] * (T.retrait[k] > 0 ? fact[c] : 1);
      O.deplacement.push(...T.deplacement);
    }
  }
  // part maximale d'une population retirée en un cycle
  const pmax = I.plafonds.part_max_population;
  if (pmax != null) for (const [tid, Bs] of Object.entries(out)) for (const [bid, O] of Object.entries(Bs)) {
    const eff = taxons[tid].populations.find(p => p.biome === bid)?.effectif || 0;
    const s = Object.values(O.retrait).reduce((a, x) => a + Math.max(0, x), 0);
    if (s > pmax * eff) for (const k in O.retrait) if (O.retrait[k] > 0) O.retrait[k] *= pmax * eff / s;
  }
  // lissage : moyenne mobile exponentielle sur memoire_cycles
  const mem = I.memoire_cycles || 1, a = 2 / (mem + 1), prev = etat.lisse || {}, lisse = {};
  for (const tid of new Set([...Object.keys(out), ...Object.keys(prev)])) for (const bid of new Set([...Object.keys(out[tid] || {}), ...Object.keys(prev[tid] || {})])) {
    const cur = out[tid]?.[bid]?.retrait || {}, old = prev[tid]?.[bid] || {}, L = {}, vivants = new Set((taxons[tid]?.phenotypes || []).map(p => p.id));
    for (const k of new Set([...Object.keys(cur), ...Object.keys(old)])) {
      if (k !== '*' && !vivants.has(k)) continue;   // un phénotype disparu n'a plus de mémoire
      const v = (old[k] || 0) + ((cur[k] || 0) - (old[k] || 0)) * a; if (Math.abs(v) >= .01) L[k] = +v.toFixed(3);
    }
    if (Object.keys(L).length) { (lisse[tid] ??= {})[bid] = L; ((out[tid] ??= {})[bid] ??= { retrait: {}, deplacement: [] }).retrait = L; }
  }
  // les traits continus : la même moyenne mobile, sur la somme et sur les poids ; le moteur lit le z moyen des retirés
  const prevQ = etat.lisseQ || {}, lisseQ = {};
  for (const tid of new Set([...Object.keys(Q), ...Object.keys(prevQ)])) for (const bid of new Set([...Object.keys(Q[tid] || {}), ...Object.keys(prevQ[tid] || {})])) {
    const cur = Q[tid]?.[bid] || {}, old = prevQ[tid]?.[bid] || {}, L = {}, q = {};
    for (const tr of new Set([...Object.keys(cur), ...Object.keys(old)])) {
      const c = cur[tr] || { s: 0, w: 0 }, o = old[tr] || { s: 0, w: 0 }, s = o.s + (c.s - o.s) * a, w = o.w + (c.w - o.w) * a;
      if (w >= .01) { L[tr] = { s: +s.toFixed(4), w: +w.toFixed(4) }; q[tr] = +(s / w).toFixed(4); }
    }
    if (Object.keys(L).length) { (lisseQ[tid] ??= {})[bid] = L; if (out[tid]?.[bid]) out[tid][bid].q = q; }
  }
  return { pressions: { taxons: out, biomes, nombre }, etat: { lisse, lisseQ } };
}

const API = { exposer, exposerRelatif, partsRelatif, nonRendus, referenceDe, signature, quantDe, sachantMere, exprimer, agreger, compression };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.OrvaneTampon = API;
})(globalThis);
