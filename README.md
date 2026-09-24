# NO CAP

Site de **location de casquettes streetwear à Lyon**. Les clients parcourent le catalogue, choisissent leurs dates et réservent en ligne ; ils reçoivent un mail de confirmation. Un espace admin permet de gérer l'inventaire et de suivre les réservations.

**Stack :** Node.js · Express 5 · MongoDB (Mongoose) · Nodemailer · Tailwind CSS

## Fonctionnalités

**Côté client**
- Catalogue des casquettes avec le stock disponible à une date donnée
- Réservation sur une période (30 jours maximum, jusqu'à un an à l'avance) avec vérification du stock en temps réel
- Client déjà enregistré (même nom + même mail) : on lui propose de réutiliser ses informations au lieu d'en créer de nouvelles
- Mail de confirmation envoyé par SMTP avec le récapitulatif de la réservation

**Côté admin**
- Connexion sécurisée (mot de passe bcrypt, session JWT en cookie)
- Ajout de modèles au catalogue, ouverture / fermeture à la réservation
- Liste complète des réservations avec les coordonnées des clients
- Signalement d'un problème sur une réservation : les articles concernés sortent définitivement du stock

**Sécurité :** en-têtes Helmet (CSP…), CORS restreint, limite de requêtes par IP, corps JSON limité à 10 ko, validation stricte des entrées (anti-injection NoSQL).

## Installation

Prérequis : **Node.js 20.19+** et une base **MongoDB** (Atlas ou locale).

```bash
git clone https://gitlab.outils.cloud/Killian/no-cap.git
cd no-cap
npm install
```

Crée un fichier `.env` à la racine (il n'est jamais commité) :

```env
PORT=3000
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<base>

# Clé qui signe les sessions admin : 32 caractères minimum, aléatoire
JWT_SECRET=

# Serveur SMTP des mails de confirmation (port 465 = TLS)
MAIL_HOST=
MAIL_PORT=465
MAIL_USER=
MAIL_PASS=
MAIL_FROM='"No Cap" <adresse@domaine.fr>'
```

Pour générer un `JWT_SECRET` :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

<details>
<summary>Variables optionnelles</summary>

| Variable | Rôle |
| --- | --- |
| `NODE_ENV` | `production` en ligne (cookies sécurisés, passage forcé en https) |
| `CORS_ORIGINS` | Origines autorisées à appeler l'API, séparées par des virgules (par défaut Live Server : `http://localhost:5500`) |
| `TRUST_PROXY` | `1` derrière un hébergeur ou un proxy (Render, Heroku, Nginx…) pour que la limite de requêtes voie la vraie IP |

</details>

Puis initialise la base et lance le serveur :

```bash
npm run importer-casquettes   # ajoute le catalogue (relançable sans doublons)
npm run creer-admin           # crée un compte admin
npm run dev                   # démarre sur http://localhost:3000
```

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm start` | Lance le serveur |
| `npm run dev` | Lance le serveur et le redémarre à chaque modification |
| `npm run creer-admin` | Crée un compte admin ou change son mot de passe |
| `npm run importer-casquettes` | Importe le catalogue de casquettes (n'ajoute que les modèles absents) |

## Pages

| URL | Page |
| --- | --- |
| `/` | Accueil |
| `/boutique.html` | Catalogue et réservation |
| `/contact.html` | Contact et boutiques |
| `/admin/connexion` | Connexion admin |
| `/admin.html` | Espace admin : inventaire et réservations *(connexion requise)* |
| `/admin` | Dashboard détaillé des réservations *(connexion requise)* |

> Ouvre le site sur **http://localhost:3000** (servi par Express). Avec Live Server, seul le port 5500 est prévu.

## API

Les dates circulent au format `JJ/MM/AAAA`.

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/api/casquettes?date=` | Casquettes avec leur stock disponible à la date donnée |
| GET | `/api/casquettes/:id/disponibilite?debut=&fin=` | Nombre d'exemplaires libres sur une période |
| POST | `/api/clients` | Crée un client (`409 CLIENT_EXISTANT` si le nom + mail existe, `reutiliser: true` pour le reprendre) |
| GET | `/api/reservations?date=` | Réservations publiques (prénom + initiale du nom seulement) avec leur état |
| POST | `/api/reservations` | Crée une réservation et envoie le mail de confirmation |

Routes admin (cookie de session obligatoire) :

| Méthode | Route | Rôle |
| --- | --- | --- |
| POST | `/api/admin/connexion` | Connexion |
| POST | `/api/admin/deconnexion` | Déconnexion |
| GET | `/api/admin/moi` | Admin connecté |
| GET | `/api/admin/reservations` | Toutes les réservations, avec les coordonnées des clients |
| POST | `/api/admin/reservations/:id/probleme` | Signale un problème (articles retirés du stock) |
| POST | `/api/admin/casquettes` | Ajoute un modèle au catalogue |
| POST | `/api/admin/casquettes/:id/disponible` | Ouvre ou ferme un modèle à la réservation |

## Structure

```
app.js            Serveur Express : sécurité, pages, routes API, connexion MongoDB
controllers/      Routes de l'API (casquettes, clients, réservations, admin)
models/           Schémas Mongoose (Casquette, Client, Reservation, Admin)
utils/            Auth admin, calcul du stock, envoi des mails, sécurité
scripts/          Création d'un admin, import du catalogue
public/           Site public (HTML, js/, css/, images/)
views/admin/      Pages admin, servies uniquement après connexion
```

## Règles de gestion du stock

- `stock` = nombre total d'exemplaires possédés ; il ne change pas quand on réserve.
- Une réservation occupe ses casquettes du jour de début au jour de fin **inclus**, puis elles reviennent dans le stock.
- Les articles signalés avec un problème ne reviennent **jamais** dans le stock.
- Les réservations annulées ne comptent pas.
