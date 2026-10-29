# 12. La méfiance et l'habituation : ce qu'une population apprend des joueurs

Les bêtes chassées par les joueurs apprennent à les craindre ; celles qu'on croise sans leur faire de mal finissent par s'y habituer. Orvane tient cette mémoire par population. Elle se nourrit des rencontres et des prélèvements, et retombe avec le temps. Le jeu la rend en distance de fuite.

C'est un apprentissage, pas un gène : il ne passe pas aux petits par les allèles, et il s'efface quand les joueurs s'en vont. L'**audace** (docs/8), elle, est héritée : la chasse des plus audacieux la fait baisser lentement, génération après génération. Les deux se combinent.

## Ce que porte une population

```json
"populations": [ { "biome": "tourbiere", "effectif": 41210, …, "mefiance": 0.57, "habituation": 0.04 } ]
```

- **`mefiance`** (0 à 1) : nourrie par les contacts qui finissent mal. Elle retombe de moitié en 6 cycles sans joueurs.
- **`habituation`** (0 à 1) : nourrie par les rencontres sans suite et par l'aide (nourrir, relâcher). Elle retombe de moitié en 15 cycles, et ce qui finit mal la défait.

Absentes, elles valent 0. Le jour un, aucune population n'en porte.

## D'où elles viennent

Le tampon compte, pour chaque population, ce que ses bêtes ont vécu des joueurs (`contact` dans les pressions) :
- `rencontres` : les rencontres du lot, sans suite ;
- `danger` : les prélèvements, plus les captures à moitié (la bête est emmenée, pas tuée sous les yeux des autres) ;
- `aide` : les nourrissages et les libérations.

Un compte trop actif est ramené à `exposition_ref` rencontres, prélèvements compris, comme pour les retraits : un joueur qui court partout ne pèse pas plus qu'un autre.

À chaque cycle (`apprendre`, `REGLES.mefiance`) :
1. la méfiance et l'habituation retombent (demi-vies de 6 et 15 cycles) ;
2. la **méfiance** va vers `1 − e^(−6 × part des contacts qui finissent mal)` : 0,45 si un contact sur dix finit mal, 0,70 pour un sur cinq. Elle y va d'autant plus vite que les contacts sont nombreux (aux deux tiers pour 20 contacts). Des contacts paisibles la défont trois fois moins vite qu'elle ne s'apprend ;
3. l'**habituation** monte avec les rencontres sans suite (aux deux tiers pour 150 rencontres, l'aide comptant triple). Il suffit cependant qu'un contact sur dix finisse mal pour qu'elle ne monte presque plus, et ce qui finit mal la fait retomber ;
4. une population **audacieuse** (son audace moyenne z, docs/8) s'habitue plus vite et se méfie moins : à z = +1,5, la même chasse la rend plus de deux fois moins méfiante qu'à z = −1,5 (0,31 contre 0,73).

Quand la méfiance d'une population passe 0,5, le journal le note (événement `mefiance`).

Quelques équilibres, après vingt cycles au même régime :

| chaque cycle | méfiance | habituation | distance de fuite (Stone Valley) |
| --- | --- | --- | --- |
| 60 rencontres, aucune bête prise | 0 | 0,92 | × 0,53 |
| 60 rencontres, une ou deux bêtes prises (1,2 en moyenne) | 0,11 | 0,63 | × 0,71 |
| 60 rencontres, 6 bêtes prises | 0,42 | 0,07 | × 1,33 |
| 30 rencontres, 6 bêtes prises | 0,62 | 0 | × 1,62 |

Le moteur ne fait que tenir cette mémoire ; il ne s'en sert pas. C'est le jeu qui la rend, et la boucle se ferme d'elle-même : une bête méfiante fuit de plus loin, se laisse moins approcher et moins prendre, et sa population se calme.

## Côté jeu

Le profil dit comment la rendre (`exposition.mefiance`) :

```json
"mefiance": { "rendue": true, "fuite": 2.2, "habitude": 0.5 }
```

La distance de fuite est multipliée par `fuite^méfiance × habitude^habituation` : × 2,2 pour une population tout à fait méfiante, × 0,5 pour une tout à fait habituée. `rendue: false` éteint l'effet dans le jeu ; Orvane continue de tenir la mémoire.

Stone Valley (§216) lit la population **du biome où naît la bête** et multiplie son facteur de fuite (`b.fq`, qui porte déjà l'audace). Le panneau de la bête désignée dit « se méfie des chasseurs », « fuit les chasseurs : on la chasse ici » ou « habituée aux passants ». Les compagnes n'en tiennent pas compte.

## Ce qui vient ensuite

- **La traque** : un prédateur qui apprend, lui aussi, et suit les joueurs au lieu de les fuir (le genre horreur).
- **La méfiance qui voyage** : des migrants qui l'emportent vers une population voisine.
- **Les prédateurs de l'île** : une méfiance nourrie aussi de la prédation naturelle, pour que les proies d'un biome riche en chasseurs soient farouches d'emblée.
