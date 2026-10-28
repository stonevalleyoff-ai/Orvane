# 2. Les correspondances

Tout ce que le traducteur sait de votre jeu tient dans trois tables. Orvane ne les voit jamais.

## Biomes : vos sols → les cinq axes

Décrivez chacun de vos sols sur les cinq curseurs, avec son milieu et, si vous pouvez, sa richesse en nourriture et ses voisins. C'est **vous** qui définissez les biomes du monde Orvane de votre jeu (ils sont dans l'amorce, chapitre 5) ; la table sert ensuite dans les deux sens.

```js
const BIOMES = {
  prairie:   { axes: { temperature: .55, humidite: .5,  altitude: .2, lumiere: .9, couvert: .3 }, milieu: 'terrestre', voisins: ['bois', 'lande'] },
  tourbiere: { axes: { temperature: .5,  humidite: .95, altitude: .1, lumiere: .6, couvert: .5 }, milieu: 'amphibie',  voisins: ['prairie'] },
};
```

Si votre jeu génère des sols procéduraux sans nom, faites l'inverse : calculez les axes depuis le terrain (altitude, humidité, densité de végétation…) et prenez le biome Orvane **le plus proche** (distance euclidienne sur les cinq axes). Un sol où aucune vie n'a de sens (lave, vide) ne correspond à rien : n'y faites rien apparaître et n'y comptez rien.

## Taxons : les id Orvane → vos entités

Par défaut, le même identifiant des deux côtés — c'est le plus simple quand vous amorcez le monde depuis votre bestiaire (chapitre 5). Sinon une table explicite :

```js
const TAXON_ESPECE = { 'crapaud-buffle': 'crapaud' };
```

**Les lignées nouvelles.** Orvane fera apparaître des taxons que votre jeu ne connaît pas (`brouteur.bois`, séparé du brouteur). Deux politiques :
- *rendre par le parent* : remonter `parent` jusqu'à un taxon connu, et afficher ce corps-là avec les stats de la lignée (plus petite, moins farouche…) et les couleurs de sa silhouette ;
- *construire le corps* : si votre jeu assemble ses créatures par morceaux, dessinez la lignée d'après `plan.corps` (forme, pattes, proportions, organes, couleurs) et les traits que porte la majorité de ses phénotypes. C'est la voie royale, et la plus coûteuse.

Stone Valley fait les deux : une lignée est rendue par son parent tant que sa silhouette lui ressemble (`OrvaneCorps.distance` sous 0,3, même forme, mêmes pattes, pas d'ailes gagnées), construite dès qu'elle s'en écarte ; une lignée sans ancêtre dans le jeu (un monde né de la genèse) est toujours construite, et emprunte sa conduite à un gabarit choisi par son régime. Gardez la fiche d'une lignée chez le joueur : une bête liée doit survivre à l'extinction de sa lignée.

Et à l'inverse, une espèce de votre jeu qui n'est **pas** dans Orvane (un automate, un boss) : le traducteur répond « je ne sais pas » et le jeu fait comme avant. Ne forcez jamais une correspondance.

## Traits : ce que votre jeu sait rendre → vos variantes

```js
const TRAIT_VARIANTE = { albinisme: { robe: 'albinos' }, gigantisme: { taille: 'geant' }, 'jet-glandulaire': { attaque: 'crachat' } };
```

Listez les mêmes traits dans `exposition.traits_rendus` du profil : tout phénotype portant un trait absent de cette liste est **fondu dans le phénotype de base** à l'exposition. Il continue d'évoluer dans Orvane ; vos joueurs ne le voient pas encore. Quand vous saurez dessiner une carapace, vous ajouterez `carapace` aux deux listes et elle apparaîtra, à la fréquence qu'elle aura atteinte entre-temps.

Prévoyez aussi l'inverse (`traitsDe(variante)`) : quand une bête meurt ou est capturée, vous devez retrouver son phénotype pour le dire à Orvane (chapitre 4).
