// Répertoire des lieux : commune → [latitude, longitude].
// Le nom est écrit tel qu'il figure en tête des lieux de l'arbre (« Chinon (Indre-et-Loire), rue Haute-Saint-Maurice » → « Chinon ») :
// un lieu de famille.js est reconnu quand il commence par ce nom (à défaut, quand il le contient), le nom le plus long l'emportant
// (« Saint-Martin-le-Beau » avant « Saint-Martin »). Les coordonnées sont approximatives : le centre du village, pas la maison de la famille.
// Une commune par ligne, par ordre alphabétique ; une commune ajoutée ici apparaît sur la carte et dans la petite carte des fiches.
window.FAMILLE_LIEUX = {
  "Chinon": [47.17, 0.24],
  "Paris": [48.857, 2.352],
  "Tours": [47.394, 0.689],
};

// Régions (branches géographiques de la famille), pour regrouper les recherches à faire dans la vue Recherches.
// Chaque commune du répertoire figure dans une région (sinon elle est rangée dans « Autres lieux ») ;
// une fiche sans lieu reconnu prend la région de ses enfants, sinon de ses parents.
window.FAMILLE_REGIONS = {
  "Touraine": ["Chinon", "Tours"],
  "Paris et Île-de-France": ["Paris"],
};
