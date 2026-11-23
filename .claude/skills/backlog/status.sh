#!/usr/bin/env bash
# Change le statut d'un ticket sur le board GitHub Projects de l'arbre.
# Usage : status.sh <numéro de ticket> <Ouvert|En cours|Bloqué|Terminé>
# Le dépôt est celui du dossier courant (ou la variable GENEALOGIE_REPO, au format compte/dépôt).
# Sans board, le script ferme ou rouvre seulement le ticket. Pour brancher un board, remplir une fois :
#   gh project list --owner <votre-compte>                       → PROJECT (numéro) et PROJECT_ID
#   gh project field-list <n> --owner <votre-compte> --format json  → FIELD_ID (champ Status) et les options
set -euo pipefail

REPO=${GENEALOGIE_REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}
OWNER=${REPO%%/*}
PROJECT=A_CONFIGURER
PROJECT_ID=A_CONFIGURER
FIELD_ID=A_CONFIGURER

number=${1:?numéro de ticket}
status=${2:?statut}
case "$status" in
  Ouvert) option=A_CONFIGURER ;;
  "En cours") option=A_CONFIGURER ;;
  Bloqué) option=A_CONFIGURER ;;
  Terminé) option=A_CONFIGURER ;;
  *) echo "Statut inconnu : $status (Ouvert, En cours, Bloqué, Terminé)" >&2; exit 2 ;;
esac
if [ "$PROJECT_ID" = A_CONFIGURER ]; then
  echo "Pas de board configuré dans status.sh (voir l'en-tête) : seul l'état du ticket change." >&2
else
  url="https://github.com/$REPO/issues/$number"
  item=$(gh project item-add "$PROJECT" --owner "$OWNER" --url "$url" --format json --jq .id)
  gh project item-edit --project-id "$PROJECT_ID" --id "$item" --field-id "$FIELD_ID" \
    --single-select-option-id "$option" >/dev/null
fi

state=$(gh issue view "$number" --repo "$REPO" --json state --jq .state)
if [ "$status" = Terminé ] && [ "$state" = OPEN ]; then
  gh issue close "$number" --repo "$REPO" >/dev/null
elif [ "$status" != Terminé ] && [ "$state" = CLOSED ]; then
  gh issue reopen "$number" --repo "$REPO" >/dev/null
fi
echo "#$number → $status"
