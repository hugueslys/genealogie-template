#!/usr/bin/env node
// Lire l'état FINAL d'une ou plusieurs fiches de famille.js (après tous les blocs « Vague N »).
//
// famille.js est une suite de blocs qui modifient les données : on ne lit
// jamais le texte brut, on exécute le fichier et on affiche le résultat.
//
// Usage :
//   node outils/fiche.cjs ID [ID ...]            fiches complètes (JSON)
//   node outils/fiche.cjs --cherche TEXTE         identifiants dont le nom ou les prénoms contiennent TEXTE
//   node outils/fiche.cjs --bloc FICHIER ID ...   même chose, après avoir ajouté un bloc à tester
//                                                (vérifie aussi que le bloc s'exécute)
//   node outils/fiche.cjs --actes ID              actes (images) liés à la fiche, dans actes.js
//
// Exemples :
//   node outils/fiche.cjs paul_martel
//   node outils/fiche.cjs --cherche Martel
//   node outils/fiche.cjs --bloc /tmp/sortie/famille-bloc.js paul_martel
const fs = require("fs");
const path = require("path");
const racine = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
if (!args.length) { console.error(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }

global.window = {};
let code = fs.readFileSync(path.join(racine, "famille.js"), "utf8");
if (args[0] === "--bloc") { code += "\n" + fs.readFileSync(args[1], "utf8"); args.splice(0, 2); }
eval(code);
const P = window.FAMILLE.personnes;

if (args[0] === "--cherche") {
  const t = args[1].toLowerCase();
  for (const [id, p] of Object.entries(P))
    if (`${p.prenoms || ""} ${p.nom || ""}`.toLowerCase().includes(t))
      console.log(id, "|", p.prenoms, p.nom, "|", (p.naissance && p.naissance.date) || "", "|", p.fiab || "");
} else if (args[0] === "--actes") {
  eval(fs.readFileSync(path.join(racine, "actes.js"), "utf8"));
  console.log(JSON.stringify(window.FAMILLE_ACTES[args[1]] || [], null, 1));
} else {
  for (const id of args) {
    if (!P[id]) { console.log(`${id} : fiche inexistante`); continue; }
    console.log(id, JSON.stringify(P[id], null, 1));
  }
}
