// Orvane × Stone Valley — LES TABLES DE CORRESPONDANCE (correspondance.js)
// Tout ce que le traducteur sait du jeu et qu'Orvane ignore : quel biome du jeu est quel biome Orvane, quelle
// espèce est quel taxon, quel trait devient quelle variante. Node (require) ou navigateur (globalThis.OrvaneSV_Corr).
(function (racine) {
'use strict';
// --- les biomes du jeu (index dans BIOME de index.html) décrits sur les cinq axes d'Orvane ---
//     id : le biome du monde fait pour le jeu (sv-1) ; u : celui du monde d'Orvane, où tous les jeux se branchent (hebergement/LISEZ-MOI.md)
//     temperature · humidite · altitude · lumiere · couvert, de 0 à 1 ; food : la richesse du sol, telle que le jeu la donne
const BIOMES_SV = {
  1:  { id: 'rivage', u: 'cote',    nom: 'Rivage',             milieu: 'amphibie', axes: { temperature: .55, humidite: .6,  altitude: .05, lumiere: .9,  couvert: .1  }, food: .12, voisins: [2] },
  2:  { id: 'prairie', u: 'prairie',   nom: 'Prairie',            milieu: 'terrestre', axes: { temperature: .55, humidite: .5,  altitude: .2,  lumiere: .9,  couvert: .3  }, food: 1,   voisins: [1, 3, 4, 9, 23] },
  3:  { id: 'bois', u: 'foret',      nom: 'Bois',               milieu: 'terrestre', axes: { temperature: .5,  humidite: .6,  altitude: .3,  lumiere: .4,  couvert: .9  }, food: .82, voisins: [2, 4, 9, 11, 23] },
  4:  { id: 'lande', u: 'steppe',     nom: 'Lande',              milieu: 'terrestre', axes: { temperature: .5,  humidite: .3,  altitude: .4,  lumiere: .8,  couvert: .3  }, food: .38, voisins: [2, 3, 5, 10, 12, 19] },
  5:  { id: 'falaise', u: 'montagne',   nom: 'Falaise',            milieu: 'terrestre', axes: { temperature: .45, humidite: .3,  altitude: .7,  lumiere: .8,  couvert: .1  }, food: .05, voisins: [4, 6] },
  6:  { id: 'pierre', u: 'desert-froid',    nom: 'Pierre',             milieu: 'terrestre', axes: { temperature: .4,  humidite: .2,  altitude: .75, lumiere: .8,  couvert: .05 }, food: .08, voisins: [5, 7, 10, 12, 13] },
  7:  { id: 'neige', u: 'sommets',     nom: 'Neige',              milieu: 'terrestre', axes: { temperature: .1,  humidite: .4,  altitude: .9,  lumiere: .9,  couvert: .05 }, food: .03, voisins: [6] },
  9:  { id: 'tourbiere', u: 'marais', nom: 'Tourbière',          milieu: 'amphibie', axes: { temperature: .5,  humidite: .95, altitude: .1,  lumiere: .6,  couvert: .5  }, food: .9,  voisins: [2, 3] },
  10: { id: 'canyon', u: 'desert',    nom: 'Canyon d\'ocre',     milieu: 'terrestre', axes: { temperature: .85, humidite: .1,  altitude: .4,  lumiere: 1,   couvert: .1  }, food: .22, voisins: [4, 6] },
  11: { id: 'sylve', u: 'jungle',     nom: 'Sylve fongique',     milieu: 'terrestre', axes: { temperature: .55, humidite: .8,  altitude: .3,  lumiere: .2,  couvert: .95 }, food: .55, voisins: [3] },
  12: { id: 'cristal', u: 'montagne',   nom: 'Champs de cristal',  milieu: 'terrestre', axes: { temperature: .4,  humidite: .3,  altitude: .6,  lumiere: .9,  couvert: .2  }, food: .12, voisins: [4, 6] },
  13: { id: 'caldeira', u: 'volcan',  nom: 'Caldeira de cendre', milieu: 'terrestre', axes: { temperature: .95, humidite: .1,  altitude: .5,  lumiere: .7,  couvert: .05 }, food: .04, voisins: [6, 14] },
  14: { id: 'braises', u: 'volcan',   nom: 'Braises',            milieu: 'terrestre', axes: { temperature: 1,   humidite: .05, altitude: .5,  lumiere: .7,  couvert: 0   }, food: .02, voisins: [13] },
  19: { id: 'ossuaire', u: 'savane',  nom: 'Ossuaire',           milieu: 'terrestre', axes: { temperature: .5,  humidite: .3,  altitude: .35, lumiere: .7,  couvert: .1  }, food: .08, voisins: [4, 20] },
  20: { id: 'terres-creuses', u: 'grotte', nom: 'Terres creuses', milieu: 'terrestre', axes: { temperature: .4, humidite: .5,  altitude: .2,  lumiere: .2,  couvert: .3  }, food: .15, voisins: [19] },
  23: { id: 'cerisaie', u: 'maquis',  nom: 'Cerisaie',           milieu: 'terrestre', axes: { temperature: .6,  humidite: .6,  altitude: .25, lumiere: .85, couvert: .7  }, food: .7,  voisins: [2, 3] },
};
// la carte suit le monde : celui dont les biomes ressemblent le plus aux « id » ou aux « u » (choisirCarte, à chaque instantané)
let CARTE = 'id';
function choisirCarte(ids) {
  const I = new Set(Object.values(BIOMES_SV).map(b => b.id)), U = new Set(Object.values(BIOMES_SV).map(b => b.u)), L = [...(ids || [])];
  CARTE = L.filter(x => U.has(x) && !I.has(x)).length > L.filter(x => I.has(x) && !U.has(x)).length ? 'u' : 'id'; return CARTE;
}
const biomeOrvane = k => BIOMES_SV[k]?.[CARTE] || null;                              // index du jeu → id Orvane
const biomesSV = id => Object.keys(BIOMES_SV).filter(k => BIOMES_SV[k][CARTE] === id).map(Number);   // id Orvane → index du jeu (plusieurs dans le monde d'Orvane)
const biomeSV = id => biomesSV(id)[0] || null;

// --- taxon Orvane → espèce du jeu (sp.id). Par défaut, le même identifiant. Une lignée inconnue du jeu
//     (« crapaud.tourbiere ») est rendue par l'espèce de son parent : le jeu n'a pas de nouveau corps à lui donner.
const TAXON_ESPECE = {};   // ex. { 'crapaud-buffle': 'crapaud' } si le monde Orvane nomme les taxons autrement que le jeu
function especeDe(taxonId, taxons) {
  let id = taxonId; const vus = new Set();
  while (id && !vus.has(id)) { vus.add(id); if (TAXON_ESPECE[id]) return TAXON_ESPECE[id]; if (taxons?.has?.(id) || taxons?.includes?.(id)) return id; const t = taxons instanceof Map ? taxons.get(id) : null; id = t ? t.parent : id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : null; }
  return null;
}
function taxonDe(spId, instantane) {   // espèce du jeu → taxon racine (celui qui n'a pas de parent, ou mappé explicitement)
  for (const k in TAXON_ESPECE) if (TAXON_ESPECE[k] === spId) return k;
  return instantane?.taxons.some(t => t.id === spId) ? spId : null;
}

// --- traits Orvane → pièces de variante du jeu (robe | taille-ornement). Un trait absent d'ici n'est pas rendu.
const TRAIT_VARIANTE = {
  albinisme: { robe: 'albinos' }, melanisme: { robe: 'melanique' }, 'robe-doree': { robe: 'dore' },
  gigantisme: { taille: 'geant' }, nanisme: { taille: 'nain' },
};
// l'ornement par famille (le jeu en tire un quand une forme rare naît ; ORNEMENTS_DE dans index.html)
const ORNEMENT_DE = { coursier: 'crete', trottin: 'crete', automate: 'antennes' };
function varianteDe(traits, famille, r = Math.random, ornements) {   // ornements : ORNEMENTS_DE[famille] du jeu, s'il est là
  let robe = null, taille = null;
  for (const t of traits) { const v = TRAIT_VARIANTE[t]; if (!v) continue; if (v.robe) robe = v.robe; if (v.taille) taille = v.taille; }
  const parts = []; if (robe) parts.push(robe);
  if (taille) { const orn = ornements && ornements.length ? ornements[r() * ornements.length | 0] : ORNEMENT_DE[famille] || (r() < .5 ? 'cornes' : 'epines'); parts.push(taille + '-' + orn); }
  return parts.length ? parts.join('|') : null;
}
// l'inverse : une variante du jeu → les traits Orvane qu'elle porte (pour reconnaître le phénotype d'une bête)
function traitsDe(variante) {
  if (!variante) return [];
  const out = []; for (const p of variante.split('|')) { const [a] = p.split('-');
    for (const t in TRAIT_VARIANTE) { const v = TRAIT_VARIANTE[t]; if (v.robe === a || v.taille === a) out.push(t); } }
  return out;
}

// --- le corps des espèces du jeu, décrit pour Orvane (moteur/corps.js) : ce dont héritent leurs lignées ---
//     Les espèces du jeu ont chacune leur dessin ; ce corps-ci n'est pas fait pour les redessiner, mais pour que leurs
//     lignées partent d'une silhouette qui leur ressemble. La forme vient de la famille, les couleurs de la fiche du jeu.
const CORPS_FAMILLE = {
  rampant:   { forme: 'hexapode', long: .5, haut: .3, cou: 0, tete: .45, museau: .3, oreilles: 0, queue: .1, carapace: .6, antennes: .3 },
  coursier:  { forme: 'bipede', long: .4, haut: .85, cou: .75, tete: .4, museau: .5, oreilles: 0, queue: .35, crete: .3 },
  trottin:   { forme: 'bipede', long: .35, haut: .6, cou: .3, tete: .55, museau: .3, oreilles: .3, queue: .3 },
  doux:      { forme: 'quadrupede', long: .5, haut: .45, cou: .3, tete: .4, museau: .3, oreilles: .4, queue: .2 },
  tellurien: { forme: 'quadrupede', long: .5, haut: .3, cou: .2, tete: .5, museau: .4, oreilles: .1, queue: .4 },
  propre:    { forme: 'quadrupede', long: .5, haut: .45, cou: .3, tete: .45, museau: .4, oreilles: .3, queue: .4 },   // une bête qui a son propre dessin (félin, bramard, sterne…)
};
const CORPS_ESPECE = {
  bosseu: { carapace: .8, long: .45, haut: .35 }, traqueur: { museau: .5, haut: .4 }, spectre: { antennes: .5, haut: .45 },
  coursier_a: { crete: .6 },
  crapaud: { long: .3, haut: .2, cou: 0, tete: .7, museau: .2, queue: 0, motif: 'taches' },
  varan: { long: .8, haut: .18, cou: .25, tete: .45, museau: .6, queue: .85, motif: 'bandes' },
  salamandre: { long: .8, haut: .15, cou: .15, tete: .45, museau: .4, queue: .8, crete: .2, motif: 'taches' },
  vesseron: { forme: 'bipede', long: .3, haut: .3, cou: 0, tete: .9, museau: 0, queue: 0, crete: .7 },
  cerf: { long: .5, haut: .8, cou: .6, tete: .4, museau: .5, oreilles: .45, queue: .15, cornes: .9 },
  sika: { long: .5, haut: .8, cou: .6, tete: .4, museau: .5, oreilles: .5, queue: .15, cornes: .8, motif: 'taches' },
  lentigrade: { long: .6, haut: .35, cou: .35, museau: .35, oreilles: .2, carapace: .85 },
  lentisakura: { long: .6, haut: .35, cou: .35, museau: .35, oreilles: .2, carapace: .85 },
  cotonnier: { long: .45, oreilles: .45, cou: .25 },
  carillonneur: { haut: .75, cou: .5, cornes: .8 },
  oglodon: { long: .6, haut: .35, museau: .9, queue: .5, oreilles: .2 },
  felin: { forme: 'quadrupede', long: .6, haut: .5, cou: .3, tete: .45, museau: .35, oreilles: .55, queue: .7, motif: 'rayures' },
  renard: { forme: 'quadrupede', long: .55, haut: .45, cou: .3, tete: .45, museau: .6, oreilles: .8, queue: .9 },
  bramard: { forme: 'quadrupede', long: .6, haut: .65, cou: .4, tete: .5, museau: .5, oreilles: .3, queue: .2, cornes: .8, crete: .4, carapace: .3 },
  sterne: { forme: 'oiseau', long: .45, haut: .25, cou: .35, tete: .4, museau: .55, oreilles: 0, queue: .5, ailes: 1 },
  dragon: { forme: 'quadrupede', long: .95, haut: .25, cou: .6, tete: .5, museau: .55, oreilles: 0, queue: 1, ailes: .95, crete: .6 },
  trottin_menu: { long: .6, haut: .4, museau: .5, queue: .6 }, trottin_echasse: { haut: .95, cou: .45 }, trottin_pataud: { haut: .35, long: .45, tete: .6 },
  trottin_bondeur: { haut: .5, oreilles: .5 }, trottin_huppe: { crete: .7 },
};
const famille = s => s.fam === 'coursier' || s.fam === 'trottin' || s.fam === 'doux' || s.fam === 'tellurien' ? s.fam : s.corps ? 'propre' : 'rampant';
const clair = (c, k) => c.map(v => Math.round(v + (255 - v) * k));
// le corps d'une fiche du jeu (s : un objet de SPEC) ; normalisé par moteur/corps.js quand il est là
function corpsDe(s) {
  const c = Object.assign({}, CORPS_FAMILLE[famille(s)], CORPS_ESPECE[s.id] || {});
  if (s.volant && !c.ailes) { c.ailes = .9; c.forme = 'oiseau'; }
  c.couleurs = { robe: (s.shell || [150, 130, 100]).slice(), sombre: (s.dark || [100, 86, 66]).slice(), ventre: (s.ventre || clair(s.shell || [150, 130, 100], .35)).slice(), oeil: (s.oeil || [40, 34, 30]).slice() };
  const N = typeof require === 'function' ? (() => { try { return require('../../moteur/corps.js'); } catch (e) { return null; } })() : racine.OrvaneCorps;
  return N ? N.normaliser(c) : c;
}
// --- une lignée sans ancêtre dans le jeu (un monde né de la genèse) : quelle fiche du jeu lui prête sa conduite ---
//     Le corps, lui, est construit (lignees.js) ; la fiche ne donne que le comportement : brouter, glaner, chasser.
const GABARITS = { herbivore: 'brouteur', omnivore: 'glaneur', carnivore: 'traqueur', filtreur: 'glaneur', detritivore: 'glaneur' };
// (§217) un herbivore paisible (tempérament sous 0,4) se conduit comme un Doux, le cotonnier : c'est d'eux que sont faites
// les premières îles, et le jeu n'y met que des Doux
const gabaritDe = plan => plan?.regime === 'herbivore' && (plan.temperament ?? .5) < .4 ? 'cotonnier' : GABARITS[plan?.regime] || 'glaneur';
// la faune du jeu qu'Orvane simule (sa génération 0) et son régime. Dans un monde dont le bestiaire est celui d'Orvane
// (profil.exposition.bestiaire = 'orvane', un monde né de la genèse), ces trente espèces cèdent leur place aux lignées
// du monde, régime par régime ; les automates, les boss, les villageois ne changent pas.
const FAUNE = { brouteur: 'herbivore', bosseu: 'herbivore', glaneur: 'omnivore', traqueur: 'carnivore', spectre: 'carnivore', coursier: 'herbivore',
  coursier_o: 'herbivore', coursier_r: 'herbivore', coursier_a: 'herbivore', crapaud: 'omnivore', varan: 'omnivore', vesseron: 'herbivore', cerf: 'herbivore',
  salamandre: 'omnivore', lentigrade: 'herbivore', cotonnier: 'herbivore', carillonneur: 'herbivore', oglodon: 'herbivore', felin: 'carnivore', bramard: 'herbivore',
  sterne: 'omnivore', dragon: 'carnivore', sika: 'herbivore', renard: 'herbivore', lentisakura: 'herbivore', trottin_menu: 'herbivore', trottin_echasse: 'herbivore',
  trottin_pataud: 'herbivore', trottin_bondeur: 'herbivore', trottin_huppe: 'herbivore' };
const GROUPE = { herbivore: 'herbivore', carnivore: 'carnivore', omnivore: 'omnivore', filtreur: 'omnivore', detritivore: 'omnivore' };   // les trois parts d'une île

// --- les conduites (§211) : le vocabulaire d'Orvane (catalogue, conduite.type) → ce que Stone Valley sait jouer (conduites.js) ---
//     Un trait nouveau dans Orvane, d'un type déjà connu ici, agit dans le jeu sans rien changer : c'est le TYPE qui compte.
const CONDUITE_JEU = {
  'riposte-distance': 'crachat', 'riposte-contact': 'dard', 'defense-contact': 'glande', 'repli': 'carapace', 'protection': 'cuir',
  'immobilite': 'camouflage', 'alerte-groupe': 'alerte', 'defense-petits': 'parent', 'vision-nocturne': 'nyctalope',
  'perception-proche': 'vibrisses', 'vue-diurne-faible': 'ebloui', 'morsure': 'crocs', 'sprint': 'foulee', 'lenteur': 'lent', 'charge': 'charge',
};
// un mode de déplacement de la lignée qui devient une conduite
const LOCOMOTION_CONDUITE = { fouissage: 'terrier' };
// les conduites d'une bête : ses traits (ceux de son phénotype), lus dans le catalogue du monde ; les modes de déplacement
// de sa lignée ; et les organes de son corps (moteur/corps.js, ORGANES_CAT : une massue fait charger, un aiguillon pique,
// des plaques amortissent les coups) — plus l'organe est grand, plus la conduite est forte. → [{ id, trait|locomotion|organe,
// effet, portee, recharge, force, presage, nom }]. Le catalogue des organes se lit dans l'instantané (catalogue.organes),
// à défaut dans moteur/corps.js.
function conduitesDe(traits, catalogue, locomotion, organes, catOrganes) {
  const out = [], vus = new Set();
  for (const t of traits || []) { const c = catalogue?.[t]?.conduite, id = c && CONDUITE_JEU[c.type]; if (!id || vus.has(id)) continue; vus.add(id);
    out.push({ id, trait: t, effet: c.effet, portee: c.portee, recharge: c.recharge, force: c.force, presage: c.presage }); }
  for (const l of locomotion || []) { const id = LOCOMOTION_CONDUITE[l]; if (id && !vus.has(id)) { vus.add(id); out.push({ id, locomotion: l }); } }
  const OC = catOrganes || (typeof require === 'function' ? (() => { try { return require('../../moteur/corps.js'); } catch (e) { return null; } })() : racine.OrvaneCorps)?.ORGANES_CAT || {};
  for (const o of (organes || []).slice().sort((a, b) => b.taille - a.taille)) { const c = OC[o.type]?.conduite, id = c && CONDUITE_JEU[c.type]; if (!id || vus.has(id) || !(o.taille >= .3)) continue; vus.add(id);
    out.push({ id, organe: o.type, effet: c.effet, force: c.force ? +(1 + (c.force - 1) * Math.min(1.5, o.taille / .6)).toFixed(2) : undefined, presage: c.presage, nom: c.nom }); }
  return out;
}

// --- les traits continus (docs/8) : ce que vaut, sur une bête du jeu, l'écart montré s (en écarts-types naturels) ---
//     taille → b.tq (× la taille), vitesse → b.vq (× l'allure), audace → b.fq (× la distance de fuite : l'audacieuse fuit
//     plus tard). Les mots, pour le panneau de la bête désignée ; « ici » : la population de l'île s'est déplacée.
const QUANT_JEU = {
  taille:  { cle: 'tq', vaut: (s, d) => Math.exp((d?.echelle ?? .05) * s), haut: 'de grande taille', bas: 'de petite taille', ici: ['l\'espèce a grandi ici', 'l\'espèce a rapetissé ici'] },
  vitesse: { cle: 'vq', vaut: (s, d) => Math.exp((d?.echelle ?? .07) * s), haut: 'allure vive', bas: 'allure lente', ici: ['l\'espèce est plus vive ici', 'l\'espèce est plus lente ici'] },
  audace:  { cle: 'fq', vaut: s => Math.exp(-.2 * s), haut: 'peu farouche', bas: 'très farouche', ici: ['l\'espèce est moins farouche ici', 'l\'espèce est plus farouche ici'] }
};

// ce que Stone Valley sait montrer du monde d'Orvane (schemas/profil.schema.json, exposition) : le tampon lit les lots du jeu
// avec la même, enregistrée dans le Supabase d'Orvane (orvane_regler_jeu) et publiée dans jeux.json ; celle-ci ne sert que
// tant que jeux.json n'est pas arrivé. Les deux doivent rester d'accord (la changer ici, c'est la régler là-bas aussi).
const EXPOSITION = { mode: 'relatif', compression: { defaut: .1, par_domaine: { morphologie: .1 }, par_trait: { gigantisme: .1, nanisme: .1 } },
  taux_jeu: { albinisme: .0002924, melanisme: .0002924, 'robe-doree': .0002924, gigantisme: 3.333e-5, nanisme: 2.222e-5 }, reference_min: .01,
  propagation_cycles: 3, inertie_max: .05, traits_rendus: ['albinisme', 'melanisme', 'robe-doree', 'gigantisme', 'nanisme'],
  seuil_extinction_jeu: 40, retour_apres_extinction: true, seuil_extinction_part: .25, quantitatifs: { rendus: ['taille', 'vitesse', 'audace'], variation: 0 }, bestiaire: 'orvane' };
const API = { EXPOSITION, BIOMES_SV, choisirCarte, biomeOrvane, biomeSV, biomesSV, TAXON_ESPECE, especeDe, taxonDe, TRAIT_VARIANTE, varianteDe, traitsDe, CORPS_FAMILLE, CORPS_ESPECE, corpsDe, GABARITS, gabaritDe,
  CONDUITE_JEU, LOCOMOTION_CONDUITE, conduitesDe, QUANT_JEU, FAUNE, GROUPE };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.OrvaneSV_Corr = API;
})(globalThis);
