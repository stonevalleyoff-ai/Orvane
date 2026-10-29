# Brancher son jeu sur Orvane — le mode d'emploi

Orvane fait vivre un monde : des espèces, des biomes, des populations qui naissent, meurent, migrent, mutent et se séparent. Il ne sait rien de votre jeu. Pour l'y brancher, vous écrivez un **traducteur** : un petit fichier, côté client, qui lit ce qu'Orvane publie et le rend jouable, puis qui renvoie ce que vos joueurs font. Ce guide explique comment, chapitre par chapitre, avec le traducteur de Stone Valley comme exemple de bout en bout.

Pour s'inscrire, recevoir ses clés et faire ses premiers appels au Supabase d'Orvane : [BRANCHER-UN-JEU.md](../BRANCHER-UN-JEU.md) et la [page d'inscription](https://stonevalleyoff-ai.github.io/orvane/inscription/).

| chapitre | ce que vous saurez faire |
| --- | --- |
| [1. Lire un instantané](1-lire-un-instantane.md) | comprendre le fichier qu'Orvane publie chaque nuit |
| [2. Les correspondances](2-correspondances.md) | relier vos biomes, vos espèces, vos variantes à ceux d'Orvane |
| [3. Traduire un phénotype](3-traduire-un-phenotype.md) | faire d'un corps biologique des statistiques de jeu : physique, mouvement, comportement, attaque, objets, apprivoisement |
| [4. Renvoyer des pressions](4-renvoyer-des-pressions.md) | compter ce que font les joueurs, sans tricher ni compter deux fois |
| [5. Le profil et les essais](5-profil-et-essais.md) | régler le tampon pour votre jeu et tout vérifier hors ligne |
| [6. L'exemple Stone Valley](6-exemple-stone-valley.md) | le traducteur complet, commenté |
| [7. Les conduites](7-conduites.md) | ce que l'évolution fait faire aux bêtes : le vocabulaire abstrait, un phénotype par bête, trois règles pour les jouer, et ce qui vient ensuite |
| [8. La génétique continue](8-genetique-continue.md) | taille, vitesse, audace, sociabilité : une moyenne et une variance par population, une valeur par bête, ce que la sélection en fait |
| [9. La reproduction sexuée](9-reproduction.md) | des allèles par population, dominants ou récessifs, des pères choisis, et des petits qui ressemblent à leur mère |
| [10. L'isolement et les hybrides](10-isolement.md) | le flux de gènes, l'écart génétique, la spéciation par isolement, les zones hybrides entre lignées apparentées |
| [11. Les organes](11-organes.md) | une liste ouverte d'organes à leur place et à leur taille, une innovation rare, leurs dessins et les conduites qu'ils prêtent au jeu |
| [12. La méfiance et l'habituation](12-mefiance.md) | ce qu'une population apprend des joueurs, comment elle l'oublie, et comment le jeu le rend en distance de fuite |
| [13. La stabilité](13-stabilite.md) | ce que le moteur tient sur mille cycles, avec et sans joueurs ; ce que les bancs ont corrigé ; comment les relancer |

## En une page

1. **Orvane publie un instantané** (`mondes/<id>/instantane.json`) : pour chaque taxon, un plan corporel, des populations par biome, des phénotypes (des combinaisons de traits avec leur fréquence). Les biomes sont décrits par cinq axes de 0 à 1, pas par des noms.
2. **Votre traducteur lit l'instantané** et en tire, pour chaque créature de votre jeu : combien en font apparaître, avec quelles variantes, quelles stats. Le **tampon** (fourni) lui donne des fréquences *exposées* : compressées (une variante à 20 % dans Orvane peut n'en faire que 2 % à l'écran), étalées dans le temps, et limitées aux traits que votre jeu sait rendre.
3. **Votre traducteur compte** les rencontres, les prélèvements, les captures, les déplacements, l'habitat gagné ou perdu, et envoie des **lots de pressions** bruts. Le tampon les rapporte à l'activité, les dénormalise, les plafonne et les lisse avant que le moteur ne les intègre.
4. **Le profil** (`profil.json`) règle tout cela pour votre jeu, sans toucher à la biologie.
5. **Chaque nuit**, l'hébergement fait tourner un cycle et publie l'instantané suivant.

Trois règles pour que ça reste juste :
- Orvane ne reçoit jamais de conclusions, seulement des comptes : « 14 tués, 31 croisés », pas « ils sont trop chassés ».
- Un trait n'est jamais une stat. C'est un organe, un coût, un effet. C'est *vous* qui décidez ce qu'une glande qui crache vaut en dégâts.
- Ce que votre jeu ne sait pas rendre continue d'évoluer dans Orvane ; vous l'exposerez le jour où vous saurez le dessiner.

Les fichiers de référence : `schemas/` (le contrat, avec un exemple rempli), `moteur/catalogue.js` (tous les traits possibles, et les traits continus), `moteur/corps.js` (la silhouette d'une lignée et le catalogue de ses organes), `tampon/tampon.js` (`exposer()` et `agreger()`).
