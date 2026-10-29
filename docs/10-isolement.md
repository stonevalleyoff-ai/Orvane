# 10. L'isolement et les hybrides : comment une espèce se coupe en deux, et se recoud

Une lignée naissait jusqu'ici d'un coup de dés : une population installée loin de sa niche avait une petite chance par cycle de devenir une espèce. Désormais, ce qui sépare deux populations se mesure : les gènes qu'elles échangent, l'écart qu'elles ont pris. Et deux lignées apparentées qui se retrouvent dans un même biome se croisent, d'autant moins qu'elles sont déjà isolées.

## Ce que porte une population

```json
"populations": [ { "biome": "lande", "effectif": 1957665, …,
  "flux": 0.031, "divergence": 0.004,
  "hybride": { "avec": "kiume.neige", "part": 0.012, "isolement": 0.81 } } ]
```

- **`flux`** : la part d'immigrants que reçoit la population, par cycle, en moyenne glissante. C'est le flux de gènes : près de 0, elle est isolée.
- **`divergence`** : son écart génétique au reste de l'espèce. C'est le F_ST de leurs allèles (0 : une seule population ; 0,25 : très différenciées), plus le quart de l'écart moyen des traits continus. La dérive et la sélection le creusent, les migrants le comblent.
- **`hybride`** : une zone hybride. Une lignée apparentée (`avec`) vit dans le même biome. Une part des naissances (`part`) a un père de cette lignée et survit. `isolement` mesure à quel point les deux ne se croisent plus.

## La spéciation

Une population installée depuis 30 cycles, d'au moins 60 bêtes, peut devenir une lignée par deux chemins :
- **l'écologie**, comme avant : elle vit loin de sa niche ;
- **l'isolement**, où qu'elle vive : son écart génétique au reste de l'espèce dépasse 0,3 (`REGLES.separation.divergence`). Plus l'écart est grand, plus c'est probable.

Dans les deux cas, le flux de gènes freine la séparation : une population qui reçoit plus de 5 % d'immigrants par cycle (`REGLES.separation.flux`) ne se sépare pas. Les migrants la retiennent dans l'espèce.

## L'isolement reproductif et les zones hybrides

Entre deux lignées apparentées (l'une descend de l'autre, ou elles ont un ancêtre commun), l'isolement reproductif vaut :

```
I = 1 − e^−(temps / 200 + 2 · |ln(masse₁ / masse₂)| + 3 · écart de silhouette + écart de niche)
```

Il grandit avec le temps depuis leur séparation, l'écart de taille (l'isolement mécanique), de silhouette (organes compris, docs/11), de niche. Deux régimes, deux formes de corps (un quadrupède et un oiseau) ou deux lignées sans parenté ne se croisent pas : I = 1. Une lignée fille de 40 cycles, de même forme et d'une masse voisine, est isolée à 0,34 de sa mère ; 400 cycles plus tard, à 0,91.

Quand elles partagent un biome, une part `0,3 × (1 − I) × (sa part de la population du biome)` des mères a un père de l'autre lignée (`REGLES.hybride.rencontre`). Une part I de ces petits hybrides ne vit pas : se croiser coûte d'autant plus que les lignées ont divergé. Les survivants portent la moitié des gènes de l'autre lignée, allèles et traits continus. C'est l'**introgression** : elle rapproche les deux lignées, ce qui retarde leur séparation complète.

Ordres de grandeur (banc, section 9) : une lignée fille de brouteur qui revient dans la prairie de sa mère. 3,6 % des naissances de la mère sont hybrides. En 30 cycles, l'écart génétique entre les deux reste à 0,139 ; il monte à 0,153 si elles ne se croisent pas. Dans le monde de genèse, les lignées récentes forment des dizaines de zones hybrides avec leurs parentes, de 0,1 à 2 % des naissances.

Un événement `hybridation` est publié quand une zone hybride passe 1 % des naissances (`REGLES.hybride.zone`).

## Côté jeu

Sur une île où la population d'une espèce se croise avec une lignée apparentée, une part des bêtes naît hybride. Cette part est celle de l'instantané, pondérée par les effectifs des biomes de l'île. Le traducteur de Stone Valley les marque (`b.hybride`) : le panneau de la bête le dit (« hybride, père brouteur de lande »), elle tient la moitié de ses traits non rendus de la lignée du père (donc certaines de ses conduites), et une compagne hybride le reste. Elle est rapportée à Orvane comme une bête de la lignée de sa mère.

## Ce qui vient ensuite

- **La fusion** : deux lignées encore peu isolées qui se mêlent longtemps redeviennent une seule espèce.
- **Le renforcement** : là où les hybrides meurent, les partenaires apprennent à choisir les leurs (la préférence évolue, docs/9), et l'isolement se ferme plus vite.
- **Les espèces hybrides** : une zone hybride stable, isolée de ses deux parentes, qui devient une lignée à part entière.
