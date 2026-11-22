# Ombre du Dojo — Shinobi

Combat **vue de côté** façon shinobi : plateformes, katana + coup de pied, décors japonais, boutique (tenues / armes / améliorations).

## Télécharger (Android)

APK release signé avec icône bureau :

- Fichier : [`../dist/ombre-du-dojo.apk`](../dist/ombre-du-dojo.apk)
- Page : [`telecharger.html`](telecharger.html)
- Package : `com.jeuxemile.ombredudojo`

Après installation : tiroir d’apps → **Ombre** → ajouter au bureau si besoin.

À **chaque ouverture**, l’APK recharge la version live (`https://ombre-du-dojo.apps.grok.bot`).

Le projet Android Capacitor est hors du dossier web (non publié) : `../ombre-du-dojo-android/`.

Reconstruire l’APK release (SDK Android requis) :

```bash
cp ../ombre-du-dojo-android/keystore.properties.example ../ombre-du-dojo-android/keystore.properties
# remplir storePassword / keyPassword localement (jamais committer)
# placer le .jks dans ../ombre-du-dojo-android/keystore/ (gitignoré)
npm install
npm run apk
```

La clé de signature v1.3 a été renouvelée : désinstaller l’ancienne APK avant d’installer.

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
