const express = require('express');
const router = express.Router();
const Casquette = require('../models/Casquette');
const {
  aujourdhui,
  jour,
  erreurPeriode,
  reservationsSurPeriode,
  quantiteDisponible,
  quantiteOccupee,
} = require('../utils/disponibilite');
const { estId, erreurServeur } = require('../utils/securite');

// Monté sur /api/casquettes dans app.js

// GET /api/casquettes?date=JJ/MM/AAAA -> renvoie toutes les casquettes avec leur stock à cette date
//   stock           : nombre total de casquettes
//   enLocation      : nombre de casquettes louées ce jour-là
//   horsService     : articles signalés avec un problème, jamais revenus
//   stockDisponible : stock - enLocation - horsService
// Sans ?date, on prend la date du jour.
router.get('/', async (req, res) => {
  try {
    const date = jour(req.query.date || aujourdhui());
    if (!date) return res.status(400).json({ message: 'Date invalide (format attendu : JJ/MM/AAAA)' });

    // Ordre d'ajout au catalogue (c'est l'ordre affiché par la boutique)
    const casquettes = await Casquette.find().sort({ createdAt: 1, _id: 1 }).lean();
    const reservations = await reservationsSurPeriode(date, date);

    // Quantités louées et hors service ce jour-là, par casquette
    const louees = {};
    const horsService = {};
    for (const r of reservations) {
      const id = String(r.idCasquette);
      const occupees = quantiteOccupee(r, date);
      if (date <= r.finLocation) louees[id] = (louees[id] ?? 0) + occupees;
      else horsService[id] = (horsService[id] ?? 0) + occupees;
    }

    res.json(casquettes.map((c) => {
      const enLocation = louees[String(c._id)] ?? 0;
      const hs = horsService[String(c._id)] ?? 0;
      return { ...c, enLocation, horsService: hs, stockDisponible: Math.max(0, c.stock - enLocation - hs) };
    }));
  } catch (err) {
    erreurServeur(res, err);
  }
});

// GET /api/casquettes/:id/disponibilite?debut=JJ/MM/AAAA&fin=JJ/MM/AAAA
// -> nombre de casquettes réservables sur toute la période
router.get('/:id/disponibilite', async (req, res) => {
  try {
    if (!estId(req.params.id)) return res.status(400).json({ message: 'Identifiant de casquette invalide' });

    const debut = jour(req.query.debut);
    const fin = jour(req.query.fin);
    const erreur = erreurPeriode(debut, fin);
    if (erreur) return res.status(400).json({ message: erreur });

    const casquette = await Casquette.findById(req.params.id);
    if (!casquette) return res.status(404).json({ message: 'Casquette introuvable' });

    const disponible = casquette.disponible ? await quantiteDisponible(casquette, debut, fin) : 0;
    res.json({ stock: casquette.stock, disponible });
  } catch (err) {
    erreurServeur(res, err);
  }
});

module.exports = router;
