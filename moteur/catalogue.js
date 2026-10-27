// Orvane — LE CATALOGUE DES TRAITS (moteur/catalogue.js)
// L'univers de ce qu'une lignée peut acquérir. Un trait n'est jamais une statistique de jeu : c'est un organe,
// un coût énergétique, un effet biologique, parfois une conduite imposée et des matières laissées au corps.
//  - cout    : surcoût relatif sur la reproduction (0.15 = ce phénotype fait 15 % de petits en moins)
//  - ecarts  : multiplicateurs sur le plan corporel (masse_kg, taille_m, longevite, maturite, portee, vitesse_rel…)
//  - fixe    : valeurs imposées au plan (activite, regime)
//  - exige / exclut : cohérence des combinaisons (pas de jet sans glande, pas de géant nain)
//  - fournit : ce que l'organe laisse derrière lui, pour les traducteurs (récolte, objets)
(function (racine) {
'use strict';
const TRAITS = {
  // --- morphologie ---
  'gigantisme':     { domaine: 'morphologie', organe: 'squelette et masse musculaire', cout: .25,
                      effet: 'masse ×1.8, taille ×1.3 ; plus lent, mûrit plus tard', exclut: ['nanisme'],
                      ecarts: { masse_kg: 1.8, taille_m: 1.3, vitesse_rel: .8, maturite: 1.4, longevite: 1.15 } },
  'nanisme':        { domaine: 'morphologie', organe: 'squelette réduit', cout: .04,
                      effet: 'masse ×0.45, taille ×0.75 ; mûrit plus tôt, vit moins longtemps', exclut: ['gigantisme'],
                      ecarts: { masse_kg: .45, taille_m: .75, maturite: .7, longevite: .8, portee: .85 } },
  'queue-prehensile': { domaine: 'morphologie', organe: 'queue musclée et préhensile', cout: .06,
                      effet: 'saisit, grimpe, se suspend', ecarts: { vitesse_rel: .95 } },
  // --- pigmentation (les robes) ---
  'albinisme':      { domaine: 'morphologie', organe: 'mélanocytes inactifs', cout: .04,
                      effet: 'robe blanche, yeux clairs ; voit moins bien en plein jour', exclut: ['melanisme', 'robe-doree'], ecarts: { perception: .9 } },
  'melanisme':      { domaine: 'morphologie', organe: 'mélanocytes hyperactifs', cout: .01,
                      effet: 'robe noire ; se réchauffe plus vite', exclut: ['albinisme', 'robe-doree'] },
  'robe-doree':     { domaine: 'morphologie', organe: 'pigments caroténoïdes', cout: .03,
                      effet: 'robe dorée, voyante', exclut: ['albinisme', 'melanisme'], ecarts: { temperament: 1.1 } },
  // --- locomotion ---
  'pattes-longues': { domaine: 'locomotion', organe: 'membres postérieurs allongés', cout: .07,
                      effet: 'vitesse de pointe ×1.3', ecarts: { vitesse_rel: 1.3 } },
  'palmes':         { domaine: 'locomotion', organe: 'membranes interdigitales', cout: .03,
                      effet: 'nage ×1.4, marche un peu gênée', ecarts: { vitesse_rel: 1.05 } },
  'membrane-planante': { domaine: 'locomotion', organe: 'repli de peau entre les membres', cout: .12,
                      effet: 'plane depuis une hauteur sur plusieurs longueurs de corps', exclut: ['gigantisme'] },
  // --- sens ---
  'yeux-nocturnes': { domaine: 'sens', organe: 'rétine riche en bâtonnets, tapetum', cout: .04,
                      effet: 'voit dans la pénombre ; actif la nuit', ecarts: { perception: 1.3 }, fixe: { activite: 'nocturne' } },
  'vibrisses':      { domaine: 'sens', organe: 'poils tactiles', cout: .02,
                      effet: 'sent les mouvements d\'air et d\'eau proches', ecarts: { perception: 1.15 } },
  // --- offense ---
  'glande-irritante': { domaine: 'offense', organe: 'glande parotoïde hypertrophiée', cout: .08,
                      effet: 'sécrète une substance irritante sur la peau', fournit: ['secretion-irritante'] },
  'jet-glandulaire': { domaine: 'offense', organe: 'canal éjecteur sous la glande', cout: .07,
                      effet: 'projette la sécrétion à 3 longueurs de corps', exige: ['glande-irritante'],
                      comportement: 'embuscade ; riposte à distance avant la fuite', ecarts: { temperament: 1.6 } },
  'crocs-allonges': { domaine: 'offense', organe: 'canines ou crochets allongés', cout: .06,
                      effet: 'morsure profonde', ecarts: { temperament: 1.25 }, fournit: ['croc'] },
  'dard':           { domaine: 'offense', organe: 'aiguillon relié à une glande', cout: .09,
                      effet: 'piqûre venimeuse de contact', exige: ['glande-irritante'], fournit: ['dard'] },
  // --- défense ---
  'peau-epaisse':   { domaine: 'defense', organe: 'derme kératinisé', cout: .05,
                      effet: 'résiste aux morsures et aux chocs légers', fournit: ['cuir'] },
  'carapace':       { domaine: 'defense', organe: 'plaques osseuses dermiques', cout: .18,
                      effet: 'protège le dos et les flancs ; ralentit', exige: ['peau-epaisse'], exclut: ['membrane-planante'],
                      ecarts: { vitesse_rel: .85, masse_kg: 1.2 }, fournit: ['plaque-osseuse'] },
  'camouflage':     { domaine: 'defense', organe: 'chromatophores', cout: .03,
                      effet: 'se confond avec le sol de son biome ; fuit plutôt que de riposter', ecarts: { temperament: .7 } },
  'coloration-aposematique': { domaine: 'defense', organe: 'pigments vifs', cout: .02,
                      effet: 'annonce sa toxicité ; dissuade', exige: ['glande-irritante'], exclut: ['camouflage'], ecarts: { temperament: 1.2 } },
  // --- métabolisme ---
  'metabolisme-lent': { domaine: 'metabolisme', organe: 'thyroïde peu active', cout: .0,
                      effet: 'vit plus longtemps, bouge moins, mûrit plus tard', ecarts: { longevite: 1.35, vitesse_rel: .85, maturite: 1.2 } },
  'estomac-large':  { domaine: 'metabolisme', organe: 'tube digestif allongé', cout: .05,
                      effet: 'digère végétaux et proies', fixe: { regime: 'omnivore' } },
  // --- reproduction ---
  'ponte-abondante': { domaine: 'reproduction', organe: 'gonades hypertrophiées', cout: .10,
                      effet: 'portée ×1.5, petits plus fragiles', ecarts: { portee: 1.5, longevite: .9 } },
  'soins-parentaux': { domaine: 'reproduction', organe: 'poche ou nid, comportement', cout: .08,
                      effet: 'moins de petits, mieux protégés', ecarts: { portee: .6, maturite: .9 }, comportement: 'défend les jeunes' },
  // --- social / activité ---
  'gregarisme':     { domaine: 'social', organe: 'signaux d\'appel, glandes odorantes', cout: .02,
                      effet: 'vit en groupe ; alerte collective', ecarts: { sociabilite: 1.8, perception: 1.1 } },
  'crepuscularite': { domaine: 'activite', organe: 'horloge interne décalée', cout: .0,
                      effet: 'actif à l\'aube et au crépuscule', fixe: { activite: 'crepusculaire' } }
};
// Un trait peut-il s'ajouter à cette liste de traits ?
function admissible(id, traits) {
  const t = TRAITS[id]; if (!t || traits.includes(id)) return false;
  if ((t.exige || []).some(x => !traits.includes(x))) return false;
  if ((t.exclut || []).some(x => traits.includes(x))) return false;
  return !traits.some(x => (TRAITS[x]?.exclut || []).includes(id));
}
const API = { TRAITS, admissible };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.OrvaneCatalogue = API;
})(globalThis);
