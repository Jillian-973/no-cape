require('dotenv').config({ quiet: true });
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');

const casquetteRoutes = require('./controllers/casquetteController');
const clientRoutes = require('./controllers/clientController');
const reservationRoutes = require('./controllers/reservationController');
const adminRoutes = require('./controllers/adminController');
const { adminConnecte, exigerAdminPage } = require('./utils/auth');

// Clé secrète qui signe les sessions admin : obligatoire, longue et aléatoire
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET manquant ou trop court dans le .env (32 caractères minimum).');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const EN_PRODUCTION = process.env.NODE_ENV === 'production';

// Derrière un hébergeur / proxy (Render, Heroku, Nginx…), mettre TRUST_PROXY=1 dans le .env
// pour que la limite de requêtes voie la vraie adresse IP des visiteurs.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));

// ---------- Sécurité ----------

// En-têtes HTTP de sécurité (anti-clickjacking, anti-sniffing, HSTS, CSP…)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Scripts : nos fichiers + Tailwind (jsdelivr pour les pages admin, cdn.tailwindcss.com pour le site)
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://cdn.tailwindcss.com'],
        // Les boutons du site utilisent des attributs onclick="…" : autorisés, mais jamais de <script> en ligne.
        // Les données affichées sont échappées par le front (voir escapeHtml dans public/js/script.js).
        scriptSrcAttr: ["'unsafe-inline'"],
        // Tailwind (version navigateur) injecte ses styles dans la page, d'où 'unsafe-inline'
        // + police Inter (Google Fonts) et icônes Font Awesome (cdnjs)
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
        // Les images des casquettes peuvent venir de n'importe quel site en https
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        // En local on est en http : ne pas forcer le passage en https
        upgradeInsecureRequests: EN_PRODUCTION ? [] : null,
      },
    },
  })
);

// CORS : seules ces origines peuvent appeler l'API depuis un AUTRE site.
// Le front servi par Express (même origine) n'est pas concerné.
// Par défaut : Live Server. En production : CORS_ORIGINS=https://mon-site.fr dans le .env
const originesAutorisees = (process.env.CORS_ORIGINS ?? 'http://localhost:5500,http://127.0.0.1:5500')
  .split(',')
  .map((origine) => origine.trim())
  .filter(Boolean);
app.use('/api', cors({ origin: originesAutorisees, methods: ['GET', 'POST'] }));

// Limite de requêtes par adresse IP (anti-spam / anti-surcharge)
const limiteLecture = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, réessayez dans quelques minutes.' },
});
const limiteEcriture = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  limit: 20, // une réservation = 2 requêtes (client + réservation), 3 si le client réutilise ses infos
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Les routes admin ont leur propre protection (connexion obligatoire + limite sur les tentatives)
  skip: (req) => req.method === 'GET' || req.method === 'OPTIONS' || req.path.startsWith('/admin/'),
  message: { message: 'Trop de réservations envoyées, réessayez plus tard.' },
});
app.use('/api', limiteLecture, limiteEcriture);

// JSON limité à 10 ko : largement assez pour un formulaire, bloque les envois géants
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ---------- Pages admin (hors du dossier public : servies seulement si on a le droit) ----------

const PAGES_ADMIN = path.join(__dirname, 'views', 'admin');

// Page de connexion (renvoie à l'espace admin si on est déjà connecté)
app.get('/admin/connexion', async (req, res) => {
  if (await adminConnecte(req)) return res.redirect('/admin.html');
  res.sendFile(path.join(PAGES_ADMIN, 'connexion.html'));
});

// Espace administration du site (inventaire + réservations) : uniquement pour un admin connecté
app.get('/admin.html', exigerAdminPage, (req, res) => {
  res.sendFile(path.join(PAGES_ADMIN, 'admin.html'));
});

// Dashboard détaillé des réservations (coordonnées clients, signalement des problèmes)
app.get('/admin', exigerAdminPage, (req, res) => {
  res.sendFile(path.join(PAGES_ADMIN, 'dashboard.html'));
});

// Sert le site (public/*.html, public/js, public/css, public/images)
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Routes API ----------

app.use('/api/casquettes', casquetteRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/admin', adminRoutes);

// Route API inconnue
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Route introuvable' });
});

// Erreurs non gérées (JSON mal formé, corps trop gros…) : jamais de détail interne renvoyé
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? 'Erreur interne du serveur' : 'Requête invalide' });
});

// Connexion à MongoDB puis démarrage du serveur
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connecté à MongoDB');
    app.listen(PORT, () => {
      console.log(`Serveur démarré sur http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Erreur de connexion à MongoDB :', err.message);
    process.exit(1);
  });
