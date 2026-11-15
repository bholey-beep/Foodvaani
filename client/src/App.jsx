import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, homeFor } from './lib/auth';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Kitchen from './pages/Kitchen';
import NewListing from './pages/NewListing';
import Feed from './pages/Feed';

function Guard({ children, role, needsProfile = true }) {
  const { loading, user } = useAuth();
  if (loading) return <div className="boot" aria-busy="true" />;
  if (!user) return <Navigate to="/login" replace />;
  if (needsProfile && !user.profileComplete) return <Navigate to="/setup" replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
}

export default function App() {
  const { loading, user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={!loading && user ? <Navigate to={homeFor(user)} replace /> : <Login />} />
      <Route path="/setup" element={<Guard needsProfile={false}><Setup /></Guard>} />
      <Route path="/profile" element={<Guard><Setup editing /></Guard>} />
      <Route path="/kitchen" element={<Guard role="restaurant"><Kitchen /></Guard>} />
      <Route path="/kitchen/new" element={<Guard role="restaurant"><NewListing /></Guard>} />
      <Route path="/feed" element={<Guard><Feed /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
