import { useState, type FormEvent } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Brand } from '@/components/brand/Brand';
import './DemoPage.css';

type BookingForm = { name: string; workEmail: string; organization: string; role: string; notes: string };
type FormErrors = Partial<Record<keyof BookingForm, string>>;

export default function DemoPage() {
  const [, setLocation] = useLocation();
  const dateOptions = Array.from({ length: 5 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index + 1);
    return {
      value: date.toISOString().slice(0, 10),
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      day: date.toLocaleDateString('en-US', { day: '2-digit' }),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
    };
  });
  const [selectedDate, setSelectedDate] = useState(dateOptions[1].value);
  const [selectedTime, setSelectedTime] = useState('10:30 AM');
  const [form, setForm] = useState<BookingForm>({ name: '', workEmail: '', organization: '', role: '', notes: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const currentDate = dateOptions.find((option) => option.value === selectedDate) ?? dateOptions[1];

  const updateField = (field: keyof BookingForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Tell us who will join.';
    if (!form.workEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.workEmail)) nextErrors.workEmail = 'Enter a valid work email.';
    if (!form.organization.trim()) nextErrors.organization = 'Add your organization.';
    if (!form.role) nextErrors.role = 'Select your role.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) setSubmitted(true);
  };

  return (
    <main className="demo-page">
      <div className="container">
        <div className="demo-nav">
          <Link href="/" data-testid="link-demo-home"><Brand /></Link>
          <button className="back-link" type="button" data-testid="button-demo-back" onClick={() => setLocation('/')}>
            <ArrowRight size={15} style={{ transform: 'rotate(180deg)' }} /> Return home
          </button>
        </div>
        <div className="demo-wrap">
          <div className="demo-intro">
            <span className="eyebrow">A working conversation</span>
            <h1>Put the control room to work.</h1>
            <p>Choose a time that works. In 30 minutes, we will map one revenue challenge to the signals, workflows and governance that can move it.</p>
            <div className="demo-assurance">
              <div className="assurance-row"><Check size={16} /> Live product walkthrough, not a slide deck</div>
              <div className="assurance-row"><Check size={16} /> Bring a real revenue question</div>
              <div className="assurance-row"><Check size={16} /> Built for operators, finance and RCM teams</div>
            </div>
          </div>
          <div className="booking-card">
            {submitted ? (
              <div className="confirmation" data-testid="status-booking-confirmation">
                <div className="confirmation-mark"><Check size={29} /></div>
                <h2>We saved you a seat.</h2>
                <p>Your working session is requested for the time below. A Velora operator will follow up with the next details.</p>
                <div className="confirmation-detail">
                  {currentDate.weekday}, {currentDate.month} {currentDate.day} · {selectedTime}
                  <strong>{form.workEmail}</strong>
                </div>
                <Link className="button-secondary" href="/" data-testid="link-confirmation-home">
                  Return to Velora <ArrowRight size={15} />
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} noValidate data-testid="form-demo-booking">
                <div className="booking-step">
                  <strong>Choose your working session</strong>
                  <span className="step-count">30 MIN / 01</span>
                </div>
                <label className="form-label" htmlFor="date-selection">Select a date</label>
                <div className="date-grid" id="date-selection">
                  {dateOptions.map((option) => (
                    <button
                      type="button"
                      className={`date-button ${selectedDate === option.value ? 'selected' : ''}`}
                      key={option.value}
                      onClick={() => setSelectedDate(option.value)}
                      data-testid={`button-date-${option.value}`}
                    >
                      <small>{option.weekday}</small>
                      <strong>{option.day}</strong>
                      <em>{option.month}</em>
                    </button>
                  ))}
                </div>
                <span className="form-label">Select a time · Gulf / Eastern overlap</span>
                <div className="time-grid">
                  {['09:00 AM', '10:30 AM', '01:00 PM', '02:30 PM', '04:00 PM', '05:30 PM'].map((time) => (
                    <button
                      type="button"
                      className={`time-button ${selectedTime === time ? 'selected' : ''}`}
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      data-testid={`button-time-${time.replace(/\W/g, '-')}`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
                <div className="field-grid">
                  <div className="field">
                    <label className="form-label" htmlFor="demo-name">Your name</label>
                    <input id="demo-name" value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Full name" autoComplete="name" data-testid="input-demo-name" />
                    {errors.name && <div className="field-error" data-testid="error-demo-name">{errors.name}</div>}
                  </div>
                  <div className="field">
                    <label className="form-label" htmlFor="demo-email">Work email</label>
                    <input id="demo-email" type="email" value={form.workEmail} onChange={(event) => updateField('workEmail', event.target.value)} placeholder="you@company.com" autoComplete="email" data-testid="input-demo-email" />
                    {errors.workEmail && <div className="field-error" data-testid="error-demo-email">{errors.workEmail}</div>}
                  </div>
                  <div className="field">
                    <label className="form-label" htmlFor="demo-organization">Organization</label>
                    <input id="demo-organization" value={form.organization} onChange={(event) => updateField('organization', event.target.value)} placeholder="Provider or RCM team" autoComplete="organization" data-testid="input-demo-organization" />
                    {errors.organization && <div className="field-error" data-testid="error-demo-organization">{errors.organization}</div>}
                  </div>
                  <div className="field">
                    <label className="form-label" htmlFor="demo-role">Your role</label>
                    <select id="demo-role" value={form.role} onChange={(event) => updateField('role', event.target.value)} data-testid="select-demo-role">
                      <option value="">Select role</option>
                      <option value="CFO / finance">CFO / finance</option>
                      <option value="RCM operator">RCM operator</option>
                      <option value="Operations leader">Operations leader</option>
                      <option value="Technology leader">Technology leader</option>
                      <option value="BPO partner">BPO partner</option>
                    </select>
                    {errors.role && <div className="field-error" data-testid="error-demo-role">{errors.role}</div>}
                  </div>
                  <div className="field full">
                    <label className="form-label" htmlFor="demo-notes">What should we look at?</label>
                    <input id="demo-notes" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Optional — e.g. denial recurrence, underpayments, multi-market visibility" data-testid="input-demo-notes" />
                  </div>
                </div>
                <button className="button-primary form-submit" type="submit" data-testid="button-submit-demo">
                  Request this session <ArrowRight size={16} />
                </button>
                <p className="form-disclaimer">No sales sequence disguised as a demo. Your details are used only to coordinate this conversation.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
