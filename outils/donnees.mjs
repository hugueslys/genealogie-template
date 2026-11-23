// Fonctions communes aux outils de données (construire.mjs, consolider.mjs, fiche.mjs).
// Structure du dossier data/ : voir outils/DONNEES.md.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

// Ordre des clés d'une fiche : identité, événements, famille, métier, fiabilité, médias, textes, sources, actes.
export const ORDRE_FICHE = [
  "format", "prenoms", "usuel", "nom", "nomNaissance", "sexe", "role", "inconnu", "nationalite",
  "naissance", "bapteme", "mariage", "deces", "inhumation",
  "pere", "mere", "lienParents", "liens", "conjoint", "lienUnion", "unions",
  "metier", "domaines",
  "fiab", "fiabNote",
  "photo", "photoLegende", "aVoir",
  "chronologie", "remarques", "notes", "pistes", "aVerifier", "sources",
  "actes",
];
const ORDRE_EVT = ["date", "tri", "qualif", "lieu", "commune", "precision", "age"];
const ORDRE_UNION = ["conjoint", "date", "tri", "qualif", "lieu", "commune", "precision", "preuve", "src", "lien"];
// Lien de parenté (liens.pere, liens.mere, union.lien) : voir outils/DONNEES.md, « Liens de parenté ».
const ORDRE_LIEN = ["fiab", "preuve", "raisonnement", "src"];
export const rangerLien = l => (estObjet(l) ? ranger(l, ORDRE_LIEN) : l);
const ORDRE_SOURCE = ["texte", "nature", "archive", "cote", "vue", "url", "images"];
const ORDRE_IMAGE = ["titre", "image", "url", "douteux"];
const ORDRE_ACTE = ["titre", "source", "url", "image", "douteux"];
const ORDRE_CHRONO = ["date", "tri", "qualif", "lieu", "commune", "precision", "texte", "src"];

// Réordonne les clés d'un objet : d'abord celles de « ordre », puis les autres par ordre alphabétique.
// Les clés de valeur undefined sont retirées (elles n'existent pas en JSON).
function ranger(o, ordre) {
  const cles = Object.keys(o).filter(k => o[k] !== undefined);
  const connues = ordre.filter(k => cles.includes(k));
  const autres = cles.filter(k => !ordre.includes(k)).sort();
  const r = {};
  for (const k of [...connues, ...autres]) r[k] = o[k];
  return r;
}
const estObjet = v => v && typeof v === "object" && !Array.isArray(v);

export function rangerActe(a) { return estObjet(a) ? ranger(a, ORDRE_ACTE) : a; }

export function rangerFiche(p) {
  const r = ranger(p, ORDRE_FICHE);
  for (const k of Object.keys(r)) {
    if (k === "actes" && Array.isArray(r[k])) r[k] = r[k].map(rangerActe);
    else if (k === "chronologie" && Array.isArray(r[k])) r[k] = r[k].map(e => estObjet(e) ? ranger(e, ORDRE_CHRONO) : e);
    else if (k === "unions" && Array.isArray(r[k])) r[k] = r[k].map(e => { if (!estObjet(e)) return e; const u = ranger(e, ORDRE_UNION); if (u.lien) u.lien = rangerLien(u.lien); return u; });
    else if (k === "liens" && estObjet(r[k])) { const l = ranger(r[k], ["pere", "mere"]); for (const x of Object.keys(l)) l[x] = rangerLien(l[x]); r[k] = l; }
    else if (k === "sources" && Array.isArray(r[k])) r[k] = r[k].map(e => {
      if (!estObjet(e)) return e;
      const o = ranger(e, ORDRE_SOURCE);
      if (Array.isArray(o.images)) o.images = o.images.map(i => estObjet(i) ? ranger(i, ORDRE_IMAGE) : i);
      return o;
    });
    else if (estObjet(r[k])) r[k] = ranger(r[k], ORDRE_EVT);
  }
  return r;
}

// JSON lisible : indentation 2, UTF-8, accents non échappés, fin de ligne finale.
// Les petits objets et listes de valeurs simples (dates, domaines…) tiennent sur une ligne.
export const enJSON = v => joli(v, "") + "\n";
function joli(v, ind) {
  const court = JSON.stringify(v);
  if (v === null || typeof v !== "object") return court;
  const simple = Object.values(v).every(x => x === null || typeof x !== "object");
  // (en JSON, une chaîne ne contient jamais de saut de ligne brut : le remplacement ne touche que la mise en page)
  if (simple && court.length <= 100) return JSON.stringify(v, null, 1).replace(/\n\s*/g, " ");
  const ind2 = ind + "  ";
  if (Array.isArray(v)) return v.length ? `[\n${v.map(x => ind2 + joli(x, ind2)).join(",\n")}\n${ind}]` : "[]";
  const k = Object.keys(v).filter(k => v[k] !== undefined);
  return k.length ? `{\n${k.map(c => `${ind2}${JSON.stringify(c)}: ${joli(v[c], ind2)}`).join(",\n")}\n${ind}}` : "{}";
}

export function ecrireJSON(chemin, v) { writeFileSync(chemin, enJSON(v), "utf8"); }
export function lireJSON(chemin) { return JSON.parse(readFileSync(chemin, "utf8")); }

// Chemins du dossier data/ d'une racine donnée.
export const chemins = racine => {
  const data = join(racine, "data");
  return {
    data, personnes: join(data, "personnes"), meta: join(data, "meta.json"), orphelins: join(data, "actes-orphelins.json"),
    fiche: id => join(data, "personnes", id + ".json"),
  };
};

export const ID_VALIDE = /^[A-Za-z0-9_-]+$/;

// Lit data/ et rend { meta, fiches: Map(id -> fiche), orphelins }. L'ordre des fiches suit meta.ordre,
// puis les fichiers absents de meta.ordre (ordre alphabétique, signalés dans « horsOrdre »).
export function lireDonnees(racine) {
  const c = chemins(racine);
  if (!existsSync(c.meta)) throw new Error(`${c.meta} introuvable : le dossier data/ n'existe pas encore (voir outils/DONNEES.md, migration).`);
  const meta = lireJSON(c.meta);
  const fichiers = readdirSync(c.personnes).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5));
  const presents = new Set(fichiers);
  const manquants = (meta.ordre || []).filter(id => !presents.has(id));
  if (manquants.length) throw new Error(`meta.ordre cite des fiches sans fichier : ${manquants.join(", ")}`);
  const dansOrdre = new Set(meta.ordre || []);
  const horsOrdre = fichiers.filter(id => !dansOrdre.has(id)).sort();
  const fiches = new Map();
  for (const id of [...(meta.ordre || []), ...horsOrdre]) fiches.set(id, lireJSON(c.fiche(id)));
  const orphelins = existsSync(c.orphelins) ? lireJSON(c.orphelins) : {};
  return { meta, fiches, orphelins, horsOrdre };
}

export function ecrireFiche(racine, id, fiche) {
  if (!ID_VALIDE.test(id)) throw new Error(`identifiant invalide : ${id}`);
  const c = chemins(racine);
  mkdirSync(c.personnes, { recursive: true });
  ecrireJSON(c.fiche(id), rangerFiche(fiche));
}

// Reconstitue les deux globals du site à partir des données lues.
export function assembler({ meta, fiches, orphelins }) {
  const personnes = {}, actes = {};
  for (const [id, f] of fiches) {
    if (f.format === 2) {
      // Format 2 : on reconstitue aussi les champs du format 1 lus par le site, le GEDCOM et les contrôles
      // (conjoint, mariage, lienUnion, liste d'actes), à partir des unions et des sources.
      const p = { ...f }, u = (f.unions || [])[0];
      if (u) {
        if (u.conjoint) p.conjoint = u.conjoint;
        const { conjoint, preuve, src, ...evt } = u;
        if (Object.keys(evt).length) p.mariage = evt;
        if (preuve) p.lienUnion = preuve;
      }
      personnes[id] = p;
      const a = (f.sources || []).flatMap(s => (s && s.images || []).map(i => ({ titre: i.titre || s.texte, source: s.texte, url: i.url || s.url || null, image: i.image ?? null, ...(i.douteux && { douteux: true }) })));
      if (a.length) actes[id] = a;
      continue;
    }
    const { actes: a, ...reste } = f;
    personnes[id] = reste;
    if (a !== undefined) actes[id] = a;
  }
  for (const [id, a] of Object.entries(orphelins)) actes[id] = a;
  const { racine, ...autres } = meta.famille;
  const FAMILLE = { racine, personnes, ...autres };
  return { FAMILLE, FAMILLE_ACTES: actes };
}

// Exécute des fichiers JS du site, dans l'ordre, dans un contexte isolé où window est l'objet global
// (comme dans un navigateur). Rend le contexte et la liste des globals créés.
export function executer(fichiers) {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  const avant = new Set(Object.getOwnPropertyNames(ctx));
  for (const f of fichiers) vm.runInContext(readFileSync(f, "utf8"), ctx, { filename: f });
  const globals = Object.getOwnPropertyNames(ctx).filter(k => !avant.has(k));
  return { ctx, globals };
}

// Comparaison profonde stricte des données (types, valeurs, longueurs et ordre des listes, ensembles de clés).
// Une clé de valeur undefined est considérée comme absente (JSON ne peut pas la représenter).
// Rend la liste des différences (vide si égal).
export function comparer(a, b, chemin = "", diffs = [], max = 50) {
  if (diffs.length >= max) return diffs;
  const type = v => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);
  const ta = type(a), tb = type(b);
  if (ta !== tb) { diffs.push(`${chemin} : type ${ta} ≠ ${tb}`); return diffs; }
  if (ta === "array") {
    if (a.length !== b.length) diffs.push(`${chemin} : longueur ${a.length} ≠ ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) comparer(a[i], b[i], `${chemin}[${i}]`, diffs, max);
  } else if (ta === "object") {
    const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
    for (const k of ka) if (!(k in b) || b[k] === undefined) diffs.push(`${chemin}.${k} : absent après`);
    for (const k of kb) if (!(k in a) || a[k] === undefined) diffs.push(`${chemin}.${k} : absent avant`);
    for (const k of ka) if (b[k] !== undefined) comparer(a[k], b[k], `${chemin}.${k}`, diffs, max);
  } else if (!Object.is(a, b)) {
    diffs.push(`${chemin} : ${JSON.stringify(a)?.slice(0, 80)} ≠ ${JSON.stringify(b)?.slice(0, 80)}`);
  } else if (ta === "function" || ta === "symbol" || ta === "bigint") {
    diffs.push(`${chemin} : valeur de type ${ta} non représentable en JSON`);
  }
  return diffs;
}

// Compte les clés de valeur undefined (perdues à la conversion en JSON, sans effet sur le site).
export function compterUndefined(v, chemin = "", acc = []) {
  if (Array.isArray(v)) v.forEach((x, i) => compterUndefined(x, `${chemin}[${i}]`, acc));
  else if (v && typeof v === "object") for (const k of Object.keys(v)) {
    if (v[k] === undefined) acc.push(`${chemin}.${k}`); else compterUndefined(v[k], `${chemin}.${k}`, acc);
  }
  return acc;
}

// Compte les objets partagés (même objet référencé à plusieurs endroits, ex. un mariage commun aux deux époux).
export function compterPartages(v, vus = new Set(), acc = { n: 0 }) {
  if (v && typeof v === "object") {
    if (vus.has(v)) { acc.n++; return acc; }
    vus.add(v);
    for (const k of Object.keys(v)) compterPartages(v[k], vus, acc);
  }
  return acc;
}
