# 7. Les conduites : ce que l'évolution fait FAIRE aux bêtes

Un trait n'est pas qu'une allure. Une glande qui crache, une carapace, des yeux de nuit, l'instinct de groupe : ce sont des **conduites**. Orvane les décrit dans un vocabulaire abstrait ; chaque jeu les joue à sa façon. C'est le chapitre qui fait passer l'évolution de l'écran au gameplay.

## Le vocabulaire (catalogue, `conduite`)

Chaque trait du catalogue qui fait agir porte une `conduite` :

```js
'jet-glandulaire': { …, conduite: { type: 'riposte-distance', effet: 'irritant', portee: 3, recharge: 7, presage: 'gonfle la glande sous sa gorge' } }
```

| type | traits | ce que la bête fait |
| --- | --- | --- |
| `riposte-distance` | jet glandulaire | projette quelque chose sur ce qui la menace, avant de fuir |
| `riposte-contact` | dard | blesse ce qui la frappe de près |
| `defense-contact` | glande irritante | ce qui la touche en pâtit |
| `repli` | carapace | encaisse ; acculée, se ferme |
| `protection` | peau épaisse | encaisse un peu mieux |
| `immobilite` | camouflage | se fige et se fond quand on approche, détale au dernier moment |
| `alerte-groupe` | grégarisme | prévient ses congénères : tout le groupe fuit |
| `defense-petits` | soins parentaux | charge ce qui approche de ses petits |
| `vision-nocturne`, `perception-proche`, `vue-diurne-faible` | yeux nocturnes, vibrisses, albinisme | voit plus loin la nuit, sent de plus près, voit mal au soleil |
| `morsure`, `sprint`, `lenteur` | crocs, pattes longues, métabolisme lent | mord plus fort, détale plus vite, fait tout plus lentement |
| `escalade`, `nage`, `vol-plane`, `avertissement`, `activite-crepuscule` | queue préhensile, palmes, membrane, couleurs d'alerte, crépuscularité | (à jouer selon ce que le jeu sait faire) |

Les paramètres (`effet`, `portee` en longueurs de corps, `recharge` en secondes, `force` en multiplicateur) sont des indications ; le **`presage`** dit ce qu'un joueur attentif voit *avant* la conduite. Un jeu qui ne sait pas jouer un type l'ignore : la bête évolue quand même, et le jour où le jeu saura, la conduite apparaîtra à la fréquence qu'elle aura atteinte.

**C'est le type qui compte, pas le trait.** Un trait ajouté demain au catalogue, de type `riposte-distance`, crachera dans tous les jeux qui savent jouer ce type — sans une ligne de plus côté jeu.

## Chaque bête a son phénotype

Pour qu'une conduite se *voie évoluer*, il faut qu'elle soit portée par des individus, pas par une espèce. En mode relatif, le profil fait deux tirages indépendants à chaque naissance :
- l'**allure** (les traits rendus : robes, tailles) aux taux du jeu × l'écart du monde depuis la génération 0 — les robes rares restent rares ;
- les **traits non rendus** (ceux qui agissent) à leur **fréquence réelle** (`exposition.non_rendus: 'reel'`, `tampon.partsRelatif`).

Un crapaud sur cent soixante a des yeux de nuit si c'est ce que porte le monde ; quand les cracheurs passent de 1 % à 30 % dans Orvane, un crapaud sur trois crache dans le jeu. Et la bête garde l'identifiant **exact** de son phénotype : abattue ou liée, elle est rapportée telle quelle. La sélection que font les joueurs — épargner les cracheurs, chasser les grégaires — revient au moteur sans approximation.

## Jouer une conduite : trois règles

1. **Elle s'annonce.** Une conduite qui frappe sans prévenir est injuste ; annoncée, elle s'apprend. La gorge gonfle trois quarts de seconde avant le jet ; la bête figée se trahit si l'on s'en approche assez ; l'appel du grégaire se voit.
2. **Elle se découvre.** La première fois qu'on la voit chez une espèce, le jeu le dit, et le garde (un carnet). Avant, de près, le présage met le joueur sur la piste ; après, la bête désignée porte son nom (« cracheur »).
3. **Elle sert qui lie la bête.** Une conduite ne s'éteint pas à l'apprivoisement : la compagne qui crache crache sur ce qui vous attaque ; la grégaire donne l'alerte ; les yeux de nuit débusquent les camouflés. Ce qu'Orvane a fait évoluer devient un talent.

## Stone Valley

`correspondance.js` traduit le type en conduite du jeu (`CONDUITE_JEU`) ; `conduitesDe(traits, catalogue, locomotion)` donne celles d'une bête (une lignée fouisseuse ajoute `terrier`). Le jeu les joue dans `conduites.js` : le jet (sur le modèle des spores du vesseron : visé là où l'on sera, voile d'irritation, statut « Irrité »), le dard (le poison du jeu), la peau irritante, la carapace (robustesse, repli), le cuir, le camouflage (figé et fondu dans le sol), l'alerte (le groupe détale), la défense des petits (une charge), la vision, les crocs, la foulée, la lenteur, le terrier. Carnet des conduites sauvegardé ; phénotype et conduites de chaque compagne sauvegardés avec elle.

## Voir grand

Ce qui vient naturellement après, dans l'ordre où ça rapporte :

- **Les combinaisons font des tactiques.** Camouflage + crocs : l'embuscade. Grégarisme + carapace : la phalange qui fait front. Grégarisme + jet : la volée. Rien à écrire dans Orvane : il fait déjà évoluer les combinaisons ; c'est au jeu de reconnaître les paires et de les jouer.
- **La méfiance apprise.** Une population chassée devrait fuir plus tôt. Orvane peut tenir, par population, une `mefiance` nourrie des prélèvements (et qui retombe avec le temps) ; le traducteur la rend en distance de fuite. Le joueur sentirait qu'une île vidée la veille le reconnaît.
- **L'élevage.** Les compagnes portent leur phénotype : deux compagnes qui se reproduisent au campement transmettraient leurs traits, et ce que le joueur sélectionne (des cracheurs, des grégaires) remonterait comme une pression — la sélection artificielle à côté de la naturelle.
- **Les comportements de population.** Les migrations d'Orvane (saisons, surpeuplement, faim) deviennent des troupeaux qui traversent une île ; les épidémies, des bêtes malades qui toussent et contaminent (une conduite `malade`) ; la chaîne alimentaire, des chasses qu'on voit se faire.
- **Les conduites de l'esprit.** Curiosité, mémoire des lieux, hiérarchie, jeu chez les jeunes : des traits de comportement à ajouter au catalogue, avec leur coût et leur présage, que chaque jeu jouera quand il saura.
- **Un vocabulaire partagé.** Plus le vocabulaire est stable, plus un monde Orvane se branche facilement sur un nouveau jeu : c'est le contrat, au même titre que le schéma de l'instantané.
