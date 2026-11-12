import { createContext, useContext, useEffect, useState } from 'react';

// Global app settings shared across pages via the Context API
const SettingsContext = createContext(null);
export const useSettings = () => useContext(SettingsContext);

const load = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
};
const save = (key, val) => {
  try {
    localStorage.setItem(key, val);
  } catch {
    /* storage unavailable */
  }
};

export function SettingsProvider({ children }) {
  const [theme, setTheme] = useState(() => load('cb-theme', 'dark'));
  const [language, setLanguage] = useState(() => load('cb-lang', 'python'));
  const [level, setLevel] = useState(() => load('cb-level', 'beginner'));
  const [eli5, setEli5] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    save('cb-theme', theme);
  }, [theme]);
  useEffect(() => {
    save('cb-lang', language);
  }, [language]);
  useEffect(() => {
    save('cb-level', level);
  }, [level]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <SettingsContext.Provider value={{ theme, toggleTheme, language, setLanguage, level, setLevel, eli5, setEli5 }}>
      {children}
    </SettingsContext.Provider>
  );
}
