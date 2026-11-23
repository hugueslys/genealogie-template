#!/bin/sh
# Copie les fichiers du site dans public/ puis déploie sur Cloudflare (Worker protégé par Access : fichiers + API des commentaires).
set -e
cd "$(dirname "$0")"
# Depuis la migration vers data/, famille.js et actes.js sont générés (voir outils/DONNEES.md).
if [ -d data/personnes ]; then node outils/construire.mjs; fi
rm -rf public && mkdir public
cp index.html famille.js lieux.js actes.js recits.js vues.js manifest.webmanifest icone.png public/
# Images (actes/, lieux/, photos/) : dans R2, servies par le Worker (worker/images.js) ; plus copiées dans public/.
node gedcom.mjs public/arbre.ged
# Partages (versions réduites par branche, vivants masqués) : public/partage/<nom>/, voir outils/PARTAGES.md.
# Le script échoue (et bloque le déploiement) s'il trouve une donnée hors périmètre dans un partage.
node outils/partager.mjs --sortie public/partage
# Worker (fichiers + API des commentaires) : paquet au format Build Output, voir outils/cloudflare.mjs et outils/PARTAGES.md.
node outils/cloudflare.mjs
npx cf deploy --prebuilt
