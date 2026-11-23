# Gabarit d'arbre généalogique

Un modèle pour construire l'arbre de votre famille, avec l'aide de Claude Code.

## Ce que c'est

- **Un site web** simple, sans base de données. Il montre l'arbre, une carte, une frise, les fiches, des récits et la liste des recherches à faire.
- **Une fiche par personne**, dans un fichier JSON (`data/personnes/<id>.json`). Git garde l'historique de chaque modification.
- **Des outils** en Node.js et Python, dans `outils/` : créer et modifier les fiches, contrôler les données, lire certains sites d'archives, publier.
- **Une méthode de recherche** écrite pour Claude Code et pour ses agents : `recherches/METHODE.md` et `recherches/CONSIGNES-RECHERCHE.md`.
- **Des partages** : des versions réduites du site, une par branche de la famille, où les personnes vivantes sont masquées. La famille peut y laisser des commentaires.
- **Un hébergement Cloudflare** : un Worker sert le site, les images sont dans un bucket R2, l'accès est protégé par Cloudflare Access.

Le dépôt contient **3 personnes fictives** (Jeanne, Paul et Louise Martel). Elles servent d'exemple : remplacez-les par votre famille.

## Démarrer

### 1. Récupérer le gabarit

```bash
git clone https://github.com/<compte>/genealogie-template.git mon-arbre
```

```bash
cd mon-arbre && npm install
```

Il faut Node.js 22 (ou plus récent) et Python 3. Gardez votre dépôt **privé** : il contiendra des données sur votre famille.

### 2. Créer sa première fiche

Choisissez un identifiant court en minuscules, par exemple `dupont_marie`. Puis :

```bash
node outils/fiche.mjs nouvelle dupont_marie '{"format": 2, "prenoms": "Marie", "nom": "DUPONT", "sexe": "F", "fiab": "B", "sources": [{"texte": "Témoignage de Marie Dupont, 01/02/2027.", "nature": "temoignage"}]}'
```

Ensuite :
- dans `data/meta.json`, mettez `dupont_marie` comme `racine` (la personne au centre de l'arbre) ; `fiche.mjs` l'a déjà ajoutée à la liste `ordre` ;
- supprimez les fiches d'exemple (`data/personnes/jeanne_martel.json`, `paul_martel.json`, `louise_bertin.json`) et retirez-les de `ordre` ;
- remplacez les exemples de `recits.js`, `lieux.js` (vos communes et leurs coordonnées) et `partages.json`.

Puis, à chaque modification :

```bash
node outils/construire.mjs
```

```bash
node outils/verifier.mjs
```

Pour voir le site en local : `python3 -m http.server 8000`, puis ouvrir `http://localhost:8000`.

Toutes les commandes de `fiche.mjs` (ajouter une source, un événement, un parent, un lien de parenté…) sont dans `outils/DONNEES.md`.

### 3. Configurer Cloudflare (pour mettre le site en ligne)

Vous pouvez d'abord tout faire en local et ne mettre en ligne que plus tard.

1. Créez un compte Cloudflare (l'offre gratuite suffit pour commencer).
2. Créez un bucket **R2** pour les images (par exemple `mon-arbre-images`).
3. Dans `cloudflare.config.ts`, remplacez `mon-arbre` (nom du Worker) et `mon-arbre-images` (nom du bucket).
4. Dans votre terminal, définissez deux variables (jamais dans un fichier du dépôt) :
   - `CLOUDFLARE_ACCOUNT_ID` : l'identifiant de votre compte ;
   - `CLOUDFLARE_API_TOKEN` : un jeton API (modèle « Edit Cloudflare Workers », plus l'accès R2 en lecture et écriture).
5. Envoyez les images : `node outils/r2.mjs envoyer`.
6. Déployez : `sh deployer.sh`.
7. Protégez le site avec **Cloudflare Access** (Zero Trust), puis remplissez `partages.json` (`equipeAccess`, `administrateurs`, identifiants AUD). Le pas à pas est dans `outils/PARTAGES.md`.

Pour déployer depuis GitHub (fichier `.github/workflows/deploy.yml`) : ajoutez le secret `CLOUDFLARE_API_TOKEN` et la variable `CLOUDFLARE_ACCOUNT_ID` dans les réglages du dépôt (Settings → Secrets and variables → Actions).

### 4. Lancer Claude Code

Ouvrez Claude Code dans le dossier du dépôt. Il lit `CLAUDE.md`, qui lui donne les règles du projet.

1. Dans `CLAUDE.md`, remplacez `<Prénom Nom>` par la personne au centre de l'arbre, et précisez le périmètre.
2. Demandez-lui par exemple : « Ajoute mes parents à l'arbre », puis « Cherche l'acte de naissance de mon grand-père ».
3. Deux skills sont fournis dans `.claude/skills/` :
   - `backlog` : suivre le travail dans les tickets GitHub du dépôt ;
   - `commentaires` : traiter les commentaires laissés par la famille sur les partages.

## La méthode

Elle est détaillée dans `recherches/METHODE.md`. L'essentiel :

**Des sources pour tout.** Chaque fait cite sa source précise : le service d'archives, la cote du registre, le numéro de vue, la date de l'acte. Une image de l'acte est gardée quand c'est possible. On ne devine rien : une déduction est dite comme telle, avec son raisonnement.

**Quatre niveaux de fiabilité**, pour chaque fiche et pour chaque lien de parenté :
- **A** : acte lu ;
- **B** : déduit de plusieurs indices, ou témoignage de la famille ;
- **C** : arbre ou index en ligne, pas encore vérifié sur l'acte ;
- **D** : douteux, ou des sources qui se contredisent.

On ne cherche pas les parents de quelqu'un tant que le lien qui mène à lui est en C ou D : il faut d'abord le prouver.

**La relecture à l'aveugle.** Quand un lien ajoute une génération, une seconde recherche relit l'acte **sans voir la première lecture**. Si les deux lectures concordent, le lien est confirmé. Sinon, il reste douteux et la question est notée.

**Un journal.** `recherches/JOURNAL.md` donne l'état des sites d'archives (ouverts, fermés, protégés). Chaque région a son fichier dans `recherches/journal/` (modèle : `MODELE-REGION.md`) : ce qui a été cherché, ce qui n'a rien donné, ce qui reste à lire. On ne refait pas deux fois la même recherche.

**Respect des sites.** On ne contourne jamais une protection anti-robots : ces recherches se font à la main, dans le navigateur. Les demandes par courrier sont un dernier recours.

**Respect des vivants.** Pas de recherche en ligne sur les personnes vivantes ; elles sont masquées dans les partages.

## Mettre à jour depuis le projet d'origine

Ce gabarit vient d'un arbre réel, tenu dans un dépôt privé. Quand les outils ou la méthode de ce projet évoluent, `outils/gabarit.sh` reprend ces changements dans le gabarit, **sans jamais reprendre de données de famille**. Cette section ne sert qu'au mainteneur du gabarit. Si vous partez du gabarit pour votre propre arbre, vous pouvez l'ignorer.

```bash
sh outils/gabarit.sh ../chemin/du/depot-prive --essai
```

```bash
sh outils/gabarit.sh ../chemin/du/depot-prive
```

La première commande montre ce qui changerait, sans rien commiter. La seconde fait la synchronisation et un commit local. **Le script ne pousse jamais** : on relit le diff, puis on pousse soi-même.

**Ce que fait le script**
1. Il lit `outils/gabarit.base` : le commit du dépôt privé dont le gabarit est issu.
2. Il cherche les fichiers changés depuis ce commit et les classe avec `outils/gabarit.liste` :
   - `+` : fichiers génériques (outils, leurs docs, méthode, site, Worker, skills, workflows). Ils sont repris ;
   - `=` : fichiers rendus génériques à la main (`CLAUDE.md`, `cloudflare.config.ts`, `partages.json`, `vues.js`, `lieux.js`, `recits.js`…). Ils ne sont jamais copiés : le script dit seulement qu'ils ont changé ;
   - `-` : fichiers propres au projet d'origine, ignorés.
   Les données (fiches, actes, journaux régionaux, lectures, courriers) ne sont jamais lues. Un fichier qu'aucune règle ne couvre est signalé « non classé ».
3. Pour chaque fichier `+`, il **rejoue le changement** du dépôt privé sur la version du gabarit (fusion à trois voies). Les adaptations déjà faites dans le gabarit sont gardées.
4. Il applique les remplacements de `outils/gabarit.local` (noms réels → valeurs génériques). Ce fichier n'est **jamais versionné**. Modèle : `outils/gabarit.local.exemple`.
5. Il **cherche les fuites** dans les fichiers repris. Il lit les noms à chercher dans le dépôt privé, au moment de la synchro, pour qu'ils ne soient jamais écrits dans le gabarit :
   - les noms de famille de toutes les fiches ;
   - le prénom et le nom de la racine ;
   - les noms des partages ;
   - les e-mails ;
   - les identifiants Cloudflare ;
   - le compte GitHub.
6. Il lance `construire.mjs`, `verifier.mjs` et les tests du Worker sur les fiches fictives.
7. Il affiche le diff et fait un commit local, avec `outils/gabarit.base` mis à jour.

Tout se passe dans un dossier de travail temporaire : **en cas de fuite, de conflit ou de contrôle en échec, le script s'arrête et le gabarit n'est pas touché**.

**En cas d'arrêt**
- *Fuite* : ajouter un remplacement dans `outils/gabarit.local`, puis relancer. Si c'est un mot courant (un nom de famille qui est aussi un mot, comme « boulanger »), ajouter `? boulanger` dans ce même fichier.
- *Conflit* (le même passage a changé des deux côtés) : reporter le changement à la main dans le gabarit et commiter. Relancer ensuite avec `--resolu <fichier>`.
- `--garder` laisse le dossier de travail temporaire en place, pour regarder ce qui bloque.

## Organisation du dépôt

| Dossier ou fichier | Contenu |
|---|---|
| `data/` | Les fiches (`personnes/`) et l'ordre de l'arbre (`meta.json`) |
| `index.html`, `vues.js`, `lieux.js`, `recits.js` | Le site |
| `outils/` | Les scripts et leur documentation (`README.md`, `DONNEES.md`, `PARTAGES.md`) |
| `recherches/` | La méthode, les consignes, le journal, les registres déjà lus |
| `courriers/` | Les demandes hors ligne |
| `worker/` | Le Worker Cloudflare (site, images, commentaires) |
| `partages.json` | Les versions réduites du site, par branche |
| `outils/gabarit.*` | La synchronisation avec le projet d'origine (voir plus haut) |

Les images (actes, photos, lieux) ne sont pas dans git : elles sont dans le bucket R2.
