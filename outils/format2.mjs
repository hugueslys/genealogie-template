// Passage d'une fiche au « format 2 » (voir outils/DONNEES.md, « Format 2 des fiches »).
//
// Ce que le script fait automatiquement, sans modèle de langue :
//   - sources : chaque texte devient un objet { texte, nature, archive?, cote?, vue?, url?, images?: [{ titre, image, url? }] } ;
//     la nature est devinée (acte, index, arbre, presse, temoignage, ouvrage, dossier, base) et peut être corrigée à la main ;
//   - actes : fusionnés dans les sources (même cote et même vue, ou même texte de source) ; un acte sans source
//     correspondante devient une source à part entière. La galerie d'actes du site est ensuite tirée des sources qui ont une image ;
//   - chronologie : les renvois src [n] sont renumérotés d'après la nouvelle liste ;
//   - unions : conjoint + mariage + lienUnion deviennent unions: [{ conjoint, date, lieu, preuve }] ;
//   - dates : chaque événement reçoit "tri" (AAAA-MM-JJ, AAAA-MM ou AAAA) et "qualif" (vers, avant, après, entre) ;
//   - lieux : chaque événement reçoit "commune" (nom du répertoire lieux.js) et "precision" (quartier, rue…).
// Ce qu'il ne fait pas : répartir l'ancien champ "notes" en chronologie et remarques (travail de lecture).
//
// Usage : node outils/format2.mjs <id> [<id>…] [--tous] [--essai]   (--essai : affiche sans écrire)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { rangerFiche, enJSON } from "./donnees.mjs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(RACINE, "data", "personnes");
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(readFileSync(join(RACINE, "lieux.js"), "utf8"), ctx);
const LIEUX = ctx.window.FAMILLE_LIEUX || {};
const NOMS = Object.keys(LIEUX).sort((a, b) => b.length - a.length);

// ---- Dates ----
const MOIS = { janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12 };
const p2 = n => String(n).padStart(2, "0");
export function analyserDate(t) {
  if (!t) return {};
  const s = String(t).toLowerCase();
  let qualif;
  if (/^\s*(vers|env\.?|environ|circa)\b/.test(s) || /\?/.test(s.split(",")[0])) qualif = "vers";
  else if (/^\s*avant\b/.test(s)) qualif = "avant";
  else if (/^\s*(après|apres)\b/.test(s)) qualif = "après";
  else if (/^\s*entre\b/.test(s) || /^\s*\d{4}\s*-\s*\d{4}/.test(s)) qualif = "entre";
  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return { tri: `${m[3]}-${p2(m[2])}-${p2(m[1])}`, ...(qualif && { qualif }) };
  m = s.match(/(\d{1,2})(?:er)?\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/);
  if (m) return { tri: `${m[3]}-${p2(MOIS[m[2]])}-${p2(m[1])}`, ...(qualif && { qualif }) };
  m = s.match(/\b(\d{1,2})\/(\d{4})\b/);
  if (m) return { tri: `${m[2]}-${p2(m[1])}`, ...(qualif && { qualif }) };
  m = s.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (m) return { tri: m[1], ...(qualif && { qualif }) };
  return qualif ? { qualif } : {};
}

// ---- Lieux ----
export function analyserLieu(t) {
  if (!t) return {};
  const commune = NOMS.find(n => t.startsWith(n)) || NOMS.find(n => t.includes(n));
  if (!commune) return {};
  // La précision est ce qui suit la commune et son département entre parenthèses : « …, quartier du Pâté ».
  let apres = t.slice(t.indexOf(commune) + commune.length);
  if (/^[-\p{L}]/u.test(apres)) apres = apres.replace(/^[-\p{L}']+/u, ""); // nom plus long que l'entrée du répertoire (Saint-Martin-le-Beau pour Saint-Martin)
  apres = apres.replace(/^\s*\([^)]*\)/, "").replace(/^[\s,;:]+/, "").trim();
  return { commune, ...(apres && { precision: apres }) };
}
function enrichirEvt(e) {
  if (!e || typeof e !== "object") return e;
  return { ...e, ...analyserDate(e.date), ...analyserLieu(e.lieu) };
}

// ---- Sources ----
export function natureDe(t) {
  if (/t[ée]moignage|^commentaire de |d'après (sa|son|la famille)|souvenir|transmis(e)? par|document familial/i.test(t)) return "temoignage";
  if (/arbre (geneanet|en ligne|publié)|geneanet d['e]|arbre de /i.test(t)) return "arbre";
  if (/index familysearch|index des registres|relevé|grand mémorial|fichier des (personnes )?décès|insee|matchid/i.test(t)) return "index";
  if (/journal|gazette|écho|echo du|croix du|bulletin|l'avenir|l'égalité|revue|presse|gallica.*p\. \d/i.test(t) && !/journal officiel/i.test(t)) return "presse";
  if (/journal officiel|\(gallica/i.test(t)) return "presse";
  if (/mémoires de la|\bt\. [IVXL]+,|thèse|catalogue|sofop|historique des|ouvrage|biographie/i.test(t)) return "ouvrage";
  if (/léonore|leonore|dossier|mémoire des hommes|titres, homologations|shd|archives nationales|cicr|prisonniers/i.test(t)) return "dossier";
  if (/recensement|registre matricule|table|acte|naissance|baptême|mariage|décès|inhumation|sépulture|archives départementales|archives de paris|archivio|arquivo|ad nord|cote|vue \d/i.test(t)) return "acte";
  if (/«.*»|thèse|catalogue|sofop|historique|site d|musée|ouvrage|p\. \d+/i.test(t)) return "ouvrage";
  return "autre";
}
function champsDe(t) {
  const o = {};
  const cote = t.match(/\b(\d+\s?Mi(?:\s?EC)?\s?\d+\s?R\s?\d+|\d+\s?E\s?\d+[\w ]*?|1\s?R\s?\d+|\d+\s?M\s?\d+|\d+\s?NUM AC \d+|5Mi1 \d+|\d+[NM] \d+|PT\/[A-Z0-9\/]+|GR \d+ P \d+|LH\/\/\d+\/\d+|\d{8}\/\d+\/\d+|ark:\/[\w\/.:-]+)/);
  if (cote) o.cote = cote[1].trim();
  const vue = t.match(/\b(?:vues?|images?)\s+(m?\d+(?:[-–]\d+)?)/i);
  if (vue) o.vue = vue[1];
  const arch = t.match(/(Archives départementales d[eu']s?\s?[^.,;)]+|Archives de Paris|Archives nationales|Archivio di Stato di [A-Z]\w+|Arquivo Distrital d[ae] \w+|Service historique de la Défense|FamilySearch|Gallica|Geneanet)/);
  if (arch) o.archive = arch[1].trim();
  return o;
}
const cleCoteVue = s => s.cote && s.vue ? `${s.cote.replace(/\s/g, "")}|${String(s.vue).replace(/\D.*$/, "")}` : null;

export function versFormat2(f) {
  if (f.format === 2) return f;
  const g = { ...f };
  // Sources texte → objets.
  const anciennes = Array.isArray(f.sources) ? f.sources : [];
  const sources = anciennes.map(t => typeof t === "string" ? { texte: t, nature: natureDe(t), ...champsDe(t) } : t);
  const vus = new Map();
  const nouvelIndex = anciennes.map((_, i) => i); // ancien index → nouvel index (doublons fusionnés)
  const dedup = [];
  sources.forEach((s, i) => {
    const k = s.texte.trim();
    if (vus.has(k)) { nouvelIndex[i] = vus.get(k); return; }
    vus.set(k, dedup.length); nouvelIndex[i] = dedup.length; dedup.push(s);
  });
  // Actes → fusionnés dans les sources.
  for (const a of Array.isArray(f.actes) ? f.actes : []) {
    const c = a.source ? champsDe(a.source) : champsDe(a.titre || "");
    let j = a.source ? dedup.findIndex(s => s.texte.trim() === a.source.trim()) : -1;
    if (j < 0 && cleCoteVue(c)) j = dedup.findIndex(s => cleCoteVue(s) === cleCoteVue(c));
    // Même identifiant en ligne (fin de l'URL de l'acte citée dans le texte d'une source : ark FamilySearch, Gallica…).
    const fin = a.url && a.url.replace(/[?#].*$/, "").split(/[\/:]/).filter(x => x.length >= 8).pop();
    if (j < 0 && fin) j = dedup.findIndex(s => s.texte.includes(fin));
    const img = { titre: a.titre, ...(a.image && { image: a.image }), ...(a.url && { url: a.url }), ...(a.douteux && { douteux: true }) };
    if (j >= 0) { dedup[j].images = [...(dedup[j].images || []), img]; if (a.url && !dedup[j].url) dedup[j].url = a.url; }
    else dedup.push({ texte: a.source || a.titre, nature: natureDe(a.source || a.titre), ...c, ...(a.url && { url: a.url }), images: [img] });
  }
  delete g.actes;
  if (dedup.length) g.sources = dedup; else delete g.sources;
  // Chronologie : renvois renumérotés.
  if (Array.isArray(f.chronologie)) g.chronologie = f.chronologie.map(e => ({
    ...e, ...analyserDate(e.date), ...(e.lieu && analyserLieu(e.lieu)),
    ...(e.src && { src: [...new Set(e.src.map(n => nouvelIndex[n - 1] + 1).filter(Boolean))] }),
  }));
  // Événements.
  for (const k of ["naissance", "bapteme", "deces", "inhumation"]) if (g[k]) g[k] = enrichirEvt(g[k]);
  // Unions.
  if (f.conjoint || f.mariage) {
    g.unions = [{ ...(f.conjoint && { conjoint: f.conjoint }), ...enrichirEvt(f.mariage || {}), ...(f.lienUnion && { preuve: f.lienUnion }) }];
    delete g.conjoint; delete g.mariage; delete g.lienUnion;
  }
  g.format = 2;
  return g;
}

// Rattache des sources (souvent une image isolée, ou un doublon) à une source cible : leurs images passent sur la cible,
// elles sont supprimées, et les renvois de la chronologie sont renumérotés. Numéros à partir de 1.
export function rattacher(f, cible, autres) {
  const S = f.sources, t = S[cible - 1];
  for (const n of autres) { const x = S[n - 1]; t.images = [...(t.images || []), ...(x.images || [])]; if (!t.url && x.url) t.url = x.url; }
  const retires = new Set(autres), nouveau = [];
  S.forEach((x, i) => { if (!retires.has(i + 1)) nouveau.push(i + 1); });
  const map = n => retires.has(n) ? nouveau.indexOf(cible) + 1 : nouveau.indexOf(n) + 1;
  f.sources = nouveau.map(n => S[n - 1]);
  for (const e of f.chronologie || []) if (e.src) e.src = [...new Set(e.src.map(map))];
  for (const u of f.unions || []) if (u.src) u.src = [...new Set(u.src.map(map))];
  return f;
}

// Recalcule seulement commune/precision et tri/qualif (après une correction du répertoire des lieux ou du script).
export function renormaliser(f) {
  const maj = e => { if (!e || typeof e !== "object") return e; const o = { ...e }; delete o.commune; delete o.precision; delete o.tri; delete o.qualif; return { ...o, ...analyserDate(o.date), ...(o.lieu ? analyserLieu(o.lieu) : {}) }; };
  for (const k of ["naissance", "bapteme", "deces", "inhumation"]) if (f[k]) f[k] = maj(f[k]);
  for (const k of ["unions", "chronologie"]) if (Array.isArray(f[k])) f[k] = f[k].map(maj);
  return f;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv[2] === "--renormaliser") {
  for (const x of readdirSync(DIR).filter(x => x.endsWith(".json"))) { const fi = join(DIR, x); writeFileSync(fi, enJSON(rangerFiche(renormaliser(JSON.parse(readFileSync(fi, "utf8")))))); }
  console.log("Dates et lieux renormalisés.");
  process.exit(0);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv[2] === "--rattacher") {
  // node outils/format2.mjs --rattacher <id> <cible>:<n>,<n> [<cible>:<n>…]   (numéros de la liste actuelle)
  const [, , , id, ...regles] = process.argv;
  const fichier = join(DIR, id + ".json"); let f = JSON.parse(readFileSync(fichier, "utf8"));
  // Appliquer de la plus grande source retirée à la plus petite pour que les numéros restent valables.
  const ops = regles.map(r => { const [c, l] = r.split(":"); return [+c, l.split(",").map(Number)]; });
  const orig = f.sources.slice();
  for (const [c, l] of ops) { const ci = f.sources.indexOf(orig[c - 1]) + 1; f = rattacher(f, ci, l.map(n => f.sources.indexOf(orig[n - 1]) + 1)); }
  writeFileSync(fichier, enJSON(rangerFiche(f)));
  console.log(`${id} : ${f.sources.length} sources.`);
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2), essai = args.includes("--essai");
  const ids = args.includes("--tous") ? readdirSync(DIR).filter(x => x.endsWith(".json")).map(x => x.slice(0, -5)) : args.filter(a => !a.startsWith("--"));
  for (const id of ids) {
    const fichier = join(DIR, id + ".json"), f = JSON.parse(readFileSync(fichier, "utf8"));
    const g = rangerFiche(versFormat2(f));
    if (essai) console.log(enJSON(g)); else writeFileSync(fichier, enJSON(g));
  }
  if (!essai) console.log(`${ids.length} fiche(s) au format 2.`);
}
