const mongoose = require('mongoose');

// Problème signalé par un admin (bouton « Invalide » du dashboard).
// Les articles concernés ne reviennent jamais dans le stock (voir utils/disponibilite.js).
const problemeSchema = new mongoose.Schema(
  {
    quantite: {
      type: Number,
      required: [true, "Le nombre d'articles concernés est obligatoire"],
      min: [1, 'Au moins 1 article doit être concerné'],
      validate: [Number.isInteger, "Le nombre d'articles doit être un nombre entier"],
    },
    details: {
      type: String,
      required: [true, 'Le détail du problème est obligatoire'],
      trim: true,
      maxlength: [1000, 'Le détail fait au maximum 1000 caractères'],
    },
    signaleLe: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// L'id est généré automatiquement par MongoDB (champ _id)
const reservationSchema = new mongoose.Schema(
  {
    idClient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: true,
    },
    idCasquette: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Casquette',
      required: true,
    },
    quantite: {
      type: Number,
      required: true,
      min: 1,
      validate: [Number.isInteger, 'La quantité doit être un nombre entier'],
    },
    debutLocation: {
      type: Date,
      required: true,
    },
    finLocation: {
      type: Date,
      required: true,
    },
    statut: {
      type: String,
      enum: ['confirmée', 'annulée', 'terminée'],
      default: 'confirmée',
    },
    // Absent tant qu'aucun problème n'a été signalé
    probleme: {
      type: problemeSchema,
      default: undefined,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reservation', reservationSchema);
