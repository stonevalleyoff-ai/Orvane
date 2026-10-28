# 3. Traduire un phénotype en données jouables

C'est le cœur du traducteur, et la partie qu'Orvane vous laisse entièrement. Un phénotype vous donne un **plan corporel effectif** (le plan du taxon × les `ecarts` de ses traits), une liste de **traits** (organe, coût, effet, comportement, matières) et une **fréquence**. Tout ce qui suit est un barème *conseillé* : il donne des créatures cohérentes entre elles, mais chaque jeu a sa propre échelle — gardez les rapports, changez les constantes.

Commencez par calculer le plan effectif (le moteur l'exporte : `Orvane.planDe(taxon.plan, phenotype.traits, catalogue)`), puis déroulez les six domaines.

## Physique — points de vie, taille, résistance

- **Points de vie** : la robustesse suit la masse, mais moins que proportionnellement (métabolisme) : `PV = PV_ref × (masse_kg / masse_ref) ^ 0.75`. Avec `masse_ref` = la masse de votre créature « moyenne » et `PV_ref` ses PV, un géant ×1.8 a ×1.55 PV, un nain ×0.45 a ×0.55.
- **Boîte de collision / échelle du sprite** : `taille_m / taille_ref`. Les traits de morphologie passent par `ecarts.taille_m`, rien d'autre à faire.
- **Résistance** : un trait du domaine `defense` réduit les dégâts reçus, et le catalogue vous donne déjà la mesure : `vulnerabilite` (peau épaisse 0.8, carapace 0.55). Barème : dégâts reçus × vulnerabilite — c'est exactement ce que le moteur fait subir à ce phénotype sous les crocs des prédateurs, autant que le jeu dise la même chose. `camouflage` joue sur la détection (voir comportement).

## Mouvement — vitesse, milieux, horaires

- **Vitesse** : `vitesse_rel × taille_m` donne des m/s biologiques (brouteur : 4,6 × 0,68 = 3,1 m/s). Rapportez à votre unité : `v_jeu = v_ref × (vitesse_rel × taille_m) / (vitesse_rel_ref × taille_ref)`.
- **Milieux** : `locomotion` dit ce que la bête *peut* faire — `nage` → entre dans l'eau, `vol` → ignore le relief, `saut` → franchit un obstacle, `grimpe` → parois, `fouissage` → s'enterre. Une bête sans `nage` s'arrête au rivage.
- **Horaires** : `activite` → quand elle est dehors (diurne, nocturne, crepusculaire, continue). Un trait `yeux-nocturnes` impose nocturne et augmente la perception : la nuit lui appartient.

## Comportement — IA

- **Fuite ou riposte** : `temperament` est le curseur. 0 → fuit à vue ; 1 → attaque à vue. Entre les deux, un seuil : riposte si `blessure > 1 − temperament`, ou si acculée. Le brouteur (0) ne se bat jamais ; un cracheur (×1.6) riposte tôt.
- **Qui mange qui** : l'onglet Chaîne de l'observatoire dessine, biome par biome, les flèches prédateur → proie et leur poids ; c'est la carte de vos comportements de chasse et de fuite à écrire.
- **Faim** : la `satiete` d'une population de prédateurs (dans l'instantané) dit si les proies manquent. Sous 0,4, rendez-les agressifs, errants, prêts à s'en prendre au joueur ou à ses compagnons ; au-dessus de 0,8, paisibles. C'est gratuit et c'est vivant : une île où les joueurs ont vidé les proies devient dangereuse.
- **Groupe** : `sociabilite` → taille de groupe `1 + round(sociabilite × 6)` et alerte collective au-delà de 0,5. `gregarisme` pousse encore.
- **Détection** : rayon = `perception × portée_max` ; `camouflage` divise par deux la distance à laquelle *on la voit*.
- **Régime** : `herbivore` broute (et fuit), `carnivore` cible les autres bêtes selon la masse (une proie de moins de la moitié de sa masse), `omnivore` les deux, `detritivore`/`filtreur` ne chasse pas.
- **Conduite des traits** : le champ `comportement` est écrit pour être lu par un développeur — « embuscade ; riposte à distance avant la fuite », « défend les jeunes ». Chaque phrase est un état d'IA à ajouter si vous rendez le trait.

## Attaque

- Une attaque **par organe offensif** (domaine `offense`) ; sans trait offensif, le plan de base n'a qu'une charge/morsure proportionnelle à la masse.
- **Dégâts** : `deg = deg_ref × (masse_kg / masse_ref) ^ 0.5 × chasse` — la masse pèse, et `chasse` (crocs allongés 1.25, dard 1.1) dit ce que l'organe ajoute, avec la même mesure que le moteur.
- **Portée** : lisez l'`effet` : « à 3 longueurs de corps » → `3 × taille_m`. Les effets du catalogue sont écrits avec ces unités exprès.
- **Cadence** : un organe coûteux se recharge lentement : `recharge_s = 2 + 20 × cout` (jet : 3,4 s ; dard : 3,8 s).
- **Effets secondaires** : une `glande-irritante` sans jet, c'est un contact qui irrite (dégâts dans le temps) ; `coloration-aposematique` annonce la toxicité (les prédateurs IA l'évitent).

## Objets — ce que laisse le corps

- `fournit` liste les matières : `cuir`, `croc`, `plaque-osseuse`, `secretion-irritante`… Une table `matière → objet de votre jeu`.
- Quantité ∝ taille : `round(qte_ref × taille_m / taille_ref)` ; la viande suit la masse.
- **Rareté d'un objet = rareté de son phénotype** : un objet qui ne tombe que des cuirassés est exactement aussi rare que les cuirassés exposés. Ne fixez pas la rareté à la main, lisez-la : elle bougera avec le monde.

## Apprivoisement

- **Facilité** : `(1 − temperament) × 0.5 + sociabilite × 0.3 + (regime === 'herbivore' ? 0.2 : 0)`, entre 0 et 1 ; `soins-parentaux` et `gregarisme` ajoutent +0,1. Un carnivore solitaire qui riposte (0,15) se lie difficilement ; un brouteur grégaire (0,91) vient presque seul.
- **Croissance d'un compagnon** : `maturite` cycles pour devenir adulte, `longevite` pour mourir de vieillesse — si votre jeu a des compagnons qui grandissent.
- **Élevage** : `portee` et `maturite` donnent le rythme de reproduction en captivité ; les petits héritent du phénotype des parents (tirez-le dans l'instantané, avec une chance de mutation vers un phénotype voisin si vous voulez de l'élevage sélectif — et dites-le à Orvane : action `reproduction`).
- **Rôle** : les `travail` de votre jeu (récolte, défense, repos) peuvent se déduire du plan : masse et `crocs-allonges` → défense ; `locomotion` grimpe/nage → récolte en hauteur / en eau ; sociabilité → repos.

## Le nom et le rang

Une lignée nouvelle n'a qu'un `nom` généré (« Brouteur (Bois) »). Donnez-lui un nom dans votre langue de jeu, et affichez d'où elle vient (`parent`, `apparu`) : c'est ce que vos joueurs qui explorent loin viennent chercher.
