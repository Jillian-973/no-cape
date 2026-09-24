// Crée un compte admin (ou change son mot de passe s'il existe déjà).
// Utilisation : npm run creer-admin
// Le mot de passe est demandé sans s'afficher, puis enregistré uniquement sous forme d'empreinte bcrypt.
require('dotenv').config({ quiet: true });
const readline = require('readline');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('../models/Admin');

const COUT_BCRYPT = 12; // 2^12 tours : lent exprès pour rendre les attaques par force brute très coûteuses
const LONGUEUR_MIN = 6; // longueur minimale du mot de passe (en clair)

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
const lignes = rl[Symbol.asyncIterator]();

// Masque ce qui est tapé pendant la saisie du mot de passe
let masquerSaisie = false;
rl._writeToOutput = (texte) => {
  if (!masquerSaisie) process.stdout.write(texte);
};

async function demander(question, { masque = false } = {}) {
  process.stdout.write(question);
  masquerSaisie = masque;
  const { value } = await lignes.next();
  masquerSaisie = false;
  if (masque) process.stdout.write('\n');
  return (value ?? '').trim();
}

async function main() {
  const identifiant = (await demander('Identifiant admin : ')).toLowerCase();
  if (!identifiant || identifiant.length > 50) throw new Error('Identifiant obligatoire (50 caractères maximum).');

  const motDePasse = await demander(`Mot de passe (${LONGUEUR_MIN} caractères minimum) : `, { masque: true });
  if (motDePasse.length < LONGUEUR_MIN) throw new Error(`Le mot de passe doit faire au moins ${LONGUEUR_MIN} caractères.`);

  const confirmation = await demander('Confirmez le mot de passe : ', { masque: true });
  if (confirmation !== motDePasse) throw new Error('Les deux mots de passe ne correspondent pas.');

  await mongoose.connect(process.env.MONGO_URI);
  const empreinte = await bcrypt.hash(motDePasse, COUT_BCRYPT);
  const existant = await Admin.exists({ identifiant });
  await Admin.updateOne({ identifiant }, { identifiant, motDePasse: empreinte }, { upsert: true });

  console.log(existant ? `Mot de passe de « ${identifiant} » modifié.` : `Admin « ${identifiant} » créé.`);
}

main()
  .catch((err) => {
    console.error('Erreur :', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await mongoose.disconnect();
  });
