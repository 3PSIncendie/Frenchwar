#!/usr/bin/env python3
"""Regénère french-war-offline.html (CSS+JS inline, zéro dépendance réseau)."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
css = (root / "css/style.css").read_text(encoding="utf-8")
js = (root / "js/game.js").read_text(encoding="utf-8")
html = (root / "index.html").read_text(encoding="utf-8")

body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
body = re.sub(r'\s*<script src="js/game\.js"></script>\s*', "\n", body)
# Retirer le bloc téléchargement / install PWA du fichier offline (déjà le fichier)
body = re.sub(
    r'\s*<a[^>]*id="btn-download"[^>]*>.*?</a>\s*',
    "\n",
    body,
    flags=re.S,
)

offline = f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="theme-color" content="#121820" />
  <title>FRENCH WAR — Cordon (hors-ligne)</title>
  <style>
{css}
  </style>
</head>
<body>{body}
  <script>
{js}
  </script>
</body>
</html>
"""

out = root / "french-war-offline.html"
out.write_text(offline, encoding="utf-8")
print(f"wrote {out} ({out.stat().st_size} bytes)")
