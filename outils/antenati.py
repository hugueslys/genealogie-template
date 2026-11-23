#!/usr/bin/env python3
"""Antenati (Portale Antenati, archives d'État italiennes) : registres et images.

Le site exige un User-Agent de navigateur (sinon 403). Les images passent par
un serveur IIIF : https://iiif-antenati.cultura.gov.it/iiif/2/<image>/full/<taille>/0/default.jpg
Prendre la taille « 1600, » (1600 px de large) : la taille maximale « full »
déclenche une protection Cloudflare. On ne la contourne pas.

Commandes :

  python3 -I outils/antenati.py vues ARK
      Liste les vues d'un registre : numéro, étiquette (« pag. 12 »), identifiant d'image.
      ARK = « an_ua… » (registre) ou « an_ud… » (acte isolé, par ex. trouvé
      par l'index des noms) ou l'adresse complète https://antenati.cultura.gov.it/ark:/12657/…
      Pour un « an_ud », la vue de l'acte est marquée d'une étoile.

  python3 -I outils/antenati.py telecharger DOSSIER ARK VUE [VUE ...]
      Télécharge des vues (numéros de la liste ci-dessus, « 3-7 » accepté)
      dans DOSSIER (hors du dépôt). Avec un « an_ud » sans VUE : la vue de l'acte.

  python3 -I outils/antenati.py image DOSSIER IMAGE_ID [LARGEUR]
      Télécharge une image par son identifiant IIIF (ex. « LyJ6Ml9 », tel
      qu'il apparaît dans actes.js). LARGEUR par défaut : 1600.

  python3 -I outils/antenati.py noms COGNOME [NOME]
      Index des noms (« ricerca nominativa ») : une ligne par personne,
      avec les actes liés (type, date, ark « an_ud… »). Le lieu n'est pas
      donné par la liste : ouvrir l'an_ud avec la commande « vues ».

Exemples :
  python3 -I outils/antenati.py vues an_ud15370232          # un acte isolé (« an_ud »)
  python3 -I outils/antenati.py telecharger /tmp/vues an_ud15370232
  python3 -I outils/antenati.py image /tmp/vues LyJ6Ml9      # une image par son identifiant IIIF
  python3 -I outils/antenati.py noms Rossi Maria

Rappel : pour beaucoup de communes, Antenati n'a que l'état civil (souvent à partir de 1866), pas les registres paroissiaux.
"""
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
SITE = "https://antenati.cultura.gov.it"
IIIF = "https://iiif-antenati.cultura.gov.it/iiif/2"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": SITE + "/"})
    return urllib.request.urlopen(req, timeout=120).read()


def ark_court(a):
    m = re.search(r"(an_u[ad]\d+)", a)
    if not m:
        sys.exit("ARK non reconnu (attendu an_ua… ou an_ud…) : " + a)
    return m.group(1)


def registre(ark):
    """Renvoie (titre, liste des vues [(étiquette, image_id)], image_id de l'acte ou None)."""
    page = get(f"{SITE}/ark:/12657/{ark}").decode("utf-8", "replace")
    m = re.search(r"manifestId:\s*'([^']+)'", page) or re.search(r"(https://dam-antenati[^'\"]*manifest)", page)
    if not m:
        sys.exit("Manifeste introuvable sur la page " + ark)
    c = re.search(r"canvasId:\s*'[^']*/([^/']+)'", page)
    man = json.loads(get(m.group(1)))
    vues = []
    for cv in man["sequences"][0]["canvases"]:
        sid = cv["images"][0]["resource"]["service"]["@id"].rstrip("/").split("/")[-1]
        vues.append((cv.get("label", ""), sid))
    meta = {x["label"]: x["value"] for x in man.get("metadata", []) if isinstance(x.get("value"), str)}
    titre = man.get("label", "") + (" — " + meta["Tipologia"] if "Tipologia" in meta else "")
    acte = c.group(1) if (c and ark.startswith("an_ud")) else None
    return titre, vues, acte


def telecharger_image(dossier, image_id, largeur="1600", nom=None):
    os.makedirs(dossier, exist_ok=True)
    chemin = os.path.join(dossier, (nom or image_id) + ".jpg")
    if not os.path.exists(chemin):
        data = get(f"{IIIF}/{image_id}/full/{largeur},/0/default.jpg")
        if not data.startswith(b"\xff\xd8"):
            sys.exit(f"{image_id} : la réponse n'est pas une image (protection du site ?)")
        open(chemin, "wb").write(data)
    return chemin


def numeros(args):
    for a in args:
        if "-" in a:
            d, f = a.split("-")
            yield from range(int(d), int(f) + 1)
        else:
            yield int(a)


def cmd_vues(ark):
    titre, vues, acte = registre(ark)
    print(titre)
    for i, (lab, sid) in enumerate(vues, 1):
        print(i, lab, sid, "*" if sid == acte else "")


def cmd_telecharger(dossier, ark, nums):
    titre, vues, acte = registre(ark)
    print(titre, file=sys.stderr)
    if not nums:
        if not acte:
            sys.exit("Donner les numéros de vue (pas d'acte désigné pour un an_ua).")
        nums = [str(1 + [s for _, s in vues].index(acte))]
    for v in numeros(nums):
        if not 1 <= v <= len(vues):
            print(f"vue {v} hors du registre (1-{len(vues)})", file=sys.stderr)
            continue
        sid = vues[v - 1][1]
        print(telecharger_image(dossier, sid, nom=f"{ark}_{v}_{sid}"), f"{IIIF}/{sid}/full/1600,/0/default.jpg")


def cmd_noms(cognome, nome=""):
    page = 1
    while True:
        q = {"cognome": cognome, "s_size": 100, "s_page": page}
        if nome:
            q["nome"] = nome
        t = get(f"{SITE}/search-nominative/?" + urllib.parse.urlencode(q)).decode("utf-8", "replace")
        items = re.split(r'class="search-item"', t)[1:]
        for it in items:
            nomp = re.search(r'detail-nominative/\?s_id=(\d+)"[^>]*>\s*([^<]+?)\s*</a>', it)
            actes = re.findall(r'href="/ark:/12657/(an_ud\d+)"[^>]*>\s*<strong>([^<]+)</strong><br>\s*([^<]+?)\s*</a>', it)
            print(html.unescape(nomp.group(2)) if nomp else "?", "|",
                  "; ".join(f"{html.unescape(ty)} {d} {a}" for a, ty, d in actes))
        if len(items) < 100:
            break
        page += 1


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    if a[0] == "vues" and len(a) == 2:
        cmd_vues(ark_court(a[1]))
    elif a[0] == "telecharger" and len(a) >= 3:
        cmd_telecharger(a[1], ark_court(a[2]), a[3:])
    elif a[0] == "image" and len(a) in (3, 4):
        print(telecharger_image(a[1], a[2], a[3] if len(a) == 4 else "1600"))
    elif a[0] == "noms" and len(a) in (2, 3):
        cmd_noms(*a[1:])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
