#!/usr/bin/env python3
"""Range une image d'acte ou de lieu dans le dépôt à une taille raisonnable.

Usage : python3 -I outils/image.py <source> <destination.jpg> [--largeur 1600] [--qualite 80] [--recadrer x0,y0,x1,y1]

- Convertit en JPEG, réduit à --largeur px de large au plus (1600 par défaut : assez pour relire un acte),
  qualité 80, sans métadonnées. Le dépôt grossit vite (images : ~250 Mo) : toute nouvelle image passe par ici.
- --recadrer garde seulement l'acte utile (coordonnées en pixels de l'image source).
- Affiche le poids avant et après.
"""
import os
import sys
from PIL import Image

def main(argv):
    if len(argv) < 2 or argv[0] in ("-h", "--help"):
        print(__doc__); return 1
    src, dst = argv[0], argv[1]
    opt = lambda n, d: argv[argv.index(n) + 1] if n in argv else d
    largeur, qualite = int(opt("--largeur", 1600)), int(opt("--qualite", 80))
    im = Image.open(src)
    if "--recadrer" in argv:
        x0, y0, x1, y1 = map(int, opt("--recadrer", "").split(","))
        im = im.crop((x0, y0, x1, y1))
    im = im.convert("L" if im.mode in ("L", "LA", "1") else "RGB")
    if im.width > largeur:
        im = im.resize((largeur, round(im.height * largeur / im.width)), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
    im.save(dst, "JPEG", quality=qualite, optimize=True, progressive=True)
    print(f"{src} ({os.path.getsize(src) // 1024} Ko) → {dst} ({os.path.getsize(dst) // 1024} Ko, {im.width}×{im.height})")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
