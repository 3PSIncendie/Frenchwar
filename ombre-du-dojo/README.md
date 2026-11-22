# Ombre du Dojo — Shinobi

Combat **vue de côté** façon shinobi : plateformes, katana + coup de pied, décors japonais, boutique (tenues / armes / améliorations).

## Télécharger (Android)

APK prêt avec icône bureau :

- Fichier : [`download/ombre-du-dojo.apk`](download/ombre-du-dojo.apk)
- Page : [`telecharger.html`](telecharger.html)
- Package : `com.jeuxemile.ombredudojo`

Après installation, lance **Ombre du Dojo** depuis l’icône ninja sur l’écran d’accueil.

Reconstruire l’APK (SDK Android requis) :

```bash
npm install
npm run apk
```

## Lancer (web)

```bash
python3 -m http.server 8766 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8766/`

## Jouer

**Jouer** → ennemis arrivent de la droite → plateformes pour sauter → boutique entre les niveaux. Boss tous les 5 niveaux. Le décor change à chaque kill. La menace ennemie monte à chaque stage.

## Contrôles

- Toucher : ◀▶ · ↑ saut · katana · jambe · shuriken · bouclier
- Clavier : Q D · Espace / ↑ · J · K · U · Shift · Esc pause

Progression : `localStorage` clé `ombre-du-dojo-v1`.
