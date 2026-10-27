# Brancher son jeu sur Orvane — le mode d'emploi

Orvane fait vivre un monde : des espèces, des biomes, des populations qui naissent, meurent, migrent, mutent et se séparent. Il ne sait rien de votre jeu. Pour l'y brancher, vous écrivez un **traducteur** : un petit fichier, côté client, qui lit ce qu'Orvane publie et le rend jouable, puis qui renvoie ce que vos joueurs font. Ce guide explique comment, chapitre par chapitre, avec le traducteur de Stone Valley comme exemple de bout en bout.

| chapitre | ce que vous saurez faire |
| --- | --- |
| [1. Lire un instantané](1-lire-un-instantane.md) | comprendre le fichier qu'Orvane publie chaque nuit |
| [2. Les correspondances](2-correspondances.md) | relier vos biomes, vos espèces, vos variantes à ceux d'Orvane |
| [3. Traduire un phénotype](3-traduire-un-phenotype.md) | faire d'un corps biologique des statistiques de jeu : physique, mouvement, comportement, attaque, objets, apprivoisement |
| [4. Renvoyer des pressions](4-renvoyer-des-pressions.md) | compter ce que font les joueurs, sans tricher ni compter deux fois |
| [5. Le profil et les essais](5-profil-et-essais.md) | régler le tampon pour votre jeu et tout vérifier hors ligne |
| [6. L'exemple Stone Valley](6-exemple-stone-valley.md) | le traducteur complet, commenté |

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

Les fichiers de référence : `schemas/` (le contrat, avec un exemple rempli), `moteur/catalogue.js` (tous les traits possibles), `tampon/tampon.js` (`exposer()` et `agreger()`).
