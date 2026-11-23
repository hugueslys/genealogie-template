#!/usr/bin/env node
// Teste en quelques secondes l'accès aux sites d'archives (liste dans outils/sites.json).
// Usage : node outils/sites.mjs [--branche <nom>] [--json] [--journal]
//   --branche  ne teste que les sites d'une branche (sans accent ni majuscule : « flandre »)
//              ou marqués « toutes ».
//   --json     sortie JSON
//   --journal  propose la colonne « Accès » du tableau de recherches/JOURNAL.md (n'écrit rien)
// Code de sortie : toujours 0. On détecte les protections, on ne les contourne jamais.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Node ne suit pas HTTPS_PROXY par défaut : on se relance une fois avec le support activé.
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxy && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1", NODE_NO_WARNINGS: "1" } });
  process.exit(0);
}

const DIR = path.dirname(fileURLToPath(import.meta.url));
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const DELAI = 10000;
const args = process.argv.slice(2);
const JSON_OUT = args.includes("--json");
const JOURNAL = args.includes("--journal");
const bi = args.indexOf("--branche");
const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const branche = bi >= 0 ? norm(args[bi + 1] ?? "") : null;
if (args.includes("--aide") || args.includes("-h")) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 8).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(0);
}

let sites = JSON.parse(fs.readFileSync(path.join(DIR, "sites.json"), "utf8"));
if (branche) sites = sites.filter((s) => s.branche.some((b) => norm(b) === branche || norm(b) === "toutes"));

const RE = {
  anubis: /making sure you.?re not a bot|techaro|v[eé]rification que vous n.{1,7}[eê]tes pas un robot/i,
  cloudflare: /just a moment|cf-chl|challenge-platform/i,
  js: /requires js enabled and cookies|enable javascript and cookies|bot_mitigation/i,
  maintenance: /maintenance/i,
  ferme: /\bferm[eé]|nouveau site|indisponible|end.of.life|n.est plus disponible/i,
  connexion: /\/(?:login|connexion|signin|sign-in|auth)\b/i,
};

async function tester(s) {
  const t0 = Date.now();
  const res = { nom: s.nom, url: s.url, branche: s.branche, surveiller: !!s.surveiller, etat: "", detail: "" };
  try {
    const r = await fetch(s.url, { headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "fr,en;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(DELAI) });
    const corps = (await r.text()).slice(0, 300000);
    const court = corps.length < 20000;
    const decode = (t) => t.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, "&");
    const titre = decode(corps.match(/<title[^>]*>([^<]*)/i)?.[1] || "").trim().replace(/\s+/g, " ").slice(0, 60);
    const fin = new URL(r.url);
    const deplace = fin.host !== new URL(s.url).host ? ` → ${fin.host}${fin.pathname}` : "";
    const ms = Date.now() - t0;
    let etat, detail;
    if (RE.anubis.test(corps)) [etat, detail] = ["anti-robot", "Anubis (défi JavaScript)"];
    else if (r.headers.get("cf-mitigated") === "challenge" || (court && RE.cloudflare.test(corps))) [etat, detail] = ["anti-robot", "Cloudflare (défi)"];
    else if (court && RE.js.test(corps)) [etat, detail] = ["anti-robot", "JavaScript et cookies exigés"];
    else if (r.status === 401 || RE.connexion.test(fin.pathname)) [etat, detail] = ["compte requis", `${r.status}${deplace}`];
    else if (r.status === 503 || (r.status >= 500 && RE.maintenance.test(corps))) [etat, detail] = ["maintenance", `${r.status} ${titre}`.trim()];
    else if (r.status === 403 || r.status === 429) [etat, detail] = ["anti-robot", `${r.status} (refus ou limite du serveur)` + deplace];
    else if (r.status >= 400) [etat, detail] = ["injoignable", `HTTP ${r.status} ${titre}`.trim()];
    else if (RE.maintenance.test(titre) || (corps.length < 8000 && RE.maintenance.test(corps))) [etat, detail] = ["maintenance", titre || "texte « maintenance »"];
    else if (RE.ferme.test(titre) || RE.ferme.test(fin.pathname) || (deplace && corps.length < 8000 && RE.ferme.test(corps))) [etat, detail] = ["fermé/avis", (titre || "avis") + deplace];
    else [etat, detail] = ["OK", `${r.status}${deplace} ${titre}`.trim()];
    Object.assign(res, { etat, detail: `${detail} (${ms} ms)`, statut: r.status });
  } catch (e) {
    const c = e.cause || e;
    const code = c.code || e.name;
    const msg = String(c.message || e.message);
    if (e.name === "TimeoutError" || code === "ABORT_ERR") [res.etat, res.detail] = ["injoignable", `délai dépassé (${DELAI / 1000} s)`];
    else if (/certificate|UNABLE_TO_VERIFY/i.test(msg)) [res.etat, res.detail] = ["injoignable", "certificat TLS invalide (chaîne incomplète)"];
    else if (/403|Forbidden|tunnel|proxy/i.test(msg)) [res.etat, res.detail] = ["injoignable", `proxy : ${msg.slice(0, 70)}`];
    else if (code === "ENOTFOUND" || code === "EAI_AGAIN") [res.etat, res.detail] = ["injoignable", "DNS : nom inconnu"];
    else [res.etat, res.detail] = ["injoignable", `${code} ${msg}`.slice(0, 80)];
  }
  return res;
}

const resultats = await Promise.all(sites.map(tester));

if (JSON_OUT) {
  console.log(JSON.stringify({ date: new Date().toISOString(), branche: branche || null, resultats }, null, 2));
} else if (JOURNAL) {
  const d = new Date(), jj = String(d.getDate()).padStart(2, "0"), mm = String(d.getMonth() + 1).padStart(2, "0");
  const date = `${jj}/${mm}/${d.getFullYear()}`;
  const icone = { "OK": "✅", "anti-robot": "⛔ bloqué", "compte requis": "🔑 compte requis", "maintenance": "⚠️ en maintenance", "fermé/avis": "⛔ fermé", "injoignable": "❌ injoignable" };
  console.log(`Proposition pour la colonne « Accès automatique » (testé le ${date}, à recopier à la main dans recherches/JOURNAL.md, section 1) :\n`);
  console.log("| Source | Accès automatique |\n|---|---|");
  for (const r of resultats) console.log(`| ${r.nom} | ${icone[r.etat]} le ${date}${r.etat === "OK" ? "" : " : " + r.detail.replace(/ \(\d+ ms\)$/, "")} |`);
} else {
  const w = Math.max(...resultats.map((r) => r.nom.length));
  console.log(`${"Site".padEnd(w)}  ${"État".padEnd(14)}  Détail`);
  for (const r of resultats) console.log(`${r.nom.padEnd(w)}  ${r.etat.padEnd(14)}  ${r.detail}`);
  const n = {};
  for (const r of resultats) n[r.etat] = (n[r.etat] || 0) + 1;
  console.log("\n" + Object.entries(n).map(([k, v]) => `${v} ${k}`).join(", "));
}
