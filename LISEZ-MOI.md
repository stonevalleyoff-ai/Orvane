# Orvane — v1

Un moteur d'écosystème et d'évolution, indépendant de tout jeu. Il simule la vie dans des biomes abstraits ; un jeu s'y branche par un **traducteur** (côté jeu) et le **tampon** (fourni ici), sur un contrat en trois objets (`schemas/`). Pour brancher le vôtre : **[docs/](docs/LISEZ-MOI.md)**.

```
moteur/orvane.js      le moteur : instantané + pressions → instantané suivant (Node ou navigateur, zéro dépendance)
moteur/catalogue.js   l'univers des traits : organe, coût, effet, écarts sur le plan corporel, contraintes, conduite (ce qu'il fait faire)
moteur/corps.js       la silhouette d'une lignée (forme, proportions, organes, couleurs) et sa dérive à chaque séparation
moteur/genese.js      la genèse : des biomes, cinq ancêtres, des milliers de cycles → un monde de lignées inventées, nommées
tampon/tampon.js      exposer() Orvane → jeu ; agreger() jeu → Orvane (dénormalisation, plafonds, lissage)
monde/index.html      l’observatoire : ce que vit un monde (espèces, biomes, lignées, chaîne alimentaire, journal), et une simulation locale
index.html            l’entrée du site publié : ouvre l’observatoire sur le monde sv-1 ; mondes/liste.json : les mondes qu’il propose
schemas/              le contrat : instantane, pression, profil — avec exemples (crapaud buffle)
traducteurs/stone-valley/   le premier client, de bout en bout : correspondances, traducteur, génération 0, banc, SQL
hebergement/cycle.js  le cycle nocturne : lots → tampon → moteur → instantané publié (action GitHub .github/workflows/cycle.yml)
mondes/sv-1/          le monde de Stone Valley, tel qu'il est publié (un monde par jeu)
mondes/genese-7/      un monde né de la genèse (graine 7, 3 000 cycles) : 97 lignées que personne n'a dessinées
docs/                 le mode d'emploi : brancher son jeu, écrire son traducteur, jouer les conduites, tirer les traits continus, l'hérédité (9 chapitres)
```

## Essayer

Dans le navigateur : https://stonevalleyoff-ai.github.io/orvane/ (ou `python3 -m http.server` à la racine, puis http://localhost:8000/). L’observatoire ouvre le monde publié sv-1 ; le menu en haut change de monde (ceux de `mondes/liste.json`, l’exemple fictif, ou un fichier). La vue d’ensemble dit ce qui s’est passé au dernier cycle ; Espèces est un registre qu’on fouille (recherche, filtres) et dont chaque fiche montre populations, phénotypes (réels et **montrés au jeu**, d’après le profil du monde), hérédité, traits continus et traits portés ; Simuler fait tourner le moteur ici, sans toucher au monde publié, et peut rejouer un lot de pressions pour N joueurs. L’adresse garde le monde, la vue et l’espèce : `monde/?monde=genese-7&vue=especes&espece=…` se partage.

En ligne de commande :

```
node moteur/orvane.js schemas/exemples/instantane.json --cycles 30
node moteur/orvane.js schemas/exemples/instantane.json --cycles 40 \
     --lot schemas/exemples/pression.json --profil schemas/exemples/profil.json --comptes 10
```

Le premier fait vivre le monde seul ; le second rejoue chaque jour le même lot de pressions pour dix comptes (chacun tue 14 crapauds de base et 1 cracheur, capture un géant, nourrit, déplace, abîme l'habitat). `--sortie fichier.json` écrit l'instantané final.

## Ce que v0 fait

- Par taxon × biome : croissance logistique sur la capacité du biome, que les espèces se partagent d'autant plus qu'elles ont la même taille (une bête de 5 kg et une de 60 kg ne broutent pas la même chose) ; le taux de croissance suit la masse (loi de Fenchel) ; mortalité tirée de la longévité ; pénalité hors de la **niche**.
- La **chaîne alimentaire** : un prédateur mange ce qui est à sa portée (masse, vitesse, vol, groupe, heure), se reporte sur la proie abondante (la proie rare est relâchée), partage les proies avec ses concurrents ; sa **satiété** décide de sa faim et de ses départs, et ses petits sont faits de la viande mangée (conversion 25 % : l'énergie vient des plantes, un prédateur ne vit pas de prédateurs). Chez la proie, la **vulnérabilité** de chaque phénotype (carapace, camouflage, pattes longues…) décide qui est mangé : c'est la sélection naturelle, sans joueur.
- Les **catastrophes** : un incendie (couvert dense et sec, l'été), une crue (sols humides et bas, au printemps), une sécheresse ; la capacité du biome tombe et se refait lentement, et une part des bêtes qui ne peuvent fuir (ni vol, ni terrier, ni nage) meurt sur le coup.
- Les **phénotypes** : chaque combinaison de traits a son plan corporel (écarts) et son coût de reproduction. Un trait ne vaut que son coût et ses écarts ; ce sont les pressions extérieures qui lui donnent une valeur. Le moteur n'a aucune idée reçue sur « ce qui est fort ».
- Les **saisons**, si le profil donne une année : les biomes sont froids, sombres et pauvres en hiver, chauds, lumineux et riches en été ; la convenance et la place en suivent le rythme. Les **maladies** : une population entassée peut voir éclore une épidémie, qui frappe selon la résistance de chaque phénotype, gagne parfois les voisins, et s'éteint d'elle-même.
- Mutation entre phénotypes, apparition de nouveaux traits admissibles, migration vers les voisins en cas de saturation ou de faim, déplacements imposés, séparation de lignées (rare : hors de sa niche, installée depuis longtemps), habitat qui s'use et se regagne, extinction (un taxon éteint reste listé 10 cycles). La demande de chasse qu'un phénotype épuisé ne peut servir se reporte sur les autres.
- La **silhouette** (`plan.corps`, `moteur/corps.js`) : forme (quadrupède, hexapode, bipède, oiseau, serpent), pattes, proportions, organes (cornes, crête, ailes, carapace, antennes), motif et couleurs. Elle dérive à chaque séparation, vers ce que le biome favorise (le froid raccourcit oreilles et queue, le couvert allonge la queue, la robe glisse vers la teinte du sol), garde la marque d'un mode de déplacement gagné (le vol donne des ailes, le fouissage un museau), gagne ou perd parfois un organe, et très rarement change de plan. Elle ne pèse pas sur la survie : c'est ce qui permet à un jeu de dessiner une lignée qu'il n'a jamais vue.
- Les **conduites** : chaque trait qui fait agir porte, au catalogue, une conduite dans un vocabulaire abstrait (riposte-distance, immobilite, alerte-groupe, defense-petits…) avec son présage — ce qu'un joueur attentif voit avant. Chaque jeu les joue à sa façon (docs/7-conduites.md).
- La **génétique continue** : par population, une moyenne et une variance de la taille, de la vitesse, de l'audace et de la sociabilité. La prédation, la maladie, les joueurs (le z moyen des bêtes qu'ils prennent), la fécondité et l'optimum du biome (plus grand au froid, plus vif à découvert) les déplacent selon l'équation de Lande ; la mutation et la dérive les entretiennent ; les migrants les mêlent ; une lignée qui se sépare garde ce qu'elle a acquis. Le jour un, rien ne change ; chaque jeu tire une valeur par bête (docs/8-genetique-continue.md).
- La **reproduction sexuée** : par population, la fréquence de l'allèle de chaque trait ; chaque petit en reçoit un de sa mère et un de son père. Un trait dominant se voit dès une copie, un récessif (albinisme, robe dorée, nanisme) se cache chez des porteurs et revient. Les pères sont choisis selon leur attrait (une robe voyante, une grande taille), et l'ordre du catalogue dit qui masque qui. Côté jeu, un petit ressemble à sa mère sans que les taux d'ensemble bougent (docs/9-reproduction.md).
- **Déterministe** : même instantané, même graine, mêmes pressions ⇒ même résultat, au bit près.

## Ce que le tampon fait des pressions

1. ramène l'activité d'un compte trop actif à une activité normale (`exposition_ref`) ;
2. **dénormalise** : les prélèvements par phénotype sont redistribués selon les fréquences réelles, à taux par tête constant (montré à 2 %, réel à 20 % ⇒ pertes ×10) ;
3. plafonne par compte, par part d'un compte, par part de population ;
4. lisse sur `memoire_cycles` (moyenne mobile exponentielle).

Dans l'autre sens, `exposer()` traduit les fréquences réelles en fréquences montrées par le jeu : par **compression** de la cote, ou en mode **relatif** (le jeu garde ses propres taux et ne suit que l'écart du monde depuis sa génération 0 — le jour un, rien ne change).

Résultat observé sur l'exemple, 10 comptes, 40 cycles : si les joueurs tuent 1 cracheur pour 14 crapauds de base alors que le jeu n'en montre que 2 %, les cracheurs sont sur-chassés et disparaissent, les cuirassés (jamais tués) prennent la place. S'ils n'en tuent aucun, les cracheurs passent de 20 % à plus de 30 % pendant que la population s’effondre sous 140 prélèvements par nuit. La chasse ne donne aucun bonus automatique : le résultat dépend des variants présents et de ce que les joueurs leur font.

Un monde publié part d'un **rodage** (`profil.monde.rodage`, 400 cycles pour Stone Valley) : il tourne seul jusqu'à son équilibre, et c'est cet équilibre qui devient la génération 0.

## La genèse

```
node moteur/genese.js mondes/sv-1 --cycles 3000 --graine 7 --nom "Monde né d'Orvane" --sortie amorce.json
```

Des biomes (ceux d'un monde existant, ou un fichier), cinq ancêtres très simples (un brouteur, un fouisseur, un rôdeur, un filtreur, un chasseur des eaux), chacun avec sa silhouette, et une évolution accélérée : les lignées se séparent et dérivent (masse, régime, locomotion, heure, traits, silhouette — deux fois et demie plus vite que dans un monde qui tourne), la place se gagne par extinction, au plus cent lignées vivantes. À la fin, chaque lignée reçoit un nom inventé (« Angraume chasseur de prairie, 76 kg, nocturne »). Le résultat est une amorce de monde : `mondes/genese-7/` en est un, à ouvrir dans l'observatoire (`monde/?monde=genese-7`, onglets Lignées et Chaîne). C'est le mode « Orvane crée la vie » : un jeu qui sait assembler un corps par morceaux peut le dessiner — Stone Valley le fait (`lignees.js`, voir `traducteurs/stone-valley/`). L'observatoire montre la silhouette de chaque lignée à côté de celle de son parent (onglet Taxons).

## Pas encore

Le retour d'un taxon éteint depuis un biome voisin après extinction totale ; un monde partagé entre plusieurs jeux ; une version anglaise du mode d'emploi.
