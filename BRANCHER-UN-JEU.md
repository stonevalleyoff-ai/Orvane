# Brancher un jeu sur Orvane

Orvane fait vivre un seul monde, le monde d'Orvane, et tous les jeux s'y branchent. Un jeu **lit** le monde (des fichiers JSON publiés chaque nuit) et **renvoie** ce que font ses joueurs (des lots de comptes, déposés dans le Supabase d'Orvane). Ce guide donne les étapes, les adresses et les appels exacts. Il se suffit à lui-même, pour un développeur comme pour une IA qui code à sa place ; les chapitres de [docs/](docs/LISEZ-MOI.md) approfondissent la traduction.

## En bref

1. **S'inscrire** sur la [page d'inscription](https://stonevalleyoff-ai.github.io/orvane/inscription/) (ou par un appel) : on reçoit la **clé du jeu**, publique, et la **clé d'administration**, secrète.
2. **Lire le monde** : `instantane.json`, une fois par jour, depuis GitHub Pages. Aucune clé n'est nécessaire.
3. **Traduire** : relier les terrains du jeu aux 24 biomes d'Orvane, et faire de chaque lignée une créature.
4. **Régler l'exposition** (facultatif) : dire à Orvane ce que le jeu sait montrer, avec la clé d'administration.
5. **Renvoyer des pressions** : compter ce que font les joueurs et déposer des lots avec `orvane_deposer` et la clé du jeu.

## Les adresses

| quoi | adresse |
| --- | --- |
| le monde (lecture, CORS ouvert) | `https://stonevalleyoff-ai.github.io/orvane/mondes/orvane/` |
| la page d'inscription | `https://stonevalleyoff-ai.github.io/orvane/inscription/` |
| le Supabase d'Orvane | `https://rospodujiyltmxitykwc.supabase.co` |
| la clé publique du projet (en-tête `apikey`) | `sb_publishable_F98uYIaPrLTjhj3n7QiBOg_SOtFynn8` |
| l'observatoire (voir le monde vivre) | `https://stonevalleyoff-ai.github.io/orvane/` |

La clé publique du projet peut figurer dans le code d'un jeu : elle n'ouvre que les quatre fonctions ci-dessous, et aucune table n'est lisible directement.

Toutes les fonctions s'appellent de la même façon : `POST https://rospodujiyltmxitykwc.supabase.co/rest/v1/rpc/<fonction>`, avec les en-têtes `apikey: <clé publique du projet>` et `Content-Type: application/json`, et pour corps un objet JSON de paramètres `p_…`. La réponse est toujours un objet JSON avec `ok` : `{"ok": true, …}` ou `{"ok": false, "erreur": "…"}`. Le code HTTP est 200 dans les deux cas : **c'est `ok` qu'il faut lire**.

| fonction | paramètres | sert à |
| --- | --- | --- |
| `orvane_inscrire_jeu` | `p_nom` (2 à 60 caractères), `p_contact` (facultatif, 200 au plus) | inscrire un jeu, recevoir ses clés |
| `orvane_regler_jeu` | `p_cle_admin`, `p_exposition` (objet, 32 Ko au plus ; `null` le laisse tel quel), `p_nom` (facultatif) | régler ce que le jeu montre, renommer le jeu |
| `orvane_deposer` | `p_cle`, `p_compte`, `p_lot` | déposer un lot de pressions |
| `orvane_jeu` | `p_cle` | vérifier une clé : ce qu'Orvane sait du jeu |

## 1. S'inscrire

Le plus simple : la [page d'inscription](https://stonevalleyoff-ai.github.io/orvane/inscription/). Ou par un appel :

```sh
curl -X POST https://rospodujiyltmxitykwc.supabase.co/rest/v1/rpc/orvane_inscrire_jeu \
  -H "apikey: sb_publishable_F98uYIaPrLTjhj3n7QiBOg_SOtFynn8" -H "Content-Type: application/json" \
  -d '{"p_nom": "Mon jeu", "p_contact": "moi@exemple.fr"}'
```

```json
{ "ok": true, "jeu": "mon-jeu", "cle": "orv_3f9c…", "cle_admin": "orvadm_8a21…",
  "note": "la clé va dans le code du jeu ; la clé d'administration se garde secrète (orvane_regler_jeu)" }
```

| champ | ce que c'est | où le garder |
| --- | --- | --- |
| `jeu` | l'identifiant du jeu dans Orvane (`jeux.json`, les lots) | dans le code |
| `cle` | la clé du jeu : elle signe les dépôts | dans le code du jeu, elle est publique |
| `cle_admin` | la clé d'administration : elle règle le jeu | **jamais dans le jeu** ; dans un gestionnaire de mots de passe |

Orvane ne garde que l'empreinte de la clé d'administration : perdue, elle ne se retrouve pas, et il faut inscrire le jeu à nouveau. Trente inscriptions par heure au plus, tous jeux confondus.

## 2. Lire le monde

Le cycle nocturne tourne à 03:17 UTC, puis publie dans `https://stonevalleyoff-ai.github.io/orvane/mondes/orvane/` :

| fichier | ce que le jeu en fait |
| --- | --- |
| `instantane.json` | **le monde du jour** : ses biomes, ses lignées, leurs populations par biome et leurs variantes ; avec `precedent`, le cycle d'avant allégé, pour étaler un changement |
| `generation-0.json` | le monde à sa naissance : la référence du mode relatif (chapitre 5) |
| `jeux.json` | les jeux branchés et l'exposition de chacun |
| `historique.json` | les derniers cycles allégés (pour tracer des courbes) |

Lisez-les au lancement du jeu, avec `cache: 'no-cache'`, et gardez la dernière copie pour jouer hors ligne :

```js
const MONDE = 'https://stonevalleyoff-ai.github.io/orvane/mondes/orvane/';
const inst = await (await fetch(MONDE + 'instantane.json', { cache: 'no-cache' })).json();
// l'identité du monde : son id et sa naissance. Si monde.ne change, le monde a été refait de zéro :
// le jeu repart de la nouvelle generation-0.json.
const identite = inst.monde.id + '@' + inst.monde.ne;
for (const t of inst.taxons) {
  if (t.eteint != null) continue;                     // éteint : il reste listé dix cycles
  for (const p of t.populations) console.log(t.id, t.nom, p.biome, p.effectif);
}
```

Ce que porte une lignée (`inst.taxons[i]`) :
- `id` est stable : c'est la clé de votre table de correspondance. `nom` est son nom. `parent` dit de quelle lignée elle s'est séparée. `statut` vaut `croissance`, `stable`, `declin`, `menace` ou `eteint`.
- `plan` : `regime`, `masse_kg`, `taille_m`, `locomotion` (`marche`, `course`, `vol`, `nage`, `grimpe`…), `activite`, `temperament`, `sociabilite`, `vitesse_rel`, `perception`, `longevite`, et `corps`, sa silhouette : forme, pattes, proportions, organes, couleurs (`moteur/corps.js`).
- `populations` : par biome, `effectif`, `tendance` et les traits continus `quant` (taille, vitesse, audace, sociabilité : une moyenne et une variance, chapitre 8).
- `phenotypes` : les variantes, chacune avec ses `traits` et sa `frequence` (globale et par biome).

`cycle.n` est le numéro du cycle, `cycle.saison` la saison du monde. Le détail champ par champ : [docs/1](docs/1-lire-un-instantane.md) et `schemas/instantane.schema.json`.

## 3. Traduire

**Les biomes.** Le monde a 24 biomes. Chaque terrain du jeu doit correspondre à un ou plusieurs biomes ; chaque biome dit son `milieu` et ses `voisins`.

| milieu | biomes |
| --- | --- |
| terre | `banquise` `toundra` `taiga` `steppe` `prairie` `foret` `jungle` `savane` `desert` `desert-froid` `maquis` `montagne` `sommets` `volcan` |
| sous-sol | `grotte` |
| eau douce et bords | `marais` `mangrove` `lac` `riviere` |
| mer | `cote` `recif` `large` `mer-froide` `abysses` |

**Les lignées.** Une lignée vit là où elle a un effectif. Faites-la apparaître dans les terrains qui correspondent à ses biomes, en proportion de son effectif ; tirez son comportement de `plan.regime`, `temperament`, `sociabilite` et `activite`, sa taille de `masse_kg`, ses déplacements de `locomotion`, son dessin de `plan.corps`. Une lignée qui disparaît de l'instantané, ou dont `eteint` n'est plus `null`, quitte le jeu.

**Les variantes.** Le tampon (`tampon/tampon.js`, à copier dans le jeu) transforme les fréquences réelles en fréquences montrées selon l'exposition du jeu : il comprime les raretés, étale les changements sur plusieurs jours et masque ce que le jeu ne sait pas dessiner.

**L'exemple complet.** Le traducteur de Stone Valley, de bout en bout : `traducteurs/stone-valley/` (correspondances, traducteur, banc) et [docs/6](docs/6-exemple-stone-valley.md). Pour faire d'un corps des statistiques de jeu : [docs/3](docs/3-traduire-un-phenotype.md) ; pour ce que les traits font faire aux bêtes : [docs/7](docs/7-conduites.md).

## 4. Régler l'exposition (facultatif)

L'exposition dit ce que le jeu sait montrer et comment : la compression des raretés, l'étalement des changements, les traits rendus. Sans exposition, les lots du jeu sont lus tels quels. Elle se règle sur la page d'inscription, ou par un appel :

```js
await fetch('https://rospodujiyltmxitykwc.supabase.co/rest/v1/rpc/orvane_regler_jeu', {
  method: 'POST', headers: { apikey: 'sb_publishable_F98uYIaPrLTjhj3n7QiBOg_SOtFynn8', 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_cle_admin: 'orvadm_…', p_exposition: {
    compression: { defaut: 0.1 },          // une variante à 20 % dans Orvane en fait 2,4 % dans le jeu
    propagation_cycles: 3,                 // un changement s'étale sur trois cycles
    inertie_max: 0.05,                     // 5 points de fréquence au plus par cycle
    traits_rendus: ['albinisme', 'melanisme', 'gigantisme']
  } }) });
```

N'appelez jamais `orvane_regler_jeu` depuis le jeu publié : la clé d'administration n'a rien à y faire. Le schéma complet est `schemas/profil.schema.json`, propriété `exposition`, et il est expliqué dans [docs/5](docs/5-profil-et-essais.md). L'exposition d'un jeu est publiée chaque nuit dans `jeux.json`.

## 5. Renvoyer des pressions

Le jeu compte ce que font ses joueurs, sans rien conclure, et dépose ces comptes par lots :

```json
{ "orvane": "0.1", "monde": "orvane", "instantane": 41,
  "source": { "jeu": "mon-jeu", "compte": "h:9c1e44", "zone": "carte:3" },
  "periode": { "debut": "2026-10-29T18:02:11Z", "fin": "2026-10-29T19:40:03Z" },
  "evenements": [
    { "taxon": "dunvi", "biome": "savane", "action": "rencontre", "n": 12 },
    { "taxon": "dunvi", "phenotype": "base", "biome": "savane", "action": "prelevement", "n": 3, "age": "adulte", "q": { "taille": 0.8 } } ] }
```

- `instantane` est le `cycle.n` que le jeu utilisait. `taxon` est l'`id` de la lignée, `biome` un biome d'Orvane, déjà traduit.
- `action` vaut :
  - `rencontre` : la bête a été vue, une fois par bête ;
  - `prelevement` : la bête est morte du fait du joueur ;
  - `capture` : elle a été apprivoisée ; `liberation` : elle a été relâchée ;
  - `nourrissage`, `reproduction` : le joueur l'a aidée ;
  - `deplacement` : elle a été emportée ailleurs, avec `vers` ;
  - `habitat_perdu`, `habitat_gagne` : de l'habitat a été détruit ou créé, en `n` unités.
- Ne comptez ni les morts naturelles, ni les proies des autres bêtes, ni les bêtes d'un autre joueur. Comptez une mort au moment où le jeu la cause, pas en surveillant les points de vie.
- `q` (facultatif) donne la valeur moyenne des traits continus des bêtes prises : c'est ce qui dit à Orvane si les joueurs prennent les plus grandes.

Puis le dépôt :

```js
const r = await fetch('https://rospodujiyltmxitykwc.supabase.co/rest/v1/rpc/orvane_deposer', {
  method: 'POST', headers: { apikey: 'sb_publishable_F98uYIaPrLTjhj3n7QiBOg_SOtFynn8', 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_cle: 'orv_…', p_compte: compteOpaque, p_lot: lot }) });
const rep = await r.json();
if (rep.ok) oublierLeLot(); else garderPourPlusTard(rep.erreur);
```

- `p_compte` est un identifiant opaque du joueur, par exemple un hachage de son identifiant de compte. Orvane n'en garde qu'un pseudonyme et ne s'en sert que pour les plafonds par joueur.
- Gardez le lot en mémoire et dans le stockage local jusqu'à `ok: true`, puis envoyez-le à un moment naturel : une sauvegarde, une déconnexion, un changement de zone.
- Limites : 500 événements et 64 Ko par lot ; 48 lots par joueur et par jour ; 20 000 lots par jour pour le jeu.

La nuit suivante, le cycle lit les lots de tous les jeux et les rapporte à l'exposition de chacun. Il les plafonne : un joueur ne pèse pas plus qu'un autre, et un même jeu ne fait au plus que la moitié de la pression sur une espèce. Puis il les lisse et fait avancer le monde. L'effet se lit dans l'instantané du lendemain. Le détail est dans [docs/4](docs/4-renvoyer-des-pressions.md) et `schemas/pression.schema.json`.

## Réponses et erreurs

| `erreur` | cause | que faire |
| --- | --- | --- |
| `nom de jeu : 2 à 60 caractères` | nom trop court ou trop long | corriger le nom |
| `trop d'inscriptions en ce moment, réessayez dans une heure` | trente inscriptions dans l'heure | réessayer plus tard |
| `clé d'administration inconnue` | mauvaise clé d'administration | vérifier la clé ; perdue, réinscrire le jeu |
| `exposition : un objet de 32 Ko au plus` | exposition qui n'est pas un objet, ou trop grosse | corriger le JSON |
| `clé de jeu inconnue` | mauvaise clé du jeu | vérifier avec `orvane_jeu` |
| `ce jeu est suspendu` | jeu suspendu par Orvane | écrire au projet |
| `compte : 1 à 128 caractères` | `p_compte` vide ou trop long | hacher l'identifiant du joueur |
| `lot mal formé` | `p_lot` n'est pas un objet, ou n'a pas de tableau `evenements` | suivre le schéma |
| `lot trop gros` | plus de 500 événements ou de 64 Ko | couper le lot |
| `trop de dépôts aujourd'hui pour ce joueur` | 48 lots dans les 24 dernières heures | regrouper, garder le lot pour demain |
| `quota du jeu atteint pour aujourd'hui` | 20 000 lots en 24 heures | garder les lots pour demain |

## Règles

- La clé d'administration ne va jamais dans un jeu publié, ni dans un dépôt de code. Aucune clé de service Supabase ne sert à brancher un jeu.
- Orvane ne reçoit que des comptes (« 14 tués, 31 croisés »), jamais des conclusions, et aucune donnée personnelle : `p_compte` est opaque.
- Le monde appartient à tous les jeux : un jeu n'y pèse qu'en proportion de ses joueurs, et jamais plus de la moitié de la pression sur une espèce.
- **La licence.** Orvane est sous [PolyForm Shield 1.0.0](https://polyformproject.org/licenses/shield/1.0.0) (`LICENSE`). Brancher un jeu, même commercial ou au code fermé, est permis, de même que copier dans le jeu `tampon/tampon.js`, les schémas ou un traducteur et les adapter. Joignez alors l'adresse de la licence et la ligne `Required Notice: Copyright StoneValley (https://github.com/stonevalleyoff-ai/orvane)`, par exemple en commentaire en tête du fichier copié. Ce qui n'est pas permis : se servir du code d'Orvane pour fournir un produit qui lui fait concurrence (un autre moteur d'écosystème, un autre monde partagé où brancher des jeux, une copie renommée).

## Liste de vérification

- [ ] La clé du jeu est dans le code, la clé d'administration est rangée ailleurs.
- [ ] `orvane_jeu` avec la clé du jeu répond `ok: true` et le nom du jeu.
- [ ] Le jeu lit `instantane.json`, garde `monde.ne` et repart de `generation-0.json` quand il change.
- [ ] Chaque terrain du jeu correspond à au moins un biome d'Orvane.
- [ ] Les lignées apparaissent selon leurs effectifs, et une lignée éteinte quitte le jeu.
- [ ] Chaque événement est compté une seule fois, dans le biome d'Orvane où il a eu lieu.
- [ ] Un lot déposé répond `ok: true` ; sinon, il est gardé et renvoyé plus tard.
- [ ] Le lendemain, `pressions_recues` monte dans `cycle` de l'instantané.

## In English, briefly

Orvane runs one shared ecosystem world that any game can plug into.
1. **Register** on the [sign-up page](https://stonevalleyoff-ai.github.io/orvane/inscription/), or call the `orvane_inscrire_jeu` RPC described below. You get a public **game key** (`orv_…`, it goes in your game) and a secret **admin key** (`orvadm_…`, never ship it).
2. **Read** the world once a day from `https://stonevalleyoff-ai.github.io/orvane/mondes/orvane/instantane.json`: its 24 biomes, and lineages (`taxons`) with a body plan (`plan`), populations per biome (`populations[].effectif`) and variants (`phenotypes`). It is published nightly at 03:17 UTC.
3. **Translate**: map your terrains to Orvane biomes, and spawn each lineage where it lives, in proportion to its population. The reference translator is `traducteurs/stone-valley/`.
4. **Report** what players do as raw counts (encounters, kills, captures…) in batches. Use `orvane_deposer(p_cle, p_compte, p_lot)`, where `p_compte` is an opaque player id. A batch holds at most 500 events and 64 KB, and each player can send 48 batches a day. The batch format is in `schemas/pression.schema.json`.

Every RPC is `POST https://rospodujiyltmxitykwc.supabase.co/rest/v1/rpc/<function>`, with headers `apikey: sb_publishable_F98uYIaPrLTjhj3n7QiBOg_SOtFynn8` and `Content-Type: application/json`. The JSON body holds the `p_…` parameters. Every answer is `{"ok": true, …}` or `{"ok": false, "erreur": "…"}`, with HTTP 200 in both cases.

Licence: [PolyForm Shield 1.0.0](https://polyformproject.org/licenses/shield/1.0.0). Plugging in any game, commercial or closed-source, is allowed, and so is copying `tampon/tampon.js`, the schemas or a translator into it. Keep the licence URL and the line `Required Notice: Copyright StoneValley (https://github.com/stonevalleyoff-ai/orvane)` with the copied files. Using Orvane's code to provide a competing product is not allowed.
