# 11. Les organes : une liste ouverte, à leur place, à leur taille

Une silhouette avait cinq organes possibles (cornes, crête, ailes, carapace, antennes), chacun réduit à un nombre de 0 à 1. Désormais, `plan.corps.organes` est une liste. Chaque organe a un type, une place, une taille, un nombre et une forme. Le catalogue des types est publié avec l'instantané : un type de plus, c'est une entrée de catalogue, pas un changement de schéma.

## Ce que porte une silhouette

```json
"corps": { "forme": "quadrupede", …, "cornes": 0.5, "crete": 0, "ailes": 0, "carapace": 0, "antennes": 0,
  "organes": [ { "type": "cornes", "place": "tete", "taille": 0.5, "nombre": 2, "forme": "recourbees" },
               { "type": "massue", "place": "queue", "taille": 0.81, "nombre": 1, "forme": "cloutee" } ] }
```

- **`type`** : un type du catalogue. Un lecteur qui ne le connaît pas l'ignore.
- **`place`** : tête, dos, flancs, queue ou avant. Une crête peut pousser sur la tête ou sur le dos, des épines sur le dos, les flancs ou au bout de la queue.
- **`taille`** : de 0,2 à 1. Sous 0,2, l'organe se perd.
- **`nombre`** et **`forme`** : dans ce que le catalogue permet pour ce type, par exemple une à quatre cornes, recourbées, droites ou ramifiées.

Les cinq nombres d'avant restent là, pour les lecteurs anciens. Chacun vaut la plus grande taille de son type dans la liste. Une silhouette d'avant, sans liste, se lit en organes (`Corps.normaliser`) : chaque nombre d'au moins 0,2 devient un organe à sa place habituelle.

## Le catalogue (`catalogue.organes`, `moteur/corps.js`)

| type | places | fonction | conduite prêtée au jeu |
| --- | --- | --- | --- |
| cornes, défenses | tête | combat | `charge` (1,2 ; 1,25) |
| crête, collerette | tête, dos ; tête | parade | `avertissement` (collerette) |
| antennes | tête | sens | `perception-proche` (1,1) |
| trompe | tête | saisir | — |
| ailes, nageoires | flancs ; flancs, dos | déplacement | — (le vol et la nage sont des modes de déplacement) |
| carapace | dos | défense | `repli` (1,4) |
| plaques, épines | dos ; dos, flancs, queue | défense | `protection` (1,2 ; 1,15) |
| massue | queue | combat | `charge` (1,3) |
| aiguillon | queue | combat | `riposte-contact`, venin |
| panache | queue | parade | — |
| pinces | avant | combat | `morsure` (1,2) |

La conduite emploie le vocabulaire des traits (docs/7), avec son présage (« balance sa queue lourde ») et un nom pour le panneau (« à massue »). Sa force croît avec la taille de l'organe : `1 + (force − 1) × min(1,5 ; taille / 0,6)`. Un organe de moins de 0,3 n'en prête aucune. Une massue de 0,8 charge à 1,4, une de 0,35 à 1,18.

## Comment ils évoluent

À chaque séparation d'une lignée (`Corps.deriver`) :
- les organes présents dérivent en taille. Plus rarement, ils changent de nombre (une chance sur dix) ou de forme (une sur vingt) ;
- **un organe neuf est une innovation rare.** Une séparation sur seize environ en fait naître un, d'un type que la lignée n'a pas. Le tirage est pondéré par la vie qu'elle mène : des armes chez un chasseur, des défenses chez une proie, des nageoires dans l'eau, une parade en terrain ouvert, des antennes dans l'ombre, des pinces et un aiguillon chez un hexapode ;
- un organe se perd parfois (une séparation sur trente-trois), ou quand sa taille passe sous 0,2 ;
- les modes de déplacement laissent leur marque comme avant : le vol pose des ailes, la nage parfois des nageoires. L'ombre allonge les antennes.

Les organes entrent dans l'écart de silhouette (`Corps.distance`). Deux lignées qui diffèrent par une massue s'écartent donc davantage, et sont plus isolées l'une de l'autre (docs/10). Comme le reste de la silhouette, les organes ne pèsent pas encore sur la survie dans le moteur : ils servent à dessiner les lignées et à les faire agir dans le jeu.

## Côté jeu

- **Décrire** : `Corps.decrire(corps)` → « quadrupède, queue, museau, une corne droite, une grande massue cloutée au bout de la queue ».
- **Dessiner** : chaque organe a son dessin, à sa place, à sa taille, sur les cinq formes de corps. Le jeu dessine la bête en boîtes et en pictogramme (Stone Valley, `lignees.js`), l'observatoire en croquis.
- **Faire agir** : `conduitesDe(traits, catalogue, locomotion, organes, catalogue.organes)` (traducteur de Stone Valley) ajoute aux conduites des traits celles des organes, en commençant par le plus grand. Seules les lignées nées dans Orvane en tirent. Une espèce du jeu garde ses conduites à elle : le jour un ne change rien.

## Stone Valley (§215)

Une lignée à cornes, à défenses ou à massue **charge** : ses coups portent plus fort, et le carnet le note. Une lignée à aiguillon pique qui la frappe de près (`dard`, venin). Des plaques ou des épines amortissent les coups (`cuir`), une carapace la fait se replier (`carapace`), des pinces mordent (`crocs`), des antennes sentent de près (`vibrisses`). Le panneau dit « à massue » plutôt que « qui charge » quand l'organe est connu. Une compagne garde ces noms.

## Ce qui vient ensuite

- **La sélection sur les organes** : une carapace qui épaissit sous la prédation, une massue qui grandit chez une proie souvent attaquée. Il faudra un coût et un effet par fonction dans le moteur.
- **Les organes des espèces du jeu** : lire les cornes, les crêtes, les carapaces des fiches de Stone Valley comme des organes, pour qu'elles innovent elles aussi.
- **Des types propres à un monde** : un profil qui ajoute ses organes au catalogue.
