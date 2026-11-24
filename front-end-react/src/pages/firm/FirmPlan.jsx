import { Badge, Button, Card } from '../../components/ui.jsx';
import { formatDate, money } from '../../lib/format.js';

export default function FirmPlan({
  subscription, tiers, charges, busy, onSwitch, onRenew, onAddCard, onUpdateRenewal,
}) {
  if (!subscription) {
    return <Card className="p-5">
      <h2 className="font-bold text-slate-900">Your Plan</h2>
      <p className="mt-2 text-sm text-slate-500">Subscription information unavailable.</p>
    </Card>;
  }

  const { tier, monthlyPrice, currentPeriodEnd, hasPaidAccess, autoRenew, paymentMethod, scheduledTier,
    pendingTier, pendingChargeId, requiredChargeIds, renewalFailure, status } = subscription;
  const expired = hasPaidAccess === false;
  const cancelled = status === 'cancelled';
  const currentIndex = tiers.findIndex((plan) => plan.tier === tier);
  const required = charges.filter((charge) => requiredChargeIds?.includes(charge.id));
  const locked = charges.some((charge) => charge.id === pendingChargeId && charge.status === 'Paid');
  const pending = scheduledTier || pendingTier;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-slate-900">Your Plan</h2>
        <Badge variant={expired ? 'amber' : 'green'}>{expired ? 'Read-only' : 'Active'}</Badge>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {expired ? 'Plan' : 'Active plan'}: <b>{tier}</b> · {money(monthlyPrice, 0)}/month
      </p>
      {currentPeriodEnd && (
        <p className="mt-1 text-sm text-slate-600">
          {expired ? 'Paid period ended' : autoRenew ? 'Next renewal' : 'Paid through'} {formatDate(currentPeriodEnd)}
        </p>
      )}
      {expired && (
        <p className="mt-2 text-sm text-slate-700">You can view existing firm records. Renew to make changes.</p>
      )}
      {renewalFailure && <p role="alert" className="mt-2 text-sm text-red-700">{renewalFailure}</p>}
      {cancelled ? (
        <p className="mt-3 text-sm text-slate-600">This subscription was cancelled by the platform.</p>
      ) : (
        <>
          {pending && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">
                {scheduledTier ? scheduledTier + ' scheduled for your next renewal' : pendingTier + ' awaiting payment'}
              </p>
              {pendingTier && required.length > 0 && (
                <ul className="mt-1 list-disc pl-4">
                  {required.map((charge) => (
                    <li key={charge.id}>
                      {charge.kind === 'tier_change' ? 'Upgrade to ' + charge.targetTier : 'Monthly ' + charge.period}
                      {' · '}{money(charge.amount)}
                    </li>
                  ))}
                </ul>
              )}
              {locked ? (
                <p className="mt-1">Settle the remaining charges to activate the upgrade.</p>
              ) : (
                <Button variant="ghost" className="mt-1 !px-2 !py-1 !text-xs" disabled={busy}
                  onClick={() => onSwitch({ tier, monthlyPrice })}>
                  Cancel pending change
                </Button>
              )}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {expired && (
              <Button disabled={busy} onClick={onRenew}>
                {renewalFailure ? 'Retry renewal' : currentPeriodEnd ? 'Renew plan' : 'Start plan'}
              </Button>
            )}
            {tiers.filter((plan) => plan.tier !== tier && plan.tier !== pending).map((plan) => (
              <Button key={plan.tier} variant="outline" className="!text-xs" disabled={busy || locked}
                onClick={() => onSwitch(plan)}>
                {!expired && tiers.indexOf(plan) < currentIndex ? 'Downgrade to' : 'Switch to'} {plan.tier}
                {' · '}{money(plan.monthlyPrice, 0)}/mo
              </Button>
            ))}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
            <p className="font-medium text-slate-900">Automatic renewal {autoRenew ? 'on' : 'off'}</p>
            {paymentMethod && <p className="mt-1 text-slate-600">Test card ending in {paymentMethod.last4}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" className="!text-xs" disabled={busy} onClick={onAddCard}>
                {paymentMethod ? 'Replace payment method' : 'Add payment method'}
              </Button>
              {paymentMethod && (
                <>
                  <Button variant="outline" className="!text-xs" disabled={busy}
                    onClick={() => onUpdateRenewal({ autoRenew: !autoRenew })}>
                    {autoRenew ? 'Cancel renewal' : 'Enable renewal'}
                  </Button>
                  <Button variant="ghost" className="!text-xs" disabled={busy}
                    onClick={() => onUpdateRenewal({ paymentMethod: null })}>
                    Remove payment method
                  </Button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
