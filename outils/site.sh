#!/bin/sh
# Prépare le site à publier dans public/ : fichiers du site, images, GEDCOM et partages.
# Le dossier public/ se dépose ensuite tel quel chez n'importe quel hébergeur de fichiers statiques.
# Usage : sh outils/site.sh
set -e
cd "$(dirname "$0")/.."
node outils/construire.mjs
node outils/verifier.mjs
rm -rf public && mkdir public
cp index.html famille.js lieux.js actes.js recits.js vues.js manifest.webmanifest icone.png public/
for d in actes lieux photos; do [ -d "$d" ] && cp -R "$d" public/; done
node gedcom.mjs public/arbre.ged
# Partages (versions réduites par branche, vivants masqués) : public/partage/<nom>/, voir outils/PARTAGES.md.
# Le script échoue s'il trouve une donnée hors périmètre dans un partage.
node outils/partager.mjs --sortie public/partage
echo "Site prêt dans public/ (à protéger par un mot de passe ou une authentification chez l'hébergeur : il contient des données de famille)."
