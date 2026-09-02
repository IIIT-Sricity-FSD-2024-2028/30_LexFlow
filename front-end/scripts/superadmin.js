/**
 * superadmin.js
 *
 * Page controllers for the super admin console. Each page carries a
 * data-sa-page attribute on <body>; the matching initialiser below runs on
 * DOMContentLoaded after the access guard passes.
 */

(() => {
    'use strict';

    // ── Revenue chart ─────────────────────────────────────────────────────

    /**
     * Stacked bars: subscription revenue underneath, commission on top.
     * Heights are relative to the tallest month so a flat series still reads.
     */
    /** "Apr 2026" -> "Apr '26", so twelve labels still fit across the axis. */
    function shortMonth(label) {
        const [month, year] = String(label).split(' ');
        return year ? `${month} '${year.slice(-2)}` : label;
    }

    function renderRevenueChart(container, series) {
        if (!container) return;

        if (!series || !series.length) {
            container.innerHTML =
                '<div class="sa-empty">No earnings recorded yet.</div>';
            return;
        }

        const peak = Math.max(...series.map((m) => m.total), 1);

        container.innerHTML = series
            .map((m) => {
                const barHeight = Math.max((m.total / peak) * 100, 2);
                const subShare = m.total > 0 ? (m.subscription / m.total) * 100 : 100;
                const commShare = 100 - subShare;

                const title =
                    `${m.label}\nSubscriptions: ${SA.money(m.subscription)}` +
                    `\nCommission: ${SA.money(m.commission)}` +
                    `\nTotal: ${SA.money(m.total)}`;

                return `
                    <div class="sa-bar-col" title="${SA.esc(title)}">
                        <span class="sa-bar-value">${SA.moneyShort(m.total)}</span>
                        <div class="sa-bar-stack" style="height:${barHeight}%">
                            <div class="sa-bar-seg sa-bar-seg--comm" style="height:${commShare}%"></div>
                            <div class="sa-bar-seg sa-bar-seg--sub" style="height:${subShare}%"></div>
                        </div>
                        <span class="sa-bar-label">${SA.esc(shortMonth(m.label))}</span>
                    </div>`;
            })
            .join('');
    }

    function deltaMarkup(growthPct) {
        if (growthPct === null || growthPct === undefined) {
            return '<span class="sa-delta sa-delta--flat">No prior month</span>';
        }
        const cls =
            growthPct > 0 ? 'up' : growthPct < 0 ? 'down' : 'flat';
        const arrow = growthPct > 0 ? '▲' : growthPct < 0 ? '▼' : '■';
        return `<span class="sa-delta sa-delta--${cls}">${arrow} ${Math.abs(growthPct)}% vs last month</span>`;
    }

    // ── Dashboard ─────────────────────────────────────────────────────────

    async function initDashboard() {
        const data = await SA.loadAll({
            summary: SA.platform.revenueSummary,
            monthly: () => SA.platform.monthlyRevenue(6),
            firms: SA.firms.list,
            lawyers: SA.users.lawyers,
            users: SA.users.list,
            byFirm: SA.platform.revenueByFirm,
        });

        const s = data.summary;

        if (s) {
            SA.setText('kpiTotalEarnings', SA.money(s.totalEarnings));
            SA.setText(
                'kpiEarningsSub',
                `${s.activeSubscriptions} active subscription${s.activeSubscriptions === 1 ? '' : 's'} · ${s.currency}`,
            );
            SA.setText('kpiSubRevenue', SA.money(s.subscriptionRevenue.collected));
            SA.setText('kpiCommission', SA.money(s.commissionRevenue.collected));
            SA.setText('kpiCommission2', SA.money(s.commissionRevenue.collected));
            SA.setText('kpiMrr', SA.money(s.mrr));
            SA.setText('kpiArr', `${SA.money(s.arr)} annualised`);
            SA.setText('kpiOutstanding', SA.money(s.subscriptionRevenue.outstanding));
            SA.setText('kpiThisMonth', SA.money(s.thisMonth.total));
            SA.setHTML('kpiThisMonthDelta', deltaMarkup(s.growthPct));
            SA.setText(
                'kpiCommissionHint',
                `${s.commissionRevenue.rate}% of ${SA.money(s.commissionRevenue.billedThroughPlatform)} billed by firms`,
            );
        }

        SA.setText('kpiFirms', data.firms ? data.firms.length : '—');
        SA.setText('kpiLawyers', data.lawyers ? data.lawyers.length : '—');
        SA.setText('kpiUsers', data.users ? data.users.length : '—');

        renderRevenueChart(document.getElementById('revenueChart'), data.monthly || []);

        // Top earning firms
        const rows = (data.byFirm || []).slice(0, 5).map(
            (f) => `
            <tr>
                <td>
                    <div class="sa-cell-name">
                        <div class="sa-avatar">${SA.esc(SA.initials(f.firmName))}</div>
                        <div>
                            <div class="sa-name">${SA.esc(f.firmName)}</div>
                            <div class="sa-sub">Since ${SA.esc(SA.date(f.since))}</div>
                        </div>
                    </div>
                </td>
                <td>${SA.badge(f.tier)}</td>
                <td class="sa-num">${SA.money(f.subscriptionCollected)}</td>
                <td class="sa-num">${SA.money(f.commission)}</td>
                <td class="sa-num"><strong>${SA.money(f.totalEarned)}</strong></td>
            </tr>`,
        );
        SA.renderRows(
            document.getElementById('topFirmsBody'),
            rows,
            5,
            'No firms are subscribed yet.',
        );
    }

    // ── Revenue detail ────────────────────────────────────────────────────

    async function initRevenue() {
        const monthsSelect = document.getElementById('monthsRange');

        async function drawChart() {
            const months = Number(monthsSelect?.value || 6);
            const series = await SA.attempt(() => SA.platform.monthlyRevenue(months));
            renderRevenueChart(document.getElementById('revenueChart'), series || []);
        }

        function renderCharges(charges) {
            const rows = charges.map(
                (c) => `
                <tr>
                    <td><span class="sa-name">${SA.esc(c.id)}</span></td>
                    <td>${SA.esc(c.firmName)}</td>
                    <td>${SA.badge(c.tier)}</td>
                    <td>${SA.esc(c.period)}</td>
                    <td class="sa-num">${SA.money(c.amount)}</td>
                    <td>${SA.badge(c.status)}</td>
                    <td class="sa-td-actions">
                        ${
                            c.status === 'Paid'
                                ? `<button class="sa-btn-ghost" data-charge-id="${SA.esc(c.id)}" data-charge-status="Pending">Mark unpaid</button>`
                                : `<button class="sa-btn-ghost" data-charge-id="${SA.esc(c.id)}" data-charge-status="Paid">Mark paid</button>`
                        }
                    </td>
                </tr>`,
            );

            const tbody = document.getElementById('chargesBody');
            SA.renderRows(tbody, rows, 7, 'No subscription charges have been raised yet.');

            tbody?.querySelectorAll('[data-charge-id]').forEach((btn) =>
                btn.addEventListener('click', async () => {
                    const updated = await SA.attempt(
                        () =>
                            SA.platform.updateCharge(
                                btn.dataset.chargeId,
                                btn.dataset.chargeStatus,
                            ),
                        'Charge updated',
                    );
                    // Settling a charge moves the collected totals, so pull the
                    // figures again rather than patching the one row in place.
                    if (updated) await refresh();
                }),
            );
        }

        /**
         * Reload every figure on the page. Safe to call repeatedly: it only
         * re-renders, and never re-binds the page-level listeners.
         */
        async function refresh() {
            const data = await SA.loadAll({
                summary: SA.platform.revenueSummary,
                byFirm: SA.platform.revenueByFirm,
                charges: () => SA.platform.charges(),
            });

            const s = data.summary;
            if (s) {
                SA.setText('sumTotal', SA.money(s.totalEarnings));
                SA.setText('sumSubscriptions', SA.money(s.subscriptionRevenue.collected));
                SA.setText('sumCommission', SA.money(s.commissionRevenue.collected));
                SA.setText('sumOutstanding', SA.money(s.subscriptionRevenue.outstanding));
                SA.setText('sumMrr', SA.money(s.mrr));
                SA.setText('sumArr', SA.money(s.arr));

                const tierRows = s.byTier.map(
                    (t) => `
                    <tr>
                        <td>${SA.badge(t.tier)}</td>
                        <td class="sa-num">${t.firms}</td>
                        <td class="sa-num">${SA.money(t.monthlyPrice)}</td>
                        <td class="sa-num"><strong>${SA.money(t.mrr)}</strong></td>
                    </tr>`,
                );
                SA.renderRows(document.getElementById('tierMixBody'), tierRows, 4);

                // Commission that could not be tied to a firm still counts
                // towards the total, so say so rather than letting the two
                // views silently disagree.
                const unattributed = s.commissionRevenue.unattributed || 0;
                const note = document.getElementById('unattributedNote');
                if (note) {
                    note.hidden = unattributed <= 0;
                    note.textContent =
                        `${SA.money(unattributed)} of commission comes from invoices whose client ` +
                        'is not linked to a firm, so it is counted in the total but not in the rows below.';
                }
            }

            const firmRows = (data.byFirm || []).map(
                (f) => `
                <tr>
                    <td>
                        <div class="sa-cell-name">
                            <div class="sa-avatar">${SA.esc(SA.initials(f.firmName))}</div>
                            <div>
                                <div class="sa-name">${SA.esc(f.firmName)}</div>
                                <div class="sa-sub">${SA.esc(f.firmId)} · ${f.months} month${f.months === 1 ? '' : 's'}</div>
                            </div>
                        </div>
                    </td>
                    <td>${SA.badge(f.tier)}</td>
                    <td>${SA.badge(f.status.replace('_', ' '), f.status)}</td>
                    <td class="sa-num">${SA.money(f.monthlyPrice)}</td>
                    <td class="sa-num">${SA.money(f.subscriptionCollected)}</td>
                    <td class="sa-num">${SA.money(f.commission)}</td>
                    <td class="sa-num">${SA.money(f.subscriptionOutstanding)}</td>
                    <td class="sa-num"><strong>${SA.money(f.totalEarned)}</strong></td>
                </tr>`,
            );
            SA.renderRows(
                document.getElementById('byFirmBody'),
                firmRows,
                8,
                'No firms are subscribed yet.',
            );

            renderCharges(data.charges || []);
        }

        monthsSelect?.addEventListener('change', drawChart);
        await refresh();
        await drawChart();
    }

    // ── Firms ─────────────────────────────────────────────────────────────

    async function initFirms() {
        let firms = [];
        let subscriptions = [];
        let charges = [];
        let editingId = null;

        const tbody = document.getElementById('firmsBody');
        const searchInput = document.getElementById('firmSearch');
        const tierFilter = document.getElementById('firmTierFilter');
        const form = document.getElementById('firmForm');

        SA.bindModal('firmModal');

        function subFor(firmId) {
            return subscriptions.find((s) => s.firmId === firmId);
        }

        /** The most recent (current) billing period's charge for a firm. */
        function currentChargeFor(firmId) {
            return charges
                .filter((c) => c.firmId === firmId)
                .sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : 0))[0];
        }

        function render() {
            let list = SA.search(firms, searchInput?.value, [
                'name',
                'email',
                'city',
                'id',
            ]);
            const tier = tierFilter?.value;
            if (tier && tier !== 'all') list = list.filter((f) => f.tier === tier);

            const rows = list.map((f) => {
                const sub = subFor(f.id);
                const charge = currentChargeFor(f.id);
                const paymentCell = !charge
                    ? '—'
                    : charge.status === 'Paid'
                        ? SA.badge('Paid', 'paid')
                        : `${SA.badge(charge.status, charge.status)} ` +
                          `<button class="sa-btn-ghost" data-mark-charge="${SA.esc(charge.id)}" style="margin-left:6px">Mark paid</button>`;

                return `
                <tr>
                    <td>
                        <div class="sa-cell-name">
                            <div class="sa-avatar">${SA.esc(SA.initials(f.name))}</div>
                            <div>
                                <div class="sa-name">${SA.esc(f.name)}</div>
                                <div class="sa-sub">${SA.esc(f.id)}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div>${SA.esc(f.email)}</div>
                        <div class="sa-sub">${SA.esc(f.phone || '—')}</div>
                    </td>
                    <td>${SA.esc(f.city || '—')}</td>
                    <td>${SA.badge(f.tier)}</td>
                    <td class="sa-num">${sub ? SA.money(sub.monthlyPrice) : '—'}</td>
                    <td>${sub ? SA.badge(sub.status.replace('_', ' '), sub.status) : '—'}</td>
                    <td>${paymentCell}</td>
                    <td>${SA.esc(SA.date(f.createdAt))}</td>
                    <td class="sa-td-actions">
                        <button class="sa-icon-btn" data-edit="${SA.esc(f.id)}" title="Edit firm" aria-label="Edit firm">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                        </button>
                        <button class="sa-icon-btn sa-icon-btn--danger" data-remove="${SA.esc(f.id)}" title="Delete firm" aria-label="Delete firm">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </td>
                </tr>`;
            });

            SA.renderRows(tbody, rows, 9, 'No law firms match this filter.');

            tbody.querySelectorAll('[data-edit]').forEach((btn) =>
                btn.addEventListener('click', () => openFirmModal(btn.dataset.edit)),
            );
            tbody.querySelectorAll('[data-remove]').forEach((btn) =>
                btn.addEventListener('click', () => removeFirm(btn.dataset.remove)),
            );
            tbody.querySelectorAll('[data-mark-charge]').forEach((btn) =>
                btn.addEventListener('click', async () => {
                    // Re-fetch and re-render only this table's data — no
                    // navigation, so the search/filter state stays put.
                    const done = await SA.attempt(
                        () => SA.platform.updateCharge(btn.dataset.markCharge, 'Paid'),
                        'Subscription charge marked paid',
                    );
                    if (done) await load();
                }),
            );

            SA.setText('firmCount', `${list.length} of ${firms.length} firms`);
        }

        function openFirmModal(firmId) {
            editingId = firmId || null;
            const firm = firmId ? firms.find((f) => f.id === firmId) : null;

            document.getElementById('firmModalTitle').textContent = firm
                ? 'Edit law firm'
                : 'Add law firm';
            document.getElementById('firmModalSub').textContent = firm
                ? `Updating ${firm.name}. Changing the tier moves its seat limits and monthly price.`
                : 'A subscription starts on the selected tier as soon as the firm is created.';

            form.reset();
            if (firm) {
                form.name.value = firm.name || '';
                form.email.value = firm.email || '';
                form.phone.value = firm.phone || '';
                form.tier.value = firm.tier || 'Starter';
                form.city.value = firm.city || '';
                form.state.value = firm.state || '';
                form.street.value = firm.street || '';
                form.pinCode.value = firm.pinCode || '';
                form.website.value = firm.website || '';
                form.subtitle.value = firm.subtitle || '';
            }

            // The admin credentials block only applies when creating a firm.
            document.getElementById('firmAdminFields').hidden = !!firm;
            SA.openModal('firmModal');
        }

        async function submitFirm(e) {
            e.preventDefault();
            const fd = new FormData(form);
            const body = {};
            [
                'name',
                'email',
                'phone',
                'tier',
                'city',
                'state',
                'street',
                'pinCode',
                'website',
                'subtitle',
            ].forEach((k) => {
                const v = String(fd.get(k) || '').trim();
                if (v) body[k] = v;
            });

            let result;
            if (editingId) {
                result = await SA.attempt(
                    () => SA.firms.update(editingId, body),
                    'Firm updated',
                );
            } else {
                ['adminName', 'adminEmail', 'adminPassword'].forEach((k) => {
                    const v = String(fd.get(k) || '').trim();
                    if (v) body[k] = v;
                });
                result = await SA.attempt(() => SA.firms.create(body), 'Firm added');
            }

            if (result) {
                SA.closeModal('firmModal');
                await load();
            }
        }

        async function removeFirm(firmId) {
            const firm = firms.find((f) => f.id === firmId);
            if (!firm) return;
            if (!confirm(`Delete "${firm.name}"? This also ends its subscription.`)) return;

            try {
                await SA.firms.remove(firmId, false);
                SA.toast('Firm deleted');
                await load();
                return;
            } catch (err) {
                // The backend refuses to orphan a firm's members. Offer the
                // cascade explicitly rather than silently deleting people.
                if (err.status !== 400) {
                    SA.toast(err.message || 'Could not delete firm', true);
                    return;
                }
                if (!confirm(`${err.message}\n\nDelete the firm and its members anyway?`)) {
                    return;
                }
            }

            const done = await SA.attempt(
                () => SA.firms.remove(firmId, true),
                'Firm and its members deleted',
            );
            if (done) await load();
        }

        async function load() {
            const data = await SA.loadAll({
                firms: SA.firms.list,
                subscriptions: SA.platform.subscriptions,
                charges: () => SA.platform.charges(),
            });
            firms = data.firms || [];
            subscriptions = data.subscriptions || [];
            charges = data.charges || [];
            render();
        }

        document.getElementById('addFirmBtn')?.addEventListener('click', () =>
            openFirmModal(null),
        );
        form?.addEventListener('submit', submitFirm);
        searchInput?.addEventListener('input', render);
        tierFilter?.addEventListener('change', render);

        await load();
    }

    // ── Lawyers ───────────────────────────────────────────────────────────

    async function initLawyers() {
        let lawyers = [];
        const tbody = document.getElementById('lawyersBody');
        const searchInput = document.getElementById('lawyerSearch');
        const statusFilter = document.getElementById('lawyerStatusFilter');

        function render() {
            let list = SA.search(lawyers, searchInput?.value, [
                'fullName',
                'email',
                'firmId',
                'id',
            ]);
            const status = statusFilter?.value;
            if (status && status !== 'all') {
                list = list.filter((l) => (l.accountStatus || 'active') === status);
            }

            const rows = list.map(
                (l) => `
                <tr>
                    <td>
                        <div class="sa-cell-name">
                            <div class="sa-avatar">${SA.esc(SA.initials(l.fullName))}</div>
                            <div>
                                <div class="sa-name">${SA.esc(l.fullName)}</div>
                                <div class="sa-sub">${SA.esc(l.email)}</div>
                            </div>
                        </div>
                    </td>
                    <td>${SA.badge(l.role)}</td>
                    <td>${SA.esc(l.firmId || 'Unassigned')}</td>
                    <td>${SA.badge(l.accountStatus || 'active', (l.accountStatus || 'active') === 'active' ? 'active' : 'cancelled')}</td>
                    <td>${SA.esc(l.availability || '—')}</td>
                    <td class="sa-td-actions">
                        <button class="sa-btn-ghost" data-toggle="${SA.esc(l.id)}">
                            ${(l.accountStatus || 'active') === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                    </td>
                </tr>`,
            );

            SA.renderRows(tbody, rows, 6, 'No lawyers or interns match this filter.');

            tbody.querySelectorAll('[data-toggle]').forEach((btn) =>
                btn.addEventListener('click', async () => {
                    const lawyer = lawyers.find((l) => l.id === btn.dataset.toggle);
                    if (!lawyer) return;
                    const next =
                        (lawyer.accountStatus || 'active') === 'active' ? 'inactive' : 'active';
                    const done = await SA.attempt(
                        () => SA.users.update(lawyer.id, { accountStatus: next }),
                        `Account ${next === 'active' ? 'activated' : 'deactivated'}`,
                    );
                    if (done) await load();
                }),
            );

            SA.setText('lawyerCount', `${list.length} of ${lawyers.length}`);
        }

        async function load() {
            lawyers = (await SA.attempt(() => SA.users.lawyers())) || [];
            render();
        }

        searchInput?.addEventListener('input', render);
        statusFilter?.addEventListener('change', render);
        await load();
    }

    // ── Users ─────────────────────────────────────────────────────────────

    async function initUsers() {
        let users = [];
        let editingId = null;

        const tbody = document.getElementById('usersBody');
        const searchInput = document.getElementById('userSearch');
        const roleFilter = document.getElementById('userRoleFilter');
        const form = document.getElementById('userForm');

        SA.bindModal('userModal');

        function render() {
            let list = SA.search(users, searchInput?.value, [
                'fullName',
                'email',
                'id',
                'firmId',
            ]);
            const r = roleFilter?.value;
            if (r && r !== 'all') list = list.filter((u) => u.role === r);

            const rows = list.map(
                (u) => `
                <tr>
                    <td>
                        <div class="sa-cell-name">
                            <div class="sa-avatar">${SA.esc(SA.initials(u.fullName))}</div>
                            <div>
                                <div class="sa-name">${SA.esc(u.fullName)}</div>
                                <div class="sa-sub">${SA.esc(u.id)}</div>
                            </div>
                        </div>
                    </td>
                    <td>${SA.esc(u.email)}</td>
                    <td>${SA.badge(u.role)}</td>
                    <td>${SA.esc(u.firmId || '—')}</td>
                    <td>${SA.badge(u.accountStatus || 'active', (u.accountStatus || 'active') === 'active' ? 'active' : 'cancelled')}</td>
                    <td>${SA.esc(SA.date(u.createdAt))}</td>
                    <td class="sa-td-actions">
                        <button class="sa-icon-btn" data-edit="${SA.esc(u.id)}" title="Edit user" aria-label="Edit user">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                        </button>
                        <button class="sa-icon-btn sa-icon-btn--danger" data-remove="${SA.esc(u.id)}" title="Delete user" aria-label="Delete user">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </td>
                </tr>`,
            );

            SA.renderRows(tbody, rows, 7, 'No users match this filter.');

            tbody.querySelectorAll('[data-edit]').forEach((btn) =>
                btn.addEventListener('click', () => openUserModal(btn.dataset.edit)),
            );
            tbody.querySelectorAll('[data-remove]').forEach((btn) =>
                btn.addEventListener('click', async () => {
                    const user = users.find((u) => u.id === btn.dataset.remove);
                    if (!user) return;
                    if (!confirm(`Delete ${user.fullName}?`)) return;
                    const done = await SA.attempt(
                        () => SA.users.remove(user.id),
                        'User deleted',
                    );
                    if (done) await load();
                }),
            );

            SA.setText('userCount', `${list.length} of ${users.length} users`);
        }

        function openUserModal(userId) {
            editingId = userId || null;
            const user = userId ? users.find((u) => u.id === userId) : null;

            document.getElementById('userModalTitle').textContent = user
                ? 'Edit user'
                : 'Add user';
            form.reset();

            if (user) {
                form.fullName.value = user.fullName || '';
                form.email.value = user.email || '';
                form.role.value = user.role || 'client';
                form.phone.value = user.phone || '';
                form.firmId.value = user.firmId || '';
                form.accountStatus.value = user.accountStatus || 'active';
            }

            // A password is only needed when the account is being created.
            document.getElementById('userPasswordField').hidden = !!user;
            SA.openModal('userModal');
        }

        async function submitUser(e) {
            e.preventDefault();
            const fd = new FormData(form);
            const body = {};
            ['fullName', 'email', 'role', 'phone', 'firmId', 'accountStatus'].forEach(
                (k) => {
                    const v = String(fd.get(k) || '').trim();
                    if (v) body[k] = v;
                },
            );

            let result;
            if (editingId) {
                result = await SA.attempt(
                    () => SA.users.update(editingId, body),
                    'User updated',
                );
            } else {
                const password = String(fd.get('password') || '').trim();
                if (password) body.password = password;
                result = await SA.attempt(() => SA.users.create(body), 'User created');
            }

            if (result) {
                SA.closeModal('userModal');
                await load();
            }
        }

        async function load() {
            users = (await SA.attempt(() => SA.users.list())) || [];
            render();
        }

        document.getElementById('addUserBtn')?.addEventListener('click', () =>
            openUserModal(null),
        );
        form?.addEventListener('submit', submitUser);
        searchInput?.addEventListener('input', render);
        roleFilter?.addEventListener('change', render);

        await load();
    }

    // ── Consultations ─────────────────────────────────────────────────────

    async function initConsultations() {
        let consults = [];
        const tbody = document.getElementById('consultationsBody');
        const searchInput = document.getElementById('consultSearch');
        const statusFilter = document.getElementById('consultStatusFilter');

        // Terminal states are final in the backend, so the row actions hide
        // rather than offering a call that is guaranteed to be refused.
        const TERMINAL = ['COMPLETED', 'CANCELLED'];

        function statusVariant(status) {
            const s = String(status || '').toUpperCase();
            if (s === 'COMPLETED') return 'paid';
            if (s === 'CANCELLED') return 'overdue';
            if (s === 'PENDING') return 'pending';
            return 'growth';
        }

        function render() {
            let list = SA.search(consults, searchInput?.value, [
                'id',
                'clientName',
                'firmName',
                'lawyerName',
            ]);
            const status = statusFilter?.value;
            if (status && status !== 'all') {
                list = list.filter(
                    (c) => String(c.status || '').toUpperCase() === status,
                );
            }

            const rows = list.map((c) => {
                const terminal = TERMINAL.includes(String(c.status || '').toUpperCase());
                return `
                <tr>
                    <td><span class="sa-name">${SA.esc(c.id)}</span></td>
                    <td>
                        <div>${SA.esc(c.clientName || 'Unknown client')}</div>
                        <div class="sa-sub">${SA.esc(c.type || '—')}</div>
                    </td>
                    <td>${SA.esc(c.firmName || '—')}</td>
                    <td>${SA.esc(c.lawyerName || 'Unassigned')}</td>
                    <td>
                        <div>${SA.esc(c.date || SA.date(c.createdAt))}</div>
                        <div class="sa-sub">${SA.esc(c.time || '')}</div>
                    </td>
                    <td>${SA.badge(c.status || 'PENDING', statusVariant(c.status))}</td>
                    <td class="sa-td-actions">
                        ${
                            terminal
                                ? ''
                                : `<button class="sa-btn-ghost" data-cancel="${SA.esc(c.id)}">Cancel</button>`
                        }
                        <button class="sa-icon-btn sa-icon-btn--danger" data-remove="${SA.esc(c.id)}" title="Delete consultation" aria-label="Delete consultation">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </td>
                </tr>`;
            });

            SA.renderRows(tbody, rows, 7, 'No consultations match this filter.');

            tbody?.querySelectorAll('[data-cancel]').forEach((btn) =>
                btn.addEventListener('click', async () => {
                    if (!confirm(`Cancel consultation ${btn.dataset.cancel}?`)) return;
                    const done = await SA.attempt(
                        () => SA.consultations.cancel(btn.dataset.cancel),
                        'Consultation cancelled',
                    );
                    if (done) await load();
                }),
            );

            tbody?.querySelectorAll('[data-remove]').forEach((btn) =>
                btn.addEventListener('click', async () => {
                    if (!confirm(`Permanently delete ${btn.dataset.remove}?`)) return;
                    const done = await SA.attempt(
                        () => SA.consultations.remove(btn.dataset.remove),
                        'Consultation deleted',
                    );
                    if (done) await load();
                }),
            );

            SA.setText('consultCount', `${list.length} of ${consults.length}`);
        }

        async function load() {
            consults = (await SA.attempt(() => SA.consultations.list())) || [];
            render();
        }

        searchInput?.addEventListener('input', render);
        statusFilter?.addEventListener('change', render);
        await load();
    }

    // ── Client invoices ───────────────────────────────────────────────────

    async function initInvoices() {
        let invoices = [];
        let commissionRate = 10;

        const tbody = document.getElementById('invoicesBody');
        const searchInput = document.getElementById('invoiceSearch');
        const statusFilter = document.getElementById('invoiceStatusFilter');

        function render() {
            let list = SA.search(invoices, searchInput?.value, [
                'id',
                'clientName',
                'caseName',
                'advocateName',
            ]);
            const status = statusFilter?.value;
            if (status && status !== 'all') list = list.filter((i) => i.status === status);

            const rows = list.map((i) => {
                const commission = (Number(i.amount) * commissionRate) / 100;
                return `
                <tr>
                    <td><span class="sa-name">${SA.esc(i.id)}</span></td>
                    <td>
                        <div>${SA.esc(i.clientName)}</div>
                        <div class="sa-sub">${SA.esc(i.caseName || '—')}</div>
                    </td>
                    <td>${SA.esc(i.advocateName || '—')}</td>
                    <td class="sa-num">${SA.money(i.amount)}</td>
                    <td class="sa-num">${i.status === 'Paid' ? SA.money(commission) : '—'}</td>
                    <td>${SA.esc(SA.date(i.dueDate))}</td>
                    <td>${SA.badge(i.status)}</td>
                    <td class="sa-td-actions">
                        ${
                            i.status === 'Paid'
                                ? ''
                                : `<button class="sa-btn-ghost" data-mark="${SA.esc(i.id)}">Mark paid</button>`
                        }
                        <button class="sa-icon-btn sa-icon-btn--danger" data-remove="${SA.esc(i.id)}" title="Delete invoice" aria-label="Delete invoice">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </td>
                </tr>`;
            });

            SA.renderRows(tbody, rows, 8, 'No invoices match this filter.');

            tbody.querySelectorAll('[data-mark]').forEach((btn) =>
                btn.addEventListener('click', async () => {
                    const done = await SA.attempt(
                        () => SA.billing.updateInvoice(btn.dataset.mark, { status: 'Paid' }),
                        'Invoice marked paid — commission recorded',
                    );
                    if (done) await load();
                }),
            );
            tbody.querySelectorAll('[data-remove]').forEach((btn) =>
                btn.addEventListener('click', async () => {
                    if (!confirm(`Delete invoice ${btn.dataset.remove}?`)) return;
                    const done = await SA.attempt(
                        () => SA.billing.deleteInvoice(btn.dataset.remove),
                        'Invoice deleted',
                    );
                    if (done) await load();
                }),
            );

            const paid = list.filter((i) => i.status === 'Paid');
            const gross = paid.reduce((sum, i) => sum + Number(i.amount || 0), 0);
            SA.setText('invoiceCount', `${list.length} of ${invoices.length} invoices`);
            SA.setText('invoiceGross', SA.money(gross));
            SA.setText('invoiceCommission', SA.money((gross * commissionRate) / 100));
            SA.setText('invoiceRateHint', `at ${commissionRate}% commission`);
        }

        async function load() {
            const data = await SA.loadAll({
                invoices: SA.billing.invoices,
                settings: SA.platform.settings,
            });
            invoices = data.invoices || [];
            if (data.settings) commissionRate = data.settings.commissionRate;
            render();
        }

        searchInput?.addEventListener('input', render);
        statusFilter?.addEventListener('change', render);
        await load();
    }

    // ── Settings ──────────────────────────────────────────────────────────

    async function initSettings() {
        const form = document.getElementById('settingsForm');
        let tiers = [];

        async function load() {
            const data = await SA.loadAll({
                settings: SA.platform.settings,
                tiers: SA.platform.tiers,
                summary: SA.platform.revenueSummary,
            });

            const s = data.settings;
            if (s && form) {
                form.commissionRate.value = s.commissionRate;
                form.supportEmail.value = s.supportEmail;
                form.currency.value = s.currency;
                form.maintenanceMode.checked = !!s.maintenanceMode;
                form.disableSignup.checked = !!s.disableSignup;
            }

            tiers = data.tiers || [];
            const byTier = data.summary?.byTier || [];

            const grid = document.getElementById('tierGrid');
            if (grid) {
                grid.innerHTML = tiers
                    .map((t) => {
                        const stat = byTier.find((b) => b.tier === t.tier);
                        const seats = (n) => (n >= 10000 ? 'Unlimited' : n);
                        return `
                        <div class="sa-tier-card">
                            <h3>${SA.esc(t.tier)}</h3>
                            <div class="sa-tier-seats">
                                ${seats(t.lawyerSeats)} lawyers · ${seats(t.internSeats)} interns
                            </div>
                            <div class="sa-tier-price-row">
                                <span class="sa-currency">₹</span>
                                <input type="number" min="0" step="1"
                                       value="${Number(t.monthlyPrice)}"
                                       data-tier="${SA.esc(t.tier)}"
                                       aria-label="${SA.esc(t.tier)} monthly price">
                                <span class="sa-tier-per">/ month</span>
                            </div>
                            <div class="sa-tier-meta">
                                <span>${stat ? stat.firms : 0} firm${stat && stat.firms === 1 ? '' : 's'}</span>
                                <span>MRR <strong>${SA.money(stat ? stat.mrr : 0)}</strong></span>
                            </div>
                        </div>`;
                    })
                    .join('');
            }
        }

        document.getElementById('saveTiersBtn')?.addEventListener('click', async () => {
            const inputs = Array.from(document.querySelectorAll('[data-tier]'));
            let changed = 0;

            for (const input of inputs) {
                const tier = input.dataset.tier;
                const price = Number(input.value);
                const current = tiers.find((t) => t.tier === tier);
                if (!current || current.monthlyPrice === price) continue;

                const done = await SA.attempt(() =>
                    SA.platform.updateTierPricing(tier, price),
                );
                if (done) changed++;
            }

            SA.toast(
                changed ? `${changed} tier price${changed === 1 ? '' : 's'} updated` : 'No price changes to save',
            );
            if (changed) await load();
        });

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            const body = {
                commissionRate: Number(fd.get('commissionRate')),
                supportEmail: String(fd.get('supportEmail') || '').trim(),
                currency: String(fd.get('currency') || 'INR').trim(),
                maintenanceMode: form.maintenanceMode.checked,
                disableSignup: form.disableSignup.checked,
            };
            await SA.attempt(
                () => SA.platform.updateSettings(body),
                'Platform settings saved',
            );
            await load();
        });

        await load();
    }

    // ── Dispatch ──────────────────────────────────────────────────────────

    const PAGES = {
        dashboard: initDashboard,
        revenue: initRevenue,
        firms: initFirms,
        lawyers: initLawyers,
        users: initUsers,
        consultations: initConsultations,
        invoices: initInvoices,
        settings: initSettings,
    };

    document.addEventListener('DOMContentLoaded', async () => {
        if (!SA.requireSuperAdmin()) return;

        const page = document.body.dataset.saPage;
        const init = PAGES[page];

        if (!init) {
            console.warn(`[superadmin] no controller for page "${page}"`);
            return;
        }

        try {
            await init();
        } catch (err) {
            console.error(`[superadmin] "${page}" failed to initialise:`, err);
            SA.toast(err.message || 'Could not load this page', true);
        }
    });
})();
