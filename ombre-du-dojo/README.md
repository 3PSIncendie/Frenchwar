# Ombre du Dojo — Arène

Combat ninja **vue du dessus** (style Brawl Stars) : joystick + attaque/spécial, vagues, boutique, boss.

## Lancer

```bash
python3 -m http.server 8766 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8766/`

## Jouer

**Jouer** / **Continuer** → élimine les ennemis dans l’arène → **Boutique** → **Vague suivante**. Boss tous les 5 niveaux. L’arène japonaise change à chaque kill.

## Contrôles

- Toucher : joystick gauche · ⚔ attaque · ◎ spécial
- Clavier : ZQSD / flèches · J / Espace attaque · L / E spécial · Esc pause

Progression : `localStorage` clé `ombre-du-dojo-v1`.
