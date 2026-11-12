import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../lib/api';

// Global auth state (Context API): current user + login/signup/logout
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTok] = useState(getToken());
  const [loading, setLoading] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setTok(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  // Restore session on page load
  useEffect(() => {
    if (!token) return setLoading(false);
    api
      .get('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [token, logout]);

  const start = ({ token: t, user: u }) => {
    setToken(t);
    setUser(u);
    setTok(t);
  };

  const login = async (email, password) => start(await api.post('/auth/login', { email, password }));
  const signup = async (name, email, password) => start(await api.post('/auth/signup', { name, email, password }));
  const refresh = async () => setUser((await api.get('/auth/me')).user);

  const value = {
    user,
    token,
    loading,
    login,
    signup,
    logout,
    refresh,
    setUser,
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'admin' || user?.role === 'mentor',
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
