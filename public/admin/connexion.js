// Page de connexion admin (views/admin/connexion.html)

const form = document.getElementById('connexion-form');
const message = document.getElementById('connexion-message');
const bouton = form.querySelector('button[type="submit"]');

function afficherMessage(texte, type = 'info') {
  const couleurs = { info: 'text-slate-500', erreur: 'text-red-600' };
  message.textContent = texte;
  message.className = `text-sm ${couleurs[type]} ${texte ? '' : 'hidden'}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { identifiant, motDePasse } = Object.fromEntries(new FormData(form));

  bouton.disabled = true;
  afficherMessage('Connexion…');

  try {
    const res = await fetch('/api/admin/connexion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifiant, motDePasse }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.message || `La connexion a répondu ${res.status}`);

    // Le cookie de session est posé par le serveur : on part sur l'espace administration
    window.location.href = '/admin.html';
  } catch (err) {
    form.elements.motDePasse.value = '';
    afficherMessage(err.message, 'erreur');
    bouton.disabled = false;
  }
});
