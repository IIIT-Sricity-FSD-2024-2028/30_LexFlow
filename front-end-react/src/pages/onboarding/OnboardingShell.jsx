/**
 * pages/onboarding/OnboardingShell.jsx - The shared white card + stepper
 * layout that all five onboarding steps use (client 1-2, firm 1-3).
 *
 * The stepper draws circles: "done" steps show a check, the "active" step
 * is filled navy, future steps are outlined grey.
 */

import Icon from '../../components/Icon.jsx';

export default function OnboardingShell({ steps, current, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-4">
      {/* Logo back to landing */}
      <a href="#/" className="fixed left-6 top-5 text-xl font-extrabold text-brand">LexFlow</a>

      <div className="w-full max-w-3xl rounded-2xl bg-white p-8 shadow-lg md:p-12">
        {/* ── Stepper: circles joined by a line ── */}
        <div className="mb-8 flex items-center justify-center">
          {steps.map((label, i) => (
            <div key={label} className="flex items-center">
              {/* connector line before every step except the first */}
              {i > 0 && <div className={`h-0.5 w-16 ${i <= current ? 'bg-brand' : 'bg-slate-200'}`} />}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition
                    ${i < current ? 'border-brand bg-brand text-white' : ''}
                    ${i === current ? 'border-brand bg-brand text-white' : ''}
                    ${i > current ? 'border-slate-300 text-slate-400' : ''}`}
                >
                  {i < current ? <Icon name="check" size={14} /> : i + 1}
                </div>
                <span className={`text-[11px] font-semibold ${i === current ? 'text-brand' : 'text-slate-400'}`}>
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* The actual form is passed in as children */}
        {children}
      </div>
    </div>
  );
}

/* Red alert banner shown above a form when validation/submit fails. */
export function FormAlert({ message }) {
  if (!message) return null;
  return (
    <p className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
      <Icon name="alert" size={16} /> {message}
    </p>
  );
}
