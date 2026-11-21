# FRENCH WAR — MVP tactile

Prototype jouable portrait (HTML Canvas) : maintien de l’ordre vs Black Bloc, civils protégés.

Aussi dans ce dépôt : **[Ombre du Dojo](ombre-du-dojo/)** — jeu ninja vue de côté (mobile / PWA).

## Lancer

```bash
# FRENCH WAR (racine)
python3 -m http.server 8765 --bind 127.0.0.1

# Ombre du Dojo
cd ombre-du-dojo && python3 -m http.server 8766 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8765/` (FRENCH WAR) ou `http://127.0.0.1:8766/` (Ombre du Dojo)

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
