#!/usr/bin/env node
// Synchronise le gabarit avec le projet d'origine (un arbre réel, dépôt privé) : reprend les changements des fichiers
// génériques (outils, méthode, site, skills) sans jamais reprendre de données de famille. Lancé par outils/gabarit.sh.
//
//   sh outils/gabarit.sh <dépôt d'origine> [--essai] [--ref <commit>] [--garder] [--resolu <fichier>]…
//     --essai   montre ce qui changerait (diff), sans rien commiter
//     --ref     commit du dépôt d'origine à reprendre (défaut : HEAD)
//     --garder  en cas d'échec, garde le dossier de travail temporaire pour regarder (conflits, fuites)
//     --resolu  fichier déjà reporté à la main dans le gabarit après un conflit : il n'est pas fusionné (option répétable)
//
// Principe (détails : README, « Mettre à jour depuis le projet d'origine ») :
//   1. outils/gabarit.base contient le commit du dépôt d'origine dont le gabarit est issu ;
//   2. pour chaque fichier « + » de outils/gabarit.liste modifié depuis ce commit, fusion à trois voies (git merge-file) :
//      le changement fait dans le dépôt d'origine est rejoué sur la version générique du gabarit. Les adaptations déjà
//      faites dans le gabarit sont donc gardées. Un conflit arrête tout ;
//   3. remplacements de outils/gabarit.local (fichier local, jamais commité : il contient des noms réels) ;
//   4. contrôle des fuites : noms de famille des fiches d'origine, prénom et nom de la racine, noms des partages,
//      e-mails, identifiants Cloudflare et compte GitHub, tous lus dans le dépôt d'origine au moment de la synchro.
//      Une fuite arrête tout, sans rien commiter ;
//   5. construire.mjs, verifier.mjs et les tests du Worker sur les fiches fictives ;
//   6. diff, puis commit local (avec outils/gabarit.base mis à jour). Le script ne pousse jamais.
// Tout se passe dans un worktree git temporaire : en cas d'échec, le dossier du gabarit n'est pas touché.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const GABARIT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const drapeau = n => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
const option = n => { const i = args.indexOf(n); return i < 0 ? null : args.splice(i, 2)[1]; };
const essai = drapeau("--essai"), garder = drapeau("--garder"), ref = option("--ref") || "HEAD";
const resolus = new Set(); for (let r; (r = option("--resolu"));) resolus.add(r.replace(/^\.\//, ""));
const ORIGINE = args[0] && resolve(args[0]);
if (!ORIGINE) { console.error("Usage : sh outils/gabarit.sh <chemin du dépôt d'origine> [--essai] [--ref <commit>] [--garder] [--resolu <fichier>]…"); process.exit(2); }

const git = (dir, ...a) => execFileSync("git", ["-C", dir, ...a], { maxBuffer: 1 << 28 }).toString();
const gitBuf = (dir, ...a) => { try { return execFileSync("git", ["-C", dir, ...a], { maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] }); } catch { return null; } };
const stop = (msg, code = 1) => { console.error("\n" + msg); nettoyer(code !== 0 && garder); process.exit(code); };
let travail = null;
function nettoyer(conserver) {
  if (!travail) return;
  if (conserver) { console.error(`Dossier de travail gardé : ${travail} (à retirer ensuite : git worktree remove --force ${travail})`); return; }
  spawnSync("git", ["-C", GABARIT, "worktree", "remove", "--force", travail]);
  travail = null;
}

// ---------- Vérifications de départ ----------
if (!existsSync(join(ORIGINE, ".git"))) stop(`${ORIGINE} n'est pas un dépôt git.`, 2);
if (resolve(ORIGINE) === GABARIT) stop("Le dépôt d'origine ne peut pas être le gabarit lui-même.", 2);
if (git(GABARIT, "status", "--porcelain", "--untracked-files=no").trim()) stop("Le gabarit a des modifications non commitées : les commiter ou les annuler d'abord.", 2);
const fichierBase = join(GABARIT, "outils", "gabarit.base");
if (!existsSync(fichierBase)) stop("outils/gabarit.base absent : y écrire le commit du dépôt d'origine dont le gabarit est issu.", 2);
const BASE = readFileSync(fichierBase, "utf8").split(/\s+/)[0];
const CIBLE = git(ORIGINE, "rev-parse", ref).trim();
if (!gitBuf(ORIGINE, "cat-file", "-e", BASE + "^{commit}")) stop(`Le commit de base ${BASE} est introuvable dans ${ORIGINE}.`, 2);
if (git(ORIGINE, "rev-parse", BASE).trim() === CIBLE) { console.log(`Déjà à jour avec ${CIBLE.slice(0, 7)}.`); process.exit(0); }

// ---------- Règles ----------
const DONNEES = /^(data\/personnes|data\/actes-orphelins\.json|actes|photos|lieux|courriers|entretiens|recherches\/journal|recherches\/lectures)(\/|$)/;
const motifVersRegex = m => new RegExp("^" + m.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/?/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]").replace(/\u0000/g, ".*") + "$");
const regles = readFileSync(join(GABARIT, "outils", "gabarit.liste"), "utf8").split("\n").map(l => l.trim()).filter(l => /^[-+=]\s+\S/.test(l)).map(l => ({ type: l[0], re: motifVersRegex(l.slice(1).trim()) }));
const classer = f => { if (DONNEES.test(f)) return "donnees"; let t = null; for (const r of regles) if (r.re.test(f)) t = r.type; return t; };

// Fichier local (non versionné) : remplacements « ancien => nouveau », termes interdits « ! terme », mots courants acceptés « ? mot ».
const local = { remplacements: [], interdits: [], acceptes: [] };
const fichierLocal = join(GABARIT, "outils", "gabarit.local");
if (existsSync(fichierLocal)) for (const l of readFileSync(fichierLocal, "utf8").split("\n")) {
  if (/^\s*(#|$)/.test(l)) continue;
  const m = l.match(/^(.*?)\s=>\s(.*)$/);
  if (m) local.remplacements.push([m[1].trim(), m[2].trim()]);
  else if (/^\s*!\s*\S/.test(l)) local.interdits.push(l.replace(/^\s*!\s*/, "").trim());
  else if (/^\s*\?\s*\S/.test(l)) local.acceptes.push(l.replace(/^\s*\?\s*/, "").trim());
} else console.warn("(outils/gabarit.local absent : aucun remplacement automatique ; voir outils/gabarit.local.exemple)");

// ---------- Fichiers changés dans le dépôt d'origine ----------
const changes = git(ORIGINE, "diff", "--no-renames", "--name-status", BASE, CIBLE).trim().split("\n").filter(Boolean).map(l => { const [s, f] = l.split("\t"); return { s: s[0], f }; });
const aSync = [], aLaMain = [], nonClasses = [], supprimes = [];
for (const c of changes) {
  const t = classer(c.f);
  if (t === "donnees" || t === "-") continue;
  if (t === "=") aLaMain.push(c);
  else if (t === "+" && resolus.has(c.f)) console.log(`(résolu à la main, non fusionné : ${c.f})`);
  else if (t === "+") (c.s === "D" ? supprimes : aSync).push(c);
  else nonClasses.push(c);
}
console.log(`Dépôt d'origine : ${BASE.slice(0, 7)} → ${CIBLE.slice(0, 7)} ; ${aSync.length} fichier(s) à reprendre.`);

// ---------- Fusion dans un worktree temporaire ----------
travail = mkdtempSync(join(tmpdir(), "gabarit-"));
git(GABARIT, "worktree", "add", "--detach", "--quiet", travail, "HEAD");
const binaire = b => b && b.includes(0);
const ecrits = [], conflits = [];
for (const { s, f } of aSync) {
  const theirs = gitBuf(ORIGINE, "show", `${CIBLE}:${f}`), base = s === "A" ? null : gitBuf(ORIGINE, "show", `${BASE}:${f}`);
  const chemin = join(travail, f), ours = existsSync(chemin) ? readFileSync(chemin) : null;
  let resultat;
  if (!ours || (base && ours.equals(base))) resultat = theirs; // fichier absent du gabarit, ou jamais adapté : on prend la nouvelle version
  else if (ours.equals(theirs)) continue;
  else if (binaire(ours) || binaire(theirs) || !base) { conflits.push(f); continue; }
  else {
    const d = mkdtempSync(join(tmpdir(), "gabarit-fusion-"));
    writeFileSync(join(d, "gabarit"), ours); writeFileSync(join(d, "base"), base); writeFileSync(join(d, "origine"), theirs);
    const r = spawnSync("git", ["merge-file", "-p", "-L", "gabarit", "-L", "base", "-L", "origine", join(d, "gabarit"), join(d, "base"), join(d, "origine")], { maxBuffer: 1 << 28 });
    rmSync(d, { recursive: true, force: true });
    if (r.status !== 0) { conflits.push(f); if (garder) { mkdirSync(dirname(chemin), { recursive: true }); writeFileSync(chemin, r.stdout); } continue; }
    resultat = r.stdout;
  }
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, resultat);
  ecrits.push(f);
}
if (conflits.length) stop(`CONFLIT : ces fichiers ont changé des deux côtés au même endroit, à reprendre à la main (rien n'est commité) :\n  ${conflits.join("\n  ")}\nPour comparer : git -C ${ORIGINE} diff ${BASE.slice(0, 7)} ${CIBLE.slice(0, 7)} -- <fichier>\nAprès avoir reporté le changement à la main dans le gabarit (et commité), relancer avec --resolu <fichier>.`);

// ---------- Remplacements ----------
for (const f of ecrits) {
  const p = join(travail, f), b = readFileSync(p);
  if (binaire(b)) continue;
  let t = b.toString("utf8");
  for (const [a, n] of local.remplacements) t = t.split(a).join(n);
  writeFileSync(p, t);
}

// ---------- Contrôle des fuites ----------
const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const lireOrigine = f => { const b = gitBuf(ORIGINE, "show", `${CIBLE}:${f}`); return b ? b.toString("utf8") : ""; };
const json = t => { try { return JSON.parse(t); } catch { return null; } };
const noms = new Set(), interdits = new Set(local.interdits.map(norm));
for (const n of readdirSync(join(ORIGINE, "data", "personnes")).filter(n => n.endsWith(".json"))) {
  const p = json(readFileSync(join(ORIGINE, "data", "personnes", n), "utf8")) || {};
  for (const x of [p.nom, p.nomNaissance].filter(Boolean).join(" ").split(/[\s,/()'’-]+/)) if (x.length >= 3) noms.add(norm(x));
}
const meta = json(lireOrigine("data/meta.json")) || {}, racine = meta.famille && meta.famille.racine;
if (racine) {
  interdits.add(norm(racine));
  const r = json(readFileSync(join(ORIGINE, "data", "personnes", racine + ".json"), "utf8")) || {};
  for (const x of [r.prenoms, r.nom].filter(Boolean).join(" ").split(/\s+/)) if (x.length >= 3) interdits.add(norm(x));
}
const partages = json(lireOrigine("partages.json")) || {};
for (const p of partages.partages || []) {
  interdits.add(norm(p.nom));
  for (const a of [].concat(p.accessAud || [])) interdits.add(norm(a));
  for (const e of Object.keys(p.membres || {})) interdits.add(norm(e));
}
const cm = partages.commentaires || {};
for (const x of [cm.equipeAccess, ...[].concat(cm.administrateurs || []), ...[].concat(cm.accessAudRacine || [])].filter(Boolean)) interdits.add(norm(x));
const config = ["cloudflare.config.ts", "outils/r2.mjs", "outils/commentaires.mjs", ...git(ORIGINE, "ls-tree", "--name-only", CIBLE, ".github/workflows/").split("\n").filter(Boolean)].map(lireOrigine).join("\n");
for (const m of config.matchAll(/\b[0-9a-f]{32,64}\b/g)) interdits.add(m[0]);
for (const m of (lireOrigine("cloudflare.config.ts").match(/name:\s*["'][^"']+["']/g) || [])) interdits.add(norm(m.replace(/^name:\s*["']|["']$/g, "")));
const remote = (gitBuf(ORIGINE, "remote", "get-url", "origin") || "").toString().match(/[:/]([^/:]+)\/[^/]+?(\.git)?\s*$/);
if (remote) interdits.add(norm(remote[1]));
const courriel = (gitBuf(ORIGINE, "config", "user.email") || "").toString().trim();
if (courriel) interdits.add(norm(courriel));
for (const x of [...interdits]) if (!x || x.length < 3) interdits.delete(x);
// Noms de famille qui sont aussi des mots courants : acceptés s'ils figurent déjà dans le gabarit validé (ex. « les »).
const dejaLa = new Set(), acceptes = new Set(local.acceptes.map(norm));
const textesGabarit = git(GABARIT, "ls-files").split("\n").filter(f => f && !/\.(png|jpe?g)$|package-lock\.json$/.test(f)).map(f => norm((gitBuf(GABARIT, "show", `HEAD:${f}`) || "").toString("utf8")));
for (const n of noms) if (acceptes.has(n) || textesGabarit.some(t => mot(n).test(t))) dejaLa.add(n);
function mot(w) { return new RegExp("(?<![a-z0-9])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-z0-9])"); }
const termes = [...[...interdits].map(t => [t, mot(t)]), ...[...noms].filter(n => !dejaLa.has(n) && !interdits.has(n)).map(n => [n, mot(n)])];
const fuites = [];
for (const f of ecrits) {
  const b = readFileSync(join(travail, f)); if (binaire(b)) continue;
  b.toString("utf8").split("\n").forEach((l, i) => { const nl = norm(l); for (const [t, re] of termes) if (re.test(nl)) fuites.push(`${f}:${i + 1} « ${t} » : ${l.trim().slice(0, 120)}`); });
}
if (fuites.length) stop(`FUITE : des noms ou identifiants du projet d'origine apparaissent dans les fichiers repris (rien n'est commité).\n  ${fuites.join("\n  ")}\nÀ corriger : ajouter un remplacement dans outils/gabarit.local, ou reprendre le fichier à la main. Mot courant légitime : « ? mot » dans outils/gabarit.local.`);

// ---------- Contrôles sur les fiches fictives ----------
const etape = (nom, cmd, a) => {
  const r = spawnSync(cmd, a, { cwd: travail, encoding: "utf8", maxBuffer: 1 << 26 });
  const sortie = (r.stdout || "") + (r.stderr || "");
  console.log(`${r.status === 0 ? "OK " : "ÉCHEC"} ${nom}${r.status === 0 ? "" : "\n" + sortie.split("\n").slice(-25).join("\n")}`);
  if (r.status !== 0) stop(`Le contrôle « ${nom} » échoue après la reprise : rien n'est commité.`);
};
etape("construire.mjs", process.execPath, ["outils/construire.mjs"]);
etape("verifier.mjs", process.execPath, ["outils/verifier.mjs"]);
if (existsSync(join(travail, "worker", "test.mjs"))) etape("tests du Worker", process.execPath, ["--test", "worker/test.mjs"]);

// ---------- Diff et commit ----------
writeFileSync(join(travail, "outils", "gabarit.base"), CIBLE + "\n");
git(travail, "add", "--", ...ecrits, "outils/gabarit.base");
console.log("\n" + git(travail, "-c", "color.ui=never", "diff", "--cached", "--stat"));
console.log(git(travail, "-c", "color.ui=never", "diff", "--cached", "--", ...ecrits));
const rapport = () => {
  if (aLaMain.length) console.log(`À regarder à la main (changés dans le dépôt d'origine, jamais copiés) :\n  ${aLaMain.map(c => c.s + " " + c.f).join("\n  ")}\n  Pour voir : git -C ${ORIGINE} diff ${BASE.slice(0, 7)} ${CIBLE.slice(0, 7)} -- <fichier>`);
  if (supprimes.length) console.log(`Supprimés dans le dépôt d'origine (à supprimer à la main si besoin) :\n  ${supprimes.map(c => c.f).join("\n  ")}`);
  if (nonClasses.length) console.log(`Non classés (à ajouter dans outils/gabarit.liste : + , - ou =) :\n  ${nonClasses.map(c => c.s + " " + c.f).join("\n  ")}`);
};
if (essai) { console.log("Essai : rien n'est commité."); rapport(); nettoyer(false); process.exit(0); }
git(travail, "commit", "--quiet", "-m", `Synchro avec le projet d'origine (${CIBLE.slice(0, 7)})\n\nFichiers repris : ${ecrits.length ? ecrits.join(", ") : "aucun"}.`);
const sha = git(travail, "rev-parse", "HEAD").trim();
nettoyer(false);
git(GABARIT, "merge", "--ff-only", "--quiet", sha);
console.log(`Commit local ${sha.slice(0, 7)} (rien n'est poussé).`);
rapport();
