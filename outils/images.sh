#!/bin/bash
# Préparer et parcourir des images d'actes (ImageMagick : convert, identify, montage).
#
# Usage :
#   outils/images.sh reduire SOURCE.jpg DEST.jpg [GEOMETRIE]
#       Recadre (optionnel), réduit à 2000 px au plus et compresse jusqu'à
#       500 Ko au plus. C'est la forme attendue dans actes/.
#       GEOMETRIE : zone à garder sur l'original, au format L x H + X + Y
#       (ex. 1300x1600+1100+150). Repérer la zone sur une vue réduite.
#   outils/images.sh moities SOURCE.jpg DOSSIER
#       Coupe une double page en deux moitiés (gauche, droite) en pleine
#       résolution, pour lire plus facilement. Écrit <nom>_G.jpg et <nom>_D.jpg.
#   outils/images.sh planche DEST.jpg IMAGE [IMAGE ...]
#       Planche de vignettes numérotées (6 par ligne) pour repérer vite
#       le début d'une année ou d'une section dans un registre.
#
# Exemples :
#   outils/images.sh reduire /tmp/vues/2q3nxcph4srb_40.jpg actes/1726-commune-mariage-martel-pinel.jpg 2437x1800+0+0
#   outils/images.sh moities /tmp/vues/ht25px4wdglr_813.jpg /tmp/vues
#   outils/images.sh planche /tmp/vues/planche.jpg /tmp/vues/ht25px4wdglr_8{10..21}.jpg
#
# Nom des images d'actes : AAAA-commune-type-nom1-nom2.jpg (minuscules, sans accents),
# par ex. 1947-tours-mariage-martel-bertin.jpg.
set -e
cmd=$1; shift || true
case "$cmd" in
  reduire)
    src=$1; dst=$2; geo=$3
    [ -n "$src" ] && [ -n "$dst" ] || { sed -n '2,25p' "$0"; exit 1; }
    crop=(); [ -n "$geo" ] && crop=(-crop "$geo" +repage)
    for q in 80 70 60 50 40; do
      convert "$src" "${crop[@]}" -resize '2000x2000>' -strip -quality $q "$dst"
      [ "$(stat -c %s "$dst")" -le 512000 ] && break
    done
    echo "$dst $(identify -format '%wx%h' "$dst") $(( $(stat -c %s "$dst") / 1024 )) Ko (qualité $q)"
    ;;
  moities)
    src=$1; out=$2; mkdir -p "$out"; b=$(basename "$src" .jpg)
    w=$(identify -format %w "$src"); h=$(identify -format %h "$src"); hw=$((w / 2 + 40))
    convert "$src" -crop ${hw}x${h}+0+0 +repage -quality 85 "$out/${b}_G.jpg"
    convert "$src" -crop ${hw}x${h}+$((w - hw))+0 +repage -quality 85 "$out/${b}_D.jpg"
    echo "$out/${b}_G.jpg"; echo "$out/${b}_D.jpg"
    ;;
  planche)
    dst=$1; shift
    [ $# -ge 1 ] || { sed -n '2,25p' "$0"; exit 1; }
    montage -label '%t' -pointsize 22 "$@" -resize 380x -tile 6x -geometry +4+4 "$dst"
    echo "$dst"
    ;;
  *) sed -n '2,25p' "$0"; exit 1 ;;
esac
