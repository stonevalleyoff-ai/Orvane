// Orvane — LA GENÈSE (moteur/genese.js)
// Créer la vie sans bestiaire : des biomes, quelques ancêtres très simples, et des milliers de cycles d'évolution accélérée.
// Les ancêtres se séparent en lignées qui dérivent (masse, régime, locomotion, heure, traits, silhouette), les prédateurs apparaissent
// par dérive de régime, les lignées qui ne tiennent pas s'éteignent. À la fin, chaque lignée vivante reçoit un nom
// inventé et un identifiant propre : l'instantané produit sert d'amorce à un monde (profil.monde.amorce).
//   node moteur/genese.js <biomes.json | mondes/<id>> [--cycles 3000] [--graine 7] [--lignees 100] [--nom "Monde"] [--sortie genese.json]
//                         [--point 200] [--reprise genese.json.reprise.json]   (par tranches : un point de reprise tous les N cycles)
// lignees : le nombre de lignées vivantes au-delà duquel plus rien ne se sépare — la place se gagne alors par extinction.
// biomes.json : un tableau de biomes au format de l'instantané (ou un monde existant : on reprend ses biomes, vides).
'use strict';
const fs = require('fs'), path = require('path');
const Orvane = require('./orvane.js'), CAT = require('./catalogue.js'), CORPS = require('./corps.js'), Tampon = require('../tampon/tampon.js');
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf(k); return i >= 0 && a[i + 1] != null ? a[i + 1] : d; };
const src = a.find(x => !x.startsWith('--')) || 'mondes/sv-1', cycles = +arg('--cycles', 3000), graine = +arg('--graine', 7), nom = arg('--nom', 'Monde né d\'Orvane'), sortie = arg('--sortie', 'genese.json');

// --- les biomes ---
let biomes;
const lu = JSON.parse(fs.readFileSync(fs.existsSync(src) && fs.statSync(src).isDirectory() ? path.join(src, 'instantane.json') : src, 'utf8'));
biomes = (Array.isArray(lu) ? lu : lu.biomes).map(b => ({ id: b.id, nom: b.nom, milieu: b.milieu, axes: { ...b.axes }, capacite: b.capacite_base || b.capacite, voisins: b.voisins || [], ...(b.saisons != null ? { saisons: b.saisons } : {}) }));
const AX = ['temperature', 'humidite', 'altitude', 'lumiere', 'couvert'];
const centre = liste => { const c = {}; for (const k of AX) c[k] = +(liste.reduce((s, b) => s + b.axes[k], 0) / liste.length).toFixed(2); return c; };

// --- les ancêtres : sur terre, un petit et un grand brouteur, un insecte, un fouisseur, un oiseau, un rôdeur, un serpent ;
// en eau douce, un filtreur, un brouteur des berges, un chasseur ; en mer, un filtreur, un brouteur des récifs, un
// chasseur du large et un crabe des côtes (qui vit dans les deux eaux) ---
const C = (robe, sombre, ventre, oeil) => ({ robe, sombre, ventre, oeil });
const ANCETRES = {
  terre: [
    { id: 'grand-brouteur', nom: 'Grand brouteur', regime: 'herbivore', masse_kg: 60, taille_m: 1.2, locomotion: ['marche', 'course'], longevite: 30, maturite: 5, portee: 1, sociabilite: .7, temperament: .25, activite: 'diurne', vitesse_rel: 5, perception: .5,
      corps: { forme: 'quadrupede', long: .55, haut: .6, cou: .55, tete: .4, museau: .4, oreilles: .3, queue: .3, couleurs: C([158, 128, 92], [104, 82, 58], [204, 186, 152], [36, 30, 26]) } },
    { id: 'insecte-primitif', nom: 'Insecte primitif', regime: 'herbivore', masse_kg: .02, taille_m: .04, locomotion: ['marche'], longevite: 3, maturite: 1, portee: 20, sociabilite: .5, temperament: .1, activite: 'diurne', vitesse_rel: 3, perception: .3,
      corps: { forme: 'hexapode', long: .5, haut: .15, cou: 0, tete: .4, museau: .2, oreilles: 0, queue: .1, antennes: .5, couleurs: C([110, 130, 70], [64, 80, 40], [170, 180, 120], [20, 20, 20]) } },
    { id: 'oiseau-primitif', nom: 'Oiseau primitif', regime: 'omnivore', masse_kg: .4, taille_m: .25, locomotion: ['marche', 'vol'], longevite: 10, maturite: 1, portee: 4, sociabilite: .5, temperament: .3, activite: 'diurne', vitesse_rel: 6, perception: .6,
      corps: { forme: 'oiseau', long: .4, haut: .45, cou: .35, tete: .45, museau: .45, oreilles: 0, queue: .45, ailes: .7, couleurs: C([140, 120, 90], [80, 66, 50], [214, 200, 170], [30, 26, 22]) } },
    { id: 'serpent-primitif', nom: 'Serpent primitif', regime: 'carnivore', masse_kg: 1, taille_m: .8, locomotion: ['reptation'], longevite: 20, maturite: 3, portee: 6, sociabilite: .05, temperament: .5, activite: 'crepusculaire', vitesse_rel: 4, perception: .5,
      corps: { forme: 'serpent', long: .95, haut: 0, cou: 0, tete: .4, museau: .45, oreilles: 0, queue: .6, motif: 'bandes', couleurs: C([120, 112, 70], [60, 56, 36], [190, 180, 130], [200, 160, 40]) } },
    { id: 'brouteur-primitif', nom: 'Brouteur primitif', regime: 'herbivore', masse_kg: 1.5, taille_m: .3, locomotion: ['marche'], longevite: 20, maturite: 3, portee: 3, sociabilite: .3, temperament: .2, activite: 'diurne', vitesse_rel: 4, perception: .4,
      corps: { forme: 'quadrupede', long: .45, haut: .35, cou: .25, tete: .5, museau: .35, oreilles: .35, queue: .25, couleurs: { robe: [150, 132, 98], sombre: [102, 88, 62], ventre: [196, 182, 150], oeil: [40, 34, 28] } } },
    { id: 'fouisseur-primitif', nom: 'Fouisseur primitif', regime: 'omnivore', masse_kg: .3, taille_m: .15, locomotion: ['marche', 'fouissage'], longevite: 12, maturite: 2, portee: 4, sociabilite: .2, temperament: .3, activite: 'nocturne', vitesse_rel: 5, perception: .5,
      corps: { forme: 'hexapode', long: .55, haut: .15, cou: 0, tete: .55, museau: .6, oreilles: .1, queue: .15, carapace: .35, antennes: .4, couleurs: { robe: [120, 96, 78], sombre: [76, 58, 46], ventre: [170, 150, 126], oeil: [220, 200, 150] } } },
    { id: 'rodeur-primitif', nom: 'Rôdeur primitif', regime: 'carnivore', masse_kg: 5, taille_m: .5, locomotion: ['marche', 'course'], longevite: 30, maturite: 5, portee: 2, sociabilite: .2, temperament: .6, activite: 'crepusculaire', vitesse_rel: 6, perception: .6,
      corps: { forme: 'quadrupede', long: .6, haut: .5, cou: .3, tete: .45, museau: .55, oreilles: .5, queue: .55, couleurs: { robe: [128, 110, 96], sombre: [70, 58, 52], ventre: [180, 166, 150], oeil: [240, 200, 110] } } },
    // (des prédateurs à chaque étage de taille : un mangeur d'insectes, un rapace, un grand chasseur ; leur longévité suit leur
    // masse, comme celle des autres, sinon un prédateur ne vit pas assez pour se nourrir de petits)
    { id: 'insectivore-primitif', nom: 'Insectivore primitif', regime: 'carnivore', masse_kg: .06, taille_m: .1, locomotion: ['marche'], longevite: 10, maturite: 1, portee: 6, sociabilite: .2, temperament: .5, activite: 'nocturne', vitesse_rel: 5, perception: .6,
      corps: { forme: 'quadrupede', long: .5, haut: .3, cou: .15, tete: .5, museau: .65, oreilles: .4, queue: .5, couleurs: C([118, 100, 84], [70, 58, 48], [176, 160, 140], [20, 18, 16]) } },
    { id: 'rapace-primitif', nom: 'Rapace primitif', regime: 'carnivore', masse_kg: 1.2, taille_m: .45, locomotion: ['marche', 'vol'], longevite: 20, maturite: 2, portee: 2, sociabilite: .1, temperament: .7, activite: 'diurne', vitesse_rel: 8, perception: .8,
      corps: { forme: 'oiseau', long: .45, haut: .5, cou: .3, tete: .45, museau: .5, oreilles: 0, queue: .45, ailes: .85, couleurs: C([120, 96, 70], [66, 52, 38], [210, 196, 170], [230, 190, 60]) } },
    { id: 'grand-rodeur', nom: 'Grand rôdeur', regime: 'carnivore', masse_kg: 35, taille_m: 1, locomotion: ['marche', 'course'], longevite: 45, maturite: 3, portee: 3, sociabilite: .5, temperament: .7, activite: 'crepusculaire', vitesse_rel: 7, perception: .7,
      corps: { forme: 'quadrupede', long: .65, haut: .6, cou: .35, tete: .45, museau: .5, oreilles: .45, queue: .5, couleurs: C([140, 118, 92], [80, 64, 50], [196, 182, 160], [220, 180, 90]) } },
  ],
  eau: [
    { id: 'brouteur-des-berges', nom: 'Brouteur des berges', regime: 'herbivore', masse_kg: 1, taille_m: .3, locomotion: ['nage', 'marche'], eau: 'douce', longevite: 12, maturite: 2, portee: 8, sociabilite: .4, temperament: .2, activite: 'crepusculaire', vitesse_rel: 3, perception: .4,
      corps: { forme: 'quadrupede', long: .6, haut: .15, cou: .1, tete: .45, museau: .4, oreilles: 0, queue: .7, couleurs: C([92, 120, 80], [50, 70, 44], [190, 196, 150], [30, 30, 20]) } },
    { id: 'filtreur-primitif', nom: 'Filtreur primitif', regime: 'filtreur', masse_kg: .5, taille_m: .2, locomotion: ['nage'], longevite: 15, maturite: 2, portee: 6, sociabilite: .6, temperament: .1, activite: 'continue', vitesse_rel: 3, perception: .3,
      corps: { forme: 'serpent', long: .85, haut: 0, cou: 0, tete: .4, museau: .2, queue: .5, crete: .3, couleurs: { robe: [96, 140, 150], sombre: [58, 90, 102], ventre: [176, 206, 204], oeil: [30, 40, 44] } } },
    { id: 'chasseur-des-eaux', nom: 'Chasseur des eaux', regime: 'carnivore', masse_kg: 3, taille_m: .45, locomotion: ['nage'], longevite: 25, maturite: 4, portee: 3, sociabilite: .2, temperament: .5, activite: 'continue', vitesse_rel: 7, perception: .6,
      corps: { forme: 'serpent', long: .9, haut: 0, cou: .1, tete: .5, museau: .5, queue: .7, crete: .45, couleurs: { robe: [70, 96, 120], sombre: [40, 56, 76], ventre: [170, 190, 200], oeil: [230, 210, 90] } } },
    { id: 'grenouille-primitive', nom: 'Grenouille primitive', regime: 'carnivore', masse_kg: .1, taille_m: .1, locomotion: ['nage', 'marche', 'saut'], eau: 'douce', longevite: 10, maturite: 1, portee: 30, sociabilite: .2, temperament: .4, activite: 'crepusculaire', vitesse_rel: 4, perception: .5,
      corps: { forme: 'quadrupede', long: .45, haut: .2, cou: 0, tete: .6, museau: .2, oreilles: 0, queue: 0, couleurs: C([90, 130, 70], [48, 74, 40], [200, 210, 150], [200, 170, 40]) } },
  ],
  mer: [
    { id: 'filtreur-marin', nom: 'Filtreur marin', regime: 'filtreur', masse_kg: 2, taille_m: .4, locomotion: ['nage'], eau: 'salee', longevite: 20, maturite: 3, portee: 10, sociabilite: .7, temperament: .1, activite: 'continue', vitesse_rel: 3, perception: .3,
      corps: { forme: 'serpent', long: .7, haut: 0, cou: 0, tete: .5, museau: .15, queue: .45, couleurs: C([100, 150, 180], [56, 94, 120], [200, 220, 230], [24, 30, 40]) } },
    { id: 'brouteur-des-recifs', nom: 'Brouteur des récifs', regime: 'herbivore', masse_kg: .5, taille_m: .2, locomotion: ['nage'], eau: 'salee', longevite: 10, maturite: 2, portee: 12, sociabilite: .6, temperament: .2, activite: 'diurne', vitesse_rel: 4, perception: .4,
      corps: { forme: 'serpent', long: .5, haut: 0, cou: 0, tete: .55, museau: .3, queue: .4, motif: 'rayures', couleurs: C([220, 150, 60], [140, 80, 30], [240, 220, 180], [20, 20, 30]) } },
    { id: 'chasseur-des-recifs', nom: 'Chasseur des récifs', regime: 'carnivore', masse_kg: .8, taille_m: .35, locomotion: ['nage'], eau: 'salee', longevite: 17, maturite: 2, portee: 8, sociabilite: .3, temperament: .6, activite: 'diurne', vitesse_rel: 7, perception: .6,
      corps: { forme: 'serpent', long: .7, haut: 0, cou: 0, tete: .55, museau: .55, queue: .6, motif: 'rayures', couleurs: C([190, 70, 60], [110, 36, 30], [240, 200, 180], [20, 20, 20]) } },
    { id: 'chasseur-du-large', nom: 'Chasseur du large', regime: 'carnivore', masse_kg: 8, taille_m: .9, locomotion: ['nage'], eau: 'salee', longevite: 30, maturite: 5, portee: 4, sociabilite: .3, temperament: .6, activite: 'continue', vitesse_rel: 8, perception: .6,
      corps: { forme: 'serpent', long: .85, haut: 0, cou: 0, tete: .5, museau: .6, queue: .7, couleurs: C([80, 100, 130], [40, 52, 70], [200, 210, 220], [220, 220, 200]) } },
    { id: 'crabe-primitif', nom: 'Crabe primitif', regime: 'detritivore', masse_kg: .3, taille_m: .15, locomotion: ['marche', 'nage'], eau: 'mixte', longevite: 8, maturite: 2, portee: 30, sociabilite: .4, temperament: .4, activite: 'nocturne', vitesse_rel: 3, perception: .4,
      corps: { forme: 'hexapode', pattes: 8, long: .4, haut: .2, cou: 0, tete: .4, museau: .1, oreilles: 0, queue: 0, carapace: .6, antennes: .3, couleurs: C([170, 80, 60], [100, 44, 34], [220, 170, 140], [20, 20, 20]) } },
  ],
};
// les ancêtres partent de chaque biome où leur milieu les laisse vivre
const groupes = { terre: biomes.filter(b => ['terrestre', 'amphibie', 'souterrain', 'aerien'].includes(b.milieu)), eau: biomes.filter(b => ['aquatique', 'amphibie'].includes(b.milieu)),
  mer: biomes.filter(b => ['marin', 'amphibie'].includes(b.milieu)) };
const BANDE = Math.sqrt(2 * Math.PI) * .35 / 4;
const taxons = [];
for (const [g, liste] of Object.entries(groupes)) { if (!liste.length) continue;
  for (const m of ANCETRES[g]) {
    const plan = { ...m, niche: centre(liste), tolerance: .7 }; delete plan.id; delete plan.nom;
    if (plan.corps) plan.corps = CORPS.normaliser(plan.corps);
    taxons.push({ id: m.id, nom: m.nom, parent: null, apparu: 0, eteint: null, statut: 'stable', plan,
      populations: liste.map(b => ({ biome: b.id, effectif: Math.round(b.capacite * BANDE * (m.regime === 'carnivore' ? .05 : .3) / m.masse_kg), tendance: 0, depuis: 0 })),
      phenotypes: [{ id: 'base', frequence: 1, traits: [], cout_total: 0 }] });
  }
}
let inst = { orvane: '0.1', monde: { id: 'genese', graine, nom, annee: lu.monde?.annee || 120 }, cycle: { n: 0, date: new Date().toISOString(), pressions_recues: 0 },
  biomes, catalogue: { version: '0.1', traits: {} }, taxons, evenements: [] };

// --- l'évolution accélérée ---
const R0 = JSON.parse(JSON.stringify(Orvane.REGLES));
const maxTaxons = +arg('--lignees', 100);
// (les règles de séparation complètent celles du moteur, sans les remplacer : le flux de gènes et l'écart génétique en font
// partie depuis docs/10 — sans eux, plus rien ne se séparait)
Object.assign(Orvane.REGLES, { mutation: .01, nouveau_trait: .08, menace: 20, max_taxons: maxTaxons, separation: { ...R0.separation, cycles: 15, effectif: 40, distance: .8, chance: .03 },
  derive: { masse: [.4, 3], regime: .25, locomotion: .3, activite: .2, corps: 2.5 } });   // corps : la silhouette dérive deux fois et demie plus vite
// --regles '{"cle": valeur}' : des règles du moteur propres à ce monde
const reglesMonde = arg('--regles', null) ? JSON.parse(arg('--regles', '{}')) : null;   // gardées par le monde (monde.regles) : elles valent ensuite à chacun de ses cycles
if (reglesMonde) Object.assign(Orvane.REGLES, reglesMonde);
const rarete = +arg('--rarete', .0005);   // une lignée installée qui reste sous cette part de la BIOMASSE du monde est rayée : la place se libère
// (la rareté se juge à l'étage de la chaîne : un prédateur ne pèse naturellement qu'un dixième de ses proies — Lindeman)
const ETAGE = { carnivore: +arg('--etage', 10), omnivore: 2 };
const biomasseDe = t => t.populations.reduce((s, p) => s + p.effectif, 0) * (t.plan.masse_kg || 1);
const poidsRarete = t => biomasseDe(t) * (ETAGE[Tampon.regimeDe(t, CAT.TRAITS)] || 1);
let bilan = { separation: 0, extinction: 0, nouveau_trait: 0 }, vivantsMax = 0, k0 = 0;
const TRACE = process.env.ORVANE_TRACE ? { nes: {}, fin: {}, rarete: {}, vus: new Set(), morts: new Set() } : null;   // (essais : qui naît, qui meurt, par régime de fait)
// une genèse longue tourne par tranches : un point de reprise tous les --point cycles (sortie.reprise.json) ; --reprise
// <fichier> repart de là, au cycle près (le hasard de chaque cycle ne dépend que de la graine et du numéro du cycle)
const point = +arg('--point', 200), reprise = arg('--reprise', null), fichierReprise = sortie + '.reprise.json';
if (reprise) { const r = JSON.parse(fs.readFileSync(reprise, 'utf8')); inst = r.inst; bilan = r.bilan; vivantsMax = r.vivantsMax; k0 = r.k; console.log(`reprise au cycle ${k0}`); }
for (let k = k0; k < cycles; k++) {
  inst = Orvane.cycle(inst, {}, { duree_ms: 0 });
  for (const e of inst.evenements) if (e.type in bilan) bilan[e.type]++;
  if ((k + 1) % 25 === 0) { const total = inst.taxons.reduce((s, t) => s + (t.eteint ? 0 : biomasseDe(t)), 0);
    for (const t of inst.taxons) if (!t.eteint && t.apparu < inst.cycle.n - 100 && poidsRarete(t) < rarete * total) { if (TRACE) TRACE.rarete[Tampon.regimeDe(t, CAT.TRAITS)] = (TRACE.rarete[Tampon.regimeDe(t, CAT.TRAITS)] || 0) + 1; t.eteint = inst.cycle.n; t.statut = 'eteint'; t.populations = []; bilan.extinction++; } }
  if (TRACE) for (const t of inst.taxons) { const r = Tampon.regimeDe(t, CAT.TRAITS); if (!TRACE.vus.has(t.id)) { TRACE.vus.add(t.id); TRACE.nes[r] = (TRACE.nes[r] || 0) + 1; }
    if (t.eteint && !TRACE.morts.has(t.id)) { TRACE.morts.add(t.id); TRACE.fin[r] = (TRACE.fin[r] || 0) + 1; } }
  const vivants = inst.taxons.filter(t => !t.eteint).length; vivantsMax = Math.max(vivantsMax, vivants);
  if (point > 0 && (k + 1) % point === 0 && k + 1 < cycles) fs.writeFileSync(fichierReprise, JSON.stringify({ k: k + 1, inst, bilan, vivantsMax }));
  if ((k + 1) % Math.max(1, Math.round(cycles / 10)) === 0) console.log(`c${k + 1} · ${vivants} lignées vivantes · ${bilan.separation} séparations, ${bilan.extinction} extinctions, ${bilan.nouveau_trait} traits apparus`);
}
if (TRACE) console.log('trace', JSON.stringify({ nes: TRACE.nes, eteints: TRACE.fin, rayes_pour_rarete: TRACE.rarete }));
Object.assign(Orvane.REGLES, R0);

// --- les noms : une syllabe ou trois, et une épithète qui dit ce qu'elle est et d'où elle vient ---
let g = (graine ^ 0x5eed) >>> 0; const R = () => { g = (Math.imul(g, 1664525) + 1013904223) >>> 0; return g / 4294967296; };
const SYL = ['va', 'ro', 'lin', 'ka', 'mé', 'tor', 'sil', 'ou', 'ne', 'gra', 'vi', 'lo', 'mu', 'ren', 'ta', 'ki', 'so', 'bel', 'dun', 'fir', 'or', 'ys', 'an', 'el', 'tis', 'cor', 'ume', 'ja', 'phé', 'nou'];
// (un nageur qui ne marche pas, un volant : leurs mots à eux)
const EPI_EAU = { herbivore: ['brouteur d\'algues', 'paisseur'], omnivore: ['fouilleur', 'picoreur des fonds'], carnivore: ['nageur', 'happeur', 'chasseur'], filtreur: ['filtreur', 'tamiseur'], detritivore: ['nettoyeur', 'fouille-vase'] };
const EPI_AIR = { herbivore: ['picoreur', 'butineur'], omnivore: ['picoreur', 'chapardeur'], carnivore: ['planeur', 'rapace'], filtreur: ['écumeur'], detritivore: ['charognard'] };
const TERRE = ['marche', 'course', 'saut', 'reptation', 'fouissage', 'grimpe'];
const EPI = { herbivore: ['brouteur', 'broutard', 'mangeur d\'herbe', 'tondeur'], omnivore: ['fouisseur', 'glaneur', 'chapardeur', 'fureteur'], carnivore: ['rôdeur', 'chasseur', 'traqueur', 'guetteur'], filtreur: ['filtreur', 'tamiseur'], detritivore: ['nettoyeur', 'charognard'] };
const pris = new Set(), nommer = () => { for (;;) { const n = 2 + Math.floor(R() * 2); let s = ''; for (let i = 0; i < n; i++) s += SYL[Math.floor(R() * SYL.length)]; s = s[0].toUpperCase() + s.slice(1); if (!pris.has(s)) { pris.add(s); return s; } } };
const vivants = inst.taxons.filter(t => !t.eteint), ids = new Map();
// (le régime de fait, Tampon.regimeDe : un carnivore qui digère les plantes est nommé en omnivore)
for (const t of vivants) { const base = nommer(), principal = t.populations.slice().sort((x, y) => y.effectif - x.effectif)[0], b = biomes.find(x => x.id === principal?.biome);
  const L = t.plan.locomotion || [], E = L.includes('nage') && !L.some(l => TERRE.includes(l)) ? EPI_EAU : L.includes('vol') ? EPI_AIR : EPI;
  const reg = Tampon.regimeDe(t, CAT.TRAITS), epi = E[reg] || EPI[reg] || ['créature']; t.nom = `${base} ${epi[Math.floor(R() * epi.length)]}${b ? ' ' + (/^[aeiouyéè]/i.test(b.nom || b.id) ? 'd\'' : 'de ') + (b.nom || b.id).toLowerCase() : ''}`;
  ids.set(t.id, base.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')); }
for (const t of vivants) { const ancien = t.id; t.id = ids.get(ancien); t.parent = t.parent && ids.has(t.parent) ? ids.get(t.parent) : (t.parent ? ancetreVivant(t.parent) : null); }
function ancetreVivant(id) { let p = inst.taxons.find(x => x.id === id); while (p && p.eteint) p = inst.taxons.find(x => x.id === p.parent); return p ? ids.get(p.id) || null : null; }
inst.taxons = vivants; inst.cycle = { n: inst.cycle.n, date: new Date().toISOString(), pressions_recues: 0 }; inst.evenements = []; inst.monde.genese = { cycles, graine, ancetres: Object.values(ANCETRES).flat().map(m => m.id) }; if (reglesMonde) inst.monde.regles = reglesMonde;
// (les cycles d'apparition sont gardés : l'arbre des lignées raconte la genèse ; le monde publié commence à ce cycle-là)
const traits = {}; for (const t of inst.taxons) for (const p of t.phenotypes) for (const id of p.traits) traits[id] = CAT.TRAITS[id]; inst.catalogue.traits = traits;
fs.writeFileSync(sortie, JSON.stringify(inst, null, 1));

// --- le bilan ---
console.log(`\n${nom} — ${cycles} cycles de genèse, graine ${graine} : ${inst.taxons.length} lignées vivantes (jusqu'à ${vivantsMax}), ${bilan.separation} séparations, ${bilan.extinction} extinctions`);
const parRegime = {}; for (const t of inst.taxons) parRegime[t.plan.regime] = (parRegime[t.plan.regime] || 0) + 1; console.log('régimes :', JSON.stringify(parRegime), '· traits portés :', Object.keys(traits).length);
for (const t of inst.taxons.slice().sort((x, y) => y.plan.masse_kg - x.plan.masse_kg).slice(0, 12))
  console.log(`  ${t.nom.padEnd(42)} ${String(t.plan.masse_kg).padStart(8)} kg  ${t.plan.regime.padEnd(9)} ${(t.plan.locomotion || []).join('/').padEnd(22)} ${t.plan.activite.padEnd(12)} ${Math.round(t.populations.reduce((s, p) => s + p.effectif, 0))} ind. · ${[...new Set(t.phenotypes.flatMap(p => p.traits))].slice(0, 4).join(', ')}`);
console.log(`→ ${sortie}`);
