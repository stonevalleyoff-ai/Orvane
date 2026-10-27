// Orvane × Stone Valley — LE TRADUCTEUR (orvane-sv.js)
// Chargé par index.html comme donjon.js, après tampon.js et correspondance.js. Le jeu appelle, s'ils existent :
//  - orvaneAppliquer()            à l'arrivée sur une île, avant tirerBestiaire() : règle POIDS_ESPECE et sp.cap
//                                 d'après l'état du vivant dans Orvane (sens Orvane → jeu) ;
//  - orvaneVariante(sp, r)        dans tirerVariante() : tire le phénotype d'une bête qui naît, d'après les
//                                 fréquences exposées, et le rend en variante du jeu (robe | taille-ornement) ;
//                                 undefined ⇒ le jeu tire comme avant (espèce inconnue d'Orvane) ;
//  - orvaneEvenement(action, b, cause)  dans mourirBete() ('prelevement') et lier() ('capture') ;
//  - orvaneLot()                  le lot de pressions accumulé (schemas/pression.schema.json) ;
//  - orvaneEnvoyer(rpc, compte)   après une sauvegarde réussie : pousse le lot vers Supabase (vp_orvane_pression).
// Les rencontres (l'exposition) sont relevées toutes les dix secondes : une bête sauvage à moins de douze pas.
// Tout ce qui est propre au jeu est dans correspondance.js ; tout ce qui est réglage est dans profil.json.
// Rien ne casse si Orvane est injoignable : sans instantané, le jeu reste exactement ce qu'il était (génération 0).
(function (racine) {
'use strict';
// d'où viennent instantane.json, generation-0.json et profil.json : un dossier à côté du jeu, ou le monde publié par
// le dépôt Orvane (GitHub Pages sert avec CORS *) — poser ORVANE_CHEMIN avant de charger ce script pour le changer
const CLE = 'stone_valley:orvane', CHEMIN = racine.ORVANE_CHEMIN || 'orvane/';
const CAUSES_JOUEUR = new Set(['chassé', 'flèche', 'combat', 'piétiné', 'explosé', 'tour', 'satellite', 'brisé', 'tir', 'bêta']);   // « faim » : la nature
const RAYON_RENCONTRE = 12, PERIODE_RENCONTRE = 10000, COMMUNS = [1, 2, 3, 4, 5, 6, 7];
const Corr = racine.OrvaneSV_Corr, Tampon = racine.OrvaneTampon;
const S = { courant: null, precedent: null, gen0: null, profil: null, lot: {}, depuis: null, poids0: null, cap0: null, vus: new WeakSet(), compte: null };

// --- mémoire locale (l'instantané et le lot survivent à la fermeture) ---
function lire() { try { const m = JSON.parse(localStorage.getItem(CLE) || '{}'); S.courant = m.courant || null; S.precedent = m.precedent || null; S.gen0 = m.gen0 || null; S.profil = m.profil || null; S.lot = m.lot || {}; S.depuis = m.depuis || null; } catch (e) { } }
function ecrire() { try { localStorage.setItem(CLE, JSON.stringify({ courant: S.courant, precedent: S.precedent, gen0: S.gen0, profil: S.profil, lot: S.lot, depuis: S.depuis })); } catch (e) { } }
async function charger() {
  lire();
  const prendre = async f => { try { const r = await fetch(CHEMIN + f, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  const [inst, gen0, profil] = await Promise.all([prendre('instantane.json'), S.gen0 ? null : prendre('generation-0.json'), prendre('profil.json')]);
  if (gen0) S.gen0 = gen0; if (profil) S.profil = profil;
  if (inst && (!S.courant || inst.cycle.n > S.courant.cycle.n)) { S.precedent = S.courant; S.courant = inst; }
  if (!S.gen0 && S.courant) S.gen0 = S.courant;   // faute de génération 0, le premier instantané vu sert de référence
  ecrire();
}

// --- l'avancement entre deux instantanés : 0 au cycle reçu, 1 au bout de propagation_cycles ---
function avancement() {
  if (!S.courant || !S.precedent || !S.profil) return 1;
  const ms = dureeCycle(), t = (Date.now() - Date.parse(S.courant.cycle.date)) / ms;
  return Math.max(0, Math.min(1, t / (S.profil.exposition.propagation_cycles || 1)));
}
function dureeCycle() { const c = S.profil?.monde?.cycle || '24h', n = parseFloat(c) || 24; return c.endsWith('d') ? n * 864e5 : c.endsWith('m') ? n * 6e4 : n * 36e5; }
const mele = (a, b, k) => a + (b - a) * k;

// --- effectif exposé d'un taxon sur un ensemble de biomes Orvane, interpolé ---
function effectifSur(inst, tid, biomes) { const t = inst?.taxons.find(x => x.id === tid); if (!t || t.eteint) return 0; return t.populations.filter(p => biomes.has(p.biome)).reduce((a, p) => a + p.effectif, 0); }
const biomesIle = () => { const l = [...COMMUNS, ...(typeof biomesGraine === 'function' && typeof SEED !== 'undefined' ? biomesGraine(SEED) : [])]; return new Set(l.map(Corr.biomeOrvane).filter(Boolean)); };

// === Orvane → jeu : l'arrivée sur une île ===
function orvaneAppliquer() {
  if (typeof SPEC === 'undefined' || typeof POIDS_ESPECE === 'undefined') return;
  if (!S.poids0) { S.poids0 = { ...POIDS_ESPECE }; S.cap0 = Object.fromEntries(SPEC.map(sp => [sp.id, sp.cap])); }
  if (!S.courant || !S.gen0) return;                          // rien reçu : le jeu reste tel quel
  const ile = biomesIle(), k = avancement(), seuil = S.profil?.exposition?.seuil_extinction_jeu ?? 0;
  for (const sp of SPEC) {
    const tid = Corr.taxonDe(sp.id, S.courant); if (!tid || !(sp.id in S.cap0)) continue;
    const ref = effectifSur(S.gen0, tid, ile); if (!ref) continue;        // l'espèce ne vivait pas sur ces sols : on ne touche à rien
    const eff = mele(S.precedent ? effectifSur(S.precedent, tid, ile) : effectifSur(S.courant, tid, ile), effectifSur(S.courant, tid, ile), k);
    const ratio = eff / ref, t = S.courant.taxons.find(x => x.id === tid);
    if (t.eteint || eff < seuil) { sp.cap = 0; delete POIDS_ESPECE[sp.id]; continue; }
    sp.cap = Math.max(1, Math.round(S.cap0[sp.id] * Math.min(2, ratio)));
    if (sp.id in S.poids0) POIDS_ESPECE[sp.id] = S.poids0[sp.id] * Math.min(3, ratio);
  }
}

// === Orvane → jeu : la naissance d'une bête ===
function expositionDe(inst, tid) {
  const t = inst?.taxons.find(x => x.id === tid); if (!t || !S.profil) return null;
  const cat = inst.catalogue?.traits || {}; return { t, e: Tampon.exposer(t, S.profil, cat) };
}
function orvaneVariante(sp, r = Math.random) {
  if (!S.courant || !Tampon) return undefined;
  const tid = Corr.taxonDe(sp.id, S.courant), X = tid && expositionDe(S.courant, tid); if (!X) return undefined;
  const k = avancement(), Xp = S.precedent && expositionDe(S.precedent, tid);
  const boost = typeof chanceVariante === 'function' ? chanceVariante() : 1;    // le jeu rend les variantes plus fréquentes loin de chez soi : on garde cette règle
  const base = X.t.phenotypes[0].id, freqs = []; let reste = 1;
  for (const p of X.t.phenotypes) { if (p.id === base) continue; let f = X.e[p.id] || 0; if (Xp && Xp.e[p.id] != null) f = mele(Xp.e[p.id], f, k); f = Math.min(1, f * boost); freqs.push([p, f]); reste -= f; }
  if (reste < 0) { for (const q of freqs) q[1] /= 1 - reste; reste = 0; }
  let u = r(); if (u < reste) return null;                                       // le plan de base : pas de variante
  u -= reste; for (const [p, f] of freqs) { if (u < f) return Corr.varianteDe(p.traits, typeof familleBete === 'function' ? familleBete(sp) : '', r); u -= f; }
  return null;
}

// === jeu → Orvane : les pressions ===
function phenotypeDe(t, variante) {
  const tr = Corr.traitsDe(variante).sort().join('+');
  return (t.phenotypes.find(p => p.traits.slice().sort().join('+') === tr) || t.phenotypes[0]).id;
}
function biomeDeBete() {
  const b = typeof biomeIci !== 'undefined' ? Corr.biomeOrvane(biomeIci) : null; return b;
}
function noter(action, sp, variante, extra) {
  if (!S.courant) return;
  const tid = Corr.taxonDe(sp.id, S.courant); if (!tid) return;
  const t = S.courant.taxons.find(x => x.id === tid), biome = biomeDeBete() || t.populations[0]?.biome; if (!biome) return;
  const ph = action === 'rencontre' ? '' : phenotypeDe(t, variante);
  const cle = [tid, ph, biome, action, extra?.vers || ''].join('|');
  S.lot[cle] = (S.lot[cle] || 0) + 1; if (!S.depuis) S.depuis = new Date().toISOString();
  if (action !== 'rencontre') ecrire();
}
function orvaneEvenement(action, b, cause) {
  if (!b || !b.sp) return;
  if (action === 'prelevement' && cause && !CAUSES_JOUEUR.has(cause)) return;   // morte de faim ou sous un prédateur : ce n'est pas le joueur
  noter(action, b.sp, b.variante);
}
function releverRencontres() {
  if (typeof beasts === 'undefined' || typeof P === 'undefined' || !S.courant) return;
  for (const b of beasts) { if (b.tame || b.dead || S.vus.has(b)) continue; if (Math.hypot(b.x - P.x, b.y - P.y) > RAYON_RENCONTRE) continue; S.vus.add(b); noter('rencontre', b.sp, null); }
}
function orvaneLot() {
  const ev = []; for (const [cle, n] of Object.entries(S.lot)) { const [taxon, phenotype, biome, action, vers] = cle.split('|'); const e = { taxon, biome, action, n }; if (phenotype) e.phenotype = phenotype; if (vers) e.vers = vers; ev.push(e); }
  if (!ev.length) return null;
  return { orvane: S.courant?.orvane || '0.1', monde: S.courant?.monde?.id || 'sv-1', instantane: S.courant?.cycle?.n ?? 0,
    source: { jeu: 'stone-valley', compte: S.compte || 'anonyme', zone: typeof SEED !== 'undefined' ? 'ile:' + SEED : undefined },
    periode: { debut: S.depuis || new Date().toISOString(), fin: new Date().toISOString() }, evenements: ev };
}
async function orvaneEnvoyer(rpc, compte) {
  if (compte) S.compte = 'h:' + hachage(String(compte));
  const lot = orvaneLot(); if (!lot || typeof rpc !== 'function') return false;
  try { await rpc('vp_orvane_pression', { p_lot: lot }); S.lot = {}; S.depuis = null; ecrire(); return true; } catch (e) { return false; }
}
const hachage = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };

// --- mise en place ---
racine.orvaneAppliquer = orvaneAppliquer; racine.orvaneVariante = orvaneVariante; racine.orvaneEvenement = orvaneEvenement;
racine.orvaneLot = orvaneLot; racine.orvaneEnvoyer = orvaneEnvoyer;
racine.OrvaneSV = { S, charger, avancement, effectifSur, biomesIle, releverRencontres, CAUSES_JOUEUR };
if (typeof window !== 'undefined' && typeof fetch === 'function') { charger(); setInterval(releverRencontres, PERIODE_RENCONTRE); }
})(globalThis);
