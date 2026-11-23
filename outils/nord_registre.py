#!/usr/bin/env python3
"""Trouver un registre aux Archives départementales du Nord.

Site : https://archivesdepartementales.lenord.fr (nouveau domaine ; l'ancien
archives.lenord.fr ne répond plus, mais les numéros de vue n'ont pas changé).

Usage :
    python3 -I outils/nord_registre.py COMMUNE ANNEE_DEBUT ANNEE_FIN

Exemple :
    python3 -I outils/nord_registre.py Douai 1740 1745

Affiche, pour chaque registre (état civil ou paroissial) trouvé :
    titre de la notice | cote | ark | nombre de vues
L'ark (par ex. « 2q3nxcph4srb ») sert ensuite à nord_vue.py.

La recherche passe par le formulaire « état civil » du site (formUuid fixe).
Si le site change ce formulaire, la recherche ne renverra plus rien :
refaire la recherche dans un navigateur et relever le nouveau formUuid
dans l'adresse de la page de résultats.
"""
import html
import re
import sys
import urllib.parse
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
BASE = "https://archivesdepartementales.lenord.fr"
FORM_ETAT_CIVIL = "dc4e871d-0b62-41fb-9921-5ded573781b8"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=90).read().decode("utf-8", "replace")


def chercher(commune, debut, fin):
    q = [
        ("formUuid", FORM_ETAT_CIVIL), ("sort", "date_asc"), ("mode", "list"),
        ("0-controlledAccessGeographicName[]", commune.upper()),  # le site attend des majuscules
        ("3-date_begin", str(debut)), ("3-date_end", str(fin)), ("size", "80"),
    ]
    t = get(BASE + "/search/results?" + urllib.parse.urlencode(q))
    # Un bloc par résultat, qui commence par « Résultat n° ».
    blocs = t.split('<span class="sr-only">Résultat n°</span>')[1:]
    if not blocs:
        print("Aucun registre trouvé (vérifier l'orthographe de la commune).", file=sys.stderr)
        return
    for b in blocs:
        ark = re.search(r'/ark:/33518/([a-z0-9]+)', b)
        tit = re.search(r'title="Voir la notice complète : ([^"]*)"', b)
        cote = re.search(r'class="referenceCodes">([^<]*)<', b)
        nb = re.search(r'([\d\s\u202f\xa0]+) medias', b)
        print(" | ".join([
            html.unescape(tit.group(1)) if tit else "(sans titre)",
            html.unescape(cote.group(1)).strip() if cote else "(cote ?)",
            ark.group(1) if ark else "(ark ?)",
            (re.sub(r"\D", "", nb.group(1)) + " vues") if nb else "",
        ]))
    print("Lien d'un registre : " + BASE + "/ark:/33518/<ark>")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    chercher(sys.argv[1], sys.argv[2], sys.argv[3])
