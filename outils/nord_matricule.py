#!/usr/bin/env python3
"""AD Nord : trouver les registres matricules militaires (série 1 R) d'une classe.

Site : https://archivesdepartementales.lenord.fr, page « Matricules militaires ».
Deux formulaires de recherche ciblée :
  - « tables » : tables alphabétiques des états signalétiques (une par bureau et par classe) ;
  - « fiches » : registres de fiches matricules (numéro d'ordre croissant, par bureau et par classe).

Usage :
    python3 -I outils/nord_matricule.py BUREAU CLASSE [tables|fiches]

    BUREAU : AVESNES, CAMBRAI, DUNKERQUE, LILLE, VALENCIENNES, VALENCIENNES-DOUAI
    CLASSE : année de la classe (année de naissance + 20), ex. 1894

Exemple :
    python3 -I outils/nord_matricule.py DUNKERQUE 1894 tables

Affiche : titre | cote | ark | nombre de vues. L'ark sert à nord_vue.py.
Méthode : la table donne le n° matricule, la fiche s'ouvre à ce n° (les vues
sont dans l'ordre des numéros, à peu près 1 à 3 fiches par vue : procéder par
dichotomie sur les vues).
Si le formulaire change (formUuid), le refaire dans un navigateur.
"""
import html
import re
import sys
import urllib.parse
import urllib.request

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
BASE = "https://archivesdepartementales.lenord.fr"
FORMS = {
    "tables": ("0d3ab9ff-3258-4541-bf65-c3094fb024a0", "1-date_begin", "1-date_end"),
    "fiches": ("9d12049e-510c-4c14-ad31-0fc5487c199c", "1-date", None),
}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=90).read().decode("utf-8", "replace")


def chercher(bureau, classe, genre):
    uuid, d1, d2 = FORMS[genre]
    q = [("formUuid", uuid), ("mode", "list"), ("size", "80"),
         ("0-controlledAccessGeographicName[]", bureau.upper()), (d1, str(classe))]
    if d2:
        q.append((d2, str(classe)))
    t = get(BASE + "/search/results?" + urllib.parse.urlencode(q))
    blocs = t.split('<span class="sr-only">Résultat n°</span>')[1:]
    if not blocs:
        print("Aucun résultat.", file=sys.stderr)
        return
    for b in blocs:
        ark = re.search(r'/ark:/33518/([a-z0-9]+)', b)
        tit = re.search(r'title="Voir la notice complète : ([^"]*)"', b)
        cote = re.search(r'class="referenceCodes">([^<]*)<', b)
        nb = re.search(r'([\d\s \xa0]+) medias', b)
        print(" | ".join([
            html.unescape(tit.group(1)) if tit else "(sans titre)",
            html.unescape(cote.group(1)).strip() if cote else "(cote ?)",
            ark.group(1) if ark else "(ark ?)",
            (re.sub(r"\D", "", nb.group(1)) + " vues") if nb else "",
        ]))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    chercher(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "tables")
