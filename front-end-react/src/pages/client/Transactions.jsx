/**
 * All Transactions (client) - the complete payment history table with
 * skeleton loading rows and newest-first sorting.
 */

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { navigate } from '../../router.jsx';
import { Breadcrumb } from '../../components/Layout.jsx';
import {
  Card, Badge, PageHeader, ErrorBanner, Table, Th, Td, Button,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { money, formatDate } from '../../lib/format.js';

export default function Transactions() {
  const { user } = useApp();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const role = (user?.role || 'client').toLowerCase();
      const data = await api.billing.getPayments(role, {
        'x-user-id': user?.id || '', 'x-user-name': user?.fullName || user?.name || '',
      });
      const list = Array.isArray(data) ? data : [];
      // Newest first (payments carry a date field).
      list.sort((a, b) => new Date(b.paymentDate || b.date) - new Date(a.paymentDate || a.date));
      setPayments(list);
    } catch (err) {
      setError('⚠ Could not load transactions. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <>
      <Breadcrumb items={[{ label: 'Billing', href: '/client/billing' }, { label: 'All Transactions' }]} />
      <PageHeader
        title="All Transactions"
        subtitle="Every payment made through the platform."
        actions={<Button variant="outline" onClick={() => navigate('/client/billing')}><Icon name="arrowLeft" size={14} /> Back to Billing</Button>}
      />

      <Card>
        <Table>
          <thead>
            <tr><Th>Payment ID</Th><Th>Invoice ID</Th><Th>Amount Paid</Th><Th>Payment Date</Th><Th>Payment Method</Th><Th>Status</Th></tr>
          </thead>
          {loading ? (
            /* Skeleton rows keep the layout stable while loading. */
            <tbody>
              {Array.from({ length: 5 }).map((_, r) => (
                <tr key={r}>
                  {Array.from({ length: 6 }).map((_, c) => (
                    <td key={c} className="px-4 py-3"><div className="skeleton h-4 w-full max-w-[120px]" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : error ? (
            <tbody><tr><td className="px-4 py-6"><ErrorBanner message={error} onRetry={load} /></td></tr></tbody>
          ) : payments.length === 0 ? (
            <tbody><tr><Td colSpan={6} className="!text-center text-slate-400">No transactions found.</Td></tr></tbody>
          ) : (
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs font-bold text-slate-600">{p.id}</Td>
                  <Td className="font-mono text-xs">{p.invoiceId}</Td>
                  <Td className="font-semibold">{money(p.amount)}</Td>
                  <Td>{formatDate(p.paymentDate || p.date)}</Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      <Icon name={/bank/i.test(p.paymentMethod || p.method || '') ? 'download' : 'card'} size={14} className="text-slate-400" />
                      {p.paymentMethod || p.method || 'Card'}
                    </span>
                  </Td>
                  <Td><Badge variant="green">{p.status || 'Success'}</Badge></Td>
                </tr>
              ))}
            </tbody>
          )}
        </Table>
      </Card>
    </>
  );
}