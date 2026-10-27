# 5. Le profil et les essais

## Amorcer le monde

Un monde par jeu. Avant le premier cycle, il lui faut une **amorce** : un instantané de génération 0. Deux façons :

- **depuis votre bestiaire** : un script qui lit vos espèces et en fait des taxons (`traducteurs/stone-valley/generer-generation-0.js` est l'exemple : masse depuis la taille, régime, longévité et maturité depuis vos valeurs, niche depuis vos biomes, populations proportionnelles à votre densité). Les variantes rares de votre jeu étaient des *taux par naissance* : posez-les comme des fréquences installées réalistes (0,4 % par robe, 0,1 % par forme) et laissez le profil les rendre rares à l'écran ;
- **à la main** : un bestiaire d'auteur, écrit directement dans le format de l'instantané.

Dans les deux cas, faites tourner le monde seul 60 cycles (`node moteur/orvane.js amorce.json --cycles 60`) et vérifiez qu'il est **stable** : pas d'extinction, pas d'explosion, des saturations entre 60 et 90 %. Si une espèce s'effondre seule, c'est sa niche ou sa longévité qui est mal posée, pas le moteur.

## Le profil (`profil.json`)

```json
{ "orvane": "0.1", "jeu": "stone-valley",
  "monde": { "id": "sv-1", "graine": 7340021, "cycle": "24h", "amorce": "traducteurs/stone-valley/generation-0.json" },
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

**Exposition (Orvane → jeu).**
- `compression` : le facteur appliqué à la *cote* d'un phénotype (f/(1−f)). 0,1 : 20 % → 2,4 %, 50 % → 9 %, 99 % → 91 %. Une variante rare reste rare, une variante qui a gagné l'emporte aussi à l'écran. Affinez par domaine, par trait, par biome.
- `propagation_cycles` : un changement est étalé sur autant de cycles ; `inertie_max` borne la variation par cycle. Les bêtes déjà nées gardent leur phénotype.
- `traits_rendus` : la liste de ce que votre jeu sait montrer (chapitre 2).
- `seuil_extinction_jeu` : en dessous de cet effectif, le jeu cesse de faire apparaître le taxon — avant l'extinction réelle, pour que la rareté se voie.

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
