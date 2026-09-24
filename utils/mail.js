const nodemailer = require('nodemailer');
const { referenceReservation } = require('./reservation');

// Serveur SMTP configuré dans le .env (MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM).
// Port 465 = connexion chiffrée en TLS dès le départ (secure: true).
const port = Number(process.env.MAIL_PORT) || 465;
const transporteur = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port,
  secure: port === 465,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  authMethod: 'LOGIN',
});

const EXPEDITEUR = process.env.MAIL_FROM || process.env.MAIL_USER;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatPrix(prix) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(prix ?? 0);
}

// Envoie au client le récapitulatif de sa réservation.
// `reservation.debutLocation` et `finLocation` sont déjà au format JJ/MM/AAAA.
async function envoyerConfirmationReservation({ client, casquette, reservation }) {
  const lignes = [
    ['Numéro de réservation', referenceReservation(reservation._id)],
    ['Casquette', casquette.nom],
    ['Quantité', String(reservation.quantite)],
    ['Prix par casquette', formatPrix(casquette.prix)],
    ['Début de location', reservation.debutLocation],
    ['Fin de location', reservation.finLocation],
  ];

  const texte = [
    `Bonjour ${client.prenom} ${client.nom},`,
    '',
    'Votre réservation est confirmée. Voici son récapitulatif :',
    '',
    ...lignes.map(([label, valeur]) => `${label} : ${valeur}`),
    '',
    `Les casquettes sont à rendre au plus tard le ${reservation.finLocation}.`,
    '',
    "L'équipe No Cap",
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 560px;">
      <h2 style="color: #4f46e5;">Votre réservation est confirmée</h2>
      <p>Bonjour ${escapeHtml(client.prenom)} ${escapeHtml(client.nom)},</p>
      <p>Voici le récapitulatif de votre réservation :</p>
      <table style="border-collapse: collapse; width: 100%;">
        ${lignes.map(([label, valeur]) => `
        <tr>
          <td style="padding: 6px 12px 6px 0; color: #64748b;">${escapeHtml(label)}</td>
          <td style="padding: 6px 0; font-weight: bold;">${escapeHtml(valeur)}</td>
        </tr>`).join('')}
      </table>
      <p>Les casquettes sont à rendre au plus tard le ${escapeHtml(reservation.finLocation)}.</p>
      <p>L'équipe No Cap</p>
    </div>`;

  await transporteur.sendMail({
    from: EXPEDITEUR,
    to: client.mail,
    subject: `Confirmation de votre réservation : ${casquette.nom}`,
    text: texte,
    html,
  });
}

module.exports = { transporteur, envoyerConfirmationReservation };
