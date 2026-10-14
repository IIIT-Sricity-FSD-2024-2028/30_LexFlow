/**
 * pages/Landing.jsx - The public marketing page (replaces index.html).
 *
 * Sections: header w/ login button, hero, features grid, pricing,
 * how-it-works steps, security card, law-firm CTA, footer.
 */

import { useApp } from '../context/AppContext.jsx';
import { navigate } from '../router.jsx';
import Icon from '../components/Icon.jsx';
import { Button } from '../components/ui.jsx';

/* Static content lists - kept as data so the JSX below stays short. */
const FEATURES = [
  { icon: 'message', title: 'Online Consultation', body: 'Secure video conferencing and instant messaging with clients anywhere in the world.' },
  { icon: 'document', title: 'Document Management', body: 'Organize, upload, manage, and securely store legal documents with version tracking.' },
  { icon: 'activity', title: 'Case Progress', body: 'Track case milestones and view progress updates across different stages of legal proceedings.' },
  { icon: 'calendar', title: 'Scheduling', body: 'Integrated calendar systems with automated reminders and conflict detection.' },
  { icon: 'lock', title: 'Role-Based Access', body: 'Granular permission controls to ensure team members only see what they need to.' },
  { icon: 'dollar', title: 'Billing', body: 'Manage invoices, track payments, and maintain transparent billing records for consultations and cases.' },
];

const PLANS = [
  { name: 'Starter', price: '₹999', period: '/month', desc: 'For solo practitioners and small firms just getting started.', features: ['Up to 3 lawyers', 'Up to 2 interns', 'Case & consultation management', 'Document management', 'Email support'] },
  { name: 'Growth', price: '₹2,999', period: '/month', desc: 'For growing firms that need more capacity and collaboration.', features: ['Up to 25 lawyers', 'Unlimited interns', 'Everything in Starter', 'Priority support'], featured: true },
  { name: 'Enterprise', price: 'Custom', period: '', desc: 'For large firms and multi-office organizations that scale per seat.', features: ['Unlimited seats (up to 10,000)', 'Everything in Growth', '24/7 premium support'] },
];

const STEPS = [
  ['01', 'Book', 'Request a consultation through our expert directory.'],
  ['02', 'Connect', 'Engage in secure video or chat consultations.'],
  ['03', 'Collaborate', 'Manage documents and track case progress in an organized workflow.'],
  ['04', 'Succeed', 'Resolve cases efficiently with organized workflows.'],
];

export default function Landing() {
  const { user } = useApp();
  /* Hero CTA: logged-in clients go straight to their dashboard,
     everyone else goes to the sign-in page. */
  const requestConsultation = () => {
    if ((user?.role || '').toLowerCase() === 'client') navigate('/client/dashboard');
    else navigate('/signin');
  };

  /* The router owns the URL hash (#/signin ...), so "#features" would be a
     404 route. Scroll to the section instead of changing the hash. */
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-white">
      {/* ══════════════ HEADER ══════════════ */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <a href="#/" className="flex items-center"><img src="/img/logo.svg" alt="LexFlow logo" className="h-8" /></a>

          {/* Section anchors */}
          <nav className="hidden gap-7 text-sm font-medium text-slate-600 md:flex">
            <button type="button" onClick={() => scrollTo('features')} className="hover:text-brand">Features</button>
            <button type="button" onClick={() => scrollTo('pricing')} className="hover:text-brand">Pricing</button>
            <button type="button" onClick={() => scrollTo('how-it-works')} className="hover:text-brand">How it works</button>
            <button type="button" onClick={() => scrollTo('security')} className="hover:text-brand">Security</button>
          </nav>

          <Button variant="outline" onClick={() => navigate('/signin')}>Login</Button>
        </div>
      </header>

      {/* ══════════════ HERO ══════════════ */}
      <section className="bg-gradient-to-b from-page to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          {/* Left: headline + CTA */}
          <div>
            <span className="inline-block rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-[11px] font-bold tracking-widest text-brand">
              UNIFIED LEGAL CONSULTATION PLATFORM
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight text-brand md:text-5xl">
              Simplifying Legal<br />Consultations and<br />Case Management
            </h1>
            <p className="mt-5 max-w-md text-slate-500">
              Manage consultations, organize documents, track case progress, and coordinate
              legal workflows through a secure platform designed for modern law firms.
            </p>
            <Button className="mt-8 !px-6 !py-3" onClick={requestConsultation}>Request Consultation</Button>
          </div>

          {/* Right: illustration card + trusted badge */}
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg">
              <img src="/img/Modern.svg" alt="Modern law office" />
            </div>
            <div className="absolute -bottom-5 left-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
              <div className="rounded-full bg-emerald-50 p-2"><Icon name="shield" size={18} className="text-emerald-600" /></div>
              <div>
                <p className="text-[10px] font-bold tracking-widest text-slate-400">TRUSTED BY</p>
                <p className="text-sm font-bold text-slate-800">500+ Law Firms</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ FEATURES ══════════════ */}
      <section id="features" className="scroll-mt-16 mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold text-brand">Comprehensive Legal Solutions</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-slate-500">
          Our platform provides everything you need to manage your legal practice efficiently and securely.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
              <div className="mb-4 inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-600"><Icon name={f.icon} size={22} /></div>
              <h3 className="font-bold text-slate-800">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════ PRICING ══════════════ */}
      <section id="pricing" className="scroll-mt-16 bg-page py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-brand">Pricing Plans for Every Firm</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-500">
            Choose the tier that fits your practice. Upgrade or downgrade anytime — seat limits are enforced per tier.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`relative rounded-2xl border bg-white p-7 shadow-sm
                ${plan.featured ? 'border-brand ring-2 ring-brand' : 'border-slate-200'}`}>
                {plan.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-brand">
                    Most Popular
                  </span>
                )}
                <h3 className="font-bold text-slate-800">{plan.name}</h3>
                <p className="mt-2">
                  <span className="text-3xl font-extrabold text-brand">{plan.price}</span>
                  <span className="text-sm text-slate-400">{plan.period}</span>
                </p>
                <p className="mt-3 text-sm text-slate-500">{plan.desc}</p>
                <ul className="mt-5 space-y-2.5 text-sm text-slate-600">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Icon name="check" size={14} className="text-emerald-500" /> {f}
                    </li>
                  ))}
                </ul>
                <Button variant={plan.featured ? 'primary' : 'outline'} className="mt-7 w-full"
                  onClick={() => navigate('/onboarding/firm/1')}>
                  {plan.name === 'Growth' ? 'Choose Growth' : plan.name === 'Starter' ? 'Get Started' : 'Contact Sales'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ HOW IT WORKS ══════════════ */}
      <section id="how-it-works" className="scroll-mt-16 mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold text-brand">How It Works</h2>
        <p className="mt-3 text-center text-slate-500">Experience a seamless transition from consultation to resolution.</p>
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([num, title, body]) => (
            <li key={num} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold text-lg font-extrabold text-brand">
                {num}
              </div>
              <h3 className="mt-4 font-bold text-slate-800">{title}</h3>
              <p className="mt-2 text-sm text-slate-500">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ══════════════ SECURITY ══════════════ */}
      <section id="security" className="scroll-mt-16 mx-auto max-w-6xl px-4 pb-20">
        <div className="grid items-center gap-10 rounded-2xl bg-brand p-8 text-white md:grid-cols-2 md:p-12">
          <div>
            <div className="flex items-center gap-3">
              <Icon name="shield" size={26} className="text-gold" />
              <h2 className="text-2xl font-bold">Security & Confidentiality</h2>
            </div>
            <p className="mt-4 text-slate-300">
              Your data is protected through secure storage and strict role-based access controls.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {['AES-256 Bit Data Encryption', 'Multi-Factor Authentication (MFA)', 'SOC2 Type II Compliant Systems'].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Icon name="check" size={15} className="text-emerald-400" /> {item}
                </li>
              ))}
            </ul>
          </div>
          {/* 4 certification badges */}
          <div className="grid grid-cols-2 gap-4">
            {[['lock', 'Protected'], ['activity', 'Audited'], ['lock', 'Private'], ['settings', 'Controlled']].map(([icon, label], i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-white/10 p-4">
                <Icon name={icon} size={20} className="text-gold" />
                <span className="text-sm font-semibold">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ LAW FIRM CTA ══════════════ */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">For Law Firms</span>
          <h2 className="mx-auto mt-4 max-w-2xl text-2xl font-bold text-brand">
            Empower Your Firm with a Dedicated Management Suite
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500">
            Manage your entire firm's case portfolio, lawyers, clients, and billing from a single dashboard.
            Get insights, assign cases, and maintain full visibility over your practice.
          </p>
          <Button className="mt-6" onClick={() => navigate('/onboarding/firm/1')}>Register as Law Firm</Button>
        </div>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer className="bg-brand py-14 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-4">
          <div>
            <p className="text-lg font-bold text-white">LexFlow</p>
            <p className="mt-3 text-sm">
              A secure platform for managing legal consultations, case progress, documents, and law firm workflows.
            </p>
            <div className="mt-4 flex gap-3">
              <Icon name="globe" size={18} className="text-slate-400" />
              <Icon name="user" size={18} className="text-slate-400" />
              <Icon name="message" size={18} className="text-slate-400" />
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Platform</p>
            <ul className="mt-3 space-y-2 text-sm">
              {['Documentation', 'Case Progress', 'Automations', 'Integrations'].map((l) => <li key={l}>{l}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Company</p>
            <ul className="mt-3 space-y-2 text-sm">
              {['About Us', 'Careers', 'Privacy Policy', 'Terms of Service'].map((l) => <li key={l}>{l}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold text-white">Newsletter</p>
            <p className="mt-3 text-sm">Stay updated with legal tech trends.</p>
            <form className="mt-3 flex overflow-hidden rounded-lg" onSubmit={(e) => e.preventDefault()}>
              <input type="email" placeholder="Email address" className="w-full bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-400" />
              <button className="bg-gold px-3 text-brand" aria-label="Subscribe"><Icon name="arrowRight" size={16} /></button>
            </form>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 pt-6 text-xs text-slate-400">
          <p>© 2026 LexFlow Legal Technologies Inc. All rights reserved.</p>
          <p>Security Standards · Compliance · Cookies</p>
        </div>
      </footer>
    </div>
  );
}
