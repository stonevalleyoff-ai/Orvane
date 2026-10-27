// Orvane × Stone Valley — LES TABLES DE CORRESPONDANCE (correspondance.js)
// Tout ce que le traducteur sait du jeu et qu'Orvane ignore : quel biome du jeu est quel biome Orvane, quelle
// espèce est quel taxon, quel trait devient quelle variante. Node (require) ou navigateur (globalThis.OrvaneSV_Corr).
(function (racine) {
'use strict';
// --- les biomes du jeu (index dans BIOME de index.html) décrits sur les cinq axes d'Orvane ---
//     temperature · humidite · altitude · lumiere · couvert, de 0 à 1 ; food : la richesse du sol, telle que le jeu la donne
const BIOMES_SV = {
  1:  { id: 'rivage',    nom: 'Rivage',             milieu: 'amphibie', axes: { temperature: .55, humidite: .6,  altitude: .05, lumiere: .9,  couvert: .1  }, food: .12, voisins: [2] },
  2:  { id: 'prairie',   nom: 'Prairie',            milieu: 'terrestre', axes: { temperature: .55, humidite: .5,  altitude: .2,  lumiere: .9,  couvert: .3  }, food: 1,   voisins: [1, 3, 4, 9, 23] },
  3:  { id: 'bois',      nom: 'Bois',               milieu: 'terrestre', axes: { temperature: .5,  humidite: .6,  altitude: .3,  lumiere: .4,  couvert: .9  }, food: .82, voisins: [2, 4, 9, 11, 23] },
  4:  { id: 'lande',     nom: 'Lande',              milieu: 'terrestre', axes: { temperature: .5,  humidite: .3,  altitude: .4,  lumiere: .8,  couvert: .3  }, food: .38, voisins: [2, 3, 5, 10, 12, 19] },
  5:  { id: 'falaise',   nom: 'Falaise',            milieu: 'terrestre', axes: { temperature: .45, humidite: .3,  altitude: .7,  lumiere: .8,  couvert: .1  }, food: .05, voisins: [4, 6] },
  6:  { id: 'pierre',    nom: 'Pierre',             milieu: 'terrestre', axes: { temperature: .4,  humidite: .2,  altitude: .75, lumiere: .8,  couvert: .05 }, food: .08, voisins: [5, 7, 10, 12, 13] },
  7:  { id: 'neige',     nom: 'Neige',              milieu: 'terrestre', axes: { temperature: .1,  humidite: .4,  altitude: .9,  lumiere: .9,  couvert: .05 }, food: .03, voisins: [6] },
  9:  { id: 'tourbiere', nom: 'Tourbière',          milieu: 'amphibie', axes: { temperature: .5,  humidite: .95, altitude: .1,  lumiere: .6,  couvert: .5  }, food: .9,  voisins: [2, 3] },
  10: { id: 'canyon',    nom: 'Canyon d\'ocre',     milieu: 'terrestre', axes: { temperature: .85, humidite: .1,  altitude: .4,  lumiere: 1,   couvert: .1  }, food: .22, voisins: [4, 6] },
  11: { id: 'sylve',     nom: 'Sylve fongique',     milieu: 'terrestre', axes: { temperature: .55, humidite: .8,  altitude: .3,  lumiere: .2,  couvert: .95 }, food: .55, voisins: [3] },
  12: { id: 'cristal',   nom: 'Champs de cristal',  milieu: 'terrestre', axes: { temperature: .4,  humidite: .3,  altitude: .6,  lumiere: .9,  couvert: .2  }, food: .12, voisins: [4, 6] },
  13: { id: 'caldeira',  nom: 'Caldeira de cendre', milieu: 'terrestre', axes: { temperature: .95, humidite: .1,  altitude: .5,  lumiere: .7,  couvert: .05 }, food: .04, voisins: [6, 14] },
  14: { id: 'braises',   nom: 'Braises',            milieu: 'terrestre', axes: { temperature: 1,   humidite: .05, altitude: .5,  lumiere: .7,  couvert: 0   }, food: .02, voisins: [13] },
  19: { id: 'ossuaire',  nom: 'Ossuaire',           milieu: 'terrestre', axes: { temperature: .5,  humidite: .3,  altitude: .35, lumiere: .7,  couvert: .1  }, food: .08, voisins: [4, 20] },
  20: { id: 'terres-creuses', nom: 'Terres creuses', milieu: 'terrestre', axes: { temperature: .4, humidite: .5,  altitude: .2,  lumiere: .2,  couvert: .3  }, food: .15, voisins: [19] },
  23: { id: 'cerisaie',  nom: 'Cerisaie',           milieu: 'terrestre', axes: { temperature: .6,  humidite: .6,  altitude: .25, lumiere: .85, couvert: .7  }, food: .7,  voisins: [2, 3] },
};
const biomeOrvane = k => BIOMES_SV[k]?.id || null;                                   // index du jeu → id Orvane
const biomeSV = id => +Object.keys(BIOMES_SV).find(k => BIOMES_SV[k].id === id) || null;   // id Orvane → index du jeu

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
function varianteDe(traits, famille, r = Math.random) {
  let robe = null, taille = null;
  for (const t of traits) { const v = TRAIT_VARIANTE[t]; if (!v) continue; if (v.robe) robe = v.robe; if (v.taille) taille = v.taille; }
  const parts = []; if (robe) parts.push(robe);
  if (taille) { const orn = ORNEMENT_DE[famille] || (r() < .5 ? 'cornes' : 'epines'); parts.push(taille + '-' + orn); }
  return parts.length ? parts.join('|') : null;
}
// l'inverse : une variante du jeu → les traits Orvane qu'elle porte (pour reconnaître le phénotype d'une bête)
function traitsDe(variante) {
  if (!variante) return [];
  const out = []; for (const p of variante.split('|')) { const [a] = p.split('-');
    for (const t in TRAIT_VARIANTE) { const v = TRAIT_VARIANTE[t]; if (v.robe === a || v.taille === a) out.push(t); } }
  return out;
}

const API = { BIOMES_SV, biomeOrvane, biomeSV, TAXON_ESPECE, especeDe, taxonDe, TRAIT_VARIANTE, varianteDe, traitsDe };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.OrvaneSV_Corr = API;
})(globalThis);
