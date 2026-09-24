const express = require('express');
const router = express.Router();
const Reservation = require('../models/Reservation');
const Casquette = require('../models/Casquette');
const Client = require('../models/Client');
const {
  aujourdhui,
  jour,
  formatJour,
  erreurPeriode,
  quantiteDisponible,
  etatReservation,
  terminerLocationsPassees,
} = require('../utils/disponibilite');
const { estId, erreurServeur, avecVerrou } = require('../utils/securite');
const { envoyerConfirmationReservation } = require('../utils/mail');
const { referenceReservation } = require('../utils/reservation');

// Monté sur /api/reservations dans app.js

// Renvoie la réservation avec ses dates de location au format JJ/MM/AAAA
function avecDatesFormatees(reservation) {
  return {
    ...reservation,
    debutLocation: formatJour(reservation.debutLocation),
    finLocation: formatJour(reservation.finLocation),
  };
}

// La liste des réservations est publique : on n'y montre JAMAIS le téléphone ni le mail,
// seulement le prénom et l'initiale du nom (ex : « Marie D. »).
function clientPublic(client) {
  if (!client) return null;
  return { prenom: client.prenom, nom: client.nom ? `${client.nom[0].toUpperCase()}.` : '' };
}

// GET /api/reservations?date=JJ/MM/AAAA -> renvoie un tableau de réservations
// Chaque réservation a un champ `etat` calculé par rapport à la date demandée (par défaut aujourd'hui) :
//   'à venir' | 'en location' | 'rendue' | 'annulée'
router.get('/', async (req, res) => {
  try {
    const date = jour(req.query.date || aujourdhui());
    if (!date) return res.status(400).json({ message: 'Date invalide (format attendu : JJ/MM/AAAA)' });

    // Les locations dont la date de fin est passée sont terminées : les casquettes sont rendues
    await terminerLocationsPassees();

    // On ne récupère que les champs utiles : jamais le téléphone, le mail ni le détail des problèmes
    const reservations = await Reservation.find()
      .select('idClient idCasquette quantite debutLocation finLocation statut')
      .populate('idClient', 'prenom nom')
      .populate('idCasquette', 'nom')
      .sort({ debutLocation: 1 })
      .lean();

    res.json(reservations.map((r) => ({
      ...avecDatesFormatees(r),
      idClient: clientPublic(r.idClient),
      etat: etatReservation(r, date),
    })));
  } catch (err) {
    erreurServeur(res, err);
  }
});

// POST /api/reservations -> crée une réservation et la renvoie
// Refusée si la casquette n'a pas assez de stock libre sur toute la période demandée.
// Un mail de confirmation est envoyé au client : `mailEnvoye` dans la réponse dit s'il est parti.
router.post('/', async (req, res) => {
  try {
    const { idClient, idCasquette, quantite } = req.body ?? {};
    const debutLocation = jour(req.body?.debutLocation);
    const finLocation = jour(req.body?.finLocation);

    // Types stricts : des id MongoDB en texte et une quantité entière (pas d'objet { "$gt": … })
    if (!estId(idClient) || !estId(idCasquette)) {
      return res.status(400).json({ message: 'Identifiant de client ou de casquette invalide' });
    }
    if (!Number.isInteger(quantite) || quantite < 1) {
      return res.status(400).json({ message: 'La quantité doit être un nombre entier supérieur ou égal à 1' });
    }
    const erreur = erreurPeriode(debutLocation, finLocation);
    if (erreur) return res.status(400).json({ message: erreur });

    const client = await Client.findById(idClient).select('nom prenom mail').lean();
    if (!client) {
      return res.status(404).json({ message: 'Client introuvable' });
    }

    // Verrou par casquette : deux réservations envoyées en même temps ne peuvent pas
    // passer toutes les deux la vérification de stock
    const resultat = await avecVerrou(idCasquette, async () => {
      const casquette = await Casquette.findById(idCasquette);
      if (!casquette) return { status: 404, body: { message: 'Casquette introuvable' } };
      if (!casquette.disponible) {
        return { status: 409, body: { message: "Cette casquette n'est pas disponible à la réservation" } };
      }

      const disponible = await quantiteDisponible(casquette, debutLocation, finLocation);
      if (quantite > disponible) {
        return {
          status: 409,
          body: {
            message: disponible === 0
              ? 'Plus aucune casquette disponible sur cette période'
              : `Seulement ${disponible} casquette(s) disponible(s) sur cette période`,
          },
        };
      }

      const reservation = await Reservation.create({
        idClient,
        idCasquette,
        quantite,
        debutLocation,
        finLocation,
        // statut prend sa valeur par défaut définie dans le schéma
      });
      return {
        status: 201,
        body: { ...avecDatesFormatees(reservation.toObject()), reference: referenceReservation(reservation._id) },
        casquette,
      };
    });

    if (resultat.status !== 201) return res.status(resultat.status).json(resultat.body);

    // La réservation est enregistrée même si le mail ne part pas (serveur SMTP en panne…)
    let mailEnvoye = true;
    try {
      await envoyerConfirmationReservation({ client, casquette: resultat.casquette, reservation: resultat.body });
    } catch (err) {
      mailEnvoye = false;
      console.error('Mail de confirmation non envoyé :', err.message);
    }

    res.status(201).json({ ...resultat.body, mailEnvoye });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return res.status(400).json({ message });
    }
    erreurServeur(res, err);
  }
});

module.exports = router;
