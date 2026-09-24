// Importe dans MongoDB le catalogue de casquettes de la boutique.
// Utilisation : npm run importer-casquettes
// Seules les casquettes absentes (même nom) sont ajoutées : on peut relancer le script sans
// créer de doublons ni écraser ce qui a été modifié depuis le dashboard admin.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Casquette = require('../models/Casquette');

const STOCK_PAR_MODELE = 1; // nombre d'exemplaires de chaque modèle

const CATALOGUE = [
  {
    nom: 'New Era 59FIFTY NY Black Edition',
    categorie: 'Snapback',
    prix: 5,
    caution: 50,
    disponible: true,
    etat: '10/10 - Neuf',
    image: 'images/1.jpeg',
    description: 'Classique incontournable du streetwear. Broderie 3D blanche sur visière plate noire, idéale pour vos événements lyonnais.',
  },
  {
    nom: 'Supreme Military Camp Cap Olive',
    categorie: 'Dad Hat',
    prix: 7,
    caution: 80,
    disponible: true,
    etat: '9.5/10 - Excellent',
    image: 'images/2.jpeg',
    description: "Casquette 5 panels Supreme en coton ripstop renforcé. Logo box cousu à l'avant, sangle ajustable en cuir à l'arrière.",
  },
  {
    nom: 'Jacquemus Le Bob Artichaut Red',
    categorie: 'Bucket Hat',
    prix: 10,
    caution: 120,
    disponible: true,
    etat: '10/10 - État Neuf',
    image: 'images/3.jpeg',
    description: 'Bob emblématique Jacquemus avec bord effiloché et cordon de serrage ajustable. Logo argenté thermosoudé.',
  },
  {
    nom: 'Off-White Industrial Arrow Cap',
    categorie: 'Luxe',
    prix: 14,
    caution: 180,
    disponible: true,
    etat: '10/10 - Neuf',
    image: 'images/4.jpeg',
    description: 'Pièce haut de gamme signée Virgil Abloh. Broderie flèches industrielles Off-White sur coton gabardine noir intense.',
  },
  {
    nom: 'Stüssy Stock Logo Bucket Vintage',
    categorie: 'Bucket Hat',
    prix: 6,
    caution: 60,
    disponible: false,
    etat: '9/10 - Très bon',
    image: 'images/5.jpeg',
    description: 'Bob Stüssy en coton lavé style 90s. Incontournable pour un look skate streetwear chill à Bellecour.',
  },
  {
    nom: 'Gucci GG Canvas Monogram Cap',
    categorie: 'Luxe',
    prix: 18,
    caution: 250,
    disponible: true,
    etat: '10/10 - Parfait',
    image: 'images/6.jpeg',
    description: 'Casquette de baseball en toile Supreme GG avec bande Web vert et rouge emblématique. Luxe absolu.',
  },
  {
    nom: 'Nike ACG Heritage86 Cap',
    categorie: 'Dad Hat',
    prix: 5,
    caution: 45,
    disponible: true,
    etat: '10/10 - Neuf',
    image: 'images/7.jpeg',
    description: 'Modèle outdoor technique Nike All Conditions Gear. Tissu déperlant léger et attache rapide réglable.',
  },
  {
    nom: 'Carhartt WIP Backley Cap',
    categorie: 'Snapback',
    prix: 5,
    caution: 50,
    disponible: true,
    etat: '9.5/10 - Excellent',
    image: 'images/8.jpeg',
    description: 'Casquette 5 panneaux rigide en toile de coton canvas heavy duty avec étiquette Carhartt classique sur le devant.',
  },
  {
    nom: 'Prada Re-Nylon Bucket Hat',
    categorie: 'Luxe',
    prix: 16,
    caution: 220,
    disponible: true,
    etat: '10/10 - Neuf',
    image: 'images/9.jpeg',
    description: 'Emblématique bob Prada en nylon régénéré Re-Nylon orné du célèbre logo triangle en métal émaillé.',
  },
  {
    nom: 'Palace Skateboards Tri-Lerg Cap',
    categorie: 'Snapback',
    prix: 8,
    caution: 75,
    disponible: true,
    etat: '9/10 - Très bon',
    image: 'images/10.jpeg',
    description: 'Snapback de la marque londonienne Palace avec logo Triferg brodé en relief. Look skate streetwear affirmé.',
  },
  {
    nom: 'Patagonia P-6 Logo Trucker',
    categorie: 'Dad Hat',
    prix: 4,
    caution: 40,
    disponible: true,
    etat: '10/10 - Neuf',
    image: 'images/11.jpeg',
    description: "Casquette trucker classique avec filet respirant à l'arrière et visière fabriquée en filets de pêche recyclés.",
  },
  {
    nom: 'Ralph Lauren Cotton Chino Cap',
    categorie: 'Dad Hat',
    prix: 6,
    caution: 55,
    disponible: true,
    etat: '9.5/10 - Excellent',
    image: 'images/12.jpeg',
    description: 'Casquette en coton chino lavé avec le joueur de polo iconique brodé sur le devant. Style préppy intemporel.',
  },
  {
    nom: 'Ami Paris Cœur Cap',
    categorie: 'Luxe',
    prix: 11,
    caution: 130,
    disponible: true,
    etat: '10/10 - Neuf',
    image: 'images/13.jpeg',
    description: 'Casquette minimaliste en gabardine de coton rehaussée du logo Ami de Cœur brodé au fil rouge.',
  },
  {
    nom: 'Kangol Casual Bucket Wool',
    categorie: 'Bucket Hat',
    prix: 6,
    caution: 65,
    disponible: true,
    etat: '9/10 - Très bon',
    image: 'images/14.jpeg',
    description: 'Le bob iconique Kangol en laine mélangée forme cloche. Un classique hip-hop des années 90 réinventé.',
  },
  {
    nom: 'Mitchell & Ness Chicago Bulls Vintage',
    categorie: 'Snapback',
    prix: 6,
    caution: 55,
    disponible: true,
    etat: '9.5/10 - Excellent',
    image: 'images/15.jpeg',
    description: 'Casquette vintage de la franchise NBA des Chicago Bulls avec coupe rétro et visière verte sous le dessous.',
  },
  {
    nom: "Arc'teryx Bird Head Cap",
    categorie: 'Dad Hat',
    prix: 7,
    caution: 70,
    disponible: true,
    etat: '10/10 - Neuf',
    image: 'images/16.jpeg',
    description: "Modèle techwear très recherché avec le logo fossile Arc'teryx brodé. Respirante et ultra légère.",
  },
  {
    nom: 'Balenciaga Logo Embroidery Cap',
    categorie: 'Luxe',
    prix: 15,
    caution: 200,
    disponible: true,
    etat: '10/10 - Neuf',
    image: 'images/17.jpeg',
    description: 'Casquette de baseball Balenciaga effet délavé avec logo brodé sur la visière. Style streetwear haut de gamme.',
  },
  {
    nom: 'Stone Island Compass Patch Cap',
    categorie: 'Luxe',
    prix: 12,
    caution: 150,
    disponible: true,
    etat: '10/10 - Neuf',
    image: 'images/18.jpeg',
    description: "Casquette Stone Island en toile de coton technique avec l'écusson boussole iconique appliqué sur la face avant.",
  },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  let ajoutees = 0;
  // Une par une, dans l'ordre : la boutique affiche les casquettes par date d'ajout
  for (const casquette of CATALOGUE) {
    const { upsertedCount } = await Casquette.updateOne(
      { nom: casquette.nom },
      { $setOnInsert: { ...casquette, stock: STOCK_PAR_MODELE } },
      { upsert: true }
    );
    ajoutees += upsertedCount;
  }

  console.log(`${ajoutees} casquette(s) ajoutée(s), ${CATALOGUE.length - ajoutees} déjà présente(s).`);
}

main()
  .catch((err) => {
    console.error('Erreur :', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
