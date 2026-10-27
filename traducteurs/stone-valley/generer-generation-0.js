// Orvane × Stone Valley — AMORCER LE MONDE (generer-generation-0.js)
// Lit le bestiaire de Stone Valley (les objets { id:…, diet:…, cap:…, mat:… } de index.html) et en fait un
// instantané Orvane de génération 0 : un taxon par espèce vivante, un plan corporel déduit des champs du jeu,
// des populations réparties sur les biomes Orvane du monde « sv-1 », des phénotypes rares aux fréquences
// actuelles du jeu (robes 1/1140, formes 1/18000). Les automates, les boss, les horreurs et la faune du volcan
// n'en font pas partie : ce ne sont pas des êtres vivants, ou pas de ce monde.
//   node generer-generation-0.js <chemin/vers/index.html> [sortie.json]
// C'est l'exemple du mode d'emploi « amorcer depuis un bestiaire existant » : les heuristiques ci-dessous sont
// à ajuster à la main ensuite — l'instantané produit est un point de départ, pas une vérité.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const { BIOMES_SV, biomeOrvane } = require('./correspondance.js');
const CAT = require('../../moteur/catalogue.js');

const src = fs.readFileSync(process.argv[2] || path.join(__dirname, '../../../sv/index.html'), 'utf8');
const sortie = process.argv[3] || path.join(__dirname, 'generation-0.json');

// 1. extraire chaque objet-espèce par équilibrage d'accolades, et l'évaluer seul dans un bac à sable
const especes = [];
const re = /\{ id:'([a-z_]+)',\s*n:/g; let m;
const bac = new Proxy({}, { has: () => true, get: (t, k) => k === Symbol.unscopables ? undefined : 1 });
while ((m = re.exec(src))) {
  let i = m.index, p = 0; do { const c = src[i]; if (c === '{') p++; else if (c === '}') p--; i++; } while (p && i < src.length);
  const txt = src.slice(m.index, i); if (!/diet:/.test(txt) || !/cap:/.test(txt) || !/mat:/.test(txt)) continue;
  try { const o = vm.runInNewContext('(' + txt + ')', bac); if (!especes.some(e => e.id === o.id)) especes.push(o); } catch (e) { /* un objet qui n'est pas une espèce */ }
}
const vivantes = especes.filter(s => s.diet !== 's' && !s.boss && !s.horreur && !s.donjon && !s.volcan && s.cap > 0 && (s.bio || s.biome || s.terre));
console.log(`${especes.length} espèces lues, ${vivantes.length} vivantes gardées : ${vivantes.map(s => s.id).join(', ')}`);

// 2. le plan corporel : des heuristiques depuis les champs du jeu
const r2 = v => Math.round(v * 100) / 100;
function plan(s) {
  const loco = s.volant ? ['vol'] : s.dragon ? ['vol', 'marche'] : s.corps === 'crapaud' ? ['saut', 'nage', 'marche'] : s.corps === 'saurien' ? ['marche', 'course', 'nage']
    : (s.sauteur || s.bond) ? ['saut', 'marche'] : ['marche', 'course'];
  if ((s.grimpe || 0) >= .5 && !loco.includes('grimpe')) loco.push('grimpe');
  const regime = { h: 'herbivore', c: 'carnivore', o: 'omnivore' }[s.diet] || 'omnivore';
  const maturite = r2(Math.max(2, s.mat / 10)), bios = biomesDe(s);
  const AX = ['temperature', 'humidite', 'altitude', 'lumiere', 'couvert'], niche = {};
  for (const a of AX) niche[a] = r2(bios.reduce((x, b) => x + BIOMES_SV[b].axes[a], 0) / bios.length);
  // une espèce de plusieurs biomes est une généraliste : sa tolérance couvre la distance de sa niche à chacun d'eux
  const ecart = bios.reduce((x, b) => x + Math.sqrt(AX.reduce((s, a) => s + (BIOMES_SV[b].axes[a] - niche[a]) ** 2, 0)), 0) / bios.length;
  const tolerance = r2(Math.max(.3, ecart * 1.6));
  return {
    masse_kg: r2(25 * s.sz ** 3 * (s.masse || 1)), taille_m: r2(.8 * s.sz), locomotion: loco, regime,
    longevite: r2(maturite * 5), maturite, portee: s.corps === 'crapaud' ? 40 : s.corps === 'saurien' ? 12 : regime === 'herbivore' ? 3 : regime === 'carnivore' ? 2 : 4,
    sociabilite: r2(Math.min(1, s.meute ? .9 : s.herd ? .7 : .2)), temperament: r2(Math.min(1, Math.max(0, 1 - (s.peur ?? .5)) * .8 + (s.riposte || 0) * .5)),
    activite: s.nuit ? 'nocturne' : 'diurne', vitesse_rel: r2(s.spd * 2), perception: r2(Math.min(1, (s.vue || 12) / 30)),
    niche, tolerance
  };
}
// une espèce sans biome déclaré (les Trottins, tirés à part) vit sur les sols communs
const biomesDe = s => { const l = [...new Set([...(s.bio || []), ...(s.biome ? [s.biome] : []), ...(s.terre ? [s.terre] : [])])].filter(b => BIOMES_SV[b]); return l.length ? l : [2, 3, 4]; };

// 3. les taxons, leurs populations, leurs phénotypes
// Les chances du jeu (1/1140 par robe, 1/18000 par forme) sont des taux PAR NAISSANCE : dans Orvane, c'est la mutation.
// Ici on pose des fréquences INSTALLÉES, réalistes pour une population ; c'est le profil (compression) qui rend ces
// variantes aussi rares qu'avant dans le jeu. ECHELLE : combien d'« îles » le monde représente.
const F_ROBE = .004, F_FORME = .001, ECHELLE = 100;
const taxons = vivantes.map(s => {
  const bios = biomesDe(s), pl = plan(s);
  const populations = bios.map(b => ({ biome: biomeOrvane(b), effectif: Math.round(s.cap * ECHELLE * (BIOMES_SV[b].food || .1) / .5), tendance: 0, depuis: 0 }));
  const orn = (s.fam === 'coursier' || s.fam === 'trottin') ? 'crete' : 'cornes';
  const phenotypes = [{ id: 'base', frequence: 1, traits: [], cout_total: 0 },
    ...['albinisme', 'melanisme', 'robe-doree'].map(t => ({ id: t, frequence: F_ROBE, traits: [t] })),   // l'identifiant d'un phénotype, c'est sa liste de traits (comme le moteur les nomme)
    ...['gigantisme', 'nanisme'].map(t => ({ id: t, frequence: F_FORME, traits: [t] }))];
  for (const p of phenotypes) if (p.traits.length) p.cout_total = p.traits.reduce((a, t) => a + CAT.TRAITS[t].cout, 0);
  phenotypes[0].frequence = 1 - phenotypes.slice(1).reduce((a, p) => a + p.frequence, 0);
  return { id: s.id, nom: s.n, parent: null, apparu: 0, eteint: null, statut: 'stable', plan: pl, populations, phenotypes, _orn: orn };
});
for (const t of taxons) delete t._orn;

// 4. les biomes : capacité telle que la saturation de départ soit de 70 %
const biomes = Object.entries(BIOMES_SV).map(([k, b]) => ({ id: biomeOrvane(+k), nom: b.nom, milieu: b.milieu, axes: b.axes, capacite: 0, voisins: (b.voisins || []).map(biomeOrvane) }));
for (const t of taxons) for (const p of t.populations) { const b = biomes.find(x => x.id === p.biome); b.capacite += p.effectif * t.plan.masse_kg; }
for (const b of biomes) b.capacite = Math.max(200, Math.round(b.capacite / .7));

const traits = {}; for (const id of ['albinisme', 'melanisme', 'robe-doree', 'gigantisme', 'nanisme']) traits[id] = CAT.TRAITS[id];
const inst = { orvane: '0.1', monde: { id: 'sv-1', graine: 7340021, nom: 'Monde de Stone Valley' }, cycle: { n: 0, date: new Date().toISOString(), pressions_recues: 0 },
  biomes, catalogue: { version: '0.1', traits }, taxons, evenements: [] };
fs.writeFileSync(sortie, JSON.stringify(inst, null, 1));
console.log(`→ ${sortie} : ${taxons.length} taxons, ${biomes.length} biomes, ${taxons.reduce((a, t) => a + t.populations.reduce((b, p) => b + p.effectif, 0), 0)} individus`);
