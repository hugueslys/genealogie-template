// Worker du site : sert le site (fichiers statiques, liaison ASSETS) et l'API des commentaires (worker/api.js).
// donnees.js n'est pas dans le dépôt : outils/cloudflare.mjs le génère dans le paquet du Worker au déploiement
// (personnes de chaque partage, membres, administrateurs). Voir outils/PARTAGES.md, section « Commentaires ».
import { traiterApi, noterVisite, PAGE_PARTAGE } from "./api.js";
import { servirImage } from "./images.js";
import D from "./donnees.js";

export default {
  async fetch(request, env, ctx) {
    const api = await traiterApi(request, env, ctx, D);
    if (api) return api;
    const img = await servirImage(request, env, D);
    if (img) return img;
    // Visite d'un partage (page d'accueil seulement, pas les images) : notée en tâche de fond, sans retarder la page.
    const m = request.method === "GET" && new URL(request.url).pathname.match(PAGE_PARTAGE);
    if (m) ctx.waitUntil(noterVisite(request, env, D, m[1]).catch(e => console.error("Visite : " + (e && e.message))));
    return env.ASSETS.fetch(request);
  },
};
