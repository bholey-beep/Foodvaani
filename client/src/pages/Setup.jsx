import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Shell';
import { api } from '../lib/api';
import { useAuth, homeFor } from '../lib/auth';
import { LANGUAGES, prettyPhone } from '../lib/format';

const ROLES = [
  { id: 'restaurant', title: 'Restaurant or hotel', text: 'I have surplus food to give away.' },
  { id: 'recipient', title: 'Individual', text: 'I want to find food to collect for myself or my family.' },
  { id: 'ngo', title: 'NGO or community group', text: 'We collect food for people we serve.' },
];

const FORMS = {
  restaurant: [
    { name: 'hotelName', label: 'Restaurant or hotel name', placeholder: 'Sharma Bhojnalaya' },
    { name: 'ownerName', label: 'Owner or contact name', placeholder: 'Rahul Sharma' },
    { name: 'address', label: 'Pickup address', placeholder: 'Shop 4, near NIT main gate, Anu', hint: 'This is attached to every listing, so people know where to come.' },
    { name: 'area', label: 'Area or locality', placeholder: 'NIT Hamirpur', hint: 'People filter the board by this.' },
    { name: 'fssaiNumber', label: 'FSSAI licence number', optional: true },
    { name: 'preferredLanguage', label: 'Language you usually speak in', type: 'select' },
  ],
  recipient: [
    { name: 'name', label: 'Your name' },
    { name: 'area', label: 'Area or locality', placeholder: 'Bus Stand, Hamirpur' },
  ],
  ngo: [
    { name: 'orgName', label: 'Organisation name' },
    { name: 'contactPerson', label: 'Contact person' },
    { name: 'area', label: 'Area you operate in', placeholder: 'Hamirpur town' },
    { name: 'address', label: 'Office address', optional: true },
    { name: 'registrationNumber', label: 'Registration number', optional: true, hint: 'Trust, society or Section 8 registration, if you have one.' },
  ],
};

export default function Setup({ editing }) {
  const { user, profile, setSession } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState(user.role || null);
  const [values, setValues] = useState(() => ({ preferredLanguage: 'hi-IN', ...(profile || {}) }));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (name) => (e) => {
    setValues((v) => ({ ...v, [name]: e.target.value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
    setSaved(false);
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { role };
      for (const f of FORMS[role]) body[f.name] = values[f.name] || '';
      const res = await api('/profile', { method: 'PUT', body });
      setSession(res.user, res.profile);
      if (editing) setSaved(true);
      else navigate(homeFor(res.user), { replace: true });
    } catch (err) {
      setErrors(err.data?.errors || {});
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="narrow">
        <h1 className="page__title">{editing ? 'Your profile' : 'Set up your account'}</h1>
        <p className="muted">Signed in as {prettyPhone(user.mobileNumber)}. This number is verified{role === 'restaurant' ? ' and shown on your listings for people to call' : ''}.</p>

        {!user.role && (
          <fieldset className="roles">
            <legend className="field__label">Who are you?</legend>
            {ROLES.map((r) => (
              <label key={r.id} className={`role ${role === r.id ? 'is-on' : ''}`}>
                <input type="radio" name="role" value={r.id} checked={role === r.id} onChange={() => setRole(r.id)} />
                <span className="role__title">{r.title}</span>
                <span className="role__text">{r.text}</span>
              </label>
            ))}
          </fieldset>
        )}

        {role && (
          <form className="form" onSubmit={submit} noValidate>
            {FORMS[role].map((f) => (
              <label key={f.name} className={`field ${errors[f.name] ? 'has-error' : ''}`}>
                <span className="field__label">{f.label}{f.optional && <span className="field__opt"> (optional)</span>}</span>
                {f.type === 'select' ? (
                  <select value={values[f.name] || ''} onChange={set(f.name)}>
                    {LANGUAGES.filter((l) => l.code !== 'indic-auto').map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                ) : (
                  <input value={values[f.name] || ''} onChange={set(f.name)} placeholder={f.placeholder} />
                )}
                {errors[f.name] ? <span className="field__error">{errors[f.name]}</span> : f.hint && <span className="field__hint">{f.hint}</span>}
              </label>
            ))}
            {error && !Object.keys(errors).length && <p className="msg msg--error">{error}</p>}
            {saved && <p className="msg msg--ok">Profile saved.</p>}
            <button className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Continue'}</button>
          </form>
        )}
      </div>
    </Shell>
  );
}
