# 4. Renvoyer des pressions

Le jeu renvoie des **comptes bruts**, jamais des conclusions. Le tampon fait le jugement (chapitre 5). Un lot est validé par `schemas/pression.schema.json` :

```json
{ "orvane": "0.1", "monde": "sv-1", "instantane": 12,
  "source": { "jeu": "stone-valley", "compte": "h:2k9f1a", "zone": "ile:884120" },
  "periode": { "debut": "2026-10-27T18:02:11Z", "fin": "2026-10-27T19:40:03Z" },
  "evenements": [
    { "taxon": "crapaud", "biome": "tourbiere", "action": "rencontre", "n": 31 },
    { "taxon": "crapaud", "phenotype": "base", "biome": "tourbiere", "action": "prelevement", "n": 14, "age": "adulte" },
    { "taxon": "crapaud", "phenotype": "gigantisme", "biome": "tourbiere", "action": "capture", "n": 1 } ] }
```

## Quoi compter

| action | quand | pourquoi ça compte |
| --- | --- | --- |
| `rencontre` | une bête sauvage entre dans le champ du joueur (une fois par bête) | mesure l'**exposition** : 14 tués sur 31 croisés n'est pas 14 tués sur 300 |
| `prelevement` | une bête meurt **du fait du joueur** (arme, piège, tour, monture) | retire des individus ; par phénotype, c'est la sélection |
| `capture` | apprivoisée, retirée du sauvage | comme un prélèvement, mais elle peut revenir |
| `liberation` | rendue au sauvage | l'inverse |
| `nourrissage` | nourrie, soignée | aide la population (poids négatif) |
| `reproduction` | des petits nés en captivité puis relâchés, ou un élevage sélectif | aide, et oriente les phénotypes |
| `deplacement` (+ `vers`) | emportée sur un autre biome | fonde ou renforce une population ailleurs |
| `habitat_perdu` / `habitat_gagne` | surface détruite / créée (en unités de votre jeu : cases, arbres…) | la capacité du biome bouge |

**Ne comptez pas** : les morts naturelles (faim, vieillesse), les proies d'autres bêtes, les bêtes d'un autre joueur (c'est son lot), les compagnons.

## Comment ne pas compter deux fois

- Une rencontre par **individu**, pas par image : gardez un `WeakSet` des bêtes déjà vues ; un relevé toutes les dix secondes suffit.
- Comptez la mort **à l'événement** (la fonction qui tue), pas en observant `pv <= 0` à chaque image.
- En multijoueur partagé, c'est celui qui porte le coup qui compte le prélèvement — pas chaque client qui voit la bête tomber.
- Le `phenotype` est celui de la bête telle qu'elle est née (retrouvez-le depuis sa variante, chapitre 2). Si vous ne le savez pas, omettez le champ : le tampon répartira selon les fréquences réelles.
- Le `biome` est celui d'Orvane, déjà traduit — là où la bête était, ou à défaut là où est le joueur.

## Quand envoyer

Accumulez en mémoire **et** en `localStorage` (le lot survit à la fermeture), puis envoyez à un moment naturel : la sauvegarde, la déconnexion, le changement de zone. Un lot par période ; `instantane` = le cycle que le jeu utilisait pendant cette période (le tampon s'en sert pour dénormaliser avec les bonnes fréquences). `compte` est un identifiant **opaque** (un hachage) : il ne sert qu'aux plafonds par compte.

Côté serveur, une table en insertion seule et une fonction qui borne la taille et le nombre de dépôts suffisent (`traducteurs/stone-valley/supabase.sql`). Le jeu ne relit jamais cette table : c'est le cycle nocturne qui la lit.

## Ce qui se passe ensuite (pour comprendre les chiffres)

Le tampon, pour chaque compte : ramène une activité excessive à `exposition_ref` rencontres ; **dénormalise** les prélèvements par phénotype — une variante montrée à 2 % mais réelle à 20 % voit ses pertes ×10, lissées par `pseudo_comptes` prélèvements fictifs pour qu'une seule bête rare tuée ne vaille pas une persécution ; plafonne par compte, par part d'un seul compte, par part de population ; puis lisse sur `memoire_cycles`. Un joueur qui vide son île un soir pèse peu ; dix joueurs qui le font chaque soir finissent par éteindre une population.
