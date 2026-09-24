const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const { sontDesTextes, erreurServeur } = require('../utils/securite');

// Monté sur /api/clients dans app.js

// Cherche un client déjà enregistré avec ce nom et ce mail (sans tenir compte des majuscules).
// S'il y en a plusieurs (anciennes réservations), on prend le plus récent.
function trouverClient(nom, mail) {
  return Client.findOne({ nom: nom.trim(), mail: mail.trim().toLowerCase() })
    .collation({ locale: 'fr', strength: 2 })
    .sort({ createdAt: -1 });
}

// POST /api/clients -> crée un client et le renvoie (avec son _id)
//
// Si un client avec le même nom et le même mail existe déjà :
// - sans `reutiliser` -> 409 { code: 'CLIENT_EXISTANT' } : le front demande au client
//   si c'est sa première location et s'il veut réutiliser ses informations
// - avec `reutiliser: true` -> 200 { _id } : la réservation se fera avec le client existant.
//   On ne renvoie QUE l'id : connaître un nom et un mail ne doit pas suffire
//   à lire le téléphone ou le prénom enregistrés.
router.post('/', async (req, res) => {
  try {
    const { nom, prenom, telephone, mail, adresse = '', ville = '', reutiliser } = req.body ?? {};

    // Uniquement du texte : refuse les objets/tableaux envoyés à la place d'une valeur
    if (!sontDesTextes(nom, mail)) {
      return res.status(400).json({ message: 'Nom, prénom, téléphone et mail sont obligatoires' });
    }

    const existant = await trouverClient(nom, mail);
    if (existant) {
      if (reutiliser === true) return res.json({ _id: existant._id });
      return res.status(409).json({
        code: 'CLIENT_EXISTANT',
        message: 'Un client avec ce nom et ce mail est déjà enregistré',
      });
    }

    if (!sontDesTextes(prenom, telephone, adresse, ville)) {
      return res.status(400).json({ message: 'Nom, prénom, téléphone et mail sont obligatoires' });
    }

    const client = await Client.create({ nom, prenom, telephone, mail, adresse, ville });
    res.status(201).json(client);
  } catch (err) {
    // ValidationError = champ manquant, trop long ou invalide -> c'est la faute du client.
    // On ne renvoie que les messages des champs, pas le détail interne de Mongoose.
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return res.status(400).json({ message });
    }
    erreurServeur(res, err);
  }
});

module.exports = router;
