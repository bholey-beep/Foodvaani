import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth, homeFor } from '../lib/auth';
import Icon from './Icon';

export function Logo({ light }) {
  return (
    <span className={`logo ${light ? 'logo--light' : ''}`}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={light ? '#F2B705' : '#14301F'} />
        <path d="M9 13c0 4 3 7 7 7s7-3 7-7" stroke={light ? '#14301F' : '#F2B705'} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <rect x="13" y="6" width="6" height="10" rx="3" fill={light ? '#14301F' : '#F2B705'} />
        <path d="M16 20v5" stroke={light ? '#14301F' : '#F2B705'} strokeWidth="2.6" strokeLinecap="round" />
      </svg>
      FoodVaani
    </span>
  );
}

export default function Shell({ children, wide }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const name = profile?.hotelName || profile?.orgName || profile?.name;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar__inner">
          <Link to={user ? homeFor(user) : '/'} className="topbar__brand"><Logo /></Link>
          {user?.profileComplete && (
            <nav className="topbar__nav">
              {user.role === 'restaurant' ? (
                <>
                  <NavLink to="/kitchen" end>Your listings</NavLink>
                  <NavLink to="/feed">Live board</NavLink>
                </>
              ) : (
                <NavLink to="/feed">Food near you</NavLink>
              )}
              <NavLink to="/profile">Profile</NavLink>
            </nav>
          )}
          {user && (
            <div className="topbar__who">
              {name && <span className="topbar__name">{name}</span>}
              <button
                className="iconbtn"
                onClick={() => { signOut(); navigate('/'); }}
                title="Sign out"
              >
                <Icon name="logout" size={18} label="Sign out" />
              </button>
            </div>
          )}
        </div>
      </header>
      <main className={`page ${wide ? 'page--wide' : ''}`}>{children}</main>
    </div>
  );
}
