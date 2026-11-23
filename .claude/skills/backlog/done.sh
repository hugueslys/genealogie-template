#!/usr/bin/env bash
# Termine un ticket : coche toutes ses cases, commente le commit, statut « Terminé » (ferme le ticket).
# Usage : done.sh <numéro de ticket> <sha du commit> ["ce qui a été vérifié, ce qui reste ailleurs"]
set -euo pipefail

REPO=${GENEALOGIE_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}
here=$(cd "$(dirname "$0")" && pwd)
number=${1:?numéro de ticket}
sha=${2:?sha du commit}
extra=${3:-}

body=$(gh issue view "$number" --repo "$REPO" --json body --jq .body | sed 's/^\(\s*\)- \[ \] /\1- [x] /')
gh issue edit "$number" --repo "$REPO" --body "$body" >/dev/null
text="Fait dans $sha."
[ -n "$extra" ] && text="$text $extra"
gh issue comment "$number" --repo "$REPO" --body "$text" >/dev/null
"$here/status.sh" "$number" Terminé
