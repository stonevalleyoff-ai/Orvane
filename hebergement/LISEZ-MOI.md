# L'hébergement : un monde par jeu, sans serveur

Un monde Orvane vit dans `mondes/<id>/` de ce dépôt. Chaque nuit, l'action GitHub `cycle` le fait avancer d'un cycle et commite le résultat ; GitHub Pages le sert, avec CORS ouvert, à tous les traducteurs.

```
mondes/sv-1/
  profil.json         le profil du jeu (copie de traducteurs/stone-valley/profil.json)
  generation-0.json   l'amorce, publiée telle quelle au premier cycle : les traducteurs s'y comparent
  etat.json           l'instantané courant, complet : le moteur repart de là
  instantane.json     le même, compact : ce que les traducteurs lisent
  historique.json     les 365 derniers cycles, allégés : ce que l'observatoire trace (monde/?monde=sv-1)
  tampon.json         la mémoire du tampon (lissage) et l'heure de la dernière lecture des lots
  lots/               des lots déposés à la main (lus puis rangés dans lots/traites/)
```

## Le chemin d'une pression

1. Le joueur chasse, lie, croise des bêtes : le traducteur accumule un lot en `localStorage`.
2. À la sauvegarde, `orvaneEnvoyer()` appelle `vp_orvane_pression(lot)` : une ligne dans la table `orvane_pressions` (insertion seule, 48 dépôts par compte et par jour au plus, 64 Ko par lot).
3. À 03:17 UTC, `hebergement/cycle.js` lit les lignes nouvelles avec la clé de service, les passe au tampon (activité, dénormalisation, plafonds, lissage), fait tourner le moteur, écrit `instantane.json` et `historique.json`, commite.
4. Au prochain lancement du jeu, le traducteur lit `instantane.json` et étale le changement sur `propagation_cycles`.

## Mettre en place

- **Supabase** : exécuter `traducteurs/stone-valley/supabase.sql`.
- **Secrets du dépôt** (Settings › Secrets › Actions) : `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (la clé *service_role* — jamais la clé publique ; elle ne quitte pas l'action).
- **Pages** : Settings › Pages, branche `main`, dossier `/`. Le monde est alors à `https://<compte>.github.io/orvane/mondes/sv-1/instantane.json`.
- **Le jeu** : avant les scripts du traducteur, `<script>ORVANE_CHEMIN = 'https://<compte>.github.io/orvane/mondes/sv-1/';</script>`.

## À la main

```
node hebergement/cycle.js sv-1 --sans-reseau            # un cycle, lots du dossier seulement
node hebergement/cycle.js sv-1 --cycles 7               # rattraper une semaine (lots en ligne + dossier)
```

Le premier cycle part de l'amorce du profil (`monde.amorce`). Pour repartir de zéro : supprimer `etat.json`, `instantane.json`, `historique.json`, `tampon.json`.

Pour un deuxième jeu : un dossier `mondes/<autre>/` avec son `profil.json` et son amorce — l'action le prend tout seul.
