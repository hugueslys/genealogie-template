# Journal des recherches (index)

À lire **avant** toute recherche, à compléter **après** : ne pas refaire deux fois la même recherche, garder la trace de ce qui n'a rien donné, savoir quels sites marchent. Les résultats (actes lus, filiations) vont dans les fiches (`data/personnes/`), les pistes d'une personne dans son champ `pistes`.

**Règle : lire cet index, puis seulement le fichier de sa région** (`recherches/journal/<région>.md`). Chaque fichier commence par un résumé et une ligne « Épuisé en ligne », puis l'état détaillé (accès aux sites, inventaire, pistes infructueuses), le plan de lecture et l'historique des passes. Après une recherche : ajouter la passe à l'historique (✅ trouvé, ❌ rien, ⏸ bloqué, ⚠️ piste), mettre à jour le résumé, « Épuisé en ligne » et le plan, et ici la ligne du site si son accès a changé.

Autres documents : registres déjà lus, vue par vue, `recherches/lectures/INDEX.md` (avant de lire une vue : `grep -ri "<nom>" recherches/lectures/`). Les cotes et vues exactes des actes sont dans les fiches (champ `sources`) ; « touché » ne veut pas dire « dépouillé en entier ».

## Fichiers régionaux (`recherches/journal/`)

Une région = un fichier, créé à partir de `MODELE-REGION.md` dès qu'une branche de la famille y vit. Une ligne par fichier ici : nom, sites principaux, communes, branches.

- `sources-generales.md` : INSEE, Mémoire des hommes, CICR, Léonore, Internet Archive, presse, Wikimedia, arbres en ligne, sources familiales.
- *(exemple, fichier à créer)* `touraine.md` : AD Indre-et-Loire ; Tours, Chinon ; branches Martel, Bertin.

## 1. État des sites

Test automatique : `node outils/sites.mjs` (ou `--branche <branche>`), une dizaine de secondes ; la liste des sites est dans `outils/sites.json` (à compléter avec les archives de vos régions). Chaque lundi, `.github/workflows/sites.yml` le relance et, si la variable du dépôt `SITES_TICKET` contient un numéro de ticket, y signale les sites surveillés qui rouvrent. Sans User-Agent de navigateur, beaucoup de sites renvoient 403. **On ne contourne pas les protections anti-robots** (Cloudflare, Anubis) : ces recherches se font dans le navigateur du responsable de l'arbre.

État relevé en novembre 2026 sur les sites testés par ce gabarit (à retester : l'accès change souvent). Les détails propres à vos recherches (adresses, API, paramètres) vont dans le fichier régional.

| Site | Accès | Testé | Remarque (détail : fichier) |
|---|---|---|---|
| AD Nord `archivesdepartementales.lenord.fr` | ✅ | 22/11/2026 | Scripts `nord_*.py` |
| Belgique `search.arch.be` | ⛔ fermé | 22/11/2026 | Avis de fermeture |
| AD Pas-de-Calais `www.archivespasdecalais.fr` | ⛔ hors ligne | 26/10/2026 | Nouveau site annoncé fin novembre 2026 : retester |
| AD Somme `archives.somme.fr` | ✅ | avant 22/11/2026 | Matricules ; images sans protection |
| AD Manche `www.archives-manche.fr` | ⛔ anti-robots | 22/11/2026 | Navigateur ; adresse directe des images : `outils/manche_url.py` |
| AD Ille-et-Vilaine `archives-en-ligne.ille-et-vilaine.fr` | ⚠️ maintenance | 22/11/2026 | 503, à retester |
| AD Seine-Maritime `www.archivesdepartementales76.net` | ⛔ Anubis | 22/11/2026 | Navigateur |
| AD Haute-Garonne `archives.haute-garonne.fr` | ⛔ Anubis / ✅ IIIF | 23/11/2026 | Visionneuse : navigateur ; images IIIF lisibles par curl si l'on connaît le code du registre |
| Archives de Paris `archives.paris.fr` | ✅ | 22/11/2026 | État civil reconstitué en Playwright, API Arkothèque sans protection |
| AD Haute-Marne `archives.haute-marne.fr` | ⛔ Anubis | 22/11/2026 | Navigateur |
| AD Maine-et-Loire `recherche-archives.maine-et-loire.fr` | ⛔ anti-robots | 22/11/2026 | Navigateur |
| AD Alpes-Maritimes `archives06.fr` | ⚠️ TLS incomplet | 22/11/2026 | Ne pas désactiver TLS, réessayer |
| AD Hérault, AD Tarn-et-Garonne | ⛔ Anubis | 22/11/2026 | Navigateur |
| Antenati `antenati.cultura.gov.it` | ✅ User-Agent | 22/11/2026 | 403 sans UA ; `full/full` déclenche Cloudflare ; `outils/antenati.py` |
| Caduti della Grande Guerra `www.cadutigrandeguerra.it` | ✅ | 22/11/2026 | Albo d'oro ; citer, ne pas copier |
| Arxius en línia `arxiusenlinia.cultura.gencat.cat` | ✅ | 22/11/2026 | API sans compte, `outils/arxius.py` |
| Autres catalans (Urgell, MDC, ARCA, XAC, BnC…) | ✅ / ⛔ | 22/11/2026 | Aucun registre paroissial en ligne |
| Biblioteca Virtual de Aragón `bibliotecavirtual.aragon.es` | ✅ | 22/11/2026 | BOP de Saragosse 1834-2004 en plein texte |
| DARA `dara.aragon.es` ; BOE Gazeta `www.boe.es` | ✅ | 22/11/2026 | DARA : chercher sans guillemets |
| PARES, BVPH, Hemeroteca BNE, BOP actuel, autres espagnols | ⛔ 429 / Cloudflare / proxy | 22/11/2026 | Navigateur |
| Digitarq `digitarq.arquivos.pt` | ✅ API | 22/11/2026 | curl ou Python avec UA, 3 requêtes en parallèle au plus |
| FamilySearch `www.familysearch.org` | 🔑 compte | 22/11/2026 | Avec un compte personnel, dans le navigateur |
| Geneanet `www.geneanet.org` | ⛔ Cloudflare | 22/11/2026 | Navigateur |
| RetroNews `www.retronews.fr` | 🔑 compte (recherche simple) | 23/11/2026 | |
| Gallica `gallica.bnf.fr` | ⛔ Cloudflare | 22/11/2026 | Accueil et API SRU |
| Léonore `www.leonore.archives-nationales.culture.gouv.fr` | ⚠️ accueil seul | 22/11/2026 | API refusée depuis une session |
| Mémoire des hommes `www.memoiredeshommes.defense.gouv.fr` | ✅ CSV | 22/11/2026 | Bases en données ouvertes ; images : captcha |
| MémorialGenWeb `www.memorialgenweb.org` | ⚠️ captcha (à valider dans le navigateur) | 23/11/2026 | |
| CICR `grandeguerre.icrc.org` | ✅ API | 22/11/2026 | Fichier français phonétique |
| Internet Archive `archive.org` | ✅ | 22/11/2026 | Plein texte sans compte |
| BN-R `www.bn-r.fr` ; Persée `www.persee.fr` | ⚠️ ALTCHA | 22/11/2026 | BN-R : recherche ; Persée : PDF |
| Numerabilis ; Medica (BIU Santé) | ✅ ; ⚠️ | 22/11/2026 | Medica : passer par Internet Archive |
| Lillonum, HathiTrust, FranceArchives | ⛔ | 22/11/2026 | Anubis, Cloudflare, anti-robot |
| Europeana ; Google Livres ; data.gouv.fr ; Grand Mémorial | ✅ inutile ; ⛔ | 22/11/2026 | Métadonnées seules ; 429 ; proxy ; muet |
| Wikimedia Commons ; Wikipédia | ✅ lent | 22/11/2026 | API 429 fréquents, vignettes standard |
| INSEE `deces.matchid.io` ; IGN ; POP | ✅ | 22/11/2026 | INSEE : balayage complet fait |
