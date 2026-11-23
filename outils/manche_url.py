#!/usr/bin/env python3
"""AD de la Manche : adresse d'une image à partir d'une référence « base/document, vue ».

Les fiches citent les registres de la Manche sous la forme
« 608359/1919171, vue 98 » : base = 608359, document = 1919171, vue = 98.
La visionneuse de www.archives-manche.fr sert l'image à l'adresse :
    https://www.archives-manche.fr/_recherche-images/show/{base}/image/{document}/{vue}/full/{largeur},/0/default.jpg

Usage :
    python3 -I outils/manche_url.py "608359/1919171, vue 98" [LARGEUR]
    python3 -I outils/manche_url.py 608359 1919171 98 [LARGEUR]
    python3 -I outils/manche_url.py --telecharger DOSSIER "608359/1919171, vue 98"

LARGEUR par défaut : 1400 (comme les adresses déjà dans actes.js).

Exemple (un registre NMD, vue 98) :
    python3 -I outils/manche_url.py "608359/1919171, vue 98"
    -> https://www.archives-manche.fr/_recherche-images/show/608359/image/1919171/98/full/1400,/0/default.jpg

ATTENTION : depuis novembre 2026, le site est protégé contre les robots
(page « This website requires JS enabled and cookies », cookie
bot_mitigation_cookie). Un script ne peut donc pas télécharger l'image :
--telecharger essaie une fois, poliment, et s'arrête si la protection répond.
On ne contourne pas la protection. Dans ce cas, donner l'adresse au responsable de l'arbre, qui l'ouvre dans son navigateur :
il l'ouvre dans son navigateur et enregistre l'image.
"""
import os
import re
import sys
import urllib.error
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"


def adresse(base, doc, vue, largeur="1400"):
    return (f"https://www.archives-manche.fr/_recherche-images/show/"
            f"{base}/image/{doc}/{vue}/full/{largeur},/0/default.jpg")


def lire_reference(args):
    """Accepte « 608359/1919171, vue 98 » ou « 608359 1919171 98 ». Renvoie (base, doc, vue, reste)."""
    texte = " ".join(args)
    m = re.match(r"\s*(\d+)\s*[/ ]\s*(\d+)\s*,?\s*(?:vue\s*)?(\d+)\s*(\d+)?\s*$", texte)
    if not m:
        sys.exit("Référence non reconnue : " + texte + "\n\n" + __doc__)
    return m.group(1), m.group(2), m.group(3), m.group(4) or "1400"


def telecharger(dossier, url, nom):
    os.makedirs(dossier, exist_ok=True)
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60)
        data, ctype = r.read(), r.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        sys.exit(f"Refusé ({e.code}). Ouvrir l'adresse dans un navigateur humain :\n{url}")
    if not ctype.startswith("image/"):
        sys.exit("Le site a renvoyé une page (protection anti-robots), pas une image.\n"
                 f"On ne contourne pas : ouvrir l'adresse dans un navigateur humain :\n{url}")
    chemin = os.path.join(dossier, nom + ".jpg")
    open(chemin, "wb").write(data)
    return chemin


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    if a[0] == "--telecharger":
        if len(a) < 3:
            sys.exit(__doc__)
        base, doc, vue, larg = lire_reference(a[2:])
        print(telecharger(a[1], adresse(base, doc, vue, larg), f"manche_{base}_{doc}_{vue}"))
    else:
        base, doc, vue, larg = lire_reference(a)
        print(adresse(base, doc, vue, larg))


if __name__ == "__main__":
    main()
