const mongoose = require('mongoose');

// Catégories proposées dans la boutique (filtres du front)
const CATEGORIES = ['Snapback', 'Bucket Hat', 'Dad Hat', 'Luxe'];

// L'id est généré automatiquement par MongoDB (champ _id)
const casquetteSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    categorie: {
      type: String,
      enum: CATEGORIES,
      default: 'Snapback',
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    // Prix de location par jour (€)
    prix: {
      type: Number,
      required: true,
      min: 0,
    },
    // Caution demandée au retrait (€)
    caution: {
      type: Number,
      min: 0,
      default: 0,
    },
    // État de l'article affiché au client (ex : « 10/10 - Neuf »)
    etat: {
      type: String,
      trim: true,
      maxlength: 50,
      default: '10/10 - Neuf',
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    image: {
      type: String, // URL de l'image (ou chemin relatif au site, ex : images/1.jpeg)
      trim: true,
      maxlength: 500,
      default: '',
    },
    disponible: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Casquette', casquetteSchema);
module.exports.CATEGORIES = CATEGORIES;
