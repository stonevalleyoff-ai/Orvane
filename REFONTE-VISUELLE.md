# Orvane — Atlas du vivant

## Contenu de la livraison

Le projet complet de l’archive fournie est conservé. Les trois pages web partagent maintenant la même direction artistique : vert forêt, papier ivoire, accents ocre, titres éditoriaux et illustrations naturalistes.

- Accueil : présentation illustrée du projet et parcours d’intégration, comme dans la livraison précédente.
- Inscription : espace développeur et formulaires de la livraison précédente.
- Observatoire : les six vues sont habillées — vue d’ensemble, espèces, lignées, chaîne alimentaire, journal et simulation.

Le moteur, le tampon, les schémas, les instantanés, les historiques, les profils, le traducteur Stone Valley, le SQL et le cycle GitHub sont identiques à ceux de l’archive d’origine. Aucun appel d’écriture à Supabase n’a été ajouté.

## Mettre à jour un dépôt existant

Pour appliquer uniquement l’habillage, copier ces éléments depuis le dossier `orvane-main/` du ZIP vers la racine du dépôt :

1. `index.html`
2. `inscription/index.html`
3. `monde/index.html`
4. le dossier `assets/` complet
5. cette notice, si souhaité

Fusionner les dossiers existants. Conserver les versions courantes des dossiers `mondes/`, `moteur/`, `tampon/`, `schemas/`, `hebergement/`, `traducteurs/` et `.github/` du dépôt. Les données contenues dans le ZIP sont celles de l’archive source reçue ; il n’est pas nécessaire de les recopier pour changer l’apparence du site.

Aucune compilation, installation de dépendance, clé supplémentaire ou modification de Supabase n’est nécessaire. Pour vérifier le projet en local, le servir par HTTP à sa racine, par exemple avec `python3 -m http.server 8000`, puis ouvrir `/monde/?monde=orvane`.

## L’Observatoire

- Grande vue d’ensemble illustrée, avec chiffres et événements issus de l’instantané chargé.
- Sélecteur de monde et navigation persistante entre les six vues.
- Registre avec recherche, filtres, tri et défilement de la liste sur ordinateur.
- Fiche naturaliste : plan corporel sur fond quadrillé, faits biologiques, populations, phénotypes, hérédité et traits.
- Les silhouettes restent calculées à partir des caractéristiques des lignées : aucune image générée ne remplace les créatures de la simulation.
- Graphiques sur fond clair avec palette adaptée. L’arbre des lignées et le réseau alimentaire défilent dans leur propre zone sur petit écran.
- Index textuel des lignées pour ouvrir une fiche sans cliquer sur le graphique.
- Journal et laboratoire de simulation structurés. Le mode simulé et le retour à l’instantané de départ restent identifiables.
- Illustrations d’univers clairement distinguées des données observées.

Les illustrations réutilisées proviennent de la première refonte. Les prompts et fichiers sont décrits dans `assets/ILLUSTRATIONS.md`.

## Vérifications effectuées

- Inspection visuelle sur ordinateur et dans des vues mobiles de 320, 390 et 480 pixels.
- Contrôle des six vues sur le plus petit écran : aucun débordement horizontal du document.
- Recherche d’espèces, filtre de déclin, tri, ouverture d’une fiche et retour au registre.
- Arbre des lignées, réseau alimentaire et sélection d’un biome.
- Affichage du journal et de ses filtres.
- Chargement du monde Orvane et du monde archivé de genèse.
- Simulation d’un cycle dans le navigateur, puis retour à l’instantané publié.
- Test direct du moteur et du tampon sur dix cycles, avec dix comptes et les pressions de l’exemple : cycles 42 à 52, pressions appliquées, effectifs finis et non négatifs.
- Vérification de la syntaxe JavaScript, des identifiants HTML et des ressources locales.
- Comparaison des fichiers : seules les trois pages web d’origine changent ; des ressources graphiques et cette notice sont ajoutées.
- Comparaison des fonctions de chargement du monde, d’installation de l’état, de simulation et de dessin des silhouettes : conservées à l’identique.
