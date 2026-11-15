import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth, homeFor } from '../lib/auth';
import { Logo } from '../components/Shell';

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('phone');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef(null);

  useEffect(() => {
    if (!cooldown) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function requestCode(e) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api('/auth/request-otp', { method: 'POST', body: { mobileNumber: mobile } });
      setDevCode(res.devCode || '');
      setStep('code');
      setCooldown(30);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token, user, profile } = await api('/auth/verify-otp', { method: 'POST', body: { mobileNumber: mobile, code } });
      signIn(token, user, profile);
      navigate(homeFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__panel">
        <Link to="/" className="auth__logo"><Logo /></Link>

        {step === 'phone' ? (
          <form onSubmit={requestCode} noValidate>
            <h1 className="auth__title">Sign in</h1>
            <p className="muted">We'll text a 6 digit code to your phone. New here? The same step creates your account.</p>
            <label className="field">
              <span className="field__label">Mobile number</span>
              <div className="phone-input">
                <span className="phone-input__cc">+91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  placeholder="98765 43210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  autoFocus
                />
              </div>
            </label>
            {error && <p className="msg msg--error" role="alert">{error}</p>}
            <button className="btn btn--primary btn--block" disabled={busy || mobile.length !== 10}>
              {busy ? 'Sending code…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verify} noValidate>
            <h1 className="auth__title">Enter the code</h1>
            <p className="muted">
              Sent to +91 {mobile.slice(0, 5)} {mobile.slice(5)}.{' '}
              <button type="button" className="linkbtn" onClick={() => { setStep('phone'); setCode(''); setError(''); }}>Change number</button>
            </p>
            {devCode && (
              <p className="devnote">Demo mode: your code is <strong>{devCode}</strong></p>
            )}
            <label className="field">
              <span className="field__label">6 digit code</span>
              <input
                ref={codeRef}
                className="otp-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </label>
            {error && <p className="msg msg--error" role="alert">{error}</p>}
            <button className="btn btn--primary btn--block" disabled={busy || code.length !== 6}>
              {busy ? 'Checking…' : 'Verify and continue'}
            </button>
            <button type="button" className="linkbtn auth__resend" disabled={cooldown > 0 || busy} onClick={requestCode}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
          </form>
        )}
      </div>
      <aside className="auth__aside" aria-hidden="true">
        <p lang="hi">“बीस डिब्बे दाल चावल, रात नौ बजे तक।”</p>
        <p>One sentence is a whole listing.</p>
      </aside>
    </div>
  );
}
