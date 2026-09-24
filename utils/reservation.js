const UN_JOUR = 24 * 60 * 60 * 1000;

// Numéro de réservation montré au client (site, mail) et à l'admin : #CAP- + les 6 derniers
// caractères de l'_id MongoDB (la partie « compteur » de l'id, donc différente à chaque réservation)
function referenceReservation(id) {
  return `#CAP-${String(id).slice(-6).toUpperCase()}`;
}

// Nombre de jours facturés : même calcul que le calculateur de prix du front
// (écart entre les deux dates, 1 jour minimum)
function joursFactures(debut, fin) {
  return Math.max(1, Math.ceil((fin - debut) / UN_JOUR));
}

// Prix total d'une réservation (€)
function prixTotal(reservation, prixParJour) {
  return joursFactures(reservation.debutLocation, reservation.finLocation) * (prixParJour ?? 0) * reservation.quantite;
}

module.exports = { referenceReservation, joursFactures, prixTotal };
