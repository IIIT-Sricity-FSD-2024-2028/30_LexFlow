/**
 * Superadmin - Platform Settings: tier pricing editor + business rules
 * (commission rate, support email, maintenance mode, signups).
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { money } from '../../lib/format.js';
import {
  Button, Card, PageHeader, Loading, ErrorBanner, Field, Input,
} from '../../components/ui.jsx';

export default function SASettings() {
  const { toast } = useApp();

  const [tiers, setTiers] = useState([]);          // tier cards with editable prices
  const [settings, setSettings] = useState(null);  // business rules form
  const [summary, setSummary] = useState(null);    // for firms/MRR per tier
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [t, s, sum] = await Promise.all([
        api.platform.getTierPlans('superadmin'),
        api.platform.getSettings('superadmin'),
        api.platform.getRevenueSummary('superadmin').catch(() => null),
      ]);
      setTiers(Array.isArray(t) ? t : []);
      setSettings(s || {});
      setSummary(sum);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Save any tier prices that changed (one PUT per changed tier). */
  const saveTiers = async () => {
    setBusy(true);
    let changed = 0;
    try {
      for (const t of tiers) {
        const original = summary?.byTier?.find((b) => b.tier === t.tier);
        // Compare against what the backend had when we loaded.
        const before = original?.monthlyPrice ?? t.monthlyPrice;
        if (Number(t.monthlyPrice) !== Number(before)) {
          await api.platform.updateTierPricing(t.tier, Number(t.monthlyPrice), 'superadmin');
          changed++;
        }
      }
      toast(changed ? `${changed} tier price(s) updated` : 'No price changes to save');
      if (changed) load();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  /* Save the business rules form. */
  const saveSettings = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.platform.updateSettings({
        commissionRate: Number(settings.commissionRate),
        supportEmail: settings.supportEmail,
        currency: settings.currency || 'INR',
        maintenanceMode: !!settings.maintenanceMode,
        disableSignup: !!settings.disableSignup,
      }, 'superadmin');
      toast('Platform settings saved');
      load();
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading text="Loading settings…" />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;

  return (
    <>
      <PageHeader
        title="Platform Settings"
        subtitle="Tier pricing and the business rules of LexFlow."
        actions={<Button loading={busy} onClick={saveTiers}>Save pricing</Button>}
      />

      {/* ── Tier pricing cards ── */}
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {tiers.map((t) => {
          const info = summary?.byTier?.find((b) => b.tier === t.tier);
          return (
            <Card key={t.tier} className="p-5">
              <h3 className="font-bold text-slate-900">{t.tier}</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {t.lawyerSeats >= 10000 ? 'Unlimited' : t.lawyerSeats} lawyers · {t.internSeats >= 10000 ? 'Unlimited' : t.internSeats} interns
              </p>
              <div className="mt-3 flex items-center gap-1">
                <span className="text-sm font-bold text-slate-500">₹</span>
                <Input type="number" min="0" step="1" value={t.monthlyPrice} className="!w-28"
                  onChange={(e) => setTiers((list) => list.map((x) => (x.tier === t.tier ? { ...x, monthlyPrice: e.target.value } : x)))} />
                <span className="text-xs text-slate-400">/ month</span>
              </div>
              <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
                {info ? `${info.firms} firm(s) · MRR ${money(info.mrr, 0)}` : 'No subscribers yet'}
              </p>
            </Card>
          );
        })}
      </div>

      {/* ── Business rules form ── */}
      <Card className="max-w-2xl p-6">
        <h2 className="font-bold text-slate-900">Business & platform rules</h2>
        <form onSubmit={saveSettings} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Commission rate %" required>
            <Input type="number" min="0" max="100" step="0.5" required value={settings?.commissionRate ?? ''}
              onChange={(e) => setSettings((s) => ({ ...s, commissionRate: e.target.value }))} />
          </Field>
          <Field label="Reporting currency" required>
            <Input required value={settings?.currency ?? ''} placeholder="INR"
              onChange={(e) => setSettings((s) => ({ ...s, currency: e.target.value }))} />
          </Field>
          <Field label="Support email" required className="sm:col-span-2">
            <Input type="email" required value={settings?.supportEmail ?? ''}
              onChange={(e) => setSettings((s) => ({ ...s, supportEmail: e.target.value }))} />
          </Field>

          {/* two toggle switches */}
          <label className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 sm:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Maintenance mode</span>
            <input type="checkbox" className="h-5 w-5 rounded border-slate-300" checked={!!settings?.maintenanceMode}
              onChange={(e) => setSettings((s) => ({ ...s, maintenanceMode: e.target.checked }))} />
          </label>
          <label className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 sm:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Disable new signups</span>
            <input type="checkbox" className="h-5 w-5 rounded border-slate-300" checked={!!settings?.disableSignup}
              onChange={(e) => setSettings((s) => ({ ...s, disableSignup: e.target.checked }))} />
          </label>

          <div className="sm:col-span-2">
            <Button type="submit" loading={busy}>Save settings</Button>
          </div>
        </form>
      </Card>
    </>
  );
}