# Gabarit d'arbre généalogique

Un modèle pour construire l'arbre de votre famille, avec l'aide de Claude Code.

## Ce que c'est

- **Un site web** simple, sans base de données. Il montre l'arbre, une carte, une frise, les fiches, des récits et la liste des recherches à faire.
- **Une fiche par personne**, dans un fichier JSON (`data/personnes/<id>.json`). Git garde l'historique de chaque modification.
- **Des outils** en Node.js et Python, dans `outils/` : créer et modifier les fiches, contrôler les données, lire certains sites d'archives, publier.
- **Une méthode de recherche** écrite pour Claude Code et pour ses agents : `recherches/METHODE.md` et `recherches/CONSIGNES-RECHERCHE.md`.
- **Des partages** : des versions réduites du site, une par branche de la famille, où les personnes vivantes sont masquées.

Le dépôt contient **3 personnes fictives** (Jeanne, Paul et Louise Martel), pour voir à quoi ressemble un arbre. Claude les retire au démarrage.

## Démarrer

Tout se fait en parlant à Claude Code : pas de commande à taper, pas de fichier à remplir.

1. **Copiez le gabarit** : sur GitHub, bouton « Use this template » pour créer votre propre dépôt, **privé** (il contiendra des données sur votre famille). Ou demandez à Claude Code de le cloner pour vous.
2. **Ouvrez Claude Code** dans le dossier (application Claude, onglet Code, ou `claude` dans un terminal).
3. **Dites-lui : « Démarre mon arbre. »**

Claude lance le skill `demarrer` :
- il vérifie que l'ordinateur a ce qu'il faut (Node.js et Python) ;
- il vous pose des questions simples, une à la fois : vous, vos parents, vos grands-parents, ce que vous savez au-delà ;
- il crée les fiches, avec la source de chaque information (votre témoignage, un livret de famille…) ;
- il retire les personnes d'exemple et adapte le projet à votre famille ;
- il vous montre l'arbre dans le navigateur, puis propose les premières recherches.

## Ensuite, au quotidien

Demandez simplement ce que vous voulez, par exemple :
- « Cherche l'acte de naissance de mon grand-père. »
- « Qui manque dans l'arbre, et où peut-on chercher ? »
- « Voici la photo du livret de famille de mes grands-parents : ajoute ce qu'il contient. »
- « Écris le récit de la branche de ma mère. »
- « Prépare une version de l'arbre à montrer à mes cousins, sans les personnes vivantes. »

Claude suit la méthode du dépôt (ci-dessous). Il note tout ce qu'il cherche dans un journal, pour ne jamais refaire deux fois la même recherche. Il vous dit ce qu'il ne peut pas faire seul : un site d'archives protégé contre les robots, un compte à créer, un document à demander par courrier.

## Mettre le site en ligne (facultatif)

Demandez à Claude : « Prépare le site pour le mettre en ligne. » Il prépare tout dans un dossier `public/` : le site, les images, un fichier GEDCOM (lisible par Geneanet, Gramps, Heredis…) et un dossier par partage.

Le choix de l'hébergement vous appartient. Claude peut vous aider à le mettre en place chez l'hébergeur de votre choix. Une règle : **protégez l'accès** (mot de passe ou authentification), car le site contient des données de famille.

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
   - `+` : fichiers génériques (outils, leurs docs, méthode, site, skills, workflows). Ils sont repris ;
   - `=` : fichiers rendus génériques à la main (`CLAUDE.md`, `partages.json`, `package.json`, `vues.js`, `lieux.js`, `recits.js`…). Ils ne sont jamais copiés : le script dit seulement qu'ils ont changé ;
   - `-` : fichiers propres au projet d'origine, ignorés (dont tout ce qui concerne son hébergement).
   Les données (fiches, actes, journaux régionaux, lectures, courriers) ne sont jamais lues. Un fichier qu'aucune règle ne couvre est signalé « non classé ».
3. Pour chaque fichier `+`, il **rejoue le changement** du dépôt privé sur la version du gabarit (fusion à trois voies). Les adaptations déjà faites dans le gabarit sont gardées.
4. Il applique les remplacements de `outils/gabarit.local` (noms réels → valeurs génériques). Ce fichier n'est **jamais versionné**. Modèle : `outils/gabarit.local.exemple`.
5. Il refuse aussi les mentions de l'hébergement du projet d'origine (termes `!` de `outils/gabarit.liste`) : ce gabarit n'impose aucun hébergeur.
6. Il **cherche les fuites** dans les fichiers repris. Il lit les noms à chercher dans le dépôt privé, au moment de la synchro, pour qu'ils ne soient jamais écrits dans le gabarit :
   - les noms de famille de toutes les fiches ;
   - le prénom et le nom de la racine ;
   - les noms des partages ;
   - les e-mails ;
   - les identifiants techniques de son hébergement ;
   - le compte GitHub.
7. Il lance `construire.mjs` et `verifier.mjs` sur les fiches fictives.
8. Il affiche le diff et fait un commit local, avec `outils/gabarit.base` mis à jour.

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
| `actes/`, `lieux/`, `photos/` | Les images (à créer au premier ajout) |
| `courriers/` | Les demandes hors ligne |
| `partages.json` | Les versions réduites du site, par branche |
| `.claude/skills/` | Les skills de Claude : `demarrer` (mise en route), `backlog` (suivi dans les tickets GitHub) |
| `outils/gabarit.*` | La synchronisation avec le projet d'origine (voir plus haut) |

