import Icon from './Icon';
import { clock, timeLeft, STATUS_LABEL, DIET_LABEL } from '../lib/format';

// One row on the pickup board. The left column is the deadline: that's the
// number people scan for, so it gets the space.
export default function Ticket({ d, now, children, showRestaurant = true }) {
  const active = ['available', 'reserved', 'partially_collected'].includes(d.status);
  const start = new Date(d.confirmedAt || d.createdAt).getTime();
  const end = new Date(d.pickupDeadline).getTime();
  const remainingFrac = active ? Math.max(0, Math.min(1, (end - now) / Math.max(1, end - start))) : 0;
  const urgent = active && end - now < 60 * 60000;
  const qty = d.status === 'partially_collected' ? d.remainingQuantity : d.quantity;

  return (
    <article className={`ticket ticket--${d.status} ${urgent ? 'is-urgent' : ''}`}>
      <div className="ticket__time">
        <span className="ticket__by">{active ? 'Pick up by' : STATUS_LABEL[d.status]}</span>
        <span className="ticket__clock">{clock(d.pickupDeadline)}</span>
        {active && <span className="ticket__left">{timeLeft(d.pickupDeadline, now)}</span>}
        {active && (
          <span className="ticket__drain" aria-hidden="true">
            <span style={{ transform: `scaleX(${remainingFrac})` }} />
          </span>
        )}
      </div>

      <div className="ticket__body">
        <div className="ticket__head">
          <h3 className="ticket__food">{d.foodName}</h3>
          {d.status !== 'available' && active && <span className={`tag tag--${d.status}`}>{STATUS_LABEL[d.status]}</span>}
        </div>
        <p className="ticket__qty">
          <strong>{qty} {d.unit}</strong>
          {d.status === 'partially_collected' && <span className="muted"> left of {d.quantity}</span>}
          {d.diet && d.diet !== 'unknown' && <span className={`diet diet--${d.diet}`}>{DIET_LABEL[d.diet]}</span>}
        </p>
        <p className="ticket__meta">
          {d.preparedAt && <>Cooked at {clock(d.preparedAt)}</>}
          {d.storageCondition && <>{d.preparedAt ? ', ' : ''}{d.storageCondition}</>}
          {d.allergens?.length > 0 && <>. Contains {d.allergens.join(', ')}</>}
        </p>
        {showRestaurant && (
          <p className="ticket__place">
            <Icon name="pin" size={15} />
            <span><strong>{d.restaurantName}</strong>, {d.location}</span>
          </p>
        )}
        {d.notes && <p className="ticket__note">{d.notes}</p>}
        {children && <div className="ticket__actions">{children}</div>}
      </div>
    </article>
  );
}
