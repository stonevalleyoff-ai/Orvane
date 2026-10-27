// Orvane — LE TAMPON (tampon/tampon.js) — v0
// Entre le moteur et un jeu, dans les deux sens, réglé par le profil du jeu (schemas/profil.schema.json).
//  - exposer(taxon, profil)       : Orvane → jeu. Les fréquences réelles des phénotypes deviennent les fréquences
//                                   que le jeu montre : compression (20 % → 2 %), traits non rendus fondus dans
//                                   le phénotype de base. (Le lissage entre deux instantanés est du côté du
//                                   traducteur : il interpole ce que lui renvoie exposer() sur propagation_cycles.)
//  - agreger(lots, inst, profil, etat) : jeu → Orvane. Des lots de pressions bruts (schemas/pression.schema.json)
//                                   deviennent les pressions du moteur :
//      1. rapporter l'activité d'un compte à une activité normale (exposition_ref rencontres par cycle) ;
//      2. dénormaliser : les prélèvements par phénotype sont redistribués selon les fréquences RÉELLES, à taux
//         par tête constant (une variante montrée à 2 % mais réelle à 20 % voit ses pertes ×10) ;
//      3. plafonner : par compte, part maximale d'un seul compte, part maximale d'une population ;
//      4. lisser sur memoire_cycles (moyenne mobile exponentielle, gardée dans « etat »).
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
function exposer(taxon, profil, cat, biome) {
  const e = {}; let reste = 1;
  const kb = biome && profil.exposition.compression.par_biome?.[biome];
  taxon.phenotypes.forEach((p, i) => { if (i === 0) return;
    const f = (biome && p.frequence_par_biome?.[biome]) ?? p.frequence, k = compression(p, profil, cat) * (kb ?? 1);
    const v = f >= 1 ? 1 : +(f * k / (f * k + 1 - f)).toFixed(5); e[p.id] = v; reste -= v; });
  if (reste < 0) { const s = 1 - reste; for (const k in e) e[k] = +(e[k] / s).toFixed(5); reste = 0; }   // plusieurs variantes majoritaires : on renormalise
  e[taxon.phenotypes[0].id] = +Math.max(0, reste).toFixed(5);
  return e;
}

// jeu → Orvane
function agreger(lots, inst, profil, etat = {}) {
  const I = profil.influence, poids = I.poids || {}, cat = inst.catalogue?.traits || {};
  const taxons = Object.fromEntries(inst.taxons.map(t => [t.id, t]));
  const parCompte = {};        // compte → taxon → biome → { retrait: {pheno|'*': n}, deplacement: [], rencontres }
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
    }
  }
  // par compte : activité, dénormalisation, plafond par compte
  for (const [compte, C] of Object.entries(parCompte)) for (const [tid, Bs] of Object.entries(C)) {
    const t = taxons[tid]; let totalCompte = 0;
    for (const [bid, T] of Object.entries(Bs)) {
      const act = I.exposition_ref && T.rencontres > I.exposition_ref ? I.exposition_ref / T.rencontres : 1;
      const brut = T.brut, parPheno = Object.keys(brut).filter(k => k !== '*');
      if (I.denormaliser !== false && parPheno.length) {
        const expo = exposer(t, profil, cat, bid), total = parPheno.reduce((a, k) => a + brut[k], 0), L = I.pseudo_comptes ?? 20;
        const w = {}; let z = 0;                       // taux par tête observé (lissé par L prélèvements fictifs) × fréquence réelle
        for (const p of t.phenotypes) { const fr = p.frequence_par_biome?.[bid] ?? p.frequence, ex = expo[p.id] || 0;
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
  return { pressions: { taxons: out, biomes, nombre }, etat: { lisse } };
}

const API = { exposer, agreger, compression };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.OrvaneTampon = API;
})(globalThis);
