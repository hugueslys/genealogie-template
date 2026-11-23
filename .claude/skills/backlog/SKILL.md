---
name: backlog
description: Suivi du travail sur l'arbre généalogique dans les tickets GitHub et le board « Généalogie ». Obligatoire avant de commencer un chantier (recherche, site, démarche), à chaque commit, à chaque chose apprise (source, site fermé, piste, décision), quand ça bloque, et en fin de session. Aussi pour créer un ticket ou répondre à « on en est où / c'est quoi la suite ».
---

# Backlog de la généalogie

Le travail se suit dans les tickets GitHub du dépôt de l'arbre (celui du dossier courant) et, si vous en créez un, sur un board GitHub Projects affiché en colonnes selon le champ Status (à brancher dans `status.sh`, voir son en-tête).

## La règle

**Rien d'important ne doit exister seulement dans une session.** Plusieurs sessions, et plusieurs agents de recherche, travaillent en parallèle. Une conversation se perd, un ticket reste. Ce qui est fait, en cours, appris ou décidé va dans le ticket concerné, au moment où ça arrive.

Répartition entre les documents :
- **Tickets** : ce qu'il faut faire, qui le fait, où on en est.
- **`recherches/JOURNAL.md`** (index : état des sites) et **`recherches/journal/<région>.md`** : les recherches faites, les pistes infructueuses, les plans de lecture, région par région.
- **`courriers/DEMANDES.md`** : les demandes hors ligne (dernier recours).
- **Fiches de l'arbre** : les résultats.

Un ticket renvoie au journal plutôt que de le recopier.

## Quand mettre à jour, et quoi

| Moment | À faire |
| --- | --- |
| Début de session, ou « on en est où » | Lire les tickets ouverts. Un ticket « En cours » est peut-être tenu par une autre session : lire son dernier commentaire avant de le reprendre. |
| Avant de commencer | Trouver le ticket, ou le créer. Statut « En cours », et un commentaire d'une ligne : ce qu'on va faire, et où (branche, worktree, agent). |
| Une chose apprise (un acte trouvé, un site fermé ou rouvert, une cote, une décision du responsable de l'arbre) | Commentaire sur le ticket, tout de suite. Le détail des lectures va dans le journal. |
| Ça bloque sur le responsable de l'arbre (navigateur, compte, réponse, entretien) | Statut « Bloqué », et un commentaire qui dit exactement ce qu'on attend de lui ou d'elle. |
| À chaque commit | Le message du commit cite le ticket (`(#n)`). Puis commentaire « Fait dans <sha> : … », et cocher les cases couvertes. |
| Tout est fait, vérifié, commité | Cocher tout, commenter le commit, fermer (statut « Terminé »). |
| Un besoin, une piste ou un bug apparaît en route | Nouveau ticket, pas une note dans la conversation. |
| Fin de tour ou de session | Relire : est-ce que tout ce que je sais est dans un ticket, le journal ou une fiche ? |

## Statuts

| Statut | Quand |
| --- | --- |
| Ouvert | À faire |
| En cours | Commencé dans une session (le commentaire dit laquelle et où) |
| Bloqué | Attend le responsable de l'arbre : son navigateur ou un compte, une réponse, un entretien, ou la réouverture d'un site |
| Terminé | Fait, vérifié, commité ; le ticket est fermé |

## Labels

Un seul label par ticket, celui du but principal :
- `recherche` : dépouillement de sources en ligne accessibles automatiquement ;
- `navigateur` : à faire dans le navigateur du responsable de l'arbre (anti-robot, compte) ;
- `démarche` : demande hors ligne, en dernier recours ;
- `famille` : témoignages, entretiens, documents de famille ;
- `site` : le site (affichage, vues, publication) ;
- `organisation` : données, outils, méthode, dépôt.

## Outils

**Session cloud (Claude Code sur le web)** : utiliser les outils GitHub MCP.
- Lire : `list_issues`.
- Créer ou mettre à jour : `issue_write`.
- Commenter : `add_issue_comment`.

Le board (champ Status) ne se règle pas depuis une session cloud. Fermer et rouvrir les tickets suffit. Le responsable de l'arbre, ou une session sur son ordinateur, range les colonnes.

**Sur l'ordinateur** (gh connecté), les scripts de ce dossier :

```bash
.claude/skills/backlog/status.sh 4 "En cours"      # statut sur le board (+ ferme ou rouvre)
.claude/skills/backlog/note.sh 4 "AD Manche : anti-robot, lecture manuelle."
.claude/skills/backlog/done.sh 4 abc1234 "Actes intégrés, journal à jour."
gh issue list --state open
```

Sans board, `status.sh` ferme ou rouvre seulement le ticket. Pour brancher un board : identifiants du projet, du champ Status et de ses options, une fois, dans son en-tête.

Corps d'un ticket : le contexte en deux ou trois phrases, puis des cases `- [ ]` pour les étapes, et « Fait quand : … » si le critère n'est pas évident. En français.

Jamais dans un ticket : identifiants, mots de passe ou jetons de comptes (FamilySearch, Geneanet, SHD…).

Une écriture GitHub par commande : plusieurs écritures enchaînées sont souvent refusées par les permissions de la session.

## « On en est où ? »

Répondre par statut, dans cet ordre :
1. En cours, avec la session et le dernier commentaire.
2. Bloqué, avec ce qu'on attend du responsable de l'arbre.
3. La suite, parmi les tickets Ouvert.

Si un ticket « En cours » ou « Bloqué » est en fait terminé, le dire et le fermer dans la foulée.
