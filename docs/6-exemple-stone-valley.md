# 6. L'exemple Stone Valley

Stone Valley est un jeu d'îles en un seul `index.html` (isométrie + 1re personne, PWA, Supabase pour les comptes). Ses créatures sont des sprites dessinés un par un, avec des variantes cosmétiques (trois robes, géant, nain). C'est le cas le plus courant — et le plus contraint : Orvane ne peut lui proposer que des *proportions* et des *variantes*, pas de corps nouveaux. Tout est dans `traducteurs/stone-valley/`.

## Ce que le jeu avait déjà

- un bestiaire `SPEC` (40 espèces, dont des automates et des boss), chacune avec `cap` (combien par île), `bio` (ses sols), `diet`, `sz`, `spd`, `mat`, `peur`, `herd` ;
- un tirage du bestiaire par île, pondéré par `POIDS_ESPECE`, à partir de la graine de l'île ;
- un tirage de variante à la naissance, `tirerVariante(sp, r)`, à 1/1140 par robe et 1/18000 par forme ;
- une convention : le jeu appelle des fonctions **si elles existent** (`typeof x === 'function' && x()`), ce qui permet de brancher un module sans le modifier.

## Les fonctions du traducteur (`orvane-sv.js`)

| fonction | appelée par le jeu | rôle |
| --- | --- | --- |
| `orvaneEspeces()` | une fois les fiches du jeu posées | inscrit les lignées nées dans Orvane comme fiches du jeu (copiées de leur ancêtre, à leur mesure ; rendues par lui ou construites) |
| `orvaneAppliquer()` | à l'arrivée sur une île, avant le tirage du bestiaire | pour chaque espèce, `effectif Orvane sur les biomes de l'île / effectif de la génération 0` → règle `POIDS_ESPECE[id]` et `sp.cap` dans la même proportion ; éteint, ou sous le seuil absolu et relatif → n'apparaît plus |
| `orvaneVariante(sp, r)` | dans `tirerVariante` | tire un phénotype en mode relatif (les taux du jeu × l'écart depuis la génération 0, glissant du cycle d'avant à celui-ci), le rend en `robe\|taille-ornement` ; `undefined` si l'espèce est inconnue d'Orvane |
| `orvaneEvenement(action, b, cause)` | dans `mourirBete` et `lier` | note un prélèvement (si la cause est le joueur) ou une capture, avec le phénotype retrouvé depuis la variante |
| `orvaneLot()` | — | le lot accumulé |
| `orvaneEnvoyer(rpc, compte)` | après une sauvegarde réussie | une fois par demi-heure au plus : pousse le lot vers `orvane_deposer` (le Supabase d'Orvane, `ORVANE_DEPOT`), 400 événements à la fois, ne retire que ce qui est parti |

Les rencontres sont relevées toutes les dix secondes : une bête sauvage à moins de douze pas, une fois par bête.

## Les correspondances (`correspondance.js`)

- 16 sols du jeu décrits sur les cinq axes (la tourbière : chaud 0,5, humide 0,95, bas, mi-ombre, couvert moyen, amphibie). Les sols sans vie (lave, vide, nuage) n'y sont pas.
- Taxon = espèce, même identifiant. Une lignée est rendue par son parent tant qu'elle lui ressemble, construite (`lignees.js` du jeu) quand elle s'en écarte ; sans ancêtre, elle emprunte la conduite d'un gabarit (`brouteur`, `glaneur`, `traqueur`).
- La silhouette de chaque espèce du jeu (`corpsDe`) : de quoi faire partir ses lignées d'un corps qui lui ressemble.
- Cinq traits rendus : `albinisme → albinos`, `melanisme → melanique`, `robe-doree → dore`, `gigantisme → geant-<ornement>`, `nanisme → nain-<ornement>`. L'ornement (cornes, crête…) reste tiré par famille comme le jeu le faisait.

## L'amorce (`generer-generation-0.js`)

Lit `index.html`, extrait les objets-espèces, garde les vivantes (ni `diet:'s'`, ni boss, ni horreur, ni volcan), et déduit : `masse_kg = 25 × sz³`, `taille_m = 0.8 × sz`, maturité = `mat/10` cycles, longévité = 5 × maturité, régime depuis `diet`, sociabilité depuis `herd`/`meute`, tempérament depuis `1 − peur` et `riposte`, locomotion depuis `volant`/`dragon`/`corps`, niche = moyenne des axes de ses sols, tolérance élargie pour les généralistes. Populations : `cap × 100 × richesse du sol` (les carnivores à 30 %). Capacité des biomes : telle que la saturation de départ soit 70 %. Résultat : 30 taxons, 16 biomes, ~100 000 individus ; après le rodage, aucune extinction sur 1 500 cycles de plus, saisons et épidémies comprises.

## Ce que le branchement a appris

1. **Les chances de variantes étaient des taux de mutation**, pas des fréquences. Semées à 1/18000 dans une population de 3 000, elles n'existaient pas (0,2 individu). On pose des fréquences installées, le profil compresse.
2. **Une seule bête rare tuée ne doit pas peser comme une persécution** : `pseudo_comptes` est né de là.
3. **La séparation des lignées était trop facile** avec des niches moyennées : règle resserrée dans le moteur, tolérance élargie dans l'amorce.
4. **Le bestiaire d'un jeu n'est pas un équilibre** : trop de prédateurs, des herbivores de même taille qui se gênent. D'où le rodage de 400 cycles avant publication : la génération 0 est l'équilibre atteint, pas l'amorce brute, et le jeu ne voit rien changer le premier jour.

## Ce que le branchement a appris (suite)

5. **La compression seule changeait le jour un** : les fréquences installées pendant le rodage (le glaneur nain à 49 %) donnaient cent fois plus de glaneurs nains qu'avant. D'où le mode relatif.
6. **Un seuil d'extinction absolu rayait les espèces rares dès la génération 0** (le varan, le cerf, la salamandre) : il est devenu aussi relatif.
7. **Une même cause cachait le joueur et la nature** : `chassé` servait aussi à la bête de l'île qui tue sa proie. Le jeu dit maintenant `proie` pour celle-ci, `compagne` pour une bête liée.
8. **Un envoi à chaque sauvegarde** épuisait les 48 dépôts du jour en moins d'une heure, et le refus vidait le lot. Une demi-heure entre deux envois ; un refus garde le lot.
9. **Une bête a besoin de son phénotype.** Tant que le jeu ne savait que la robe d'une bête, un prélèvement sur un camouflé était rapporté « base ». Chaque bête porte maintenant l'identifiant exact de son phénotype (tiré à sa naissance) : c'est ce qui permet aux conduites d'évoluer sous la main des joueurs (chapitre 7).

## Ce qui attend Stone Valley

Les traits riches du catalogue (glande qui crache, carapace, pattes longues, vision nocturne) évoluent déjà dans son monde sans sortir. Le jour où le jeu sait les dessiner et les faire agir (chapitre 3), on les ajoute à `traits_rendus` et à `TRAIT_VARIANTE`, et ils apparaissent à la fréquence qu'ils auront atteinte. Les lignées, elles, sortent déjà : rendues par leur parent ou construites. Et si un jour les créatures sont assemblées par morceaux, les lignées séparées (déjà dans le cahier) auront enfin un corps.
