// Images de l'arbre (actes/, lieux/, photos/) servies depuis R2 (bucket nommé dans cloudflare.config.ts, liaison IMAGES).
// Le site entier est derrière Cloudflare Access : ce code ne s'exécute que pour un visiteur autorisé.
// Dans un partage (/partage/<nom>/actes/…), seules les images de ce partage sont servies (liste dans donnees.js),
// comme quand elles étaient copiées dans public/partage/<nom>/ : aucune image hors périmètre.
export const CHEMIN_IMAGE = /^\/(?:partage\/([a-z0-9-]+)\/)?((?:actes|lieux|photos)\/[^?#]+)$/;
const TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", pdf: "application/pdf" };

export async function servirImage(request, env, D) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const m = new URL(request.url).pathname.match(CHEMIN_IMAGE);
  if (!m || !env.IMAGES) return null;
  let cle;
  try { cle = decodeURIComponent(m[2]); } catch { return new Response("Adresse invalide.", { status: 400 }); }
  if (cle.includes("..")) return new Response("Adresse invalide.", { status: 400 });
  if (m[1]) {
    const p = D.partages && Object.prototype.hasOwnProperty.call(D.partages, m[1]) ? D.partages[m[1]] : null;
    if (!p || !(p.images || []).includes(cle)) return new Response("Image absente de ce partage.", { status: 404 });
  }
  const obj = await env.IMAGES.get(cle, { onlyIf: request.headers });
  if (!obj) return new Response("Image introuvable.", { status: 404 });
  const h = new Headers();
  obj.writeHttpMetadata(h);
  if (!h.get("content-type")) h.set("content-type", TYPES[(cle.split(".").pop() || "").toLowerCase()] || "application/octet-stream");
  h.set("etag", obj.httpEtag);
  h.set("cache-control", "private, max-age=604800");
  if (!("body" in obj) || !obj.body) return new Response(null, { status: 304, headers: h });
  return new Response(request.method === "HEAD" ? null : obj.body, { headers: h });
}
