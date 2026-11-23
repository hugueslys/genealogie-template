#!/usr/bin/env python3
"""Télécharger des vues d'un registre des Archives départementales du Nord.

Usage :
    python3 -I outils/nord_vue.py DOSSIER ARK VUE [VUE ...]

    DOSSIER : où ranger les images (HORS du dépôt, par ex. un dossier temporaire).
    ARK     : identifiant du registre, donné par nord_registre.py
              (ex. « ht25px4wdglr »). On peut aussi coller « ark/uuid »
              ou l'adresse complète « https://…/ark:/33518/ht25px4wdglr/… ».
    VUE     : numéro de vue, à partir de 1, comme dans la visionneuse.
              Une plage « 813-819 » est acceptée.

Exemple (un registre BMS, vue 813) :
    python3 -I outils/nord_vue.py /tmp/vues ht25px4wdglr 813

Pour chaque vue, affiche :
    chemin_de_l_image   lien_stable_de_la_vue
Le lien stable (…/ark:/33518/<ark>/<uuid>) est celui à mettre dans actes.js.

Les images sont en pleine résolution (souvent 2 à 5 Mo) : pour actes/,
recadrer et réduire à 500 Ko au plus (voir outils/reduire.sh).
La liste des vues du registre est gardée en cache dans DOSSIER/<ark>.json.

Fonctionnement : la visionneuse appelle
    /visualizer/api?arkName=<ark>&start=<i>&end=<j>&group=0
qui renvoie la liste des images (uuid) ; l'image est /images/<uuid>.jpg.
"""
import json
import os
import re
import sys
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
BASE = "https://archivesdepartementales.lenord.fr"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=120).read()


def liste_vues(dossier, ark):
    cache = os.path.join(dossier, ark + ".json")
    if os.path.exists(cache):
        return json.load(open(cache))
    p0 = json.loads(get(f"{BASE}/visualizer/api?arkName={ark}&start=0&end=0&group=0"))
    if isinstance(p0, dict):
        p0 = [p0[k] for k in sorted(p0, key=int)]
    nb = json.loads(get(f"{BASE}/visualizer/api?arkName={ark}&uuid={p0[0]['uuid']}"))["counts"]["media"]
    uuids, n = [], 0
    while n < nb:
        part = json.loads(get(f"{BASE}/visualizer/api?arkName={ark}&start={n}&end={min(n + 199, nb - 1)}&group=0"))
        if isinstance(part, dict):
            part = [part[k] for k in sorted(part, key=int)]
        uuids += [m["uuid"] for m in part]
        n += 200
    json.dump(uuids, open(cache, "w"))
    return uuids


def numeros(args):
    for a in args:
        if "-" in a:
            d, f = a.split("-")
            yield from range(int(d), int(f) + 1)
        else:
            yield int(a)


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    dossier = sys.argv[1]
    m = re.search(r"([a-z0-9]{12})(?:/|$)", sys.argv[2].split("ark:/33518/")[-1])
    if not m:
        sys.exit("ARK non reconnu : " + sys.argv[2])
    ark = m.group(1)
    os.makedirs(dossier, exist_ok=True)
    uuids = liste_vues(dossier, ark)
    print(f"registre {ark} : {len(uuids)} vues", file=sys.stderr)
    for v in numeros(sys.argv[3:]):
        if not 1 <= v <= len(uuids):
            print(f"vue {v} hors du registre (1-{len(uuids)})", file=sys.stderr)
            continue
        u = uuids[v - 1]
        chemin = os.path.join(dossier, f"{ark}_{v}.jpg")
        if not os.path.exists(chemin):
            data = get(f"{BASE}/images/{u}.jpg")
            open(chemin, "wb").write(data)
        print(chemin, f"{BASE}/ark:/33518/{ark}/{u}")


if __name__ == "__main__":
    main()
