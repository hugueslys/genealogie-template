// Lieux de vie : photos aériennes anciennes (IGN), cartes postales, photos actuelles, fiches de l'Inventaire du patrimoine.
// Une vue s'affiche sur la fiche des personnes listées. Les images sont dans le dossier lieux/ (versionné).
// Les repères des vues actuelles sont des points de rue, pas
// l'emplacement prouvé des maisons de la famille : le dire dans le titre quand c'est le cas.
window.FAMILLE_VUES = {};
(function () {
  const V = window.FAMILLE_VUES;
  const IGN = "© IGN – Remonter le temps (licence ouverte Etalab)";
  // Lien « Remonter le temps » (IGN) centré sur un point : comparaison photo ancienne / aujourd'hui.
  const RLT = (lon, lat, z) => `https://remonterletemps.ign.fr/comparer/?lon=${lon}&lat=${lat}&z=${z}&layer1=19&layer2=10&mode=split-h`;
  const add = (ids, titre, img, url, credit = IGN) => ids.forEach(i => (V[i] = V[i] || []).push({ titre, image: "lieux/" + img + ".jpg", url, credit }));

  // Exemple (à décommenter et adapter) : une vue pour deux fiches.
  // const TOURS = ["paul_martel", "louise_bertin"], ut = RLT(0.6889, 47.3941, 17);
  // add(TOURS, "Tours, le quartier de la rue Colbert, photo aérienne de 1950", "1950-ign-tours-rue-colbert", ut);
})();
