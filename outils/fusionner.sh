#!/bin/bash
# Fusionne la branche d'une recherche (worktree d'un agent) dans la branche courante, résout les conflits
# mécaniques, reconstruit, vérifie, commite et pousse.
# Usage : sh outils/fusionner.sh <branche> "<message de commit>"
#   - famille.js / actes.js : générés, non versionnés (supprimés de l'index s'ils reviennent d'une vieille branche) ;
#   - fichiers .md (journal, lectures) : on garde les deux versions, l'une après l'autre ;
#   - data/meta.json (ordre des fiches) : on garde les deux listes d'ajouts ;
#   - tout autre conflit : arrêt, à résoudre à la main.
set -u
cd "$(dirname "$0")/.."
BR="$1"; MSG="$2"
# Lignes ajoutées à la fin du message de commit (facultatif) : variable FUSION_TRAILER.
TRAILER="${FUSION_TRAILER:+

$FUSION_TRAILER}"
git merge --no-edit "$BR" >/dev/null 2>&1
for f in $(git diff --name-only --diff-filter=U); do
  case "$f" in
    famille.js|actes.js) git rm -q --cached "$f" 2>/dev/null || true ;;
    *.md) python3 - "$f" <<'PY'
import re,sys
p=sys.argv[1];s=open(p).read()
s=re.sub(r'<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n', lambda m: m.group(1)+m.group(2), s, flags=re.S)
open(p,'w').write(s)
PY
      git add "$f" ;;
    data/meta.json) python3 - <<'PY'
import re,json
p='data/meta.json';s=open(p).read()
s=re.sub(r'<<<<<<< [^\n]*\n(.*?)\n=======\n(.*?)>>>>>>> [^\n]*\n', lambda m: m.group(1)+',\n'+m.group(2), s, flags=re.S)
json.loads(s);open(p,'w').write(s)
PY
      git add "$f" ;;
    *) echo "CONFLIT NON RÉSOLU : $f (à résoudre à la main, puis git commit)"; exit 1 ;;
  esac
done
git rm -q --cached famille.js actes.js 2>/dev/null || true
if git grep -l "^<<<<<<< " -- '*.md' '*.json' '*.js' >/dev/null 2>&1; then echo "MARQUEURS DE CONFLIT RESTANTS"; exit 1; fi
node outils/construire.mjs | tail -1
E=$(node outils/verifier.mjs | grep -c '\[ERREUR\]'); F=$(node outils/partager.mjs 2>&1 | grep -ci fuite)
echo "erreurs : $E   fuites : $F"
[ "$E" = 0 ] && [ "$F" = 0 ] || { echo "Contrôles en échec : rien n'est commité."; exit 1; }
git add -A data recherches lieux.js recits.js vues.js lieux actes photos 2>/dev/null
if git rev-parse -q --verify MERGE_HEAD >/dev/null || ! git diff --cached --quiet; then git commit -qm "$MSG$TRAILER"; fi
git push -q origin "$(git branch --show-current)" && git log --oneline -1
