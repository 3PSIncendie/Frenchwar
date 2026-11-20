# Ombre du Dojo

Jeu ninja vue de côté (HTML / CSS / Canvas + PWA). UI en français.

Art: sprites peints réalistes (`assets/chars/`) et décors par zone (`assets/bg/` — dojo, forêt, toits, grotte, forteresse, arène boss).

## Lancer

```bash
python3 -m http.server 8766 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8766/`

## Jouer

Menu → **Jouer** (nouvelle partie) ou **Continuer** (boutique avec progression). Combats en vue de côté ; boutique entre les niveaux ; boss tous les 5 niveaux.

## Contrôles

- Toucher : ◀ ▶ · ↑ saut · ⚔ attaque · ◎ spécial
- Clavier : ←→ / Q D · Espace/Z · A/J · E/L · Esc pause

Progression : `localStorage` clé `ombre-du-dojo-v1`.
