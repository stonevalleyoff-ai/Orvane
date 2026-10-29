# L'hébergement : un monde pour tous les jeux, sans serveur

Orvane fait vivre **un seul monde**, `mondes/orvane/`, et tous les jeux s'y branchent. Chaque jeu le montre à sa façon (ses espèces, ses sols, ses variantes) et y renvoie ce que font ses joueurs. Chaque nuit, l'action GitHub `cycle` fait avancer le monde d'un cycle et commite le résultat ; GitHub Pages le sert, avec CORS ouvert, à tous les traducteurs. Les pressions des joueurs passent par **le Supabase d'Orvane**, qui n'appartient à aucun jeu.

```
mondes/orvane/
  profil.json         le profil du monde : où lire les pressions, comment elles pèsent (influence)
  amorce.json         le monde né de la genèse (moteur/genese.js sur moteur/biomes-universels.json)
  generation-0.json   l'amorce, publiée telle quelle au premier cycle : les traducteurs s'y comparent
  etat.json           l'instantané courant, complet : le moteur repart de là
  instantane.json     le même, compact, avec le cycle d'avant allégé (precedent) : ce que les traducteurs lisent
  historique.json     les derniers cycles allégés (profil.monde.historique) : ce que l'observatoire trace
  jeux.json           les jeux branchés et ce que chacun montre (exposition) : chaque traducteur y lit la sienne
  tampon.json         la mémoire du tampon (lissage) et la dernière ligne lue
  lots/               des lots déposés à la main (lus puis rangés dans lots/traites/)
```

## Le monde

Il est né de la genèse « universelle » : 24 biomes neutres (de la banquise aux abysses, la terre, l'eau douce, la mer, le sous-sol), 19 ancêtres très simples (des brouteurs, un fouisseur, un insecte, un oiseau ; des prédateurs à chaque étage de taille, du mangeur d'insectes au grand rôdeur, un rapace, un serpent, une grenouille ; des filtreurs, des chasseurs d'eau douce, des récifs et du large, un crabe), 900 cycles d'évolution accélérée : 112 lignées, dont 13 vrais carnivores. L'eau douce et la mer sont distinctes : une bête nageuse porte `plan.eau` (`douce`, `salee` ou `mixte`), et un poisson de lac ne vit pas au large. Le monde a ses propres règles (`monde.regles`, docs/13) : un omnivore tire moins des plantes qu'un herbivore et ne dispute aux carnivores qu'une part de leurs proies. Aucun jeu n'en a dessiné la faune : chaque jeu la traduit (pour Stone Valley, `traducteurs/stone-valley/correspondance.js` : ses sols deviennent des biomes du monde, ses gabarits rendent les lignées).

## Le chemin d'une pression

1. Le joueur chasse, lie, croise des bêtes : le traducteur du jeu accumule un lot (`schemas/pression.schema.json`).
2. De temps en temps (pour Stone Valley, à une sauvegarde, une fois par demi-heure au plus), le jeu appelle `orvane_deposer(cle, compte, lot)` sur le Supabase d'Orvane, avec la clé publique du projet et **la clé de son jeu**. Le compte est l'identifiant du joueur dans le jeu ; Orvane n'en garde qu'une empreinte.
3. À 03:17 UTC, `hebergement/cycle.js` lit les jeux (`orvane_lire_jeux`) et les lots nouveaux (`orvane_lire_lots`), avec le secret de lecture d'Orvane. Le tampon lit chaque lot avec **l'exposition de son jeu** : une variante que le jeu montre à 2 % mais qui vit à 20 % voit ses pertes redressées, et un jeu qui montre tout tel quel n'est pas redressé. Puis les plafonds (par compte, part d'un seul compte, **part d'un seul jeu**, part d'une population), le lissage, le moteur ; `instantane.json`, `historique.json` et `jeux.json` sont écrits, puis commités.
4. Au prochain lancement du jeu, le traducteur lit `instantane.json` et `jeux.json`, et étale le changement sur `propagation_cycles`.

## Le Supabase d'Orvane

`hebergement/supabase.sql`, collé une fois dans l'éditeur SQL du projet (il peut être recollé). Aucune table n'est lisible directement ; tout passe par six fonctions :

| fonction | qui l'appelle | ce qu'elle fait |
| --- | --- | --- |
| `orvane_inscrire_jeu(nom, contact)` | n'importe qui | inscrit un jeu ; rend son identifiant, **sa clé** (publique : elle va dans le code du jeu) et **sa clé d'administration** (secrète). 30 inscriptions par heure au plus |
| `orvane_regler_jeu(cle_admin, exposition, nom)` | l'auteur du jeu | ce que le jeu sait montrer (`schemas/profil.schema.json`, `exposition` ; 32 Ko au plus) |
| `orvane_deposer(cle, compte, lot)` | le jeu | un lot : 64 Ko et 500 événements au plus, 48 lots par joueur et par jour, et le quota du jeu (20 000 lots par jour) |
| `orvane_jeu(cle)` | le jeu | ce qu'Orvane sait du jeu |
| `orvane_lire_lots(secret, monde, après)` | l'action nocturne | les lots, par pages de 1000, comptes pseudonymisés |
| `orvane_lire_jeux(secret)` | l'action nocturne | les jeux et leur exposition |

Le secret de lecture n'est gardé que par son empreinte, dans un schéma que l'API ne sert pas. Orvane n'a la clé de service d'aucun jeu, et aucun jeu n'a la sienne.

## Brancher un jeu

1. **S'inscrire** : appeler `orvane_inscrire_jeu` (`POST https://<projet>.supabase.co/rest/v1/rpc/orvane_inscrire_jeu`, en-tête `apikey` : la clé publique du projet, corps `{"p_nom": "Mon jeu"}`). Garder la clé d'administration.
2. **Dire ce qu'on montre** : `orvane_regler_jeu` avec l'exposition du jeu. Sans exposition, le jeu est lu « tel quel ».
3. **Lire le monde** : `https://<compte>.github.io/orvane/mondes/orvane/instantane.json` (docs/1), `generation-0.json` pour le mode relatif, `jeux.json` pour son exposition.
4. **Renvoyer des pressions** : `orvane_deposer` (docs/4), `lot.monde = "orvane"`.

## Mettre en place

- **Supabase** : coller `hebergement/supabase.sql`, puis le script d'installation (qu'on ne publie pas : il pose l'empreinte du secret de lecture, et peut inscrire les premiers jeux). Le profil du monde dit où lire : `monde.pressions` (l'adresse du projet, sa clé **publique**, les deux fonctions de lecture).
- **Secret du dépôt** (Settings › Secrets and variables › Actions) : `ORVANE_LECTURE_SECRET`, le secret de lecture. Il n'ouvre que la lecture des lots et des jeux.
- **L'action** : `.github/workflows/cycle.yml`, qui fait tourner chaque dossier de `mondes/` dont le profil ne dit pas `monde.nocturne = false`. Un dossier qui commence par un point ne passe pas par « Add files › Upload files » : créer le fichier par « Add file › Create new file », en tapant le chemin `.github/workflows/cycle.yml`.
- **Pages** : Settings › Pages, branche `main`, dossier `/`.

## À la main

```
node hebergement/cycle.js orvane --sans-reseau          # un cycle, lots du dossier seulement (expositions du dernier jeux.json)
node hebergement/cycle.js orvane --cycles 7             # rattraper une semaine (lots en ligne + dossier)
```

Le premier cycle part de l'amorce du profil (`monde.amorce`), et pose la naissance du monde (`monde.ne`). Pour repartir de zéro : supprimer `etat.json`, `generation-0.json`, `instantane.json`, `historique.json`, `tampon.json`. Les traducteurs verront un monde neuf (autre naissance) et repartiront de sa génération 0.

## Les mondes d'avant

`mondes/sv-1/` (le monde fait pour Stone Valley, ses lots dans le Supabase du jeu) et `mondes/genese-7/` (une genèse à observer) restent publiés, mais ne tournent plus (`monde.nocturne = false`). Un lot sans jeu (déposé à la main) est lu avec l'exposition du profil du monde s'il en a une, sinon tel quel.
