const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { rateLimit } = require('express-rate-limit');
const Admin = require('../models/Admin');
const Reservation = require('../models/Reservation');
const Casquette = require('../models/Casquette');
const {
  aujourdhui,
  jour,
  formatJour,
  etatReservation,
  terminerLocationsPassees,
} = require('../utils/disponibilite');
const { estId, sontDesTextes, erreurServeur } = require('../utils/securite');
const { connecter, deconnecter, adminConnecte, exigerAdmin } = require('../utils/auth');
const { referenceReservation, prixTotal } = require('../utils/reservation');

// Monté sur /api/admin dans app.js

// Anti force brute : 5 essais ratés maximum par tranche de 15 minutes et par adresse IP
const limiteConnexion = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Trop de tentatives de connexion, réessayez dans 15 minutes.' },
});

// Empreinte bcrypt factice : quand l'identifiant n'existe pas, on fait quand même une
// comparaison bcrypt pour que la réponse prenne le même temps (sinon on pourrait deviner
// les identifiants qui existent en mesurant le temps de réponse).
const EMPREINTE_FACTICE = bcrypt.hashSync('mot-de-passe-factice', 12);

// POST /api/admin/connexion -> vérifie identifiant + mot de passe et pose le cookie de session
router.post('/connexion', limiteConnexion, async (req, res) => {
  try {
    const { identifiant, motDePasse } = req.body ?? {};
    if (!sontDesTextes(identifiant, motDePasse) || !identifiant || !motDePasse) {
      return res.status(400).json({ message: 'Identifiant et mot de passe obligatoires' });
    }

    const admin = await Admin.findOne({ identifiant: identifiant.trim().toLowerCase() }).select('+motDePasse');
    const motDePasseCorrect = await bcrypt.compare(motDePasse, admin?.motDePasse ?? EMPREINTE_FACTICE);

    // Même message dans les deux cas : on ne dit pas si c'est l'identifiant ou le mot de passe qui est faux
    if (!admin || !motDePasseCorrect) {
      return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect' });
    }

    connecter(res, admin);
    res.json({ identifiant: admin.identifiant });
  } catch (err) {
    erreurServeur(res, err);
  }
});

// POST /api/admin/deconnexion -> supprime le cookie de session
router.post('/deconnexion', (req, res) => {
  deconnecter(res);
  res.json({ message: 'Déconnecté' });
});

// GET /api/admin/moi -> l'admin connecté (401 sinon)
router.get('/moi', async (req, res) => {
  const admin = await adminConnecte(req);
  if (!admin) return res.status(401).json({ message: 'Connexion admin requise' });
  res.json({ identifiant: admin.identifiant });
});

// ---------- Routes réservées aux admins connectés ----------

router.use(exigerAdmin);

// Réservation avec TOUTES les infos (client complet, casquette, problème) pour le dashboard
function reservationAdmin(r, date) {
  return {
    _id: r._id,
    reference: referenceReservation(r._id),
    client: r.idClient
      ? {
          nom: r.idClient.nom,
          prenom: r.idClient.prenom,
          telephone: r.idClient.telephone,
          mail: r.idClient.mail,
          adresse: r.idClient.adresse,
          ville: r.idClient.ville,
        }
      : null,
    casquette: r.idCasquette ? { nom: r.idCasquette.nom, prix: r.idCasquette.prix } : null,
    quantite: r.quantite,
    prixTotal: prixTotal(r, r.idCasquette?.prix),
    debutLocation: formatJour(r.debutLocation),
    finLocation: formatJour(r.finLocation),
    statut: r.statut,
    etat: etatReservation(r, date),
    reserveeLe: formatJour(r.createdAt),
    probleme: r.probleme
      ? { quantite: r.probleme.quantite, details: r.probleme.details, signaleLe: formatJour(r.probleme.signaleLe) }
      : null,
  };
}

// GET /api/admin/reservations -> toutes les réservations avec toutes les infos
router.get('/reservations', async (req, res) => {
  try {
    await terminerLocationsPassees();
    const date = jour(aujourdhui());

    const reservations = await Reservation.find()
      .populate('idClient', 'nom prenom telephone mail adresse ville')
      .populate('idCasquette', 'nom prix')
      .sort({ debutLocation: -1 })
      .lean();

    res.json(reservations.map((r) => reservationAdmin(r, date)));
  } catch (err) {
    erreurServeur(res, err);
  }
});

// POST /api/admin/reservations/:id/probleme  { quantite, details }
// Signale (ou modifie) un problème : les articles concernés ne reviendront pas dans le stock
router.post('/reservations/:id/probleme', async (req, res) => {
  try {
    if (!estId(req.params.id)) return res.status(400).json({ message: 'Identifiant de réservation invalide' });

    const { quantite, details } = req.body ?? {};
    if (!Number.isInteger(quantite) || quantite < 1) {
      return res.status(400).json({ message: "Le nombre d'articles doit être un nombre entier supérieur ou égal à 1" });
    }
    if (typeof details !== 'string' || !details.trim()) {
      return res.status(400).json({ message: 'Détaillez le problème' });
    }

    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) return res.status(404).json({ message: 'Réservation introuvable' });
    if (reservation.statut === 'annulée') {
      return res.status(409).json({ message: 'Impossible de signaler un problème sur une réservation annulée' });
    }
    if (reservation.debutLocation > jour(aujourdhui())) {
      return res.status(409).json({ message: "La location n'a pas encore commencé" });
    }
    if (quantite > reservation.quantite) {
      return res.status(400).json({
        message: `Cette réservation ne compte que ${reservation.quantite} article(s)`,
      });
    }

    reservation.probleme = { quantite, details, signaleLe: new Date() };
    await reservation.save();

    await reservation.populate([
      { path: 'idClient', select: 'nom prenom telephone mail adresse ville' },
      { path: 'idCasquette', select: 'nom prix' },
    ]);
    res.json(reservationAdmin(reservation, jour(aujourdhui())));
  } catch (err) {
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return res.status(400).json({ message });
    }
    erreurServeur(res, err);
  }
});

// ---------- Inventaire des casquettes ----------

// Stock d'un nouveau modèle ajouté depuis le dashboard (le formulaire ne demande pas de quantité)
const STOCK_NOUVEAU_MODELE = 1;

// POST /api/admin/casquettes  { nom, categorie, prix, caution, image, description }
// Ajoute un modèle au catalogue
router.post('/casquettes', async (req, res) => {
  try {
    const { nom, categorie, prix, caution, image = '', description = '' } = req.body ?? {};
    if (!sontDesTextes(nom, categorie, image, description) || !nom.trim()) {
      return res.status(400).json({ message: 'Nom et catégorie obligatoires' });
    }
    if (!Casquette.CATEGORIES.includes(categorie)) {
      return res.status(400).json({ message: 'Catégorie inconnue' });
    }
    if (!Number.isFinite(prix) || prix < 0 || !Number.isFinite(caution) || caution < 0) {
      return res.status(400).json({ message: 'Le prix et la caution doivent être des nombres positifs' });
    }

    const casquette = await Casquette.create({
      nom,
      categorie,
      prix,
      caution,
      image,
      description,
      stock: STOCK_NOUVEAU_MODELE,
    });
    res.status(201).json(casquette);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const message = Object.values(err.errors).map((e) => e.message).join(', ');
      return res.status(400).json({ message });
    }
    erreurServeur(res, err);
  }
});

// POST /api/admin/casquettes/:id/disponible  { disponible: true | false }
// Ouvre ou ferme un modèle à la réservation
router.post('/casquettes/:id/disponible', async (req, res) => {
  try {
    if (!estId(req.params.id)) return res.status(400).json({ message: 'Identifiant de casquette invalide' });

    const { disponible } = req.body ?? {};
    if (typeof disponible !== 'boolean') {
      return res.status(400).json({ message: '`disponible` doit valoir true ou false' });
    }

    const casquette = await Casquette.findByIdAndUpdate(req.params.id, { disponible }, { returnDocument: 'after' });
    if (!casquette) return res.status(404).json({ message: 'Casquette introuvable' });
    res.json(casquette);
  } catch (err) {
    erreurServeur(res, err);
  }
});

module.exports = router;
