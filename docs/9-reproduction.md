# 9. La reproduction sexuée : deux parents, des allèles, des préférences

Jusqu'ici, un petit naissait du phénotype de son parent, comme une bouture. Désormais, chaque petit reçoit un allèle de sa mère et un de son père pour chaque trait du catalogue. Les traits peuvent alors se cacher et revenir, les pères sont choisis, et une portée ressemble à ses parents.

## Ce que porte une population

```json
"populations": [ { "biome": "prairie", "effectif": 5752, …, "alleles": { "albinisme": 0.069, "robe-doree": 0.075, "gigantisme": 0.001, … } } ]
```

**`alleles`** : pour chaque trait, la fréquence p de l'allèle qui le porte. Une bête en a deux copies (Hardy-Weinberg) :
- un trait **dominant** (le défaut) se voit dès une copie, chez une part 1 − (1 − p)² des bêtes ;
- un trait **récessif** (`heredite: 'recessif'` au catalogue : l'albinisme, la robe dorée, le nanisme) ne se voit qu'avec deux copies, chez p² des bêtes. Un allèle à 7 % ne fait que 0,5 % d'albinos ; les autres sont des **porteurs cachés**.

Les `phenotypes` restent ce qui **se voit**, avec leurs fréquences. Les allèles sont l'état : un phénotype trop rare pour la liste peut disparaître sans que ses allèles se perdent.

## Comment le moteur fait naître les petits

À chaque cycle, pour chaque population (`moteur/orvane.js`) :

1. **Les parents.** Les mères pèsent par leur fécondité (ce que coûte chaque trait, la place, la viande mangée). Les pères pèsent aussi par leur **attrait** (`attrait` au catalogue) : une robe dorée (1,6), une grande taille (1,3 pour le gigantisme, et la taille continue, docs/8) attirent ; un nain (0,8), un albinos (0,85) moins. On en tire la fréquence d'allèle chez les mères et chez les pères.
2. **Les petits.** À chaque locus, un allèle de la mère et un du père ; les loci sont indépendants. On obtient la part de petits de chaque combinaison, et ce qui s'en voit passe par l'**épistasie** : dans l'ordre du catalogue, un trait reste si ce qu'il exige est là et si rien de gardé ne l'exclut. L'albinisme efface les autres robes, et un jet sans glande ne se voit pas. Une combinaison neuve (deux parents de phénotypes différents) devient un phénotype dès qu'elle dépasse un demi-individu.
3. **Les allèles après le cycle.** Les adultes survivants gardent les leurs, les petits survivants ceux de leurs parents. Ce qui tue (prédateurs, joueurs, maladies) et ce qui fait naître agit par groupe : ceux qui montrent le trait et les autres. Puis viennent la mutation (2 pour 10 000 par génération, dans les deux sens) et la dérive, forte dans une petite population.
4. **Les migrants** apportent leurs allèles ; **une lignée qui se sépare** part avec ceux de sa population ; **un trait neuf** apparaît comme un allèle rare (0,1 % s'il est dominant, 3 % s'il est récessif : il a dérivé sans se voir jusqu'à ce que deux porteurs se rencontrent).

Ce que ça change (banc : `traducteurs/stone-valley/banc.js`, section 8) :
- **Le réservoir récessif.** Abattre tous les brouteurs albinos pendant quinze cycles les fait disparaître ; trente cycles plus tard, ils sont revenus à 0,16 %, nés de parents qui ne l'étaient pas. Avec l'ancien moteur, ils ne revenaient pas.
- **Le choix du partenaire.** La robe dorée du crapaud coûte en survie (plus voyante) mais attire. En 120 cycles, elle passe de 0,19 % à 0,30 % ; si les partenaires ne choisissaient pas, elle tomberait à 0,24 %.
- **Des équilibres neufs.** Un trait récessif coûteux se maintient caché ; un dominant coûteux est purgé plus vite. Le monde sv-1 a été refait de zéro pour que sa génération 0 soit l'équilibre de ces règles.

`REGLES.sexe` règle tout cela : `actif: false` rend l'ancien moteur clonal (et `REGLES.mutation`), `attrait: 0` supprime le choix du partenaire.

## Côté jeu : un petit ressemble à sa mère

Le tampon donne deux outils :
- **`Tampon.sachantMere(e, dominant, montre)`** : la part des petits qui montrent un trait, sachant si leur mère le montre, le père pris au hasard dans une population où la part e le montre. Sur toutes les mères, on retrouve exactement e : **les taux d'ensemble ne bougent pas**, seules les portées se ressemblent.
- **`Tampon.exprimer(porte, catalogue)`** : ce qui se voit d'un jeu de traits portés, avec l'épistasie du catalogue de l'instantané (ses traits y sont dans l'ordre du moteur).

Quelques valeurs, aux taux de Stone Valley :

| la mère | ses petits |
| --- | --- |
| albinos (récessif, 1 naissance sur 2 600 environ) | 2 % d'albinos, contre 0,04 % sans mère connue |
| géante (dominant) | la moitié de géants |
| porte un trait à 18 % (dominant) | 57 % de ses petits le portent, contre 10 % chez les autres mères |
| un écart-type au-dessus pour la taille | ses petits, h²/2 écart-type au-dessus en moyenne (docs/8) |

## Stone Valley (§213)

`orvaneNaissance(b, mere)` aux trois naissances qui ont une mère (le troupeau, les doux, les petits qui suivent) : la robe, la forme (avec les mêmes cornes que sa mère), les conduites et les traits continus se tirent sachant ceux de la mère. Une mère dorée suivie de petits dorés, une cracheuse dont les petits crachent : on apprend à suivre les bonnes mères.

## Ce qui vient ensuite

- **L'élevage** : deux compagnes connues, père et mère, au campement ; le petit tiré entre leurs deux génotypes, et la sélection du joueur rapportée comme une pression.
- **La préférence qui évolue** : un trait « exigence » des femelles, lié aux ornements qu'elles choisissent (l'emballement de Fisher), au lieu d'un attrait fixé au catalogue.
- **Des loci liés** : des traits qui voyagent ensemble sur un même chromosome, au lieu de loci indépendants.
