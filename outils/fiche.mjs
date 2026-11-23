// Lire et modifier une fiche de data/personnes/<id>.json proprement (clés rangées, JSON lisible).
// Remplace l'ajout de blocs « Vague N » à la fin de famille.js. Après modification : node outils/construire.mjs.
//
// Usage : node outils/fiche.mjs <commande> <id> [arguments] [--racine DIR] [--construire]
//   voir     <id>                      affiche la fiche (avec ses actes)
//   chercher <texte>                   liste les fiches dont l'id, les prénoms ou le nom contiennent le texte
//   evenement <id> '<json>' [--source "texte"]  ajoute une ligne à "chronologie" {"date", "lieu"?, "texte", "src"?: [n]}
//                                      (rangée par date ; --source ajoute la source à "sources" et la référence dans src)
//   remarque <id> "texte"              ajoute le texte à la fin de "remarques" (ce qui n'est pas daté)
//   note     <id> "texte"              (ancien format) ajoute le texte à la fin de "notes" : préférer evenement / remarque
//   piste    <id> "texte"              ajoute le texte à la fin de "pistes"
//   source   <id> "texte" [--debut]    ajoute une source (à la fin, ou en tête avec --debut)
//   averifier <id> "texte"             ajoute un point à "aVerifier"
//   definir  <id> <champ> <valeur>     définit un champ ; champ pointé possible (naissance.date) ;
//                                      la valeur est lue en JSON si elle est valide (["a"], 62, true, {…}), sinon comme texte
//   retirer  <id> <champ>              supprime un champ (champ pointé possible)
//   acte     <id>[,<id>…] '<json>'     ajoute un acte {"titre", "source"?, "url", "image", "douteux"?} à une ou plusieurs fiches
//   nouvelle <id> '<json>'             crée une fiche (erreur si elle existe) et l'ajoute à la fin de meta.ordre
//   lien     <id> pere|mere|union:<conjoint> '<json>'   preuve du lien {"fiab", "preuve", "raisonnement"?, "src"?} (null pour retirer)
// Options : --racine DIR (défaut : le dépôt) ; --construire relance construire.mjs après l'écriture.
// Les références (pere, mere, conjoint) vers des fiches inexistantes sont signalées, sans bloquer.
import { existsSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chemins, lireJSON, ecrireJSON, ecrireFiche, enJSON, ID_VALIDE, rangerActe } from "./donnees.mjs";
import { construire } from "./construire.mjs";
import { natureDe } from "./format2.mjs";
// Format 2 : une source est un objet { texte, nature, … } ; un acte est une image rattachée à une source.
const enSource = (f, t) => f.format === 2 ? { texte: t, nature: natureDe(t) } : t;
const texteDe = s => typeof s === "string" ? s : s.texte;

const brut = process.argv.slice(2);
const opts = new Set(brut.filter(a => a === "--debut" || a === "--construire"));
const iSrc = brut.indexOf("--source"), srcTexte = iSrc >= 0 ? brut[iSrc + 1] : null;
if (iSrc >= 0) brut.splice(iSrc, 2);
const iRac = brut.indexOf("--racine");
const racine = resolve(iRac >= 0 ? brut[iRac + 1] : join(dirname(fileURLToPath(import.meta.url)), ".."));
const args = brut.filter((a, i) => !opts.has(a) && a !== "--racine" && !(iRac >= 0 && i === iRac + 1));
const [cmd, id, ...reste] = args;
const c = chemins(racine);
// Clé de tri d'une date libre (« 12/04/1763 », « 1902 », « vers 1758 », « 11/1895 ») : année*10000 + mois*100 + jour.
function cleDate(d) {
  const t = String(d || ""), y = t.match(/\d{4}/); if (!y) return 99999999;
  const m = t.match(/(?:(\d{1,2})\/)?(\d{1,2})\/\d{4}/);
  return +y[0] * 10000 + (m ? (+m[2]) * 100 + (+(m[1] || 0)) : 0);
}
const stop = m => { console.error(m); process.exit(1); };
const aide = () => stop("Usage : node outils/fiche.mjs voir|chercher|note|piste|source|averifier|definir|retirer|acte|lien|nouvelle … (voir l'en-tête du script)");
if (!cmd || !id) aide();
if (!existsSync(c.meta)) stop(`${c.meta} introuvable : data/ n'existe pas encore (voir outils/DONNEES.md).`);

const lire = i => { if (!ID_VALIDE.test(i) || !existsSync(c.fiche(i))) stop(`Fiche inconnue : ${i}`); return lireJSON(c.fiche(i)); };
const texte = () => { const t = reste.join(" ").trim(); if (!t) stop("Texte manquant."); return t; };
const valeur = s => { try { return JSON.parse(s); } catch { return s; } };
const chemin = champ => champ.split(".");
function controler(f) {
  for (const k of ["pere", "mere", "conjoint"]) if (typeof f[k] === "string" && f[k] && !existsSync(c.fiche(f[k]))) console.warn(`Attention : ${k} = « ${f[k]} » n'a pas de fiche.`);
}
function sauver(i, f) {
  controler(f);
  ecrireFiche(racine, i, f);
  console.log(`Écrit : ${c.fiche(i)}`);
}

switch (cmd) {
  case "voir": process.stdout.write(enJSON(lire(id))); break;
  case "chercher": {
    const q = [id, ...reste].join(" ").toLowerCase();
    for (const i of lireJSON(c.meta).ordre) {
      if (!existsSync(c.fiche(i))) continue;
      const f = lireJSON(c.fiche(i)), lib = `${f.prenoms || ""} ${f.nom || ""}`.trim();
      if (`${i} ${lib}`.toLowerCase().includes(q)) console.log(`${i}\t${lib}\t${f.naissance?.date || ""}`);
    }
    break;
  }
  case "evenement": {
    const f = lire(id), e = valeur(texte());
    if (!e || typeof e !== "object" || !e.texte) { console.error("evenement : JSON {\"date\", \"texte\", \"lieu\"?, \"src\"?} attendu"); process.exit(2); }
    if (srcTexte) {
      f.sources = f.sources || [];
      let n = f.sources.findIndex(s => texteDe(s) === srcTexte) + 1;
      if (!n) { f.sources.push(enSource(f, srcTexte)); n = f.sources.length; }
      e.src = [...new Set([...(e.src || []), n])];
    }
    f.chronologie = [...(f.chronologie || []), e].sort((a, b) => cleDate(a.date) - cleDate(b.date));
    sauver(id, f); break;
  }
  case "remarque": { const f = lire(id); f.remarques = ((f.remarques || "") + " " + texte()).trim(); sauver(id, f); break; }
  case "note": case "piste": {
    const f = lire(id), k = cmd === "note" ? "notes" : "pistes";
    f[k] = ((f[k] || "") + " " + texte()).trim(); sauver(id, f); break;
  }
  case "source": {
    const f = lire(id), s = enSource(f, texte());
    if (f.format === 2 && opts.has("--debut")) stop("Format 2 : pas de --debut (les renvois de la chronologie sont numérotés) ; la source est ajoutée à la fin.");
    f.sources = opts.has("--debut") ? [s, ...(f.sources || [])] : [...(f.sources || []), s]; sauver(id, f); break;
  }
  case "averifier": { const f = lire(id); f.aVerifier = [...(f.aVerifier || []), texte()]; sauver(id, f); break; }
  case "definir": {
    const [champ, ...v] = reste; if (!champ || !v.length) aide();
    const f = lire(id), p = chemin(champ); let o = f;
    for (const k of p.slice(0, -1)) { if (o[k] == null || typeof o[k] !== "object") o[k] = {}; o = o[k]; }
    o[p.at(-1)] = valeur(v.join(" ")); sauver(id, f); break;
  }
  case "retirer": {
    const [champ] = reste; if (!champ) aide();
    const f = lire(id), p = chemin(champ); let o = f;
    for (const k of p.slice(0, -1)) { o = o?.[k]; }
    if (!o || !(p.at(-1) in o)) stop(`Champ absent : ${champ}`);
    delete o[p.at(-1)]; sauver(id, f); break;
  }
  case "acte": {
    let a; try { a = JSON.parse(reste.join(" ")); } catch { stop("L'acte doit être un objet JSON."); }
    if (!a || typeof a !== "object" || Array.isArray(a) || !a.titre) stop("L'acte doit être un objet JSON avec au moins un « titre ».");
    if (!("url" in a)) a.url = null;
    if (a.image && !existsSync(join(racine, a.image))) console.warn(`Attention : image ${a.image} introuvable.`);
    for (const i of id.split(",")) {
      const f = lire(i);
      if (f.format === 2) {
        // L'image va sur la source de même texte si elle existe, sinon sur une nouvelle source.
        const t = a.source || a.titre, img = { titre: a.titre, ...(a.image && { image: a.image }), ...(a.url && { url: a.url }), ...(a.douteux && { douteux: true }) };
        f.sources = f.sources || [];
        const so = f.sources.find(s => texteDe(s) === t);
        if (so) so.images = [...(so.images || []), img];
        else f.sources.push({ texte: t, nature: natureDe(t), ...(a.url && { url: a.url }), images: [img] });
      } else f.actes = [...(f.actes || []), rangerActe(a)];
      sauver(i, f);
    }
    break;
  }
  case "lien": {
    // Preuve d'un lien de parenté : liens.pere, liens.mere ou unions[…].lien (voir outils/DONNEES.md, « Liens de parenté »).
    const [cible, ...v] = reste; if (!cible || !v.length) stop("Usage : lien <id> pere|mere|union:<conjoint> '{\"fiab\": \"A\", \"preuve\": \"directe\", \"src\": [2]}' (ou null pour retirer)");
    let L; try { L = JSON.parse(v.join(" ")); } catch { stop("Le lien doit être un objet JSON (ou null)."); }
    const f = lire(id);
    if (L !== null) {
      if (!L || typeof L !== "object" || Array.isArray(L)) stop("Le lien doit être un objet JSON.");
      const PREUVES = ["directe", "indirecte", "contredite", "témoignage", "arbre"];
      if (!["A", "B", "C", "D"].includes(L.fiab)) stop("fiab : A, B, C ou D.");
      if (!PREUVES.includes(L.preuve)) stop(`preuve : ${PREUVES.join(", ")}.`);
      if (["indirecte", "contredite"].includes(L.preuve) && !String(L.raisonnement || "").trim()) stop(`Une preuve « ${L.preuve} » demande un raisonnement écrit (indices, alternatives écartées, ce qui manque).`);
      const n = (f.sources || []).length;
      if (L.src !== undefined && (!Array.isArray(L.src) || L.src.some(i => !Number.isInteger(i) || i < 1 || i > n))) stop(`src : numéros de sources entre 1 et ${n}.`);
      const inconnues = Object.keys(L).filter(k => !["fiab", "preuve", "raisonnement", "src"].includes(k));
      if (inconnues.length) stop(`Clés inconnues : ${inconnues.join(", ")}.`);
    }
    if (cible === "pere" || cible === "mere") {
      if (!f[cible] && L !== null) console.warn(`Attention : ${id} n'a pas de ${cible}.`);
      f.liens = f.liens && !Array.isArray(f.liens) ? f.liens : {};
      if (L === null) delete f.liens[cible]; else f.liens[cible] = L;
      if (!Object.keys(f.liens).length) delete f.liens;
    } else if (cible.startsWith("union:")) {
      const cj = cible.slice(6), u = (f.unions || []).find(x => x.conjoint === cj);
      if (!u) stop(`Pas d'union avec « ${cj} » dans ${id}.`);
      if (L === null) delete u.lien; else u.lien = L;
    } else stop("Cible : pere, mere ou union:<conjoint>.");
    sauver(id, f); break;
  }
  case "nouvelle": {
    if (!ID_VALIDE.test(id)) stop(`Identifiant invalide : ${id} (lettres, chiffres, _ et - seulement).`);
    if (existsSync(c.fiche(id))) stop(`La fiche ${id} existe déjà.`);
    let f; try { f = JSON.parse(reste.join(" ")); } catch { stop("La fiche doit être un objet JSON."); }
    if (!f || typeof f !== "object" || Array.isArray(f)) stop("La fiche doit être un objet JSON.");
    sauver(id, f);
    const meta = lireJSON(c.meta); meta.ordre.push(id); ecrireJSON(c.meta, meta);
    break;
  }
  default: aide();
}

if (opts.has("--construire") && cmd !== "voir" && cmd !== "chercher") {
  const r = construire(racine);
  for (const f of ["famille.js", "actes.js"]) writeFileSync(join(racine, f), r[f], "utf8");
  console.log("famille.js et actes.js régénérés.");
}
