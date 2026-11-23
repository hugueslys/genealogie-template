# Méthode de recherche et d'ajout de données

Ce document dit **comment** chercher et comment ajouter un résultat à l'arbre. Il sert à une future session de Claude ou à un agent de recherche.

Il ne dit pas **où on en est**. Pour cela :
- `recherches/JOURNAL.md` : index court, l'état des sites d'archives et la liste des fichiers régionaux ;
- `recherches/journal/<région>.md` : pour une région, les recherches faites, ce qui est épuisé en ligne, les pistes infructueuses, le plan de lecture ;
- les tickets GitHub (skill `backlog`) : ce qu'il faut faire, qui le fait, où on en est ;
- `courriers/DEMANDES.md` : les demandes hors ligne.

Les scripts sont dans `outils/` (liste dans `outils/README.md`).

---

## 1. Avant de chercher

1. Trouver le ticket du chantier, ou le créer. Le passer « En cours », avec un commentaire d'une ligne (skill `backlog`).
2. Lire `recherches/JOURNAL.md` (index : le site est-il ouvert ?), puis seulement le fichier de sa région dans `recherches/journal/` : la recherche a-t-elle déjà été faite ? Est-ce « épuisé en ligne » ? Y a-t-il un plan de lecture prêt ?
3. Lire les fiches des personnes visées : `notes`, `pistes`, `aVerifier`, `sources`, `lienParents`, `lienUnion`.

### Lire une fiche

Les fiches sont dans `data/personnes/<id>.json`, une par personne, actes compris (voir `outils/DONNEES.md`).

```bash
node outils/fiche.mjs voir paul_martel        # fiche complète
node outils/fiche.mjs chercher Bertin         # trouver un identifiant
```

On peut aussi ouvrir directement le JSON. `famille.js` et `actes.js` sont **générés** : on ne les lit pas et on ne les modifie pas.

---

## 2. Règles de qualité

- **Ne rien inventer.** Chaque fait ajouté cite sa source précise : archive, cote ou registre, numéro de vue, date de l'acte. Et, si possible, une capture de l'acte dans `actes/`.
- **Dire d'où vient l'information.** Trois cas, à ne pas mélanger :
  - acte lu : c'est une preuve ;
  - index ou arbre en ligne : ce n'est pas une preuve, il faut le dire ;
  - déduction : la dire comme telle, avec le raisonnement.
- **Niveaux `fiab`** :
  - **A** : acte lu ;
  - **B** : déduit, ou acte lu en partie (lecture incertaine) ;
  - **C** : arbre ou index en ligne, non vérifié ;
  - **D** : douteux.
- **Homonymes.** Vérifier la cohérence : âges, lieux, conjoints, parrains et témoins. Dans un village, plusieurs personnes portent souvent le même nom (exemple : deux Jean Martel pères de famille dans la même paroisse, à dix ans d'écart).
- **Pistes ou filiation.** En cas de doute, l'information va dans `pistes` ou `aVerifier`, **pas** dans `pere`, `mere` ou `conjoint`. Une filiation (`pere`, `mere`) s'appuie sur un acte, cité dans `lienParents`, et sa preuve est notée dans `liens` (voir « Preuve des liens » ci-dessous).
- **Lectures incertaines.** Les signaler : « (lecture incertaine) », « Morel ou Merel ».
- **Style.** Français simple, phrases courtes. Dans les notes, les dates en toutes lettres (« le 12 avril 1763 »). Dans les champs `naissance.date`, `deces.date`, `mariage.date` : `JJ/MM/AAAA`.
- **Ce qui n'a rien donné compte aussi.** Le noter dans le journal (registre, période, résultat), pour ne pas le refaire.

### Preuve des liens

Le `fiab` d'une fiche juge **la personne** (son identité, ses dates, ses faits). Chaque **lien de parenté** a sa propre note, dans `liens.pere`, `liens.mere` et `unions[…].lien` (format : `outils/DONNEES.md`, « Liens de parenté »). On suit le standard de preuve des généalogistes (Genealogical Proof Standard) : recherche raisonnablement complète, sources citées, analyse, conflits résolus, conclusion écrite.

- **Nature de la preuve** (`preuve`) :
  - `directe` : une source lue dit le lien en toutes lettres. **A** si c'est le baptême, la naissance ou le mariage de la personne elle-même ; **B** si c'est son décès, un recensement, l'acte d'un proche (« aïeul du baptisé », « fils du feu Jean ») ou une publication (arrêt, presse) ;
  - `indirecte` : aucune source ne dit le lien, il est déduit de plusieurs indices (même maison, prénoms, parrains et témoins, âges, unicité dans le registre). **B**, ou **D** si les indices sont faibles ;
  - `témoignage` : la famille l'a dit (**B**) ;
  - `arbre` : arbre en ligne ou index (relevé) non relu sur l'image (**C**) ;
  - `contredite` : des sources se contredisent (deux noms de mère, deux couples possibles) (**D**).
- **Raisonnement écrit** : obligatoire pour `indirecte` et `contredite` (`verifier.mjs` le refuse sinon), utile pour tout B ou D. Trois à six phrases : les indices, avec leurs sources ; les autres hypothèses et pourquoi elles sont écartées (homonymes, autre couple du même nom) ; ce qui manque pour conclure (« Ce qui manque : son acte de naissance »). Rien d'inventé : seulement ce que disent les sources de la fiche.
- **On ne remonte pas au-dessus d'un lien non confirmé.** Si le lien d'une personne vers un parent est C ou D, on ne cherche pas (et on n'ajoute pas) les ancêtres de ce parent tant que le lien n'est pas relevé à A ou B : il faut d'abord lire l'acte qui le prouve. `verifier.mjs` signale ces cas (« remontée sur lien faible »), sauf quand un autre enfant de ce parent, relié par un lien A ou B, justifie la remontée.
- **Relecture d'un lien qui fait monter d'une génération.** Avant d'ajouter des parents (nouvelle génération), le lien est relu par une **seconde recherche indépendante** : un autre agent (ou une autre session) lit l'acte cité, sans voir la première lecture ni la fiche, et note ce qu'il y lit (nom de l'enfant, des parents, date, lieu). On compare : si les deux lectures concordent, le lien peut être A ou B ; sinon, il reste C ou D, avec un raisonnement `contredite`.
- **Commandes** : `node outils/fiche.mjs lien <id> pere|mere|union:<conjoint> '{"fiab": "A", "preuve": "directe", "src": [2]}'` ; `null` à la place du JSON retire le lien. `lienParents` (texte libre) est facultatif ; un raisonnement peut le reprendre.

---

## 3. Format des données

Source de vérité : le dossier `data/`. Le détail est dans `outils/DONNEES.md`. On ne modifie jamais `famille.js` ni `actes.js` à la main : ils sont générés.

**Modifier avec `outils/fiche.mjs`**, qui range les clés et écrit un JSON propre :

```bash
node outils/fiche.mjs evenement paul_martel '{"date": "1946", "lieu": "Tours", "texte": "Ouvre son atelier de menuiserie."}'
node outils/fiche.mjs source paul_martel "Mariage Martel × Bertin, Tours, 12 avril 1947 (registre …, vue …). Archives départementales d'Indre-et-Loire." --debut
node outils/fiche.mjs piste paul_martel "Texte de la piste, avec sa source."
node outils/fiche.mjs averifier louise_bertin "…"
node outils/fiche.mjs definir paul_martel naissance '{"date": "14/02/1921", "lieu": "Chinon (Indre-et-Loire)"}'
node outils/fiche.mjs definir enfant_id pere nouvel_id
node outils/fiche.mjs definir enfant_id lienParents "Citation de l'acte qui prouve la filiation."
node outils/fiche.mjs nouvelle nouvel_id '{"prenoms": "…", "nom": "NOM", "sexe": "M", "fiab": "A", "fiabNote": "…", "sources": ["…"]}'
node outils/fiche.mjs acte id1,id2 '{"titre": "Mariage de X et Y, Commune, 17 juin 1733 (AD …, …, vue 72)", "url": "https://…", "image": "actes/1733-commune-mariage-x-y.jpg"}' --construire
```

Ensuite, toujours : `node outils/construire.mjs`, puis `node outils/verifier.mjs` (aucune ERREUR), puis commit de `data/` seulement (`famille.js` et `actes.js` sont générés et ne sont pas versionnés).

- **Identifiants** : minuscules, `nom_prenom` court (`martel_jean`, `bertin_ml`), uniques. Vérifier avant qu'ils n'existent pas (`fiche.mjs chercher`).
- **Mariage** : il est recopié dans la fiche de **chacun des deux époux**. On met à jour les deux.
- **Lieux** : une commune absente du répertoire s'ajoute à `lieux.js` (coordonnées et région).

## 4. Réseau et sites

- L'état de chaque site (ouvert, fermé, protégé, compte requis) est dans le **journal**, section 1. Le lire avant, le mettre à jour après.
- Envoyer un **User-Agent de navigateur**. Sans lui, beaucoup de sites renvoient 403 :
  `curl -sL -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36" …`
  Les scripts de `outils/` le font déjà.
- **Ne jamais contourner une protection anti-robots** (Cloudflare, Anubis, page « requires JS enabled and cookies »). On s'arrête, on note le blocage dans le journal, et la recherche passe dans un ticket `navigateur` : le responsable de l'arbre la fait dans son navigateur, ou Claude dans ce navigateur, avec lui ou elle.
- Si le proxy d'une session refuse un hôte (403 au CONNECT, message `[agent-proxy]`), noter le nom exact de l'hôte et passer à autre chose.
- Playwright (installé dans les sessions cloud) sert aux visionneuses en JavaScript, pas à passer une protection.
- Taille des images : demander une taille raisonnable (Antenati : 1600 px de large). La taille maximale déclenche parfois une protection.

### Demandes hors ligne

Courriel, courrier, formulaire, déplacement : **dernier recours**. Seulement si la source n'est pas et ne sera pas en ligne. Si un site est fermé pour un temps, on attend. Suivi dans `courriers/DEMANDES.md`.

---

## 5. Recherche en parallèle (plusieurs agents)

Quand plusieurs branches de l'arbre sont cherchées en même temps, chaque agent travaille sur une branche, **dans son propre worktree** (`isolation: worktree`), créé à partir de la branche de travail. Une fiche par fichier, donc les conflits sont rares.

### Avant de lancer (économiser le temps et les tokens)

- **Tester les sites de la branche** : `node outils/sites.mjs --branche <branche>` (quelques secondes), puis lire l'état des sources dans le journal. Pas d'agent sur un site fermé ou protégé : la recherche va dans un ticket `navigateur`.
- **Des missions petites et ciblées** : un couple, un registre, une liste courte d'actes. Une mission trop large sature le contexte de l'agent avant la fin.
- **Viser avant de lire** : tables décennales, index des noms, marges. En priorité le **mariage**, qui nomme les quatre parents.
- **Un modèle léger pour feuilleter** les registres et repérer l'acte. Le modèle principal ne sert qu'à lire l'acte trouvé et à vérifier une filiation.
- **Ne jamais relire une page** : consulter d'abord `recherches/lectures/` (voir section 6), et y noter chaque vue lue.

### Consignes aux agents

- Travailler dans son worktree. Ne modifier que `data/`, `lieux.js`, `actes/` et `recherches/` (journal, lectures), avec `outils/fiche.mjs`.
- Faire un commit dans le worktree, avec le n° de ticket. Ne pas pousser.
- Écrire un `RAPPORT.md` hors du dépôt : ce qui a été trouvé, ce qui n'a pas pu être lu et pourquoi, les recherches sans résultat, les pistes restantes.
- Relever aussi les **gens autour de l'acte** (frères et sœurs, parrains, témoins) : ils confirment les liens et aident à départager les homonymes.
- Suivre les règles de qualité (section 2) et de réseau (section 4). Un acte bien lu vaut mieux que trois hypothèses.

### Intégration par l'agent principal

1. Lire le rapport.
2. **Vérifier chaque nouvelle filiation sur l'image.** Corriger si la lecture diffère. Rétrograder en piste ce qui n'est pas prouvé.
3. Fusionner la branche du worktree, lancer `node outils/construire.mjs --verifier` et `node outils/verifier.mjs` (aucune ERREUR). `sh outils/fusionner.sh <branche> "<message>"` le fait et résout les conflits mécaniques (journal, ordre des fiches). Les vrais conflits ne peuvent être que dans `data/`.
4. Mettre à jour le fichier régional `recherches/journal/<région>.md` (historique : ✅ trouvé, ❌ rien, ⏸ bloqué ; résumé, « Épuisé en ligne », plan) et, si besoin, la ligne du site dans `recherches/JOURNAL.md`, pousser, puis commenter le ticket : « Fait dans <sha> ».
5. Ce qui reste à faire dans un navigateur ou avec un compte : ticket `navigateur`, et la liste dans le journal.

## 6. Après la recherche

- Journal à jour (section 5, « Intégration », étape 4).
- Ticket commenté ; fermé si tout est fait.
- Rien d'important ne reste seulement dans la session : tout est dans une fiche, le journal ou un ticket.


## Périmètre (à fixer par le responsable de l'arbre)
Exemple : on reste sur l'ascendance de <Prénom Nom> (côté paternel et côté maternel), leurs frères et sœurs, et leurs descendants. Pas de recherche sur l'ascendance des conjoints des collatéraux (alliances) : au plus leurs parents en remarque sur la fiche du conjoint, sans fiche.

## Relecture des liens
Tout lien père / mère qui fait **monter d'une génération** est relu par une seconde recherche avant d'être tenu pour acquis :
1. `node outils/relecture.mjs --depuis <ref git>` liste les liens ajoutés ou changés depuis une référence, avec leur source.
2. La recherche de relecture ouvre l'acte (image dans `actes/` ou en ligne) **sans lire d'abord la fiche ni la lecture précédente**, note ce qu'elle lit (nom, prénoms, parents, date, lieu), puis compare.
3. Accord : on ajoute `"relu": "AAAA-MM-JJ"` au lien. Désaccord : le lien passe en `contredite` (fiab D), avec les deux lectures dans le raisonnement, et la question va dans `aVerifier`.
4. Les autres faits A sont relus par sondage (un sur dix environ, choisis au hasard).
Les consignes communes de toutes les recherches sont dans `recherches/CONSIGNES-RECHERCHE.md`.
