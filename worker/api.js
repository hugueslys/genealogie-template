// API des commentaires de la famille (ticket #22). Logique pure, sans dépendance : importée par worker/index.js
// (Worker Cloudflare) et par worker/test.mjs (tests node). Fonctionnement et mise en place : outils/PARTAGES.md.
//
// Routes (tout le reste est servi par les fichiers statiques) :
//   GET  /partage/<nom>/api/commentaires[?fiche=<id>]   commentaires visibles du partage (sans e-mail)
//   POST /partage/<nom>/api/commentaires                 {fiche, texte, nom?} → nouveau commentaire
//   GET  /api/commentaires[?fiche=&partage=&statut=]     tous les commentaires, avec e-mail (administrateurs)
//   POST /api/commentaires/<id>/traite                   {note?, statut?: "traite"|"nouveau"} (administrateurs)
//   POST /api/commentaires/<id>/masquer                  {masque?: true|false} (administrateurs)
//   GET  /api/visiteurs                                  visiteurs authentifiés des partages (administrateurs)
//
// Identité : jeton Cloudflare Access (en-tête Cf-Access-Jwt-Assertion), signature RS256 vérifiée contre les clés de
// l'équipe, émetteur, dates, audience si elle est renseignée. L'e-mail vient du jeton, jamais du client.
// Les sessions Claude traitent les commentaires en lisant et écrivant directement le KV (outils/commentaires.mjs).
//
// Stockage (Workers KV, liaison COMMENTAIRES) :
//   c:<partage>:<horodatage>_<aléa>   un commentaire (JSON) ; copie en métadonnée s'il est court (lecture en une liste)
//   nom:<e-mail>                      nom saisi par la personne à sa première visite (si absent de partages.json)
//   v:<partage>:<e-mail>              visiteur d'un partage
//   rl:<e-mail>:<heure>               compteur de commentaires de l'heure (expire seul)
//
// D (données de déploiement, générées par outils/cloudflare.mjs dans le paquet du Worker, jamais servies) :
//   { equipe, audRacine: [], administrateurs: [], noms: {id: nom}, partages: {nom: {fiches: [], vivants: [], membres: {}, aud: []}} }

export const MAX_TEXTE = 2000, MAX_NOM = 60, MAX_PAR_HEURE = 10, MAX_URL = 3;
const nbUrl = s => (s.match(/\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|fr|net|org|io|ru|xyz|info|be|ch|de|ly|co|me|app|link)\/\S/gi) || []).length;
const MAX_META = 1000; // octets : la métadonnée d'une clé KV est limitée à 1024 octets
const NOM_PARTAGE = /^[a-z0-9-]+$/, ID_FICHE = /^[A-Za-z0-9_-]{1,80}$/, ID_COMMENTAIRE = /^([a-z0-9-]+)_([0-9a-z]{9}_[0-9a-z]{6})$/;

export class ErreurHttp extends Error {
  constructor(statut, message) { super(message); this.statut = statut; }
}
const refuser = (statut, message) => { throw new ErreurHttp(statut, message); };

const entetes = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const repondre = (donnees, statut = 200) => new Response(JSON.stringify(donnees), { status: statut, headers: entetes });

// ---------- Jeton Cloudflare Access ----------
const deB64url = s => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
};
const lireJson = morceau => JSON.parse(new TextDecoder().decode(deB64url(morceau)));

let cacheCles = null, dernierRechargement = 0;
export function viderCacheCles() { cacheCles = null; dernierRechargement = 0; }
// Requêtes sortantes (clés Access) : fetch, remplaçable par les tests seulement.
let chercherHttp = (...a) => fetch(...a);
export function remplacerFetch(f) { chercherHttp = f || ((...a) => fetch(...a)); }

async function clesAccess(equipe, chercher, forcer) {
  const maintenant = Date.now();
  if (cacheCles && cacheCles.equipe === equipe && (!forcer || maintenant - dernierRechargement < 60e3) && (forcer || cacheCles.expire > maintenant)) return cacheCles.cles;
  const r = await chercher(`https://${equipe}.cloudflareaccess.com/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error(`clés Access : HTTP ${r.status}`);
  const { keys = [] } = await r.json();
  const cles = new Map();
  for (const k of keys) {
    if (k.kty !== "RSA" || !k.kid || !k.n || !k.e) continue;
    cles.set(k.kid, await crypto.subtle.importKey("jwk", { kty: "RSA", n: k.n, e: k.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
  }
  cacheCles = { equipe, cles, expire: maintenant + 10 * 60e3 };
  dernierRechargement = maintenant;
  return cles;
}

// Rend { email, aud } ou lève ErreurHttp(401). audiences : liste d'AUD acceptés (vide = pas de contrôle d'audience).
export async function verifierJeton(jeton, { equipe, audiences = [], chercher = fetch, maintenant = Date.now() }) {
  if (!jeton) refuser(401, "Connexion Cloudflare Access requise.");
  const morceaux = jeton.split(".");
  if (morceaux.length !== 3) refuser(401, "Jeton Access illisible.");
  let entete, charge;
  try { entete = lireJson(morceaux[0]); charge = lireJson(morceaux[1]); } catch { refuser(401, "Jeton Access illisible."); }
  if (entete.alg !== "RS256" || typeof entete.kid !== "string") refuser(401, "Jeton Access : algorithme refusé.");
  let cle = (await clesAccess(equipe, chercher, false)).get(entete.kid);
  if (!cle) cle = (await clesAccess(equipe, chercher, true)).get(entete.kid); // rotation des clés
  if (!cle) refuser(401, "Jeton Access : clé inconnue.");
  let signature;
  try { signature = deB64url(morceaux[2]); } catch { refuser(401, "Jeton Access illisible."); }
  const valide = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cle, signature, new TextEncoder().encode(`${morceaux[0]}.${morceaux[1]}`));
  if (!valide) refuser(401, "Jeton Access : signature invalide.");
  if (charge.iss !== `https://${equipe}.cloudflareaccess.com`) refuser(401, "Jeton Access : émetteur inattendu.");
  const t = maintenant / 1000, marge = 60;
  if (typeof charge.exp !== "number" || charge.exp < t - marge) refuser(401, "Jeton Access expiré : rechargez la page.");
  if (typeof charge.nbf === "number" && charge.nbf > t + marge) refuser(401, "Jeton Access pas encore valide.");
  const aud = [].concat(charge.aud || []);
  if (audiences.length && !aud.some(a => audiences.includes(a))) refuser(401, "Jeton Access : audience inattendue.");
  if (typeof charge.email !== "string" || !/^[^@\s]+@[^@\s]+$/.test(charge.email)) refuser(401, "Jeton Access sans e-mail.");
  return { email: charge.email.toLowerCase(), aud };
}

// ---------- Textes ----------
// Texte brut : fins de ligne normalisées, caractères de contrôle retirés (sauf tabulation et saut de ligne).
const nettoyer = (s, max) => {
  if (typeof s !== "string") return "";
  s = s.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, "").trim();
  return s.length > max ? null : s;
};
const nomPropre = s => { const n = nettoyer(typeof s === "string" ? s.replace(/\s+/g, " ") : s, MAX_NOM); return n || ""; };

// ---------- Stockage ----------
const octets = s => new TextEncoder().encode(s).length;
async function enregistrer(kv, c) {
  const json = JSON.stringify(c);
  await kv.put(cle(c.id), json, octets(json) <= MAX_META ? { metadata: c } : { metadata: { id: c.id, long: true } });
}
const cle = id => { const m = id.match(ID_COMMENTAIRE); return m ? `c:${m[1]}:${m[2]}` : null; };

async function lister(kv, prefixe) {
  const res = [];
  let curseur;
  do {
    const page = await kv.list({ prefix: prefixe, cursor: curseur });
    for (const k of page.keys) {
      if (k.metadata && k.metadata.texte !== undefined) res.push(k.metadata);
      else { const c = await kv.get(k.name, "json"); if (c) res.push(c); }
    }
    curseur = page.list_complete ? undefined : page.cursor;
  } while (curseur);
  return res.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

const aleatoire = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => (b % 36).toString(36)).join("");
const nouvelId = (partage, ms) => `${partage}_${ms.toString(36).padStart(9, "0")}_${aleatoire(6)}`;

// ---------- Vues d'un commentaire ----------
const pourPartage = (c, email) => ({ id: c.id, fiche: c.fiche, texte: c.texte, auteurNom: c.auteurNom, date: c.date, ...(c.auteurEmail === email && { moi: true }) });
// Site complet : avec l'e-mail de l'auteur (usage interne) et le statut de traitement.
const pourAdmin = c => ({ id: c.id, partage: c.partage, fiche: c.fiche, texte: c.texte, auteurNom: c.auteurNom, auteurEmail: c.auteurEmail, date: c.date, masque: !!c.masque,
  statut: c.statut === "traite" ? "traite" : "nouveau", ...(c.traitement && { traitement: c.traitement }), ...(c.traiteLe && { traiteLe: c.traiteLe, traitePar: c.traitePar }) });
export const MAX_NOTE = 200;

// ---------- Requêtes ----------
async function corpsJson(request, origine) {
  // Contre les envois depuis un autre site : JSON obligatoire (impossible sans requête préalable CORS) et même origine.
  if (!/^application\/json\b/i.test(request.headers.get("content-type") || "")) refuser(415, "Envoi en JSON attendu.");
  const o = request.headers.get("origin");
  if (o && o !== origine) refuser(403, "Origine refusée.");
  const t = await request.text();
  if (t.length > 20000) refuser(413, "Envoi trop long.");
  try { const v = JSON.parse(t || "{}"); if (v && typeof v === "object" && !Array.isArray(v)) return v; } catch {}
  refuser(400, "JSON invalide.");
}

const jetonDe = request => request.headers.get("cf-access-jwt-assertion");

async function apiPartage(nom, reste, request, env, ctx, D, url) {
  const p = D.partages && Object.prototype.hasOwnProperty.call(D.partages, nom) ? D.partages[nom] : null;
  if (!p) refuser(404, "Partage inconnu.");
  if (reste !== "commentaires") refuser(404, "Adresse inconnue.");
  const { email } = await verifierJeton(jetonDe(request), { equipe: D.equipe, audiences: p.aud || [], chercher: chercherHttp });
  const fiches = new Set(p.fiches), vivants = new Set(p.vivants || []);
  const membres = Object.fromEntries(Object.entries(p.membres || {}).map(([e, n]) => [e.toLowerCase(), n]));
  const kv = env.COMMENTAIRES;
  if (!kv) refuser(503, "Stockage des commentaires non configuré.");

  if (request.method === "GET") {
    const fiche = url.searchParams.get("fiche");
    if (fiche !== null && !fiches.has(fiche)) refuser(404, "Fiche absente de ce partage.");
    const nomFixe = membres[email] || null;
    const nomConnu = nomFixe || (await kv.get(`nom:${email}`)) || null;
    // Fiches de vivants : chacun ne voit que ses propres commentaires (rien d'autre n'est affiché sur ces fiches).
    const liste = (await lister(kv, `c:${nom}:`))
      .filter(c => !c.masque && fiches.has(c.fiche) && (fiche === null || c.fiche === fiche) && (!vivants.has(c.fiche) || c.auteurEmail === email))
      .map(c => pourPartage(c, email));
    return repondre({ mode: "partage", partage: nom, moi: { nom: nomConnu, nomFixe: !!nomFixe }, commentaires: liste });
  }
  if (request.method === "POST") {
    const b = await corpsJson(request, url.origin);
    if (typeof b.fiche !== "string" || !ID_FICHE.test(b.fiche) || !fiches.has(b.fiche)) refuser(404, "Fiche absente de ce partage.");
    const texte = nettoyer(b.texte, MAX_TEXTE);
    if (texte === null) refuser(400, `Commentaire trop long (${MAX_TEXTE} caractères au plus).`);
    if (!texte) refuser(400, "Commentaire vide.");
    if (nbUrl(texte) + nbUrl(typeof b.nom === "string" ? b.nom : "") > MAX_URL) refuser(400, `Pas plus de ${MAX_URL} adresses web dans un commentaire.`);
    let auteurNom = membres[email];
    if (!auteurNom) {
      const saisi = nomPropre(b.nom);
      const connu = await kv.get(`nom:${email}`);
      auteurNom = saisi || connu;
      if (!auteurNom) refuser(400, "Indiquez votre nom.");
      if (saisi && saisi !== connu) await kv.put(`nom:${email}`, saisi);
    }
    // Au plus MAX_PAR_HEURE commentaires par e-mail et par heure (compteur KV qui expire seul).
    const maintenant = Date.now(), kc = `rl:${email}:${Math.floor(maintenant / 3600e3)}`;
    const deja = +(await kv.get(kc)) || 0;
    if (deja >= MAX_PAR_HEURE) refuser(429, "Trop de commentaires en une heure : réessayez plus tard.");
    await kv.put(kc, String(deja + 1), { expirationTtl: 7200 });
    const c = { id: nouvelId(nom, maintenant), partage: nom, fiche: b.fiche, texte, auteurEmail: email, auteurNom, date: new Date(maintenant).toISOString(), masque: false, statut: "nouveau" };
    await enregistrer(kv, c);
    return repondre({ commentaire: pourPartage(c, email) }, 201);
  }
  refuser(405, "Méthode non permise.");
}

async function apiRacine(reste, request, env, D, url) {
  const { email } = await verifierJeton(jetonDe(request), { equipe: D.equipe, audiences: D.audRacine || [], chercher: chercherHttp });
  const admins = new Set([...(D.administrateurs || []), ...String(env.ADMINISTRATEURS || "").split(",")].map(e => e.trim().toLowerCase()).filter(Boolean));
  if (!admins.has(email)) refuser(403, "Réservé au site complet.");
  const kv = env.COMMENTAIRES;
  if (!kv) refuser(503, "Stockage des commentaires non configuré.");
  if (reste === "commentaires" && request.method === "GET") {
    const fiche = url.searchParams.get("fiche"), partage = url.searchParams.get("partage"), statut = url.searchParams.get("statut");
    if (partage !== null && !NOM_PARTAGE.test(partage)) refuser(400, "Partage invalide.");
    if (statut !== null && statut !== "nouveau" && statut !== "traite") refuser(400, "Statut invalide (nouveau ou traite).");
    const liste = (await lister(kv, partage ? `c:${partage}:` : "c:")).map(pourAdmin)
      .filter(c => (fiche === null || c.fiche === fiche) && (statut === null || c.statut === statut));
    return repondre({ mode: "complet", moi: { admin: true }, partages: Object.keys(D.partages || {}), commentaires: liste });
  }
  if (reste === "visiteurs" && request.method === "GET") {
    // Visiteurs des partages : e-mail, partage, première et dernière visite, nombre de visites, nom connu.
    const membres = {};
    for (const p of Object.values(D.partages || {})) for (const [e, nom] of Object.entries(p.membres || {})) membres[e.toLowerCase()] = nom;
    const liste = [];
    for (const v of await listerVisiteurs(kv)) liste.push({ ...v, nom: membres[v.email] || (await kv.get(`nom:${v.email}`)) || null });
    liste.sort((a, b) => a.partage.localeCompare(b.partage) || (a.derniere < b.derniere ? 1 : -1));
    return repondre({ visiteurs: liste });
  }
  const m = reste.match(/^commentaires\/([^/]+)\/(masquer|traite)$/);
  if (m) {
    if (request.method !== "POST") refuser(405, "Méthode non permise.");
    const b = await corpsJson(request, url.origin);
    const k = cle(decodeURIComponent(m[1]));
    if (!k) refuser(404, "Commentaire inconnu.");
    const c = await kv.get(k, "json");
    if (!c) refuser(404, "Commentaire inconnu.");
    if (m[2] === "masquer") c.masque = b.masque !== false;
    else {
      const note = nettoyer(b.note === undefined ? "" : b.note, MAX_NOTE);
      if (note === null) refuser(400, `Note trop longue (${MAX_NOTE} caractères au plus).`);
      if (b.statut !== undefined && b.statut !== "traite" && b.statut !== "nouveau") refuser(400, "Statut invalide (nouveau ou traite).");
      if (b.statut === "nouveau") { c.statut = "nouveau"; delete c.traitement; delete c.traiteLe; delete c.traitePar; }
      else Object.assign(c, { statut: "traite", traitement: note || undefined, traiteLe: new Date().toISOString(), traitePar: email });
    }
    await enregistrer(kv, JSON.parse(JSON.stringify(c)));
    return repondre({ commentaire: pourAdmin(c) });
  }
  refuser(404, "Adresse inconnue.");
}

// ---------- Visiteurs des partages ----------
// Clé v:<partage>:<e-mail> → {email, partage, premiere, derniere, visites} (copie en métadonnée : une seule liste).
// Une écriture au plus par visiteur et par heure : une « visite » = des pages vues à plus d'une heure d'intervalle.
const UNE_HEURE = 3600e3;
export async function noterVisite(request, env, D, nom) {
  const p = D.partages && Object.prototype.hasOwnProperty.call(D.partages, nom) ? D.partages[nom] : null;
  if (!p || !env.COMMENTAIRES || !jetonDe(request)) return;
  let email;
  try { ({ email } = await verifierJeton(jetonDe(request), { equipe: D.equipe, audiences: p.aud || [], chercher: chercherHttp })); } catch { return; }
  const k = `v:${nom}:${email}`, maintenant = new Date();
  const v = await env.COMMENTAIRES.get(k, "json");
  if (v && maintenant - new Date(v.derniere) < UNE_HEURE) return;
  const n = { email, partage: nom, premiere: v ? v.premiere : maintenant.toISOString(), derniere: maintenant.toISOString(), visites: (v ? v.visites : 0) + 1 };
  await env.COMMENTAIRES.put(k, JSON.stringify(n), { metadata: n });
}
async function listerVisiteurs(kv) {
  const res = [];
  let curseur;
  do {
    const page = await kv.list({ prefix: "v:", cursor: curseur });
    for (const k of page.keys) res.push(k.metadata && k.metadata.email ? k.metadata : await kv.get(k.name, "json"));
    curseur = page.list_complete ? undefined : page.cursor;
  } while (curseur);
  return res.filter(Boolean);
}
// Page d'accueil d'un partage : confiée d'abord au Worker (runWorkerFirst dans cloudflare.config.ts) pour noter la visite.
export const PAGE_PARTAGE = /^\/partage\/([a-z0-9-]+)\/(?:index\.html)?$/;

// Point d'entrée : rend une Response pour les routes de l'API, null pour tout le reste (fichiers statiques).
export async function traiterApi(request, env, ctx, D) {
  const url = new URL(request.url);
  const mp = url.pathname.match(/^\/partage\/([^/]+)\/api(?:\/(.*))?$/), mr = url.pathname.match(/^\/api(?:\/(.*))?$/);
  if (!mp && !mr) return null;
  try {
    if (mp) return await apiPartage(decodeURIComponent(mp[1]), mp[2] || "", request, env, ctx, D, url);
    return await apiRacine(mr[1] || "", request, env, D, url);
  } catch (e) {
    if (e instanceof ErreurHttp) return repondre({ erreur: e.message }, e.statut);
    console.error("API commentaires : " + (e && e.stack || e));
    return repondre({ erreur: "Erreur du serveur." }, 500);
  }
}
