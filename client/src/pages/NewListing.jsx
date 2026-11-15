import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Recorder from '../components/Recorder';
import ListenButton from '../components/ListenButton';
import Icon from '../components/Icon';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { LANGUAGES, CATEGORY_LABEL, DIET_LABEL, clock, languageName } from '../lib/format';

const EMPTY = {
  foodName: '', quantity: '', unit: '', category: 'cooked_meal', diet: 'unknown',
  preparedAt: '', pickupDeadline: '', storageCondition: '', allergens: '', notes: '', location: '',
};

const UNITS = ['plates', 'meal boxes', 'boxes', 'kg', 'litres', 'packets', 'portions', 'pieces', 'trays'];
const STORAGE = ['kept hot', 'refrigerated', 'room temperature', 'covered'];

function toForm(draft, profile) {
  return {
    ...EMPTY,
    ...Object.fromEntries(Object.entries(draft || {}).filter(([, v]) => v !== null && v !== undefined)),
    allergens: Array.isArray(draft?.allergens) ? draft.allergens.join(', ') : draft?.allergens || '',
    location: draft?.location || profile?.address || '',
    quantity: draft?.quantity ?? '',
    diet: draft?.diet || 'unknown',
    category: draft?.category || 'cooked_meal',
  };
}

export default function NewListing() {
  const { profile } = useAuth();
  const [mode, setMode] = useState('voice'); // voice | type
  const [stage, setStage] = useState('record'); // record | transcribing | review | done
  const [language, setLanguage] = useState('indic-auto');
  const [transcript, setTranscript] = useState('');
  const [spokenLanguage, setSpokenLanguage] = useState(null);
  const [engine, setEngine] = useState(null);
  const [form, setForm] = useState(() => toForm(null, profile));
  const [missing, setMissing] = useState([]);
  const [check, setCheck] = useState({ errors: {}, warnings: [] });
  const [touched, setTouched] = useState({});
  const [audioLanguage, setAudioLanguage] = useState(profile?.preferredLanguage === 'en-IN' ? 'en-IN' : 'hi-IN');
  const [declared, setDeclared] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [published, setPublished] = useState(null);
  const validateTimer = useRef(null);

  // live validation while the owner edits the preview
  useEffect(() => {
    if (stage !== 'review') return undefined;
    clearTimeout(validateTimer.current);
    validateTimer.current = setTimeout(async () => {
      try {
        const res = await api('/donations/validate', { method: 'POST', body: { draft: form } });
        setCheck({ errors: res.errors, warnings: res.warnings });
      } catch { /* keep last result */ }
    }, 450);
    return () => clearTimeout(validateTimer.current);
  }, [form, stage]);

  async function handleRecorded(blob) {
    setError('');
    setStage('transcribing');
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'announcement.wav');
      fd.append('language', language);
      const res = await api('/voice/transcribe', { method: 'POST', form: fd });
      setTranscript(res.transcript);
      setSpokenLanguage(res.language);
      if (res.language === 'en-IN') setAudioLanguage('en-IN');
      if (res.language === 'hi-IN') setAudioLanguage('hi-IN');
      await runExtraction(res.transcript);
    } catch (err) {
      setError(err.message);
      setStage('record');
    }
  }

  async function runExtraction(text) {
    setBusy(true);
    setError('');
    try {
      const res = await api('/voice/extract', { method: 'POST', body: { transcript: text } });
      setForm(toForm(res.draft, profile));
      setMissing(res.missingFields);
      setEngine(res.engine);
      setCheck({ errors: res.validation.errors, warnings: res.validation.warnings });
      setTouched({});
      setStage('review');
    } catch (err) {
      setError(err.message);
      if (stage !== 'review') setStage('record');
    } finally {
      setBusy(false);
    }
  }

  function startTyping() {
    setMode('type');
    setForm(toForm(null, profile));
    setMissing([]);
    setTranscript('');
    setStage('review');
  }

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setTouched((t) => ({ ...t, [name]: true }));
  };

  async function publish(e) {
    e.preventDefault();
    setTouched(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, true])));
    if (!declared) {
      setError('Tick the declaration to confirm the food is fit to give away.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api('/donations', {
        method: 'POST',
        body: {
          draft: form,
          ownerDeclaration: true,
          source: mode === 'voice' && transcript ? 'voice' : 'manual',
          transcription: transcript,
          language: spokenLanguage || profile?.preferredLanguage,
          audioLanguage,
          extractionEngine: engine,
        },
      });
      setPublished(res.donation);
      setStage('done');
      window.scrollTo({ top: 0 });
    } catch (err) {
      setCheck((c) => ({ ...c, errors: err.data?.errors || c.errors }));
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function retryAudio() {
    setBusy(true);
    try {
      const res = await api(`/donations/${published._id}/audio`, { method: 'POST', body: { language: audioLanguage } });
      setPublished(res.donation);
    } catch (err) {
      setPublished((p) => ({ ...p, audioError: err.message }));
    } finally {
      setBusy(false);
    }
  }

  // Show an error once the user has touched the field, or immediately if the AI could not find it
  const err = (name) => (touched[name] || (missing.includes(name) && form[name] === '') ? check.errors[name] : null);
  const isMissing = (name) => missing.includes(name) && !touched[name] && (form[name] === '' || form[name] === null);

  if (stage === 'done' && published) {
    return (
      <Shell>
        <div className="narrow done">
          <span className="done__tick"><Icon name="check" size={30} /></span>
          <h1 className="page__title">Published</h1>
          <p className="muted">
            {published.quantity} {published.unit} of {published.foodName} is on the board until {clock(published.pickupDeadline)}.
            People can call you on your verified number.
          </p>
          <div className="done__audio">
            {published.audioUrl ? (
              <>
                <p>This is what people will hear:</p>
                <ListenButton src={published.audioUrl} />
              </>
            ) : (
              <>
                <p className="msg msg--warn">The listing is live, but the audio version could not be made: {published.audioError}</p>
                <button className="btn btn--ghost" onClick={retryAudio} disabled={busy}><Icon name="refresh" size={16} /> {busy ? 'Trying again…' : 'Try audio again'}</button>
              </>
            )}
          </div>
          <div className="row gap">
            <Link to="/kitchen" className="btn btn--primary">Back to your listings</Link>
            <button className="btn btn--ghost" onClick={() => { setPublished(null); setDeclared(false); setTranscript(''); setStage('record'); setMode('voice'); }}>Add another</button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="narrow">
        <Link to="/kitchen" className="back"><Icon name="back" size={16} /> Your listings</Link>
        <h1 className="page__title">Add surplus food</h1>

        {stage !== 'review' && (
          <section className="speak">
            <div className="speak__lang">
              <label className="field field--inline">
                <span className="field__label">You'll speak in</span>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={stage === 'transcribing'}>
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </label>
            </div>

            {stage === 'transcribing' ? (
              <div className="working">
                <span className="spinner" />
                <div>
                  <p className="working__title">{busy ? 'Picking out the details…' : 'Turning your voice into text…'}</p>
                  <p className="muted">Usually takes a few seconds.</p>
                </div>
              </div>
            ) : (
              <Recorder onRecorded={handleRecorded} />
            )}

            <p className="speak__example">
              For example: <q>We have 20 meal boxes of veg pulao, cooked at 1 pm, kept hot. Please pick up before 7 pm.</q>
            </p>
            {error && <p className="msg msg--error" role="alert">{error}</p>}
            <button type="button" className="linkbtn speak__type" onClick={startTyping}>
              <Icon name="keyboard" size={16} /> Type the details instead
            </button>
          </section>
        )}

        {stage === 'review' && (
          <form className="review" onSubmit={publish} noValidate>
            {transcript && (
              <section className="transcript">
                <div className="transcript__head">
                  <span>What we heard{spokenLanguage ? ` (${languageName(spokenLanguage)})` : ''}</span>
                  <button type="button" className="linkbtn" onClick={() => { setStage('record'); setError(''); }}>Record again</button>
                </div>
                <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={3} />
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => runExtraction(transcript)} disabled={busy}>
                  {busy ? 'Reading…' : 'Fill the form again from this text'}
                </button>
              </section>
            )}

            {missing.length > 0 && (
              <p className="msg msg--warn">
                <Icon name="alert" size={16} /> You didn't mention {missing.map((m) => FIELD_NAMES[m]).join(', ')}. Fill {missing.length > 1 ? 'these' : 'it'} in below.
              </p>
            )}

            <div className="grid2">
              <Field label="Food" error={err('foodName')} missing={isMissing('foodName')} wide>
                <input value={form.foodName} onChange={set('foodName')} placeholder="Vegetable biryani" />
              </Field>
              <Field label="Quantity" error={err('quantity')} missing={isMissing('quantity')}>
                <input type="number" min="1" inputMode="decimal" value={form.quantity} onChange={set('quantity')} />
              </Field>
              <Field label="Unit" error={err('unit')} missing={isMissing('unit')}>
                <input list="units" value={form.unit} onChange={set('unit')} placeholder="plates" />
                <datalist id="units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
              </Field>
              <Field label="Cooked at" error={err('preparedAt')} missing={isMissing('preparedAt')}>
                <input type="time" value={form.preparedAt} onChange={set('preparedAt')} />
              </Field>
              <Field label="Pick up before" error={err('pickupDeadline')} missing={isMissing('pickupDeadline')}>
                <input type="time" value={form.pickupDeadline} onChange={set('pickupDeadline')} />
              </Field>
              <Field label="How it's stored" missing={isMissing('storageCondition')}>
                <input list="storage" value={form.storageCondition} onChange={set('storageCondition')} placeholder="kept hot" />
                <datalist id="storage">{STORAGE.map((u) => <option key={u} value={u} />)}</datalist>
              </Field>
              <Field label="Veg or non-veg">
                <select value={form.diet} onChange={set('diet')}>
                  {Object.entries(DIET_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Type">
                <select value={form.category} onChange={set('category')}>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Contains (allergens)" hint="Comma separated, e.g. dairy, nuts">
                <input value={form.allergens} onChange={set('allergens')} />
              </Field>
              <Field label="Pickup address" error={err('location')} wide hint="From your profile. Change it here for this listing only.">
                <input value={form.location} onChange={set('location')} />
              </Field>
              <Field label="Note for people collecting" wide>
                <input value={form.notes} onChange={set('notes')} placeholder="Bring your own container, ask at the counter" />
              </Field>
            </div>

            {check.warnings.length > 0 && (
              <ul className="warnings">{check.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            )}

            <fieldset className="audio-lang">
              <legend className="field__label">Read the listing aloud in</legend>
              {[['hi-IN', 'Hindi'], ['en-IN', 'English']].map(([code, label]) => (
                <label key={code} className={`chip ${audioLanguage === code ? 'is-on' : ''}`}>
                  <input type="radio" name="al" checked={audioLanguage === code} onChange={() => setAudioLanguage(code)} />
                  {label}
                </label>
              ))}
            </fieldset>

            <label className={`declare ${declared ? 'is-on' : ''}`}>
              <input type="checkbox" checked={declared} onChange={(e) => { setDeclared(e.target.checked); setError(''); }} />
              <span>
                This is clean surplus that was never served to a customer. It has been handled and stored properly,
                and I'm responsible for it being fit to give away.
              </span>
            </label>

            {error && <p className="msg msg--error" role="alert">{error}</p>}

            <div className="review__actions">
              <button className="btn btn--primary btn--lg" disabled={busy}>{busy ? 'Publishing…' : 'Publish listing'}</button>
              {mode === 'type' && <button type="button" className="linkbtn" onClick={() => { setMode('voice'); setStage('record'); }}>Use voice instead</button>}
            </div>
          </form>
        )}
      </div>
    </Shell>
  );
}

const FIELD_NAMES = {
  foodName: 'the food', quantity: 'the quantity', unit: 'the unit', preparedAt: 'when it was cooked',
  pickupDeadline: 'the pickup time', storageCondition: 'how it is stored',
};

function Field({ label, error, missing, hint, wide, children }) {
  return (
    <label className={`field ${wide ? 'field--wide' : ''} ${error ? 'has-error' : ''} ${missing ? 'is-missing' : ''}`}>
      <span className="field__label">{label}{missing && <span className="field__flag">Not mentioned</span>}</span>
      {children}
      {error ? <span className="field__error">{error}</span> : hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}
