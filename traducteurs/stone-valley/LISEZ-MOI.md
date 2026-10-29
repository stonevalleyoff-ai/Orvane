# Le traducteur Stone Valley

L'exemple de bout en bout : comment un jeu existant se branche sur Orvane sans qu'Orvane sache rien de lui.

```
correspondance.js          ce que le traducteur sait du jeu : biomes ↔ axes (et ↔ biomes du monde d'Orvane), taxon ↔ espèce,
                           trait ↔ variante, silhouette de chaque espèce (corpsDe), gabarits pour une lignée sans ancêtre,
                           ce que le jeu sait montrer (EXPOSITION)
orvane-sv.js               le traducteur : les fonctions que le jeu appelle si elles existent
profil.json                le réglage du tampon du monde sv-1 (archivé), mode relatif
generer-generation-0.js    amorce un monde Orvane depuis le bestiaire du jeu (lit index.html)
generation-0.json          l'amorce : 30 taxons, 16 biomes, ~100 000 individus (le monde publié en part après rodage)
banc.js                    le banc d'essai : le traducteur dans un bac à sable qui imite le jeu
supabase.sql               la table et la fonction qui recevaient les lots de pressions de sv-1, dans le Supabase du jeu
```

Le jeu charge aussi `moteur/corps.js` (copié en `orvane/corps.js`) et `tampon/tampon.js`. Le corps construit d'une lignée est dessiné par le jeu lui-même (`lignees.js` dans Stone Valley) : c'est du rendu, pas de la traduction.

## Ce que fait le traducteur

**Orvane → jeu.** À l'arrivée sur une île, `orvaneAppliquer()` compare, pour chaque espèce, l'effectif Orvane sur les biomes de l'île à celui de la génération 0, et règle `POIDS_ESPECE` (la chance d'être tirée au bestiaire) et `sp.cap` (combien en vivent sur l'île) dans la même proportion. Tout repart des valeurs d'origine à chaque île. Une espèce s'efface d'une île quand son effectif sur ses sols tombe sous `seuil_extinction_jeu` **et** sous `seuil_extinction_part` (un quart) de ce qu'il était à la génération 0 : une espèce rare dès le départ (le varan, le cerf, la salamandre) n'est pas rayée pour autant. Pas d'interpolation ici : avec le même instantané, la même île donne la même faune à tout le monde.

À chaque naissance, `orvaneVariante(sp, r)` tire le phénotype en **mode relatif** (profil) : le jeu garde ses taux d'avant Orvane (`taux_jeu` : 1/1140 par robe, 1/18000 par forme) et ne suit que l'**écart** du monde depuis la génération 0, sur la cote. Le jour un, les variantes naissent exactement comme avant ; une robe devenue deux fois plus fréquente dans Orvane l'est deux fois plus dans le jeu ; une robe éteinte dans Orvane ne naît plus. L'instantané publié porte le cycle d'avant (`precedent`) : le tirage glisse de l'un à l'autre sur `propagation_cycles`, de la même façon chez tous les joueurs. Une espèce inconnue d'Orvane (automates, boss) est tirée comme avant.

**Les lignées (§210 du jeu).** Un taxon d'Orvane qui n'est pas une espèce du jeu — une lignée séparée (« crapaud.sylve »), ou une lignée d'un monde né de la genèse — devient une fiche du jeu, inscrite dans `SPEC` par `orvaneEspeces()` :
- copiée de son plus proche ancêtre connu du jeu (sa conduite : brouter, chasser, se laisser lier, récolter) ; sans ancêtre, d'un **gabarit** selon son régime (`brouteur`, `glaneur`, `traqueur`) ;
- à sa mesure : nom (« Crapaud-buffle de sylve fongique »), taille d'après la masse, vitesse, couleurs de sa silhouette, sols où vivent ses populations (un Tellurien prend son sol rare) ; ses prédateurs sont ceux de son ancêtre, ses tables (viande, aptitudes, combat, voix) aussi ;
- son corps : **rendu par le parent** tant qu'il lui ressemble (le dessin de l'ancêtre, à ses couleurs et à sa taille), **construit** (`osOrvane`, `lignees.js`) dès qu'il s'en écarte — autre forme, autres pattes, des ailes gagnées, ou un écart de silhouette (`OrvaneCorps.distance`) d'au moins `SEUIL_CORPS` (0,3) — et toujours pour une lignée sans ancêtre.

Les fiches des lignées sont gardées en mémoire locale : une compagne liée garde la sienne même si la lignée s'éteint. Une espèce inconnue de forme `parent.biome` (la compagne d'un autre joueur, une sauvegarde venue d'un autre appareil) est résolue à la demande par `specById` : rendue par son parent.

**Les conduites (§211 du jeu, docs/7).** À la naissance, deux tirages : l'allure aux taux du jeu, les traits non rendus à leur fréquence réelle. `orvaneNaissance(b)` pose sur la bête l'identifiant exact de son phénotype (`b.phen`) et ses conduites (`b.conduites`), lues dans le catalogue du monde (`conduite.type` → `CONDUITE_JEU` de `correspondance.js`), plus celles des modes de déplacement d'une lignée (un fouisseur s'enterre). Le jeu les joue (`conduites.js`). Un prélèvement rapporte le phénotype exact.

**Les traits continus (§212 du jeu, docs/8).** À la naissance, `orvaneNaissance(b)` tire aussi la taille, l'allure et l'audace de la bête dans la loi de la population de l'île (`Tampon.quantDe`) et garde ses valeurs (`b.q`). Elle montre l'écart de sa population depuis la génération 0, plus `variation` (profil, 0 pour sv-1) de son écart propre : `b.tq` (× la taille), `b.vq` (× l'allure), `b.fq` (× la distance de fuite). Un prélèvement ou une capture rapporte la valeur moyenne des bêtes (`q`). `OrvaneSV.quantMots(b)` donne les mots du panneau (« de grande taille », « l'espèce a rapetissé ici »).

**L'hérédité (§213 du jeu, docs/9).** Une bête née d'une mère connue (`orvaneNaissance(b, mere)`) tire sa robe, sa forme (les mêmes cornes que sa mère), ses conduites et ses traits continus sachant ceux de la mère (`Tampon.sachantMere`, `Tampon.exprimer`, la dominance au catalogue). Sur toutes les mères, les taux ne bougent pas. Le phénotype de la bête est en `b.phen` (`b.ph` est, dans le jeu, la phase de sa foulée).

**Les hybrides (§214 du jeu, docs/10).** Sur une île où la population se croise avec une lignée apparentée (`hybride` dans l'instantané), une part des bêtes naît hybride (`zoneHybride`, `hybrider`) : `b.hybride` nomme la lignée du père, la bête tient de lui la moitié de ses traits non rendus, et le panneau le dit.

**Les organes (§215 du jeu, docs/11).** Une lignée née dans Orvane tire aussi des conduites de ses organes (`plan.corps.organes`, lus dans `catalogue.organes` de l'instantané) : des cornes, des défenses ou une massue la font charger, un aiguillon piquer, des plaques ou des épines encaisser, des pinces mordre. La force suit la taille de l'organe, et le nom du panneau vient de l'organe (« à massue »). `lignees.js` dessine chaque organe à sa place. Une espèce du jeu garde ses conduites à elle.

**La méfiance (§216 du jeu, docs/12).** À la naissance, `apprisFuite(b)` lit la méfiance et l'habituation de la population du biome où naît la bête, et multiplie son facteur de fuite (`b.fq`) par `fuite^méfiance × habitude^habituation` (profil, `exposition.mefiance` ; 2,2 et 0,5 par défaut). Le panneau le dit (« se méfie des chasseurs », « habituée aux passants »). Les rencontres, prélèvements et captures que le jeu envoie déjà suffisent à la nourrir.

**Le bestiaire d'Orvane (§217 du jeu).** Dans un monde né de la genèse (le monde d'Orvane), aucune des trente espèces de la faune du jeu (`Corr.FAUNE`) n'existe. Avec `exposition.bestiaire = 'orvane'` au profil, `orvaneAppliquer` les retire des îles et partage ce qu'elles y auraient eu, comptes et poids, régime par régime, entre les lignées du monde, à proportion de leurs effectifs sur l'île (`bestiaireOrvane`). L'île garde autant de bêtes qu'avant et la même part d'herbivores, d'omnivores et de carnivores. Chaque lignée se conduit comme son gabarit (un herbivore paisible comme le cotonnier, un Doux ; sinon brouteur, glaneur, traqueur) et a son corps construit. Une île où aucune lignée paisible ne peut se montrer garde les Doux du jeu (les premières îles n'ont que des Doux). Les automates, les boss et les villageois ne changent pas. Sans ce réglage, la faune du jeu reste telle quelle.

**Jeu → Orvane.** `orvaneEvenement('prelevement', b, cause)` dans `mourirBete()` : comptent les armes, les sorts, les tours et les **compagnes** du joueur ; pas la faim, pas la cause `proie` (une bête de l'île qui en tue une autre : Orvane simule déjà la prédation). `orvaneEvenement('capture', b)` dans `lier()`, et les rencontres relevées toutes les dix secondes (une bête sauvage à moins de douze pas, comptée une fois). Le biome noté est celui de la bête. Le tout s'accumule en un lot (`orvaneLot()`), gardé en `localStorage`, poussé par `orvaneEnvoyer(rpc, Compte.uid)` après une sauvegarde réussie — **une fois par demi-heure au plus** (le serveur en accepte 48 par jour) ; un refus garde le lot, une panne réessaie dans cinq minutes.

**Un monde refait de zéro.** L'identité d'un monde, c'est son id et sa naissance (`monde.ne`, posée par le premier cycle). Si le monde publié change de naissance, le traducteur repart de sa nouvelle génération 0, même si son numéro de cycle est plus petit.

**Ce qui n'est pas rendu.** Le jeu ne montre en variantes que cinq traits (trois robes, géant, nain) : ce sont les `traits_rendus` du profil. Les autres (glande, pattes longues, carapace…) se voient sur les corps construits quand la majorité de la lignée les porte ; sur les espèces du jeu, ils évoluent dans Orvane sans sortir.

## Brancher dans index.html

Déposer à côté du jeu : `lignees.js`, `conduites.js` et le dossier `orvane/` (`corps.js`, `tampon.js`, `correspondance.js`, `orvane-sv.js`). Les fichiers du monde (`instantane.json` publié chaque nuit, `generation-0.json`, `profil.json`, `jeux.json`) sont lus depuis le dépôt Orvane (voir `hebergement/`). Puis, dans `index.html` (tous gardés par `typeof … === 'function'`) :

1. Les scripts, avec les autres (`donjon.js`…) :
   ```html
   <script src="lignees.js"></script><script src="conduites.js"></script>
   <script>ORVANE_CHEMIN = 'https://<compte>.github.io/orvane/mondes/orvane/';
   ORVANE_DEPOT = { url: 'https://<projet>.supabase.co', cle: '<clé publique du projet>', jeu: '<clé du jeu>' };</script>
   <script src="orvane/corps.js"></script><script src="orvane/tampon.js"></script><script src="orvane/correspondance.js"></script><script src="orvane/orvane-sv.js"></script>
   ```
2. Une fois les fiches posées, après `for (const sp of SPEC) if (automate(sp)) sp.bio.push(15, 16);` : `if (typeof orvaneEspeces === 'function') orvaneEspeces();`
3. À l'arrivée sur l'île, juste avant `especesIle = tirerBestiaire();` : `if (typeof orvaneAppliquer === 'function') orvaneAppliquer();`
4. En tête de `tirerVariante(sp, r)` : `if (typeof orvaneVariante === 'function') { const v = orvaneVariante(sp, r); if (v !== undefined) return v; }`
5. Dans `osDeBase(f)`, avant les familles : `if (sp && sp.orvane && sp.orvane.genere && typeof osOrvane === 'function') return osOrvane(f);`
6. Dans `mourirBete(b, cause)`, après `b.dead = 0.001; …` : `if (typeof orvaneEvenement === 'function') orvaneEvenement('prelevement', b, cause);` — et la cause `proie` (au lieu de `chassé`) quand c'est une bête de l'île qui tue (`porterCoup`, le Silencieux, le Mille), `compagne` quand c'est une bête liée.
7. Dans `lier(b, voie)`, après `apprivoiser(b, c);` : `if (typeof orvaneEvenement === 'function') orvaneEvenement('capture', b);`
8. Dans `envoyer()`, dans le bloc `if (r && r.ok) {` de la sauvegarde : `if (typeof orvaneEnvoyer === 'function') orvaneEnvoyer(rpc, Compte.uid);`
9. Les conduites (§211, `conduites.js`) : `orvaneNaissance(b)` après chaque `tirerVariante` d'une naissance ; dans `majBete`, la vue (`conduitesVue`), la conduite qui s'impose avant le choix de l'état (`conduitesBete`), l'allure (`conduitesVit`) ; `conduitesDur` dans `robuste`, `conduitesBlesse` dans `blesseParJoueur`, `conduitesCoup` dans `porterCoup`, `conduitesOs` dans `foeBones`, `orvaneImpact` dans `eclaterSpore`, `orvaneStatuts` dans les statuts, `orvaneCibleDit` dans le panneau de la bête désignée, `orvaneCarnet` dans le carnet, `conduitesPhoto`/`conduitesRelire` dans la sauvegarde.
10. Les traits continus (§212) : `b.tq` dans `rayonCorps`, `hautCorps` et `echB` ; `b.fq` dans `rayonEveil` (`menaceEtProie`) et `rayonPeurJoueur` ; `b.vq` passe par `conduitesVit` ; les mots par `orvaneCibleDit` ; la taille propre part en coop (`faune.js`, `tq`).

Côté Supabase : rien dans celui du jeu. Le jeu est inscrit dans le Supabase d'Orvane (`hebergement/supabase.sql`) : sa clé va dans `ORVANE_DEPOT.jeu`, et `orvaneEnvoyer` dépose ses lots par `orvane_deposer` (400 événements à la fois au plus ; le reste part la fois suivante). Sans `ORVANE_DEPOT`, il passe encore par le `rpc` du jeu (`vp_orvane_pression`, la table `orvane_pressions` de `supabase.sql`), comme pour sv-1.

**Le monde d'Orvane.** Le jeu n'y a pas ses biomes : chaque sol du jeu en a un autre là-bas (`BIOMES_SV[k].u` : le rivage est la côte, le bois la forêt, la tourbière le marais, la sylve fongique la jungle, les terres creuses la grotte…). `Corr.choisirCarte` prend, à chaque instantané, la carte qui ressemble au monde (sv-1 garde la sienne). Ce que le jeu montre du monde vient de `jeux.json`, que le monde publie d'après le Supabase d'Orvane, et c'est la même exposition que le tampon utilise pour lire ses lots ; tant que `jeux.json` n'est pas arrivé, `Corr.EXPOSITION` (les deux doivent rester d'accord : la changer ici, c'est la régler là-bas avec `orvane_regler_jeu`). Quand le monde arrive après que l'île a été peuplée d'après un autre (l'abrégé gardé, l'ancien monde), `repeuplerIle` en retire les bêtes sauvages de la faune du jeu et y pose les lignées : sans cela, leurs naissances perpétuaient l'ancienne faune tant qu'on restait sur l'île.

Sans instantané servi, rien ne change : le jeu reste ce qu'il était. Le premier lancement d'un appareil applique le monde à partir de l'île suivante (l'instantané arrive pendant que la première se peuple).

## Vérifier

```
node generer-generation-0.js <stonevalley>/index.html     # régénère l'amorce depuis le jeu
node banc.js <stonevalley>/index.html                      # le banc : TOUT PASSE attendu
```

Le banc charge le traducteur dans un contexte où `SPEC`, `specById`, `POIDS_ESPECE`, `RARES`, `beasts`, `localStorage` et `fetch` sont des doublures, et vérifie : le jour un ne change rien (poids, comptes, taux de variantes) ; après vingt cycles de chasse par dix comptes, poids et caps suivent, les espèces rares ne sont pas rayées ; deux lignées (l'une rendue par son parent, l'autre construite) prennent nom, taille, sols, couleurs et prédateurs ; `specById` résout une lignée inconnue ; les causes comptent comme il faut ; le lot est valide, part une fois par demi-heure, survit à un refus ; il repasse dans le moteur ; un monde refait de zéro est repris ; les conduites sortent à leur fréquence réelle ; et la génétique continue : jour un inchangé, une chasse des plus grands fait rapetisser la population, le jeu le montre, le lot rapporte la taille exacte des bêtes prises ; et la reproduction sexuée : les albinos abattus reviennent par les porteurs cachés, la robe dorée tient contre son coût par le choix du partenaire, un petit tient de sa mère sans que les taux bougent ; l'isolement reproductif, la zone hybride et l'introgression, et les bêtes hybrides sur l'île ; et les organes : une silhouette d'avant se lit en organes, un organe neuf reste rare, l'instantané porte leur catalogue, le jeu en tire des conduites à la force de leur taille, et chaque organe se dessine sur chaque forme de corps ; et la méfiance : rien le jour un, cinq soirs de chasse la font monter et elle retombe de moitié en six cycles, des rencontres sans suite habituent, l'audace tempère, le tampon compte les contacts, et sur l'île la distance de fuite suit ; et le bestiaire d'Orvane : sur un monde de genèse, la faune du jeu s'efface et les lignées prennent sa place, autant de bêtes, régime par régime.

## Ce que l'exemple apprend

- Les chances de variantes du jeu (1/1140 par naissance) étaient des **taux de mutation**, pas des fréquences : Orvane porte des fréquences installées, qui dérivent pendant le rodage (avec l'ancien moteur clonal, le glaneur nain y passait à 49 %). La compression seule rendait le jour un méconnaissable (des glaneurs nains cent fois plus fréquents) : le mode relatif garde les taux du jeu et ne montre que l'écart.
- Un seuil d'extinction absolu rayait du jeu, dès la génération 0, les espèces naturellement rares : le seuil est maintenant aussi relatif.
- Une seule bête rare tuée ne vaut pas une persécution : `pseudo_comptes` lisse la dénormalisation.
- Avant d'être publié, le monde tourne 400 cycles à vide (le rodage) : les proportions du bestiaire du jeu ne sont pas un équilibre écologique, et c'est l'équilibre atteint qui devient la génération 0.
