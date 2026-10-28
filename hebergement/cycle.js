// Orvane — LE CYCLE NOCTURNE (hebergement/cycle.js)
// Fait tourner un monde d'un cycle : lit les lots de pressions déposés depuis le cycle précédent, les passe au
// tampon, fait tourner le moteur, publie l'instantané. Lancé par l'action GitHub (.github/workflows/cycle.yml)
// ou à la main. Un monde = un dossier mondes/<id>/ :
//   profil.json        le profil du jeu (réglage du tampon)
//   etat.json          l'instantané courant, complet (le moteur repart de là)
//   instantane.json    le même, publié : c'est ce que les traducteurs lisent (GitHub Pages sert avec CORS *)
//   historique.json    les derniers cycles (365, ou profil.monde.historique), allégés (effectifs, fréquences, événements) : pour l'observatoire
//   tampon.json        la mémoire du tampon (lissage) et la dernière ligne lue (dernier_id)
//   lots/              (facultatif) des lots déposés à la main ; lus en plus de Supabase, puis déplacés dans lots/traites/
//   node hebergement/cycle.js sv-1 [--sans-reseau] [--cycles N] [--rodage N] [--forcer]   (rodage : au premier cycle seulement ;
//   --forcer : faire tourner un monde dont le profil dit monde.nocturne = false, comme une genèse à observer)
// Les lots en ligne viennent de la table orvane_pressions (traducteurs/stone-valley/supabase.sql), lue par la fonction
// orvane_lire_lots avec le secret de lecture d'Orvane (profil.monde.pressions, voir lotsEnLigne). Sans lui, ou avec
// --sans-reseau, seuls les lots du dossier comptent.
'use strict';
const fs = require('fs'), path = require('path');
const Orvane = require('../moteur/orvane.js'), Tampon = require('../tampon/tampon.js');
const a = process.argv.slice(2), monde = a.find(x => !x.startsWith('--')) || 'sv-1', sansReseau = a.includes('--sans-reseau');
const arg = (k, defaut) => { const i = a.indexOf(k); return i >= 0 && a[i + 1] != null ? +a[i + 1] : defaut; };
const nCycles = arg('--cycles', 1) || 1;
const D = path.join(__dirname, '..', 'mondes', monde), f = n => path.join(D, n);
const lire = (n, defaut) => fs.existsSync(f(n)) ? JSON.parse(fs.readFileSync(f(n), 'utf8')) : defaut;
const ecrire = (n, o, compact) => fs.writeFileSync(f(n), compact ? JSON.stringify(o) : JSON.stringify(o, null, 1));

// Les lots en ligne. Deux chemins :
//  - le monde dit où lire (profil.monde.pressions : { url, cle, secret }) : la fonction orvane_lire_lots du projet
//    Supabase du jeu, appelée avec sa clé publique et le secret de lecture d'Orvane (variable d'environnement nommée par
//    « secret », ORVANE_LECTURE_SECRET par défaut). L'action n'a jamais la clé de service du jeu. Lu par pages de 1000,
//    d'après l'identifiant de la dernière ligne lue (tampon.dernier_id) ; le compte arrive pseudonymisé.
//  - à l'ancienne : SUPABASE_URL et SUPABASE_SERVICE_KEY dans l'environnement, lecture directe de la table.
async function lotsEnLigne(tampon, profil) {
  if (sansReseau) return [];
  const Pp = profil.monde?.pressions, secret = Pp && process.env[Pp.secret || 'ORVANE_LECTURE_SECRET'];
  if (Pp && Pp.url && Pp.cle && secret) {
    const out = []; let apres = tampon.dernier_id || 0;
    for (let page = 0; page < 200; page++) {
      const r = await fetch(`${Pp.url.replace(/\/$/, '')}/rest/v1/rpc/${Pp.fonction || 'orvane_lire_lots'}`, { method: 'POST',
        headers: { apikey: Pp.cle, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_secret: secret, p_monde: monde, p_apres: apres, p_limite: 1000 }) });
      if (!r.ok) throw new Error(`Supabase ${r.status} : ${await r.text()}`);
      const rows = await r.json();
      for (const x of rows) { const lot = x.lot || {}; lot.source = { ...(lot.source || {}), compte: x.compte }; lot._id = x.id; lot._recu = x.recu; out.push(lot); }
      if (rows.length < 1000) break; apres = rows[rows.length - 1].id;
    }
    return out;
  }
  const url = process.env.SUPABASE_URL, cle = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !cle) return [];
  const q = `${url.replace(/\/$/, '')}/rest/v1/orvane_pressions?select=id,lot,compte,recu&monde=eq.${encodeURIComponent(monde)}&id=gt.${tampon.dernier_id || 0}&order=id.asc&limit=1000`;
  // une clé de service à l'ancienne (un JWT) va aussi dans Authorization ; une clé « sb_secret_… » n'y va pas (ce n'est pas un JWT)
  const r = await fetch(q, { headers: cle.startsWith('sb_') ? { apikey: cle } : { apikey: cle, Authorization: 'Bearer ' + cle } });
  if (!r.ok) throw new Error(`Supabase ${r.status} : ${await r.text()}`);
  const rows = await r.json();
  return rows.map(x => { const lot = x.lot || {}; lot.source = { ...(lot.source || {}), compte: 'u:' + String(x.compte).slice(0, 8) }; lot._id = x.id; lot._recu = x.recu; return lot; });
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
// les traits continus d'un taxon, en une moyenne pondérée par les effectifs (l'observatoire en trace l'évolution)
const quantMoyen = t => { const P = t.populations.filter(p => p.quant), W = P.reduce((a, p) => a + p.effectif, 0); if (!P.length || !W) return null;
  return Object.fromEntries(Object.keys(P[0].quant).map(k => [k, +(P.reduce((a, p) => a + p.effectif * (p.quant[k]?.m || 0), 0) / W).toFixed(3)])); };
const alleger = I => ({ cycle: I.cycle, taxons: I.taxons.map(t => ({ id: t.id, nom: t.nom, parent: t.parent, apparu: t.apparu, eteint: t.eteint, statut: t.statut,
  populations: t.populations.map(p => ({ biome: p.biome, effectif: p.effectif })), phenotypes: t.phenotypes.map(p => ({ id: p.id, frequence: p.frequence, traits: p.traits })),
  ...(quantMoyen(t) ? { quant: quantMoyen(t) } : {}) })),
  biomes: I.biomes.map(b => ({ id: b.id, capacite: Math.round(b.capacite) })), evenements: I.evenements || [] });

(async () => {
  const profil = lire('profil.json'); if (!profil) throw new Error(`pas de profil : ${f('profil.json')}`);
  if (profil.monde?.nocturne === false && !a.includes('--forcer')) { console.log(`${monde} : pas de cycle nocturne (profil.monde.nocturne = false ; --forcer pour le faire tourner)`); return; }
  let etat = lire('etat.json');
  if (!etat) {   // premier cycle : on part de l'amorce, et on la publie telle quelle (generation-0.json) : les traducteurs s'y comparent
    const am = profil.monde?.amorce && path.join(__dirname, '..', profil.monde.amorce);
    if (!am || !fs.existsSync(am)) throw new Error('pas d\'état ni d\'amorce');
    etat = JSON.parse(fs.readFileSync(am, 'utf8')); console.log('amorce :', profil.monde.amorce);
    const rodage = arg('--rodage', profil.monde?.rodage || 0) || 0;   // le monde tourne seul jusqu'à son équilibre avant d'être publié
    for (let k = 0; k < rodage; k++) etat = Orvane.cycle(etat, {}, { duree_ms: 0 });
    if (rodage) { etat.cycle.n = 0; etat.evenements = []; for (const t of etat.taxons) for (const p of t.populations) p.depuis = Math.min(p.depuis ?? 0, 0); console.log(`rodage : ${rodage} cycles ; la génération 0 est l'équilibre atteint`); }
    etat.monde.ne = new Date().toISOString();   // la naissance du monde : avec son id, c'est son identité (un monde refait de zéro change de date)
    ecrire('generation-0.json', etat, true);
  }
  if (profil.monde?.annee != null) etat.monde.annee = profil.monde.annee;   // la durée de l'année suit le profil
  const tampon = lire('tampon.json', { lisse: {}, dernier_id: 0 });
  let lectureEchouee = false;
  const gen0 = lire('generation-0.json', null);   // la référence du mode relatif (profil.exposition.mode)
  let avant = etat;
  let historique = lire('historique.json', []);
  const ms = (c => { const n = parseFloat(c) || 24; return c.endsWith('d') ? n * 864e5 : c.endsWith('m') ? n * 6e4 : n * 36e5; })(profil.monde?.cycle || '24h');
  for (let k = 0; k < nCycles; k++) {
    // une lecture qui échoue n'arrête pas le monde : il tourne sans les lots en ligne (ils restent dans Supabase et seront lus
    // la fois suivante, dernier_id n'avance pas), et l'action le signale en clair
    let enLigne = [];
    try { enLigne = await lotsEnLigne(tampon, profil); }
    catch (e) { lectureEchouee = true; const m = String(e.message || e);
      const pourquoi = /secret invalide/.test(m) ? 'le secret ORVANE_LECTURE_SECRET du dépôt ne correspond pas à celui enregistré dans Supabase : recopiez-le exactement, sans espace ni guillemets (Settings › Secrets and variables › Actions)'
        : /\b40[13]\b/.test(m) ? 'Supabase refuse la lecture : vérifiez la clé publique et l\'URL dans profil.monde.pressions' : m;
      console.log(`::error title=${monde} · lecture des pressions::${pourquoi}. Le cycle tourne sans les lots en ligne ; ils seront lus la prochaine fois.`); }
    const locaux = lotsLocaux(), lots = [...enLigne, ...locaux];
    const r = Tampon.agreger(lots, etat, profil, tampon, gen0);
    const suivant = Orvane.cycle(etat, r.pressions, { duree_ms: ms });
    if (k === nCycles - 1) suivant.cycle.date = new Date().toISOString();   // le dernier cycle est daté de maintenant : les traducteurs s'y réfèrent
    tampon.lisse = r.etat.lisse; tampon.lisseQ = r.etat.lisseQ; if (enLigne.length) { tampon.dernier_id = enLigne[enLigne.length - 1]._id; tampon.derniere_lecture = enLigne[enLigne.length - 1]._recu; }
    historique = [...historique.filter(h => h.cycle.n < suivant.cycle.n), alleger(suivant)].slice(-(profil.monde?.historique || 365));   // profil.monde.historique : combien de cycles garder (365 par défaut)
    avant = etat; etat = suivant; ranger(locaux);
    const vivants = etat.taxons.filter(t => !t.eteint).length, ind = Math.round(etat.taxons.reduce((s, t) => s + t.populations.reduce((x, p) => x + p.effectif, 0), 0));
    console.log(`${monde} · cycle ${etat.cycle.n} · ${lots.length} lot(s) (${enLigne.length} en ligne, ${locaux.length} du dossier), ${r.pressions.nombre} événement(s) · ${vivants} taxons vivants, ${ind} individus · ${etat.evenements.length} événement(s) du vivant`);
    for (const e of etat.evenements) console.log(`   ★ ${e.type} — ${e.taxon}${e.biome ? ' @' + e.biome : ''}${e.detail ? ' : ' + e.detail : ''}`);
  }
  // l'instantané publié porte le cycle d'avant, allégé : tous les traducteurs interpolent entre les deux de la même façon
  const pr = alleger(avant);
  ecrire('etat.json', etat); ecrire('instantane.json', { ...etat, precedent: { cycle: pr.cycle.n, taxons: pr.taxons.map(t => ({ id: t.id, populations: t.populations, phenotypes: t.phenotypes.map(p => ({ id: p.id, frequence: p.frequence })) })) } }, true); ecrire('historique.json', historique, true); ecrire('tampon.json', tampon);
  console.log(`→ ${path.relative(process.cwd(), f('instantane.json'))}`);
  if (lectureEchouee) process.exitCode = 2;          // le monde est publié, mais l'action se marque en échec pour qu'on le voie
})().catch(e => { console.error('cycle interrompu :', e.message); process.exit(1); });
