// Orvane × Stone Valley — LE TRADUCTEUR (orvane-sv.js)
// Chargé par index.html comme donjon.js, après corps.js, tampon.js et correspondance.js. Le jeu appelle, s'ils existent :
//  - orvaneEspeces()              une fois les fiches du jeu posées (SPEC, specById) : les lignées nées dans Orvane
//                                 rejoignent SPEC (§210) ;
//  - orvaneAppliquer()            à l'arrivée sur une île, avant tirerBestiaire() : règle POIDS_ESPECE et sp.cap
//                                 d'après l'état du vivant dans Orvane (sens Orvane → jeu) ;
//  - orvaneVariante(sp, r)        dans tirerVariante() : tire le phénotype d'une bête qui naît, et le rend en variante
//                                 du jeu (robe | taille-ornement) ; undefined ⇒ le jeu tire comme avant ;
//  - orvaneNaissance(b, mere)     juste après tirerVariante() : le phénotype exact de la bête, ses conduites (§211), et
//                                 ses traits continus — taille, allure, audace — tirés dans la loi de sa population (§212) ;
//                                 née d'une mère connue, elle lui ressemble (§213, hérédité mendélienne) ;
//  - orvaneEvenement(action, b, cause)  dans mourirBete() ('prelevement') et lier() ('capture') ;
//  - orvaneLot()                  le lot de pressions accumulé (schemas/pression.schema.json) ;
//  - orvaneEnvoyer(rpc, compte)   après une sauvegarde réussie : pousse le lot vers Supabase (vp_orvane_pression),
//                                 une fois par demi-heure au plus (48 dépôts par jour, c'est la limite du serveur).
// Les rencontres (l'exposition) sont relevées toutes les dix secondes : une bête sauvage à moins de douze pas.
// Tout ce qui est propre au jeu est dans correspondance.js ; tout ce qui est réglage est dans profil.json.
// Rien ne casse si Orvane est injoignable : sans instantané, le jeu reste exactement ce qu'il était.
//
// LES LIGNÉES (§210). Un taxon d'Orvane qui n'est pas une espèce du jeu (« crapaud.tourbiere », né d'une séparation, ou
// une lignée d'un monde né de la genèse) devient une fiche du jeu : celle de son plus proche ancêtre connu du jeu (ou,
// sans ancêtre, d'un gabarit selon son régime : correspondance.js), avec son nom, sa taille (d'après sa masse), sa
// vitesse, ses couleurs et ses sols. Son corps :
//  - rendu par le parent tant qu'il lui ressemble : le dessin de l'espèce mère, à ses couleurs et à sa taille ;
//  - construit (lignees.js, osOrvane) dès qu'il s'en écarte : autre forme, autres pattes, des ailes gagnées, ou un écart
//    de silhouette (moteur/corps.js, distance) d'au moins SEUIL_CORPS — et toujours pour une lignée sans ancêtre.
// Les fiches des lignées sont gardées en mémoire locale : une compagne liée garde la sienne même si la lignée s'éteint.
// Une espèce inconnue de forme « parent.biome » (la compagne d'un autre joueur, une sauvegarde venue d'un autre appareil)
// est rendue par son parent (specById la résout à la demande).
(function (racine) {
'use strict';
// d'où viennent instantane.json, generation-0.json et profil.json : un dossier à côté du jeu, ou le monde publié par
// le dépôt Orvane (GitHub Pages sert avec CORS *) — poser ORVANE_CHEMIN avant de charger ce script pour le changer
const CLE = 'stone_valley:orvane', CHEMIN = racine.ORVANE_CHEMIN || 'orvane/';
// les morts qui comptent comme prélèvements du joueur : ses armes, ses sorts, ses tours, ses compagnes.
// Pas « faim », pas « proie » (une bête de l'île qui en tue une autre : Orvane simule déjà la prédation), pas « défense ».
const CAUSES_JOUEUR = new Set(['chassé', 'flèche', 'combat', 'piétiné', 'explosé', 'tour', 'satellite', 'brisé', 'tir', 'bêta', 'compagne']);
const RAYON_RENCONTRE = 12, PERIODE_RENCONTRE = 10000, COMMUNS = [1, 2, 3, 4, 5, 6, 7];
const ENVOI_MIN = 30 * 60e3, REESSAI = 5 * 60e3, LIGNEES_MAX = 200, SEUIL_CORPS = .3;
const Corr = racine.OrvaneSV_Corr, Tampon = racine.OrvaneTampon, Corps = racine.OrvaneCorps;
const S = { courant: null, gen0: null, profil: null, monde: null, lot: {}, lotQ: {}, depuis: null, dernierEnvoi: 0, envoi: false,
  lignees: {}, poids0: null, cap0: null, vus: new WeakSet(), compte: null, pret: false, qIle: {} };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), r2 = v => Math.round(v * 100) / 100;

// --- mémoire locale (l'instantané, la génération 0, les lignées et le lot survivent à la fermeture) ---
function lire() { try { const m = JSON.parse(localStorage.getItem(CLE) || '{}'); S.courant = m.courant || null; S.gen0 = m.gen0 || null; S.profil = m.profil || null;
  S.monde = m.monde || null; S.lot = m.lot || {}; S.depuis = m.depuis || null; S.dernierEnvoi = m.dernierEnvoi || 0; S.lignees = m.lignees || {}; S.lotQ = m.lotQ || {}; } catch (e) { } }
function ecrire() { try { localStorage.setItem(CLE, JSON.stringify({ courant: S.courant, gen0: S.gen0, profil: S.profil, monde: S.monde, lot: S.lot, depuis: S.depuis,
  dernierEnvoi: S.dernierEnvoi, lignees: S.lignees, lotQ: S.lotQ })); } catch (e) { } }
// l'identité d'un monde : son id et sa naissance (un monde refait de zéro garde son id, pas sa date)
const identite = inst => inst?.monde ? inst.monde.id + '|' + (inst.monde.ne || inst.monde.graine) : null;
async function charger() {
  lire();
  const prendre = async f => { try { const r = await fetch(CHEMIN + f, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  const [inst, profil] = await Promise.all([prendre('instantane.json'), prendre('profil.json')]);
  if (profil) S.profil = profil;
  if (inst) {
    const id = identite(inst);
    if (id !== S.monde) { S.monde = id; S.courant = null; S.gen0 = null; }             // un autre monde, ou le même refait : on repart de sa génération 0
    if (!S.courant || inst.cycle.n > S.courant.cycle.n) S.courant = inst;
  }
  if (S.courant && !S.gen0) S.gen0 = await prendre('generation-0.json') || S.courant;   // faute de génération 0, le premier instantané vu
  ecrire(); inscrireLignees();
}

// --- le temps : l'avancement entre le cycle d'avant (joint à l'instantané) et celui-ci ---
function dureeCycle() { const c = S.profil?.monde?.cycle || '24h', n = parseFloat(c) || 24; return c.endsWith('d') ? n * 864e5 : c.endsWith('m') ? n * 6e4 : n * 36e5; }
function avancement() {
  if (!S.courant?.precedent || !S.profil) return 1;
  const t = (Date.now() - Date.parse(S.courant.cycle.date)) / dureeCycle();
  return clamp(t / (S.profil.exposition.propagation_cycles || 1), 0, 1);
}
const mele = (a, b, k) => a + (b - a) * k;

// --- les taxons ---
const taxon = (inst, tid) => inst?.taxons.find(x => x.id === tid) || null;
function effectifSur(inst, tid, biomes) { const t = taxon(inst, tid); if (!t || t.eteint) return 0; return t.populations.filter(p => biomes.has(p.biome)).reduce((a, p) => a + p.effectif, 0); }
function biomesIle() {
  let rares = []; try { rares = typeof RaresIle !== 'undefined' ? RaresIle : []; } catch (e) { }
  if (!rares.length) try { rares = typeof biomesGraine === 'function' && typeof SEED !== 'undefined' ? biomesGraine(SEED) : []; } catch (e) { }
  return new Set([...COMMUNS, ...rares].map(Corr.biomeOrvane).filter(Boolean));
}
const especeJeu = id => { try { const sp = typeof specById !== 'undefined' && Object.prototype.hasOwnProperty.call(specById, id) ? specById[id] : null; return sp && !sp.orvane ? sp : null; } catch (e) { return null; } };
// le plus proche ancêtre d'un taxon qui est une espèce du jeu (pas une lignée) : par les parents d'Orvane, ou par l'identifiant
function ancetreJeu(tid) {
  const vus = new Set(); let id = tid;
  while (id && !vus.has(id)) { vus.add(id); if (especeJeu(id)) return id;
    const t = taxon(S.courant, id) || taxon(S.gen0, id); id = t?.parent || (id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : null); }
  return null;
}
const taxonDe = sp => sp?.orvane ? sp.orvane.taxon : Corr.taxonDe(sp?.id, S.courant);

// === les lignées : d'un taxon d'Orvane, une fiche du jeu ===
// « Crapaud-buffle (Tourbière) » → « Crapaud-buffle de tourbière »
function nomJeu(nom, id) {
  const m = /^(.*?)\s*\((.*)\)$/.exec(nom || ''); if (!m) return nom || id;
  const b = m[2].toLowerCase(); return `${m[1]} ${/^[aeiouyéèh]/.test(b) ? 'd\'' : 'de '}${b}`;
}
// les traits que porte au moins la moitié de la lignée : ils font partie de son allure
function traitsDominants(t) { const c = {}; for (const p of t.phenotypes) for (const id of p.traits) c[id] = (c[id] || 0) + p.frequence; return Object.keys(c).filter(k => c[k] >= .5); }
function definir(t) {
  const anc = ancetreJeu(t.id), baseId = anc || Corr.gabaritDe(t.plan), base = especeJeu(baseId); if (!base) return null;
  const ref = anc ? taxon(S.gen0, anc) || taxon(S.courant, anc) : null;
  const corpsBase = ref?.plan?.corps ? Corps.normaliser(ref.plan.corps) : Corr.corpsDe(base);
  const corps = t.plan.corps && Corps ? Corps.normaliser(t.plan.corps) : null;
  const ailes = c => (c?.ailes || 0) >= .5;
  const genere = !!corps && (!anc || corps.forme !== corpsBase.forme || corps.pattes !== corpsBase.pattes || ailes(corps) !== ailes(corpsBase) || Corps.distance(corps, corpsBase) >= SEUIL_CORPS);
  const bio = [...new Set(t.populations.filter(p => p.effectif >= 1).map(p => Corr.biomeSV(p.biome)).filter(Boolean))];
  return { id: t.id, nom: nomJeu(t.nom, t.id), base: baseId, gabarit: !anc, genere, corps, traits: traitsDominants(t), bio,
    masse: t.plan.masse_kg, masseRef: ref?.plan?.masse_kg || 25 * base.sz ** 3, vit: t.plan.vitesse_rel, vitRef: ref?.plan?.vitesse_rel || base.spd * 2,
    nocturne: t.plan.activite === 'nocturne', locomotion: t.plan.locomotion || [], vu: Date.now() };
}
// la fiche du jeu : une copie de celle de l'ancêtre (sa conduite), à la mesure de la lignée
function appliquerDef(sp, def, base) {
  for (const k in base) if (!(k in sp) || k === 'cap' || k === 'spd' || k === 'sz') { const v = base[k]; sp[k] = Array.isArray(v) ? v.slice() : v; }
  sp.id = def.id; sp.n = def.nom;
  sp.orvane = { taxon: def.id, base: def.base, gabarit: def.gabarit, genere: !!def.genere && typeof osOrvane === 'function', corps: def.corps, traits: def.traits || [], locomotion: def.locomotion || [] };
  const k = def.gabarit ? 1 : clamp(Math.cbrt((def.masse || 1) / (def.masseRef || 1)), .6, 1.7);
  sp.sz = def.gabarit ? r2(clamp(Math.cbrt((def.masse || 1) / 25), .45, 2.2)) : r2(base.sz * k);
  sp.spd = r2(base.spd * clamp((def.vit || 1) / (def.vitRef || 1), .7, 1.4));
  if (def.corps) { const C = def.corps.couleurs; sp.shell = C.robe.slice(); sp.dark = C.sombre.slice(); sp.leg = C.sombre.map(v => v * .8 | 0); sp.oeil = C.oeil.slice(); sp.ventre = C.ventre.slice(); }
  if (def.nocturne) sp.nuit = true;
  if (def.bio && def.bio.length) sp.bio = def.bio.slice();
  if (base.biome) {                                                   // un Tellurien : son sol rare, s'il en a un ; sinon, les sols ordinaires
    let rares = []; try { rares = typeof RARES !== 'undefined' ? RARES : []; } catch (e) { }
    const r = (def.bio || []).find(b => rares.some(x => x.b === b));
    if (r) { sp.biome = r; const h = rares.find(x => x.b === r).coul; sp.pierre = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); } else delete sp.biome;
  }
  return sp;
}
function enregistrer(def) {
  if (typeof SPEC === 'undefined' || typeof specById === 'undefined') return null;
  const base = especeJeu(def.base); if (!base) return null;
  let sp = Object.prototype.hasOwnProperty.call(specById, def.id) ? specById[def.id] : null;
  if (sp && !sp.orvane) return sp;                                    // une espèce du jeu porte déjà ce nom
  const neuf = !sp; sp = appliquerDef(sp || {}, def, base);
  if (neuf) { SPEC.push(sp); specById[sp.id] = sp; }
  if (sp.orvane) sp.orvane._m = null;                                 // les mesures du corps se refont
  try { if (typeof DESSINS !== 'undefined') DESSINS['bete_' + sp.id] = d => sp.orvane.genere || !DESSINS['bete_' + def.base] ? (typeof dessinOrvane === 'function' ? dessinOrvane(d, sp) : null) : DESSINS['bete_' + def.base](d); } catch (e) { }
  for (const o of SPEC) if (o !== sp && Array.isArray(o.chasse) && o.chasse.includes(def.base) && !o.chasse.includes(sp.id)) o.chasse.push(sp.id);   // ses prédateurs sont ceux de son ancêtre
  completer(sp);
  return sp;
}
// les tables du jeu tenues par espèce : la lignée prend les lignes de son ancêtre (sa viande, ses aptitudes, son combat,
// sa voix…). Certaines tables ne sont pas encore posées quand les lignées arrivent : on repasse à chaque île.
function completer(sp) {
  const b = sp.orvane.base, id = sp.id, alias = T => { if (T && T[b] !== undefined && T[id] === undefined) T[id] = T[b]; };
  try { alias(APT); } catch (e) { } try { alias(COMBAT); } catch (e) { } try { alias(VOIX); } catch (e) { } try { alias(FACONS); } catch (e) { }
  try { alias(BONDIT); } catch (e) { } try { alias(PECHE_APT); } catch (e) { } try { alias(FRIANDISE_APT); } catch (e) { } try { alias(COMPETENCES); } catch (e) { }
  try { if (INGR['v_' + b] && !INGR['v_' + id]) INGR['v_' + id] = INGR['v_' + b]; } catch (e) { }
}
function inscrireLignees() {
  if (!S.pret || !Corps) return;
  if (S.courant) for (const t of S.courant.taxons) {
    if (t.eteint || especeJeu(t.id)) continue;
    const def = definir(t); if (def) S.lignees[t.id] = def;
  }
  // la mémoire est bornée : on oublie d'abord les lignées éteintes les plus anciennes
  const ids = Object.keys(S.lignees);
  if (ids.length > LIGNEES_MAX) { const vivants = new Set((S.courant?.taxons || []).filter(t => !t.eteint).map(t => t.id));
    for (const id of ids.filter(i => !vivants.has(i)).sort((a, b) => (S.lignees[a].vu || 0) - (S.lignees[b].vu || 0)).slice(0, ids.length - LIGNEES_MAX)) delete S.lignees[id]; }
  for (const def of Object.values(S.lignees)) enregistrer(def);
}
// une espèce inconnue « parent.biome » : on la rend par son parent, le temps qu'Orvane dise qui elle est
function especeDeSecours(id) {
  if (S.lignees[id]) return enregistrer(S.lignees[id]);
  let p = id; while (p.includes('.')) { p = p.slice(0, p.lastIndexOf('.')); if (especeJeu(p)) break; }
  const base = especeJeu(p); if (!base) return null;
  const suffixe = id.slice(id.lastIndexOf('.') + 1), b = Corr.BIOMES_SV[Corr.biomeSV(suffixe)];
  return enregistrer({ id, nom: b ? nomJeu(`${base.n} (${b.nom})`, id) : base.n, base: p, gabarit: false, genere: false, corps: null, traits: [], bio: base.bio, masse: 1, masseRef: 1, vit: 1, vitRef: 1 });
}

// === le jeu → le traducteur : les fiches sont posées ===
function orvaneEspeces() {
  S.pret = true;
  try {   // specById résout à la demande les lignées qu'il ne connaît pas encore (« crapaud.tourbiere »)
    if (typeof specById !== 'undefined' && !specById.__orvane) {
      const proto = Object.getPrototypeOf(specById) || Object.prototype;
      Object.defineProperty(specById, '__orvane', { value: true });
      Object.setPrototypeOf(specById, new Proxy(proto, { get(cible, id, recu) {
        if (typeof id === 'string' && id.includes('.') && !(id in cible)) { const sp = especeDeSecours(id); if (sp) return sp; }
        return Reflect.get(cible, id, recu); } }));
    }
  } catch (e) { }
  inscrireLignees();
}

// === Orvane → jeu : l'arrivée sur une île ===
// Les poids et les comptes suivent l'état du monde à ce cycle (pas d'interpolation : la même île donne la même faune à
// tous ceux qui ont le même instantané). Une espèce s'efface d'une île quand son effectif sur ses sols tombe sous
// seuil_extinction_jeu ET sous seuil_extinction_part de ce qu'il était à la génération 0. Une lignée prend la part
// de son ancêtre à proportion de ses effectifs ; une lignée sans ancêtre, la part d'une espèce moyenne.
function orvaneAppliquer() {
  if (typeof SPEC === 'undefined' || typeof POIDS_ESPECE === 'undefined') return;
  S.qIle = {};                                                        // les traits continus se relisent pour chaque île
  if (!S.poids0) { S.poids0 = { ...POIDS_ESPECE }; S.cap0 = Object.fromEntries(SPEC.filter(sp => !sp.orvane).map(sp => [sp.id, sp.cap])); }
  for (const sp of SPEC) {                                            // tout reprend sa valeur d'avant, à chaque île
    if (sp.orvane) { sp.cap = 0; delete POIDS_ESPECE[sp.id]; completer(sp); continue; }
    if (sp.id in S.cap0) sp.cap = S.cap0[sp.id];
    if (sp.id in S.poids0) POIDS_ESPECE[sp.id] = S.poids0[sp.id];
  }
  if (!S.courant || !S.gen0) return;                                 // rien reçu : le jeu reste tel quel
  const ile = biomesIle(), X = S.profil?.exposition || {}, seuil = X.seuil_extinction_jeu ?? 0, part = X.seuil_extinction_part ?? .25;
  const moyen = (() => { const v = S.gen0.taxons.map(t => effectifSur(S.gen0, t.id, ile)).filter(x => x > 0); return v.length ? v.reduce((a, x) => a + x, 0) / v.length : 0; })();
  for (const sp of SPEC) {
    const tid = taxonDe(sp); if (!tid) continue;
    const L = sp.orvane, baseId = L ? L.base : sp.id;
    let ref = L && L.gabarit ? moyen : effectifSur(S.gen0, baseId, ile);
    if (!ref) { if (!L) continue; ref = moyen; }                      // l'espèce ne vivait pas sur ces sols : on ne touche à rien
    if (!ref) continue;
    const t = taxon(S.courant, tid), eff = t && !t.eteint ? effectifSur(S.courant, tid, ile) : 0;
    if (!t || t.eteint || eff <= 0 || eff < Math.min(seuil, ref * part)) { sp.cap = 0; delete POIDS_ESPECE[sp.id]; continue; }
    const ratio = eff / ref, cap0 = S.cap0[baseId] ?? sp.cap, poids0 = baseId in S.poids0 ? S.poids0[baseId] : L ? .3 : undefined;
    sp.cap = Math.max(1, Math.round(cap0 * Math.min(2, ratio)));
    if (poids0 != null) POIDS_ESPECE[sp.id] = +(poids0 * Math.min(3, ratio)).toFixed(4);
  }
}

// === Orvane → jeu : la naissance d'une bête ===
// Mode relatif (profil) : deux tirages indépendants. L'ALLURE (robe, taille) aux taux du jeu × l'écart du monde depuis la
// génération 0 — le jour un, exactement comme avant. Les CONDUITES (traits non rendus) à leur fréquence réelle : un
// crapaud sur 170 a des yeux de nuit si c'est ce que porte le monde. Le phénotype tiré attend orvaneNaissance(b).
const tirer = (D, u) => { for (const [k, p] of D) { if (u < p) return k; u -= p; } return D.length ? D[D.length - 1][0] : ''; };
function orvaneVariante(sp, r = Math.random) {
  S.dernier = null;
  if (!S.courant || !Tampon || !S.profil) return undefined;
  const tid = taxonDe(sp), t = tid && taxon(S.courant, tid); if (!t) return undefined;
  const cat = S.courant.catalogue?.traits || {}, ref = Tampon.referenceDe(tid, S.courant, S.gen0), X = S.profil.exposition || {};
  const boost = typeof chanceVariante === 'function' ? chanceVariante() : 1;   // le jeu rend les variantes plus fréquentes loin de chez soi : on garde cette règle
  const fam = typeof familleBete === 'function' ? familleBete(sp) : '';
  let orn = null; try { orn = typeof ORNEMENTS_DE !== 'undefined' ? ORNEMENTS_DE[fam] : null; } catch (e) { }
  // le cycle d'avant (joint à l'instantané) : on glisse de l'un à l'autre sur propagation_cycles
  const pr = S.courant.precedent?.taxons?.find(x => x.id === tid), k = avancement();
  const tPrec = pr && k < 1 ? { id: tid, phenotypes: pr.phenotypes.map(p => ({ ...p, traits: p.id === 'base' ? [] : p.id.split('+') })) } : null;
  if (X.mode === 'relatif' && X.non_rendus !== 'base' && Tampon.partsRelatif) {
    const A = Tampon.partsRelatif(t, S.profil, ref), B = tPrec ? Tampon.partsRelatif(tPrec, S.profil, ref) : null;
    const meler = (a, b) => { const o = {}; for (const key of new Set([...Object.keys(a), ...Object.keys(b || {})])) o[key] = b ? mele(b[key] || 0, a[key] || 0, k) : a[key] || 0; return o; };
    const G = meler(A.G, B && B.G), M = meler(A.M, B && B.M);
    // l'allure : chaque signature rendue × chanceVariante ; le reste, pas de variante
    const sig = []; let reste = 1; for (const [s, p] of Object.entries(G)) if (s && p > 0) { const f = Math.min(1, p * boost); sig.push([s, f]); reste -= f; }
    if (reste < 0) { for (const q of sig) q[1] /= 1 - reste; reste = 0; }
    const u = r(), s = u < reste ? '' : tirer(sig, u - reste);
    const a = tirer(Object.entries(M).filter(([, p]) => p > 0), r() * Object.values(M).reduce((x, p) => x + Math.max(0, p), 0));
    const ph = A.phen[s + '|' + a] || (a && A.phen['|' + a]) || A.phen[s + '|'] || t.phenotypes[0].id;
    S.dernier = { sp, ph, traits: a ? a.split('+') : [], taxon: tid, Gs: sig, M, carte: A.phen, fam, orn };   // (l'hérédité en a besoin si la bête a une mère)
    return s ? Corr.varianteDe(s.split('+'), fam, r, orn) : null;
  }
  // mode compression (ou non rendus fondus) : un seul tirage, sur les fréquences exposées
  const e = Tampon.exposer(t, S.profil, cat, null, ref), ep = tPrec ? Tampon.exposer(tPrec, S.profil, cat, null, ref) : null;
  const base = t.phenotypes[0].id, P = new Map(t.phenotypes.map(p => [p.id, p])), freqs = []; let reste = 1;
  for (const [id, v] of Object.entries(e)) { if (id === base) continue;
    let f = ep && ep[id] != null ? mele(ep[id], v, k) : v; f = Math.min(1, f * boost);
    const traits = id.startsWith('~') ? id.slice(1).split('+') : P.get(id)?.traits || [];
    if (f > 0 && traits.length) { freqs.push([traits, f]); reste -= f; } }
  if (reste < 0) { for (const q of freqs) q[1] /= 1 - reste; reste = 0; }
  let u = r(); if (u < reste) return null;
  u -= reste;
  for (const [traits, f] of freqs) { if (u < f) return Corr.varianteDe(traits, fam, r, orn); u -= f; }
  return null;
}
// La bête née : son phénotype Orvane exact (pour le rapporter tel quel) et ses conduites (conduites.js les joue).
// Une lignée ajoute celles de ses modes de déplacement (un fouisseur s'enterre).
function orvaneNaissance(b, mere) {
  if (!b || !b.sp) return;
  const D = S.dernier; S.dernier = null;
  const cat = S.courant?.catalogue?.traits || {}, loco = b.sp.orvane?.locomotion;
  if (D && D.sp === b.sp) { b.phen = D.ph; b.traits = D.traits; }   // (b.phen : b.ph est la phase de la foulée, dans le jeu)
  const deMere = D && D.sp === b.sp && D.Gs && mere && mere.sp === b.sp && mere.phen && !mere.dead;
  if (deMere) heriter(b, mere, D, cat);
  const c = Corr.conduitesDe(b.traits || [], cat, loco); if (c.length) b.conduites = c; else delete b.conduites;
  tirerQuant(b, deMere ? mere : null);
}
// === l'hérédité (§213, docs/9) : un petit né d'une mère connue lui ressemble ===
// Chaque trait se tire sachant ce que montre la mère, le père pris au hasard dans la population (Hardy-Weinberg ; la
// dominance est au catalogue). Une mère dorée (récessif) n'a de petits dorés que si le père porte l'allèle ; une mère
// géante (dominant) en a la moitié. Sur toutes les mères, la part des petits qui montrent un trait reste celle d'avant :
// les taux du jeu ne bougent pas, seules les portées se ressemblent.
function heriter(b, mere, D, cat) {
  const X = S.profil?.exposition || {}, T = X.taux_jeu || {}, R = X.traits_rendus || Object.keys(T), dom = id => cat[id]?.heredite !== 'recessif';
  const eR = {}; for (const [sg, f] of D.Gs) for (const id of sg.split('+')) eR[id] = (eR[id] || 0) + f;          // l'allure : la part qui montre chaque trait rendu, dans le jeu
  const mR = new Set(Corr.traitsDe(mere.variante || null)), pR = [];
  for (const id of R) { const e = eR[id] || 0; if (T[id] != null && e > 0 && Math.random() < Tampon.sachantMere(e, dom(id), mR.has(id))) pR.push(id); }
  const Mt = Object.values(D.M).reduce((a, x) => a + Math.max(0, x), 0) || 1, eM = {};                              // ce qui agit : à sa fréquence réelle
  for (const [a, p] of Object.entries(D.M)) if (a && p > 0) for (const id of a.split('+')) eM[id] = (eM[id] || 0) + p / Mt;
  const mM = new Set(mere.traits || []), pM = [];
  for (const [id, e] of Object.entries(eM)) if (Math.random() < Tampon.sachantMere(e, dom(id), mM.has(id))) pM.push(id);
  const s = Tampon.exprimer(pR, cat).join('+'), a = Tampon.exprimer(pM, cat).join('+');
  b.phen = D.carte[s + '|' + a] || (a && D.carte['|' + a]) || D.carte[s + '|'] || D.ph;
  b.traits = a ? a.split('+') : [];
  let v = s ? Corr.varianteDe(s.split('+'), D.fam, Math.random, D.orn) : null;
  const mo = /(geant|nain)-([a-z]+)/.exec(mere.variante || ''), vo = v && /(geant|nain)-([a-z]+)/.exec(v);
  if (mo && vo && mo[1] === vo[1]) v = v.replace(vo[0], mo[0]);                                                     // la même forme que sa mère : les mêmes cornes
  b.variante = v;
}
// === les traits continus (§212, docs/8) : la loi de la population de l'île, une valeur par bête ===
// La bête tire z dans N(m, v) et le garde (b.q) pour être rapportée telle quelle. Elle montre l'écart de sa population
// depuis la génération 0 (d), plus « variation » (profil) de son écart propre : à 0, toutes les bêtes d'une île ont
// l'allure de leur population et le jour un ne change rien ; à 1, toute la variation naturelle se voit.
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
function loiQ(sp) {
  const tid = taxonDe(sp); if (!tid || !S.courant || !Tampon?.quantDe) return null;
  if (!(tid in S.qIle)) { const t = taxon(S.courant, tid); S.qIle[tid] = t && !t.eteint ? Tampon.quantDe(t, biomesIle(), Tampon.referenceDe(tid, S.courant, S.gen0)) : null; }
  return S.qIle[tid];
}
function tirerQuant(b, mere) {
  const L = loiQ(b.sp), X = S.profil?.exposition?.quantitatifs; if (!L || !X) return;
  const vari = clamp(+X.variation || 0, 0, 1), catQ = S.courant?.catalogue?.quantitatifs || {}, q = {}, s = {};
  for (const k of X.rendus || []) { const x = L[k], J = Corr.QUANT_JEU?.[k]; if (!x || !J) continue;
    const zm = mere?.q?.[k], h2 = clamp((x.g ?? .4 * x.v) / x.v, 0, 1);                                // une mère connue : le petit tient d'elle (pente h²/2)
    const z = Number.isFinite(zm) ? x.m + h2 / 2 * (zm - x.m) + Math.sqrt(x.v * (1 - h2 * h2 / 4)) * gauss() : x.m + Math.sqrt(x.v) * gauss(), montre = clamp(x.d + vari * (z - x.m), -3.5, 3.5), f = J.vaut(montre, catQ[k]);
    q[k] = r2(z); s[k] = r2(montre); if (Math.abs(f - 1) >= .005) b[J.cle] = Math.round(f * 1000) / 1000; else delete b[J.cle]; }
  if (Object.keys(q).length) { b.q = q; b.qs = s; }
}
// ce que le panneau de la bête désignée en dit : une bête hors du commun parmi les siennes (une compagne : pour son
// espèce) ; une population de l'île qui a changé depuis la génération 0
function quantMots(b) {
  const L = [], s = b && b.qs; if (!s) return L;
  const Q = loiQ(b.sp);
  for (const [k, v] of Object.entries(s)) { const J = Corr.QUANT_JEU?.[k], ref = b.tame ? 0 : Q?.[k]?.d ?? 0; if (J && Math.abs(v - ref) >= 1.3) L.push(v > ref ? J.haut : J.bas); }
  if (Q && !b.tame) for (const k of S.profil?.exposition?.quantitatifs?.rendus || []) { const J = Corr.QUANT_JEU?.[k], d = Q[k]?.d; if (J && Math.abs(d) >= .6 && L.length < 3) L.push(J.ici[d > 0 ? 0 : 1]); }
  return L.slice(0, 3);
}
// les conduites d'un phénotype connu (une compagne qu'on recharge)
function conduitesPour(sp, traits) { return Corr.conduitesDe(traits || [], S.courant?.catalogue?.traits || {}, sp?.orvane?.locomotion); }

// === jeu → Orvane : les pressions ===
function phenotypeDe(t, variante) {
  const tr = Corr.traitsDe(variante).sort().join('+');
  return (t.phenotypes.find(p => p.traits.slice().sort().join('+') === tr) || t.phenotypes[0]).id;
}
function biomeDe(b) {
  let k = null; try { if (b && typeof bAt === 'function') k = bAt(b.x | 0, b.y | 0); } catch (e) { }
  if (!Corr.biomeOrvane(k)) try { k = typeof biomeIci !== 'undefined' ? biomeIci : null; } catch (e) { }
  return Corr.biomeOrvane(k);
}
function noter(action, b, variante, extra) {
  if (!S.courant || !b?.sp) return false;
  const tid = taxonDe(b.sp); if (!tid) return false;
  const t = taxon(S.courant, tid); if (!t) return false;
  const biome = biomeDe(b) || t.populations[0]?.biome; if (!biome) return false;
  const ph = action === 'rencontre' ? '' : typeof b.phen === 'string' && t.phenotypes.some(p => p.id === b.phen) ? b.phen : phenotypeDe(t, variante);   // le phénotype tiré à la naissance, sinon d'après la robe
  const cle = [tid, ph, biome, action, extra?.vers || ''].join('|');
  S.lot[cle] = (S.lot[cle] || 0) + 1; if (!S.depuis) S.depuis = new Date().toISOString();
  if (action !== 'rencontre' && b.q) { const A = S.lotQ[cle] ??= { n: 0, s: {} }; A.n++;   // la valeur exacte de la bête (§212)
    for (const [k, z] of Object.entries(b.q)) if (Number.isFinite(z)) A.s[k] = r2((A.s[k] || 0) + z); }
  return true;
}
function orvaneEvenement(action, b, cause) {
  if (!b || !b.sp) return;
  if (action === 'prelevement' && cause && !CAUSES_JOUEUR.has(cause)) return;   // morte de faim, ou sous un prédateur de l'île : ce n'est pas le joueur
  if (noter(action, b, b.variante)) ecrire();
}
function releverRencontres() {
  if (typeof beasts === 'undefined' || typeof P === 'undefined' || !S.courant) return;
  let n = 0;
  for (const b of beasts) { if (b.tame || b.dead || S.vus.has(b)) continue; if (Math.hypot(b.x - P.x, b.y - P.y) > RAYON_RENCONTRE) continue; S.vus.add(b); if (noter('rencontre', b, null)) n++; }
  if (n) ecrire();
}
function orvaneLot() {
  const ev = []; for (const [cle, n] of Object.entries(S.lot)) { const [taxon, phenotype, biome, action, vers] = cle.split('|'); const e = { taxon, biome, action, n }; if (phenotype) e.phenotype = phenotype; if (vers) e.vers = vers;
    const A = S.lotQ[cle]; if (A && A.n > 0) { e.q = {}; for (const [k, s] of Object.entries(A.s)) e.q[k] = r2(s / A.n); }
    ev.push(e); }
  if (!ev.length) return null;
  let zone; try { zone = typeof SEED !== 'undefined' ? 'ile:' + SEED : undefined; } catch (e) { }
  return { orvane: S.courant?.orvane || '0.1', monde: S.courant?.monde?.id || 'sv-1', instantane: S.courant?.cycle?.n ?? 0,
    source: { jeu: 'stone-valley', compte: S.compte || 'anonyme', zone }, periode: { debut: S.depuis || new Date().toISOString(), fin: new Date().toISOString() }, evenements: ev };
}
// une fois par demi-heure au plus ; on ne retire du lot que ce qui est parti (le serveur peut refuser : trop de dépôts)
async function orvaneEnvoyer(rpc, compte, forcer) {
  if (compte) S.compte = 'h:' + hachage(String(compte));
  const lot = orvaneLot(); if (!lot || typeof rpc !== 'function' || S.envoi) return false;
  if (!forcer && Date.now() - S.dernierEnvoi < ENVOI_MIN) return false;
  const parti = { ...S.lot }, partiQ = JSON.parse(JSON.stringify(S.lotQ)); S.envoi = true;
  try {
    const r = await rpc('vp_orvane_pression', { p_lot: lot });
    if (r && r.ok) {
      for (const [k, n] of Object.entries(parti)) { const reste = (S.lot[k] || 0) - n; if (reste > 0) S.lot[k] = reste; else delete S.lot[k]; }
      for (const [k, A] of Object.entries(partiQ)) { const C = S.lotQ[k]; if (!C) continue; C.n -= A.n;
        if (C.n <= 0 || !S.lot[k]) delete S.lotQ[k]; else for (const j in A.s) C.s[j] = r2((C.s[j] || 0) - A.s[j]); }
      if (!Object.keys(S.lot).length) S.depuis = null;
      S.dernierEnvoi = Date.now(); ecrire(); return true;
    }
    S.dernierEnvoi = Date.now(); ecrire(); return false;               // refusé (trop de dépôts aujourd'hui…) : le lot attend la demi-heure suivante
  } catch (e) { S.dernierEnvoi = Date.now() - ENVOI_MIN + REESSAI; return false; }   // le réseau, ou la fonction absente : on réessaie dans cinq minutes
  finally { S.envoi = false; }
}
const hachage = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };

// --- mise en place ---
racine.orvaneEspeces = orvaneEspeces; racine.orvaneAppliquer = orvaneAppliquer; racine.orvaneVariante = orvaneVariante; racine.orvaneEvenement = orvaneEvenement;
racine.orvaneLot = orvaneLot; racine.orvaneEnvoyer = orvaneEnvoyer; racine.orvaneNaissance = orvaneNaissance;
racine.OrvaneSV = { S, conduitesPour, loiQ, tirerQuant, quantMots, heriter, charger, avancement, effectifSur, biomesIle, releverRencontres, inscrireLignees, definir, enregistrer, especeDeSecours, ancetreJeu, nomJeu, CAUSES_JOUEUR, SEUIL_CORPS };
lire();
if (typeof window !== 'undefined' && typeof fetch === 'function') { charger(); setInterval(releverRencontres, PERIODE_RENCONTRE); }
})(globalThis);
