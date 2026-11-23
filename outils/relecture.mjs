#!/usr/bin/env node
// Liste les liens de parenté (père, mère) ajoutés ou changés depuis une référence git, avec la source citée :
// ce sont les liens qui font « monter d'une génération » et qu'une seconde recherche doit relire (METHODE.md, « Relecture »).
// Usage : node outils/relecture.mjs [--depuis <ref git>]   (défaut : origin/main)
//         node outils/relecture.mjs --depuis <ref> --json
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const depuis = args.includes("--depuis") ? args[args.indexOf("--depuis") + 1] : "origin/main";
const ancien = id => {
  try { return JSON.parse(execFileSync("git", ["show", `${depuis}:data/personnes/${id}.json`], { cwd: RACINE, stdio: ["ignore", "pipe", "ignore"] }).toString()); }
  catch { return null; }
};
const res = [];
for (const f of readdirSync(join(RACINE, "data/personnes"))) {
  const id = f.replace(/\.json$/, "");
  const p = JSON.parse(readFileSync(join(RACINE, "data/personnes", f), "utf8"));
  const a = ancien(id) || {};
  for (const role of ["pere", "mere"]) {
    if (!p[role] || p[role] === a[role]) continue;
    const lien = (p.liens || {})[role] || {};
    const src = (lien.src || []).map(n => p.sources?.[n - 1]).filter(Boolean).map(s => typeof s === "string" ? s : s.texte);
    res.push({ enfant: id, nom: `${p.prenoms || "?"} ${p.nom || "?"}`, role, parent: p[role], avant: a[role] || null,
      fiab: lien.fiab || p.fiab || "?", preuve: lien.preuve || "?", sources: src.length ? src : [p.lienParents || "(aucune source de lien)"] });
  }
}
if (args.includes("--json")) console.log(JSON.stringify(res, null, 2));
else {
  console.log(`${res.length} lien(s) ajouté(s) ou changé(s) depuis ${depuis} :`);
  for (const r of res) console.log(`- ${r.enfant} (${r.nom}) → ${r.role} = ${r.parent}${r.avant ? ` (avant : ${r.avant})` : ""} · ${r.fiab}/${r.preuve}\n    ${r.sources.join("\n    ")}`);
}
