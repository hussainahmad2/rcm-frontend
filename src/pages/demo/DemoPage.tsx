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
    if (!form.name.trim()) nextErrors.name = 'Tell us who you are.';
    if (!form.workEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.workEmail)) nextErrors.workEmail = 'Enter a work email.';
    if (!form.organization.trim()) nextErrors.organization = 'Add your clinic or company.';
    if (!form.role) nextErrors.role = 'Pick a role.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) setSubmitted(true);
  };

  return (
    <main className="demo-page">
      <header className="demo-chrome">
        <Link href="/" data-testid="link-demo-home">
          <Brand />
        </Link>
        <button className="back-link" type="button" data-testid="button-demo-back" onClick={() => setLocation('/')}>
          Return home
        </button>
      </header>

      <section className="demo-banner">
        <p className="demo-kicker">30 minutes</p>
        <h1>Book a working session.</h1>
        <p>Bring one unpaid pile — a denial, a short pay, or a coverage gap. We walk the desk, not a slide deck.</p>
        <ul className="demo-assurance">
          <li className="assurance-row">
            <Check size={16} /> Live product, not slides
          </li>
          <li className="assurance-row">
            <Check size={16} /> Bring a real billing question
          </li>
          <li className="assurance-row">
            <Check size={16} /> Front desk, coding, or billing
          </li>
        </ul>
      </section>

      <section className="booking-card">
        {submitted ? (
          <div className="confirmation" data-testid="status-booking-confirmation">
            <div className="confirmation-mark">
              <Check size={29} />
            </div>
            <h2>We saved you a seat.</h2>
            <p>Your session is requested for the time below. Someone from Velora will follow up.</p>
            <div className="confirmation-detail">
              {currentDate.weekday}, {currentDate.month} {currentDate.day} · {selectedTime}
              <strong>{form.workEmail}</strong>
            </div>
            <Link className="button-secondary" href="/" data-testid="link-confirmation-home">
              Return home <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate data-testid="form-demo-booking">
            <div className="booking-step">
              <strong>Pick a day and time</strong>
              <span className="step-count">Then tell us who is joining</span>
            </div>
            <label className="form-label" htmlFor="date-selection">
              Day
            </label>
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
            <span className="form-label">Time</span>
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
                <label className="form-label" htmlFor="demo-name">
                  Your name
                </label>
                <input
                  id="demo-name"
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                  data-testid="input-demo-name"
                />
                {errors.name ? (
                  <div className="field-error" data-testid="error-demo-name">
                    {errors.name}
                  </div>
                ) : null}
              </div>
              <div className="field">
                <label className="form-label" htmlFor="demo-email">
                  Work email
                </label>
                <input
                  id="demo-email"
                  type="email"
                  value={form.workEmail}
                  onChange={(event) => updateField('workEmail', event.target.value)}
                  placeholder="you@clinic.com"
                  autoComplete="email"
                  data-testid="input-demo-email"
                />
                {errors.workEmail ? (
                  <div className="field-error" data-testid="error-demo-email">
                    {errors.workEmail}
                  </div>
                ) : null}
              </div>
              <div className="field">
                <label className="form-label" htmlFor="demo-organization">
                  Clinic or company
                </label>
                <input
                  id="demo-organization"
                  value={form.organization}
                  onChange={(event) => updateField('organization', event.target.value)}
                  placeholder="Hospital or clinic name"
                  autoComplete="organization"
                  data-testid="input-demo-organization"
                />
                {errors.organization ? (
                  <div className="field-error" data-testid="error-demo-organization">
                    {errors.organization}
                  </div>
                ) : null}
              </div>
              <div className="field">
                <label className="form-label" htmlFor="demo-role">
                  Your role
                </label>
                <select
                  id="demo-role"
                  value={form.role}
                  onChange={(event) => updateField('role', event.target.value)}
                  data-testid="select-demo-role"
                >
                  <option value="">Select role</option>
                  <option value="CFO / finance">Finance</option>
                  <option value="RCM operator">Biller</option>
                  <option value="Operations leader">Front desk / ops</option>
                  <option value="Technology leader">IT</option>
                  <option value="BPO partner">Partner</option>
                </select>
                {errors.role ? (
                  <div className="field-error" data-testid="error-demo-role">
                    {errors.role}
                  </div>
                ) : null}
              </div>
              <div className="field full">
                <label className="form-label" htmlFor="demo-notes">
                  What should we look at?
                </label>
                <input
                  id="demo-notes"
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  placeholder="Optional — a denial, a short pay, a coverage gap"
                  data-testid="input-demo-notes"
                />
              </div>
            </div>
            <button className="button-primary form-submit" type="submit" data-testid="button-submit-demo">
              Request this session <ArrowRight size={16} />
            </button>
            <p className="form-disclaimer">We only use these details to set up this conversation.</p>
          </form>
        )}
      </section>
    </main>
  );
}
