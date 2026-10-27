# Orvane — v0

Un moteur d'écosystème et d'évolution, indépendant de tout jeu. Il simule la vie dans des biomes abstraits ; un jeu s'y branche par un **traducteur** (côté jeu) et le **tampon** (fourni ici), sur un contrat en trois objets (`schemas/`). Pour brancher le vôtre : **[docs/](docs/LISEZ-MOI.md)**.

```
moteur/orvane.js      le moteur : instantané + pressions → instantané suivant (Node ou navigateur, zéro dépendance)
moteur/catalogue.js   l'univers des traits : organe, coût, effet, écarts sur le plan corporel, contraintes
tampon/tampon.js      exposer() Orvane → jeu ; agreger() jeu → Orvane (dénormalisation, plafonds, lissage)
monde/index.html      l’observatoire : fait tourner le moteur dans le navigateur et montre ce qu’un traducteur recevra
schemas/              le contrat : instantane, pression, profil — avec exemples (crapaud buffle)
traducteurs/stone-valley/   le premier client, de bout en bout : correspondances, traducteur, génération 0, banc, SQL
hebergement/cycle.js  le cycle nocturne : lots → tampon → moteur → instantané publié (action GitHub .github/workflows/cycle.yml)
mondes/sv-1/          le monde de Stone Valley, tel qu'il est publié (un monde par jeu)
docs/                 le mode d'emploi : brancher son jeu, écrire son traducteur (6 chapitres)
```

## Essayer

Dans le navigateur : `python3 -m http.server` à la racine, puis http://localhost:8000/monde/ — l’exemple se charge seul ; ▶ fait tourner des cycles ; l’onglet Pressions rejoue un lot pour N comptes ; l’onglet Taxons montre, pour chaque phénotype, la fréquence réelle et celle **exposée au jeu** dès qu’un profil est chargé.

En ligne de commande :

```
node moteur/orvane.js schemas/exemples/instantane.json --cycles 30
node moteur/orvane.js schemas/exemples/instantane.json --cycles 40 \
     --lot schemas/exemples/pression.json --profil schemas/exemples/profil.json --comptes 10
```

Le premier fait vivre le monde seul ; le second rejoue chaque jour le même lot de pressions pour dix comptes (chacun tue 14 crapauds de base et 1 cracheur, capture un géant, nourrit, déplace, abîme l'habitat). `--sortie fichier.json` écrit l'instantané final.

## Ce que v0 fait

- Par taxon × biome : croissance logistique sur une **capacité partagée** par toutes les espèces du biome (compétition), mortalité tirée de la longévité, pénalité hors de la **niche** (distance entre les axes du biome et ceux de la niche).
- Les **phénotypes** : chaque combinaison de traits a son plan corporel (écarts) et son coût de reproduction. Un trait ne vaut que son coût et ses écarts ; ce sont les pressions extérieures qui lui donnent une valeur. Le moteur n'a aucune idée reçue sur « ce qui est fort ».
- Mutation entre phénotypes, apparition de nouveaux traits admissibles, migration vers les voisins en cas de saturation, déplacements imposés, séparation de lignées, habitat qui s'use et se regagne, extinction (un taxon éteint reste listé 10 cycles).
- **Déterministe** : même instantané, même graine, mêmes pressions ⇒ même résultat, au bit près.

## Ce que le tampon fait des pressions

1. ramène l'activité d'un compte trop actif à une activité normale (`exposition_ref`) ;
2. **dénormalise** : les prélèvements par phénotype sont redistribués selon les fréquences réelles, à taux par tête constant (montré à 2 %, réel à 20 % ⇒ pertes ×10) ;
3. plafonne par compte, par part d'un compte, par part de population ;
4. lisse sur `memoire_cycles` (moyenne mobile exponentielle).

Résultat observé sur l'exemple, 10 comptes, 40 cycles : si les joueurs tuent 1 cracheur pour 14 crapauds de base alors que le jeu n'en montre que 2 %, les cracheurs sont sur-chassés et disparaissent, les cuirassés (jamais tués) prennent la place. S'ils n'en tuent aucun, les cracheurs passent de 20 % à 70 %. La chasse ne donne aucun bonus automatique : le résultat dépend des variants présents et de ce que les joueurs leur font.

## Pas encore (v1)

Proie-prédateur et chaînes trophiques ; saisons ; maladies ; report de la demande de chasse sur les autres phénotypes quand le phénotype visé manque.
