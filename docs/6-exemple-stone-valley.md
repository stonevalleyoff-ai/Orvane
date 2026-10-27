# 6. L'exemple Stone Valley

Stone Valley est un jeu d'îles en un seul `index.html` (isométrie + 1re personne, PWA, Supabase pour les comptes). Ses créatures sont des sprites dessinés un par un, avec des variantes cosmétiques (trois robes, géant, nain). C'est le cas le plus courant — et le plus contraint : Orvane ne peut lui proposer que des *proportions* et des *variantes*, pas de corps nouveaux. Tout est dans `traducteurs/stone-valley/`.

## Ce que le jeu avait déjà

- un bestiaire `SPEC` (40 espèces, dont des automates et des boss), chacune avec `cap` (combien par île), `bio` (ses sols), `diet`, `sz`, `spd`, `mat`, `peur`, `herd` ;
- un tirage du bestiaire par île, pondéré par `POIDS_ESPECE`, à partir de la graine de l'île ;
- un tirage de variante à la naissance, `tirerVariante(sp, r)`, à 1/1140 par robe et 1/18000 par forme ;
- une convention : le jeu appelle des fonctions **si elles existent** (`typeof x === 'function' && x()`), ce qui permet de brancher un module sans le modifier.

## Les cinq fonctions du traducteur (`orvane-sv.js`)

| fonction | appelée par le jeu | rôle |
| --- | --- | --- |
| `orvaneAppliquer()` | à l'arrivée sur une île, avant le tirage du bestiaire | pour chaque espèce, `effectif Orvane sur les biomes de l'île / effectif de la génération 0` → règle `POIDS_ESPECE[id]` et `sp.cap` dans la même proportion ; éteint ou sous le seuil → n'apparaît plus |
| `orvaneVariante(sp, r)` | dans `tirerVariante` | tire un phénotype selon les fréquences exposées (interpolées entre les deux derniers instantanés), le rend en `robe\|taille-ornement` ; `undefined` si l'espèce est inconnue d'Orvane |
| `orvaneEvenement(action, b, cause)` | dans `mourirBete` et `lier` | note un prélèvement (si la cause est le joueur) ou une capture, avec le phénotype retrouvé depuis la variante |
| `orvaneLot()` | — | le lot accumulé |
| `orvaneEnvoyer(rpc, compte)` | après une sauvegarde réussie | pousse le lot vers `vp_orvane_pression`, vide le lot |

Les rencontres sont relevées toutes les dix secondes : une bête sauvage à moins de douze pas, une fois par bête.

## Les correspondances (`correspondance.js`)

- 16 sols du jeu décrits sur les cinq axes (la tourbière : chaud 0,5, humide 0,95, bas, mi-ombre, couvert moyen, amphibie). Les sols sans vie (lave, vide, nuage) n'y sont pas.
- Taxon = espèce, même identifiant. Une lignée inconnue est rendue par son parent.
- Cinq traits rendus : `albinisme → albinos`, `melanisme → melanique`, `robe-doree → dore`, `gigantisme → geant-<ornement>`, `nanisme → nain-<ornement>`. L'ornement (cornes, crête…) reste tiré par famille comme le jeu le faisait.

## L'amorce (`generer-generation-0.js`)

Lit `index.html`, extrait les objets-espèces, garde les vivantes (ni `diet:'s'`, ni boss, ni horreur, ni volcan), et déduit : `masse_kg = 25 × sz³`, `taille_m = 0.8 × sz`, maturité = `mat/10` cycles, longévité = 5 × maturité, régime depuis `diet`, sociabilité depuis `herd`/`meute`, tempérament depuis `1 − peur` et `riposte`, locomotion depuis `volant`/`dragon`/`corps`, niche = moyenne des axes de ses sols, tolérance élargie pour les généralistes. Populations : `cap × 100 × richesse du sol`. Capacité des biomes : telle que la saturation de départ soit 70 %. Résultat : 30 taxons, 16 biomes, ~110 000 individus, stable sur 60 cycles.

## Ce que le branchement a appris

1. **Les chances de variantes étaient des taux de mutation**, pas des fréquences. Semées à 1/18000 dans une population de 3 000, elles n'existaient pas (0,2 individu). On pose des fréquences installées, le profil compresse.
2. **Une seule bête rare tuée ne doit pas peser comme une persécution** : `pseudo_comptes` est né de là.
3. **La séparation des lignées était trop facile** avec des niches moyennées : règle resserrée dans le moteur, tolérance élargie dans l'amorce.
4. **Le crapaud pond quarante petits** : chassé par dix comptes chaque soir, il prospère. Le brouteur, non. Le jeu n'a rien eu à décider.

## Ce qui attend Stone Valley

Les traits riches du catalogue (glande qui crache, carapace, pattes longues, vision nocturne) évoluent déjà dans son monde sans sortir. Le jour où le jeu sait les dessiner et les faire agir (chapitre 3), on les ajoute à `traits_rendus` et à `TRAIT_VARIANTE`, et ils apparaissent à la fréquence qu'ils auront atteinte. Et si un jour les créatures sont assemblées par morceaux, les lignées séparées (déjà dans le cahier) auront enfin un corps.
