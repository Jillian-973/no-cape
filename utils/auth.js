const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { estId } = require('./securite');

// Connexion admin : après un bon mot de passe, le serveur envoie un jeton (JWT) signé avec
// JWT_SECRET dans un cookie httpOnly. Le JavaScript de la page ne peut pas le lire
// (protection contre le vol par XSS) et sameSite=strict empêche un autre site de l'utiliser (CSRF).

const NOM_COOKIE = 'admin_token';
const DUREE_SESSION_MS = 8 * 60 * 60 * 1000; // 8 heures

function optionsCookie() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production', // cookie envoyé uniquement en https en production
    maxAge: DUREE_SESSION_MS,
    path: '/',
  };
}

function connecter(res, admin) {
  const jeton = jwt.sign({ sub: String(admin._id) }, process.env.JWT_SECRET, {
    expiresIn: DUREE_SESSION_MS / 1000,
  });
  res.cookie(NOM_COOKIE, jeton, optionsCookie());
}

function deconnecter(res) {
  const { maxAge, ...options } = optionsCookie();
  res.clearCookie(NOM_COOKIE, options);
}

// Renvoie l'admin connecté, ou null (pas de cookie, jeton invalide/expiré, compte supprimé)
async function adminConnecte(req) {
  const jeton = req.cookies?.[NOM_COOKIE];
  if (typeof jeton !== 'string') return null;
  try {
    const { sub } = jwt.verify(jeton, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!estId(sub)) return null;
    return await Admin.findById(sub);
  } catch {
    return null;
  }
}

// Middleware pour les routes API admin : 401 si pas connecté
async function exigerAdmin(req, res, next) {
  const admin = await adminConnecte(req);
  if (!admin) return res.status(401).json({ message: 'Connexion admin requise' });
  req.admin = admin;
  next();
}

// Middleware pour les pages admin : renvoie vers la page de connexion si pas connecté
async function exigerAdminPage(req, res, next) {
  const admin = await adminConnecte(req);
  if (!admin) return res.redirect('/admin/connexion');
  req.admin = admin;
  next();
}

module.exports = { connecter, deconnecter, adminConnecte, exigerAdmin, exigerAdminPage };
