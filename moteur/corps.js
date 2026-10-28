// Orvane — LE CORPS (moteur/corps.js)
// À quoi ressemble une lignée. Le plan dit ce qu'elle pèse et comment elle vit ; le corps dit sa silhouette, pour que
// deux lignées se distinguent à l'œil et qu'un jeu puisse dessiner une créature qu'il n'a jamais vue.
// Rien ici n'est une statistique : ce sont des proportions (0 à 1) et des couleurs, que chaque traducteur rend à sa façon.
//
//   forme    quadrupede · hexapode · bipede · oiseau · serpent   le plan d'ensemble
//   pattes   0, 2, 4, 6 ou 8                                     (serpent : 0 ; bipède et oiseau : 2)
//   long     le tronc : 0 trapu, 1 très allongé                  haut     les pattes : 0 rase le sol, 1 échassier
//   cou · tete · museau · oreilles · queue · cornes · crete · ailes · carapace · antennes   de 0 (absent) à 1 (marqué)
//   motif    uni · rayures · taches · bandes · masque
//   couleurs { robe, sombre, ventre, oeil } en [r, v, b]
//
// À chaque séparation, le corps dérive (deriver) : un peu au hasard, et surtout vers ce que le biome favorise —
// le froid raccourcit oreilles et queue, le couvert allonge la queue, la plaine grandit le cou, l'ombre fait pousser
// les antennes, et la robe glisse vers la teinte du sol. Un mode de déplacement gagné laisse sa marque (le vol
// donne des ailes, le fouissage un museau, la nage une queue) ; très rarement, le plan d'ensemble change.
// Node (require) ou navigateur (globalThis.OrvaneCorps). Zéro dépendance.
(function (racine) {
'use strict';
const FORMES = ['quadrupede', 'hexapode', 'bipede', 'oiseau', 'serpent'];
const MOTIFS = ['uni', 'rayures', 'taches', 'bandes', 'masque'];
const NUM = ['long', 'haut', 'cou', 'tete', 'museau', 'oreilles', 'queue', 'cornes', 'crete', 'ailes', 'carapace', 'antennes'];
const PATTES = { quadrupede: 4, hexapode: 6, bipede: 2, oiseau: 2, serpent: 0 };
const ORGANES = ['cornes', 'crete', 'ailes', 'carapace', 'antennes'];
const DEFAUT = { forme: 'quadrupede', pattes: 4, long: .5, haut: .45, cou: .3, tete: .45, museau: .4, oreilles: .3, queue: .4, cornes: 0, crete: 0,
  ailes: 0, carapace: 0, antennes: 0, motif: 'uni', couleurs: { robe: [150, 130, 100], sombre: [100, 86, 66], ventre: [190, 176, 150], oeil: [40, 34, 30] } };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const r2 = v => Math.round(v * 100) / 100;
const mix = (a, b, k) => a.map((v, i) => Math.round(clamp(v + (b[i] - v) * k, 0, 255)));

// un corps complet et propre, quoi qu'on lui donne (champs manquants : ceux du défaut)
function normaliser(c) {
  c = c || {};
  const n = { forme: FORMES.includes(c.forme) ? c.forme : DEFAUT.forme };
  n.pattes = Number.isFinite(c.pattes) ? Math.max(0, Math.min(8, Math.round(c.pattes / 2) * 2)) : PATTES[n.forme];
  for (const k of NUM) n[k] = r2(clamp(Number.isFinite(c[k]) ? c[k] : DEFAUT[k]));
  n.motif = MOTIFS.includes(c.motif) ? c.motif : 'uni';
  const C = c.couleurs || {}, D = DEFAUT.couleurs, ok = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
  n.couleurs = {};
  for (const k of ['robe', 'sombre', 'ventre', 'oeil']) n.couleurs[k] = ok(C[k]) ? C[k].map(v => Math.round(clamp(v, 0, 255))) : D[k].slice();
  return n;
}

// la teinte vers laquelle un sol tire les robes : un mélange pondéré par ce que le biome a d'extrême
function teinteBiome(ax) {
  const a = k => ax?.[k] ?? .5;
  const P = [
    [[150, 130, 100], .6],                                                        // la terre ordinaire
    [[226, 228, 234], clamp((.3 - a('temperature')) * 4)],                        // le froid : pâle
    [[204, 122, 62], clamp((a('temperature') - .7) * 3) * clamp((.35 - a('humidite')) * 3)],   // le chaud et sec : ocre, rouille
    [[84, 104, 62], clamp((a('humidite') - .7) * 3)],                             // l'humide : olive
    [[66, 78, 48], clamp((a('couvert') - .65) * 3)],                              // le couvert : vert sombre, écorce
    [[92, 80, 116], clamp((.35 - a('lumiere')) * 3)],                             // l'ombre : violacé, sourd
    [[132, 134, 144], clamp((a('altitude') - .6) * 2.5)],                         // la roche : gris
  ];
  let z = 0; const s = [0, 0, 0];
  for (const [c, w] of P) { z += w; for (let i = 0; i < 3; i++) s[i] += c[i] * w; }
  return s.map(v => Math.round(v / z));
}
// tourner une teinte (en degrés), en gardant sa clarté
function tourner(c, deg) {
  const [r, g, b] = c.map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d < 1e-6) return c.slice();
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + deg + 360) % 360;
  const C = (1 - Math.abs(2 * l - 1)) * s, X = C * (1 - Math.abs((h / 60) % 2 - 1)), m = l - C / 2;
  const [r1, g1, b1] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
  return [r1, g1, b1].map(v => Math.round(clamp((v + m) * 255, 0, 255)));
}

// La dérive d'une lignée qui se sépare. c : le corps du parent ; plan : le plan de la lignée (déjà dérivé) ; b : le biome
// où elle naît ; R : le tirage du cycle ; A : l'ampleur (1 dans un monde qui tourne, plus dans la genèse) ; gagnes : les modes
// de déplacement que la lignée vient d'acquérir ; k : le rapport de masse lignée / parent.
function deriver(c, plan, b, R, A = 1, gagnes = [], k = 1) {
  const n = normaliser(c), ax = b?.axes || {}, j = s => (R() - .5) * 2 * s * A, ajoute = (key, v) => { n[key] = clamp(n[key] + v * A); }, marque = (key, v) => { n[key] = clamp(n[key] + v); };
  // les proportions dérivent un peu ; les organes (cornes, crête, ailes, carapace, antennes) ne dérivent que s'ils sont là,
  // et se perdent en dessous de 0,2 — ils naissent par innovation (plus bas), pas par accumulation de hasards
  for (const key of NUM) {
    if (!ORGANES.includes(key)) { n[key] = clamp(n[key] + j(.07) + (DEFAUT[key] - n[key]) * .04 * A); continue; }   // un léger rappel : les proportions ne filent pas aux extrêmes
    if (n[key] >= .2) { n[key] = clamp(n[key] + j(.08)); if (n[key] < .2) n[key] = 0; } else n[key] = 0;
  }
  if (R() < .06 * A) { const o = ORGANES.filter(k => k !== 'ailes' && n[k] < .2); if (o.length) n[o[Math.floor(R() * o.length)]] = r2(.3 + .35 * R()); }   // un organe neuf
  else if (R() < .03 * A) { const o = ORGANES.filter(k => k !== 'ailes' && n[k] >= .2); if (o.length) n[o[Math.floor(R() * o.length)]] = 0; }      // un organe perdu
  const t = ax.temperature ?? .5, h = ax.humidite ?? .5, al = ax.altitude ?? .5, lu = ax.lumiere ?? .5, co = ax.couvert ?? .5;
  if (t < .3) { ajoute('oreilles', -.1); ajoute('queue', -.06); ajoute('long', -.05); }                  // le froid : des extrémités courtes
  if (t > .75 && h < .3) ajoute('oreilles', .1);                                                         // le désert : de grandes oreilles
  if (co > .65) { ajoute('queue', .06); ajoute('haut', -.04); }                                          // le couvert : bas sur pattes, une queue pour l'équilibre
  if (al > .6) { ajoute('haut', -.05); ajoute('cou', -.04); }                                            // la roche : trapu
  if (co < .25 && lu > .8) { ajoute('haut', .05); ajoute('cou', .05); }                                  // la plaine ouverte : on voit venir de loin
  if (lu < .35 && n.antennes >= .2) ajoute('antennes', .08);                                         // l'ombre : on tâte, des antennes plus longues
  for (const l of gagnes) {                                                                              // la marque d'un mode de déplacement gagné (une fois)
    if (l === 'vol') { n.ailes = Math.max(n.ailes, r2(.55 + .35 * R())); if (n.forme === 'bipede') { n.forme = 'oiseau'; n.pattes = 2; } }
    if (l === 'nage') { marque('queue', .12); marque('museau', .04); }
    if (l === 'fouissage') { marque('museau', .12); marque('haut', -.1); marque('oreilles', -.08); }
    if (l === 'grimpe') { marque('queue', .12); marque('long', .04); }
    if (l === 'saut') marque('haut', .1);
    if (l === 'course') { marque('haut', .06); marque('long', .03); }
  }
  // très rarement, le plan d'ensemble change (ou rien : la plupart des tirages ne changent rien)
  if (R() < .02 * A * A) {
    const loco = plan?.locomotion || [], u = R();
    if (n.forme === 'quadrupede') {
      if ((loco.includes('saut') || loco.includes('course')) && u < .35) { n.forme = loco.includes('vol') ? 'oiseau' : 'bipede'; n.pattes = 2; }
      else if (n.long > .65 && n.haut < .3 && u < .6) { n.forme = 'serpent'; n.pattes = 0; n.long = Math.max(n.long, .85); }
      else if (u < .8) { n.forme = 'hexapode'; n.pattes = 6; }
    } else if (n.forme === 'hexapode') {
      if (u < .35) { n.forme = 'quadrupede'; n.pattes = 4; }
      else if (u < .5) n.pattes = n.pattes === 8 ? 6 : 8;
    } else if (n.forme === 'bipede' && u < .3) { n.forme = 'quadrupede'; n.pattes = 4; }
    else if (n.forme === 'serpent' && u < .35) { n.forme = 'quadrupede'; n.pattes = 4; n.haut = .12; }
  }
  if (n.forme === 'serpent') { n.pattes = 0; n.long = Math.max(n.long, .8); }
  // la masse : une lignée plus grande a une tête plus petite, à proportion (et l'inverse)
  if (k > 0 && k !== 1) ajoute('tete', -.12 * Math.log2(k) / A);
  // la robe glisse vers la teinte du sol (le camouflage), tourne un peu ; parfois elle s'avive (la parade, l'avertissement)
  const C = n.couleurs, cible = teinteBiome(ax), g = (.06 + .12 * R()) * Math.sqrt(A), rot = j(18);
  C.robe = tourner(mix(C.robe, cible, g), rot);
  C.sombre = tourner(mix(C.sombre, cible.map(v => v * .62), g * .8), rot);
  if (R() < .08 * A) { const vive = tourner([200, 70, 50], R() * 360), k2 = .35 + .3 * R(); C.robe = mix(C.robe, vive, k2); C.sombre = mix(C.sombre, vive.map(v => v * .55), k2 * .8); }
  C.ventre = tourner(mix(C.ventre, mix(C.robe, [240, 236, 226], .45), .3), rot * .5);
  if (lu < .35) C.oeil = mix(C.oeil, [200, 236, 255], .3);                                             // dans l'ombre, des yeux pâles
  C.oeil = C.oeil.map(v => Math.round(clamp(v + j(10), 0, 255)));
  if (R() < .12 * A) n.motif = MOTIFS[Math.floor(R() * MOTIFS.length)];
  for (const key of NUM) n[key] = r2(n[key]);
  return n;
}

// l'écart entre deux corps : 0 identiques ; au-delà de ~0,35, l'œil voit une autre bête
function distance(a, b) {
  a = normaliser(a); b = normaliser(b);
  const d = Math.sqrt(NUM.reduce((s, k) => s + (a[k] - b[k]) ** 2, 0) / NUM.length);
  const dc = Math.hypot(...a.couleurs.robe.map((v, i) => v - b.couleurs.robe[i])) / 441;
  return r2(d + (a.forme !== b.forme ? 1 : 0) + (a.pattes !== b.pattes ? .5 : 0) + (a.motif !== b.motif ? .08 : 0) + dc * .5);
}

// une phrase pour l'observatoire et les fiches : « quadrupède trapu, haut sur pattes, longue queue, cornes »
function decrire(c) {
  c = normaliser(c);
  const F = { quadrupede: 'quadrupède', hexapode: 'hexapode', bipede: 'bipède', oiseau: 'oiseau', serpent: 'serpentiforme' };
  const L = [F[c.forme] + (c.forme === 'hexapode' && c.pattes !== 6 ? ` à ${c.pattes} pattes` : '') + (c.long > .7 ? ' allongé' : c.long < .3 ? ' trapu' : '')];
  if (c.forme !== 'serpent') L.push(c.haut > .7 ? 'haut sur pattes' : c.haut < .2 ? 'ras du sol' : '');
  const q = (k, mots) => { const v = c[k]; return v >= .7 ? mots[1] : v >= .35 ? mots[0] : ''; };
  L.push(q('cou', ['cou dégagé', 'long cou']), q('queue', ['queue', 'longue queue']), q('oreilles', ['oreilles', 'grandes oreilles']),
    q('museau', ['museau', 'long museau']), q('cornes', ['cornes', 'grandes cornes']), q('crete', ['crête', 'haute crête']),
    q('ailes', ['ailes', 'grandes ailes']), q('carapace', ['dos cuirassé', 'carapace']), q('antennes', ['antennes', 'longues antennes']));
  if (c.motif !== 'uni') L.push(c.motif === 'masque' ? 'masque sombre' : c.motif);
  return L.filter(Boolean).join(', ');
}

const API = { FORMES, MOTIFS, NUM, PATTES, ORGANES, DEFAUT, normaliser, deriver, distance, decrire, teinteBiome, tourner };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.OrvaneCorps = API;
})(globalThis);
