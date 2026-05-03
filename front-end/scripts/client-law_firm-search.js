document.addEventListener('DOMContentLoaded', async () => {
    const currentUser = AuthService.requireAuth(['client']);
    if (!currentUser) return;

    let allFirmsCache = [];

    // 1. Initial Render & Data Fetch
    async function init() {
        try {
            console.log('[Find Firm] Fetching firms from backend...');
            const firms = await LexFlowAPI.users.getAllFirms('client');
            allFirmsCache = firms;
            renderFirms(allFirmsCache);
        } catch (err) {
            console.error('[Find Firm] Failed to fetch firms:', err);
            // Fallback: render empty if API fails
            renderFirms([]);
        }
    }
    
    init();

    // 2. Elements
    const keywordSearch = document.getElementById('keyword-search');
    const locationSelect = document.getElementById('location-select');
    const practiceSelect = document.getElementById('practice-area-select');
    const triggerSearchBtn = document.getElementById('trigger-search');
    
    // 3. Search & Filter Logic
    function handleSearch() {
        const keyword = keywordSearch.value.toLowerCase();
        const loc = locationSelect.value.toLowerCase();
        const practice = practiceSelect.value.toLowerCase();
        
        const filtered = allFirmsCache.filter(f => {
            const matchKeyword = (f.name || '').toLowerCase().includes(keyword) || 
                                (f.description || '').toLowerCase().includes(keyword) ||
                                (f.subtitle || '').toLowerCase().includes(keyword);
            const matchLoc = !loc || (f.location || '').toLowerCase() === loc;
            const matchPractice = !practice || (f.practiceArea || '').toLowerCase() === practice;
            
            return matchKeyword && matchLoc && matchPractice;
        });
        
        renderFirms(filtered);
    }

    if (triggerSearchBtn) triggerSearchBtn.addEventListener('click', handleSearch);

    // 4. Rendering Functions
    function renderFirms(firms = allFirmsCache) {
        const grid = document.querySelector('.firms-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        if (firms.length === 0) {
            grid.innerHTML = '<div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">No law firms found matching your criteria.</div>';
            return;
        }

        firms.forEach(firm => {
            const card = document.createElement('div');
            card.className = 'firm-card';
            card.id = `firm-card-${firm.id}`;
            card.innerHTML = `
                <div class="firm-card-header">
                    <div class="firm-avatar">
                        <img src="${firm.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=' + firm.name}" alt="${firm.name}" style="width:100%; border-radius:50%;">
                    </div>
                    <div class="firm-info">
                        <h3>${firm.name}</h3>
                        <span class="firm-subtitle">${firm.subtitle || 'Legal Firm'}</span>
                    </div>
                    <span class="badge badge-${(firm.availability || 'Available').toLowerCase()}">${firm.availability || 'Available'}</span>
                </div>
                <div class="firm-card-body">
                    <p class="firm-description">${firm.description || 'No description available.'}</p>
                </div>
                <div class="firm-card-stats">
                    <div class="stat-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                        <span class="stat-rating">${firm.rating || '0.0'}</span>
                        <span class="stat-reviews">(${firm.reviews || 0} reviews)</span>
                    </div>
                    <div class="stat-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="12" y1="1" x2="12" y2="23"></line>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                        <span class="stat-price">$${firm.price || 0}/hr</span>
                    </div>
                </div>
                <div class="firm-card-actions">
                    <button class="btn btn-outline-sm btn-view-profile" data-id="${firm.id}">View Profile</button>
                    <button class="btn btn-primary-sm btn-book-now" data-id="${firm.id}">Book Now</button>
                </div>
            `;
            grid.appendChild(card);
        });

        // Update count
        const countText = document.querySelector('.results-header p');
        if (countText) countText.textContent = `${firms.length} firms matching your criteria.`;
    }

    // 5. Global Event Listener for dynamic buttons
    document.addEventListener('click', (e) => {
        const btnView = e.target.closest('.btn-view-profile');
        const btnBook = e.target.closest('.btn-book-now');
        
        if (btnView) {
            const id = btnView.dataset.id;
            openProfile(id);
        }
        if (btnBook) {
            const id = btnBook.dataset.id;
            openBooking(id);
        }
    });

    // 6. Modal Functions
    const bookingOverlay = document.getElementById('modal-overlay');
    const profileOverlay = document.getElementById('profile-overlay');

    function openBooking(firmId) {
        const firm = allFirmsCache.find(f => f.id === firmId);
        if (firm) {
            // Store the selected firm ID for later use in booking form
            sessionStorage.setItem('booking_firm_id', firmId);
            
            document.getElementById('lawfirm-name').value = firm.name;
            bookingOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    function openProfile(firmId) {
        const firm = allFirmsCache.find(f => f.id === firmId);
        if (!firm) return;

        // Fill dynamic fields in overlay
        const panel = document.getElementById('profile-panel');
        if (!panel) return;

        // Try to update name and title
        const nameEl = panel.querySelector('.profile-hero-info h2');
        if (nameEl) nameEl.textContent = `Adv. ${firm.name}`;
        
        const titleEl = panel.querySelector('.profile-title');
        if (titleEl) titleEl.textContent = firm.subtitle || `Senior Partner at ${firm.name}`;

        // Stats
        const stats = panel.querySelectorAll('.profile-stat-value');
        if (stats[0]) stats[0].textContent = firm.experience || '10+ Years';
        if (stats[1]) stats[1].textContent = `$${firm.price || 0}/hr`;
        if (stats[2]) stats[2].innerHTML = `${firm.rating || '0.0'}/5 <span class="profile-stat-sub">(${firm.reviews || 0} reviews)</span>`;

        // Bio
        const bio = panel.querySelector('.profile-bio');
        if (bio) bio.textContent = firm.bio || firm.description || 'No bio available.';

        profileOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Link the book button in profile
        const pBookBtn = document.getElementById('profile-book-btn');
        if (pBookBtn) {
            pBookBtn.onclick = () => {
                profileOverlay.classList.remove('active');
                openBooking(firmId);
            };
        }
    }

    // Modal selection logic (re-implementing from original)
    // Consultation type toggle
    document.addEventListener('click', (e) => {
        const opt = e.target.closest('.type-option');
        if (opt) {
            document.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            const radio = opt.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        }

        const slot = e.target.closest('.time-slot');
        if (slot) {
            document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
            slot.classList.add('selected');
        }

        const day = e.target.closest('.cal-day');
        if (day) {
            document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
            day.classList.add('selected');
        }
    });

    // Modal close logic
    const closeBtns = [
        document.getElementById('modal-close-btn'),
        document.getElementById('modal-cancel-btn'),
        document.getElementById('profile-back-btn')
    ];
    closeBtns.forEach(btn => {
        if (btn) btn.addEventListener('click', () => {
            bookingOverlay.classList.remove('active');
            profileOverlay.classList.remove('active');
            document.body.style.overflow = '';
            // Clear booking session data
            sessionStorage.removeItem('booking_firm_id');
        });
    });

    // 7. Booking Form Submission — calls backend API
    const bookingForm = document.getElementById('booking-form');
    if (bookingForm) {
        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const activeUser = AuthService.getCurrentUser();
            if (!activeUser || activeUser.role !== 'client') {
                window.location.href = 'SignIn.html';
                return;
            }

            const clientName = activeUser.fullName || activeUser.name;
            const clientId   = activeUser.id || activeUser.userId || activeUser.clientId;
            if (!clientName || !clientId) {
                window.location.href = 'SignIn.html';
                return;
            }

            // ── Form values ──────────────────────────────────────────────────
            const firmName    = document.getElementById('lawfirm-name').value;
            const typeSelect  = document.querySelector('.type-option.selected input');
            const consType    = typeSelect ? typeSelect.value : 'video';

            const daySelected  = document.querySelector('.cal-day.selected');
            const dayNum       = daySelected ? daySelected.textContent.trim() : '1';
            const timeSelected = document.querySelector('.time-slot.selected');
            const selectedTime = timeSelected ? timeSelected.textContent.trim() : '10:00 AM';

            const now        = new Date();
            const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const consDate   = `${monthNames[now.getMonth()]} ${dayNum}, ${now.getFullYear()}`;
            const consTime   = `${selectedTime} - ${selectedTime}`;

            const caseDesc = document.getElementById('case-description')
                ? document.getElementById('case-description').value.trim()
                : '';

            const firmId = sessionStorage.getItem('booking_firm_id');
            const firm   = firmId ? allFirmsCache.find(f => f.id === firmId) : null;

            const avatarColors = ['blue','green','orange','purple','pink','indigo','teal'];
            const avatarClass  = avatarColors[Math.floor(Math.random() * avatarColors.length)];

            // ── Build DTO ────────────────────────────────────────────────────
            const payload = {
                clientId,
                clientName,
                firmId:   firm ? String(firm.id) : (firmId || 'unknown'),
                firmName: firm ? firm.name : firmName,
                type:     consType,
                date:     consDate,
                time:     consTime,
                caseDescription:  caseDesc || 'General consultation request.',
                consultationFee:  firm ? `$${firm.price}` : undefined,
                avatarClass,
                bookedViaWorkflow: true,
            };

            // ── Loading state on button ──────────────────────────────────────
            const submitBtn = document.getElementById('modal-confirm-btn');
            if (submitBtn) {
                submitBtn.disabled    = true;
                submitBtn.textContent = 'Booking…';
            }

            try {
                const saved = await LexFlowAPI.consultations.create(payload, 'client');
                console.log('[Find Firm] Consultation booked via API:', saved.id);

                // Clear session
                sessionStorage.removeItem('booking_firm_id');

                alert('Consultation request sent successfully! Redirecting to your consultations dashboard…');
                window.location.href = 'client-consultation-dashboard.html';

            } catch (err) {
                console.error('[Find Firm] Booking failed:', err);
                alert(`Booking failed: ${err.message}\n\nPlease ensure the backend server is running at http://localhost:3000`);
                if (submitBtn) {
                    submitBtn.disabled    = false;
                    submitBtn.textContent = 'Confirm Booking';
                }
            }
        });
    }

    // Pill selection
    document.querySelectorAll('.pill-btn').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.pill-btn').forEach(p => p.classList.remove('active-pill'));
            pill.classList.add('active-pill');
            // Mock filtering based on pill
            const keyword = pill.textContent.split(' ')[0].toLowerCase();
            const filtered = allFirmsCache.filter(f => (f.description || '').toLowerCase().includes(keyword) || (f.practiceArea || '').includes(keyword));
            renderFirms(filtered);
        });
    });
});
