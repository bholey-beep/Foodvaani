import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, profile: null });

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setState({ loading: false, user: null, profile: null });
      return;
    }
    try {
      const { user, profile } = await api('/auth/me');
      setState({ loading: false, user, profile });
    } catch {
      setState({ loading: false, user: null, profile: null });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signIn = (token, user, profile) => {
    tokenStore.set(token);
    setState({ loading: false, user, profile });
  };
  const setSession = (user, profile) => setState((s) => ({ ...s, user, profile }));
  const signOut = () => {
    tokenStore.set(null);
    setState({ loading: false, user: null, profile: null });
  };

  return <AuthContext.Provider value={{ ...state, signIn, signOut, setSession, refresh }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function homeFor(user) {
  if (!user) return '/login';
  if (!user.profileComplete) return '/setup';
  return user.role === 'restaurant' ? '/kitchen' : '/feed';
}
