# Orvane — le contrat (v0.1)

Trois objets suffisent à brancher un jeu. Orvane ne connaît aucun jeu ; le jeu ne connaît aucune biologie.

| objet | sens | qui l'écrit | fichier |
| --- | --- | --- | --- |
| **instantané** | Orvane → jeu | le moteur, une fois par cycle | `instantane.schema.json` |
| **pression** | jeu → Orvane | le traducteur, par lot (à la sauvegarde, à la déconnexion…) | `pression.schema.json` |
| **profil** | réglage du tampon | l'auteur du jeu, une fois | `profil.schema.json` |

## Ce que le jeu lit dans un instantané

- **biomes** : décrits par cinq axes de 0 à 1 et un milieu, jamais par un nom. Le traducteur fait correspondre ses biomes aux axes (le plus proche gagne).
- **catalogue** : les traits présents ce cycle. Un trait = un organe, un coût énergétique, un effet, parfois un comportement et des matières fournies. C'est au traducteur d'en faire une attaque, un loot, une hitbox.
- **taxons** : un plan corporel commun (masse, taille, locomotion, régime, tempérament, sociabilité…), des populations par biome, et des **phénotypes** : des combinaisons cohérentes de traits avec leur fréquence. Un phénotype est toujours complet : le jet glandulaire n'existe pas sans sa glande, et son coût est inclus.
- **evenements** : ce qui a changé, pour le visualiseur ou pour le raconter en jeu.

## Ce que le jeu renvoie

Des comptes bruts, jamais interprétés : rencontres, prélèvements, captures, nourrissages, déplacements, habitat perdu/gagné. Le tampon se charge de :

1. **rapporter** les comptes à l'exposition (les rencontres) et à l'activité normale d'un compte ;
2. **dénormaliser** : une variante montrée à 2 % mais réelle à 20 % voit ses pertes multipliées par 10 ;
3. **plafonner** par compte, par part de population, par cycle ;
4. **lisser** sur plusieurs cycles : une chasse ponctuelle pèse peu, une chasse soutenue pèse.

## Le profil

Un monde par jeu. Le profil règle l'**exposition** (compression des fréquences, propagation étalée, inertie, traits que le jeu sait rendre, seuil sous lequel le jeu cesse de faire apparaître un taxon) et l'**influence** (poids des actions, plafonds, mémoire).

Les exemples de `exemples/` décrivent le crapaud buffle de Stone Valley : 20 % de cracheurs dans Orvane, exposés à 2 % dans le jeu, une population de marais en déclin sous la chasse, et une lignée de ruisseau qui vient de s'en séparer.
