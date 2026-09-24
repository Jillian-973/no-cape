const Reservation = require('../models/Reservation');

// Règles de calcul du stock :
// - Casquette.stock = nombre total de casquettes possédées (ne change pas quand on réserve)
// - une réservation occupe ses casquettes du jour de début au jour de fin INCLUS
// - après le jour de fin, les casquettes sont rendues et reviennent dans le stock
// - SAUF les articles signalés avec un problème (réservation « invalide ») :
//   ils ne reviennent jamais dans le stock (abîmés, perdus…)
// - les réservations annulées ne comptent pas

// Les dates circulent au format JJ/MM/AAAA entre le front et l'API.
// En base elles sont stockées en Date (minuit UTC) pour pouvoir les comparer et les trier.

const deuxChiffres = (n) => String(n).padStart(2, '0');

// Date du jour au format JJ/MM/AAAA (heure locale du serveur)
function aujourdhui() {
  const now = new Date();
  return `${deuxChiffres(now.getDate())}/${deuxChiffres(now.getMonth() + 1)}/${now.getFullYear()}`;
}

// 'JJ/MM/AAAA' -> Date à minuit UTC. Renvoie null si le format ou la date est invalide (ex : 31/02/2026).
function jour(texte) {
  const morceaux = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(texte ?? '').trim());
  if (!morceaux) return null;
  const [, j, m, a] = morceaux.map(Number);
  const date = new Date(Date.UTC(a, m - 1, j));
  return date.getUTCDate() === j && date.getUTCMonth() === m - 1 ? date : null;
}

// Date -> 'JJ/MM/AAAA'
function formatJour(date) {
  const d = new Date(date);
  return `${deuxChiffres(d.getUTCDate())}/${deuxChiffres(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// Limites d'une réservation : empêchent de bloquer tout le stock pendant des années
const DUREE_MAX_JOURS = 30;    // durée maximale d'une location
const AVANCE_MAX_JOURS = 365;  // on ne peut pas réserver plus d'un an à l'avance
const UN_JOUR = 24 * 60 * 60 * 1000;

// Vérifie une période de location demandée. Renvoie un message d'erreur, ou null si tout va bien.
function erreurPeriode(debut, fin) {
  const auj = jour(aujourdhui());
  if (!debut || !fin) return 'Dates de début et de fin requises (format attendu : JJ/MM/AAAA)';
  if (fin < debut) return 'La date de fin doit être après la date de début';
  if (debut < auj) return 'La date de début ne peut pas être dans le passé';
  if (debut - auj > AVANCE_MAX_JOURS * UN_JOUR) return `On ne peut pas réserver plus de ${AVANCE_MAX_JOURS} jours à l'avance`;
  if (fin - debut >= DUREE_MAX_JOURS * UN_JOUR) return `Une location dure au maximum ${DUREE_MAX_JOURS} jours`;
  return null;
}

// Réservations actives (non annulées) qui occupent des casquettes pendant la période [debut, fin] :
// - celles qui chevauchent la période (l'une commence avant que l'autre ne finisse)
// - celles déjà terminées mais avec des articles à problème, qui ne sont jamais revenus
function reservationsSurPeriode(debut, fin, idCasquette) {
  const filtre = {
    statut: { $ne: 'annulée' },
    debutLocation: { $lte: fin },
    $or: [{ finLocation: { $gte: debut } }, { 'probleme.quantite': { $gt: 0 } }],
  };
  if (idCasquette) filtre.idCasquette = idCasquette;
  return Reservation.find(filtre);
}

// Nombre de casquettes qu'une réservation occupe le jour `date`
function quantiteOccupee(reservation, date) {
  if (date < reservation.debutLocation) return 0;
  if (date <= reservation.finLocation) return reservation.quantite; // en location
  return reservation.probleme?.quantite ?? 0; // rendue, sauf les articles à problème
}

// Nombre de casquettes indisponibles le jour `date` (en location + hors service)
function quantiteLoueeLe(reservations, date) {
  return reservations.reduce((total, r) => total + quantiteOccupee(r, date), 0);
}

// Nombre maximum de casquettes indisponibles EN MÊME TEMPS sur la période qui commence à `debut`.
// Le nombre ne peut augmenter qu'au début d'une réservation (les articles à problème ne
// reviennent jamais), donc le pic est au début de la période ou au début d'une réservation :
// on ne teste que ces jours-là au lieu de tous les jours de la période.
function picDeLocation(reservations, debut) {
  const jours = [debut, ...reservations.map((r) => r.debutLocation).filter((d) => d > debut)];
  return Math.max(0, ...jours.map((d) => quantiteLoueeLe(reservations, d)));
}

// Nombre de casquettes encore réservables sur TOUTE la période [debut, fin]
async function quantiteDisponible(casquette, debut, fin) {
  const reservations = await reservationsSurPeriode(debut, fin, casquette._id);
  return Math.max(0, casquette.stock - picDeLocation(reservations, debut));
}

// État d'une réservation vu depuis une date donnée
function etatReservation(reservation, date) {
  if (reservation.statut === 'annulée') return 'annulée';
  if (date < reservation.debutLocation) return 'à venir';
  if (date > reservation.finLocation) return 'rendue';
  return 'en location';
}

// Les locations dont la date de fin est passée sont terminées : on met leur statut à jour
function terminerLocationsPassees() {
  return Reservation.updateMany(
    { statut: 'confirmée', finLocation: { $lt: jour(aujourdhui()) } },
    { statut: 'terminée' }
  );
}

module.exports = {
  aujourdhui,
  jour,
  formatJour,
  erreurPeriode,
  reservationsSurPeriode,
  quantiteOccupee,
  quantiteLoueeLe,
  picDeLocation,
  quantiteDisponible,
  etatReservation,
  terminerLocationsPassees,
};
