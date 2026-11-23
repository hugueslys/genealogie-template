#!/usr/bin/env node
// Images de l'arbre (actes/, lieux/, photos/) dans le stockage R2 de Cloudflare (bucket nommé dans cloudflare.config.ts, liaison IMAGES).
// R2 est payant au-delà de l'offre gratuite (10 Go) : ce script refuse tout envoi qui ferait dépasser LIMITE_GO.
//
//   node outils/r2.mjs taille                 occupation du bucket (Go, nombre d'objets) et marge avant la limite
//   node outils/r2.mjs envoyer [fichiers…]    envoie les images absentes du bucket (défaut : tout actes/, lieux/, photos/)
//   node outils/r2.mjs manquantes             images référencées par les données mais absentes du bucket
//   node outils/r2.mjs telecharger [préfixe]  copie locale des images (pour ouvrir le site en local)
//
// Jeton : CLOUDFLARE_API_TOKEN ; compte : CLOUDFLARE_ACCOUNT_ID (variables d'environnement, jamais dans le dépôt).
// Dans une session cloud, le proxy peut injecter le jeton pour api.cloudflare.com.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Nom du bucket : variable R2_BUCKET, sinon celui de la liaison IMAGES dans cloudflare.config.ts.
const bucketConfig = () => { try { return (readFileSync(join(RACINE, "cloudflare.config.ts"), "utf8").match(/IMAGES:\s*bindings\.r2\(\{\s*name:\s*["']([^"']+)["']/) || [])[1]; } catch { return undefined; } };
export const BUCKET = process.env.R2_BUCKET || bucketConfig() || "mon-arbre-images";
export const LIMITE_GO = 5; // moitié de l'offre gratuite : alerte bien avant la facturation
const COMPTE = process.env.CLOUDFLARE_ACCOUNT_ID || "COMPTE_A_RENSEIGNER";
const API = `https://api.cloudflare.com/client/v4/accounts/${COMPTE}/r2/buckets/${BUCKET}`;
const DOSSIERS = ["actes", "lieux", "photos"];
const AUTH = ["-H", `Authorization: Bearer ${process.env.CLOUDFLARE_API_TOKEN || "x"}`];
const curl = (args, opts = {}) => execFileSync("curl", ["-sS", "--retry", "3", ...AUTH, ...args], { maxBuffer: 1 << 28, ...opts });

export function lister() {
  const objets = new Map(); let cursor = "";
  do {
    const j = JSON.parse(curl([`${API}/objects?per_page=1000${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`]).toString());
    if (!j.success) throw new Error("R2 : " + JSON.stringify(j.errors));
    for (const o of j.result) objets.set(o.key, o.size);
    cursor = j.result_info && j.result_info.is_truncated ? j.result_info.cursor : "";
  } while (cursor);
  return objets;
}
const go = o => o / 1024 ** 3;
const fichiersLocaux = () => DOSSIERS.filter(d => existsSync(join(RACINE, d))).flatMap(function parcours(d) {
  return readdirSync(join(RACINE, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? parcours(join(d, e.name)) : /\.(jpe?g|png|webp|gif|pdf)$/i.test(e.name) ? [join(d, e.name)] : []);
});
const type = f => /\.png$/i.test(f) ? "image/png" : /\.webp$/i.test(f) ? "image/webp" : /\.gif$/i.test(f) ? "image/gif" : /\.pdf$/i.test(f) ? "application/pdf" : "image/jpeg";

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "taille") {
  const o = lister(); const t = [...o.values()].reduce((a, b) => a + b, 0);
  console.log(`${BUCKET} : ${o.size} objets, ${go(t).toFixed(3)} Go (limite du projet ${LIMITE_GO} Go, offre gratuite 10 Go)`);
  if (go(t) > LIMITE_GO * 0.8) { console.error(`ALERTE : plus de 80 % de la limite de ${LIMITE_GO} Go.`); process.exit(2); }
} else if (cmd === "envoyer") {
  const o = lister(); let t = [...o.values()].reduce((a, b) => a + b, 0);
  const liste = (args.length ? args.map(f => relative(RACINE, resolve(f))) : fichiersLocaux()).filter(f => !o.has(f.split("\\").join("/")));
  const ajout = liste.reduce((a, f) => a + statSync(join(RACINE, f)).size, 0);
  if (go(t + ajout) > LIMITE_GO) { console.error(`REFUS : ${go(t).toFixed(2)} Go + ${go(ajout).toFixed(2)} Go dépasserait la limite de ${LIMITE_GO} Go (voir outils/r2.mjs).`); process.exit(1); }
  let n = 0;
  for (const f of liste) {
    const cle = f.split("\\").join("/");
    if (statSync(join(RACINE, f)).size > 3 * 1024 * 1024) console.warn(`attention, image lourde (> 3 Mo) : ${cle} — passer par outils/image.py`);
    const r = JSON.parse(curl(["-X", "PUT", "-H", `Content-Type: ${type(f)}`, "--data-binary", `@${join(RACINE, f)}`, `${API}/objects/${encodeURI(cle)}`]).toString());
    if (!r.success) { console.error(`échec ${cle} : ${JSON.stringify(r.errors)}`); process.exit(1); }
    if (++n % 50 === 0) console.log(`${n}/${liste.length}`);
  }
  console.log(`${n} image(s) envoyée(s), ${go(ajout).toFixed(3)} Go ; total ${go(t + ajout).toFixed(3)} Go.`);
} else if (cmd === "manquantes") {
  const o = lister();
  const ref = new Set(execFileSync("git", ["grep", "-hoE", "(actes|lieux|photos)/[^\"' )]+\\.(jpe?g|png|webp|gif|pdf)", "--", "data", "vues.js", "recits.js", "index.html"], { cwd: RACINE }).toString().split("\n").filter(Boolean));
  const m = [...ref].filter(k => !o.has(k));
  console.log(m.length ? m.join("\n") : "Toutes les images référencées sont dans R2.");
  if (m.length) process.exit(1);
} else if (cmd === "telecharger") {
  const o = lister(); const pref = args[0] || "";
  for (const k of o.keys()) if (k.startsWith(pref) && !existsSync(join(RACINE, k))) {
    mkdirSync(dirname(join(RACINE, k)), { recursive: true });
    curl(["-o", join(RACINE, k), `${API}/objects/${encodeURI(k)}`]);
  }
  console.log("ok");
} else {
  console.log("Usage : node outils/r2.mjs taille | envoyer [fichiers…] | manquantes | telecharger [préfixe]"); process.exit(1);
}
