# Lectures de registres : index des pages déjà lues

Chaque vue de registre lue coûte du temps et des tokens. On note ici **tout ce qui figure sur la page**, pas seulement l'acte cherché, pour ne jamais relire une page et pour retrouver plus tard les autres familles de l'arbre.

**Un fichier par registre** : `<archive>-<commune>-<cote>.md`, par exemple `ad37-chinon-6nummv072-001.md`.

Contenu du fichier :
- en tête, une ligne : archive, commune, cote, période, lien (ark), particularités (latin, noms en marge ou non, ordre baptêmes/mariages/sépultures, repères d'années) ;
- puis **une ligne par vue lue** :

```
| Vue | Date(s) | Actes (type : noms principaux ; parents ; parrains et témoins utiles) | Lu par / le |
|---|---|---|---|
| 42 | 3 mai 1802 | M : Jean Martel × Rose Pinel (témoins Louis Martel, frère ; Pierre Pinel, oncle) | agent, JJ/MM/AAAA |
| 43 | mai 1802 | N : … ; D : … | … |
```

Abréviations : B baptême, N naissance, M mariage, S sépulture, D décès.
Une vue parcourue **sans rien noter d'utile** s'inscrit quand même (« rien pour l'arbre »), avec les noms de famille présents si la page en contient. C'est ce qui évite de la relire.

Avant de lire une vue : `grep -ri "<nom>" recherches/lectures/`. La liste des fichiers est dans `INDEX.md`.
