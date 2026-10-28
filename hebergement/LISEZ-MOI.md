# L'hébergement : un monde par jeu, sans serveur

Un monde Orvane vit dans `mondes/<id>/` de ce dépôt. Chaque nuit, l'action GitHub `cycle` le fait avancer d'un cycle et commite le résultat ; GitHub Pages le sert, avec CORS ouvert, à tous les traducteurs.

```
mondes/sv-1/
  profil.json         le profil du jeu (copie de traducteurs/stone-valley/profil.json)
  generation-0.json   l'amorce, publiée telle quelle au premier cycle : les traducteurs s'y comparent
  etat.json           l'instantané courant, complet : le moteur repart de là
  instantane.json     le même, compact, avec le cycle d'avant allégé (precedent) : ce que les traducteurs lisent
  historique.json     les derniers cycles allégés (365, ou profil.monde.historique) : ce que l'observatoire trace (monde/?monde=sv-1)
  tampon.json         la mémoire du tampon (lissage) et l'heure de la dernière lecture des lots
  lots/               des lots déposés à la main (lus puis rangés dans lots/traites/)
```

## Le chemin d'une pression

1. Le joueur chasse, lie, croise des bêtes : le traducteur accumule un lot en `localStorage`.
2. À une sauvegarde, au plus une fois par demi-heure, `orvaneEnvoyer()` appelle `vp_orvane_pression(lot)` : une ligne dans la table `orvane_pressions` (48 dépôts par compte et par jour au plus, 64 Ko par lot ; la table n'est accessible que par cette fonction).
3. À 03:17 UTC, `hebergement/cycle.js` lit les lignes nouvelles par la fonction `orvane_lire_lots`, avec le secret de lecture d'Orvane (le compte arrive pseudonymisé), les passe au tampon (activité, dénormalisation, plafonds, lissage), fait tourner le moteur, écrit `instantane.json` et `historique.json`, commite.
4. Au prochain lancement du jeu, le traducteur lit `instantane.json` et étale le changement sur `propagation_cycles`.

## Mettre en place

- **Supabase** : exécuter `traducteurs/stone-valley/supabase.sql`, puis poser l'empreinte du secret de lecture (la dernière ligne du fichier, en commentaire). Le profil du monde dit où lire : `monde.pressions` (l'adresse du projet, sa clé **publique**, la fonction).
- **Secret du dépôt** (Settings › Secrets and variables › Actions) : `ORVANE_LECTURE_SECRET`, le secret de lecture. Orvane n'a **pas** la clé de service du jeu : son secret n'ouvre que la lecture des lots. (L'ancien chemin, `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`, marche encore pour un monde sans `monde.pressions`.)
- **L'action** : `.github/workflows/cycle.yml`. Un dossier qui commence par un point ne passe pas par « Add files › Upload files » : créer le fichier par « Add file › Create new file », en tapant le chemin `.github/workflows/cycle.yml`. Un monde en panne n'empêche pas les autres d'être publiés ; l'action le signale.
- **Pages** : Settings › Pages, branche `main`, dossier `/`. Le monde est alors à `https://<compte>.github.io/orvane/mondes/sv-1/instantane.json`.
- **Le jeu** : avant les scripts du traducteur, `<script>ORVANE_CHEMIN = 'https://<compte>.github.io/orvane/mondes/sv-1/';</script>`.

## À la main

```
node hebergement/cycle.js sv-1 --sans-reseau            # un cycle, lots du dossier seulement
node hebergement/cycle.js sv-1 --cycles 7               # rattraper une semaine (lots en ligne + dossier)
```

Le premier cycle part de l'amorce du profil (`monde.amorce`), et pose la naissance du monde (`monde.ne`). Pour repartir de zéro : supprimer `etat.json`, `generation-0.json`, `instantane.json`, `historique.json`, `tampon.json` — les traducteurs verront un monde neuf (autre naissance) et repartiront de sa génération 0.

Pour un deuxième jeu : un dossier `mondes/<autre>/` avec son `profil.json` et son amorce — l'action le prend tout seul. `mondes/genese-7/` en est un : né de la genèse, sans jeu branché, il vit pour être observé (30 cycles d'historique : ses cent lignées pèsent lourd).
