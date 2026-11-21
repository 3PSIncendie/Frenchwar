# Ombre du Dojo — Shinobi

Combat **vue de côté** façon shinobi : plateformes, katana + coup de pied, décors japonais, boutique (tenues / armes / améliorations).

## Lancer

```bash
python3 -m http.server 8766 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8766/`

## Jouer

**Jouer** → ennemis arrivent de la droite → plateformes pour sauter → boutique entre les niveaux. Boss tous les 5 niveaux. Le décor change à chaque kill.

## Contrôles

- Toucher : ◀▶ · ↑ saut · ⚔ katana · 🦵 pied
- Clavier : Q D · Espace · J · K · Esc pause

Progression : `localStorage` clé `ombre-du-dojo-v1`.
