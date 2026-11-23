#!/bin/sh
# Met le gabarit à jour avec le projet d'origine (dépôt privé d'un arbre réel), sans jamais en reprendre de données.
# Usage : sh outils/gabarit.sh <chemin du dépôt d'origine> [--essai] [--ref <commit>] [--garder]
# Liste des fichiers : outils/gabarit.liste ; remplacements locaux : outils/gabarit.local (non versionné).
# Détails : outils/gabarit.mjs et le README, section « Mettre à jour depuis le projet d'origine ». Ne pousse jamais.
set -e
exec node "$(dirname "$0")/gabarit.mjs" "$@"
