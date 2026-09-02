/**
 * superadmin-core.js
 *
 * Shared plumbing for the super admin console: the access guard, formatting,
 * toasts, modal handling and every backend read/write the console needs.
 *
 * All data goes through LexFlowAPI — there is no local mirror of platform
 * state, so what the console shows is what the backend holds.
 */

window.SA = (() => {
    'use strict';

    // ── Role ──────────────────────────────────────────────────────────────

    /** The role header every superadmin call is made with. */
    function role() {
        return 'superadmin';
    }

    function currentUser() {
        try {
            return JSON.parse(localStorage.getItem('currentUser') || 'null');
        } catch {
            return null;
        }
    }

    /**
     * Gate a page on the superadmin role. Anyone else is sent back to the
     * dashboard their own role belongs to.
     */
    function requireSuperAdmin() {
        const user = currentUser();

        if (!user) {
            window.location.href = 'sign-in.html';
            return null;
        }

        if ((user.role || '').toLowerCase() !== 'superadmin') {
            const fallbacks = {
                client: 'client-consultation-dashboard.html',
                firmadmin: 'firm-consultation-dashboard.html',
                lawyer: 'firm-consultation-dashboard.html',
                intern: 'firm-consultation-dashboard.html',
            };
            window.location.href =
                fallbacks[(user.role || '').toLowerCase()] || '../index.html';
            return null;
        }

        return user;
    }

    // ── Formatting ────────────────────────────────────────────────────────

    /** Indian-format currency, e.g. 209979 → "₹2,09,979". */
    function money(value, { decimals = 0 } = {}) {
        const n = Number(value);
        if (!isFinite(n)) return '₹0';
        return (
            '₹' +
            n.toLocaleString('en-IN', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            })
        );
    }

    /** Compact currency for tight spaces, e.g. 209979 → "₹2.1L". */
    function moneyShort(value) {
        const n = Number(value) || 0;
        if (Math.abs(n) >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
        if (Math.abs(n) >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
        if (Math.abs(n) >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K';
        return '₹' + n;
    }

    function date(value) {
        if (!value) return '—';
        const d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    }

    function initials(name) {
        return String(name || '?')
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0])
            .join('')
            .toUpperCase();
    }

    /** Escape untrusted values before they go into innerHTML. */
    function esc(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function badge(text, variant) {
        const key = String(variant ?? text ?? '').toLowerCase().replace(/\s+/g, '_');
        return `<span class="sa-badge sa-badge--${esc(key)}">${esc(text)}</span>`;
    }

    // ── Toast ─────────────────────────────────────────────────────────────

    let toastTimer = null;

    function toast(message, isError = false) {
        let el = document.querySelector('.sa-toast');
        if (!el) {
            el = document.createElement('div');
            el.className = 'sa-toast';
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.classList.toggle('sa-toast--error', !!isError);
        // Restart the animation even if a toast is already on screen.
        void el.offsetWidth;
        el.classList.add('show');

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
    }

    /** Run an async action, surfacing whatever the backend says went wrong. */
    async function attempt(fn, successMessage) {
        try {
            const result = await fn();
            if (successMessage) toast(successMessage);
            return result;
        } catch (err) {
            toast(err.message || 'Something went wrong', true);
            return null;
        }
    }

    // ── Modal ─────────────────────────────────────────────────────────────

    function openModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('active');
    }

    function closeModal(id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    }

    /** Wire close-on-backdrop-click and close-on-Escape for a modal. */
    function bindModal(id) {
        const el = document.getElementById(id);
        if (!el) return;

        el.addEventListener('click', (e) => {
            if (e.target === el) closeModal(id);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && el.classList.contains('active')) closeModal(id);
        });

        el.querySelectorAll('[data-close-modal]').forEach((btn) =>
            btn.addEventListener('click', () => closeModal(id)),
        );
    }

    // ── Rendering helpers ─────────────────────────────────────────────────

    /** Replace a tbody's rows, falling back to an empty-state row. */
    function renderRows(tbody, rows, colspan, emptyText = 'Nothing to show yet.') {
        if (!tbody) return;
        tbody.innerHTML = rows.length
            ? rows.join('')
            : `<tr><td colspan="${colspan}" class="sa-empty">${esc(emptyText)}</td></tr>`;
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function setHTML(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = value;
    }

    /**
     * Filter a list against a search box by scanning the given fields.
     */
    function search(list, term, fields) {
        const q = String(term || '').trim().toLowerCase();
        if (!q) return list;
        return list.filter((item) =>
            fields.some((f) => String(item[f] ?? '').toLowerCase().includes(q)),
        );
    }

    // ── Backend ───────────────────────────────────────────────────────────
    // Thin pass-throughs so the page controllers stay declarative. Reads that
    // are safe to fail soft return [] rather than throwing the page away.

    const api = () => window.LexFlowAPI;

    const platform = {
        revenueSummary: () => api().platform.getRevenueSummary(role()),
        monthlyRevenue: (months = 6) => api().platform.getMonthlyRevenue(months, role()),
        revenueByFirm: () => api().platform.getRevenueByFirm(role()),
        subscriptions: () => api().platform.getSubscriptions(role()),
        updateSubscription: (firmId, body) =>
            api().platform.updateSubscription(firmId, body, role()),
        charges: (firmId) => api().platform.getCharges(role(), firmId),
        updateCharge: (id, status) => api().platform.updateChargeStatus(id, status, role()),
        tiers: () => api().platform.getTierPlans(role()),
        updateTierPricing: (tier, price) =>
            api().platform.updateTierPricing(tier, price, role()),
        settings: () => api().platform.getSettings(role()),
        updateSettings: (body) => api().platform.updateSettings(body, role()),
    };

    const firms = {
        list: () => api().users.getAllFirms(role()),
        create: (body) => api().users.createFirm(body, role()),
        update: (firmId, body) => api().users.updateFirm(firmId, body, role()),
        remove: (firmId, cascade) => api().users.deleteFirm(firmId, role(), cascade),
    };

    const users = {
        list: (filters = {}) => api().users.getAll(filters, role()),
        get: (id) => api().users.getById(id, role()),
        create: (body) => api().users.create(body, role()),
        update: (id, body) => api().users.update(id, body, role()),
        remove: (id) => api().users.remove(id, role()),
        lawyers: () => api().users.getLawyers(null, role()),
    };

    const consultations = {
        // The full list carries status, firm and lawyer; the workflow-bookings
        // feed only covers the discovery flow, so it is the fallback.
        list: async () => {
            try {
                return await api().consultations.getAll({}, role());
            } catch (err) {
                console.warn('[superadmin] falling back to workflow bookings:', err.message);
                return api().consultations.getWorkflowBookings(role());
            }
        },
        cancel: (id) => api().consultations.cancel(id, role()),
        remove: (id) => api().consultations.remove(id, role()),
    };

    const billing = {
        invoices: async () => {
            const res = await api().billing.getInvoices(role());
            return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        },
        updateInvoice: (id, body) => api().billing.updateInvoice(id, body, role()),
        deleteInvoice: (id) => api().billing.deleteInvoice(id, role()),
    };

    /** Resolve several reads at once, tolerating individual failures. */
    async function loadAll(map) {
        const keys = Object.keys(map);
        const settled = await Promise.allSettled(keys.map((k) => map[k]()));
        const out = {};
        settled.forEach((result, i) => {
            if (result.status === 'fulfilled') {
                out[keys[i]] = result.value;
            } else {
                console.error(`[superadmin] failed to load "${keys[i]}":`, result.reason);
                out[keys[i]] = null;
            }
        });
        return out;
    }

    return {
        role,
        currentUser,
        requireSuperAdmin,
        money,
        moneyShort,
        date,
        initials,
        esc,
        badge,
        toast,
        attempt,
        openModal,
        closeModal,
        bindModal,
        renderRows,
        setText,
        setHTML,
        search,
        loadAll,
        platform,
        firms,
        users,
        consultations,
        billing,
    };
})();
