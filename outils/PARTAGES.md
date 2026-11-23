# Partages : une version réduite du site par branche de famille

Un **partage** est une copie du site limitée à une partie de l'arbre, pour la montrer à un côté de la famille sans
exposer le reste. Les personnes vivantes y sont masquées. Le site complet, à la racine, ne change pas.

- Définition : `partages.json`, à la racine du dépôt.
- Production : `node outils/partager.mjs`, lancé par `outils/site.sh` après la construction. Il écrit `public/partage/<nom>/`,
  à publier sous `/partage/<nom>/`.
- Contrôle : après chaque production, le script vérifie qu'aucune donnée hors périmètre n'est restée dans les fichiers.
  Au moindre problème, il échoue (code 1) et bloque la préparation du site (voir « Contrôle » plus bas).

```sh
node outils/partager.mjs --liste                    # personnes de chaque partage (vivants signalés), sans rien écrire
node outils/partager.mjs                            # tous les partages → public/partage/<nom>/
node outils/partager.mjs martel --sortie /tmp/p     # un seul partage, dans un autre dossier
```

## Ajouter un partage

Il suffit d'ajouter une ligne dans `partages.json` :

```json
{ "nom": "bertin", "titre": "Les Bertin de Chinon", "racine": "louise_bertin",
  "perimetre": { "ancetresDe": ["louise_bertin"], "descendantsDesAncetres": true, "conjoints": true },
  "note": "Pour qui, et pourquoi." }
```

- `nom` : nom du dossier et de l'adresse (`/partage/bertin/`). Lettres minuscules, chiffres et tirets.
- `titre` : affiché dans l'onglet du navigateur (« Arbre généalogique · … »).
- `racine` : personne centrale de l'arbre. Elle doit faire partie du périmètre. Si son conjoint a des parents connus,
  la bascule « Lui / Elle / Les deux » s'affiche.
- `perimetre` : les règles s'appliquent dans l'ordre suivant.

| Clé | Effet |
|---|---|
| `ancetresDe: [ids]` | ces personnes et tous leurs ancêtres |
| `descendantsDe: [ids]` | ces personnes et tous leurs descendants |
| `descendantsDesAncetres: true` | tous les descendants de chaque ancêtre trouvé : frères et sœurs, oncles, cousins… |
| `personnes: [ids]` | personnes ajoutées une à une (ex. un collatéral sans lien de filiation dans l'arbre) |
| `conjoints: true` | ajoute les conjoints de toutes les personnes retenues, sur un seul niveau (pas leurs parents) |
| `exclure: [ids]` | personnes retirées à la fin, quoi qu'il arrive |

Vérifier ensuite la liste avec `--liste`, puis mettre en place l'accès chez votre hébergeur (voir plus bas).

## Ce que contient un partage

- `famille.js`, `actes.js` : seulement les personnes du périmètre. Les liens `pere`, `mere`, `conjoint` et `unions` vers
  une personne exclue sont retirés, ainsi que la filiation (`lienParents`) quand aucun parent n'est gardé. Dans la
  chronologie et les remarques, les liens `[[id|texte]]` vers une personne exclue deviennent du texte simple.
- `recits.js` : les vies et les époques des personnes gardées et non vivantes. Un récit de branche n'est gardé que si
  plus de la moitié des personnes qu'il cite est dans le périmètre. Ses liens vers des personnes exclues deviennent du
  texte simple : le nom reste donc lisible dans le récit.
- `vues.js` : les lieux de vie des personnes gardées et non vivantes.
- `lieux.js` : le répertoire des communes (`FAMILLE_LIEUX`) et les régions (`FAMILLE_REGIONS`), réduits aux communes
  que le partage utilise. Une commune est gardée si son nom figure dans les données du partage (lieux, notes, récits,
  titres des vues), ou si elle est la plus proche d'un repère de lieu de vie, comme dans le calcul de la carte. Les
  lieux des vivants n'y figurent donc pas.
- Images : seules celles qu'utilise ce qui reste (actes, photos, lieux de vie, images des récits), copiées dans le dossier du partage.
- `arbre.ged` : le GEDCOM du partage, produit par `gedcom.mjs` (`versGedcom`).
- `index.html` : le même que le site complet, avec un titre adapté.

**Option `racines`** (dans `partages.json`, par partage) : personnes de départ de l'arbre, chacune `"id"` (colonne 0) ou `{ "id": …, "colonne": n }` (0 = génération la plus jeune). Exemple : pour un partage destiné à des cousins, les enfants des cousins en colonne 0 et les cousins eux-mêmes en colonne 1 ; leurs parents viennent alors d'eux-mêmes. La racine (`racine`) se place dans sa colonne, son conjoint sous elle ; les plus jeunes à hauteur de leurs parents ; les oncles et tantes à côté de leurs enfants. À l'ouverture, l'arbre montre la première colonne. Seuls les ascendants de la racine comptent pour les « ancêtres communs ».

## Personnes vivantes : règle de masquage

**Option `vivantsVisibles: true`** (dans `partages.json`, par partage) : aucune personne n'est masquée, les vivants figurent avec toute leur fiche. À n'utiliser qu'avec l'accord des personnes vivantes concernées. Sans cette option, la règle ci-dessous s'applique.

Une personne est considérée comme **vivante** si aucun décès ni aucune inhumation n'est connu, et si l'une de ces
conditions est remplie :
- elle est née il y a moins de 100 ans ;
- elle n'a pas de date de naissance, mais un de ses parents est né après 1900 ;
- un de ses enfants est né après 1940 ;
- par prudence : elle n'a aucune date et un de ses conjoints est considéré comme vivant.

D'une personne vivante, on ne garde que `prenoms`, `nom`, `nomNaissance`, `sexe`, les liens de famille (père, mère,
conjoints, sans date ni lieu de mariage) et `vivant: true`. Tout le reste est retiré : dates, lieux, métier,
chronologie, remarques, notes, sources, actes, pistes, points à vérifier, photo, récit, lieux de vie. Sur sa fiche,
le site affiche « Personne vivante : informations masquées ». Le site complet n'a jamais ce champ et ne change pas.

Cas limites : `--liste` signale les vivants et la raison du masquage. Une personne née avant 1926 sans décès connu
n'est **pas** masquée. Pour en masquer une à la main, la retirer avec `exclure`, ou ajouter son décès à sa fiche
s'il est connu.

## Contrôle (automatique, à chaque production)

Dans tous les fichiers texte du partage (`.js`, `.html`, `.ged`, manifeste), le script cherche :
1. les identifiants des personnes exclues (`"id"` ou `[[id|`) ;
2. leurs noms complets (prénoms et nom, sans tenir compte des accents ni des majuscules), sauf quand une personne
   gardée porte exactement le même nom (homonyme, signalé comme « avis ») ;
3. pour chaque vivant : un champ non autorisé, des actes, des vues ou un récit, et ses dates complètes (JJ/MM/AAAA)
   où qu'elles soient ;
4. un écart entre les personnes du fichier et le périmètre, ou un lien vers une personne absente ;
5. dans `lieux.js`, une commune qui n'est citée nulle part dans les données du partage et n'est proche d'aucun de ses
   lieux de vie, ou une région qui cite une commune absente ;
6. une adresse e-mail de `partages.json` (`membres`, si vous en notez) : elles ne doivent jamais être publiées ;
7. une image copiée que rien n'utilise.

Limite : un texte libre (notes, récits) qui nomme quelqu'un **hors de l'arbre**, ou un exclu sous une autre graphie
(« St-Martin » pour « SAINT-MARTIN »), n'est pas détecté.

## Mettre en ligne et protéger l'accès

`sh outils/site.sh` prépare tout dans `public/` : le site complet à la racine et chaque partage dans `public/partage/<nom>/`,
avec ses propres copies d'images. Chaque partage est donc un dossier autonome : on peut le publier seul, ou publier
le tout et protéger chaque dossier à part.

Le choix de l'hébergement vous appartient (hébergeur de fichiers statiques, serveur personnel, NAS…). Deux règles :
- **Protéger l'accès** : le site contient des données de famille. Mot de passe, authentification de l'hébergeur ou
  réseau privé ; jamais un site ouvert à tous, même avec une adresse « secrète ».
- **Un accès par partage** : le site complet reste réservé au responsable de l'arbre ; chaque branche de la famille
  ne reçoit que l'adresse et l'accès de son partage (`…/partage/<nom>/`, avec la barre finale).
