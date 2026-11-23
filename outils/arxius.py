#!/usr/bin/env python3
"""Arxius en línia (archives de Catalogne) : chercher dans les inventaires.

Le site arxiusenlinia.cultura.gencat.cat s'appuie sur une API publique
(backend.arxiusenlinia.cultura.gencat.cat) qui répond sans navigateur.

Commandes :

  python3 -I outils/arxius.py cerca TEXTE [PAGES] [FILTRE]
      Recherche simple. Une ligne par unité :
        cote | dates | titre | description | DIG (si numérisée)
      PAGES : nombre de pages de 100 résultats (5 par défaut).
      FILTRE : ne garder que les cotes qui contiennent ce texte (ex. « ACPJ350 »).

  python3 -I outils/arxius.py fons FONS N [TYPE]
      Parcourt les unités FONS-TYPE-1 à FONS-TYPE-N d'un fonds (TYPE : T2 par défaut).
      Sert à lire l'inventaire complet d'un fonds (ex. fonds d'une mairie).

  python3 -I outils/arxius.py images COTE DOSSIER N1 [N2 ...]
      Télécharge les images N1, N2… (numéro d'image, à partir de 1) d'une unité numérisée
      dans DOSSIER (hors du dépôt) et affiche leur adresse stable.
      « images COTE DOSSIER total » donne le nombre d'images (API /unitat/objects).
  Un fonds se décrit par l'API /fons/detail?codiReferencia=ACPJ350-180 (nom, dates, volume).

Exemples :
  python3 -I outils/arxius.py cerca Tremp 3
  python3 -I outils/arxius.py fons ACPJ350-149 200
  python3 -I outils/arxius.py images ACPJ350-180-T2-318 /tmp/vues 7 341
      (registre de notaire : images 7 et 341)
"""
import concurrent.futures as cf
import json
import sys
import urllib.parse
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
API = "https://backend.arxiusenlinia.cultura.gencat.cat"


def get(url):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60))


def propre(x, n):
    return (x or "").replace("<mark>", "").replace("</mark>", "").replace("\n", " ")[:n]


def cerca(texte, pages=5, filtre=""):
    for page in range(1, pages + 1):
        q = {"text": texte, "cercarEn": "QUALSEVOL", "tipusDoc": "TOTS", "nomesDigitals": "false",
             "page": page, "size": 100, "sort": "data_inici_dt,asc", "fromSearch": "true"}
        d = get(API + "/unitat/search/basic?" + urllib.parse.urlencode(q))
        if page == 1:
            print("TOTAL", d["totalResults"])
        for r in d["results"]:
            if filtre and filtre not in r["codiReferencia"]:
                continue
            print(r["codiReferencia"], "|", r["cronologia"], "|", propre(r["titol"], 150), "|",
                  propre(r.get("descripcio"), 150), "| DIG" if r.get("primerObjecteDigitalId") else "")
        if page >= d["totalPages"]:
            break


def fons(code, n, typ="T2"):
    def un(i):
        try:
            d = get(f"{API}/unitat/detail?codiReferencia={code}-{typ}-{i}")
        except Exception:
            return None
        if not d.get("titol"):
            return None
        return (f"{d['codiReferencia']} | {d['cronologia']} | {propre(d['titol'], 200)} | "
                f"{propre(d.get('descripcio'), 300)} | {'DIG' if d.get('primerObjecteDigitalId') else ''}")
    with cf.ThreadPoolExecutor(6) as ex:
        for r in ex.map(un, range(1, n + 1)):
            if r:
                print(r)


def images(code, dossier, nums):
    import os
    os.makedirs(dossier, exist_ok=True)
    objs = get(f"{API}/unitat/objects?codiReferencia={code}")
    if nums == ["total"]:
        print(len(objs))
        return
    for n in nums:
        o = objs[int(n) - 1]
        f = os.path.join(dossier, f"{code}_{int(n):04d}.jpg")
        if not os.path.exists(f):
            req = urllib.request.Request(o["downloadUrl"], headers={"User-Agent": UA})
            with open(f, "wb") as out:
                out.write(urllib.request.urlopen(req, timeout=120).read())
        print(f, "|", o["downloadUrl"])


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) >= 2 and a[0] == "cerca":
        cerca(a[1], int(a[2]) if len(a) > 2 else 5, a[3] if len(a) > 3 else "")
    elif len(a) >= 4 and a[0] == "images":
        images(a[1], a[2], a[3:])
    elif len(a) >= 3 and a[0] == "fons":
        fons(a[1], int(a[2]), a[3] if len(a) > 3 else "T2")
    else:
        sys.exit(__doc__)
