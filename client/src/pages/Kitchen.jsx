import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Ticket from '../components/Ticket';
import ListenButton from '../components/ListenButton';
import Icon from '../components/Icon';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ago, STATUS_LABEL } from '../lib/format';

const ACTIVE = ['available', 'reserved', 'partially_collected'];

export default function Kitchen() {
  const { profile } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const { donations } = await api('/donations/mine');
      setItems(donations);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 60000);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [load]);

  const replace = (d) => setItems((list) => list.map((x) => (x._id === d._id ? d : x)));
  const active = (items || []).filter((d) => ACTIVE.includes(d.status));
  const past = (items || []).filter((d) => !ACTIVE.includes(d.status));

  return (
    <Shell>
      <div className="kitchen__head">
        <div>
          <h1 className="page__title">{profile?.hotelName}</h1>
          <p className="muted">{profile?.address}</p>
        </div>
        <Link to="/kitchen/new" className="btn btn--primary btn--lg btn--mic">
          <Icon name="mic" size={20} /> Add surplus food
        </Link>
      </div>

      {error && <p className="msg msg--error">{error}</p>}

      <section className="board">
        <h2 className="section-title">On the board now {active.length > 0 && <span className="count">{active.length}</span>}</h2>
        {items === null ? (
          <div className="skeleton" />
        ) : active.length === 0 ? (
          <div className="empty">
            <p><strong>Nothing listed right now.</strong></p>
            <p className="muted">When you have food left over, tap Add surplus food and say what you have. It takes under a minute.</p>
          </div>
        ) : (
          active.map((d) => (
            <Ticket key={d._id} d={d} now={now} showRestaurant={false}>
              <StatusControls d={d} onChange={replace} />
              <ListenButton src={d.audioUrl} compact />
            </Ticket>
          ))
        )}
      </section>

      {past.length > 0 && (
        <section className="history">
          <h2 className="section-title">Earlier</h2>
          <table className="history__table">
            <thead>
              <tr><th>Food</th><th>Quantity</th><th>Outcome</th><th>Listed</th></tr>
            </thead>
            <tbody>
              {past.map((d) => (
                <tr key={d._id}>
                  <td>{d.foodName}</td>
                  <td>{d.quantity} {d.unit}</td>
                  <td><span className={`tag tag--${d.status}`}>{STATUS_LABEL[d.status]}</span></td>
                  <td className="muted">{ago(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </Shell>
  );
}

function StatusControls({ d, onChange }) {
  const [partial, setPartial] = useState(false);
  const [left, setLeft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function update(status, extra = {}) {
    if (status === 'expired' && !window.confirm('Take this listing off the board?')) return;
    setBusy(true);
    setError('');
    try {
      const { donation } = await api(`/donations/${d._id}/status`, { method: 'PATCH', body: { status, ...extra } });
      onChange(donation);
      setPartial(false);
      setLeft('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (partial) {
    return (
      <form className="partial" onSubmit={(e) => { e.preventDefault(); update('partially_collected', { remainingQuantity: Number(left) }); }}>
        <label>
          How many {d.unit} are left?
          <input type="number" min="1" max={d.remainingQuantity - 1} value={left} onChange={(e) => setLeft(e.target.value)} autoFocus />
        </label>
        <button className="btn btn--primary btn--sm" disabled={busy || !left}>Update</button>
        <button type="button" className="linkbtn" onClick={() => setPartial(false)}>Cancel</button>
        {error && <span className="field__error">{error}</span>}
      </form>
    );
  }

  return (
    <div className="controls">
      {d.status === 'reserved' ? (
        <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => update('available')}>Make available again</button>
      ) : (
        <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => update('reserved')}>Someone's coming</button>
      )}
      <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => setPartial(true)}>Some taken</button>
      <button className="btn btn--dark btn--sm" disabled={busy} onClick={() => update('collected')}>All collected</button>
      <button className="linkbtn linkbtn--quiet" disabled={busy} onClick={() => update('expired')}>Withdraw</button>
      {error && <span className="field__error">{error}</span>}
    </div>
  );
}
