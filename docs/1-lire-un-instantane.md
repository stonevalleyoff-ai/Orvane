# 1. Lire un instantané

Un instantané, c'est l'état du vivant d'un monde à un cycle. Il est publié en JSON, validé par `schemas/instantane.schema.json`. Voici un extrait réel du monde de Stone Valley (cycle 12), lu de haut en bas.

## L'en-tête

```json
{ "orvane": "0.1",
  "monde": { "id": "sv-1", "graine": 7340021, "nom": "Monde de Stone Valley" },
  "cycle": { "n": 12, "date": "2026-10-27T20:16:41Z", "pressions_recues": 0 },
```

`cycle.n` monte de 1 à chaque nuit ; `cycle.date` dit quand il a été calculé — c'est la référence pour étaler un changement dans le temps (chapitre 5). `pressions_recues` : combien d'événements de joueurs ont pesé sur ce cycle.

## Les biomes

```json
  "biomes": [
    { "id": "prairie", "nom": "Prairie", "milieu": "terrestre",
      "axes": { "temperature": 0.55, "humidite": 0.5, "altitude": 0.2, "lumiere": 0.9, "couvert": 0.3 },
      "capacite": 2751289, "capacite_base": 2751289,
      "voisins": ["rivage", "bois", "lande", "tourbiere", "cerisaie"] },
```

Un biome n'est pas un nom, c'est **cinq curseurs de 0 à 1** : froid→chaud, sec→humide, bas→haut, sombre→lumineux, nu→dense ; plus un `milieu` (terrestre, aquatique, amphibie, aérien, souterrain). C'est ce qui rend Orvane universel : votre jeu fait correspondre ses propres sols à ces curseurs (chapitre 2). `capacite` est la place disponible (en biomasse) ; quand les joueurs abîment l'habitat elle baisse, et elle regagne lentement `capacite_base`. `voisins` : par où les populations migrent.

## Le catalogue

```json
  "catalogue": { "version": "0.1", "traits": {
    "albinisme": { "domaine": "morphologie", "organe": "mélanocytes inactifs", "cout": 0.04,
                   "effet": "robe blanche, yeux clairs ; voit moins bien en plein jour", "ecarts": { "perception": 0.9 } },
```

Seuls les traits **réellement portés** ce cycle sont listés ; l'univers complet est dans `moteur/catalogue.js`. Chaque trait dit : son `domaine` (morphologie, locomotion, sens, offense, defense, metabolisme, reproduction, social, activite), l'`organe` qui le porte, son `cout` (ce phénotype fait autant de petits en moins : 0.04 = −4 %), son `effet` en langage biologique, parfois un `comportement` induit, des `ecarts` (multiplicateurs sur le plan corporel), ce qu'il `fournit` (des matières), et ses contraintes `exige`/`exclut`.

## Un taxon

```json
  "taxons": [
    { "id": "brouteur", "nom": "Brouteur", "parent": null, "apparu": 0, "eteint": null, "statut": "stable",
      "plan": { "masse_kg": 15.35, "taille_m": 0.68, "locomotion": ["marche", "course", "grimpe"], "regime": "herbivore",
                "longevite": 30, "maturite": 6, "portee": 3, "sociabilite": 0.7, "temperament": 0, "activite": "diurne",
                "vitesse_rel": 4.6, "perception": 0.37,
                "niche": { "temperature": 0.52, "humidite": 0.47, "altitude": 0.3, "lumiere": 0.7, "couvert": 0.5 }, "tolerance": 0.6 },
      "populations": [
        { "biome": "prairie", "effectif": 11903, "tendance": 0.001, "depuis": 0, "pression": 0 },
        { "biome": "lande",   "effectif": 4588,  "tendance": 0.003, "depuis": 0 },
        { "biome": "bois",    "effectif": 9064,  "tendance": -0.004, "depuis": 0 } ],
      "phenotypes": [
        { "id": "base",      "frequence": 0.9848, "traits": [], "cout_total": 0 },
        { "id": "albinisme", "frequence": 0.0043, "traits": ["albinisme"], "cout_total": 0.04,
          "frequence_par_biome": { "prairie": 0.0045, "lande": 0.0041, "bois": 0.0041 }, "ecarts": { "perception": 0.9 }, "selection": 0.0001 },
```

- **`id`** est stable dans le temps : c'est la clé de votre table de correspondance. **`parent`** dit de quel taxon celui-ci s'est séparé (une lignée nouvelle s'appelle `parent.biome`, ex. `brouteur.bois`). **`statut`** : croissance, stable, declin, menace, eteint. Un taxon éteint reste listé dix cycles avec `eteint: <cycle>`.
- **`plan`** : le corps de base, commun à tous les phénotypes. Les durées (`longevite`, `maturite`) sont en cycles. `vitesse_rel` est en longueurs de corps par seconde. `sociabilite` 0 = solitaire, 1 = grégaire ; `temperament` 0 = fuit toujours, 1 = riposte toujours. `niche` + `tolerance` : les axes du biome idéal et la largeur de ce qu'il supporte.
- **`populations`** : l'effectif par biome, la variation du cycle (`tendance`), depuis quand la population est installée là, et la part de sa mortalité due aux joueurs (`pression`).
- **`phenotypes`** : les combinaisons de traits présentes, avec leur fréquence (somme 1 ; le premier est le plan de base). Un phénotype est toujours **complet et cohérent** : si un jet glandulaire est là, la glande y est, et le coût inclut les deux. `ecarts` résume ce que les traits changent au plan ; `selection` dit si la fréquence monte ou descend.

## Les événements

```json
  "evenements": [ { "type": "separation", "taxon": "trottin_menu.bois", "biome": "bois", "detail": "lignée issue de trottin_menu, plus petite" } ] }
```

Types : apparition, extinction, separation, migration, effondrement, explosion, nouveau_trait. Utiles pour un journal en jeu (« une nouvelle lignée de trottins vit dans les bois ») ou pour l'observatoire.

## Ce qu'il faut en retenir pour un traducteur

Trois choses à lire, dans cet ordre : les **effectifs par biome** (combien en faire apparaître, et où), les **phénotypes et leurs fréquences** (quelles variantes, à quelle rareté — après passage par le tampon), et le **plan ∘ écarts** de chaque phénotype (les stats). Tout le reste est du contexte.
