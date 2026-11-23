// Assemble le paquet du Worker du site (nom dans cloudflare.config.ts) au format Build Output de Cloudflare (.cloudflare/output/v1), déployé
// ensuite par `npx cf deploy --prebuilt` (voir deployer.sh). Lancé après la production de public/ et des partages.
//
//   node outils/cloudflare.mjs                 écrit .cloudflare/output/v1 (config, worker/*.js + donnees.js, public/)
//   node outils/cloudflare.mjs --donnees F     écrit seulement les données du Worker dans le fichier F (tests)
//
// donnees.js (dans le paquet, jamais dans public/) : pour chaque partage, les identifiants des fiches réellement
// publiées (lus dans public/partage/<nom>/famille.js), celles des vivants masqués, les membres et l'audience Access ;
// les administrateurs ; le nom de chaque fiche (titre des tickets GitHub). Voir outils/PARTAGES.md, « Commentaires ».
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { executer } from "./donnees.mjs";

const DEPOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function donneesWorker({ depot = DEPOT, publicDir = join(DEPOT, "public") } = {}) {
  const conf = JSON.parse(readFileSync(join(depot, "partages.json"), "utf8"));
  const c = conf.commentaires || {};
  const lire = f => executer([f]).ctx.FAMILLE.personnes;
  const tous = lire(join(publicDir, "famille.js"));
  const nom = p => p.inconnu ? (p.role || "Personne à identifier") : [p.prenoms, p.nomNaissance || p.nom].filter(Boolean).join(" ");
  const partages = {};
  for (const p of conf.partages) {
    const f = join(publicDir, "partage", p.nom, "famille.js");
    if (!existsSync(f)) throw new Error(`${f} absent : lancer d'abord node outils/partager.mjs --sortie public/partage`);
    const P = lire(f);
    partages[p.nom] = {
      fiches: Object.keys(P),
      // Images autorisées dans ce partage (écrites par outils/partager.mjs) : worker/images.js ne sert que celles-ci.
      images: existsSync(join(depot, ".partages", `${p.nom}-images.json`)) ? JSON.parse(readFileSync(join(depot, ".partages", `${p.nom}-images.json`), "utf8")) : [],
      vivants: Object.keys(P).filter(id => P[id].vivant),
      membres: Object.fromEntries(Object.entries(p.membres || {}).map(([e, n]) => [e.toLowerCase(), n])),
      // Jeton d'un partage : AUD de son application Access ou de celle du site complet (administrateur, partage sans application).
      aud: [...new Set([...[].concat(p.accessAud || []), ...[].concat(c.accessAudRacine || [])])],
    };
  }
  return {
    equipe: c.equipeAccess || "",
    audRacine: [].concat(c.accessAudRacine || []),
    administrateurs: (c.administrateurs || []).map(e => e.toLowerCase()),
    noms: Object.fromEntries(Object.entries(tous).map(([id, p]) => [id, nom(p)])),
    partages,
  };
}
export const moduleDonnees = D => `// FICHIER GÉNÉRÉ par outils/cloudflare.mjs : données du Worker (jamais servies telles quelles).\nexport default ${JSON.stringify(D)};\n`;

async function assembler() {
  const { loadAndParseConfig, SettingsSchema } = await import("@cloudflare/config");
  const { cleanBuildOutputDir, writeRootConfig, writeWorkerConfig, writeAssets, getWorkerBundleDir } = await import("@cloudflare/build-output-utils");
  const ctx = { isPreview: false, mode: undefined };
  const { result } = await loadAndParseConfig(join(DEPOT, "cloudflare.config.ts"), ctx);
  if (!result.success) throw new Error("cloudflare.config.ts invalide : " + JSON.stringify(result.error.issues, null, 1));
  const { worker } = result.data;
  await cleanBuildOutputDir(DEPOT);
  await writeRootConfig({ root: DEPOT, settings: SettingsSchema.parse(result.data), buildContext: ctx, producer: { name: "genealogie/outils/cloudflare.mjs", version: "1" } });
  const bundle = getWorkerBundleDir(DEPOT);
  mkdirSync(bundle, { recursive: true });
  for (const f of readdirSync(join(DEPOT, "worker"))) if (/\.js$/.test(f) && f !== "donnees.js") copyFileSync(join(DEPOT, "worker", f), join(bundle, f));
  const D = donneesWorker();
  writeFileSync(join(bundle, "donnees.js"), moduleDonnees(D));
  await writeWorkerConfig({ root: DEPOT, config: worker, manifest: { type: "partial", mainModule: "index.js", modules: {} } });
  await writeAssets({ root: DEPOT, sourceDirectory: join(DEPOT, "public") });
  const n = Object.entries(D.partages).map(([k, p]) => `${k} ${p.fiches.length} fiches`).join(", ");
  console.log(`Paquet du Worker écrit dans .cloudflare/output/v1 (${n} ; ${D.administrateurs.length} administrateur(s) dans partages.json).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), i = args.indexOf("--donnees");
  if (i >= 0) writeFileSync(resolve(args[i + 1]), moduleDonnees(donneesWorker()));
  else await assembler();
}
