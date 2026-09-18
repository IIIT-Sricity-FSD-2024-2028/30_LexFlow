/**
 * Find a Law Firm - client directory page.
 * Search / filter / sort firms, open a firm profile overlay, and book a
 * consultation through a modal with a mini calendar + time slots.
 */

import { useEffect, useState } from 'react';
import { api } from '../../api/api.js';
import { useApp } from '../../context/AppContext.jsx';
import { navigate } from '../../router.jsx';
import {
  Button, Card, Badge, Modal, PageHeader, Loading, ErrorBanner, EmptyState,
  Field, Input, Select, Textarea,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import Calendar from '../../components/Calendar.jsx';
import { toLongDate } from '../../lib/format.js';

/* Dropdown options (same values the backend expects). */
const LOCATIONS = [['', 'Any Location'], ['mumbai', 'Mumbai'], ['bangalore', 'Bangalore'], ['chennai', 'Chennai'], ['remote', 'Remote']];
const AREAS = [['', 'Any Practice Area'], ['corporate', 'Corporate'], ['family', 'Family'], ['ip', 'Intellectual Property'], ['criminal', 'Criminal']];
const SORTS = [['rating', 'Highest Rated'], ['price_asc', 'Lowest Price'], ['reviews', 'Most Reviews'], ['availability', 'Availability']];
const TIME_SLOTS = ['09:00 AM', '10:30 AM', '01:00 PM', '02:30 PM', '04:00 PM', '05:30 PM'];

export default function LawFirmSearch() {
  const { user, toast } = useApp();

  /* ── Search state ── */
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [area, setArea] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* ── Profile overlay state ── */
  const [profile, setProfile] = useState(null); // the full firm being previewed

  /* ── Booking modal state ── */
  const [booking, setBooking] = useState(null);       // firm being booked
  const [type, setType] = useState('chat');           // chat | inperson
  const [date, setDate] = useState(new Date());       // chosen day
  const [time, setTime] = useState(TIME_SLOTS[1]);    // default 10:30 AM (like vanilla)
  const [description, setDescription] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);

  /* Fetch firms with the current filters. */
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await api.lawFirms.getAll({ keyword, location, practiceArea: area, sortBy }, 'client');
      setFirms(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(`Could not load firms: ${err.message} (Is the backend running?)`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []); // initial load

  /* Open the booking modal for a firm (resets the form each time). */
  const openBooking = (firm) => {
    setBooking(firm);
    setType('chat');
    setDate(new Date());            // reset to today
    setTime(TIME_SLOTS[1]);
    setDescription('');
  };

  /* Submit the booking to the backend (same payload as vanilla). */
  const confirmBooking = async (e) => {
    e.preventDefault();
    const clientId = user?.id || user?.userId || user?.clientId;
    if (!user || (user.role || '').toLowerCase() !== 'client' || !clientId) {
      navigate('/signin');
      return;
    }
    setBookingBusy(true);
    try {
      await api.consultations.create({
        clientId,
        clientName: user.fullName || user.name,
        firmId: booking.id,
        firmName: booking.name,
        type,
        date: toLongDate(date),                              // "May 12, 2026"
        time: `${time} - ${time}`,                           // backend expects a range string
        caseDescription: description.trim() || 'General consultation request.',
        consultationFee: booking.price ? `$${booking.price}` : '',
        avatarClass: ['blue', 'green', 'orange', 'purple', 'pink', 'indigo', 'teal'][Math.floor(Math.random() * 7)],
        bookedViaWorkflow: true,                             // tells the backend where it came from
      }, 'client');
      toast('Consultation request sent! Redirecting…');
      setTimeout(() => navigate('/client/dashboard'), 900);
    } catch (err) {
      toast(`Booking failed: ${err.message}`, 'error');
      setBookingBusy(false);
    }
  };

  /* Availability badge colours. */
  const availabilityBadge = (a) => {
    const v = String(a || '').toUpperCase();
    if (v === 'AVAILABLE') return <Badge variant="green">Available</Badge>;
    if (v === 'TODAY') return <Badge variant="amber">Available Today</Badge>;
    if (v === 'BUSY') return <Badge variant="red">Busy</Badge>;
    return <Badge>{a}</Badge>;
  };

  return (
    <>
      <PageHeader title="Find a Law Firm" subtitle="Search our verified directory and book a consultation in minutes." />

      {/* ── Search hero ── */}
      <Card className="mb-8 p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <Input placeholder="Search firm name, lawyer, or specialty..." value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()} className="md:col-span-2" />
          <Select value={location} onChange={(e) => setLocation(e.target.value)}>
            {LOCATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select value={area} onChange={(e) => setArea(e.target.value)}>
            {AREAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </div>
        <Button className="mt-3 w-full md:w-auto" onClick={load}>
          <Icon name="search" size={14} /> Search
        </Button>
      </Card>

      {/* ── Results ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Recommended Matches</h2>
          <p className="text-sm text-slate-500">{firms.length} firm(s) found</p>
        </div>
        <Select value={sortBy} onChange={(e) => { setSortBy(e.target.value); }} className="!w-48">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>

      {loading && <Loading text="Searching firms…" />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}
      {!loading && !error && firms.length === 0 && (
        <EmptyState icon="search" title="No firms match your search." />
      )}
      {!loading && !error && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {firms.map((firm) => (
            <Card key={firm.id} className="flex flex-col p-5">
              {/* header: avatar + name + availability */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(firm.name)}&background=1e3a5f&color=fff`}
                    alt={firm.name} className="h-11 w-11 rounded-full" />
                  <div>
                    <h3 className="font-bold text-slate-900">{firm.name}</h3>
                    <p className="text-xs text-slate-500">{firm.subtitle}</p>
                  </div>
                </div>
                {availabilityBadge(firm.availability)}
              </div>

              {/* description */}
              <p className="mt-3 line-clamp-2 text-sm text-slate-500">{firm.description}</p>

              {/* stats row */}
              <div className="mt-4 flex items-center gap-4 text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1 text-amber-500">
                  ★ {firm.rating || '4.0'} <span className="font-normal text-slate-400">({firm.reviews || 0} reviews)</span>
                </span>
                <span>${firm.price || '—'}/hr</span>
              </div>

              {/* actions */}
              <div className="mt-auto flex gap-2 pt-4">
                <Button variant="outline" className="flex-1 !py-1.5" onClick={() => viewProfile(firm.id)}>View Profile</Button>
                <Button className="flex-1 !py-1.5" onClick={() => openBooking(firm)}>Book Now</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Firm profile overlay (modal) ── */}
      <Modal open={!!profile} onClose={() => setProfile(null)} wide
        title={profile ? `Adv. ${profile.name}` : 'Loading…'}
        subtitle={profile ? `Senior Partner at ${profile.name}` : ''}>
        {profile && (
          <div>
            {/* stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Experience', `${profile.experience || '10'}+ Years`],
                ['Consultation Fee', `$${profile.price || 250}/hr`],
                ['Rating', `${profile.rating || '4.9'}/5 (${profile.reviews || 0} reviews)`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
                </div>
              ))}
            </div>

            {/* practice areas + about */}
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Practice Areas</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(profile.practiceAreas || ['General Practice']).map((a) => <Badge key={a} variant="blue">{a}</Badge>)}
              </div>
            </div>
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">About</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{profile.bio || profile.description}</p>
            </div>

            {/* education + languages */}
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Education</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {(profile.education || []).map((e, i) => (
                    <li key={i}>
                      <span className="font-semibold text-slate-700">{e.school}</span>
                      <span className="block text-xs text-slate-400">{e.degree}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Languages</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(profile.languages || ['English']).map((l) => <Badge key={l}>{l}</Badge>)}
                </div>
              </div>
            </div>

            {/* contact info (only when the firm has any) */}
            {(profile.address || profile.email || profile.phone || profile.website) && (
              <div className="mt-5 rounded-xl border border-slate-200 p-4 text-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Contact Information</p>
                {profile.address && <p className="mt-2 flex items-center gap-2 text-slate-600"><Icon name="pin" size={14} /> {profile.address}</p>}
                {profile.email && <p className="mt-1 flex items-center gap-2 text-slate-600"><Icon name="message" size={14} /> {profile.email}</p>}
                {profile.phone && <p className="mt-1 flex items-center gap-2 text-slate-600"><Icon name="bell" size={14} /> {profile.phone}</p>}
                {profile.website && (
                  <p className="mt-1 flex items-center gap-2 text-indigo-600">
                    <Icon name="globe" size={14} />
                    <a href={profile.website} target="_blank" rel="noreferrer" className="hover:underline">{profile.website}</a>
                  </p>
                )}
              </div>
            )}

            {/* footer actions */}
            <div className="mt-6 flex gap-3">
              <Button className="flex-1" onClick={() => openBooking(profile)}>Book Consultation</Button>
              <Button variant="outline" onClick={() => setProfile(null)}>Back to List</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Booking modal ── */}
      <Modal open={!!booking} onClose={() => setBooking(null)} title="Book Consultation"
        subtitle="Secure your appointment in a few steps." wide>
        {booking && (
          <form onSubmit={confirmBooking}>
            {/* firm name (read-only) */}
            <Field label="LawFirm Name">
              <Input value={booking.name} readOnly className="!bg-slate-50" />
            </Field>

            {/* consultation type pills */}
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-semibold text-slate-600">Consultation Type</p>
              <div className="grid grid-cols-2 gap-3">
                {[['chat', 'Chat', 'message'], ['inperson', 'In-person', 'pin']].map(([v, label, icon]) => (
                  <button type="button" key={v} onClick={() => setType(v)}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition
                      ${type === v ? 'border-brand bg-slate-50 text-brand' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    <Icon name={icon} size={16} /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* calendar + time slots */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-600">Select Date</p>
                <Calendar selected={date} onPick={setDate} disablePast />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-slate-600">Available Time</p>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_SLOTS.map((t) => (
                    <button type="button" key={t} onClick={() => setTime(t)}
                      className={`rounded-lg border py-2 text-xs font-semibold transition
                        ${time === t ? 'border-brand bg-brand text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* description */}
            <div className="mt-4">
              <Field label="Brief Case Description">
                <Textarea rows={3} placeholder="Tell us more about your legal requirements..."
                  value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
            </div>

            <div className="mt-5 flex gap-3">
              <Button variant="ghost" type="button" onClick={() => setBooking(null)}>Cancel</Button>
              <Button type="submit" loading={bookingBusy} className="flex-1">Confirm Booking</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );

  /* Fetch + show the full profile of one firm. */
  async function viewProfile(id) {
    setProfile(null);
    try {
      const firm = await api.lawFirms.getById(id, 'client');
      setProfile(firm);
    } catch (err) {
      toast(`Could not load profile: ${err.message}`, 'error');
    }
  }
}
