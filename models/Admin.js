const mongoose = require('mongoose');

// Compte administrateur. Créé avec : npm run creer-admin
// L'id est généré automatiquement par MongoDB (champ _id)
const adminSchema = new mongoose.Schema(
  {
    identifiant: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 50,
    },
    // Jamais le mot de passe en clair : uniquement son empreinte bcrypt.
    // select: false -> il n'est jamais renvoyé par une requête, sauf si on le demande avec .select('+motDePasse')
    motDePasse: {
      type: String,
      required: true,
      select: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);
