# Consignes communes des recherches

À lire **en entier** par toute recherche (agent) avant de commencer. Le lancement d'une recherche ne donne que
l'objectif, les pistes et le ticket : tout le reste est ici.

## 1. Démarrage
1. Dans ton worktree : si la session principale travaille sur une autre branche que `main`, place-toi d'abord dessus (`git reset --hard <branche de travail>`, la branche est donnée au lancement).
2. Lis, et **seulement** cela :
   - `CLAUDE.md` (règles du projet, périmètre) ;
   - `recherches/JOURNAL.md` (index court : état des sites) puis **le seul fichier de ta région** dans `recherches/journal/` (résumé, plan de lecture, ce qui est épuisé) ;
   - `recherches/METHODE.md`, sections utiles ; `outils/README.md` pour l'outil de ton archive ; `outils/DONNEES.md` (format des fiches) ;
   - les fiches concernées (`node outils/fiche.mjs voir <id>`, `chercher <nom>`) et la fiche de lecture du registre (`recherches/lectures/`) ;
   - le dernier commentaire du ticket.
   Ne relis pas le reste du journal ni les autres régions : c'est ce qui coûte le plus cher.
3. Scripts personnels : dans un sous-dossier du scratchpad à ton nom. N'exécute jamais un script d'une autre recherche.

## 2. Périmètre
- Celui fixé dans `CLAUDE.md` (par exemple : l'ascendance de <Prénom Nom>, côtés paternel et maternel, leurs frères et sœurs, leurs descendants).
- **Pas de généalogie des alliances** : pour le conjoint d'un collatéral, au plus ses parents en remarque, sans fiche ni recherche.
- Personnes vivantes : aucune recherche en ligne sur elles.

## 3. Lire les registres sans gaspiller
- **Repérer d'abord, lire ensuite** : index, tables décennales, noms en marge, planches de vues réduites. N'agrandis que les actes retenus (recadre l'acte utile).
- Taille raisonnable des images : 1600 px de large au plus. Toute image gardée passe par `python3 -I outils/image.py <source> actes/<nom>.jpg [--recadrer x0,y0,x1,y1]`, **puis est envoyée dans R2 tout de suite** : `node outils/r2.mjs envoyer actes/<nom>.jpg`. Les images ne sont plus dans git (`.gitignore`) : une image non envoyée serait perdue. Pour revoir une image existante : `node outils/r2.mjs telecharger actes/<début du nom>`.
- Note **chaque vue lue** dans la fiche de lecture du registre (`recherches/lectures/`), même sans résultat : la recherche suivante ne la relira pas.
- **Règle d'arrêt** : si une piste n'a plus de registre en ligne pour la période (registres lus en entier, années manquantes, site fermé ou protégé), écris-la dans la ligne « Épuisé en ligne » du fichier de ta région et arrête-la. Ce qui demande un navigateur humain va dans la section « À faire avec un compte ou un navigateur humain » du fichier de ta région, avec la recherche précise (et un ticket `navigateur`).
- **Ne jamais contourner une protection anti-robots** (Cloudflare, Anubis, captcha, « requires JS and cookies »).

## 4. Preuve
- Chaque fait cite sa source précise (archive, cote, registre, année, numéro d'acte, vue, URL) et, si possible, une image dans `actes/`.
- Niveaux : A acte lu ; B déduit ou témoignage familial ; C arbre ou index en ligne non relu ; D hypothèse.
- **Liens de parenté** (champ `liens`, voir `outils/DONNEES.md`) : chaque lien père / mère / union a sa note et la nature de sa preuve (directe, indirecte, témoignage, arbre, contredite). Un lien indirect ou contredit a un **raisonnement écrit** : indices, hypothèses écartées, ce qui manque.
- **Ne jamais remonter au-dessus d'un lien non confirmé** (C ou D) : on confirme d'abord le lien, ou on signale la question. (Sinon, on risque de construire une branche entière sur une hypothèse fausse.)
- Identité sûre avant de rattacher (nom, prénoms, âge, lieu, parents ou conjoint concordants). Sinon : `pistes` ou `aVerifier`, jamais de filiation.
- Un lien qui fait **monter d'une génération** sera relu par une seconde recherche (voir METHODE.md, « Relecture ») : écris dans ton rapport la liste de ces liens, avec l'acte et la vue.

## 5. Données et contrôles
- Fiches : `outils/fiche.mjs` ou un petit script node avec `rangerFiche` et `enJSON` de `outils/donnees.mjs`. Nouvelle fiche : ajoute son id à `data/meta.json` (ordre).
- `famille.js` et `actes.js` sont générés et **non versionnés** : ne les commite pas.
- Avant chaque commit : `node outils/verifier.mjs` (0 erreur) et `node outils/partager.mjs` (aucune fuite : une fiche d'un partage ne doit pas nommer une personne qui a une fiche hors de ce partage).
- Journal : complète le fichier de ta région (résumé, plan de lecture, historique de la passe : trouvé / rien / bloqué). Ajoute une sous-section datée plutôt que de réécrire celle des autres.

## 6. Commits et rapport
- Commits réguliers, avec le numéro du ticket `(#n)`.
- Ne pousse pas, n'ouvre pas de PR : la session principale fusionne (`sh outils/fusionner.sh <branche> "<message>"`).
- Si ton contexte devient lourd, arrête-toi **proprement après un commit**, et dis où tu en es.
- Rapport final, 12 lignes au plus : branche et sha ; trouvé / rien / épuisé, par piste ; fiches créées ou modifiées ; liens qui montent d'une génération (à relire) ; reste à faire.

## 7. Pour la session principale (orchestration)
- Un lancement = objectif + pistes précises (registre, vues) + ticket + « lis recherches/CONSIGNES-RECHERCHE.md ». Pas de copie de ces consignes.
- **Choix du modèle** : balayage d'index, de tables et de marges, inventaires de fonds, relevés en masse → modèle moins cher (`model: "sonnet"`). Lecture des actes décisifs, rattachements, raisonnements, relecture de liens, récits → modèle principal.
- Ne pas relancer une piste marquée « Épuisé en ligne ».
- Relecture : pour chaque lien qui monte d'une génération, une recherche de relecture lit l'acte **sans voir la lecture précédente** et compare (voir METHODE.md).
- Fusion : `sh outils/fusionner.sh <branche> "<message>"`, puis PR vers `main`.
