"""Fabrique la version « artefact » de la page (sans doctype, html, head ni body) à partir de index.html.
Usage : python3 publier.py chemin/de/sortie.html"""
import re, sys
h = open("index.html", encoding="utf-8").read()
head = re.search(r"<head>(.*?)</head>", h, re.S).group(1)
head = re.sub(r'<meta charset[^>]*>\s*|<meta name="viewport"[^>]*>\s*', "", head)
body = re.search(r"<body>(.*?)</body>", h, re.S).group(1)
open(sys.argv[1], "w", encoding="utf-8").write(head.strip() + "\n" + body.strip() + "\n")
