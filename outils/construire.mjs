// Génère famille.js et actes.js à partir du dossier data/ (source de vérité, voir outils/DONNEES.md).
//
// Usage :
//   node outils/construire.mjs                 régénère famille.js et actes.js à la racine du dépôt
//   node outils/construire.mjs --verifier      n'écrit rien ; échoue si famille.js / actes.js ne correspondent pas à data/
//   node outils/construire.mjs --racine DIR    lit DIR/data/ (défaut : le dépôt)
//   node outils/construire.mjs --sortie DIR    écrit DIR/famille.js et DIR/actes.js (défaut : la racine)
//
// Les fichiers produits définissent les mêmes globals qu'avant la migration (window.FAMILLE, window.FAMILLE_ACTES),
// si bien que index.html, gedcom.mjs et les autres lecteurs n'ont pas à changer.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { lireDonnees, assembler } from "./donnees.mjs";

const ENTETE_FAMILLE = `// Données de l'arbre généalogique.
// FICHIER GÉNÉRÉ, NE PAS MODIFIER : éditer data/ (ou utiliser node outils/fiche.mjs) puis lancer node outils/construire.mjs.
// Voir outils/DONNEES.md.
//
// Chaque personne a un identifiant ; "pere", "mere" et "conjoint" renvoient à d'autres identifiants.
// "inconnu: true" = personne dont on ne connaît pas encore l'identité (case à compléter).
// "aVerifier" = liste de points incertains affichés sur la fiche.
// "fiab" = niveau de fiabilité de la fiche : A = établi sur document, B = témoignage familial,
// C = source publiée par un tiers et non relue (valeur par défaut), D = hypothèse.
// "liens" = preuve de chaque lien vers un parent ({ pere, mere } : fiab, preuve, raisonnement, src) ; voir outils/DONNEES.md.
// "domaines" (d'une fiche) = domaines de métier, définis dans FAMILLE.domaines, pour le filtre de l'arbre.
`;
const ENTETE_ACTES = `// Actes d'archives par personne : lien vers la vue en ligne et capture locale (dossier actes/).
// FICHIER GÉNÉRÉ, NE PAS MODIFIER : les actes sont dans data/personnes/<id>.json (clé "actes")
// et data/actes-orphelins.json ; lancer node outils/construire.mjs après modification. Voir outils/DONNEES.md.
`;

// Format compact mais lisible en diff : une ligne par personne, une ligne par acte.
const J = v => JSON.stringify(v);
export function ecrireFamille(F) {
  const lignes = [];
  for (const [k, v] of Object.entries(F)) {
    if (k !== "personnes") { lignes.push(`  ${J(k)}: ${J(v)},`); continue; }
    lignes.push(`  "personnes": {`);
    for (const [id, p] of Object.entries(v)) lignes.push(`    ${J(id)}: ${J(p)},`);
    lignes.push(`  },`);
  }
  return `window.FAMILLE = {\n${lignes.join("\n")}\n};\n`;
}
export function ecrireActes(A) {
  const lignes = [];
  for (const [id, liste] of Object.entries(A)) {
    if (!Array.isArray(liste) || !liste.length) { lignes.push(`  ${J(id)}: ${J(liste)},`); continue; }
    lignes.push(`  ${J(id)}: [`, ...liste.map(a => `    ${J(a)},`), `  ],`);
  }
  return `window.FAMILLE_ACTES = {\n${lignes.join("\n")}\n};\n`;
}

export function construire(racine) {
  const d = lireDonnees(racine);
  const { FAMILLE, FAMILLE_ACTES } = assembler(d);
  return {
    "famille.js": ENTETE_FAMILLE + ecrireFamille(FAMILLE),
    "actes.js": ENTETE_ACTES + ecrireActes(FAMILLE_ACTES),
    stats: { personnes: d.fiches.size, idsActes: Object.keys(FAMILLE_ACTES).length, horsOrdre: d.horsOrdre },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const racine = resolve(opt("--racine") || join(dirname(fileURLToPath(import.meta.url)), ".."));
  const sortie = resolve(opt("--sortie") || racine);
  let r;
  try { r = construire(racine); } catch (e) { console.error("Échec : " + e.message); process.exit(1); }
  if (r.stats.horsOrdre.length) console.warn(`Fiches absentes de meta.ordre (ajoutées à la fin) : ${r.stats.horsOrdre.join(", ")}`);
  if (args.includes("--verifier")) {
    const perimes = ["famille.js", "actes.js"].filter(f => !existsSync(join(sortie, f)) || readFileSync(join(sortie, f), "utf8") !== r[f]);
    if (perimes.length) { console.error(`Pas à jour par rapport à data/ : ${perimes.join(", ")} (lancer node outils/construire.mjs)`); process.exit(1); }
    console.log("famille.js et actes.js sont à jour.");
  } else {
    mkdirSync(sortie, { recursive: true });
    for (const f of ["famille.js", "actes.js"]) writeFileSync(join(sortie, f), r[f], "utf8");
    console.log(`${r.stats.personnes} personnes, actes pour ${r.stats.idsActes} identifiants → ${sortie}`);
  }
}
