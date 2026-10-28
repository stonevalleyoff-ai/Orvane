# 8. La génétique continue : deux bêtes d'une espèce ne sont plus identiques

Les traits du catalogue sont des tout-ou-rien : une bête crache ou ne crache pas. La taille, la vitesse, l'audace et la sociabilité, elles, varient **continûment** d'une bête à l'autre, et la sélection les déplace petit à petit. Ce chapitre décrit comment Orvane les fait évoluer et comment un jeu en tire chaque bête.

## Ce que porte une population

Chaque population (un taxon dans un biome) porte, pour chaque trait continu, trois nombres :

```json
"populations": [ { "biome": "prairie", "effectif": 5807, …,
  "quant": { "taille": { "m": -0.21, "v": 0.99, "g": 0.49 }, "vitesse": { "m": 0.1, "v": 1, "g": 0.35 }, … } } ]
```

- **`m`**, la moyenne. L'unité est l'**écart-type naturel à la génération 0** : `m = −0,21`, c'est une population dont la bête moyenne mesure ce que mesurait, au départ, une bête à 0,21 écart-type sous la moyenne.
- **`v`**, la variance des bêtes (phénotypique) : un jeu tire chaque bête dans N(m, v).
- **`g`**, la part héritable de cette variance (additive). L'héritabilité est `g / v` ; c'est elle qui dit à quelle vitesse la sélection agit.

Ce que vaut un écart-type est dans `catalogue.quantitatifs` (et `moteur/catalogue.js`, `QUANT`) :

| trait | champ du plan | un écart-type vaut | héritabilité au départ | ce qui le déplace |
| --- | --- | --- | --- | --- |
| `taille` | `taille_m` (la masse suit au cube) | ±5 % de longueur | 0,5 | le froid (plus grande, règle de Bergmann) ; les joueurs |
| `vitesse` | `vitesse_rel` | ±7 % | 0,35 | le terrain ouvert ; la prédation (la plus vive s'échappe) |
| `audace` | `temperament` | ±0,1 | 0,3 | la fécondité (l'audacieuse mange mieux) contre la prédation (elle se fait prendre) |
| `sociabilite` | `sociabilite` | ±0,08 | 0,3 | la prédation (le groupe protège) contre la maladie (le groupe propage) |

## Comment le moteur les fait évoluer

À chaque cycle, pour chaque population (`moteur/orvane.js`, `evoluerQ`) :

1. **Les morts sélectives déplacent les survivants.** Un risque qui croît avec le trait (prédation, maladie : risque ∝ e^(pente·z)) tue une part décalée de pente × v ; les joueurs, eux, disent le z moyen des bêtes qu'ils ont prises (le tampon le passe au moteur). La moyenne génétique bouge de (g / v) × la différentielle de sélection : c'est l'équation de Lande, R = h² S.
2. **Les naissances** portent la moyenne des parents, plus la fécondité (une pente), moins la sélection stabilisante des jeunes vers l'**optimum** du biome : la niche du taxon, déplacée par l'écart du biome sur l'axe du trait (plus froid que la niche : plus grand).
3. **La mutation** remet de la variance, juste ce qu'il faut pour que celle de la génération 0 soit un équilibre ; **la dérive** en ôte et agite la moyenne, d'autant plus que la population est petite.
4. **Les migrants** apportent leurs gènes : les moyennes se pondèrent, l'écart entre elles devient de la variance.
5. **Une lignée qui se sépare** garde ce qu'elle a acquis : sa moyenne passe dans son plan (plus grande, plus vive…) et repart de zéro.

L'échelle de temps vient d'elle-même : la part de nouveau-nés du cycle. Une bête qui se renouvelle vite évolue vite.

Et en retour, les moyennes pèsent sur l'écologie : une population plus audacieuse fait plus de petits et se fait plus manger ; une population qui s'est rapprochée de son optimum fait un peu plus de petits (l'adaptation rachète une part de ce que coûte un biome loin de la niche). **Le jour un, tous ces facteurs valent exactement 1** : un monde sans traits continus et le même monde avec donnent les mêmes effectifs au premier cycle.

Ordres de grandeur (banc : `traducteurs/stone-valley/banc.js`, section 7) : sans pression particulière, une moyenne bouge de quelques centièmes d'écart-type en trente cycles. Dix joueurs qui prennent chacun huit des plus grands brouteurs d'une prairie par cycle font baisser sa taille de 0,4 écart-type en trente cycles (2 % de longueur) ; prélever 8 % de la population à chaque cycle, de 1,7 écart-type en quarante ; arrêter la chasse ne la fait remonter que lentement (des centaines de cycles) — comme les poissons pêchés trop gros.

## Côté jeu : une valeur par bête

Le tampon donne la loi d'une île : `Tampon.quantDe(taxon, biomes, ref)` → `{ taille: { m, v, d }, … }`, mélange des populations des biomes de l'île pondérées par leur effectif ; **`d`** est l'écart de la moyenne depuis la génération 0 (`ref`).

À la naissance, la bête tire `z = m + √v × ε` et le garde. Elle **montre** `d + variation × (z − m)`, où `variation` est un réglage du profil (`exposition.quantitatifs.variation`, de 0 à 1) :
- **`variation: 0`** — toutes les bêtes d'une île ont l'allure de leur population. Le jour un, `d = 0` : rien ne change. Une population qui a rapetissé se voit plus petite, toute entière.
- **`variation: 1`** — toute la variation naturelle se voit : des grands, des petits, des vifs, des hardis.

Elle **rapporte** `z`, sa valeur exacte, avec chaque prélèvement ou capture (`q` dans l'événement, `schemas/pression.schema.json`). Avec `variation: 0`, les joueurs ne voient pas les différences entre bêtes d'une même île : leurs prises sont au hasard, et le z moyen rapporté le dit honnêtement (pas de sélection). Avec `variation: 1`, s'ils prennent les plus grands, Orvane le sait.

`exposition.quantitatifs.rendus` liste les traits que le jeu sait jouer ; les autres évoluent quand même.

## Stone Valley

`correspondance.js` (`QUANT_JEU`) : la taille multiplie le corps (`b.tq`), la vitesse l'allure (`b.vq`), l'audace la distance de fuite (`b.fq`, l'audacieuse laisse approcher plus près). Le panneau de la bête désignée le dit : « de grande taille », « peu farouche » pour une bête hors du commun parmi les siennes ; « l'espèce a rapetissé ici » quand la population de l'île a changé depuis la génération 0. Une compagne garde ses valeurs, sauvegardées avec elle. Le profil de sv-1 est à `variation: 0` : le jour un, rien ne change.

## Ce qui vient ensuite

- **La sélection sexuelle** : des ornements continus (taille des cornes, éclat de la robe) choisis par les partenaires, payés en survie.
- **Des traits corrélés** : une matrice G plutôt que des variances séparées (grandir ralentit-il ?).
- **L'élevage** : deux compagnes croisées donnent un petit tiré entre leurs deux valeurs — la sélection artificielle à côté de la naturelle.
- **La méfiance apprise**, à côté de l'audace héritée : une population chassée qui fuit plus tôt dès le lendemain, et qui oublie avec le temps.
