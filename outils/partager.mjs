// Produit les « partages » : des versions réduites du site, une par branche de famille, définies dans partages.json.
// Chaque partage ne contient que les personnes de son périmètre ; les personnes vivantes y sont masquées.
// Voir outils/PARTAGES.md (format du périmètre, règle de masquage, mise en ligne).
//
// Usage :
//   node outils/partager.mjs                     tous les partages → public/partage/<nom>/
//   node outils/partager.mjs cousins             un seul partage
//   node outils/partager.mjs --sortie DIR        écrit DIR/<nom>/ (défaut : public/partage)
//   node outils/partager.mjs --liste             affiche les personnes de chaque partage, sans rien écrire
//
// Après écriture, chaque partage est contrôlé (fonction controler) : identifiants et noms des personnes exclues,
// dates des personnes vivantes, images non référencées. Le moindre problème fait échouer le script (code 1).
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { lireDonnees, assembler, executer } from "./donnees.mjs";
import { ecrireFamille, ecrireActes } from "./construire.mjs";
import { versGedcom } from "../gedcom.mjs";

const DEPOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ANNEE = new Date().getFullYear();
const LIEN = /\[\[([^|\]]+)\|([^\]]+)\]\]/g;

// ---------- Liens de famille (sur toutes les fiches, avant filtrage) ----------
export function graphe(fiches) {
  const parents = id => { const f = fiches.get(id); return f ? [f.pere, f.mere].filter(x => x && fiches.has(x)) : []; };
  const enfants = new Map(), conjoints = new Map();
  const ajouter = (m, a, b) => { if (!m.has(a)) m.set(a, new Set()); m.get(a).add(b); };
  for (const [id, f] of fiches) {
    for (const p of [f.pere, f.mere]) if (p && fiches.has(p)) ajouter(enfants, p, id);
    const cs = [f.conjoint, ...(f.unions || []).map(u => u && u.conjoint)].filter(c => c && fiches.has(c) && c !== id);
    for (const c of cs) { ajouter(conjoints, id, c); ajouter(conjoints, c, id); }
  }
  return { parents, enfants: id => [...(enfants.get(id) || [])], conjoints: id => [...(conjoints.get(id) || [])] };
}

// Périmètre d'un partage : rend { inclus: Set, ancetres: Set }.
//   ancetresDe: [ids]          ces personnes et tous leurs ancêtres
//   descendantsDe: [ids]       ces personnes et tous leurs descendants
//   descendantsDesAncetres     tous les descendants de chaque ancêtre trouvé (frères, oncles, cousins…)
//   conjoints                  ajoute les conjoints de toutes les personnes retenues (un seul niveau)
//   personnes: [ids]           personnes ajoutées une à une (avant les conjoints)
//   exclure: [ids]             personnes retirées à la fin, quoi qu'il arrive
export function perimetre(fiches, def) {
  const g = graphe(fiches), inclus = new Set(), ancetres = new Set();
  const verifier = (ids, cle) => { for (const id of ids || []) if (!fiches.has(id)) throw new Error(`perimetre.${cle} : fiche inconnue « ${id} »`); return ids || []; };
  const monter = id => { if (ancetres.has(id)) return; ancetres.add(id); g.parents(id).forEach(monter); };
  verifier(def.ancetresDe, "ancetresDe").forEach(monter);
  ancetres.forEach(a => inclus.add(a));
  const descendre = id => { inclus.add(id); for (const e of g.enfants(id)) if (!inclus.has(e)) descendre(e); };
  verifier(def.descendantsDe, "descendantsDe").forEach(descendre);
  if (def.descendantsDesAncetres) [...ancetres].forEach(descendre);
  verifier(def.personnes, "personnes").forEach(id => inclus.add(id));
  if (def.conjoints) for (const id of [...inclus]) g.conjoints(id).forEach(c => inclus.add(c));
  verifier(def.exclure, "exclure").forEach(id => inclus.delete(id));
  return { inclus, ancetres };
}

// ---------- Personnes vivantes ----------
// Année d'un événement : tri (AAAA-MM-JJ) sinon première année à 4 chiffres du texte.
export const anneeDe = e => { if (!e) return null; const m = String(e.tri || e.date || "").match(/\d{4}/); return m ? +m[0] : null; };
// Vivante = sans décès ni inhumation connus, et : née il y a moins de 100 ans ; ou sans date de naissance avec un parent
// né après 1900 ; ou avec un enfant né après 1940. Par prudence, une personne sans aucune date dont un conjoint est
// considéré comme vivant l'est aussi. Rend Map(id → motif).
export function vivants(fiches) {
  const g = graphe(fiches), res = new Map();
  for (const [id, f] of fiches) {
    if (f.deces || f.inhumation) continue;
    const n = anneeDe(f.naissance) || anneeDe(f.bapteme);
    if (n && n > ANNEE - 100) { res.set(id, `née en ${n}`); continue; }
    const par = !n && g.parents(id).map(p => anneeDe(fiches.get(p).naissance)).filter(a => a > 1900);
    if (par && par.length) { res.set(id, `sans date de naissance, parent né en ${par[0]}`); continue; }
    const enf = g.enfants(id).map(e => anneeDe(fiches.get(e).naissance)).filter(a => a > 1940);
    if (enf.length) { res.set(id, `enfant né en ${Math.max(...enf)}`); continue; }
  }
  for (const [id, f] of fiches) {
    if (res.has(id) || f.deces || f.inhumation || anneeDe(f.naissance) || anneeDe(f.bapteme)) continue;
    const c = g.conjoints(id).find(c => res.has(c));
    if (c) res.set(id, `sans aucune date, conjoint de ${c} (vivant)`);
  }
  return res;
}
// Cas limites à signaler : sans décès connu, nés il y a 90 à 110 ans (donc 1916-1936 en 2026).
export function casLimites(fiches, viv) {
  return [...fiches].filter(([, f]) => !f.deces && !f.inhumation).map(([id, f]) => [id, anneeDe(f.naissance)])
    .filter(([, n]) => n && n >= ANNEE - 110 && n <= ANNEE - 90).map(([id, n]) => ({ id, naissance: n, vivant: viv.has(id) }));
}

// ---------- Filtrage ----------
const delier = (t, garde) => typeof t === "string" ? t.replace(LIEN, (m, id, txt) => garde.has(id) ? m : txt) : t;
const GARDE_VIVANT = ["format", "prenoms", "nom", "nomNaissance", "sexe", "inconnu", "pere", "mere"];

function filtrerFiche(f, inclus, vivant, hors = { noms: [], ids: [] }) {
  const dedans = id => id && inclus.has(id);
  if (vivant) {
    const m = {};
    for (const k of GARDE_VIVANT) if (f[k] !== undefined) m[k] = f[k];
    if (!dedans(m.pere)) delete m.pere;
    if (!dedans(m.mere)) delete m.mere;
    const cs = [...new Set([f.conjoint, ...(f.unions || []).map(u => u && u.conjoint)])].filter(dedans);
    if (f.format === 2) { if (cs.length) m.unions = cs.map(conjoint => ({ conjoint })); }
    else if (cs.length) m.conjoint = cs[0];
    m.vivant = true;
    return m;
  }
  const p = structuredClone(f);
  if (p.pere && !dedans(p.pere)) delete p.pere;
  if (p.mere && !dedans(p.mere)) delete p.mere;
  if (!p.pere && !p.mere) delete p.lienParents;
  if (Array.isArray(p.unions)) { p.unions = p.unions.filter(u => !u.conjoint || dedans(u.conjoint)); if (!p.unions.length) delete p.unions; }
  if (p.conjoint && !dedans(p.conjoint)) { delete p.conjoint; delete p.mariage; delete p.lienUnion; }
  if (p.chronologie) p.chronologie = p.chronologie.map(e => ({ ...e, texte: delier(e.texte, inclus) }));
  if (p.remarques) p.remarques = delier(p.remarques, inclus);
  // Preuve des liens (liens.pere/mere, union.lien) : on garde celle des parents du partage. Un raisonnement qui nomme
  // une personne hors périmètre (nom complet ou identifiant) est remplacé par une mention neutre.
  const raison = L => {
    if (!L || typeof L.raisonnement !== "string") return L;
    const t = delier(L.raisonnement, inclus), n = norm(t);
    const fuite = hors.noms.some(x => n.includes(x)) || hors.ids.some(id => new RegExp(`\\b${id}\\b`).test(t));
    return { ...L, raisonnement: fuite ? "Raisonnement non partagé : il cite des personnes qui ne figurent pas dans ce partage." : t };
  };
  if (p.liens && typeof p.liens === "object" && !Array.isArray(p.liens)) {
    for (const r of Object.keys(p.liens)) { if (!p[r]) delete p.liens[r]; else p.liens[r] = raison(p.liens[r]); }
    if (!Object.keys(p.liens).length) delete p.liens;
  }
  if (Array.isArray(p.unions)) p.unions = p.unions.map(u => u.lien ? { ...u, lien: raison(u.lien) } : u);
  return p;
}

const idsCites = textes => [...new Set(textes.flatMap(t => [...String(t).matchAll(LIEN)].map(m => m[1])))];

function filtrerRecits(R, inclus, montres) {
  const vies = {}, epoques = {}, branches = [], ecartees = [];
  for (const [k, cible] of [["vies", vies], ["epoques", epoques]])
    for (const [id, t] of Object.entries(R[k] || {})) if (montres.has(id)) cible[id] = delier(t, inclus);
  for (const b of R.branches || []) {
    const textes = [...(b.texte || []), ...(b.contexte || []).map(c => c[1])];
    const ids = idsCites(textes), dedans = ids.filter(id => inclus.has(id));
    if (!ids.length || dedans.length * 2 <= ids.length) { ecartees.push(`${b.id} (${dedans.length}/${ids.length})`); continue; }
    branches.push({ ...b, texte: (b.texte || []).map(t => delier(t, inclus)), ...(b.contexte && { contexte: b.contexte.map(([a, t]) => [a, delier(t, inclus)]) }) });
  }
  return { R: { branches, vies, epoques }, ecartees, gardees: branches.map(b => b.id) };
}

// Répertoire des lieux réduit aux communes que le partage utilise : nom cité dans ses données (lieux, notes, récits,
// titres des vues…), ou commune la plus proche d'un repère de lieu de vie (même calcul que index.html).
function filtrerLieux(site, donnees, vues) {
  const TOUS = site.FAMILLE_LIEUX || {}, texte = JSON.stringify(donnees), garde = new Set();
  for (const n of Object.keys(TOUS)) if (texte.includes(n)) garde.add(n);
  for (const l of Object.values(vues)) for (const v of l) {
    const m = v.url && v.url.match(/lon=(-?[\d.]+)&lat=(-?[\d.]+)/); if (!m) continue;
    const ll = [+m[2], +m[1]];
    const [d, n] = Object.keys(TOUS).map(k => [Math.hypot(TOUS[k][0] - ll[0], (TOUS[k][1] - ll[1]) * Math.cos(ll[0] * Math.PI / 180)), k]).sort((x, y) => x[0] - y[0])[0] || [];
    if (d < 0.12) garde.add(n);
  }
  const LIEUX = {}, REGIONS = {};
  for (const [n, c] of Object.entries(TOUS)) if (garde.has(n)) LIEUX[n] = c;
  for (const [r, cs] of Object.entries(site.FAMILLE_REGIONS || {})) { const k = cs.filter(c => garde.has(c)); if (k.length) REGIONS[r] = k; }
  return { LIEUX, REGIONS };
}

// ---------- Production d'un partage ----------
export function produire(partage, { sortie, donnees, site }) {
  const { fiches, meta } = donnees;
  const { inclus } = perimetre(fiches, partage.perimetre || {});
  if (!inclus.has(partage.racine)) throw new Error(`${partage.nom} : la racine « ${partage.racine} » n'est pas dans le périmètre`);
  // vivantsVisibles (partages.json) : le responsable de l'arbre accepte que les vivants y figurent en entier ; on ne masque alors personne.
  const viv = partage.vivantsVisibles ? new Map() : vivants(fiches);
  // Personnes hors périmètre, pour filtrer les raisonnements des liens : identifiants, noms complets et « premier prénom + nom ».
  const nomsLarges = f => f.inconnu || !f.prenoms || /^\?/.test(f.prenoms) ? [] : [f.nom, f.nomNaissance].filter(Boolean).flatMap(n => [norm(`${f.prenoms} ${n}`), norm(`${f.prenoms.split(" ")[0]} ${n}`)]);
  const dedansNoms = new Set([...inclus].flatMap(id => nomsLarges(fiches.get(id))));
  const horsIds = [...fiches.keys()].filter(id => !inclus.has(id));
  const hors = { ids: horsIds, noms: [...new Set(horsIds.flatMap(id => nomsLarges(fiches.get(id))))].filter(n => !dedansNoms.has(n)) };
  const fichesP = new Map(), masques = [];
  for (const [id, f] of fiches) {
    if (!inclus.has(id)) continue;
    const v = viv.has(id);
    if (v) masques.push(id);
    fichesP.set(id, filtrerFiche(f, inclus, v, hors));
  }
  const montres = new Set([...inclus].filter(id => !viv.has(id)));
  const { FAMILLE, FAMILLE_ACTES } = assembler({ meta: { ...meta, famille: { ...meta.famille, racine: partage.racine, ...(partage.racines && { racines: partage.racines.filter(e => inclus.has(typeof e === "string" ? e : e.id)) }) } }, fiches: fichesP, orphelins: {} });
  const recits = filtrerRecits(site.FAMILLE_RECITS || {}, inclus, montres);
  const vues = {};
  for (const [id, l] of Object.entries(site.FAMILLE_VUES || {})) if (montres.has(id)) vues[id] = l;

  // Images référencées par ce qui reste.
  const images = new Set();
  const noter = s => { if (typeof s === "string" && /^(actes|lieux|photos)\//.test(s)) images.add(s); };
  for (const l of Object.values(FAMILLE_ACTES)) for (const a of l) noter(a.image);
  for (const p of Object.values(FAMILLE.personnes)) { noter(p.photo); for (const s of p.sources || []) for (const i of (s && s.images) || []) noter(i.image); }
  for (const l of Object.values(vues)) for (const v of l) noter(v.image);
  for (const b of recits.R.branches) for (const [img] of b.images || []) noter(img);

  const dir = join(sortie, partage.nom);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const entete = `// Partage « ${partage.nom} » (${partage.titre}) : FICHIER GÉNÉRÉ par outils/partager.mjs, ne pas modifier.\n`;
  writeFileSync(join(dir, "famille.js"), entete + ecrireFamille(FAMILLE));
  writeFileSync(join(dir, "actes.js"), entete + ecrireActes(FAMILLE_ACTES));
  writeFileSync(join(dir, "recits.js"), entete + `window.FAMILLE_RECITS = ${JSON.stringify(recits.R, null, 1)};\n`);
  writeFileSync(join(dir, "vues.js"), entete + `window.FAMILLE_VUES = ${JSON.stringify(vues, null, 1)};\n`);
  const lieux = filtrerLieux(site, [FAMILLE, FAMILLE_ACTES, recits.R, vues], vues);
  writeFileSync(join(dir, "lieux.js"), entete + `window.FAMILLE_LIEUX = ${JSON.stringify(lieux.LIEUX, null, 1)};\nwindow.FAMILLE_REGIONS = ${JSON.stringify(lieux.REGIONS, null, 1)};\n`);
  copyFileSync(join(DEPOT, "icone.png"), join(dir, "icone.png"));
  const titre = `Arbre généalogique · ${partage.titre}`;
  const html = readFileSync(join(DEPOT, "index.html"), "utf8").replace(/<title>[^<]*<\/title>/, `<title>${titre.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</title>`);
  writeFileSync(join(dir, "index.html"), html);
  const man = JSON.parse(readFileSync(join(DEPOT, "manifest.webmanifest"), "utf8"));
  writeFileSync(join(dir, "manifest.webmanifest"), JSON.stringify({ ...man, name: titre, short_name: partage.titre.slice(0, 24), start_url: "./", scope: "./" }, null, 2) + "\n");
  // Images : seules celles qu'utilise le partage sont copiées dans son dossier (actes/, lieux/, photos/).
  const manquantes = [...images].filter(img => !existsSync(join(DEPOT, img)));
  for (const img of images) if (existsSync(join(DEPOT, img))) { mkdirSync(dirname(join(dir, img)), { recursive: true }); copyFileSync(join(DEPOT, img), join(dir, img)); }
  const ged = versGedcom(FAMILLE);
  writeFileSync(join(dir, "arbre.ged"), ged.texte);

  return { dir, inclus, masques, motifs: viv, images, manquantes, recits, familles: ged.familles, communes: Object.keys(lieux.LIEUX).length };
}

// ---------- Contrôle : aucune donnée hors périmètre dans les fichiers produits ----------
const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");
function fichiersDe(dir) {
  const r = [];
  for (const n of readdirSync(dir)) { const c = join(dir, n); if (statSync(c).isDirectory()) r.push(...fichiersDe(c)); else r.push(c); }
  return r;
}
export function controler(res, fiches, emails = []) {
  const { dir, inclus, masques, images } = res, erreurs = [], avis = [];
  const tous = fichiersDe(dir), rel = f => relative(dir, f);
  const textes = tous.filter(f => /\.(js|html|ged|webmanifest)$/.test(f)).map(f => [rel(f), readFileSync(f, "utf8")]);
  const exclus = [...fiches.keys()].filter(id => !inclus.has(id));
  // 1. Identifiants exclus : ni en valeur JSON ("id"), ni en lien [[id|…]].
  for (const id of exclus) for (const [f, t] of textes) if (t.includes(`"${id}"`) || t.includes(`[[${id}|`)) erreurs.push(`${f} : identifiant exclu « ${id} »`);
  // 2. Noms complets des personnes exclues (sans accents ni casse), sauf homonymes d'une personne incluse.
  const nomsDe = f => f.inconnu || !f.prenoms || /^\?/.test(f.prenoms) ? [] : [...new Set([f.nom, f.nomNaissance].filter(Boolean).map(n => norm(`${f.prenoms} ${n}`)))];
  const nomsInclus = new Set([...inclus].flatMap(id => nomsDe(fiches.get(id))));
  const textesN = textes.map(([f, t]) => [f, norm(t)]);
  for (const id of exclus) for (const n of nomsDe(fiches.get(id))) {
    if (nomsInclus.has(n)) { avis.push(`homonyme non contrôlé : « ${n} » (${id})`); continue; }
    for (const [f, t] of textesN) if (t.includes(n)) erreurs.push(`${f} : nom d'une personne exclue « ${n} » (${id})`);
  }
  // 3. Personnes vivantes : seuls les champs autorisés, et leurs dates complètes nulle part.
  const ctx = executer([join(dir, "famille.js"), join(dir, "actes.js"), join(dir, "recits.js"), join(dir, "vues.js")]).ctx;
  const P = ctx.FAMILLE.personnes, permis = new Set([...GARDE_VIVANT, "unions", "conjoint", "vivant"]);
  for (const id of masques) {
    const p = P[id];
    if (!p || !p.vivant) { erreurs.push(`${id} : vivant non masqué`); continue; }
    for (const k of Object.keys(p)) if (!permis.has(k)) erreurs.push(`${id} (vivant) : champ « ${k} » présent`);
    for (const u of p.unions || []) for (const k of Object.keys(u)) if (k !== "conjoint") erreurs.push(`${id} (vivant) : union avec « ${k} »`);
    if (ctx.FAMILLE_ACTES[id] || ctx.FAMILLE_VUES[id] || ctx.FAMILLE_RECITS.vies[id] || ctx.FAMILLE_RECITS.epoques[id]) erreurs.push(`${id} (vivant) : actes, vues ou récit présents`);
    const f = fiches.get(id);
    for (const e of [f.naissance, f.bapteme, ...(f.unions || []), f.mariage]) {
      const d = e && e.date && String(e.date).match(/\d{1,2}\/\d{1,2}\/\d{4}/);
      if (d) for (const [fn, t] of textes) if (t.includes(d[0])) erreurs.push(`${fn} : date « ${d[0]} » d'une personne vivante (${id})`);
    }
  }
  // 4. Personnes du fichier = périmètre exactement ; liens internes seulement.
  const ids = new Set(Object.keys(P));
  for (const id of inclus) if (!ids.has(id)) erreurs.push(`${id} : absent de famille.js`);
  for (const id of ids) if (!inclus.has(id)) erreurs.push(`${id} : dans famille.js hors périmètre`);
  for (const [id, p] of Object.entries(P)) for (const k of ["pere", "mere", "conjoint"]) if (p[k] && !ids.has(p[k])) erreurs.push(`${id}.${k} → ${p[k]} hors partage`);
  // 5. Répertoire des lieux : seulement des communes citées dans les données du partage (ou proches d'un lieu de vie).
  const L = executer([join(dir, "lieux.js")]).ctx, donneesP = textes.filter(([f]) => /^(famille|actes|recits|vues)\.js$/.test(f)).map(([, t]) => t).join("\n");
  const vuesLL = Object.values(ctx.FAMILLE_VUES).flat().map(v => v.url && v.url.match(/lon=(-?[\d.]+)&lat=(-?[\d.]+)/)).filter(Boolean).map(m => [+m[2], +m[1]]);
  for (const [n, c] of Object.entries(L.FAMILLE_LIEUX || {}))
    if (!donneesP.includes(n) && !vuesLL.some(ll => Math.hypot(c[0] - ll[0], (c[1] - ll[1]) * Math.cos(ll[0] * Math.PI / 180)) < 0.12)) erreurs.push(`lieux.js : commune « ${n} » sans rapport avec le partage`);
  for (const cs of Object.values(L.FAMILLE_REGIONS || {})) for (const n of cs) if (!(L.FAMILLE_LIEUX || {})[n]) erreurs.push(`lieux.js : région citant « ${n} », absente du répertoire du partage`);
  // 6. Adresses e-mail de partages.json (membres, administrateurs) : jamais dans les fichiers publiés.
  for (const e of emails) for (const [f, t] of textes) if (t.toLowerCase().includes(e.toLowerCase())) erreurs.push(`${f} : adresse e-mail de partages.json « ${e} »`);
  // 7. Images : exactement celles qui sont référencées.
  for (const f of tous.map(rel).filter(f => /^(actes|lieux|photos)\//.test(f))) if (!images.has(f)) erreurs.push(`image non référencée copiée : ${f}`);
  return { erreurs, avis };
}

// ---------- Ligne de commande ----------
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = n => { const i = args.indexOf(n); return i >= 0 ? args.splice(i, 2)[1] : null; };
  const sortie = resolve(opt("--sortie") || join(DEPOT, "public", "partage"));
  const liste = args.includes("--liste"), noms = args.filter(a => !a.startsWith("--"));
  const conf = JSON.parse(readFileSync(join(DEPOT, "partages.json"), "utf8"));
  const partages = conf.partages.filter(p => !noms.length || noms.includes(p.nom));
  if (noms.length && partages.length !== noms.length) { console.error(`Partage inconnu : ${noms.filter(n => !conf.partages.some(p => p.nom === n)).join(", ")}`); process.exit(1); }
  const donnees = lireDonnees(DEPOT);
  const site = executer(["lieux.js", "recits.js", "vues.js"].map(f => join(DEPOT, f))).ctx;
  const nom = id => { const f = donnees.fiches.get(id); return f.inconnu ? `${f.role || "inconnu"} [${id}]` : `${f.prenoms} ${f.nomNaissance || f.nom} [${id}]`; };
  let echec = false;
  for (const p of partages) {
    if (liste) {
      const { inclus } = perimetre(donnees.fiches, p.perimetre || {}), viv = vivants(donnees.fiches);
      console.log(`\n== ${p.nom} : ${inclus.size} personnes ==`);
      for (const id of donnees.fiches.keys()) if (inclus.has(id)) console.log(`  ${nom(id)}${viv.has(id) ? "  (vivant : " + viv.get(id) + ")" : ""}`);
      continue;
    }
    const r = produire(p, { sortie, donnees, site });
    const emails = [...((conf.commentaires || {}).administrateurs || []), ...conf.partages.flatMap(x => Object.keys(x.membres || {}))];
    const c = controler(r, donnees.fiches, emails);
    console.log(`${p.nom} : ${r.inclus.size} personnes (${p.vivantsVisibles ? "vivants visibles" : `dont ${r.masques.length} vivantes masquées`}), ${r.familles} familles, ${r.images.size} images, ${r.communes} communes, récits gardés : ${r.recits.gardees.join(", ") || "aucun"} → ${relative(process.cwd(), r.dir) || "."}`);
    if (r.recits.ecartees.length) console.log(`  récits écartés (personnes incluses / citées) : ${r.recits.ecartees.join(", ")}`);
    if (r.manquantes.length) console.warn(`  images introuvables : ${r.manquantes.join(", ")}`);
    for (const a of c.avis) console.log(`  avis : ${a}`);
    for (const e of c.erreurs) console.error(`  FUITE : ${e}`);
    if (c.erreurs.length) echec = true;
  }
  if (echec) { console.error("Échec : des données hors périmètre ont été trouvées (voir FUITE ci-dessus)."); process.exit(1); }
}
