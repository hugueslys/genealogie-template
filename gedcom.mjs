// Exporte famille.js au format GEDCOM 5.5.1 (UTF-8), lisible par tous les logiciels de généalogie.
// Usage : node gedcom.mjs sortie.ged [famille.js]   (défaut : le famille.js à côté de ce script)
// Ou, depuis un autre script : import { versGedcom } from "./gedcom.mjs" ; versGedcom(FAMILLE) rend { texte, personnes, familles }.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const MOIS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MOISFR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const moisAn = t => { const m = t.match(new RegExp(`(${MOISFR.join("|")})\\s+(\\d{4})`)); return m ? `${MOIS[MOISFR.indexOf(m[1])]} ${m[2]}` : null; };
const simple = t => {
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (m) return `${+m[1]} ${MOIS[+m[2] - 1]} ${m[3]}`;
  return moisAn(t) || ((m = t.match(/^(\d{4})/)) ? m[1] : null);
};
function dateGed(d) {
  if (!d) return null;
  const t = String(d).trim();
  let m;
  if ((m = t.match(/^entre (\d{4}) et (\d{4})/))) return `BET ${m[1]} AND ${m[2]}`;
  if ((m = t.match(/^vers (\d{4})-(\d{4})/))) return `BET ${m[1]} AND ${m[2]}`;
  for (const [mot, ged] of [["vers", "ABT"], ["avant", "BEF"], ["après", "AFT"]])
    if (t.startsWith(mot + " ")) { const s = simple(t.slice(mot.length + 1)); return s ? `${ged} ${s}` : `(${t})`; }
  const s = simple(t);
  if (!s) return `(${t})`;
  return /^\d{2}\/\d{2}\/\d{4}$/.test(t) || /^\d{4}$/.test(t) || /^[a-zéû]+ \d{4}$/.test(t) ? s : `${s}`;
}

export function versGedcom(FAMILLE) {
  const { personnes: P, racine } = FAMILLE;
  const out = [];
  const L = (niv, tag, val) => {
    if (val == null || val === "") { out.push(`${niv} ${tag}`); return; }
    const lignes = String(val).replace(/\r/g, "").split("\n");
    lignes.forEach((ligne, i) => {
      const morceaux = ligne.match(/.{1,200}/gsu) || [""];
      morceaux.forEach((m, j) => out.push(i === 0 && j === 0 ? `${niv} ${tag} ${m}` : `${niv + 1} ${j === 0 ? "CONT" : "CONC"} ${m}`));
    });
  };
  const ids = Object.keys(P), I = {}; ids.forEach((id, n) => (I[id] = `@I${n + 1}@`));

  // Familles : chaque couple de parents d'au moins un enfant, plus chaque couple déclaré par « conjoint ».
  const fams = new Map();
  const cle = (a, b) => [a || "", b || ""].join("|");
  const fam = (pere, mere) => { const k = cle(pere, mere); if (!fams.has(k)) fams.set(k, { pere, mere, enfants: [], id: `@F${fams.size + 1}@` }); return fams.get(k); };
  for (const id of ids) { const p = P[id]; if ((p.pere && P[p.pere]) || (p.mere && P[p.mere])) fam(P[p.pere] ? p.pere : null, P[p.mere] ? p.mere : null).enfants.push(id); }
  for (const id of ids) {
    const p = P[id], c = p.conjoint; if (!c || !P[c]) continue;
    const [h, f] = p.sexe === "F" ? [c, id] : [id, c];
    fam(h, f);
  }

  L(0, "HEAD"); L(1, "SOUR", "ARBRE_GENEALOGIQUE"); L(2, "NAME", "Arbre généalogique"); L(1, "GEDC"); L(2, "VERS", "5.5.1"); L(2, "FORM", "LINEAGE-LINKED");
  L(1, "CHAR", "UTF-8"); L(1, "LANG", "French"); L(1, "SUBM", "@SUB1@"); L(1, "DATE", (() => { const d = new Date(); return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`; })());
  L(0, "@SUB1@ SUBM"); L(1, "NAME", FAMILLE.titre || "Arbre généalogique");

  const evt = (niv, tag, e) => {
    if (!e || (!e.date && !e.lieu)) return;
    L(niv, tag);
    const d = dateGed(e.date); if (d) L(niv + 1, "DATE", d);
    if (e.lieu) L(niv + 1, "PLAC", e.lieu);
    if (e.age) L(niv + 1, "AGE", String(e.age));
  };
  const nomPropre = n => String(n || "").replace(/\s*\(.*?\)\s*/g, " ").trim();
  for (const id of ids) {
    const p = P[id];
    L(0, `${I[id]} INDI`);
    const nom = nomPropre(p.nomNaissance || p.nom);
    L(1, "NAME", `${p.prenoms || ""} /${nom}/`.trim());
    L(2, "GIVN", p.prenoms || ""); L(2, "SURN", nom);
    if (p.usuel) L(2, "NICK", p.usuel);
    if (p.nomNaissance && p.nom && nomPropre(p.nom) !== nom) { L(1, "NAME", `${p.prenoms || ""} /${nomPropre(p.nom)}/`); L(2, "TYPE", "married"); }
    if (p.sexe) L(1, "SEX", p.sexe === "F" ? "F" : "M");
    evt(1, "BIRT", p.naissance); evt(1, "DEAT", p.deces);
    if (p.metier) L(1, "OCCU", p.metier);
    if (p.nationalite) L(1, "NATI", Array.isArray(p.nationalite) ? p.nationalite.join(", ") : p.nationalite);
    for (const f of fams.values()) if (f.pere === id || f.mere === id) L(1, "FAMS", f.id);
    for (const f of fams.values()) if (f.enfants.includes(id)) L(1, "FAMC", f.id);
    const note = [
      p.fiab && `Fiabilité : ${p.fiab}${p.fiabNote ? " — " + p.fiabNote : ""}`,
      p.lienParents && `Filiation : ${p.lienParents}`,
      p.notes, p.pistes && `Pistes : ${p.pistes}`,
      p.aVerifier && p.aVerifier.length && `À vérifier : ${p.aVerifier.join(" ")}`,
    ].filter(Boolean).join("\n");
    if (note) L(1, "NOTE", note);
    for (const s of p.sources || []) L(1, "SOUR", typeof s === "string" ? s : s.texte);
    if (id === racine) L(1, "_SOSA", "1");
  }
  for (const f of fams.values()) {
    L(0, `${f.id} FAM`);
    if (f.pere) L(1, "HUSB", I[f.pere]);
    if (f.mere) L(1, "WIFE", I[f.mere]);
    const a = f.pere && P[f.pere], b = f.mere && P[f.mere];
    const mar = (a && a.conjoint === f.mere && a.mariage) || (b && b.conjoint === f.pere && b.mariage);
    if (mar) evt(1, "MARR", mar);
    const lu = (a && a.conjoint === f.mere && a.lienUnion) || (b && b.lienUnion);
    if (lu) L(1, "NOTE", lu);
    for (const e of f.enfants) L(1, "CHIL", I[e]);
  }
  L(0, "TRLR");
  return { texte: out.join("\n") + "\n", personnes: ids.length, familles: fams.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(process.argv[3] || new URL("./famille.js", import.meta.url), "utf8"), ctx);
  const r = versGedcom(ctx.window.FAMILLE);
  writeFileSync(process.argv[2] || "arbre.ged", r.texte, "utf8");
  console.log(`${r.personnes} personnes, ${r.familles} familles`);
}
