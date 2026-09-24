// URL de l'API Express (app.js).
// Page servie par Express -> même adresse que le site ('/api'), marche aussi une fois en ligne.
// Page ouverte avec Live Server (port 5500) -> on appelle le serveur Express local (autorisé par cors).
const API_URL = window.location.port === '5500' ? 'http://localhost:3000/api' : '/api';

        // ---------- Appels API ----------

        // En cas d'erreur : err.message = message de l'API, err.status = code HTTP, err.code = code métier (ex : 'CLIENT_EXISTANT')
        async function apiRequest(method, route, data) {
            const res = await fetch(API_URL + route, {
                method,
                headers: data ? { 'Content-Type': 'application/json' } : undefined,
                body: data ? JSON.stringify(data) : undefined
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                const err = new Error(body?.message || `Le serveur a répondu ${res.status}`);
                err.status = res.status;
                err.code = body?.code;
                throw err;
            }
            return body;
        }

        const apiGet = (route) => apiRequest('GET', route);
        const apiPost = (route, data) => apiRequest('POST', route, data);

        // Session admin expirée ou absente -> page de connexion
        function erreurAdmin(err) {
            if (err.status === 401) {
                window.location.href = '/admin/connexion';
                return;
            }
            showToast(err.message, 'error');
        }

        // Les textes venant de la base (noms, descriptions…) sont échappés avant d'être mis dans le HTML
        function escapeHtml(value) {
            return String(value ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#39;');
        }

        // ---------- Dates ----------
        // Les champs <input type="date"> utilisent AAAA-MM-JJ, l'API utilise JJ/MM/AAAA

        function versDateInput(date) {
            const deuxChiffres = (n) => String(n).padStart(2, '0');
            return `${date.getFullYear()}-${deuxChiffres(date.getMonth() + 1)}-${deuxChiffres(date.getDate())}`;
        }

        function versDateApi(dateInput) {
            const [annee, mois, jour] = String(dateInput).split('-');
            return `${jour}/${mois}/${annee}`;
        }

        // ---------- Données ----------

        // Casquette de l'API -> format utilisé par l'affichage
        function versCap(c) {
            return {
                id: c._id,
                name: c.nom,
                category: c.categorie,
                price: c.prix,
                caution: c.caution,
                enabled: c.disponible,                             // ouverte à la réservation (bouton admin)
                available: c.disponible && c.stockDisponible > 0, // réservable aujourd'hui
                condition: c.etat,
                image: c.image,
                description: c.description
            };
        }

        // Réservation de l'API admin -> format utilisé par le tableau admin
        function versReservation(r) {
            const client = r.client ? `${r.client.prenom} ${r.client.nom}${r.client.ville ? ` (${r.client.ville})` : ''}` : '—';
            return {
                id: r.reference,
                client,
                capName: r.casquette?.nom ?? '—',
                dates: `${r.debutLocation} - ${r.finLocation}`,
                totalPrice: r.prixTotal,
                etat: r.etat,
                status: r.probleme ? 'Invalide' : r.etat.charAt(0).toUpperCase() + r.etat.slice(1)
            };
        }

        async function chargerCasquettes() {
            caps = (await apiGet('/casquettes')).map(versCap);
        }

        async function chargerReservations() {
            reservations = (await apiGet('/admin/reservations')).map(versReservation);
        }

        let activeCategory = "Toutes";
        let selectedCapId = null;
        let checkoutData = {
            cap: null,
            startDate: "",
            endDate: "",
            daysCount: 1,
            totalPrice: 0,
            nom: "",
            prenom: "",
            phone: "+33 6 12 34 56 78",
            email: "",
            address: "",
            ville: "Lyon (69002)"
        };

        // Données chargées depuis l'API au chargement de la page
        let caps = [];
        let reservations = [];
        let verificationEnCours = 0;   // pour ignorer les réponses de disponibilité périmées
        let reservationEnCours = false; // empêche d'envoyer deux fois la même réservation

        function getCurrentPageFile() {
            const file = window.location.pathname.split('/').pop();
            return file || 'index.html';
        }

        function getCurrentPageId() {
            const file = getCurrentPageFile();
            return {
                'index.html': 'accueil',
                'boutique.html': 'boutique',
                'contact.html': 'contact',
                'admin.html': 'admin'
            }[file] || 'accueil';
        }

        function updateNavState(pageId) {
            const activeId = (pageId === 'article' || pageId === 'reservation') ? 'boutique' : pageId;
            document.querySelectorAll('.nav-btn').forEach(btn => {
                btn.classList.remove('bg-brand-600', 'text-white', 'shadow-md');
                btn.classList.add('text-slate-300');
            });
            const activeNav = document.getElementById('nav-' + activeId);
            if (activeNav) {
                activeNav.classList.add('bg-brand-600', 'text-white', 'shadow-md');
                activeNav.classList.remove('text-slate-300');
            }
        }

        function switchPage(pageId) {
            const target = document.getElementById('page-' + pageId);

            // Keep the original single-page navigation when the section exists.
            if (target) {
                document.querySelectorAll('.page-view').forEach(el => el.classList.add('hidden'));
                target.classList.remove('hidden');
                updateNavState(pageId);
                window.scrollTo({ top: 0, behavior: 'smooth' });

                if (pageId === 'boutique') renderBoutique();
                if (pageId === 'accueil') renderHomeFeatured();
                if (pageId === 'admin') renderAdmin();
                return;
            }

            // Navigate between the four requested pages.
            const routes = {
                accueil: 'index.html',
                boutique: 'boutique.html',
                contact: 'contact.html',
                admin: 'admin.html'
            };

            if (routes[pageId] && getCurrentPageFile() !== routes[pageId]) {
                window.location.href = routes[pageId];
            }
        }

        function toggleMobileMenu() {
            const menu = document.getElementById('mobile-menu');
            if (menu) menu.classList.toggle('hidden');
        }

        function scrollToWorkflow() {
            document.getElementById('workflow-section').scrollIntoView({ behavior: 'smooth' });
        }

        function showToast(message, type = 'success') {
            const container = document.getElementById('toast-container');
            if (!container) return;
            const toast = document.createElement('div');
            toast.className = `pointer-events-auto px-5 py-3 rounded-2xl text-xs font-bold text-white shadow-2xl flex items-center gap-3 border transition-all duration-300 transform translate-y-2 opacity-0 ${
                type === 'success' ? 'bg-slate-900 border-emerald-500/50 text-emerald-400' : 'bg-slate-900 border-brand-500/50 text-brand-400'
            }`;
            toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check text-emerald-400' : 'fa-circle-info text-brand-500'}"></i> <span>${escapeHtml(message)}</span>`;
            
            container.appendChild(toast);
            
            setTimeout(() => {
                toast.classList.remove('translate-y-2', 'opacity-0');
            }, 10);

            setTimeout(() => {
                toast.classList.add('opacity-0', 'translate-y-2');
                setTimeout(() => toast.remove(), 300);
            }, 3500);
        }

        function filterCategory(cat) {
            activeCategory = cat;
            document.querySelectorAll('.cat-pill').forEach(btn => {
                if (btn.innerText.trim() === cat) {
                    btn.className = 'cat-pill active px-4 py-2 rounded-xl text-xs font-semibold transition-all bg-brand-600 text-white';
                } else {
                    btn.className = 'cat-pill px-4 py-2 rounded-xl text-xs font-semibold transition-all bg-slate-900 text-slate-400 hover:text-white border border-slate-800';
                }
            });
            renderBoutique();
        }

        function renderBoutique() {
            const searchInput = document.getElementById('boutique-search');
            const grid = document.getElementById('boutique-grid');
            const countEl = document.getElementById('boutique-count');
            if (!searchInput || !grid || !countEl) return;
            const searchVal = searchInput.value.toLowerCase();
            grid.innerHTML = '';

            const filtered = caps.filter(c => {
                const matchesCat = (activeCategory === 'Toutes' || c.category === activeCategory);
                const matchesSearch = (c.name.toLowerCase().includes(searchVal) || c.category.toLowerCase().includes(searchVal));
                return matchesCat && matchesSearch;
            });

            countEl.innerText = `${filtered.filter(c => c.available).length} casquettes disponibles`;

            if (filtered.length === 0) {
                grid.innerHTML = `
                    <div class="col-span-full py-12 text-center text-slate-500 text-sm space-y-2">
                        <i class="fa-solid fa-ghost text-3xl"></i>
                        <p>Aucune casquette ne correspond à votre recherche.</p>
                    </div>
                `;
                return;
            }

            filtered.forEach(cap => {
                const card = document.createElement('div');
                card.className = 'glass-card rounded-3xl p-4 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all group';
                card.innerHTML = `
                    <div class="space-y-3">
                        <div class="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square border border-slate-800/80">
                            <img src="${escapeHtml(cap.image)}" alt="${escapeHtml(cap.name)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                            
                            <span class="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold bg-slate-900/90 text-white border border-slate-800">
                                ${escapeHtml(cap.category)}
                            </span>

                            <span class="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold ${cap.available ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}">
                                ${cap.available ? '• Disponible' : '• Indisponible'}
                            </span>
                        </div>

                        <div>
                            <p class="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">${escapeHtml(cap.condition)}</p>
                            <h3 class="font-bold text-white text-sm line-clamp-1 group-hover:text-brand-500 transition-colors">${escapeHtml(cap.name)}</h3>
                        </div>
                    </div>

                    <div class="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                        <div>
                            <span class="text-xl font-black text-white">${cap.price} €</span>
                            <span class="text-slate-400 text-[10px]"> / jour</span>
                        </div>

                        <button onclick="openDetail('${escapeHtml(cap.id)}')" class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-brand-600 text-slate-200 hover:text-white border border-slate-800 hover:border-brand-600 text-xs font-bold transition-all flex items-center gap-1.5">
                            Voir / Réserver
                        </button>
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        function renderHomeFeatured() {
            const grid = document.getElementById('home-featured-grid');
            if (!grid) return;
            grid.innerHTML = '';

            const featured = caps.slice(0, 3);
            featured.forEach(cap => {
                const card = document.createElement('div');
                card.className = 'glass-card rounded-3xl p-4 border border-slate-800 space-y-3';
                card.innerHTML = `
                    <div class="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square">
                        <img src="${escapeHtml(cap.image)}" alt="${escapeHtml(cap.name)}" class="w-full h-full object-cover">
                        <span class="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold bg-brand-600 text-white shadow-md">
                            ${escapeHtml(cap.category)}
                        </span>
                    </div>
                    <div>
                        <h4 class="font-bold text-white text-sm line-clamp-1">${escapeHtml(cap.name)}</h4>
                        <div class="flex items-center justify-between mt-2">
                            <span class="text-lg font-black text-brand-500">${cap.price} € <span class="text-slate-400 text-[10px] font-normal">/ jour</span></span>
                            <button onclick="openDetail('${escapeHtml(cap.id)}')" class="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white border border-slate-700 text-xs font-bold hover:bg-brand-600 transition-all">
                                Réserver
                            </button>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        function openDetail(capId) {
            selectedCapId = capId;
            const cap = caps.find(c => c.id === capId);
            if (!cap) return;

            if (!document.getElementById('detail-img')) {
                window.location.href = `boutique.html?cap=${encodeURIComponent(capId)}`;
                return;
            }

            document.getElementById('detail-img').src = cap.image;
            document.getElementById('detail-title').innerText = cap.name;
            document.getElementById('detail-subtitle').innerText = `Catégorie : ${cap.category} · Ref #CAP-${cap.id.slice(-6).toUpperCase()}`;
            document.getElementById('detail-category-badge').innerText = cap.category;
            document.getElementById('detail-condition-badge').innerText = cap.condition;
            document.getElementById('detail-price-day').innerText = `${cap.price} €`;
            document.getElementById('detail-caution').innerText = `${cap.caution} €`;
            document.getElementById('detail-desc').innerText = cap.description;

            showDetailAvailability(cap, cap.available);

            // Set default dates (Today to Today + 2 days), en heure locale
            const today = versDateInput(new Date());
            const next2 = versDateInput(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));

            document.getElementById('calc-start-date').value = today;
            document.getElementById('calc-end-date').value = next2;

            updateDetailPrice();
            switchPage('article');
        }

        // Badge et bouton de la fiche article selon que la casquette est réservable ou non
        function showDetailAvailability(cap, available) {
            const availBadge = document.getElementById('detail-availability-badge');
            const submitBtn = document.getElementById('detail-submit-btn');

            if (available) {
                availBadge.className = "absolute top-4 right-4 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
                availBadge.innerText = "Disponible en shop Lyon";
                submitBtn.disabled = false;
                submitBtn.className = "w-full py-4 rounded-xl bg-gradient-to-r from-brand-600 to-rose-600 text-white font-bold text-sm shadow-xl shadow-brand-600/30 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer";
                submitBtn.innerHTML = `<i class="fa-solid fa-key"></i> Réserver cette casquette (${escapeHtml(cap.price)} €/j)`;
            } else {
                availBadge.className = "absolute top-4 right-4 px-3.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30";
                availBadge.innerText = "Actuellement en location";
                submitBtn.disabled = true;
                submitBtn.className = "w-full py-4 rounded-xl bg-slate-800 text-slate-500 font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2";
                submitBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Actuellement indisponible`;
            }
        }

        function updateDetailPrice() {
            computeDetailPrice();
            checkAvailability();
        }

        function computeDetailPrice() {
            const cap = caps.find(c => c.id === selectedCapId);
            if (!cap) return;

            const startStr = document.getElementById('calc-start-date').value;
            const endStr = document.getElementById('calc-end-date').value;

            let days = 1;
            if (startStr && endStr) {
                const s = new Date(startStr);
                const e = new Date(endStr);
                const diffTime = Math.max(0, e - s);
                days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (days < 1) days = 1;
            }

            const total = days * cap.price;

            document.getElementById('calc-days-count').innerText = `${days} jour${days > 1 ? 's' : ''}`;
            document.getElementById('calc-caution-amount').innerText = `${cap.caution} €`;
            document.getElementById('calc-total-price').innerText = `${total} €`;

            checkoutData.cap = cap;
            checkoutData.startDate = startStr;
            checkoutData.endDate = endStr;
            checkoutData.daysCount = days;
            checkoutData.totalPrice = total;
        }

        // Demande à l'API s'il reste une casquette libre sur toute la période choisie.
        // Renvoie true si on peut réserver. Avec showErrors, les refus sont affichés en toast
        // (date passée, location trop longue, plus de stock…).
        async function checkAvailability({ showErrors = false } = {}) {
            const cap = caps.find(c => c.id === selectedCapId);
            if (!cap) return false;
            const numero = ++verificationEnCours;

            if (!cap.enabled) {
                showDetailAvailability(cap, false);
                return false;
            }

            const debut = versDateApi(document.getElementById('calc-start-date').value);
            const fin = versDateApi(document.getElementById('calc-end-date').value);

            try {
                const { disponible } = await apiGet(`/casquettes/${encodeURIComponent(cap.id)}/disponibilite?debut=${encodeURIComponent(debut)}&fin=${encodeURIComponent(fin)}`);
                if (numero !== verificationEnCours) return false; // dates changées entre-temps
                showDetailAvailability(cap, disponible > 0);
                if (disponible < 1 && showErrors) showToast('Plus aucune casquette disponible sur cette période', 'error');
                return disponible > 0;
            } catch (err) {
                // Période refusée par l'API : on garde le bouton actif, le message s'affiche au clic
                if (numero === verificationEnCours && showErrors) showToast(err.message, 'error');
                return false;
            }
        }

        async function startReservationFromDetail() {
            const cap = caps.find(c => c.id === selectedCapId);
            if (!cap || !cap.enabled) return;

            computeDetailPrice();
            if (!(await checkAvailability({ showErrors: true }))) return;

            // Populate step header recap
            document.getElementById('checkout-cap-img').src = cap.image;
            document.getElementById('checkout-cap-title').innerText = cap.name;
            document.getElementById('checkout-cap-dates').innerText = `Du ${checkoutData.startDate} au ${checkoutData.endDate} (${checkoutData.daysCount}j)`;
            document.getElementById('checkout-cap-price').innerText = `${checkoutData.totalPrice} €`;

            goToCheckoutStep(1);
            switchPage('reservation');
        }

        function goToCheckoutStep(step) {
            document.getElementById('checkout-step-1').classList.add('hidden');
            document.getElementById('checkout-step-2').classList.add('hidden');
            document.getElementById('checkout-step-3').classList.add('hidden');

            // Reset badges styling
            ['step-badge-1', 'step-badge-2', 'step-badge-3'].forEach((id, idx) => {
                const el = document.getElementById(id);
                if (idx + 1 === step) {
                    el.className = 'flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-brand-600 text-white shadow-md';
                } else if (idx + 1 < step) {
                    el.className = 'flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-slate-800 text-emerald-400 border border-emerald-500/30';
                } else {
                    el.className = 'flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-slate-900 text-slate-500 border border-slate-800';
                }
            });

            document.getElementById(`checkout-step-${step}`).classList.remove('hidden');
        }

        function handleStep1Submit(event) {
            event.preventDefault();
            
            checkoutData.nom = document.getElementById('cust-nom').value;
            checkoutData.prenom = document.getElementById('cust-prenom').value;
            checkoutData.phone = document.getElementById('cust-phone').value;
            checkoutData.email = document.getElementById('cust-email').value;
            checkoutData.address = document.getElementById('cust-adresse').value;
            checkoutData.ville = document.getElementById('cust-ville').value;

            // Fill Step 2 Recap
            document.getElementById('recap-item-title').innerText = checkoutData.cap.name;
            document.getElementById('recap-item-dates').innerText = `Du ${checkoutData.startDate} au ${checkoutData.endDate}`;
            document.getElementById('recap-item-days').innerText = `${checkoutData.daysCount} jour(s)`;
            document.getElementById('recap-item-price').innerText = `${checkoutData.totalPrice} €`;
            document.getElementById('recap-item-caution').innerText = `${checkoutData.cap.caution} €`;

            document.getElementById('recap-cust-name').innerText = `${checkoutData.prenom} ${checkoutData.nom}`;
            document.getElementById('recap-cust-phone').innerText = checkoutData.phone;
            document.getElementById('recap-cust-email').innerText = checkoutData.email;
            document.getElementById('recap-cust-address').innerText = `${checkoutData.address}, ${checkoutData.ville}`;

            goToCheckoutStep(2);
        }

        async function confirmReservation() {
            if (reservationEnCours) return;
            reservationEnCours = true;

            const infosClient = {
                nom: checkoutData.nom,
                prenom: checkoutData.prenom,
                telephone: checkoutData.phone,
                mail: checkoutData.email,
                adresse: checkoutData.address,
                ville: checkoutData.ville
            };

            try {
                // 1. Le client
                let client;
                try {
                    client = await apiPost('/clients', infosClient);
                } catch (err) {
                    if (err.code !== 'CLIENT_EXISTANT') throw err;

                    // Même nom + même mail qu'un client déjà enregistré : on lui demande si c'est bien lui
                    const reutiliser = window.confirm(
                        "Un client avec ce nom et ce mail a déjà réservé chez NO CAP.\n\n" +
                        "C'est vous ? OK = réserver avec vos informations déjà enregistrées.\n" +
                        "Annuler = modifier votre nom ou votre mail."
                    );
                    if (!reutiliser) {
                        goToCheckoutStep(1);
                        showToast("Modifiez votre nom ou votre mail pour continuer.", "error");
                        return;
                    }
                    client = await apiPost('/clients', { ...infosClient, reutiliser: true });
                }

                // 2. La réservation (l'API vérifie à nouveau le stock sur la période)
                const reservation = await apiPost('/reservations', {
                    idClient: client._id,
                    idCasquette: checkoutData.cap.id,
                    quantite: 1,
                    debutLocation: versDateApi(checkoutData.startDate),
                    finLocation: versDateApi(checkoutData.endDate)
                });

                document.getElementById('success-booking-id').innerText = reservation.reference;
                document.getElementById('success-id-text').innerText = reservation.reference;

                goToCheckoutStep(3);
                showToast("Réservation enregistrée avec succès !", "success");
                if (!reservation.mailEnvoye) {
                    showToast("Le mail de confirmation n'a pas pu être envoyé, notez bien votre numéro.", "error");
                }

                // Le stock a changé : on recharge le catalogue
                chargerCasquettes().catch(() => {});
            } catch (err) {
                showToast(err.message, "error");
            } finally {
                reservationEnCours = false;
            }
        }

        function resetAndGoHome() {
            switchPage('accueil');
        }

        function handleContactSubmit(e) {
            e.preventDefault();
            showToast("Votre message a été envoyé à l'équipe NO CAP Lyon.", "success");
            e.target.reset();
        }

        function renderAdmin() {
            const totalEl = document.getElementById('admin-stat-total');
            const availableEl = document.getElementById('admin-stat-available');
            const resasEl = document.getElementById('admin-stat-resas');
            const revenueEl = document.getElementById('admin-stat-revenue');
            const capsTbody = document.getElementById('admin-caps-tbody');
            const resasTbody = document.getElementById('admin-reservations-tbody');
            if (!totalEl || !availableEl || !resasEl || !revenueEl || !capsTbody || !resasTbody) return;

            // Stats
            totalEl.innerText = caps.length;
            const availCount = caps.filter(c => c.enabled).length;
            availableEl.innerText = availCount;
            // Actives = pas encore rendues ni annulées
            resasEl.innerText = reservations.filter(r => r.etat === 'à venir' || r.etat === 'en location').length;

            // Chiffre d'affaires : toutes les réservations sauf les annulées
            const totalRev = reservations.filter(r => r.etat !== 'annulée').reduce((acc, r) => acc + r.totalPrice, 0);
            revenueEl.innerText = `${totalRev} €`;

            // Table 1: Inventory Toggles
            capsTbody.innerHTML = '';

            caps.forEach(cap => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-900/40 transition-colors";
                tr.innerHTML = `
                    <td class="py-3 px-4 flex items-center gap-3">
                        <img src="${escapeHtml(cap.image)}" class="w-9 h-9 rounded-lg object-cover bg-slate-950 border border-slate-800">
                        <span class="font-bold text-white">${escapeHtml(cap.name)}</span>
                    </td>
                    <td class="py-3 px-4">${escapeHtml(cap.category)}</td>
                    <td class="py-3 px-4 font-bold text-brand-500">${escapeHtml(cap.price)} €</td>
                    <td class="py-3 px-4 text-slate-400">${escapeHtml(cap.caution)} €</td>
                    <td class="py-3 px-4">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${cap.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}">
                            ${cap.enabled ? 'Disponible' : 'Indisponible'}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-right">
                        <button onclick="toggleCapAvailability('${escapeHtml(cap.id)}')" class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                            cap.enabled 
                            ? 'bg-rose-950/40 text-rose-400 border-rose-800 hover:bg-rose-900/60' 
                            : 'bg-emerald-950/40 text-emerald-400 border-emerald-800 hover:bg-emerald-900/60'
                        }">
                            <i class="fa-solid ${cap.enabled ? 'fa-toggle-on' : 'fa-toggle-off'} mr-1"></i>
                            ${cap.enabled ? 'Passer Indisponible' : 'Passer Disponible'}
                        </button>
                    </td>
                `;
                capsTbody.appendChild(tr);
            });

            // Table 2: Customer Reservations
            resasTbody.innerHTML = '';

            reservations.forEach(r => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-900/40 transition-colors";
                tr.innerHTML = `
                    <td class="py-3 px-4 font-black text-brand-500">${escapeHtml(r.id)}</td>
                    <td class="py-3 px-4 font-bold text-white">${escapeHtml(r.client)}</td>
                    <td class="py-3 px-4">${escapeHtml(r.capName)}</td>
                    <td class="py-3 px-4 text-slate-400">${escapeHtml(r.dates)}</td>
                    <td class="py-3 px-4 font-bold text-white">${escapeHtml(r.totalPrice)} €</td>
                    <td class="py-3 px-4">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            ${escapeHtml(r.status)}
                        </span>
                    </td>
                `;
                resasTbody.appendChild(tr);
            });
        }

        async function toggleCapAvailability(capId) {
            const cap = caps.find(c => c.id === capId);
            if (!cap) return;
            try {
                const updated = await apiPost(`/admin/casquettes/${encodeURIComponent(capId)}/disponible`, { disponible: !cap.enabled });
                cap.enabled = updated.disponible;
                await chargerCasquettes(); // disponibilités recalculées par l'API
                showToast(`Statut de "${cap.name}" mis à jour : ${cap.enabled ? 'Disponible' : 'Indisponible'}`, 'success');
                renderAdmin();
                renderBoutique();
            } catch (err) {
                erreurAdmin(err);
            }
        }

        function openAddCapModal() {
            document.getElementById('add-cap-modal').classList.remove('hidden');
        }

        function closeAddCapModal() {
            document.getElementById('add-cap-modal').classList.add('hidden');
        }

        async function handleAddCapSubmit(e) {
            e.preventDefault();
            const newCap = {
                nom: document.getElementById('add-name').value,
                categorie: document.getElementById('add-category').value,
                prix: parseFloat(document.getElementById('add-price').value),
                caution: parseFloat(document.getElementById('add-caution').value),
                image: document.getElementById('add-image').value,
                description: document.getElementById('add-desc').value
            };

            try {
                await apiPost('/admin/casquettes', newCap);
                await chargerCasquettes();
                closeAddCapModal();
                showToast("Nouveau modèle ajouté à l'inventaire Lyon !", "success");
                renderAdmin();
                renderBoutique();
            } catch (err) {
                erreurAdmin(err);
            }
        }

        /* Initial Load */
        window.onload = async function() {
            const currentPage = getCurrentPageId();
            updateNavState(currentPage);

            const currentSection = document.getElementById('page-' + currentPage);
            if (currentSection) {
                currentSection.classList.remove('hidden');
            }

            const isAdminPage = Boolean(document.getElementById('admin-caps-tbody'));
            const needsCaps = isAdminPage || document.getElementById('home-featured-grid') || document.getElementById('boutique-grid');
            if (!needsCaps) return; // page contact : rien à charger

            try {
                await (isAdminPage ? Promise.all([chargerCasquettes(), chargerReservations()]) : chargerCasquettes());
            } catch (err) {
                if (isAdminPage) return erreurAdmin(err);
                showToast("Impossible de charger le catalogue, réessayez dans un instant.", "error");
            }

            if (document.getElementById('home-featured-grid')) {
                renderHomeFeatured();
            }

            if (document.getElementById('boutique-grid')) {
                renderBoutique();

                const params = new URLSearchParams(window.location.search);
                const capId = params.get('cap');
                if (capId) {
                    openDetail(capId);
                }
            }

            if (isAdminPage) {
                renderAdmin();
            }
        };
