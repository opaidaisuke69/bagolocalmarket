import { createContext, useContext, useState, useEffect } from 'react';

const AuthModalContext = createContext(null);

export function AuthModalProvider({ children }) {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const openLogin = () => { setShowRegister(false); setShowLogin(true); };
  const openRegister = () => { setShowLogin(false); setShowRegister(true); };
  const closeAll = () => { setShowLogin(false); setShowRegister(false); };

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (showLogin || showRegister) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showLogin, showRegister]);

  return (
    <AuthModalContext.Provider value={{ showLogin, showRegister, openLogin, openRegister, closeAll }}>
      {children}
    </AuthModalContext.Provider>
  );
}

export const useAuthModal = () => {
  const context = useContext(AuthModalContext);
  if (!context) throw new Error('useAuthModal must be used within AuthModalProvider');
  return context;
};
