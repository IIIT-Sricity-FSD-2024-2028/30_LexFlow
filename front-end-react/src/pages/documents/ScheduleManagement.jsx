/**
 * Schedule Management - lawyer calendar + day timeline with an
 * event-creation modal. Replaces schedule-management.html's inline script
 * (whose vanilla "Save Event" was a no-op — here saving actually stores
 * the event in localStorage so the demo persists across reloads).
 */

import { useState } from 'react';
import {
  Button, Card, PageHeader, Modal, Field, Input, Select, Textarea,
} from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import Calendar from '../../components/Calendar.jsx';

/* Static lawyer roster shown in the filter (as per the design). */
const LAWYERS = [
  'Sarah Jenkins — Criminal Defense',
  'Harvey Specter — Corporate Law',
  'Rachel Zane — Family Law',
  'Louis Litt — Financial Fraud',
];

/* Demo events for the timeline panel (kept in state, seeded below). */
const SEED_EVENTS = [
  { type: 'consultation', title: 'Initial Consultation: Mr. Harrison', start: 9, hours: 1, place: 'Meeting Room B' },
  { type: 'hearing', title: 'Superior Court Hearing - Case #88219', start: 10.5, hours: 1.5, place: '4th District Court Room 402' },
  { type: 'internal', title: 'Internal Case Review - Miller v. SCT', start: 13, hours: 1, place: 'Conference Room A' },
];
const HOUR_H = 56; // px per hour in the timeline
const START_HOUR = 8, END_HOUR = 15;

export default function ScheduleManagement() {
  const [events, setEvents] = useState(() => {
    // Persist across reloads so created events survive (localStorage).
    try { return JSON.parse(localStorage.getItem('lexflow_schedule') || 'null') || SEED_EVENTS; }
    catch { return SEED_EVENTS; }
  });
  const [selected, setSelected] = useState(new Date());
  const [lawyerFilter, setLawyerFilter] = useState(LAWYERS[0]);
  const [modal, setModal] = useState(null); // form state (null = closed)

  /* Save one event from the modal. */
  const saveEvent = () => {
    if (!modal.date || !modal.time) return;
    const [h, m] = modal.time.split(':').map(Number);
    const start = h + m / 60;
    const event = { ...modal, start, hours: 1 };
    const next = [...events, event];
    setEvents(next);
    localStorage.setItem('lexflow_schedule', JSON.stringify(next));
    setModal(null);
  };

  /* Legend colours per event type. */
  const tone = {
    hearing: 'bg-blue-500', consultation: 'bg-emerald-500', internal: 'bg-amber-400',
  };

  return (
    <>
      <PageHeader
        title="Schedules"
        subtitle="Manage and view specialized timelines for the legal team."
        actions={<Button onClick={() => setModal({ caseId: '', courtName: '', lawyer: '', type: 'hearing', date: '', time: '10:00', location: 'courtroom', description: '' })}>
          <Icon name="plus" size={14} /> Add Event
        </Button>}
      />

      {/* lawyer filter + legend */}
      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Select Lawyer</span>
          <select value={lawyerFilter} onChange={(e) => setLawyerFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            {LAWYERS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
          {[['hearing', 'Court Hearing', 'bg-blue-500'], ['consultation', 'Consultation', 'bg-emerald-500'], ['internal', 'Internal', 'bg-amber-400']].map(([k, label, c]) => (
            <span key={k} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${c}`} /> {label}</span>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Calendar ── */}
        <Card className="p-5">
          <h2 className="mb-3 font-bold text-slate-900">Calendar</h2>
          {/* dots: colour the days that have events */}
          <CalendarFull events={events} selected={selected} onPick={setSelected} tone={tone} />
        </Card>

        {/* ── Day timeline ── */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">
              Schedule: {selected.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </h2>
          </div>
          {/* hours ruler + absolutely-positioned event blocks */}
          <div className="relative border-l border-slate-200" style={{ height: (END_HOUR - START_HOUR) * HOUR_H }}>
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
              <div key={i} className="absolute left-0 w-full border-t border-slate-100 pl-12 text-[10px] text-slate-400"
                style={{ top: i * HOUR_H }}>
                {String(START_HOUR + i).padStart(2, '0')}:00
              </div>
            ))}
            {events.map((e, i) => (
              <div key={i}
                className={`absolute left-12 right-2 rounded-lg p-2 text-xs text-white shadow-sm ${tone[e.type] || 'bg-slate-500'}`}
                style={{ top: (e.start - START_HOUR) * HOUR_H, height: e.hours * HOUR_H - 4 }}>
                <p className="font-bold">{e.title || e.courtName || 'Event'}</p>
                <p className="opacity-80">{e.place || e.location || ''}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Create event modal ── */}
      <Modal open={!!modal} onClose={() => setModal(null)} title="Create Court Event"
        footer={<>
          <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
          <Button onClick={saveEvent}>Save Event</Button>
        </>}>
        {modal && (
          <div className="space-y-4">
            <Field label="Case ID / CNR" required>
              <Input value={modal.caseId} placeholder="Search case…"
                onChange={(e) => setModal((m) => ({ ...m, caseId: e.target.value }))} />
            </Field>
            <Field label="Court Name">
              <Input value={modal.courtName} onChange={(e) => setModal((m) => ({ ...m, courtName: e.target.value }))} />
            </Field>
            <Field label="Assign Lawyer">
              <Select value={modal.lawyer} onChange={(e) => setModal((m) => ({ ...m, lawyer: e.target.value }))}>
                <option value="">Select lawyer</option>
                {LAWYERS.map((l) => <option key={l}>{l}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Event Type">
                <Select value={modal.type} onChange={(e) => setModal((m) => ({ ...m, type: e.target.value }))}>
                  <option value="hearing">Hearing</option>
                  <option value="consultation">Consultation</option>
                  <option value="internal">Internal</option>
                </Select>
              </Field>
              <Field label="Location Type">
                <Select value={modal.location} onChange={(e) => setModal((m) => ({ ...m, location: e.target.value }))}>
                  <option value="courtroom">Courtroom</option>
                  <option value="meeting">Meeting Room</option>
                  <option value="online">Online</option>
                </Select>
              </Field>
              <Field label="Event Date" required>
                <Input type="date" value={modal.date} onChange={(e) => setModal((m) => ({ ...m, date: e.target.value }))} />
              </Field>
              <Field label="Event Time" required>
                <Input type="time" value={modal.time} onChange={(e) => setModal((m) => ({ ...m, time: e.target.value }))} />
              </Field>
            </div>
            <Field label="Description">
              <Textarea rows={2} value={modal.description} onChange={(e) => setModal((m) => ({ ...m, description: e.target.value }))} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

/* Wrapper that derives the calendar's coloured dots from the event list. */
function CalendarFull({ events, selected, onPick, tone }) {
  // group event dates -> dot colour class for Calendar's `dots` prop
  const dots = {};
  events.forEach((e) => {
    const key = new Date(e.date).toDateString();
    if (!isNaN(new Date(e.date))) dots[key] = tone[e.type] || 'bg-slate-400';
  });
  return <Calendar selected={selected} onPick={onPick} dots={dots} />;
}