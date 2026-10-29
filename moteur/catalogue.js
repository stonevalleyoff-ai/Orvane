// Orvane — LE CATALOGUE DES TRAITS (moteur/catalogue.js)
// L'univers de ce qu'une lignée peut acquérir. Un trait n'est jamais une statistique de jeu : c'est un organe,
// un coût énergétique, un effet biologique, parfois une conduite imposée et des matières laissées au corps.
//  - cout    : surcoût relatif sur la reproduction (0.15 = ce phénotype fait 15 % de petits en moins)
//  - ecarts  : multiplicateurs sur le plan corporel (masse_kg, taille_m, longevite, maturite, portee, vitesse_rel…)
//  - fixe    : valeurs imposées au plan (activite, regime)
//  - exige / exclut : cohérence des combinaisons (pas de jet sans glande, pas de géant nain)
//  - fournit : ce que l'organe laisse derrière lui, pour les traducteurs (récolte, objets)
//  - vulnerabilite / chasse : multiplicateurs dans la chaîne alimentaire (être mangé / manger), 1 = neutre
//  - resistance : multiplicateur de la mortalité par maladie (0.85 résiste, 1.25 : le groupe propage), 1 = neutre
//  - conduite : ce que l'organe fait FAIRE à la bête, dans un vocabulaire abstrait que chaque jeu traduit à sa façon
//    (docs/7-conduites.md) : riposte-distance, riposte-contact, defense-contact, repli, protection, immobilite,
//    alerte-groupe, defense-petits, vol-plane, vision-nocturne, perception-proche, morsure, sprint, lenteur…
//    effet (irritant, venin, dissimulation), portee (en longueurs de corps), recharge (secondes), force (multiplicateur),
//    presage : ce qu'un joueur attentif voit AVANT que la conduite ne se déclenche — pour qu'il apprenne à lire la bête
//  - heredite : 'dominant' (par défaut : une copie suffit à le montrer) ou 'recessif' (il faut deux copies : deux parents
//    qui ne le montrent pas peuvent le transmettre — docs/9-reproduction.md)
//  - attrait : ce qu'il pèse dans le choix du partenaire (1,6 : un porteur a 60 % de chances en plus d'être choisi pour
//    père) ; une robe voyante attire les partenaires et les prédateurs à la fois
//  L'ordre du catalogue décide qui masque qui (épistasie) : l'albinisme, avant les autres robes, les efface.
(function (racine) {
'use strict';
const TRAITS = {
  // --- morphologie ---
  'gigantisme':     { domaine: 'morphologie', organe: 'squelette et masse musculaire', cout: .25,
                      effet: 'masse ×1.8, taille ×1.3 ; plus lent, mûrit plus tard', exclut: ['nanisme'],
                      ecarts: { masse_kg: 1.8, taille_m: 1.3, vitesse_rel: .8, maturite: 1.4, longevite: 1.15, resistance: 0.95 }, vulnerabilite: 0.85, chasse: 1.1, attrait: 1.3 },
  'nanisme':        { domaine: 'morphologie', organe: 'squelette réduit', cout: .04,
                      effet: 'masse ×0.45, taille ×0.75 ; mûrit plus tôt, vit moins longtemps', exclut: ['gigantisme'],
                      ecarts: { masse_kg: .45, taille_m: .75, maturite: .7, longevite: .8, portee: .85, resistance: 1.1 }, vulnerabilite: 1.15, chasse: 0.9, heredite: 'recessif', attrait: .8 },
  'queue-prehensile': { domaine: 'morphologie', organe: 'queue musclée et préhensile', cout: .06,
                      effet: 'saisit, grimpe, se suspend', ecarts: { vitesse_rel: .95 }, vulnerabilite: 0.9 ,
                      conduite: { type: 'escalade', presage: 'la queue enroulée à une prise' } },
  // --- pigmentation (les robes) ---
  'albinisme':      { domaine: 'morphologie', organe: 'mélanocytes inactifs', cout: .04,
                      effet: 'robe blanche, yeux clairs ; voit moins bien en plein jour', exclut: ['melanisme', 'robe-doree'], ecarts: { perception: .9, resistance: 1.1 }, vulnerabilite: 1.15, heredite: 'recessif', attrait: .85,
                      conduite: { type: 'vue-diurne-faible', presage: 'plisse les yeux au grand jour' } },
  'melanisme':      { domaine: 'morphologie', organe: 'mélanocytes hyperactifs', cout: .01,
                      effet: 'robe noire ; se réchauffe plus vite', exclut: ['albinisme', 'robe-doree'], vulnerabilite: 0.95 },
  'robe-doree':     { domaine: 'morphologie', organe: 'pigments caroténoïdes', cout: .03,
                      effet: 'robe dorée, voyante ; attire les partenaires', exclut: ['albinisme', 'melanisme'], ecarts: { temperament: 1.1 }, vulnerabilite: 1.1, heredite: 'recessif', attrait: 1.6 },
  // --- locomotion ---
  'pattes-longues': { domaine: 'locomotion', organe: 'membres postérieurs allongés', cout: .07,
                      effet: 'vitesse de pointe ×1.3', ecarts: { vitesse_rel: 1.3 }, vulnerabilite: 0.8, chasse: 1.15 ,
                      conduite: { type: 'sprint', presage: 'haut sur ses pattes arrière' } },
  'palmes':         { domaine: 'locomotion', organe: 'membranes interdigitales', cout: .03,
                      effet: 'nage ×1.4, marche un peu gênée', ecarts: { vitesse_rel: 1.05 }, vulnerabilite: 0.9 ,
                      conduite: { type: 'nage', presage: 'les doigts palmés' } },
  'membrane-planante': { domaine: 'locomotion', organe: 'repli de peau entre les membres', cout: .12,
                      effet: 'plane depuis une hauteur sur plusieurs longueurs de corps', exclut: ['gigantisme'], vulnerabilite: 0.75 ,
                      conduite: { type: 'vol-plane', presage: 'un repli de peau entre les pattes' } },
  // --- sens ---
  'yeux-nocturnes': { domaine: 'sens', organe: 'rétine riche en bâtonnets, tapetum', cout: .04,
                      effet: 'voit dans la pénombre ; actif la nuit', ecarts: { perception: 1.3, vulnerabilite: 0.9, chasse: 1.15 }, fixe: { activite: 'nocturne' } ,
                      conduite: { type: 'vision-nocturne', presage: 'de grands yeux qui accrochent la lumière' } },
  'vibrisses':      { domaine: 'sens', organe: 'poils tactiles', cout: .02,
                      effet: 'sent les mouvements d\'air et d\'eau proches', ecarts: { perception: 1.15 }, vulnerabilite: 0.92, chasse: 1.05 ,
                      conduite: { type: 'perception-proche', presage: 'les moustaches qui frémissent' } },
  // --- offense ---
  'glande-irritante': { domaine: 'offense', organe: 'glande parotoïde hypertrophiée', cout: .08,
                      effet: 'sécrète une substance irritante sur la peau', fournit: ['secretion-irritante'], vulnerabilite: 0.85 ,
                      conduite: { type: 'defense-contact', effet: 'irritant', presage: 'une peau luisante, grumeleuse' } },
  'jet-glandulaire': { domaine: 'offense', organe: 'canal éjecteur sous la glande', cout: .07,
                      effet: 'projette la sécrétion à 3 longueurs de corps', exige: ['glande-irritante'],
                      comportement: 'embuscade ; riposte à distance avant la fuite', ecarts: { temperament: 1.6 }, vulnerabilite: 0.7, chasse: 1.1 ,
                      conduite: { type: 'riposte-distance', effet: 'irritant', portee: 3, recharge: 7, presage: 'gonfle la glande sous sa gorge' } },
  'crocs-allonges': { domaine: 'offense', organe: 'canines ou crochets allongés', cout: .06,
                      effet: 'morsure profonde', ecarts: { temperament: 1.25, chasse: 1.25 }, fournit: ['croc'] ,
                      conduite: { type: 'morsure', force: 1.25, presage: 'les crocs qui dépassent' } },
  'dard':           { domaine: 'offense', organe: 'aiguillon relié à une glande', cout: .09,
                      effet: 'piqûre venimeuse de contact', exige: ['glande-irritante'], fournit: ['dard'], vulnerabilite: 0.8, chasse: 1.1 ,
                      conduite: { type: 'riposte-contact', effet: 'venin', presage: 'la queue armée d\'un aiguillon' } },
  // --- défense ---
  'peau-epaisse':   { domaine: 'defense', organe: 'derme kératinisé', cout: .05,
                      effet: 'résiste aux morsures et aux chocs légers', fournit: ['cuir'], vulnerabilite: 0.8, resistance: 0.9 ,
                      conduite: { type: 'protection', force: 1.25, presage: 'un cuir épais' } },
  'carapace':       { domaine: 'defense', organe: 'plaques osseuses dermiques', cout: .18,
                      effet: 'protège le dos et les flancs ; ralentit', exige: ['peau-epaisse'], exclut: ['membrane-planante'],
                      ecarts: { vitesse_rel: .85, masse_kg: 1.2, vulnerabilite: 0.55, resistance: 0.9 }, fournit: ['plaque-osseuse'] ,
                      conduite: { type: 'repli', force: 1.6, presage: 'des plaques osseuses sur le dos' } },
  'camouflage':     { domaine: 'defense', organe: 'chromatophores', cout: .03,
                      effet: 'se confond avec le sol de son biome ; fuit plutôt que de riposter', ecarts: { temperament: .7 }, vulnerabilite: 0.65, chasse: 1.1 ,
                      conduite: { type: 'immobilite', effet: 'dissimulation', presage: 'se fond dans le sol quand il ne bouge pas' } },
  'coloration-aposematique': { domaine: 'defense', organe: 'pigments vifs', cout: .02,
                      effet: 'annonce sa toxicité ; dissuade', exige: ['glande-irritante'], exclut: ['camouflage'], ecarts: { temperament: 1.2 }, vulnerabilite: 0.6 ,
                      conduite: { type: 'avertissement', presage: 'des couleurs vives, comme un avertissement' } },
  // --- métabolisme ---
  'metabolisme-lent': { domaine: 'metabolisme', organe: 'thyroïde peu active', cout: .0,
                      effet: 'vit plus longtemps, bouge moins, mûrit plus tard', ecarts: { longevite: 1.35, vitesse_rel: .85, maturite: 1.2, resistance: 0.85 }, vulnerabilite: 1.1 ,
                      conduite: { type: 'lenteur', force: .85, presage: 'des gestes lents' } },
  'estomac-large':  { domaine: 'metabolisme', organe: 'tube digestif allongé', cout: .2,
                      effet: 'digère végétaux et proies', fixe: { regime: 'omnivore' }, resistance: 0.95 },
  // --- reproduction ---
  'ponte-abondante': { domaine: 'reproduction', organe: 'gonades hypertrophiées', cout: .10,
                      effet: 'portée ×1.5, petits plus fragiles', ecarts: { portee: 1.5, longevite: .9, resistance: 1.1 }, vulnerabilite: 1.05 },
  'soins-parentaux': { domaine: 'reproduction', organe: 'poche ou nid, comportement', cout: .08,
                      effet: 'moins de petits, mieux protégés', ecarts: { portee: .6, maturite: .9, vulnerabilite: 0.9, resistance: 0.9 }, comportement: 'défend les jeunes' ,
                      conduite: { type: 'defense-petits', presage: 'ne quitte pas ses petits' } },
  // --- social / activité ---
  'gregarisme':     { domaine: 'social', organe: 'signaux d\'appel, glandes odorantes', cout: .02,
                      effet: 'vit en groupe ; alerte collective', ecarts: { sociabilite: 1.8, perception: 1.1, resistance: 1.25 }, vulnerabilite: 0.85 ,
                      conduite: { type: 'alerte-groupe', presage: 'lance de petits appels à ses voisins' } },
  'crepuscularite': { domaine: 'activite', organe: 'horloge interne décalée', cout: .0,
                      effet: 'actif à l\'aube et au crépuscule', fixe: { activite: 'crepusculaire' }, vulnerabilite: 0.9 ,
                      conduite: { type: 'activite-crepuscule', presage: 'sort à l\'aube et au crépuscule' } }
};
// Les traits CONTINUS (docs/8-genetique-continue.md) : chaque population en porte une moyenne et une variance, et
// chaque bête du jeu en tire sa valeur. L'unité est l'écart-type naturel à la génération 0 (z = 1 : une bête un
// écart-type au-dessus de la moyenne d'alors) ; « echelle » dit ce que vaut un écart-type sur le plan.
//  - champ, mode : le champ du plan qu'il module, 'log' (× e^(echelle·z)) ou 'lin' (+ echelle·z, borné à 0..1)
//  - h2 : l'héritabilité à la génération 0 ; omega2 : la largeur de la sélection stabilisante (en variances naturelles)
//  - optimum : ce qui déplace l'optimum hors de la niche — l'axe du biome et la pente (écarts-types par unité d'axe)
//  - predation, fecondite, maladie : la pente du risque d'être mangé, des naissances, de la mort par maladie
//    (risque ∝ e^(pente·z)) — c'est là que se font les compromis ; attrait : la pente du choix du partenaire (pères)
const QUANT = {
  taille:      { champ: 'taille_m', mode: 'log', echelle: .05, h2: .5, omega2: 20, optimum: { axe: 'temperature', pente: -4 }, attrait: .1,
                 effet: 'longueur du corps, la masse suit au cube ; plus grande au froid (règle de Bergmann)' },
  vitesse:     { champ: 'vitesse_rel', mode: 'log', echelle: .07, h2: .35, omega2: 20, optimum: { axe: 'couvert', pente: -3 }, predation: -.15,
                 effet: 'vitesse de pointe ; plus vive en terrain ouvert et là où l\'on est chassé' },
  audace:      { champ: 'temperament', mode: 'lin', echelle: .1, h2: .3, omega2: 20, predation: .12, fecondite: .08,
                 effet: 'distance de fuite ; l\'audacieuse mange mieux et se fait prendre plus souvent' },
  sociabilite: { champ: 'sociabilite', mode: 'lin', echelle: .08, h2: .3, omega2: 20, predation: -.1, maladie: .1,
                 effet: 'cohésion du groupe ; le groupe protège des prédateurs et propage les maladies' }
};
// Un trait peut-il s'ajouter à cette liste de traits ?
function admissible(id, traits) {
  const t = TRAITS[id]; if (!t || traits.includes(id)) return false;
  if ((t.exige || []).some(x => !traits.includes(x))) return false;
  if ((t.exclut || []).some(x => traits.includes(x))) return false;
  return !traits.some(x => (TRAITS[x]?.exclut || []).includes(id));
}
// Ce qui se voit d'une bête qui porte ces allèles exprimés : dans l'ordre du catalogue, on garde un trait si ce qu'il exige
// est déjà là et si rien de gardé ne l'exclut (l'albinisme efface le mélanisme ; un jet sans glande ne se voit pas).
const ORDRE = Object.keys(TRAITS);
const rang = id => { const i = ORDRE.indexOf(id); return i < 0 ? 999 : i; };
function exprimer(porte, cat = TRAITS) {
  const garde = [], de = id => cat[id] || TRAITS[id];
  for (const id of [...porte].sort((a, b) => rang(a) - rang(b) || (a < b ? -1 : 1))) { const t = de(id); if (!t) continue;
    if ((t.exige || []).some(x => !garde.includes(x))) continue;
    if ((t.exclut || []).some(x => garde.includes(x)) || garde.some(x => (de(x)?.exclut || []).includes(id))) continue;
    garde.push(id); }
  return garde.sort();
}
const API = { TRAITS, QUANT, admissible, exprimer };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else racine.OrvaneCatalogue = API;
})(globalThis);
