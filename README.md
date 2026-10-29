# Orvane

**Un moteur d'écosystème et d'évolution, et un monde vivant que tous les jeux partagent.**

Orvane fait vivre un seul monde, le monde d'Orvane : 24 biomes, de la banquise aux abysses, et plus d'une centaine de lignées inventées par l'évolution, pas par un dessinateur. Elles naissent, se nourrissent, se chassent, migrent, mutent et se séparent en espèces nouvelles. Le monde avance d'un cycle chaque nuit.

N'importe quel jeu peut s'y brancher. Il lit le monde et en fait ses créatures, chacune à sa façon. Puis il renvoie ce que font ses joueurs (les bêtes croisées, chassées, apprivoisées), et le monde en tient compte la nuit suivante. Une espèce trop chassée se raréfie, devient méfiante, rapetisse si l'on prend toujours les plus grandes, et cela dans tous les jeux à la fois.

- **Voir le monde vivre** : [l'observatoire](https://stonevalleyoff-ai.github.io/orvane/monde/?monde=orvane)
- **Brancher un jeu** : [le guide pas à pas](BRANCHER-UN-JEU.md) et [la page d'inscription](https://stonevalleyoff-ai.github.io/orvane/inscription/)
- **Écrire son traducteur** : [le mode d'emploi en 13 chapitres](docs/LISEZ-MOI.md)
- **Le fonctionnement, fichier par fichier** : [LISEZ-MOI.md](LISEZ-MOI.md) et [l'hébergement](hebergement/LISEZ-MOI.md)

## Comment ça marche

```
            chaque nuit, 03:17 UTC
   lots des joueurs ──► tampon ──► moteur ──► instantané publié (GitHub Pages)
          ▲                                          │
          │                                          ▼
   le Supabase d'Orvane ◄── orvane_deposer ── chaque jeu (son traducteur)
```

- **Le moteur** (`moteur/`) fait évoluer des populations : effectifs par biome, chaîne alimentaire, génétique continue, reproduction, hybrides, organes, méfiance. Il est déterministe, sans dépendance, et tourne sous Node ou dans le navigateur.
- **Le tampon** (`tampon/`) se place entre le monde et chaque jeu. Il adoucit ce que le jeu montre et plafonne ce que les joueurs pèsent : un seul jeu ne fait jamais plus de la moitié de la pression sur une espèce.
- **Le contrat** (`schemas/`) tient en trois objets JSON : l'instantané, le lot de pressions, le profil.
- **Le premier client** est Stone Valley. Son traducteur complet est dans `traducteurs/stone-valley/`.

## Licence

Orvane est distribué sous la licence [PolyForm Shield 1.0.0](https://polyformproject.org/licenses/shield/1.0.0) (voir [LICENSE](LICENSE)). N'importe qui peut brancher son jeu, même commercial ou au code fermé, et copier dans son jeu le tampon, les schémas ou un traducteur. Seule limite : ne pas se servir du code d'Orvane pour fournir un produit qui lui fait concurrence, comme un autre moteur d'écosystème, un autre monde partagé ou une copie renommée. Copyright StoneValley.

## In English

Orvane is an ecosystem and evolution engine running **one shared living world**: 24 biomes and over a hundred lineages invented by evolution. The world advances one cycle every night. Any game can plug in:
1. register on the [sign-up page](https://stonevalleyoff-ai.github.io/orvane/inscription/) to get a game key;
2. read the world from `https://stonevalleyoff-ai.github.io/orvane/mondes/orvane/instantane.json` and turn its lineages into creatures;
3. report what players do (encounters, kills, captures) through the `orvane_deposer` RPC.

Over-hunted species become rarer, warier or smaller, in every connected game. The step-by-step guide, with endpoints and examples, is [BRANCHER-UN-JEU.md](BRANCHER-UN-JEU.md); it ends with an English summary. The documentation is in French. Licence: [PolyForm Shield 1.0.0](https://polyformproject.org/licenses/shield/1.0.0). Use it freely in any game, commercial or not; just don't use its code to build a competing product.
