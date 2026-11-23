#!/usr/bin/env node
// Contrôle d'intégrité des données de l'arbre (famille.js, actes.js, vues.js, recits.js, lieux).
// Usage : node outils/verifier.mjs [--json]
// Code de sortie : 1 s'il y a au moins une ERREUR, 0 sinon (les AVERTISSEMENTS ne bloquent pas).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JSON_OUT = process.argv.includes("--json");
const UN_MO = 1024 * 1024;

const problemes = [];
const ERR = "ERREUR", AV = "AVERTISSEMENT";
const signaler = (niveau, type, id, message) => problemes.push({ niveau, type, id: id ?? null, message });

// ---------- Chargement des fichiers JS dans un même contexte (comme le navigateur) ----------
const ctx = vm.createContext({ window: {}, console });
ctx.window.window = ctx.window;
function executer(fichier, obligatoire = true) {
  const p = path.join(RACINE, fichier);
  if (!fs.existsSync(p)) {
    if (obligatoire) signaler(ERR, "fichier", fichier, `Fichier ${fichier} introuvable.`);
    return false;
  }
  try {
    vm.runInContext(fs.readFileSync(p, "utf8"), ctx, { filename: fichier });
    return true;
  } catch (e) {
    signaler(ERR, "execution", fichier, `${fichier} ne s'exécute pas : ${e.message}`);
    return false;
  }
}
// famille.js et actes.js ne sont plus versionnés : on les régénère depuis data/ avant le contrôle.
if (fs.existsSync(path.join(RACINE, "data", "personnes"))) {
  const { construire } = await import("./construire.mjs");
  const r = construire(RACINE);
  for (const f of ["famille.js", "actes.js"]) fs.writeFileSync(path.join(RACINE, f), r[f], "utf8");
}
const ok = Object.fromEntries(["famille.js", "actes.js", "vues.js", "recits.js"].map(f => [f, executer(f)]));
const aLieuxJs = fs.existsSync(path.join(RACINE, "lieux.js"));
if (aLieuxJs) executer("lieux.js");

const W = ctx.window;
const F = W.FAMILLE || {};
const P = F.personnes || {};
const ACTES = W.FAMILLE_ACTES || {};
const VUES = W.FAMILLE_VUES || {};
const RECITS = W.FAMILLE_RECITS || {};
const existe = id => Object.prototype.hasOwnProperty.call(P, id);
const nomDe = id => (existe(id) ? `${P[id].prenoms || "?"} ${P[id].nom || ""}`.trim() : id);

if (ok["famille.js"] && (!W.FAMILLE || !F.personnes)) signaler(ERR, "structure", "famille.js", "window.FAMILLE.personnes n'est pas défini.");

// ---------- Répertoire des lieux ----------
function chargerLieux() {
  if (aLieuxJs && W.FAMILLE_LIEUX && typeof W.FAMILLE_LIEUX === "object") return { lieux: W.FAMILLE_LIEUX, source: "lieux.js" };
  const html = fs.readFileSync(path.join(RACINE, "index.html"), "utf8");
  const m = html.match(/const\s+LIEUX\s*=\s*/);
  if (m) {
    let i = m.index + m[0].length;
    if (html[i] === "{") {
      // Extrait l'objet littéral par équilibrage des accolades (en sautant les chaînes).
      let prof = 0, j = i, chaine = null;
      for (; j < html.length; j++) {
        const c = html[j];
        if (chaine) { if (c === "\\") j++; else if (c === chaine) chaine = null; continue; }
        if (c === '"' || c === "'" || c === "`") chaine = c;
        else if (c === "{") prof++;
        else if (c === "}" && --prof === 0) break;
      }
      try { return { lieux: vm.runInNewContext("(" + html.slice(i, j + 1) + ")"), source: "index.html" }; }
      catch (e) { signaler(ERR, "lieux", "index.html", `Répertoire LIEUX illisible dans index.html : ${e.message}`); }
    } else if (W.FAMILLE_LIEUX) return { lieux: W.FAMILLE_LIEUX, source: "lieux.js" };
  }
  signaler(AV, "lieux", null, "Répertoire des lieux introuvable (ni lieux.js ni const LIEUX dans index.html) : lieux non contrôlés.");
  return { lieux: null, source: null };
}
const { lieux: LIEUX } = chargerLieux();
const NOMS_LIEUX = LIEUX ? Object.keys(LIEUX).sort((a, b) => b.length - a.length) : [];
// Même logique que lieuDe dans index.html : d'abord par préfixe, puis par inclusion, le nom le plus long l'emportant.
const lieuDe = e => (e && e.lieu && (NOMS_LIEUX.find(n => e.lieu.startsWith(n)) || NOMS_LIEUX.find(n => e.lieu.includes(n)))) || null;

// ---------- Dates ----------
const MOIS = "janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre";
const RE_MOIS = new RegExp(`^(?:(?:début|fin|mi-)\\s*)?(${MOIS})\\s+(\\d{4})\\b`, "i");
const NUM_MOIS = {};
"janvier février mars avril mai juin juillet août septembre octobre novembre décembre".split(" ").forEach((m, i) => (NUM_MOIS[m] = i + 1));
Object.assign(NUM_MOIS, { fevrier: 2, aout: 8, decembre: 12 });
// Renvoie { y, v } (année sûre et valeur fractionnaire pour comparer) ou null si la date n'est pas sûre.
function lireDate(ev) {
  const t = ev && typeof ev.date === "string" ? ev.date.trim() : "";
  if (!t || /\?/.test(t) || /^(vers|env|après|apres|avant|entre|ca\b|c\.|probabl|sans doute|date inconnue)/i.test(t)) return null;
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) return { y: +m[3], v: +m[3] + (+m[2] - 1) / 12 + (+m[1] - 1) / 365, precis: true };
  m = t.match(RE_MOIS);
  if (m) return { y: +m[2], v: +m[2] + (NUM_MOIS[m[1].toLowerCase()] - 0.5) / 12, precis: false };
  m = t.match(/^(\d{4})(?!\s*(?:-|–|\/|ou\b|à\b)\s*\d)\b/);
  if (m) return { y: +m[1], v: +m[1] + 0.5, precis: false };
  return null;
}
// Écart en années ; si l'une des dates n'est connue qu'à l'année, l'incertitude est d'un an.
const ecart = (a, b) => b.v - a.v;
const marge = (a, b) => (a.precis && b.precis ? 0 : 1);

// ---------- 1. Racine ----------
if (F.racine === undefined) signaler(ERR, "racine", null, "FAMILLE.racine n'est pas défini.");
else if (!existe(F.racine)) signaler(ERR, "racine", F.racine, `La racine « ${F.racine} » ne correspond à aucune fiche.`);

// ---------- 2. Liens, sexe, fiabilité, sources ----------
for (const [id, p] of Object.entries(P)) {
  for (const [champ, sexe] of [["pere", "M"], ["mere", "F"]]) {
    if (p[champ] == null) continue;
    if (!existe(p[champ])) signaler(ERR, "lien", id, `${champ} = « ${p[champ]} » : aucune fiche avec cet identifiant.`);
    else if (P[p[champ]].sexe !== sexe) signaler(ERR, "sexe", id, `${champ === "pere" ? "Le père" : "La mère"} « ${p[champ]} » (${nomDe(p[champ])}) a le sexe « ${P[p[champ]].sexe} » au lieu de ${sexe}.`);
    if (p[champ] === id) signaler(ERR, "cycle", id, `La fiche est son propre ${champ}.`);
  }
  if (p.conjoint != null) {
    if (!existe(p.conjoint)) signaler(ERR, "lien", id, `conjoint = « ${p.conjoint} » : aucune fiche avec cet identifiant.`);
    else {
      const c = P[p.conjoint];
      // Un remariage documenté (deux dates de mariage différentes) n'est pas une incohérence :
      // le modèle ne garde qu'un conjoint par fiche.
      const remariage = p.mariage && c.mariage && p.mariage.date && c.mariage.date && p.mariage.date !== c.mariage.date;
      if (c.conjoint != null && c.conjoint !== id && existe(c.conjoint) && !remariage)
        signaler(AV, "conjoint", id, `Conjoint non réciproque : ${id}.conjoint = ${p.conjoint}, mais ${p.conjoint}.conjoint = ${c.conjoint} (remariage non daté ?).`);
    }
  }
  if (!["M", "F"].includes(p.sexe)) signaler(ERR, "sexe", id, `Sexe « ${p.sexe} » invalide (attendu M ou F).`);
  if (!["A", "B", "C", "D"].includes(p.fiab)) signaler(ERR, "fiab", id, `fiab = « ${p.fiab} » : attendu A, B, C ou D.`);
  if (!p.inconnu && !(Array.isArray(p.sources) && p.sources.length) && !(ACTES[id] && ACTES[id].length))
    signaler(AV, "source", id, `Fiche sans aucune source (${nomDe(id)}).`);
  if (p.photo && !fs.existsSync(path.join(RACINE, p.photo))) signaler(AV, "image", id, `Portrait « ${p.photo} » absent du dépôt.`);
}

// ---------- 2 bis. Preuve des liens de parenté (liens.pere, liens.mere, union.lien) ----------
// Format : outils/DONNEES.md, « Liens de parenté » ; règles : recherches/METHODE.md, « Preuve des liens ».
const PREUVES = ["directe", "indirecte", "contredite", "témoignage", "arbre"];
function controlerLien(id, p, L, ou) {
  if (!L || typeof L !== "object" || Array.isArray(L)) { signaler(ERR, "preuve", id, `${ou} : objet { fiab, preuve, … } attendu.`); return; }
  if (!["A", "B", "C", "D"].includes(L.fiab)) signaler(ERR, "preuve", id, `${ou}.fiab = « ${L.fiab} » : attendu A, B, C ou D.`);
  if (!PREUVES.includes(L.preuve)) signaler(ERR, "preuve", id, `${ou}.preuve = « ${L.preuve} » : attendu ${PREUVES.join(", ")}.`);
  if (["indirecte", "contredite"].includes(L.preuve) && !(typeof L.raisonnement === "string" && L.raisonnement.trim()))
    signaler(ERR, "preuve", id, `${ou} : preuve « ${L.preuve} » sans raisonnement écrit.`);
  if (L.src !== undefined) {
    const n = Array.isArray(p.sources) ? p.sources.length : 0;
    if (!Array.isArray(L.src) || L.src.some(i => !Number.isInteger(i) || i < 1 || i > n)) signaler(ERR, "preuve", id, `${ou}.src = ${JSON.stringify(L.src)} : numéros de sources entre 1 et ${n} attendus.`);
  }
}
for (const [id, p] of Object.entries(P)) {
  const liens = p.liens && typeof p.liens === "object" && !Array.isArray(p.liens) ? p.liens : null;
  if (p.liens != null && !liens) signaler(ERR, "preuve", id, "liens : objet { pere?, mere? } attendu (les liens web vont dans aVoir).");
  for (const role of ["pere", "mere"]) {
    const L = liens && liens[role];
    if (p[role] != null && !L) signaler(AV, "preuve", id, `${role === "pere" ? "Père" : "Mère"} renseigné(e) (${p[role]}) sans liens.${role} (fiabilité et nature de la preuve du lien).`);
    if (L && p[role] == null) signaler(AV, "preuve", id, `liens.${role} présent sans ${role}.`);
    if (L) controlerLien(id, p, L, `liens.${role}`);
  }
  if (liens) for (const k of Object.keys(liens)) if (!["pere", "mere"].includes(k)) signaler(ERR, "preuve", id, `liens.${k} : seules les clés pere et mere sont permises.`);
  (p.unions || []).forEach((u, i) => { if (u && u.lien) controlerLien(id, p, u.lien, `unions[${i}].lien${u.conjoint ? ` (${u.conjoint})` : ""}`); });
}
// Règle de non-remontée : on ne remonte pas au-dessus d'un lien C ou D tant qu'il n'est pas confirmé.
const ancetresDe = (id, vus = new Set()) => {
  for (const par of existe(id) ? [P[id].pere, P[id].mere] : []) if (par && existe(par) && !vus.has(par)) { vus.add(par); ancetresDe(par, vus); }
  return vus;
};
for (const [id, p] of Object.entries(P)) for (const role of ["pere", "mere"]) {
  const L = p.liens && p.liens[role], par = p[role];
  if (!L || !["C", "D"].includes(L.fiab) || !existe(par)) continue;
  // Un autre enfant de ce parent, relié par un lien A ou B, justifie à lui seul la remontée (cas d'un collatéral).
  if (Object.entries(P).some(([e, q]) => e !== id && q[role] === par && q.liens && q.liens[role] && ["A", "B"].includes(q.liens[role].fiab))) continue;
  const au = [...ancetresDe(par)];
  if (au.length) signaler(AV, "remontee", id, `Remontée sur lien faible : ${nomDe(id)} → ${role === "pere" ? "père" : "mère"} ${par} (${nomDe(par)}), lien ${L.fiab} (${L.preuve}), ${au.length} ancêtre(s) au-dessus : ${au.slice(0, 6).join(", ")}${au.length > 6 ? ", …" : ""}.`);
}

// ---------- 3. Cycles d'ascendance ----------
{
  const etat = {}; // 1 = en cours, 2 = terminé
  const signales = new Set();
  const visiter = (id, chemin) => {
    if (!existe(id)) return;
    if (etat[id] === 2) return;
    if (etat[id] === 1) {
      const boucle = chemin.slice(chemin.indexOf(id)).concat(id);
      const cle = [...boucle].sort().join(",");
      if (!signales.has(cle)) { signales.add(cle); signaler(ERR, "cycle", id, `Cycle d'ascendance : ${boucle.join(" → ")}.`); }
      return;
    }
    etat[id] = 1; chemin.push(id);
    for (const par of [P[id].pere, P[id].mere]) if (par && par !== id) visiter(par, chemin);
    chemin.pop(); etat[id] = 2;
  };
  for (const id of Object.keys(P)) visiter(id, []);
}

// ---------- 4. Actes, vues et images ----------
const imagesReferencees = new Set();
function controlerMedias(nomTable, table) {
  for (const [id, liste] of Object.entries(table)) {
    if (!existe(id)) signaler(ERR, "id", id, `${nomTable} : l'identifiant « ${id} » ne correspond à aucune fiche.`);
    if (!Array.isArray(liste)) { signaler(ERR, "structure", id, `${nomTable}[${id}] n'est pas une liste.`); continue; }
    for (const a of liste) {
      if (!a || !a.image) continue;
      imagesReferencees.add(path.normalize(a.image));
      if (!fs.existsSync(path.join(RACINE, a.image))) imagesAbsentes.push(a.image);
    }
  }
}
const imagesAbsentes = [];
controlerMedias("FAMILLE_ACTES", ACTES);
controlerMedias("FAMILLE_VUES", VUES);
for (const p of Object.values(P)) if (p.photo) imagesReferencees.add(path.normalize(p.photo));
// Les images sont versionnées dans actes/, lieux/ et photos/ : une image référencée doit s'y trouver.
if (imagesAbsentes.length) signaler(AV, "image", null, `${imagesAbsentes.length} image(s) référencée(s) absente(s) du dépôt : ${imagesAbsentes.slice(0, 5).join(", ")}${imagesAbsentes.length > 5 ? "…" : ""}.`);

const IMG = /\.(jpe?g|png|gif|webp|avif)$/i;
for (const dossier of ["actes", "lieux", "photos"]) {
  const d = path.join(RACINE, dossier);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (!IMG.test(f)) continue;
    const rel = path.normalize(`${dossier}/${f}`);
    const taille = fs.statSync(path.join(d, f)).size;
    if (taille > UN_MO) signaler(AV, "taille", rel, `Image de ${(taille / UN_MO).toFixed(1)} Mo (plus de 1 Mo) : à recompresser.`);
    if (dossier === "actes" && !imagesReferencees.has(rel)) signaler(AV, "orpheline", rel, "Image d'acte jamais référencée dans FAMILLE_ACTES.");
  }
}

// ---------- 5. Récits ----------
function liensRecits(v, ou) {
  if (typeof v === "string") {
    for (const m of v.matchAll(/\[\[([^|\]]+)(?:\|[^\]]*)?\]\]/g))
      if (!existe(m[1].trim())) signaler(ERR, "id", m[1].trim(), `Récit (${ou}) : lien [[${m[1]}|…]] vers une fiche inexistante.`);
  } else if (Array.isArray(v)) v.forEach((x, i) => liensRecits(x, ou));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) liensRecits(x, ou);
}
for (const cle of ["vies", "epoques"]) {
  for (const [id, texte] of Object.entries(RECITS[cle] || {})) {
    if (!existe(id)) signaler(ERR, "id", id, `FAMILLE_RECITS.${cle} : l'identifiant « ${id} » ne correspond à aucune fiche.`);
    liensRecits(texte, `${cle}.${id}`);
  }
}
(RECITS.branches || []).forEach((b, i) => liensRecits(b, `branche ${b && b.id ? b.id : i}`));
for (const [id, p] of Object.entries(P)) liensRecits([p.notes, p.aVerifier, p.pistes], `notes de ${id}`);

// ---------- 6. Lieux ----------
const EVENEMENTS = { naissance: "naissance", bapteme: "baptême", mariage: "mariage", deces: "décès" };
if (LIEUX) {
  for (const [id, p] of Object.entries(P))
    for (const [ch, lib] of Object.entries(EVENEMENTS))
      if (p[ch] && p[ch].lieu && !lieuDe(p[ch])) signaler(AV, "lieu", id, `Lieu de ${lib} « ${p[ch].lieu} » non reconnu par le répertoire des lieux (absent de la carte).`);
}

// ---------- 7. Cohérence des dates ----------
for (const [id, p] of Object.entries(P)) {
  const n = lireDate(p.naissance) || lireDate(p.bapteme);
  const d = lireDate(p.deces), m = lireDate(p.mariage);
  const nom = nomDe(id);
  if (n && d && d.v < n.v && !(n.y === d.y && !(n.precis && d.precis)))
    signaler(AV, "dates", id, `${nom} : décès (${p.deces.date}) avant la naissance (${(p.naissance || p.bapteme).date}).`);
  if (n && m) {
    if (ecart(n, m) < 12 - marge(n, m)) signaler(AV, "dates", id, `${nom} : mariage (${p.mariage.date}) à moins de 12 ans (né(e) ${(p.naissance || p.bapteme).date}).`);
  }
  if (m && d && m.v > d.v && !(m.y === d.y && !(m.precis && d.precis)))
    signaler(AV, "dates", id, `${nom} : mariage (${p.mariage.date}) après le décès (${p.deces.date}).`);
  // Âge déclaré au décès (ou au mariage) comparé aux dates.
  for (const ch of ["deces", "mariage"]) {
    const ev = p[ch], e = lireDate(ev);
    const age = ev && (typeof ev.age === "number" ? ev.age : parseInt(ev.age, 10));
    if (n && e && Number.isFinite(age)) {
      const calc = ecart(n, e);
      // Avant 1850, les âges déclarés dans les actes sont souvent approximatifs : tolérance de 3 ans au lieu de 2.
      if (Math.abs(calc - age) > (e.y < 1850 ? 3 : 2) + marge(n, e))
        signaler(AV, "age", id, `${nom} : âge déclaré ${age} ans au ${ch === "deces" ? "décès" : "mariage"}, mais les dates donnent environ ${Math.floor(calc)} ans.`);
    }
  }
  // Naissance de l'enfant par rapport aux parents.
  if (!n) continue;
  for (const [ch, lib] of [["pere", "du père"], ["mere", "de la mère"]]) {
    const par = existe(p[ch]) ? P[p[ch]] : null;
    if (!par) continue;
    const np = lireDate(par.naissance) || lireDate(par.bapteme), dp = lireDate(par.deces);
    const qui = `${lib} ${p[ch]} (${nomDe(p[ch])})`;
    if (np) {
      const e = ecart(np, n);
      if (e < 0 && !(np.y === n.y && !(np.precis && n.precis))) signaler(AV, "dates", id, `${nom} naît (${(p.naissance || p.bapteme).date}) avant la naissance ${qui}, né(e) ${(par.naissance || par.bapteme).date}.`);
      else if (e < 13 - marge(np, n)) signaler(AV, "dates", id, `${nom} naît moins de 13 ans après la naissance ${qui} (${(par.naissance || par.bapteme).date} → ${(p.naissance || p.bapteme).date}).`);
      else if (ch === "mere" && e > 60 + marge(np, n)) signaler(AV, "dates", id, `${nom} naît plus de 60 ans après la naissance de sa mère ${p[ch]} (${(par.naissance || par.bapteme).date} → ${(p.naissance || p.bapteme).date}).`);
    }
    if (dp) {
      const e = ecart(dp, n); // > 0 : enfant né après le décès du parent
      const tol = ch === "pere" ? 1 : 0;
      if (e > tol + marge(dp, n) / 2 && n.y - dp.y > tol)
        signaler(AV, "dates", id, `${nom} naît (${(p.naissance || p.bapteme).date}) après le décès ${qui} (${par.deces.date})${tol ? " de plus d'un an" : ""}.`);
    }
  }
}

// ---------- Sortie ----------
const ordre = { [ERR]: 0, [AV]: 1 };
const PRIO = ["execution", "fichier", "structure", "racine", "lien", "id", "cycle", "sexe", "fiab", "preuve", "remontee", "image", "lieux", "dates", "age", "conjoint", "source", "lieu", "orpheline", "taille"];
problemes.sort((a, b) => ordre[a.niveau] - ordre[b.niveau] || PRIO.indexOf(a.type) - PRIO.indexOf(b.type) || String(a.id).localeCompare(String(b.id)));
const nbErr = problemes.filter(p => p.niveau === ERR).length;
const nbAv = problemes.length - nbErr;
const parType = {};
for (const p of problemes) parType[`${p.niveau} ${p.type}`] = (parType[`${p.niveau} ${p.type}`] || 0) + 1;

if (JSON_OUT) {
  console.log(JSON.stringify({ personnes: Object.keys(P).length, erreurs: nbErr, avertissements: nbAv, parType, problemes }, null, 2));
} else {
  const LIB = { execution: "fichier JS qui ne s'exécute pas", fichier: "fichier manquant", structure: "structure invalide", racine: "racine", lien: "lien parent/conjoint cassé", id: "identifiant inconnu (actes, vues, récits)", cycle: "cycle d'ascendance", sexe: "sexe incohérent", fiab: "fiabilité invalide", preuve: "preuve d'un lien de parenté", remontee: "remontée sur lien faible (C ou D)", image: "image absente", lieux: "répertoire des lieux", dates: "dates incohérentes", age: "âge déclaré incohérent", conjoint: "conjoint non réciproque", source: "fiche sans source", lieu: "lieu non reconnu", orpheline: "image d'acte orpheline", taille: "image de plus de 1 Mo" };
  console.log(`Vérification de ${Object.keys(P).length} fiches : ${nbErr} erreur(s), ${nbAv} avertissement(s).`);
  for (const [k, v] of Object.entries(parType)) { const [niv, t] = k.split(" "); console.log(`  ${niv.padEnd(13)} ${String(v).padStart(4)}  ${LIB[t] || t}`); }
  if (problemes.length) console.log("");
  for (const p of problemes) console.log(`[${p.niveau}] ${p.id ? p.id + " : " : ""}${p.message}`);
}
process.exitCode = nbErr ? 1 : 0;
