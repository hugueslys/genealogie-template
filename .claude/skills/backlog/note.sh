#!/usr/bin/env bash
# Ajoute un commentaire à un ticket du backlog de la généalogie.
# Usage : note.sh <numéro de ticket> "<texte>"   (ou le texte sur l'entrée standard)
set -euo pipefail

REPO=${GENEALOGIE_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}
number=${1:?numéro de ticket}
if [ $# -ge 2 ]; then text=$2; else text=$(cat); fi
[ -n "$text" ] || { echo "texte vide" >&2; exit 2; }
case "$text" in
  *password=*|*PASSWORD=*|*TOKEN=*|*_KEY=*|*mot\ de\ passe\ :*) echo "refusé : ça ressemble à un secret, il va dans .env" >&2; exit 3 ;;
esac
gh issue comment "$number" --repo "$REPO" --body "$text" >/dev/null
echo "#$number : commentaire ajouté"
