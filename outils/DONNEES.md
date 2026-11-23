# Données de l'arbre : dossier `data/`

Le site est statique et lit `famille.js` (`window.FAMILLE`) et `actes.js` (`window.FAMILLE_ACTES`).
Ces deux fichiers sont **générés** à partir de `data/`, qui est la source de vérité.
Pas de base SQL : une fiche = un fichier JSON, et git sert d'historique (un diff par fiche modifiée).

## Structure

```
data/
  meta.json               { "famille": { "racine": "jeanne_martel", "domaines": {…} }, "ordre": ["jeanne_martel", "paul_martel", …] }
  personnes/<id>.json     une fiche par personne (état complet), actes de la personne sous la clé "actes"
  actes-orphelins.json    actes rattachés à un id sans fiche (absent s'il n'y en a pas)
```

- `meta.famille` : tout ce que contient `window.FAMILLE` sauf `personnes` (racine, domaines de métier…).
- `meta.ordre` : ordre des personnes dans `FAMILLE.personnes`. Il compte (numéros `@I…@` du GEDCOM, ordre des listes du site).
  Une fiche absente de `ordre` est ajoutée à la fin (ordre alphabétique) avec un avertissement.
- Clés d'une fiche, dans cet ordre : `format`, `prenoms`, `usuel`, `nom`, `nomNaissance`, `sexe`, `role`, `inconnu`, `nationalite`,
  `naissance`, `bapteme`, `mariage`, `deces`, `inhumation` (objets `{ date, lieu, age }`), `pere`, `mere`, `lienParents`, `liens`,
  `conjoint`, `lienUnion`, `unions`, `metier`, `domaines`, `fiab`, `fiabNote`, `photo`, `photoLegende`, `aVoir`, `chronologie`, `remarques`,
  `notes`, `pistes`, `aVerifier`, `sources`, `actes` ; toute autre clé suit, par ordre alphabétique.
- `aVoir` : liens web affichés sous « À voir », `[[texte, url], …]`.

## Liens de parenté : `liens` et `union.lien`

La fiabilité se note **par lien**, pas seulement par fiche. `fiab` reste celle de la personne (identité et faits) ; chaque lien vers un parent ou un conjoint a la sienne :

```json
"liens": {
  "pere": { "fiab": "B", "preuve": "indirecte", "raisonnement": "Indices… Autre hypothèse écartée… Ce qui manque : …", "src": [8, 12] },
  "mere": { "fiab": "A", "preuve": "directe", "src": [2] }
},
"unions": [ { "conjoint": "…", "date": "…", "preuve": "…", "src": [3], "lien": { "fiab": "A", "preuve": "directe", "src": [3] } } ]
```

- `fiab` : A, B, C ou D. `preuve` : `directe`, `indirecte`, `contredite`, `témoignage` ou `arbre` (définitions et barème : `recherches/METHODE.md`, « Preuve des liens »).
- `raisonnement` : texte (liens `[[id|texte]]` permis) ; **obligatoire** pour `indirecte` et `contredite`.
- `src` : numéros (à partir de 1) des sources de la fiche qui portent le lien.
- `lienParents` (texte libre, facultatif) : sur le site, il n'est pas affiché quand chaque parent a un raisonnement.
- Commande : `node outils/fiche.mjs lien <id> pere|mere|union:<conjoint> '<json>'` (`null` pour retirer ; les valeurs sont contrôlées).
- `verifier.mjs` : avertissement pour un parent sans `liens.<role>` ; erreur pour une valeur invalide, un `src` hors des sources ou un raisonnement manquant ; avertissement « remontée sur lien faible » quand un lien C ou D a des ancêtres au-dessus.
- Site : sous « Filiation avec ses parents », une ligne par parent (pastille, niveau du lien, nature de la preuve, renvois aux sources) et le raisonnement repliable ; dans l'arbre, trait en pointillé pour un lien C ou D. Partages : `liens` est gardé pour les parents du partage ; un raisonnement qui cite une personne hors du partage est remplacé par une mention neutre.
- Un acte : `{ "titre", "source"?, "url" (ou null), "image" ("actes/….jpg"), "douteux"? }`.
- JSON en UTF-8, indentation 2, accents non échappés ; les petits objets et listes tiennent sur une ligne.

## Textes d'une fiche : histoire, chronologie, remarques

Plutôt que des notes en vrac, une fiche a :
- **`chronologie`** : liste de faits datés, dans l'ordre de la vie. Une ligne = `{ "date", "lieu"?, "texte", "src"?: [n] }`, où `n` est le numéro (à partir de 1) d'une source dans `sources`. Mettre `src` seulement si cette source contient vraiment le fait. Date au format libre (`JJ/MM/AAAA`, `MM/AAAA`, `AAAA`, `1901-1910`, `avant le …`).
- **`remarques`** : un court paragraphe pour ce qui n'est pas daté (surnoms, graphies, signature, homonymes, déductions, limites des sources).
- Le récit lisible (« Son histoire ») est dans `recits.js` (`vies`), pas dans la fiche.

Le champ `notes` (texte libre) reste accepté et affiché, mais `chronologie` et `remarques` sont préférables. Ce qui est déjà dans naissance, mariage ou décès n'est repris que s'il y a un détail en plus.

```sh
node outils/fiche.mjs evenement paul_martel '{"date": "1946", "lieu": "Tours", "texte": "Ouvre son atelier de menuiserie."}' --source "Annuaire du commerce d'Indre-et-Loire, 1946, p. 112 (Gallica, …)."
node outils/fiche.mjs remarque paul_martel "Appelé Popol dans la famille."
```

## Format 2 des fiches

Une fiche au format 2 porte `"format": 2` (toute nouvelle fiche doit l'être). Une ancienne fiche se convertit avec `node outils/format2.mjs <id>…`, puis à la main pour ce qui demande de la lecture.
- **`sources`** : des objets `{ texte, nature, archive?, cote?, vue?, url?, images?: [{ titre, image, url? }] }`. La nature vaut `acte` (acte lu), `dossier` (dossier d'archives lu), `index`, `arbre` (arbre en ligne), `presse`, `temoignage`, `ouvrage` ou `autre`. **Il n'y a plus de clé `actes`** : une image d'acte est rattachée à sa source, et la galerie « Actes » du site en est tirée. Pour rattacher une image isolée ou fusionner des doublons : `node outils/format2.mjs --rattacher <id> <cible>:<n>,<n>`. Les renvois de la chronologie sont alors renumérotés.
- **`unions`** : `[{ conjoint, date, tri, lieu, commune, precision, preuve, src? }]`, une entrée par mariage, dans l'ordre. Elle remplace `conjoint`, `mariage` et `lienUnion`. `construire.mjs` reconstitue ces trois champs à partir de la première union, pour le site et le GEDCOM.
- **Dates** (naissance, baptême, décès, inhumation, unions, chronologie) : `date` reste le texte affiché. `tri` (AAAA-MM-JJ, AAAA-MM ou AAAA) sert au tri et aux contrôles, et `qualif` vaut `vers`, `avant`, `après` ou `entre`.
- **Lieux** : `lieu` reste le texte affiché. `commune` est le nom du répertoire `lieux.js`, utilisé par la carte, et `precision` le quartier, la rue ou le hameau.
- **Liens** : `[[id|texte]]` dans la chronologie et les remarques devient un lien vers la fiche.
- Sur le site, les renvois de la chronologie sont **bleus** pour un acte ou un dossier lu, **orange** pour un index, un arbre ou une autre source indirecte. Les sources portent une étiquette de nature.

`fiche.mjs` connaît le format 2 : `source` ajoute un objet, `acte` rattache l'image à la source de même texte (ou en crée une), et `evenement --source` numérote correctement.

## Modifier une fiche

Avec l'outil (recommandé, il range les clés et écrit un JSON propre) :

```sh
node outils/fiche.mjs voir paul_martel
node outils/fiche.mjs chercher martel
node outils/fiche.mjs note paul_martel "Texte ajouté à la fin des notes."
node outils/fiche.mjs source paul_martel "Acte de …, AD Indre-et-Loire, cote …" [--debut]
node outils/fiche.mjs piste paul_martel "…"
node outils/fiche.mjs averifier paul_martel "…"
node outils/fiche.mjs definir paul_martel deces.lieu "Chinon (Indre-et-Loire)"
node outils/fiche.mjs definir paul_martel domaines '["sante"]'      # valeur JSON si valide, sinon texte
node outils/fiche.mjs retirer paul_martel lienUnion
node outils/fiche.mjs acte paul_martel,louise_bertin '{"titre": "Mariage, Tours, 1947", "url": null, "image": "actes/1947-tours-mariage-martel-bertin.jpg"}'
node outils/fiche.mjs nouvelle martel_jean_1890 '{"prenoms": "Jean", "nom": "MARTEL", "sexe": "M", "fiab": "A", "sources": ["…"]}'
```

Ajouter `--construire` à la dernière commande (ou lancer `node outils/construire.mjs`) pour régénérer `famille.js` et `actes.js`.
On peut aussi éditer les JSON à la main. Dans les deux cas : `node outils/construire.mjs`, `node outils/verifier.mjs`,
puis commit de `data/` seulement : `famille.js` et `actes.js` ne sont pas versionnés (`.gitignore`). `verifier.mjs` et `outils/site.sh` les régénèrent ; en local, `node outils/construire.mjs` avant d'ouvrir le site.

Ne jamais modifier `famille.js` à la main : il est réécrit à chaque construction.

## Construire

```sh
node outils/construire.mjs              # data/ → famille.js, actes.js
node outils/construire.mjs --verifier   # échoue si famille.js / actes.js locaux ne correspondent pas à data/
```

`outils/site.sh` lance la construction avant de préparer le site à publier (`public/`).
