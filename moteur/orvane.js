// Orvane — LE MOTEUR (moteur/orvane.js) — v0
// Un cycle : instantané + pressions (déjà passées au tampon) → instantané suivant. Déterministe : même graine,
// même état, mêmes pressions ⇒ même résultat. Node (require) ou navigateur (globalThis.Orvane). Zéro dépendance.
//
// CE QUE V0 SIMULE, par taxon × biome :
//  - une croissance logistique : les naissances baissent à mesure que la biomasse du biome approche sa capacité ;
//    les espèces se gênent d'autant plus qu'elles ont la même taille (partage des ressources) ; les carnivores ne
//    pèsent pas sur la capacité : ils vivent des proies ;
//  - la chaîne alimentaire : un prédateur mange ce qui est à sa portée (masse, vitesse, vol, groupe, heure), partage les
//    proies avec ses concurrents, et sa satiété décide de ses naissances, de sa faim et de ses départs ; chez la proie,
//    la vulnérabilité de chaque phénotype (carapace, camouflage, pattes longues…) décide qui est mangé : c'est la sélection ;
//  - une mortalité naturelle tirée de la longévité ; une pénalité hors de la niche (axes du biome éloignés) ;
//  - des phénotypes : chaque combinaison de traits a son propre plan corporel (écarts) et son propre coût de
//    reproduction. Un trait ne « sert » à rien par lui-même : il pèse par son coût et ses écarts (une portée
//    plus grande, une maturité plus tardive…). Ce sont les pressions extérieures qui lui donnent sa valeur ;
//  - la mutation (un peu de chaque naissance change de phénotype), l'apparition de nouveaux traits admissibles ;
//  - la migration vers les biomes voisins en cas de surpeuplement, les déplacements imposés ;
//  - la séparation d'une lignée installée depuis longtemps dans un biome éloigné de sa niche ;
//    sa silhouette (plan.corps, voir moteur/corps.js) dérive avec elle : c'est ce qui la distingue à l'œil ;
//  - l'habitat : la capacité d'un biome encaisse les pertes et regagne lentement sa valeur de base.
//  - les saisons, si le monde a une année (monde.annee, en cycles) : les axes des biomes et leur production oscillent
//    (hiver froid, sombre, pauvre ; été chaud, lumineux, riche), ce qui déplace la convenance et la place ;
//  - les maladies : une population entassée peut voir éclore une épidémie (durée et virulence tirées), qui frappe selon la
//    résistance de chaque phénotype et peut gagner les voisins ; elle s'éteint d'elle-même ;
//  - le report : la demande de chasse qu'un phénotype épuisé ne peut servir se reporte sur les autres de la population.
//  - la génétique continue (docs/8) : par population, une moyenne et une variance de la taille, de la vitesse, de l'audace
//    et de la sociabilité ; la prédation, les joueurs, les naissances et l'optimum du biome les déplacent (Lande), la
//    mutation et la dérive les entretiennent, les migrations les mêlent ; une lignée qui se sépare garde ce qu'elle a acquis.
//  - la reproduction sexuée (docs/9) : par population, la fréquence de chaque allèle de trait ; chaque petit reçoit un
//    allèle de sa mère et un de son père (dominant : une copie montre le trait ; récessif : il en faut deux) ; les pères
//    sont choisis (attrait : une robe voyante, une grande taille) ; ce qui se voit suit l'ordre du catalogue (épistasie).
//  - l'isolement et les hybrides (docs/10) : chaque population mesure le flux de gènes qu'elle reçoit et son écart génétique
//    au reste de l'espèce ; une population isolée qui a divergé se sépare plus volontiers ; deux lignées apparentées qui
//    partagent un biome se croisent d'autant plus qu'elles sont peu isolées (le temps, la masse, le corps, la niche) :
//    leurs hybrides, moins viables, mêlent les gènes des deux (une zone hybride).
//  - la méfiance et l'habituation (docs/12) : ce qu'une population apprend des joueurs. Des rencontres qui finissent mal
//    la rendent méfiante, des rencontres sans suite l'habituent ; l'une et l'autre retombent avec le temps (demi-vies), et
//    une population audacieuse s'habitue plus vite, se méfie moins. Le moteur ne fait que tenir cette mémoire : c'est le
//    jeu qui la rend, en distance de fuite.
//
// FORMAT DES PRESSIONS, en plus : taxons[t][b].q = { [trait continu]: z moyen des bêtes retirées par les joueurs } ;
// taxons[t][b].contact = { rencontres, danger, aide } : ce que les bêtes ont vécu des joueurs (tampon, docs/12).
//
// FORMAT DES PRESSIONS reçues (sortie du tampon) :
//  { taxons: { [taxon]: { [biome]: { retrait: { [phenotype|'*']: n }, deplacement: [{ vers, n }] } } },
//    biomes: { [biome]: { habitat: ±n } } }
//  retrait > 0 : individus retirés (chasse, capture) ; < 0 : individus rendus ou aidés (libération, nourrissage).
(function (racine) {
'use strict';
const CAT = typeof require === 'function' ? require('./catalogue.js') : racine.OrvaneCatalogue;
const CORPS = typeof require === 'function' ? require('./corps.js') : racine.OrvaneCorps;   // la silhouette (moteur/corps.js)
const AXES = ['temperature', 'humidite', 'altitude', 'lumiere', 'couvert'];
const REGLES = {
  mutation: .004,            // part des naissances qui changent de phénotype (vers un phénotype existant)
  nouveau_trait: .03,        // chance, par taxon et par cycle, qu'un trait admissible apparaisse
  migration: .02,            // part de la population qui part vers ses voisins (à proportion de ce qu'ils lui conviennent) quand le biome est saturé
  seuil_surpeuple: .85,      // saturation (biomasse / capacité) au-delà de laquelle on migre
  separation: { cycles: 30, effectif: 60, distance: 1.2, chance: .004, flux: .05, divergence: .3 },   // installée depuis 30 cycles, hors de sa niche (distance ≥ 1,2 × tolérance) : ~4 chances sur 1000 par cycle ;
                             // ou, où qu'elle soit, assez divergente du reste de l'espèce (divergence) ; un flux de gènes reçu de flux par cycle l'en empêche
  memoire_eteint: 10,        // un taxon éteint reste listé autant de cycles
  regain_habitat: .02,       // part de l'écart à la capacité de base regagné par cycle
  effondrement: -.25, explosion: .4,   // tendances qui font un événement
  menace: 50,                // effectif total sous lequel un taxon est « menacé »
  max_phenotypes: 20,        // au-delà, les phénotypes les plus rares sont fondus dans le plan de base (leurs allèles restent : docs/9)
  max_taxons: Infinity,      // au-delà, plus de séparation de lignées (la genèse s'en sert pour borner le monde)
  // la chaîne alimentaire
  besoin: .35,               // kg de proies par cycle et par kg^0.75 de prédateur (un prédateur de 25 kg : ~3,4 kg par cycle ; le cycle
                             // est une tranche de vie, pas une journée : une bête vit 30 à 60 cycles)
  conversion: .25,           // part de la viande mangée qui devient des petits : l'énergie vient des plantes, chaque maillon en perd 85 %
  demi_satiete: 30,          // à autant de fois son besoin disponible par tête, un prédateur est rassasié à moitié
  predation_max: .3,         // part d'une population de proies qu'un cycle de prédation peut retirer
  chasse_omnivore: .4,       // un omnivore chasse moins bien qu'un carnivore
  omnivore_vegetal: .4,      // un carnivore devenu omnivore (estomac-large) tire des plantes moins qu'un herbivore : 40 %
  faim_migration: .4,        // satiété sous laquelle un prédateur s'en va chercher ailleurs
  report_proies: 1.5,        // exposant du report sur la proie abondante (1 : au prorata ; 2 : fort)
  // les saisons (si le monde a une année) : amplitudes par défaut d'un biome, sur les axes et sur la production
  saisons: { temperature: .15, lumiere: .1, humidite: .08, capacite: .25 },
  // les maladies : chance d'éclosion par population et par cycle, multipliée par le surpeuplement ; durée et virulence tirées
  maladie: { chance: .003, duree: [8, 25], virulence: [.03, .12], contagion: .15 },
  // les catastrophes : chance par biome et par cycle (modulée par le sol et la saison), part de capacité perdue, mortalité
  catastrophes: {
    incendie:   { chance: .003, capacite: .4, mortalite: .2,  detail: 'le feu court dans le couvert' },      // couvert dense et sec, surtout l'été
    crue:       { chance: .0015, capacite: .2, mortalite: .1,  detail: 'les eaux montent' },                   // sols humides et bas, surtout au printemps
    secheresse: { chance: .002, capacite: .3, mortalite: .05, detail: 'les points d\'eau tarissent' }        // sols secs, en été
  },
  // la dérive d'une lignée qui se sépare : bornes de masse (×), chances de changer de régime, de locomotion, d'heure
  derive: { masse: [.7, 1.3], regime: 0, locomotion: .1, activite: .05, corps: 1 },   // corps : l'ampleur de la dérive de la silhouette
  vol_masse_max: 12,         // au-delà (kg), une lignée ne vole plus : elle perd le vol (et ses ailes) en grandissant
  genetique: true,           // la génétique continue (docs/8) ; false : les populations n'ont pas de traits continus
  // la reproduction sexuée (docs/9) ; actif false : les petits naissent du phénotype de leur parent (clonal, avec REGLES.mutation)
  // l'isolement reproductif entre deux lignées apparentées : 1 − e^−(temps/tau + masse·|ln m1/m2| + corps·écart + niche·écart) ;
  // rencontre : la part des accouplements possibles entre deux lignées qui se mêlent à parts égales et ne sont pas isolées
  hybride: { actif: true, rencontre: .3, tau: 200, masse: 2, corps: 3, niche: 1, zone: .01 },
  // la méfiance (docs/12) : elle retombe de moitié en demi_vie cycles, l'habituation en demi_vie_habitude ; preuve : le
  // nombre de contacts qui la fixent aux deux tiers ; sensibilite : ce que pèse la part des contacts qui finissent mal ;
  // habitude : les contacts sans suite qui habituent aux deux tiers ; oubli : la vitesse à laquelle des contacts paisibles
  // défont une méfiance (contre 1 pour l'apprendre) ; paix : combien la part des contacts qui finissent mal empêche de
  // s'habituer (à 20, un sur dix suffit presque) ; audace : ce que l'audace moyenne (z) change à tout cela ; alerte : le
  // seuil d'un événement « mefiance »
  mefiance: { actif: true, demi_vie: 6, demi_vie_habitude: 15, preuve: 20, sensibilite: 6, habitude: 150, oubli: .3, paix: 20, audace: .5, alerte: .5 },
  sexe: { actif: true, gain: 2e-4, perte: 2e-4, attrait: 1, nouveau: { dominant: .001, recessif: .03 } }   // gain, perte : mutation par allèle et par génération
};
// --- les traits continus (docs/8) : par population, Q[trait] = { m : moyenne génétique, G : variance additive }, en
// écarts-types naturels de la génération 0 ; la variance phénotypique est P = G + (1 − h2), l'environnement ne change pas ---
const QUANT = CAT.QUANT || {};
const lireQ = q => { const o = {}; for (const [k, d] of Object.entries(QUANT)) { const x = q?.[k];
  o[k] = x && Number.isFinite(x.m) ? { m: x.m, G: Number.isFinite(x.g) ? x.g : d.h2 } : { m: 0, G: d.h2 }; } return o; };
const copieQ = Q => Object.fromEntries(Object.entries(Q).map(([k, x]) => [k, { m: x.m, G: x.G }]));
const ecrireQ = Q => Object.fromEntries(Object.entries(Q).map(([k, x]) => [k, { m: +x.m.toFixed(5), v: +(x.G + 1 - QUANT[k].h2).toFixed(5), g: +x.G.toFixed(5) }]));
// l'optimum d'une population : la niche du taxon, déplacée par l'écart du biome sur l'axe du trait (plus froid : plus grand)
const optimumQ = (d, plan, b) => d.optimum && plan.niche && b?.axes ? d.optimum.pente * ((b.axes[d.optimum.axe] ?? .5) - (plan.niche[d.optimum.axe] ?? .5)) : 0;
// ce que pèse une pente exponentielle (risque ∝ e^(pente·z)) dans une population N(m, P), rapporté à la génération 0
// (m = 0, P = 1) : 1 le jour un, plus de 1 quand la moyenne monte du côté de la pente
const penteQ = (Q, cle) => { let s = 0; for (const [k, d] of Object.entries(QUANT)) { const b = d[cle]; if (!b || !Q[k]) continue;
  s += b * Q[k].m + b * b * (Q[k].G - d.h2) / 2; } return Math.exp(s); };
// la charge de la sélection stabilisante, rapportée à la génération 0 : au-dessus de 1 quand la population s'est
// rapprochée de son optimum — l'adaptation rachète une part de ce que coûte un biome loin de la niche
const chargeQ = (Q, plan, b) => { let s = 0; for (const [k, d] of Object.entries(QUANT)) { if (!Q[k]) continue; const w = d.omega2 || 20, P = Q[k].G + 1 - d.h2, th = optimumQ(d, plan, b);
  s += .5 * Math.log((w + 1) / (w + P)) - (Q[k].m - th) ** 2 / (2 * (w + P)) + th * th / (2 * (w + 1)); } return Math.exp(s); };
// un cycle de génétique pour une population (équation de Lande : la moyenne génétique bouge de G/P × la différentielle de
// sélection). Les morts sélectives (prédation, maladie : un risque ∝ e^(pente·z) tue une part décalée de pente·P ; les
// joueurs : le z moyen rapporté) déplacent les survivants ; les naissances (fécondité) et la sélection stabilisante des
// jeunes vers l'optimum, les nouveau-nés ; la mutation remet de la variance, la dérive en ôte et agite la moyenne
// d'autant plus que la population est petite. La part de nouveau-nés fait l'échelle de temps : une génération par cycle
// pour une bête qui se renouvelle entièrement, presque rien pour une bête longévive.
function evoluerQ(Q, o) {
  const surv = Math.max(1e-9, o.N - o.Dmorts - o.Dpred - o.Dext), B = Math.max(0, o.B), Nap = surv + B; if (o.N <= 0 || Nap <= 1e-9) return;
  const g = B / Nap, Ne = Math.max(2, Nap);
  for (const [k, d] of Object.entries(QUANT)) {
    const x = Q[k]; if (!x) continue;
    const P = x.G + 1 - d.h2, w = d.omega2 || 20, th = optimumQ(d, o.plan, o.b);
    let ms = x.m;
    if (d.predation && o.Dpred > 0) ms -= x.G * d.predation * o.Dpred / surv;
    if (d.maladie && o.Dmal > 0) ms -= x.G * d.maladie * o.Dmal / surv;
    if (o.qExt && Number.isFinite(o.qExt[k]) && o.Dext > 0) ms -= (x.G / P) * (o.qExt[k] - x.m) * o.Dext / surv;
    const mn = x.m + x.G * ((d.fecondite || 0) + (o.sexe ? (d.attrait || 0) / 2 : 0) - (x.m - th) / (w + P));   // l'attrait : la moitié des gènes vient des pères choisis
    let m = (surv * ms + B * mn) / Nap;
    if (g > 0) m += Math.sqrt(g * x.G / Ne) * o.gauss();
    const Vm = d.h2 * d.h2 / (w + 1);                                  // la mutation qui tient la variance de la génération 0 à l'équilibre
    x.m = clamp(m, -8, 8); x.G = clamp(x.G + g * (Vm - x.G * x.G / (w + P) - x.G / (2 * Ne)), 1e-4, 4);
  }
}
// deux groupes qui se rejoignent : les moyennes se pondèrent, l'écart entre elles devient de la variance
function melangerQ(A, na, B, nb) {
  const n = na + nb; if (n <= 0) return copieQ(A);
  const o = {}; for (const k of Object.keys(A)) { const a = A[k], b = B[k] || a;
    o[k] = { m: (na * a.m + nb * b.m) / n, G: clamp((na * a.G + nb * b.G) / n + na * nb * (a.m - b.m) ** 2 / (n * n), 1e-4, 4) }; }
  return o;
}
// --- la reproduction sexuée (docs/9) : par population, A[trait] = p, la fréquence de l'allèle qui porte le trait. Une bête
// en a deux copies (Hardy-Weinberg) ; dominant : une suffit à montrer le trait, récessif : il en faut deux ---
const domDe = (cat, id) => (cat[id]?.heredite ?? CAT.TRAITS[id]?.heredite) !== 'recessif';
const cleDe = traits => traits.slice().sort().join('+');            // la clé d'un phénotype : ses traits ('' : le plan de base)
// une mère d'allèle a, un père d'allèle b : la part de petits qui montrent le trait (E), et la part de l'allèle chez ceux
// qui le montrent (exp) et chez les autres (non : les porteurs cachés d'un récessif)
function mendel(a, b, dom) {
  const TT = a * b, Tt = a * (1 - b) + b * (1 - a), tt = (1 - a) * (1 - b);
  if (dom) { const E = TT + Tt; return { E, exp: E > 0 ? (TT + Tt / 2) / E : 0, non: 0 }; }
  const Nn = Tt + tt; return { E: TT, exp: 1, non: Nn > 0 ? Tt / 2 / Nn : 0 };
}
// une population sans mémoire génétique (un monde d'avant, un phénotype nouveau) : Hardy-Weinberg à rebours
function allelesDe(phenotypes, N, cat, A0) {
  const tot = N.reduce((a, x) => a + x, 0) || 1, e = {};
  phenotypes.forEach((p, i) => { for (const id of p.traits) e[id] = (e[id] || 0) + N[i] / tot; });
  const A = {}; for (const id in e) { const x = clamp(e[id], 0, .999999); A[id] = domDe(cat, id) ? 1 - Math.sqrt(1 - x) : Math.sqrt(x); }
  for (const id in A0 || {}) if (Number.isFinite(A0[id])) A[id] = A0[id];
  return A;
}
// Les phénotypes ne disent que des TAUX : survie, fécondité, attrait de ceux qui montrent le trait et des autres. Les
// fréquences d'allèles sont l'état (un phénotype rare fondu dans le plan de base ne perd pas ses allèles).
// tauxDe : le taux par tête (num / den) de ceux qui montrent le trait id, et des autres (null : personne dans le groupe)
function tauxDe(id, phenotypes, num, den) {
  let ne = 0, de = 0, nn = 0, dn = 0;
  phenotypes.forEach((ph, i) => { if (!(den[i] > 0)) return; if (ph.traits.includes(id)) { ne += num[i]; de += den[i]; } else { nn += num[i]; dn += den[i]; } });
  return [de > 0 ? ne / de : null, dn > 0 ? nn / dn : null];
}
// ce que deviennent des bêtes en Hardy-Weinberg (M = mendel) quand ceux qui montrent le trait ont le taux rE, les autres rN :
// [copies de l'allèle, bêtes] par tête
function ponderer(M, rE, rN) {
  if (rE == null) rE = rN ?? 1; if (rN == null) rN = rE;
  return [M.E * rE * M.exp + (1 - M.E) * rN * M.non, M.E * rE + (1 - M.E) * rN];
}
const alleleParmi = (p, dom, r) => { const [n, d] = ponderer(mendel(p, p, dom), r[0], r[1]); return d > 0 ? n / d : p; };
// les naissances : chaque petit tire un allèle de sa mère (pm) et un de son père (pf) à chaque locus, les loci sont
// indépendants ; ce qui se voit passe par CAT.exprimer. → Map(clé de phénotype → part des petits)
const EXPRIME = new Map();                                            // (ce qui se voit d'un jeu d'allèles : le même pour tous)
function portees(pm, pf, cat, epsilon = 1e-6) {
  const L = Object.keys(pm).map(id => [id, mendel(pm[id], pf[id] ?? pm[id], domDe(cat, id)).E]).filter(([, e]) => e > epsilon).sort((x, y) => y[1] - x[1]);
  const out = new Map(), vus = EXPRIME;
  const rec = (k, pr, porte) => {
    if (pr < epsilon) return;
    if (k === L.length) { const c = porte.join('|'); let cle = vus.get(c);
      if (cle === undefined) { cle = (CAT.exprimer ? CAT.exprimer(porte, cat) : porte.slice().sort()).join('+'); vus.set(c, cle); }
      out.set(cle, (out.get(cle) || 0) + pr); return; }
    const [id, e] = L[k];
    if (e < 1) rec(k + 1, pr * (1 - e), porte);
    porte.push(id); rec(k + 1, pr * e, porte); porte.pop();
  };
  rec(0, 1, []);
  let z = 0; for (const v of out.values()) z += v; if (z > 0) for (const [k, v] of out) out.set(k, v / z);
  return out;
}
const attraitDe = (traits, cat) => Math.pow(traits.reduce((a, id) => a * (cat[id]?.attrait ?? CAT.TRAITS[id]?.attrait ?? 1), 1), REGLES.sexe.attrait ?? 1);
// le phénotype existant le plus proche d'une combinaison absente : celui dont les traits en sont le plus grand sous-ensemble
function plusProche(cle, phenotypes) {
  const T = new Set(cle ? cle.split('+') : []); let best = 0, n = -1;
  phenotypes.forEach((p, i) => { if (p.traits.every(x => T.has(x)) && p.traits.length > n) { best = i; n = p.traits.length; } });
  return best;
}
// --- l'isolement et les hybrides (docs/10) ---
// l'écart génétique entre deux groupes : la différence de fréquences d'allèles rapportée à leur diversité (le F_ST : 0, une
// seule population ; 0,25, des populations très différenciées),
// plus le quart de l'écart moyen des traits continus (en variances naturelles)
// la méfiance et l'habituation d'une population, un cycle plus tard (docs/12). c = { rencontres, danger, aide } : les
// contacts sans suite, ceux qui ont fini mal (prélèvements, captures), l'aide (nourrissage, libération) ; za : son audace
function apprendre(m, h, c, za = 0) {
  const M = REGLES.mefiance, ka = Math.exp(-M.audace * clamp(za, -3, 3));   // < 1 chez une population audacieuse
  m *= 2 ** (-1 / M.demi_vie); h *= 2 ** (-1 / M.demi_vie_habitude);
  const Rn = Math.max(0, +c?.rencontres || 0), D = Math.max(0, +c?.danger || 0), A = Math.max(0, +c?.aide || 0), tot = Rn + D;
  if (tot > 0) { const e = 1 - Math.exp(-tot / M.preuve), cible = 1 - Math.exp(-M.sensibilite * ka * D / tot);
    m += e * (cible - m) * (cible > m ? 1 : M.oubli);
    h *= 1 - e * cible; }                                                  // ce qui finit mal défait l'habitude
  if (Rn + A > 0) h += (1 - h) * (1 - m) * Math.exp(-M.paix * D / Math.max(1, tot)) * (1 - Math.exp(-(Rn + 3 * A) / (M.habitude * ka)));
  return [clamp(m, 0, 1), clamp(h, 0, 1)];
}
function divergence(A1, Q1, A2, Q2) {
  let num = 0, den = 0;
  for (const id of new Set([...Object.keys(A1 || {}), ...Object.keys(A2 || {})])) { const p = A1?.[id] || 0, q = A2?.[id] || 0, m = (p + q) / 2; num += (p - q) ** 2; den += m * (1 - m); }
  let qd = 0, k = 0; for (const c in Q1 || {}) if (Q2?.[c]) { qd += (Q1[c].m - Q2[c].m) ** 2; k++; }
  return (num > 0 ? num / (4 * Math.max(den, .02)) : 0) + (k ? qd / k : 0) / 4;   // (le premier terme est le F_ST de deux populations)
}
// la parenté de deux lignées : depuis quand elles ne partagent plus leurs gènes (null : rien ne les relie)
const parentDe = (id, T) => T.get(id)?.parent || (id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : null);
function parente(A, B, T) {
  const chaine = t => { const L = [t.id]; let id = parentDe(t.id, T); while (id && !L.includes(id) && L.length < 60) { L.push(id); id = parentDe(id, T); } return L; };
  const cA = chaine(A), cB = chaine(B), c = cA.find(id => cB.includes(id)); if (!c) return null;
  const app = id => id === A.id ? A.apparu : id === B.id ? B.apparu : (T.get(id)?.apparu ?? 0), iA = cA.indexOf(c), iB = cB.indexOf(c);
  return { depuis: Math.min(iA > 0 ? app(cA[iA - 1]) : Infinity, iB > 0 ? app(cB[iB - 1]) : Infinity) };
}
// l'isolement reproductif de deux lignées (0 : une seule population ; 1 : aucun croisement) : il s'accumule avec le temps
// depuis leur séparation, l'écart de masse, de silhouette, de niche ; deux régimes ou deux formes de corps ne se croisent pas
function isolement(A, B, T, n) {
  if (A === B) return 0;
  if (A.plan.regime !== B.plan.regime) return 1;
  const fa = A.plan.corps?.forme, fb = B.plan.corps?.forme; if (fa && fb && fa !== fb) return 1;
  const lien = parente(A, B, T); if (!lien || !Number.isFinite(lien.depuis)) return 1;
  const H = REGLES.hybride, dm = Math.abs(Math.log((A.plan.masse_kg || 1) / (B.plan.masse_kg || 1))),
    dc = CORPS && A.plan.corps && B.plan.corps ? CORPS.distance(A.plan.corps, B.plan.corps) : 0, dn = A.plan.niche && B.plan.niche ? dist(A.plan.niche, B.plan.niche) : 0;
  return 1 - Math.exp(-(Math.max(0, n - lien.depuis) / H.tau + H.masse * dm + H.corps * dc + H.niche * dn));
}
// une moyenne continue de la lignée B, lue sur l'échelle de la lignée A (leurs plans diffèrent)
function surEchelle(d, planA, planB) {
  const a = planA[d.champ], b = planB[d.champ]; if (typeof a !== 'number' || typeof b !== 'number') return 0;
  return d.mode === 'log' ? (a > 0 && b > 0 ? Math.log(b / a) / d.echelle : 0) : (b - a) / d.echelle;
}
// une lignée qui se sépare : ce que sa population a acquis devient son plan, et sa moyenne repart de zéro
function replierQ(plan, Q) {
  for (const [k, d] of Object.entries(QUANT)) { const x = Q[k]; if (!x || !x.m || typeof plan[d.champ] !== 'number') continue;
    if (d.mode === 'log') { plan[d.champ] = +(plan[d.champ] * Math.exp(d.echelle * x.m)).toFixed(3);
      if (d.champ === 'taille_m' && typeof plan.masse_kg === 'number') plan.masse_kg = +(plan.masse_kg * Math.exp(3 * d.echelle * x.m)).toFixed(3); }
    else plan[d.champ] = +clamp(plan[d.champ] + d.echelle * x.m, 0, 1).toFixed(3);
    x.m = 0; }
}
// la phase de l'année (0 = plein hiver, 0,5 = plein été) et son nom
const SAISONS = ['hiver', 'printemps', 'été', 'automne'];
const saisonDe = (n, annee) => { if (!annee) return null; const phase = (n % annee) / annee; return { phase: +phase.toFixed(4), nom: SAISONS[Math.floor(((phase + .125) % 1) * 4)], production: +(1 + REGLES.saisons.capacite * -Math.cos(2 * Math.PI * phase)).toFixed(3) }; };
// les axes d'un biome à une phase de l'année : froid et sombre en hiver, chaud et lumineux en été, un peu plus humide en hiver
function axesSaison(b, phase) {
  if (phase == null || b.saisons === false || b.saisons === null) return b.axes;
  const A = { ...REGLES.saisons, ...(b.saisons || {}) }, c = -Math.cos(2 * Math.PI * phase), a = { ...b.axes };
  a.temperature = clamp(a.temperature + A.temperature * c, 0, 1); a.lumiere = clamp(a.lumiere + A.lumiere * c, 0, 1); a.humidite = clamp(a.humidite - A.humidite * c, 0, 1);
  return a;
}
const productionSaison = (b, phase) => phase == null || b.saisons === false || b.saisons === null ? 1 : 1 + ({ ...REGLES.saisons, ...(b.saisons || {}) }).capacite * -Math.cos(2 * Math.PI * phase);
const PART_K = { herbivore: 1, omnivore: 1, detritivore: .3, filtreur: .3, carnivore: 0 };   // ce que chaque régime pèse sur la capacité du biome (l'omnivore : moins s'il trouve des proies)
const facteur = (traits, cat, k) => traits.reduce((f, id) => f * (cat[id]?.[k] ?? 1), 1);
// Une lignée qui se sépare dérive : sa masse (et avec elle maturité et longévité, allométriquement), son tempérament, sa
// sociabilité, et sous REGLES.derive plus marqué (la genèse) son régime, sa locomotion, son heure — la niche devient le biome.
function deriver(plan, b, R) {
  const D = REGLES.derive, k = D.masse[0] * Math.pow(D.masse[1] / D.masse[0], R());   // tirage log-uniforme entre les deux bornes
  const p = { ...plan, masse_kg: +(plan.masse_kg * k).toFixed(3), taille_m: +(plan.taille_m * Math.cbrt(k)).toFixed(3),
    maturite: +(plan.maturite * Math.pow(k, .25)).toFixed(2), longevite: +(plan.longevite * Math.pow(k, .25)).toFixed(2),
    temperament: clamp(plan.temperament + (R() - .5) * .3, 0, 1), sociabilite: clamp(plan.sociabilite + (R() - .5) * .3, 0, 1),
    niche: { ...b.axes }, tolerance: plan.tolerance || .35, locomotion: [...(plan.locomotion || ['marche'])] };
  // le régime passe par l'omnivore ; un omnivore redevient plus souvent herbivore que carnivore (il y a plus à brouter qu'à chasser)
  // (un filtreur, un détritivore gardent le leur : ce n'est pas un pas de plus ou de moins vers la viande)
  if (R() < D.regime && ['herbivore', 'omnivore', 'carnivore'].includes(plan.regime)) p.regime = plan.regime === 'herbivore' ? 'omnivore' : plan.regime === 'carnivore' ? 'omnivore' : R() < .35 ? 'carnivore' : 'herbivore';
  // un mode de déplacement se gagne (ce que le biome favorise) ou se perd (un accessoire dont le biome n'a pas l'usage) : sans
  // cela, toutes les lignées finiraient par tout savoir faire
  const VOL = REGLES.vol_masse_max ?? Infinity, eau = b.milieu === 'amphibie' || b.milieu === 'aquatique' || b.milieu === 'marin';
  if (R() < D.locomotion) {
    const inutiles = p.locomotion.filter(l => (l === 'grimpe' && b.axes.couvert < .4) || (l === 'nage' && !eau && p.regime !== 'filtreur') || (l === 'course' && b.axes.couvert > .8) || (l === 'saut' && R() < .5) || (l === 'fouissage' && R() < .3));
    if (inutiles.length && p.locomotion.length > 1 && R() < .45) { const x = inutiles[Math.floor(R() * inutiles.length)]; p.locomotion = p.locomotion.filter(l => l !== x); }
    else { const c = []; if (eau && !p.locomotion.includes('nage')) c.push('nage');
      if (b.axes.couvert > .6 && !p.locomotion.includes('grimpe')) c.push('grimpe'); if (!p.locomotion.includes('course')) c.push('course'); if (!p.locomotion.includes('saut')) c.push('saut');
      if (b.axes.altitude > .5 && !p.locomotion.includes('vol') && p.masse_kg <= VOL && R() < .25) c.push('vol'); if (c.length) p.locomotion.push(c[Math.floor(R() * c.length)]); }
  }
  const volait = p.locomotion.includes('vol') && p.masse_kg > VOL;
  if (volait) { p.locomotion = p.locomotion.filter(l => l !== 'vol'); if (!p.locomotion.some(l => l !== 'nage') || !p.locomotion.length) p.locomotion.unshift('marche'); }
  if (R() < D.activite) p.activite = ['diurne', 'nocturne', 'crepusculaire'][Math.floor(R() * 3)];
  // l'eau d'un nageur suit celle où la lignée se sépare : la mer la sale, la rivière l'adoucit, la côte la rend souple
  if (p.locomotion.includes('nage')) { const e = plan.locomotion?.includes('nage') ? plan.eau || 'douce' : b.milieu === 'marin' ? 'salee' : 'douce';
    p.eau = b.milieu === 'marin' ? (e === 'douce' ? 'mixte' : R() < .3 ? 'salee' : e) : b.milieu === 'aquatique' ? (e === 'salee' ? 'mixte' : R() < .3 ? 'douce' : e)
      : b.milieu === 'amphibie' && R() < .25 ? 'mixte' : e; }
  if (p.regime === 'carnivore' && R() < .5) { p.vitesse_rel = +(p.vitesse_rel * 1.15).toFixed(2); p.perception = clamp((p.perception || .5) + .1, 0, 1); }
  // le corps suit : la silhouette dérive vers ce que le biome favorise, et garde la marque d'un mode de déplacement gagné
  if (plan.corps && CORPS) { const avant = new Set(plan.locomotion || ['marche']);
    p.corps = CORPS.deriver(plan.corps, p, b, R, D.corps ?? 1, p.locomotion.filter(l => !avant.has(l)), k);
    if (volait && p.corps) p.corps = { ...p.corps, ailes: 0, organes: (p.corps.organes || []).filter(o => o.type !== 'ailes'), forme: p.corps.forme === 'oiseau' ? 'bipede' : p.corps.forme }; }
  return p;
}
// la place qu'un taxon trouve dans un biome : les autres l'encombrent d'autant plus qu'ils ont sa taille (une bête de
// 5 kg et une de 60 kg ne broutent pas la même chose) — recouvrement gaussien sur le logarithme des masses
// Les ressources d'un biome s'étalent sur quatre décades de masse (0,1 kg à 1 t) ; une espèce n'en exploite qu'une bande
// (écart-type 0,35 décade : une bête de 5 kg et une de 15 kg ne se gênent qu'à moitié, 5 kg et 60 kg presque pas) :
// sa capacité propre est cette part de la capacité du biome, et la somme de toutes reste bornée par K.
const SIGMA_BANDE = .35;
const recouvrement = (m1, m2) => { const d = Math.log10(m1 / m2); return Math.exp(-(d * d) / (2 * SIGMA_BANDE * SIGMA_BANDE)); };
const charge = (liste, masse) => liste.reduce((s, e) => s + e.biomasse * recouvrement(masse, e.masse), 0);
const BANDE = Math.sqrt(2 * Math.PI) * SIGMA_BANDE / 4;   // ≈ 0,22 : la largeur d'une bande rapportée au spectre entier
// l'appétence d'un prédateur pour une proie : la masse (une proie d'un tiers de sa masse est idéale ; rien au-delà de 1,5 fois,
// rien sous un cinquantième), la vitesse (une proie plus rapide échappe), le vol (hors de portée d'un marcheur), le groupe
// (l'alerte collective) et l'heure (un diurne croise peu un nocturne)
function appetence(pred, proie) {
  const rap = (proie.masse_kg || 1) / (pred.masse_kg || 1); if (rap < .02 || rap > 1.5) return 0;
  const lg = Math.log10(rap) - Math.log10(.3); let f = Math.exp(-(lg * lg) / .5);
  const vp = (pred.vitesse_rel || 4) * (pred.taille_m || 1), vq = (proie.vitesse_rel || 4) * (proie.taille_m || 1);
  f *= clamp(Math.sqrt(vp / Math.max(.01, vq)), .6, 1.4);
  if ((proie.locomotion || []).includes('vol') && !(pred.locomotion || []).includes('vol')) f *= .3;
  f *= 1 - .2 * (proie.sociabilite || 0);
  const ap = pred.activite, aq = proie.activite; if (ap && aq && ap !== aq && ap !== 'continue' && aq !== 'continue' && ap !== 'crepusculaire' && aq !== 'crepusculaire') f *= .6;
  return f;
}
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
// (la masse ramène tout : une bête de 100 kg ne se multiplie pas comme une de 1 kg — loi de Fenchel, r ∝ masse^-1/4 ;
//  on garde la différence entre les stratégies, portée et maturité, à l'intérieur de ce que la masse permet)
const croissance = p => { const rmax = .35 * Math.pow(Math.max(.1, p.masse_kg || 1), -.25), r = .6 * Math.log(1 + (p.portee || 2)) / Math.max(1, p.maturite || 1);
  return clamp(r * Math.min(1, rmax / .35), .01, rmax); };
const mortalite = p => 1 / Math.max(2, p.longevite || 20);
// convenance d'un biome (0..1) : 1 dans la niche, décroît avec la distance ; nulle si le milieu est impossible
// L'eau : un nageur vit en eau douce (plan.eau absent, ou 'douce'), en mer ('salee'), ou dans les deux ('mixte', comme
// les poissons qui remontent les fleuves) ; une côte, une mangrove, un estuaire (amphibie) accueillent tous les nageurs.
const eauDouce = plan => plan.eau !== 'salee', eauSalee = plan => plan.eau === 'salee' || plan.eau === 'mixte';
function convenance(plan, biome) {
  const loco = plan.locomotion || [], m = biome.milieu;
  const terre = loco.some(l => ['marche', 'course', 'saut', 'reptation', 'fouissage', 'grimpe'].includes(l));
  const vol = loco.includes('vol'), nage = loco.includes('nage');
  const ok = m === 'aquatique' ? nage && eauDouce(plan) : m === 'marin' ? nage && eauSalee(plan) : m === 'aerien' ? vol
    : m === 'souterrain' ? loco.includes('fouissage') || terre : m === 'amphibie' ? terre || vol || loco.includes('nage') : terre || vol;
  if (!ok || (plan.regime === 'filtreur' && m !== 'aquatique' && m !== 'marin' && m !== 'amphibie')) return 0;   // un filtreur filtre l'eau
  if (!plan.niche) return 1;
  const d = dist(plan.niche, biome.axes), tol = plan.tolerance || .35;
  return Math.exp(-(d * d) / (2 * tol * tol));
}
const biomasse = (plans, N) => N.reduce((s, n, i) => s + n * (plans[i].masse_kg || 1), 0);

// --- un cycle ---
function cycle(inst, pressions = {}, opt = {}) {
  const n = inst.cycle.n + 1, R = rng(inst.monde.graine, n);
  const cat = { ...(inst.catalogue?.traits || {}), ...CAT.TRAITS };   // la biologie d'un trait connu est celle du moteur ; un trait propre au monde garde la sienne
  const biomes = Object.fromEntries(inst.biomes.map(b => [b.id, clone(b)]));
  const ev = [], taxons = clone(inst.taxons);
  const prT = pressions.taxons || {}, prB = pressions.biomes || {};
  const saison = saisonDe(n, inst.monde.annee), phase = saison ? saison.phase : null;
  const GEN = REGLES.genetique !== false && opt.genetique !== false && Object.keys(QUANT).length > 0;
  const Rq = rng(((inst.monde.graine >>> 0) ^ 0x5bd1e995) >>> 0, n);   // la génétique a son propre tirage : l'écologie garde le sien
  const gauss = () => Math.sqrt(-2 * Math.log(1 - Rq())) * Math.cos(2 * Math.PI * Rq());
  const SEX = REGLES.sexe?.actif !== false && opt.sexe !== false;

  // 1. l'habitat : les pertes et gains du cycle, puis un lent retour vers la capacité de base
  for (const b of Object.values(biomes)) {
    b.capacite_base ??= b.capacite;
    b.capacite = Math.max(0, b.capacite + (prB[b.id]?.habitat || 0) * (opt.unite_habitat ?? 1));
    b.capacite += (b.capacite_base - b.capacite) * REGLES.regain_habitat;
  }

  // 1b. les catastrophes : un incendie, une crue, une sécheresse peut frapper un biome ; sa capacité tombe (elle regagnera
  //     lentement sa valeur de base) et une part des bêtes qui ne peuvent s'y soustraire meurt sur le coup
  const sinistres = {};
  for (const b of Object.values(biomes)) {
    if (b.catastrophes === false) continue;
    const ax = axesSaison(b, phase), C = REGLES.catastrophes, ete = phase != null ? Math.max(0, -Math.cos(2 * Math.PI * phase)) : .5, printemps = phase != null ? Math.max(0, Math.sin(2 * Math.PI * phase)) : .5;
    const chances = {
      incendie: C.incendie.chance * Math.max(0, ax.couvert - .3) * Math.max(0, 1 - ax.humidite) * 4 * (.5 + ete),
      crue: C.crue.chance * Math.max(0, ax.humidite - .5) * Math.max(0, 1 - ax.altitude) * 4 * (.5 + printemps),
      secheresse: C.secheresse.chance * Math.max(0, .6 - ax.humidite) * 4 * ete
    };
    for (const [type, p] of Object.entries(chances)) if (p > 0 && R() < p) {
      b.capacite = Math.max(0, b.capacite * (1 - C[type].capacite)); sinistres[b.id] = type;
      ev.push({ type: 'catastrophe', taxon: b.id, biome: b.id, detail: `${type} : ${C[type].detail} ; capacité −${Math.round(C[type].capacite * 100)} %` });
      break;
    }
  }

  // 2. l'état de départ : par taxon, les plans de chaque phénotype ; par biome, la biomasse qui pèse sur la capacité
  //    (les herbivores en entier, les omnivores et les détritivores en partie, les carnivores pas du tout : eux vivent des proies)
  const etat = new Map(), B = {};
  for (const t of taxons) {
    if (t.eteint) continue;
    const plans = t.phenotypes.map(p => planDe(t.plan, p.traits, cat));
    const pops = {};
    for (const pop of t.populations) {
      const N = t.phenotypes.map(p => pop.effectif * (p.frequence_par_biome?.[pop.biome] ?? p.frequence));
      pops[pop.biome] = { N, depuis: pop.depuis ?? t.apparu, avant: pop.effectif, predation: new Array(N.length).fill(0), ration: new Array(N.length).fill(0), satiete: null, maladie: pop.maladie ? { ...pop.maladie } : null };
      if (SEX) pops[pop.biome].A = allelesDe(t.phenotypes, N, cat, pop.alleles);   // les fréquences d'allèles (un monde d'avant : déduites des phénotypes)
      Object.assign(pops[pop.biome], { flux0: pop.flux ?? 0, hyb0: pop.hybride?.part ?? 0, immig: 0, mef0: pop.mefiance ?? 0, hab0: pop.habituation ?? 0 });
      if (GEN) { const P = pops[pop.biome], Q = P.Q = lireQ(pop.quant);   // ce que ses traits continus pèsent : risque d'être mangé, naissances, maladie
        P.fp = penteQ(Q, 'predation'); P.ff = penteQ(Q, 'fecondite') * chargeQ(Q, t.plan, biomes[pop.biome]); P.fm = penteQ(Q, 'maladie'); }
      const s0 = pop.satiete ?? 0;   // (la satiété du cycle précédent : un omnivore qui trouve des proies pèse moins sur la place)
      (B[pop.biome] ??= []).push({ masse: t.plan.masse_kg || 1, biomasse: N.reduce((s, n, i) => s + n * (plans[i].masse_kg || 1) * (plans[i].regime === 'omnivore' ? 1 - .3 * s0 : PART_K[plans[i].regime] ?? 1), 0) });
    }
    etat.set(t.id, { plans, pops, couts: t.phenotypes.map(p => coutDe(p.traits, cat)),
      vuln: t.phenotypes.map(p => facteur(p.traits, cat, 'vulnerabilite')), chasse: t.phenotypes.map(p => facteur(p.traits, cat, 'chasse')),
      resist: t.phenotypes.map(p => facteur(p.traits, cat, 'resistance')) });
  }

  // 2b. qui vit où, et ce que chacun porte au début du cycle (les croisements entre lignées lisent cet état-là : l'ordre des
  //     taxons ne change rien)
  const HYB = SEX && REGLES.hybride?.actif !== false && opt.hybride !== false, Tmap = new Map(taxons.map(t => [t.id, t])), presents = {}, isoCache = new Map();
  const isoDe = (a, b) => { const k = a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id; if (!isoCache.has(k)) isoCache.set(k, isolement(a, b, Tmap, n)); return isoCache.get(k); };
  if (HYB) for (const t of taxons) { if (t.eteint) continue; for (const [bid, P] of Object.entries(etat.get(t.id).pops)) { const Nt = P.N.reduce((a, x) => a + x, 0); if (Nt < 1) continue;
    (presents[bid] ??= []).push({ t, N: Nt, A0: P.A ? { ...P.A } : null, Q0: P.Q ? copieQ(P.Q) : null }); } }

  // 3. la chaîne alimentaire, biome par biome : chaque prédateur prélève des proies selon ce qui est à sa portée ;
  //    sa satiété décide de ses naissances et de sa faim ; la vulnérabilité de chaque phénotype de proie décide qui est mangé.
  //    L'appétence se calcule entre taxons (plan de base) ; les phénotypes se partagent ensuite au prorata de ce qu'ils pèsent.
  for (const bid of Object.keys(biomes)) {
    const T = [];   // un taxon présent : ses phénotypes, leur poids de proie (N × masse × vulnérabilité), son appétit
    for (const t of taxons) { if (t.eteint) continue; const E = etat.get(t.id), pop = E.pops[bid]; if (!pop) continue;
      const Nt = pop.N.reduce((a, x) => a + x, 0); if (Nt <= 0) continue;
      const poids = pop.N.map((N, i) => N * (E.plans[i].masse_kg || 1) * E.vuln[i] * (pop.fp ?? 1));
      T.push({ t, E, pop, Nt, poids, Bv: poids.reduce((a, x) => a + x, 0), regime: t.plan.regime }); }
    const preds = T.filter(q => q.regime === 'carnivore' || q.regime === 'omnivore');
    for (const p of preds) {
      let A = 0; const x = new Array(T.length).fill(0);
      T.forEach((q, k) => { if (q === p) return; const f = appetence(p.t.plan, q.t.plan); if (!f) return; x[k] = q.Bv * f; A += x[k]; });
      const puiss = x.map(v => v > 0 ? Math.pow(v, REGLES.report_proies) : 0), z = puiss.reduce((a, v) => a + v, 0);
      p.part = puiss.map(v => z ? v / z : 0); p.x = x; p.A = A;                       // la part de chaque proie dans ce que ce prédateur prélève
      p.eff = p.E.chasse.map((c, i) => c * (.7 + .6 * (p.E.plans[i].perception ?? .5)) * (p.regime === 'omnivore' ? REGLES.chasse_omnivore : 1));
      p.besoin = p.E.plans.map(pl => REGLES.besoin * Math.pow(pl.masse_kg || 1, .75));
      p.effMoy = p.pop.N.reduce((a, N, i) => a + N * p.eff[i], 0) / p.Nt; p.besoinMoy = p.pop.N.reduce((a, N, i) => a + N * p.besoin[i], 0) / p.Nt;
    }
    // les prédateurs se partagent les proies : chacun compte, en concurrents, ceux qui mangent les mêmes, au prorata de leur besoin
    for (const p of preds) {
      let C = 0;
      if (p.A > 0) for (const q of preds) { if (q === p || q.A <= 0) continue; let commun = 0; p.part.forEach((v, k) => { if (v && q.x[k]) commun += v; }); C += q.Nt * (q.besoinMoy / p.besoinMoy) * q.effMoy * commun; }
      let R = 0, sN = 0;
      p.pop.N.forEach((N, i) => { if (N <= 0) return; const a = p.A * p.eff[i] / (p.Nt * p.effMoy + C), s = a / (a + REGLES.demi_satiete * p.besoin[i]); const r = N * p.besoin[i] * s; R += r; sN += s * N; p.pop.ration[i] = r; });
      p.pop.satiete = sN / p.Nt;
      T.forEach((q, k) => { if (!p.part[k]) return; const Rq = R * p.part[k]; q.pop.N.forEach((N, i) => { if (q.poids[i]) q.pop.predation[i] += Rq * (q.poids[i] / q.Bv) / (q.E.plans[i].masse_kg || 1); }); });
    }
    for (const q of T) q.pop.N.forEach((N, i) => { q.pop.predation[i] = Math.min(q.pop.predation[i], N * REGLES.predation_max); });   // nul ne mange plus qu'une part d'une population en un cycle
  }

  // 4. la dynamique, taxon par taxon
  const migrations = [];      // { taxon, vers, N[] } à appliquer après la boucle
  for (const t of taxons) {
    if (t.eteint) continue;
    const E = etat.get(t.id), K = t.phenotypes.length;
    for (const [bid, pop] of Object.entries(E.pops)) {
      const b = biomes[bid]; if (!b) { delete E.pops[bid]; continue; }
      const bS = phase == null ? b : { ...b, axes: axesSaison(b, phase) };                    // le biome tel qu'il est en cette saison
      const conv = convenance(t.plan, bS), Keff = b.capacite * productionSaison(b, phase);
      const sat = Keff > 0 ? charge(B[bid], t.plan.masse_kg || 1) / (Keff * BANDE) : 9;
      const pr = prT[t.id]?.[bid] || {}, ret = pr.retrait || {};
      const tot = pop.N.reduce((a, x) => a + x, 0) || 1;
      // la maladie : une épidémie en cours tue selon la virulence et la résistance de chaque phénotype ; sinon, le surpeuplement
      // (et une épidémie chez les voisins) peut en faire éclore une
      let mal = pop.maladie;
      if (mal) { if (--mal.reste <= 0) { ev.push({ type: 'remission', taxon: t.id, biome: bid, detail: 'l\'épidémie s\'éteint' }); mal = pop.maladie = null; } }
      else if (tot >= 20) {
        const M = REGLES.maladie, voisinsMalades = (b.voisins || []).some(v => E.pops[v]?.maladie);
        if (R() < M.chance * Math.max(0, sat - .5) * 2 + (voisinsMalades ? M.contagion * M.chance * 10 : 0)) {
          mal = pop.maladie = { reste: Math.round(M.duree[0] + R() * (M.duree[1] - M.duree[0])), virulence: +(M.virulence[0] + R() * (M.virulence[1] - M.virulence[0])).toFixed(3) };
          ev.push({ type: 'epidemie', taxon: t.id, biome: bid, detail: `virulence ${Math.round(mal.virulence * 100)} % par cycle, ${mal.reste} cycles` });
        }
      }
      const nais = new Array(K).fill(0), morts = new Array(K).fill(0), dispo = new Array(K).fill(0), suiv = new Array(K).fill(0);
      let faim = 0, mortsNat = 0, mortsExt = 0, mortsMal = 0;
      for (let i = 0; i < K; i++) {
        const Np = pop.N[i]; if (Np <= 0) continue;
        const reg = E.plans[i].regime, s = pop.satiete ?? 0;
        const r = croissance(E.plans[i]) * (1 - E.couts[i]) * conv * (pop.ff ?? 1); let m = mortalite(E.plans[i]) + (conv < .3 ? .08 : 0);
        const place = Math.max(0, 1 - sat);
        // ce qui nourrit les naissances : la place pour l'herbivore ; la viande mangée pour le carnivore, convertie en petits à
        // REGLES.conversion (l'énergie vient des plantes : un prédateur ne vit pas de prédateurs qui vivent de lui) ; les deux pour l'omnivore
        const viande = REGLES.conversion * pop.ration[i] / (E.plans[i].masse_kg || 1);
        if (reg === 'carnivore') { nais[i] = Math.min(Np * r * s, viande); m *= 1 + 3 * (1 - s) * (1 - s); faim = Math.max(faim, 1 - s); }   // un carnivore affamé meurt plus
        else if (reg === 'omnivore') nais[i] = Np * r * place * (1 - .3 * s) * (t.plan.regime === 'carnivore' ? REGLES.omnivore_vegetal ?? 1 : 1) + Math.min(Np * r * .3 * s, viande);
        else nais[i] = Np * r * place; morts[i] = Np * m; mortsNat += morts[i];
        if (mal) { const mm = Np * mal.virulence * E.resist[i] * (pop.fm ?? 1) * (.5 + Math.min(1.5, sat)); morts[i] += mm; mortsMal += mm; }   // la maladie frappe les faibles et les entassés
        if (sinistres[bid]) { const loco = E.plans[i].locomotion || [], type = sinistres[bid];                                      // la catastrophe épargne qui peut s'y soustraire
          const echappe = type === 'incendie' ? loco.includes('vol') || loco.includes('fouissage') : type === 'crue' ? loco.includes('vol') || loco.includes('nage') : loco.includes('vol');
          if (!echappe) { const mc = Np * REGLES.catastrophes[type].mortalite; morts[i] += mc; mortsNat += mc; } }
      }
      // les petits : clonaux (chacun du phénotype de son parent), ou mendéliens — la mère pèse par sa fécondité, le père
      // aussi par son attrait ; leurs phénotypes suivent les allèles, pas ceux de leurs parents
      // les croisements avec une lignée apparentée du même biome : une part h des mères a un père de l'autre lignée ; une part
      // I (l'isolement) de ces petits hybrides ne vit pas ; les autres apportent la moitié des gènes de l'autre lignée
      let hyb = null;
      if (HYB && presents[bid]) { const H = REGLES.hybride; let perte = 0, part = 0, best = null;
        for (const o of presents[bid]) { if (o.t === t) continue; const I = isoDe(t, o.t); if (I >= .995) continue;
          const h = H.rencontre * (1 - I) * o.N / (tot + o.N); if (h < 1e-5) continue;
          perte += h * I; part += h * (1 - I); const c = { o, I, h: h * (1 - I) }; (hyb ??= []).push(c); if (!best || c.h > best.h) best = c; }
        if (hyb) { perte = Math.min(.9, perte); for (let i = 0; i < K; i++) nais[i] *= 1 - perte; pop.hyb = { avec: best.o.t.id, part, isolement: best.I }; } }
      let nb = nais, pm = null, pf = null;
      const Btot = nais.reduce((a, x) => a + x, 0);
      if (SEX && pop.A && Btot > 0) {
        const wm = nais, wf = nais.map((x, i) => x * attraitDe(t.phenotypes[i].traits, cat)); pm = {}; pf = {};
        for (const id in pop.A) { const dom = domDe(cat, id); pm[id] = alleleParmi(pop.A[id], dom, tauxDe(id, t.phenotypes, wm, pop.N)); pf[id] = alleleParmi(pop.A[id], dom, tauxDe(id, t.phenotypes, wf, pop.N)); }
        const idx = E.idx ??= new Map(t.phenotypes.map((p, i) => [cleDe(p.traits), i])); nb = new Array(K).fill(0);
        for (const [cle, part] of portees(pm, pf, cat, clamp(.02 / Btot, 1e-6, .01))) { const n = Btot * part, i = idx.get(cle);   // (sous un cinquantième de petit, une combinaison ne compte pas)
          if (i !== undefined) { nb[i] += n; continue; }
          let fb = (E.proche ??= new Map()).get(cle); if (fb === undefined) E.proche.set(cle, fb = plusProche(cle, t.phenotypes)); nb[fb] += n;                                       // une combinaison qui n'existe pas encore : chez le plus proche,
          if (n >= .05) { const M = (E.manque ??= {})[cle] ??= { n: 0, parts: [] }; M.n += n; M.parts.push([bid, fb, n]); } }   // et notée pour la faire naître
      }
      for (let i = 0; i < K; i++) dispo[i] = Math.max(0, pop.N[i] + nb[i] - morts[i] - pop.predation[i]);
      // les retraits (ou apports) extérieurs ; la demande qu'un phénotype épuisé ne peut servir se reporte sur les autres
      const ext = new Array(K).fill(0); let reste = 0;
      for (let i = 0; i < K; i++) { const d = (ret[t.phenotypes[i].id] || 0) + (ret['*'] || 0) * pop.N[i] / tot; ext[i] = clamp(d, -pop.N[i], dispo[i]); if (d > dispo[i]) reste += d - dispo[i]; }
      if (reste > 0) { const marge = dispo.map((x, i) => Math.max(0, x - ext[i])), tm = marge.reduce((a, x) => a + x, 0); if (tm > 0) for (let i = 0; i < K; i++) ext[i] += Math.min(marge[i], reste * marge[i] / tm); }
      for (let i = 0; i < K; i++) { mortsExt += Math.max(0, ext[i]); suiv[i] = Math.max(0, dispo[i] - ext[i]); }
      // les allèles après le cycle : les adultes survivants gardent les leurs (Hardy-Weinberg à p), les petits survivants
      // ceux de leurs parents ; puis la mutation (gain, perte) et la dérive, d'autant plus forte que la population est petite
      if (SEX && pop.A) {
        const tot2 = suiv.reduce((a, x) => a + x, 0), S = REGLES.sexe, Nad = pop.N.reduce((a, x) => a + x, 0);
        if (tot2 > 0) { const phi = clamp(Btot / tot2, 0, 1), Ne = Math.max(2, tot2);
          const k = suiv.map((x, i) => { const v = pop.N[i] + nb[i]; return v > 0 ? x / v : 0; }), adS = pop.N.map((x, i) => x * k[i]), nbS = nb.map((x, i) => x * k[i]);
          for (const id of Object.keys(pop.A)) { const dom = domDe(cat, id), p = pop.A[id], Mo = mendel(p, p, dom), Mn = pm ? mendel(pm[id], pf[id], dom) : Mo;
            const [na, da] = ponderer(Mo, ...tauxDe(id, t.phenotypes, adS, pop.N)), [nn, dn] = ponderer(Mn, ...tauxDe(id, t.phenotypes, nbS, nb));
            const den = Nad * da + Btot * dn; let q = den > 0 ? (Nad * na + Btot * nn) / den : p;
            q += phi * (S.gain * (1 - q) - S.perte * q); if (phi > 0 && S.derive !== false) q += Math.sqrt(phi * q * (1 - q) / (2 * Ne)) * gauss();
            q = clamp(q, 0, 1); if (q < 1e-6) delete pop.A[id]; else pop.A[id] = q; } }
      }
      // l'introgression : les petits hybrides survivants portent la moitié des gènes de l'autre lignée
      if (hyb) { const tot3 = suiv.reduce((a, x) => a + x, 0), phi = tot3 > 0 ? clamp(nais.reduce((a, x) => a + x, 0) / tot3, 0, 1) : 0;
        for (const c of hyb) { const w = phi * c.h / 2; if (!(w > 0)) continue;
          if (pop.A && c.o.A0) for (const id of new Set([...Object.keys(pop.A), ...Object.keys(c.o.A0)])) { const q = (pop.A[id] || 0) + w * ((c.o.A0[id] || 0) - (pop.A[id] || 0)); if (q >= 1e-6) pop.A[id] = clamp(q, 0, 1); else delete pop.A[id]; }
          if (pop.Q && c.o.Q0) for (const [k, d] of Object.entries(QUANT)) { const x = pop.Q[k], y = c.o.Q0[k]; if (!x || !y) continue; const z = y.m + surEchelle(d, t.plan, c.o.t.plan), dz = z - x.m;
            x.m += w * dz; x.G = clamp(x.G + w * (1 - w) * dz * dz, 1e-4, 4); } } }
      pop.mortsNat = mortsNat; pop.mortsExt = mortsExt; pop.mortsPred = pop.predation.reduce((a, x) => a + x, 0); pop.mortsMal = mortsMal;
      if (GEN && pop.Q) evoluerQ(pop.Q, { N: pop.N.reduce((a, x) => a + x, 0), Dmorts: morts.reduce((a, x) => a + x, 0), Dmal: mortsMal, Dpred: pop.mortsPred,
        Dext: mortsExt, qExt: pr.q, B: nais.reduce((a, x) => a + x, 0), plan: t.plan, b, gauss, sexe: SEX });
      if (opt.trace) opt.trace({ taxon: t.id, biome: bid, N: tot, sat, conv, satiete: pop.satiete, nais: nais.reduce((a, x) => a + x, 0), mortsNat, mortsPred: pop.mortsPred, mortsExt, mortsMal, saison: saison?.nom });
      // essaimer vers les voisins où l'on peut vivre, chacun à proportion de ce qu'il convient : un flux continu, pas une
      // vague vers un voisin tiré au sort (qui faisait d'une petite population voisine une suite d'explosions et d'effondrements)
      const essaimer = part => { const cibles = (b.voisins || []).filter(v => biomes[v]).map(v => [v, convenance(t.plan, biomes[v])]).filter(([, c]) => c > 0), W = cibles.reduce((a, [, c]) => a + c, 0);
        if (!(W > 0) || !(part > 0)) return;
        for (const [vers, c] of cibles) { const f = part * c / W; migrations.push({ taxon: t.id, vers, N: suiv.map(x => x * f), Q: pop.Q && copieQ(pop.Q), A: pop.A && { ...pop.A } }); }
        for (let i = 0; i < K; i++) suiv[i] *= 1 - part; };
      // la faim pousse un prédateur vers ses voisins
      if (faim > 1 - REGLES.faim_migration) essaimer(.05 * (faim - (1 - REGLES.faim_migration)) / REGLES.faim_migration);
      // mutation : un peu de chaque naissance va vers un autre phénotype du taxon
      if (K > 1 && !SEX) for (let i = 0; i < K; i++) { const q = nais[i] * REGLES.mutation; if (q > 0) { const j = (i + 1 + Math.floor(R() * (K - 1))) % K; suiv[i] -= q; suiv[j] += q; } }
      // déplacements imposés (le joueur emporte des bêtes ailleurs)
      for (const d of pr.deplacement || []) if (biomes[d.vers] && d.n > 0) {
        const part = Math.min(1, d.n / Math.max(1, suiv.reduce((a, x) => a + x, 0)));
        migrations.push({ taxon: t.id, vers: d.vers, N: suiv.map(x => x * part), Q: pop.Q && copieQ(pop.Q), A: pop.A && { ...pop.A } }); for (let i = 0; i < K; i++) suiv[i] *= 1 - part;
      }
      // migration naturelle : sans place, on essaime (un carnivore, lui, part quand il a faim : plus haut)
      if (t.plan.regime !== 'carnivore' && sat > REGLES.seuil_surpeuple) essaimer(REGLES.migration * clamp((sat - REGLES.seuil_surpeuple) / (1 - REGLES.seuil_surpeuple), 0, 2));
      pop.N = suiv;
    }
    // les combinaisons nées cette fois sans phénotype qui les porte (deux parents de phénotypes différents) : au-delà d'un
    // demi-individu, elles deviennent un phénotype ; leurs petits quittent le plus proche pour le rejoindre
    const connues = E.manque ? new Set(t.phenotypes.map(p => cleDe(p.traits))) : null;
    for (const [cle, M] of Object.entries(E.manque || {})) { if (M.n < .5) continue;
      const traits = cle ? cle.split('+') : []; if (connues.has(cle)) continue; connues.add(cle);
      t.phenotypes.push({ id: cle || 'base', frequence: 0, traits }); E.plans.push(planDe(t.plan, traits, cat)); E.couts.push(coutDe(traits, cat)); E.resist.push(facteur(traits, cat, 'resistance'));
      const j = t.phenotypes.length - 1; for (const p of Object.values(E.pops)) p.N.push(0);
      for (const [bid, fb, n] of M.parts) { const P = E.pops[bid]; if (!P) continue; const m = Math.min(n, P.N[fb]); P.N[fb] -= m; P.N[j] += m; } }
    delete E.manque; delete E.idx; delete E.proche;
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
            if (SEX && pop.A) { const nv = REGLES.sexe.nouveau; pop.A[id] = Math.max(pop.A[id] || 0, domDe(cat, id) ? nv.dominant : nv.recessif); }   // l'allèle neuf
            ev.push({ type: 'nouveau_trait', taxon: t.id, biome: bid, detail: `${id} apparaît chez « ${t.phenotypes[i].id} »` });
          }
        }
      }
    }
  }
  // 5. les arrivées
  for (const mg of migrations) {
    const E = etat.get(mg.taxon), t = taxons.find(x => x.id === mg.taxon);
    if (!E.pops[mg.vers]) E.pops[mg.vers] = { N: new Array(t.phenotypes.length).fill(0), depuis: n, avant: 0, maladie: null, flux0: 1, immig: 0 };
    const D = E.pops[mg.vers]; D.immig = (D.immig || 0) + mg.N.reduce((a, x) => a + x, 0);   // le flux de gènes reçu
    if (GEN && mg.Q) { const na = D.N.reduce((a, x) => a + x, 0), nb = mg.N.reduce((a, x) => a + x, 0); D.Q = D.Q && na > 0 ? melangerQ(D.Q, na, mg.Q, nb) : copieQ(mg.Q); }   // les migrants apportent leurs gènes
    if (SEX && mg.A) { const na = D.N.reduce((a, x) => a + x, 0), nb = mg.N.reduce((a, x) => a + x, 0), n = na + nb;
      if (!D.A || na <= 0) D.A = { ...mg.A }; else if (n > 0) { const o = {}; for (const id of new Set([...Object.keys(D.A), ...Object.keys(mg.A)])) o[id] = ((D.A[id] || 0) * na + (mg.A[id] || 0) * nb) / n; D.A = o; } }
    mg.N.forEach((x, i) => { D.N[i] += x; });
  }

  // 6. séparation de lignées, extinctions, écriture des taxons
  const nouveaux = []; let vivantsN = taxons.filter(t => !t.eteint).length;
  for (const t of taxons) {
    if (t.eteint || vivantsN + nouveaux.length >= REGLES.max_taxons) continue;
    const E = etat.get(t.id);
    for (const [bid, pop] of Object.entries(E.pops)) {
      const eff = pop.N.reduce((a, x) => a + x, 0), b = biomes[bid];
      const s = REGLES.separation, nid = `${t.id}.${bid}`;
      // le flux de gènes reçu (une moyenne glissante de la part d'immigrants) et l'écart au reste de l'espèce
      pop.flux = .85 * (pop.flux0 ?? 0) + .15 * Math.min(1, (pop.immig || 0) / Math.max(1, eff));
      const autres = Object.entries(E.pops).filter(([k, q]) => k !== bid && q.N.reduce((a, x) => a + x, 0) >= 1);
      if (autres.length && (pop.A || pop.Q)) { const W = autres.reduce((a, [, q]) => a + q.N.reduce((x, y) => x + y, 0), 0), Ar = {}, Qr = {};
        for (const [, q] of autres) { const w = q.N.reduce((x, y) => x + y, 0) / W; for (const id in q.A || {}) Ar[id] = (Ar[id] || 0) + w * q.A[id]; for (const k in q.Q || {}) (Qr[k] ??= { m: 0 }).m += w * q.Q[k].m; }
        pop.div = divergence(pop.A, pop.Q, Ar, Qr); } else pop.div = 0;
      const pret = n - pop.depuis >= s.cycles && eff >= s.effectif && !taxons.some(x => x.id === nid), isole = clamp(1 - pop.flux / s.flux, 0, 1);
      const ecolo = pret && t.plan.niche && dist(t.plan.niche, b.axes) >= s.distance * (t.plan.tolerance || .35), geno = pret && pop.div >= s.divergence;
      if ((ecolo || geno) && isole > 0 && R() < s.chance * isole * ((ecolo ? 1 : 0) + (geno ? Math.min(4, pop.div / s.divergence) : 0))) {
        const plan = deriver(t.plan, b, R);
        if (GEN && pop.Q) replierQ(plan, pop.Q);   // ce que la population a acquis devient le plan de la lignée
        nouveaux.push({ id: nid, nom: `${(t.nom || t.id).replace(/\s*\(.*\)$/, '')} (${b.nom || bid})`, parent: t.id, apparu: n, eteint: null, statut: 'croissance', plan,
          _E: { plans: t.phenotypes.map(p => planDe(plan, p.traits, cat)), couts: E.couts.slice(), resist: E.resist.slice(), pops: { [bid]: { N: pop.N.slice(), depuis: n, avant: pop.avant, maladie: pop.maladie, Q: pop.Q, A: pop.A, flux: 0, mef0: pop.mef0, hab0: pop.hab0 } } },
          phenotypes: clone(t.phenotypes) });
        ev.push({ type: 'separation', taxon: nid, biome: bid, detail: `lignée issue de ${t.id}, ${plan.masse_kg < t.plan.masse_kg ? 'plus petite' : 'plus grande'}${plan.regime !== t.plan.regime ? ', devenue ' + plan.regime : ''}${geno && !ecolo ? `, née de l'isolement (écart génétique ${pop.div.toFixed(2)})` : ''}` });
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
      if (eff < 2) { if (pop.avant >= 20) ev.push({ type: 'extinction', taxon: t.id, biome: bid, detail: 'la population disparaît' }); continue; }   // (un groupe de migrants qui n'a pas pris ne fait pas un événement)
      const tend = pop.avant > 0 ? (eff - pop.avant) / pop.avant : 1;
      if (pop.avant < 2) ev.push({ type: 'migration', taxon: t.id, biome: bid, detail: 'une population s\'installe' });   // (les arrivées trop maigres pour durer ne comptent pas)
      if (pop.avant >= 20 && tend <= REGLES.effondrement) ev.push({ type: 'effondrement', taxon: t.id, biome: bid, detail: `${Math.round(tend * 100)} % sur le cycle` });
      if (pop.avant >= 20 && tend >= REGLES.explosion) ev.push({ type: 'explosion', taxon: t.id, biome: bid, detail: `+${Math.round(tend * 100)} % sur le cycle` });
      const morts = (pop.mortsNat || 0) + (pop.mortsExt || 0) + (pop.mortsPred || 0) + (pop.mortsMal || 0);
      const p = { biome: bid, effectif: Math.round(eff), tendance: +tend.toFixed(3), depuis: pop.depuis };
      if (pop.maladie) p.maladie = { reste: pop.maladie.reste, virulence: pop.maladie.virulence, part: +clamp((pop.mortsMal || 0) / Math.max(1e-9, morts), 0, 1).toFixed(3) };
      if (pop.mortsExt > 0) p.pression = +clamp(pop.mortsExt / morts, 0, 1).toFixed(3);
      if (pop.mortsPred > 0) p.predation = +clamp(pop.mortsPred / morts, 0, 1).toFixed(3);
      if (pop.satiete != null) p.satiete = +pop.satiete.toFixed(3);
      if (GEN && pop.Q) p.quant = ecrireQ(pop.Q);
      if (SEX && pop.A) { const a = {}; for (const id of Object.keys(pop.A).sort()) if (pop.A[id] >= 1e-5) a[id] = +pop.A[id].toFixed(5); if (Object.keys(a).length) p.alleles = a; }
      if (pop.flux != null) p.flux = +clamp(pop.flux, 0, 1).toFixed(4);
      if (REGLES.mefiance.actif && opt.mefiance !== false) {                 // ce que la population a appris des joueurs (docs/12)
        const [m, h] = apprendre(pop.mef0 || 0, pop.hab0 || 0, prT[t.id]?.[bid]?.contact, GEN ? pop.Q?.audace?.m || 0 : 0);
        if (m >= 1e-3) p.mefiance = +m.toFixed(3); if (h >= 1e-3) p.habituation = +h.toFixed(3);
        if (m >= REGLES.mefiance.alerte && (pop.mef0 || 0) < REGLES.mefiance.alerte) ev.push({ type: 'mefiance', taxon: t.id, biome: bid, detail: `les bêtes se méfient des joueurs (${Math.round(m * 100)} %)` }); }
      if (pop.div) p.divergence = +pop.div.toFixed(4);
      if (pop.hyb && pop.hyb.part >= 1e-4) { p.hybride = { avec: pop.hyb.avec, part: +pop.hyb.part.toFixed(4), isolement: +pop.hyb.isolement.toFixed(3) };
        if (pop.hyb.part >= REGLES.hybride.zone && (pop.hyb0 ?? 0) < REGLES.hybride.zone / 2) ev.push({ type: 'hybridation', taxon: t.id, biome: bid, detail: `zone hybride avec ${pop.hyb.avec} : ${(pop.hyb.part * 100).toFixed(1)} % des naissances` }); }
      t.populations.push(p); pop.N.forEach((x, i) => { totP[i] += x; });
    }
    const total = totP.reduce((a, x) => a + x, 0);
    if (!t.populations.length) { t.eteint = n; t.statut = 'eteint'; t.phenotypes.forEach(p => { p.frequence = 0; delete p.frequence_par_biome; }); ev.push({ type: 'extinction', taxon: t.id, detail: 'le taxon s\'éteint' }); sortie.push(t); continue; }
    // les phénotypes : fréquences globales et par biome ; on oublie ceux qui ont disparu (jamais le premier, le plan de base)
    // un phénotype qui n'a plus un demi-individu disparaît de la liste ; ses bêtes rejoignent le plan de base (elles ne
    // disparaissent pas avec lui ; leurs allèles, eux, restent dans la population)
    for (let i = 1; i < K; i++) if (totP[i] < .5 && totP[i] > 0) { for (const pop of Object.values(E.pops)) { pop.N[0] += pop.N[i] || 0; pop.N[i] = 0; } totP[0] += totP[i]; totP[i] = 0; }
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
    if (garde.length > REGLES.max_phenotypes) {   // trop de variantes : les plus rares retournent au plan de base
      const base = garde[0], tri = garde.slice(1).sort((x, y) => y.frequence - x.frequence), gardes = tri.slice(0, REGLES.max_phenotypes - 1), fondus = tri.slice(REGLES.max_phenotypes - 1);
      const f = fondus.reduce((a, p) => a + p.frequence, 0); base.frequence = +(base.frequence + f).toFixed(4);
      if (base.frequence_par_biome) for (const b in base.frequence_par_biome) base.frequence_par_biome[b] = +(base.frequence_par_biome[b] + fondus.reduce((a, p) => a + (p.frequence_par_biome?.[b] || 0), 0)).toFixed(4);
      garde.length = 0; garde.push(base, ...gardes);
    }
    t.phenotypes = garde;
    const avant = Object.values(E.pops).reduce((a, p) => a + p.avant, 0), tend = avant > 0 ? (total - avant) / avant : 1;
    t.statut = total < REGLES.menace ? 'menace' : tend > .05 ? 'croissance' : tend < -.05 ? 'declin' : 'stable';
    sortie.push(t);
  }

  // 7. le catalogue de l'instantané : les traits réellement portés
  // (dans l'ordre du catalogue : c'est lui qui dit qui masque qui, docs/9)
  const portes = new Set(); for (const t of sortie) for (const p of t.phenotypes) for (const id of p.traits) if (cat[id]) portes.add(id);
  const ORD = Object.keys(CAT.TRAITS), traits = {}; for (const id of [...portes].sort((x, y) => ((ORD.indexOf(x) + 1) || 999) - ((ORD.indexOf(y) + 1) || 999) || (x < y ? -1 : 1))) traits[id] = cat[id];
  const duree = opt.duree_ms ?? 86400000, d0 = Date.parse(inst.cycle.date);
  return {
    orvane: inst.orvane || '0.1', monde: inst.monde,
    cycle: { n, date: new Date(Number.isFinite(d0) ? d0 + duree : Date.now()).toISOString(), pressions_recues: pressions.nombre ?? 0, ...(saison ? { saison } : {}) },
    biomes: Object.values(biomes).map(b => phase == null ? b : { ...b, axes_saison: axesSaison(b, phase) }), catalogue: { version: inst.catalogue?.version || '0.1', traits, ...(GEN ? { quantitatifs: QUANT } : {}), organes: CORPS.catalogueOrganes() },
    taxons: sortie, evenements: ev
  };
}

const API = { cycle, REGLES, QUANT, planDe, coutDe, croissance, mortalite, convenance, appetence, axesSaison, deriver, rng, lireQ, penteQ, chargeQ, optimumQ, evoluerQ, melangerQ, mendel, allelesDe, portees, domDe, divergence, parente, isolement, apprendre };
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
