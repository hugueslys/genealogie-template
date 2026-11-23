import { defineConfig, bindings } from "cf/config";

// Worker du site (nom ci-dessous, à choisir : il donne l'adresse <nom>.<votre-sous-domaine>.workers.dev) : fichiers statiques (public/) + API des commentaires et des visites (worker/).
// Le paquet est assemblé par outils/cloudflare.mjs (Build Output dans .cloudflare/output), puis `cf deploy --prebuilt`.
// COMMENTAIRES : namespace Workers KV. Sans `id`, cf le crée au premier déploiement (« <nom du Worker>-commentaires »)
// puis reprend celui déjà lié au Worker. Pour le figer, mettre son identifiant : bindings.kv({ id: "…" }).
// Secret facultatif, posé à part et conservé d'un déploiement à l'autre : ADMINISTRATEURS (e-mails ajoutés, séparés par des virgules).
// Voir outils/PARTAGES.md, section « Commentaires ».
export default defineConfig({
  worker: {
    name: "mon-arbre", // À CHANGER : nom du Worker (lettres minuscules, chiffres, tirets)
    compatibilityDate: "2026-11-01",
    entrypoint: "./worker/index.js",
    workersDev: true,
    previewUrls: false,
    assets: {
      // Le Worker passe avant les fichiers pour l'API et pour noter les visites des pages d'accueil des partages.
      runWorkerFirst: ["/api/*", "/partage/*/api/*", "/partage/*/", "/partage/*/index.html", "/actes/*", "/lieux/*", "/photos/*", "/partage/*/actes/*", "/partage/*/lieux/*", "/partage/*/photos/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      // Images (actes/, lieux/, photos/) : bucket R2, voir worker/images.js et outils/r2.mjs.
      IMAGES: bindings.r2({ name: "mon-arbre-images" }), // À CHANGER : nom du bucket R2 créé pour les images
      COMMENTAIRES: bindings.kv(), // après le premier déploiement, figer l'identifiant : bindings.kv({ id: "<id du namespace>" })
    },
  },
});
