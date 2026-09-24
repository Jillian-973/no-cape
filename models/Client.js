const mongoose = require('mongoose');

// L'id est généré automatiquement par MongoDB (champ _id)
const clientSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: [true, 'Le nom est obligatoire'],
      trim: true,
      maxlength: [50, 'Le nom fait au maximum 50 caractères'],
    },
    prenom: {
      type: String,
      required: [true, 'Le prénom est obligatoire'],
      trim: true,
      maxlength: [50, 'Le prénom fait au maximum 50 caractères'],
    },
    telephone: {
      type: String,
      required: [true, 'Le téléphone est obligatoire'],
      trim: true,
      // chiffres, espaces, points ou tirets, avec un + devant pour l'international
      match: [/^\+?[0-9 .-]{6,20}$/, 'Numéro de téléphone invalide'],
    },
    mail: {
      type: String,
      required: [true, 'Le mail est obligatoire'],
      trim: true,
      lowercase: true,
      maxlength: [254, 'Adresse mail trop longue'],
      match: [/^\S+@\S+\.\S+$/, 'Adresse mail invalide'],
    },
    adresse: {
      type: String,
      trim: true,
      maxlength: [200, "L'adresse fait au maximum 200 caractères"],
      default: '',
    },
    ville: {
      type: String,
      trim: true,
      maxlength: [100, 'La ville fait au maximum 100 caractères'],
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Client', clientSchema);
