# FRENCH WAR — MVP tactile

Prototype jouable portrait (HTML Canvas) : maintien de l’ordre vs Black Bloc, civils protégés.

## Lancer

```bash
cd /agent/french-war && python3 -m http.server 8765 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8765/`

## Android / hors-ligne

- Sur téléphone : ouvrir le jeu dans **Chrome** → bouton **INSTALLER SUR ANDROID** (ou menu ⋮ → *Installer l’application* / *Ajouter à l’écran d’accueil*).
- L’icône FRENCH WAR lance le jeu en plein écran, y compris hors connexion (service worker).
- Sur desktop : **TÉLÉCHARGER HORS-LIGNE** → fichier unique `french-war.html` (peu fiable sur Android).
- Régénérer le pack : `python3 scripts/build-offline.py`

## Contrôles

| Input | Action |
|-------|--------|
| Stick gauche / ZQSD / WASD | Déplacement |
| Bouclier (maintenir) / Espace | Parade |
| Flash / F | Stun cône (auto-cancel si civil) |
| Arrestation / R | Menottes sur hostile isolé |

## Victoire / Défaite

- **Victoire** : meneur + 4 lanceurs arrêtés, sans faute civile critique, Ordre > 0.
- **Défaite** : faute civile critique, Ordre à 0, ou timer écoulé.

## Fichiers

- `/agent/french-war/index.html`
- `/agent/french-war/css/style.css`
- `/agent/french-war/js/game.js`
