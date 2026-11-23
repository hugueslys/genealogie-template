---
name: demarrer
description: Mise en route d'un nouvel arbre à partir du gabarit, sans rien faire à la main. À lancer quand l'utilisateur dit « démarre mon arbre », « on commence », « mets en place le projet », ou quand data/personnes/ ne contient encore que les fiches d'exemple (rôle « Personne fictive »). Fait l'entretien de départ, crée les premières fiches, retire les exemples, remplit CLAUDE.md, lieux.js et partages.json, puis propose les premières recherches.
---

# Démarrer un nouvel arbre

L'utilisateur ne doit rien faire à la main : pas de commande à taper, pas de fichier à ouvrir. Tu fais tout, tu lui poses des questions simples, et tu lui montres le résultat. Écris-lui en français simple, avec des phrases courtes.

## 1. Vérifier l'outillage (sans le déranger)

- `node --version` (22 ou plus) et `python3 --version`. S'il manque quelque chose, dis-lui exactement quoi installer et comment, en une ou deux lignes, puis attends.
- Le dossier est-il un dépôt git ? Sinon : `git init`. S'il a été cloné depuis le gabarit public, propose de le rattacher à un **nouveau dépôt privé** à lui (`gh repo create <nom> --private --source . --push`), seulement avec son accord : il contiendra des données de famille.

## 2. L'entretien de départ

Une question à la fois, dans cet ordre. Ce qu'il ne sait pas, on le laisse vide : on cherchera plus tard.
1. Qui est au centre de l'arbre ? (lui-même le plus souvent) Prénoms, nom, date et lieu de naissance.
2. Ses parents : prénoms, nom (nom de naissance pour les femmes), dates et lieux de naissance, de mariage, de décès s'il y a lieu, métiers.
3. Ses quatre grands-parents, de la même façon.
4. Ce qu'il sait au-delà (arrière-grands-parents, régions d'origine, documents de famille, livret de famille, arbre déjà fait par un proche).
5. Le périmètre : seulement son ascendance, ou aussi celle de son conjoint ? Les vivants peuvent-ils figurer en entier dans les partages ?

Chaque information va dans la fiche avec sa source : `{ "texte": "Témoignage de <Prénom Nom>, JJ/MM/AAAA.", "nature": "temoignage" }`, niveau `B`. Un document qu'il montre (photo d'un livret de famille, d'un acte) est une source plus forte : on le décrit et, si c'est un acte lu, niveau `A`.

## 3. Créer les fiches

- Une fiche par personne avec `node outils/fiche.mjs nouvelle <id> '<json>'` (format 2, voir `outils/DONNEES.md`). Identifiants courts : `martin_pierre`, `durand_lucie`.
- Les liens : `pere`, `mere` (avec `fiche.mjs definir`), les unions, et la preuve de chaque lien (`fiche.mjs lien <id> pere '{"fiab": "B", "preuve": "témoignage", "src": [1]}'`).
- `data/meta.json` : `famille.racine` = la personne au centre.
- **Retirer les exemples** : les fiches dont le `role` est « Personne fictive (exemple du gabarit) » (`jeanne_martel`, `paul_martel`, `louise_bertin`), leurs entrées dans `meta.json` (`ordre`), le récit d'exemple de `recits.js` (`branches`, `vies`) et l'exemple de `vues.js`.
- `lieux.js` : une ligne par commune citée (coordonnées approximatives du centre de la commune) et des régions qui correspondent à ses branches.
- `partages.json` : retirer l'exemple. Proposer un partage par branche seulement s'il le souhaite.

## 4. Adapter le projet

- `CLAUDE.md` : remplacer `<Prénom Nom>` par la personne au centre, retirer la ligne « Gabarit : … », écrire le périmètre choisi.
- `recherches/JOURNAL.md` : remplacer l'exemple de fichier régional par ses régions ; créer `recherches/journal/<region>.md` à partir de `MODELE-REGION.md` pour chaque région de ses branches.
- `manifest.webmanifest` et `<title>` de `index.html` : « Arbre de <Nom> » s'il le souhaite.
- Si le projet est sur GitHub : proposer d'utiliser les tickets (skill `backlog`) ; ne rien créer sans son accord.

## 5. Contrôler et montrer

- `node outils/construire.mjs` puis `node outils/verifier.mjs` : 0 erreur.
- Ouvrir le site pour lui (serveur local `python3 -m http.server`, puis l'adresse dans le navigateur) et lui montrer l'arbre.
- Commit : « Démarrage de l'arbre : premières fiches ».

## 6. Proposer la suite

En trois lignes au plus :
- les ancêtres dont un parent manque, par génération (vue « Recherches » du site) ;
- les premières recherches en ligne possibles (lire `recherches/METHODE.md` et `recherches/JOURNAL.md` : quels sites d'archives couvrent ses régions) ;
- les documents de famille qu'il pourrait photographier (livret de famille, faire-part, photos annotées).

Puis demander par quoi il veut commencer.
