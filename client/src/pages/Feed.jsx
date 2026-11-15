import { useCallback, useEffect, useState } from 'react';
import Shell from '../components/Shell';
import Ticket from '../components/Ticket';
import ListenButton from '../components/ListenButton';
import Icon from '../components/Icon';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { CATEGORY_LABEL, telLink, prettyPhone } from '../lib/format';

const WITHIN = [
  { v: '', label: 'Any time today' },
  { v: '1', label: 'Within 1 hour' },
  { v: '3', label: 'Within 3 hours' },
  { v: '6', label: 'Within 6 hours' },
];

export default function Feed() {
  const { user, profile } = useAuth();
  const [filters, setFilters] = useState({ q: '', area: '', category: 'all', diet: 'all', within: '', minQty: '' });
  const [data, setData] = useState({ donations: null, areas: [] });
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [showFilters, setShowFilters] = useState(false);
  const activeCount = ['q', 'area', 'within', 'minQty'].filter((k) => filters[k]).length
    + (filters.category !== 'all' ? 1 : 0) + (filters.diet !== 'all' ? 1 : 0);

  const load = useCallback(async () => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v && v !== 'all'));
    try {
      const res = await api(`/donations?${params}`);
      setData(res);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, filters.q ? 300 : 0);
    const poll = setInterval(load, 60000);
    return () => { clearTimeout(t); clearInterval(poll); };
  }, [load, filters.q]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const list = data.donations;
  const myArea = profile?.area;

  return (
    <Shell wide>
      <div className="feed">
        <aside className="filters" aria-label="Filter listings">
          <h1 className="page__title page__title--sm">{user.role === 'restaurant' ? 'Live board' : 'Food near you'}</h1>
          <p className="muted filters__lede">Sorted by pickup time. Always call before you go.</p>
          <button type="button" className="btn btn--ghost btn--sm filters__toggle" aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}>
            {showFilters ? 'Hide filters' : `Filters${activeCount ? ` (${activeCount})` : ''}`}
          </button>
          <div className={`filters__body ${showFilters ? 'is-open' : ''}`}>

          <label className="field">
            <span className="field__label">Search</span>
            <input value={filters.q} onChange={set('q')} placeholder="Biryani, a restaurant name…" />
          </label>

          <label className="field">
            <span className="field__label">Area</span>
            <select value={filters.area} onChange={set('area')}>
              <option value="">All areas</option>
              {myArea && !data.areas.includes(myArea) && <option value={myArea}>{myArea} (yours)</option>}
              {data.areas.map((a) => <option key={a} value={a}>{a}{a === myArea ? ' (yours)' : ''}</option>)}
            </select>
          </label>

          <div className="field">
            <span className="field__label">Type</span>
            <div className="chips">
              {[['all', 'All'], ...Object.entries(CATEGORY_LABEL).filter(([k]) => ['cooked_meal', 'bakery', 'snacks', 'raw_produce', 'beverages'].includes(k))].map(([k, v]) => (
                <button type="button" key={k} className={`chip ${filters.category === k ? 'is-on' : ''}`} onClick={() => setFilters((f) => ({ ...f, category: k }))}>{v}</button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="field__label">Diet</span>
            <div className="chips">
              {[['all', 'Any'], ['veg', 'Veg only'], ['non_veg', 'Non-veg']].map(([k, v]) => (
                <button type="button" key={k} className={`chip ${filters.diet === k ? 'is-on' : ''}`} onClick={() => setFilters((f) => ({ ...f, diet: k }))}>{v}</button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="field__label">Pickup deadline</span>
            <select value={filters.within} onChange={set('within')}>
              {WITHIN.map((w) => <option key={w.v} value={w.v}>{w.label}</option>)}
            </select>
          </label>

          <label className="field">
            <span className="field__label">At least</span>
            <input type="number" min="1" value={filters.minQty} onChange={set('minQty')} placeholder="Any quantity" />
          </label>
          </div>
        </aside>

        <section className="board" aria-live="polite">
          {error && <p className="msg msg--error">{error}</p>}
          {list === null ? (
            <div className="skeleton" />
          ) : list.length === 0 ? (
            <div className="empty">
              <p><strong>No food listed that matches.</strong></p>
              <p className="muted">Listings appear here as soon as a restaurant publishes one. Try clearing filters, or check back around lunch and dinner closing times.</p>
            </div>
          ) : (
            list.map((d) => (
              <Ticket key={d._id} d={d} now={now}>
                <a className="btn btn--primary btn--sm" href={telLink(d.contactNumber)}>
                  <Icon name="phone" size={16} /> Call {d.contactPerson?.split(' ')[0] || 'restaurant'}
                </a>
                <span className="ticket__phone">{prettyPhone(d.contactNumber)}</span>
                <ListenButton src={d.audioUrl} />
                {d.status === 'reserved' && <span className="muted ticket__hint">Someone has asked the restaurant to hold this. Call to check if any is left.</span>}
              </Ticket>
            ))
          )}
          {list?.length > 0 && (
            <p className="board__foot muted">
              FoodVaani doesn't check food safety. Confirm ingredients, allergens and timing with the restaurant when you call.
            </p>
          )}
        </section>
      </div>
    </Shell>
  );
}
