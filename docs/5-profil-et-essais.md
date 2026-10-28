# 5. Le profil et les essais

## Amorcer le monde

Un monde par jeu. Avant le premier cycle, il lui faut une **amorce** : un instantané de génération 0. Deux façons :

- **depuis votre bestiaire** : un script qui lit vos espèces et en fait des taxons (`traducteurs/stone-valley/generer-generation-0.js` est l'exemple : masse depuis la taille, régime, longévité et maturité depuis vos valeurs, niche depuis vos biomes, populations proportionnelles à votre densité). Les variantes rares de votre jeu étaient des *taux par naissance* : posez-les comme des fréquences installées réalistes (0,4 % par robe, 0,1 % par forme) et laissez le profil les rendre rares à l'écran ;
- **à la main** : un bestiaire d'auteur, écrit directement dans le format de l'instantané ;
- **par la genèse** : `node moteur/genese.js <biomes.json> --cycles 3000` crée la vie à partir de cinq ancêtres — des lignées que personne n'a dessinées, nommées par le moteur. C'est la voie d'un jeu qui assemble ses créatures par morceaux (chapitre 2).

Dans les deux cas, le bestiaire d'un jeu n'est pas un équilibre écologique : trop de prédateurs, des herbivores de même taille qui se gênent. Donnez au profil un **rodage** (`monde.rodage`, 400 cycles est un bon départ) : au premier cycle, le monde tourne seul autant de fois, et c'est l'équilibre atteint qui est publié comme génération 0 — le jeu ne voit rien changer le premier jour. Vérifiez avant que ce rodage ne tue personne (`node moteur/orvane.js amorce.json --cycles 400`) : une espèce qui s'éteint seule a une niche, une masse ou une longévité mal posée, ou un prédateur sans proie à sa taille.

## Le profil (`profil.json`)

```json
{ "orvane": "0.1", "jeu": "stone-valley",
  "monde": { "id": "sv-1", "graine": 7340021, "cycle": "24h", "amorce": "traducteurs/stone-valley/generation-0.json", "rodage": 400, "annee": 120 },
  "exposition": {
    "compression": { "defaut": 0.1, "par_domaine": { "morphologie": 0.1 }, "par_trait": { "gigantisme": 0.1 } },
    "propagation_cycles": 3, "inertie_max": 0.05,
    "traits_rendus": ["albinisme", "melanisme", "robe-doree", "gigantisme", "nanisme"],
    "seuil_extinction_jeu": 40, "retour_apres_extinction": true },
  "influence": {
    "poids": { "prelevement": 1, "capture": 1, "liberation": -1, "nourrissage": -0.2, "deplacement": 1, "habitat_perdu": 1, "habitat_gagne": -1 },
    "denormaliser": true, "exposition_ref": 60, "pseudo_comptes": 20,
    "plafonds": { "par_compte_cycle": 30, "part_max_compte": 0.15, "part_max_population": 0.2 },
    "memoire_cycles": 5 } }
```

**Le monde.** `cycle` : la durée réelle d'un cycle (24h) ; `annee` : la durée de l'année en cycles (120 : quatre saisons de trente jours) — 0 pour un monde sans saison ; `rodage` : voir ci-dessus ; `historique` : combien de cycles garder dans `historique.json` (365 par défaut) ; `nocturne: false` : le cycle nocturne passe ce monde.

**Exposition (Orvane → jeu).**
- `mode` : `compression` (par défaut) ou `relatif`. En mode relatif, `taux_jeu` donne, par trait rendu, la chance qu'avait une naissance de le porter avant Orvane ; le jeu garde ces taux à la génération 0 et ne suit que l'écart du monde depuis elle, sur la cote (`cote jeu = cote taux_jeu × cote aujourd'hui / cote génération 0`). Une combinaison absente de la génération 0 garde le taux du jeu jusqu'à ce qu'Orvane l'installe au-delà de `reference_min`. C'est le mode qui garantit qu'un jeu existant ne change pas le jour où il se branche — Stone Valley l'utilise.
- `quantitatifs` : `rendus`, les traits continus que le jeu sait jouer ; `variation` (0 à 1), la part de la variation individuelle montrée — 0 : seul l'écart de la population depuis la génération 0 se voit, le jour un ne change rien ; 1 : toute la variation naturelle (chapitre 8).
- `non_rendus` (mode relatif) : `reel` (par défaut) — les traits non rendus gardent leur fréquence réelle, tirés à part de l'allure : le jeu peut les faire agir (chapitre 7) et rapporter le phénotype exact ; `base` — ils se fondent dans le plan de base.
- `compression` : le facteur appliqué à la *cote* d'un phénotype (f/(1−f)). 0,1 : 20 % → 2,4 %, 50 % → 9 %, 99 % → 91 %. Une variante rare reste rare, une variante qui a gagné l'emporte aussi à l'écran. Affinez par domaine, par trait, par biome.
- `propagation_cycles` : un changement est étalé sur autant de cycles ; `inertie_max` borne la variation par cycle. Les bêtes déjà nées gardent leur phénotype.
- `traits_rendus` : la liste de ce que votre jeu sait montrer (chapitre 2).
- `seuil_extinction_jeu` et `seuil_extinction_part` : le jeu cesse de faire apparaître le taxon quand son effectif tombe sous le premier **et** sous cette part (un quart) de ce qu'il était à la génération 0 — avant l'extinction réelle, pour que la rareté se voie, sans rayer une espèce rare dès le départ.

**Influence (jeu → Orvane).**
- `poids` : un prélèvement vaut 1 individu retiré ; les autres actions sont relatives ; négatif = favorable.
- `exposition_ref` : rencontres par compte et par cycle considérées comme une activité normale ; au-delà, la pression du compte est ramenée à ce niveau.
- `pseudo_comptes` : le lissage de la dénormalisation (20 par défaut).
- `plafonds` : `par_compte_cycle` (individus équivalents par taxon et par compte), `part_max_compte` (un seul compte ne pèse pas plus que cette part du total), `part_max_population` (un cycle ne retire pas plus que cette part d'une population : pas d'extinction en une nuit).
- `memoire_cycles` : le lissage dans le temps.

Réglage conseillé pour démarrer : les valeurs ci-dessus. Puis regardez, dans l'observatoire, ce que dix comptes qui chassent chaque soir font à une espèce en 40 cycles : si elle s'éteint, montez `part_max_population` vers 0,1 ou `memoire_cycles` vers 10 ; si rien ne bouge jamais, baissez `pseudo_comptes` ou montez `par_compte_cycle`.

## Essayer hors ligne

```
node moteur/orvane.js amorce.json --cycles 40 --lot lot.json --profil profil.json --comptes 10
```

rejoue le même lot chaque nuit pour dix comptes et imprime effectifs et fréquences. L'**observatoire** (`monde/index.html`, onglet Pressions) fait la même chose avec des courbes, et l'onglet Taxons montre côte à côte la fréquence réelle et la fréquence **exposée** : c'est exactement ce que votre traducteur recevra.

Pour le traducteur lui-même, écrivez un **banc** : un contexte Node où les globales de votre jeu sont des doublures, qui charge `tampon.js`, vos correspondances et votre traducteur, puis vérifie : les effectifs/poids appliqués, le tirage des variantes sur 100 000 naissances (≈ fréquences exposées), la reconnaissance du phénotype d'une bête tuée, la validité du lot contre le schéma, et le retour du lot dans `agreger()` + `cycle()`. `traducteurs/stone-valley/banc.js` est le modèle.

## Vérifier en ligne

Le premier cycle publié doit être **identique à l'amorce** côté jeu (rien ne change à l'écran) : c'est le test que le branchement ne casse rien. Les changements viennent ensuite, avec les lots des joueurs, et l'observatoire (`monde/?monde=<id>`) les montre nuit après nuit.
