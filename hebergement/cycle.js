// Orvane — LE CYCLE NOCTURNE (hebergement/cycle.js)
// Fait tourner un monde d'un cycle : lit les lots de pressions déposés depuis le cycle précédent, les passe au
// tampon, fait tourner le moteur, publie l'instantané. Lancé par l'action GitHub (.github/workflows/cycle.yml)
// ou à la main. Un monde = un dossier mondes/<id>/ :
//   profil.json        le profil du jeu (réglage du tampon)
//   etat.json          l'instantané courant, complet (le moteur repart de là)
//   instantane.json    le même, publié : c'est ce que les traducteurs lisent (GitHub Pages sert avec CORS *)
//   historique.json    les 365 derniers cycles, allégés (effectifs, fréquences, événements) : pour l'observatoire
//   tampon.json        la mémoire du tampon (lissage) et l'heure de la dernière lecture des lots
//   lots/              (facultatif) des lots déposés à la main ; lus en plus de Supabase, puis déplacés dans lots/traites/
//   node hebergement/cycle.js sv-1 [--sans-reseau] [--cycles N]
// Les lots en ligne viennent de la table orvane_pressions (traducteurs/stone-valley/supabase.sql), lue avec la clé
// de service : SUPABASE_URL et SUPABASE_SERVICE_KEY dans l'environnement. Sans eux, ou avec --sans-reseau, seuls
// les lots du dossier comptent.
'use strict';
const fs = require('fs'), path = require('path');
const Orvane = require('../moteur/orvane.js'), Tampon = require('../tampon/tampon.js');
const a = process.argv.slice(2), monde = a.find(x => !x.startsWith('--')) || 'sv-1', sansReseau = a.includes('--sans-reseau');
const nCycles = +(a[a.indexOf('--cycles') + 1] || 1) || 1;
const D = path.join(__dirname, '..', 'mondes', monde), f = n => path.join(D, n);
const lire = (n, defaut) => fs.existsSync(f(n)) ? JSON.parse(fs.readFileSync(f(n), 'utf8')) : defaut;
const ecrire = (n, o, compact) => fs.writeFileSync(f(n), compact ? JSON.stringify(o) : JSON.stringify(o, null, 1));

async function lotsEnLigne(depuis) {
  const url = process.env.SUPABASE_URL, cle = process.env.SUPABASE_SERVICE_KEY;
  if (sansReseau || !url || !cle) return [];
  const q = `${url.replace(/\/$/, '')}/rest/v1/orvane_pressions?select=lot,compte,recu&monde=eq.${encodeURIComponent(monde)}&recu=gt.${encodeURIComponent(depuis)}&order=recu.asc&limit=10000`;
  const r = await fetch(q, { headers: { apikey: cle, Authorization: 'Bearer ' + cle } });
  if (!r.ok) throw new Error(`Supabase ${r.status} : ${await r.text()}`);
  const rows = await r.json();
  return rows.map(x => { const lot = x.lot || {}; lot.source = { ...(lot.source || {}), compte: 'u:' + String(x.compte).slice(0, 8) }; lot._recu = x.recu; return lot; });
}
function lotsLocaux() {
  const d = f('lots'); if (!fs.existsSync(d)) return [];
  const out = []; for (const n of fs.readdirSync(d)) if (n.endsWith('.json')) { try { out.push({ ...JSON.parse(fs.readFileSync(path.join(d, n), 'utf8')), _fichier: n }); } catch (e) { console.warn('lot illisible :', n); } }
  return out;
}
function ranger(lots) {
  const t = f('lots/traites'); for (const l of lots) if (l._fichier) { fs.mkdirSync(t, { recursive: true }); fs.renameSync(path.join(f('lots'), l._fichier), path.join(t, l._fichier)); }
}
// l'instantané allégé, pour l'historique
const alleger = I => ({ cycle: I.cycle, taxons: I.taxons.map(t => ({ id: t.id, nom: t.nom, parent: t.parent, apparu: t.apparu, eteint: t.eteint, statut: t.statut,
  populations: t.populations.map(p => ({ biome: p.biome, effectif: p.effectif })), phenotypes: t.phenotypes.map(p => ({ id: p.id, frequence: p.frequence, traits: p.traits })) })),
  biomes: I.biomes.map(b => ({ id: b.id, capacite: Math.round(b.capacite) })), evenements: I.evenements || [] });

(async () => {
  const profil = lire('profil.json'); if (!profil) throw new Error(`pas de profil : ${f('profil.json')}`);
  let etat = lire('etat.json');
  if (!etat) {   // premier cycle : on part de l'amorce, et on la publie telle quelle (generation-0.json) : les traducteurs s'y comparent
    const am = profil.monde?.amorce && path.join(__dirname, '..', profil.monde.amorce);
    if (!am || !fs.existsSync(am)) throw new Error('pas d\'état ni d\'amorce');
    etat = JSON.parse(fs.readFileSync(am, 'utf8')); ecrire('generation-0.json', etat, true); console.log('amorce :', profil.monde.amorce);
  }
  const tampon = lire('tampon.json', { lisse: {}, derniere_lecture: '1970-01-01T00:00:00Z' });
  let historique = lire('historique.json', []);
  const ms = (c => { const n = parseFloat(c) || 24; return c.endsWith('d') ? n * 864e5 : c.endsWith('m') ? n * 6e4 : n * 36e5; })(profil.monde?.cycle || '24h');
  for (let k = 0; k < nCycles; k++) {
    const enLigne = await lotsEnLigne(tampon.derniere_lecture), locaux = lotsLocaux(), lots = [...enLigne, ...locaux];
    const r = Tampon.agreger(lots, etat, profil, tampon);
    const suivant = Orvane.cycle(etat, r.pressions, { duree_ms: ms });
    if (k === nCycles - 1) suivant.cycle.date = new Date().toISOString();   // le dernier cycle est daté de maintenant : les traducteurs s'y réfèrent
    tampon.lisse = r.etat.lisse; if (enLigne.length) tampon.derniere_lecture = enLigne[enLigne.length - 1]._recu;
    historique = [...historique.filter(h => h.cycle.n < suivant.cycle.n), alleger(suivant)].slice(-365);
    etat = suivant; ranger(locaux);
    const vivants = etat.taxons.filter(t => !t.eteint).length, ind = Math.round(etat.taxons.reduce((s, t) => s + t.populations.reduce((x, p) => x + p.effectif, 0), 0));
    console.log(`${monde} · cycle ${etat.cycle.n} · ${lots.length} lot(s) (${enLigne.length} en ligne, ${locaux.length} du dossier), ${r.pressions.nombre} événement(s) · ${vivants} taxons vivants, ${ind} individus · ${etat.evenements.length} événement(s) du vivant`);
    for (const e of etat.evenements) console.log(`   ★ ${e.type} — ${e.taxon}${e.biome ? ' @' + e.biome : ''}${e.detail ? ' : ' + e.detail : ''}`);
  }
  ecrire('etat.json', etat); ecrire('instantane.json', etat, true); ecrire('historique.json', historique, true); ecrire('tampon.json', tampon);
  console.log(`→ ${path.relative(process.cwd(), f('instantane.json'))}`);
})().catch(e => { console.error('cycle interrompu :', e.message); process.exit(1); });
