const mongoose = require('mongoose');

// true si `valeur` est une chaîne qui ressemble à un _id MongoDB (24 caractères hexadécimaux).
// On refuse tout le reste (objets, tableaux…) pour éviter les injections du type { "$ne": null }.
function estId(valeur) {
  return typeof valeur === 'string' && /^[0-9a-f]{24}$/i.test(valeur) && mongoose.isValidObjectId(valeur);
}

// true si toutes les valeurs sont des chaînes (et pas des objets ou des tableaux)
function sontDesTextes(...valeurs) {
  return valeurs.every((v) => typeof v === 'string');
}

// Erreur imprévue : on la garde dans les logs du serveur mais on ne renvoie
// aucun détail interne (message Mongo, nom de collection…) au navigateur.
function erreurServeur(res, err) {
  console.error(err);
  res.status(500).json({ message: 'Erreur interne du serveur' });
}

// Exécute `fn` quand plus aucune autre opération avec la même clé n'est en cours.
// Sert à empêcher deux réservations simultanées de la même casquette de passer
// toutes les deux la vérification de stock (surréservation).
// Attention : ne fonctionne que si le site tourne sur UN seul processus Node.
const verrous = new Map();

async function avecVerrou(cle, fn) {
  const precedent = verrous.get(cle) ?? Promise.resolve(); // opération en cours (s'il y en a une)
  let liberer;
  const terminee = new Promise((resolve) => { liberer = resolve; });
  const file = precedent.then(() => terminee); // la suivante attendra la fin de celle-ci
  verrous.set(cle, file);

  await precedent;
  try {
    return await fn();
  } finally {
    liberer();
    if (verrous.get(cle) === file) verrous.delete(cle);
  }
}

module.exports = { estId, sontDesTextes, erreurServeur, avecVerrou };
