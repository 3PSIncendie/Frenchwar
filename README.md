# FRENCH WAR — MVP tactile

Prototype jouable portrait (HTML Canvas) : maintien de l’ordre vs Black Bloc, civils protégés.

## Lancer

```bash
cd /agent/french-war && python3 -m http.server 8765 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8765/`

## Hors-ligne

- Sur l’écran titre : **TÉLÉCHARGER HORS-LIGNE** → fichier unique `french-war.html` (ouvrir dans le navigateur, sans réseau).
- Ou ouvrir directement `french-war-offline.html`.
- Après une visite en ligne, le service worker garde aussi le site jouable hors connexion.
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
