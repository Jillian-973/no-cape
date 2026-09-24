// Dashboard admin des réservations (views/admin/dashboard.html)
// Toutes les routes /api/admin demandent d'être connecté : sinon on renvoie vers la page de connexion.

// État de la page
let reservations = [];
let filtre = '';     // '' = toutes, 'probleme' = invalides, sinon un état ('en location', 'à venir', 'rendue')
let recherche = '';
let reservationEnCours = null; // réservation ouverte dans la modale

// Éléments du DOM
const adminIdentifiant = document.getElementById('admin-identifiant');
const boutonDeconnexion = document.getElementById('bouton-deconnexion');
const filtres = document.getElementById('filtres-etat');
const rechercheInput = document.getElementById('recherche');
const reservationsGrid = document.getElementById('reservations-grid');
const reservationsMessage = document.getElementById('reservations-message');
const modale = document.getElementById('modale-probleme');
const problemeForm = document.getElementById('probleme-form');
const problemeContexte = document.getElementById('probleme-contexte');
const problemeMessage = document.getElementById('probleme-message');
const boutonSignaler = problemeForm.querySelector('button[type="submit"]');


// ---------- Appels API ----------

async function api(route, options = {}) {
  const res = await fetch('/api/admin' + route, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  // Session expirée ou absente -> retour à la connexion
  if (res.status === 401) {
    window.location.href = '/admin/connexion';
    throw new Error('Connexion admin requise');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || `${route} a répondu ${res.status}`);
  return body;
}


// ---------- Utilitaires ----------

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

function afficherMessage(element, texte, type = 'info') {
  const couleurs = { info: 'text-slate-500', erreur: 'text-red-600', succes: 'text-green-600' };
  element.textContent = texte;
  element.className = `text-sm ${couleurs[type]} ${texte ? '' : 'hidden'}`;
}

const couleursEtat = {
  'en location': 'bg-indigo-100 text-indigo-700',
  'à venir': 'bg-sky-100 text-sky-700',
  'rendue': 'bg-slate-200 text-slate-700',
  'annulée': 'bg-red-100 text-red-700',
};

// Un problème ne peut être signalé qu'une fois la location commencée
function peutSignaler(r) {
  return r.etat === 'en location' || r.etat === 'rendue';
}


// ---------- Liste des réservations ----------

async function chargerReservations() {
  try {
    reservations = await api('/reservations');
    afficherReservations();
  } catch (err) {
    reservations = [];
    afficherReservations();
    afficherMessage(reservationsMessage, `Impossible de charger les réservations (${err.message}).`, 'erreur');
  }
}

function correspondFiltre(r) {
  if (filtre === 'probleme') return Boolean(r.probleme);
  return !filtre || r.etat === filtre;
}

function correspondRecherche(r) {
  if (!recherche) return true;
  const texte = [r.client?.prenom, r.client?.nom, r.client?.mail, r.client?.telephone, r.casquette?.nom]
    .join(' ')
    .toLowerCase();
  return texte.includes(recherche);
}

function afficherFiltres() {
  for (const bouton of filtres.querySelectorAll('[data-filtre]')) {
    const valeur = bouton.dataset.filtre;
    const actif = valeur === filtre;
    const nombre = reservations.filter((r) => {
      if (valeur === 'probleme') return Boolean(r.probleme);
      return !valeur || r.etat === valeur;
    }).length;
    bouton.className = `cursor-pointer rounded-full border px-3 py-1 ${actif
      ? 'border-indigo-600 bg-indigo-600 text-white'
      : 'border-slate-300 bg-white hover:bg-slate-100'}`;
    bouton.dataset.label ??= bouton.textContent; // libellé d'origine, sans le compteur
    bouton.textContent = `${bouton.dataset.label} (${nombre})`;
  }
}

function carteReservation(r) {
  const client = r.client;
  const nomClient = client ? `${client.prenom} ${client.nom}` : 'Client supprimé';

  const mentionProbleme = r.probleme ? `
    <div class="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <p class="font-semibold">
        ⚠ ${escapeHtml(r.probleme.quantite)} article(s) avec un problème
        <span class="font-normal text-red-600">· signalé le ${escapeHtml(r.probleme.signaleLe)}</span>
      </p>
      <p class="whitespace-pre-line break-words">${escapeHtml(r.probleme.details)}</p>
    </div>` : '';

  const boutonInvalide = peutSignaler(r) ? `
    <button type="button" data-signaler="${escapeHtml(r._id)}"
      class="cursor-pointer rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
      ${r.probleme ? 'Modifier le problème' : 'Invalide'}
    </button>` : `
    <span class="text-xs text-slate-400">${r.etat === 'à venir' ? 'Signalement possible dès le début de la location' : ''}</span>`;

  return `
    <article class="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm ${r.probleme ? 'border-red-300' : 'border-slate-200'}">
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-semibold">${escapeHtml(r.casquette?.nom ?? 'Casquette supprimée')}</h3>
        <div class="flex flex-wrap justify-end gap-1">
          ${r.probleme ? '<span class="whitespace-nowrap rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">Invalide</span>' : ''}
          <span class="whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${couleursEtat[r.etat] ?? 'bg-slate-100 text-slate-600'}">
            ${escapeHtml(r.etat)}
          </span>
        </div>
      </div>

      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt class="text-slate-500">Client</dt>
        <dd class="font-medium">${escapeHtml(nomClient)}</dd>
        <dt class="text-slate-500">Téléphone</dt>
        <dd>${client ? `<a href="tel:${escapeHtml(client.telephone)}" class="text-indigo-600 hover:underline">${escapeHtml(client.telephone)}</a>` : '—'}</dd>
        <dt class="text-slate-500">Mail</dt>
        <dd class="break-all">${client ? `<a href="mailto:${escapeHtml(client.mail)}" class="text-indigo-600 hover:underline">${escapeHtml(client.mail)}</a>` : '—'}</dd>
        <dt class="text-slate-500">Quantité</dt>
        <dd>${escapeHtml(r.quantite)}</dd>
        <dt class="text-slate-500">Prix unitaire</dt>
        <dd>${r.casquette ? formatPrix(r.casquette.prix) : '—'}</dd>
        <dt class="text-slate-500">Du</dt>
        <dd>${escapeHtml(r.debutLocation)}</dd>
        <dt class="text-slate-500">Au</dt>
        <dd>${escapeHtml(r.finLocation)}</dd>
        <dt class="text-slate-500">Statut</dt>
        <dd>${escapeHtml(r.statut)}</dd>
        <dt class="text-slate-500">Réservée le</dt>
        <dd>${escapeHtml(r.reserveeLe)}</dd>
      </dl>

      ${mentionProbleme}

      <div class="mt-auto flex justify-end">${boutonInvalide}</div>
    </article>`;
}

function afficherReservations() {
  afficherFiltres();
  const visibles = reservations.filter((r) => correspondFiltre(r) && correspondRecherche(r));
  afficherMessage(reservationsMessage, visibles.length ? '' : 'Aucune réservation.');
  reservationsGrid.innerHTML = visibles.map(carteReservation).join('');
}

filtres.addEventListener('click', (e) => {
  const bouton = e.target.closest('[data-filtre]');
  if (!bouton) return;
  filtre = bouton.dataset.filtre;
  afficherReservations();
});

rechercheInput.addEventListener('input', () => {
  recherche = rechercheInput.value.trim().toLowerCase();
  afficherReservations();
});


// ---------- Modale « Signaler un problème » ----------

function ouvrirModale(reservation) {
  reservationEnCours = reservation;
  const { quantite, details } = problemeForm.elements;

  problemeContexte.textContent =
    `${reservation.casquette?.nom ?? 'Casquette'} · ${reservation.client?.prenom ?? ''} ${reservation.client?.nom ?? ''}` +
    ` · ${reservation.quantite} article(s) loué(s)`;
  quantite.max = reservation.quantite;
  quantite.value = reservation.probleme?.quantite ?? 1;
  details.value = reservation.probleme?.details ?? '';
  boutonSignaler.textContent = reservation.probleme ? 'Enregistrer' : 'Signaler';
  afficherMessage(problemeMessage, '');

  modale.showModal();
  details.focus();
}

function fermerModale() {
  modale.close();
  reservationEnCours = null;
}

reservationsGrid.addEventListener('click', (e) => {
  const bouton = e.target.closest('[data-signaler]');
  if (!bouton) return;
  const reservation = reservations.find((r) => r._id === bouton.dataset.signaler);
  if (reservation) ouvrirModale(reservation);
});

document.getElementById('probleme-annuler').addEventListener('click', fermerModale);

// Clic sur le fond grisé (en dehors de la boîte) -> ferme la modale
modale.addEventListener('click', (e) => {
  if (e.target === modale) fermerModale();
});

problemeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!reservationEnCours) return;

  const quantite = Number(problemeForm.elements.quantite.value);
  const details = problemeForm.elements.details.value.trim();

  if (!Number.isInteger(quantite) || quantite < 1 || quantite > reservationEnCours.quantite) {
    afficherMessage(problemeMessage, `Indiquez un nombre entre 1 et ${reservationEnCours.quantite}.`, 'erreur');
    return;
  }
  if (!details) {
    afficherMessage(problemeMessage, 'Détaillez le problème.', 'erreur');
    return;
  }

  boutonSignaler.disabled = true;
  afficherMessage(problemeMessage, 'Enregistrement…');

  try {
    const miseAJour = await api(`/reservations/${reservationEnCours._id}/probleme`, {
      method: 'POST',
      body: JSON.stringify({ quantite, details }),
    });
    // Remplace la réservation dans la liste : la mention apparaît tout de suite sur la carte
    reservations = reservations.map((r) => (r._id === miseAJour._id ? miseAJour : r));
    fermerModale();
    afficherReservations();
  } catch (err) {
    afficherMessage(problemeMessage, err.message, 'erreur');
  } finally {
    boutonSignaler.disabled = false;
  }
});


// ---------- Déconnexion ----------

boutonDeconnexion.addEventListener('click', async () => {
  try {
    await api('/deconnexion', { method: 'POST' });
  } finally {
    window.location.href = '/admin/connexion';
  }
});


// ---------- Démarrage ----------

async function init() {
  try {
    const admin = await api('/moi');
    adminIdentifiant.textContent = admin.identifiant;
  } catch {
    return; // api() a déjà renvoyé vers la page de connexion
  }
  await chargerReservations();
}

init();
