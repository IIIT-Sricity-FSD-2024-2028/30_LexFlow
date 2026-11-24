import { createSlice } from '@reduxjs/toolkit';
import { api } from '../../api/api.js';
import { asList, createResource } from '../resource.js';

export const firmRoster = createResource('firmManagement', 'roster', async ({ firmId, role }) =>
  asList(await api.users.getByFirm(firmId, role)),
);

export const firmBilling = createResource('firmManagement', 'billing', async ({ role, firmId, userId }) => {
  const headers = { 'x-user-id': userId || '' };
  const [invoices, payments, clients, cases] = await Promise.all([
    api.billing.getInvoices(role, headers),
    api.billing.getPayments(role, headers),
    api.billing.getClients(role, headers).catch(() => []),
    api.billing.getCases(role).catch(() => null),
  ]);
  const [charges, subscription, tiers] = await Promise.all([
    api.platform.getCharges(role, firmId, userId).catch(() => []),
    firmId ? api.platform.getSubscription(firmId, role, userId).catch(() => null) : null,
    firmId ? api.platform.getTierPlans(role).catch(() => []) : [],
  ]);
  return {
    invoices: asList(invoices), payments: asList(payments), clients: asList(clients),
    invoiceCases: Array.isArray(cases) ? cases : null,
    charges: asList(charges), subscription, tiers: asList(tiers),
  };
});

function billingFor(state, key) {
  return state.billing?.key === key ? state.billing.data : null;
}

const firmManagement = createSlice({
  name: 'firmManagement',
  initialState: { roster: null, billing: null },
  reducers: {
    invoiceSaved(state, { payload: { key, invoice } }) {
      const billing = billingFor(state, key);
      if (!billing) return;
      const previous = billing.invoices.find((item) => item.id === invoice.id);
      if (previous) Object.assign(previous, invoice);
      else billing.invoices.unshift(invoice);
    },
    invoiceRemoved(state, { payload: { key, id } }) {
      const billing = billingFor(state, key);
      if (billing) billing.invoices = billing.invoices.filter((item) => item.id !== id);
    },
    subscriptionUpdated(state, { payload: { key, subscription, charges } }) {
      const billing = billingFor(state, key);
      if (!billing) return;
      billing.subscription = subscription;
      if (charges !== undefined) billing.charges = asList(charges);
    },
    chargeSaved(state, { payload: { key, charge } }) {
      const billing = billingFor(state, key);
      if (!billing) return;
      const index = billing.charges.findIndex((item) => item.id === charge.id);
      if (index === -1) billing.charges.push(charge);
      else billing.charges[index] = charge;
    },
  },
  extraReducers(builder) {
    firmRoster.register(builder);
    firmBilling.register(builder);
  },
});

export const { invoiceSaved, invoiceRemoved, subscriptionUpdated, chargeSaved } = firmManagement.actions;
export default firmManagement.reducer;
