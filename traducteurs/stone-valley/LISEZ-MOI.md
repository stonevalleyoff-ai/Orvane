# Le traducteur Stone Valley

L'exemple de bout en bout : comment un jeu existant se branche sur Orvane sans qu'Orvane sache rien de lui.

```
correspondance.js          ce que le traducteur sait du jeu : biomes ↔ axes, taxon ↔ espèce, trait ↔ variante
orvane-sv.js               le traducteur : 5 fonctions que le jeu appelle si elles existent
profil.json                le réglage du tampon pour ce jeu (monde sv-1)
generer-generation-0.js    amorce un monde Orvane depuis le bestiaire du jeu (lit index.html)
generation-0.json          le résultat : 30 taxons, 16 biomes, ~110 000 individus
banc.js                    le banc d'essai : le traducteur dans un bac à sable qui imite le jeu
supabase.sql               la table et la fonction qui reçoivent les lots de pressions
```

## Ce que fait le traducteur

**Orvane → jeu.** À l'arrivée sur une île, `orvaneAppliquer()` compare, pour chaque espèce, l'effectif Orvane sur les biomes de l'île à celui de la génération 0, et règle `POIDS_ESPECE` (la chance d'être tirée au bestiaire) et `sp.cap` (combien en vivent sur l'île) dans la même proportion. Un taxon éteint, ou sous `seuil_extinction_jeu`, n'apparaît plus. À chaque naissance, `orvaneVariante(sp, r)` tire le phénotype selon les fréquences **exposées** (compressées par le profil, interpolées entre les deux derniers instantanés) et le rend en variante du jeu. Une espèce inconnue d'Orvane (automates, boss) est tirée comme avant.

**Jeu → Orvane.** `orvaneEvenement('prelevement', b, cause)` dans `mourirBete()` (seules les causes du joueur comptent ; la faim et les prédateurs, non), `orvaneEvenement('capture', b)` dans `lier()`, et les rencontres relevées toutes les dix secondes (une bête sauvage à moins de douze pas, comptée une fois). Le tout s'accumule en un lot (`orvaneLot()`), gardé en `localStorage`, poussé par `orvaneEnvoyer(rpc, Compte.uid)` après une sauvegarde réussie.

**Ce qui n'est pas rendu.** Le jeu ne sait montrer que cinq traits (trois robes, géant, nain) : ce sont les `traits_rendus` du profil. Les autres (glande irritante, pattes longues, carapace…) évoluent dans Orvane sans sortir — jusqu'à ce que le jeu sache les dessiner, les faire cracher ou les faire courir. Une nouvelle lignée (« brouteur.bois ») est rendue par l'espèce de son parent.

## Brancher dans index.html

Déposer à côté du jeu : `orvane/tampon.js`, `orvane/correspondance.js`, `orvane/orvane-sv.js`. Les trois fichiers du monde (`instantane.json` publié chaque nuit, `generation-0.json`, `profil.json`) sont lus depuis le dépôt Orvane (voir `hebergement/`). Puis, dans `index.html` :

1. Les scripts, avec les autres (`donjon.js`…), précédés du chemin du monde :
   ```html
   <script>ORVANE_CHEMIN = 'https://<compte>.github.io/orvane/mondes/sv-1/';</script>
   <script src="orvane/tampon.js"></script><script src="orvane/correspondance.js"></script><script src="orvane/orvane-sv.js"></script>
   ```
2. À l'arrivée sur l'île, juste avant `especesIle = tirerBestiaire();` :
   ```js
   if (typeof orvaneAppliquer === 'function') orvaneAppliquer();
   ```
3. En tête de `function tirerVariante(sp, r = Math.random) {` :
   ```js
   if (typeof orvaneVariante === 'function') { const v = orvaneVariante(sp, r); if (v !== undefined) return v; }
   ```
4. Dans `mourirBete(b, cause)`, après `b.dead = 0.001; …` :
   ```js
   if (typeof orvaneEvenement === 'function') orvaneEvenement('prelevement', b, cause);
   ```
5. Dans `lier(b, voie)`, après `apprivoiser(b, c);` :
   ```js
   if (typeof orvaneEvenement === 'function') orvaneEvenement('capture', b);
   ```
6. Dans `envoyer()`, dans le bloc `if (r && r.ok) {` de la sauvegarde :
   ```js
   if (typeof orvaneEnvoyer === 'function') orvaneEnvoyer(rpc, Compte.uid);
   ```
7. Côté Supabase : exécuter `supabase.sql` (table `orvane_pressions`, fonction `vp_orvane_pression`).

Sans `orvane/instantane.json` servi, rien ne change : le jeu reste ce qu'il était.

## Vérifier

```
node generer-generation-0.js ../../../sv/index.html     # régénère generation-0.json depuis le jeu
node banc.js ../../../sv/index.html                      # le banc : TOUT PASSE attendu
```

Le banc fait vivre le monde vingt cycles sous la chasse de dix comptes, puis charge le traducteur dans un contexte où `SPEC`, `POIDS_ESPECE`, `SEED`, `beasts`, `localStorage` et `fetch` sont des doublures, et vérifie poids, caps, tirage des variantes (200 000 naissances), reconnaissance des variantes tuées, validité du lot contre le schéma, et retour du lot dans le moteur.

## Ce que l'exemple apprend

- Les chances de variantes du jeu (1/1140 par naissance) étaient des **taux de mutation**, pas des fréquences : Orvane porte des fréquences installées (0,4 % par robe), et c'est le profil qui rend ces robes aussi rares qu'avant à l'écran.
- Une seule bête rare tuée ne vaut pas une persécution : `pseudo_comptes` lisse la dénormalisation.
- Le crapaud pond quarante petits par portée : chassé par dix comptes, il prospère quand même. Le brouteur, non. Le jeu n'a rien eu à décider.
