import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string;
  avatar?: string;
  profile_image?: string;
  contact_number?: string;
  full_name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  register: (data: any) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      const data = await authAPI.me();
      // Clear session if a non-buyer somehow has a stored token
      if (data.user?.role && data.user.role !== 'buyer') {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        setUser(null);
        setLoading(false);
        return;
      }
      // Normalise: API returns full_name, we also store it as name
      const normalised = {
        ...data.user,
        name: data.user.full_name || data.user.name || '',
      };
      setUser(normalised);
      await AsyncStorage.setItem('user', JSON.stringify(normalised));
    } catch {
      const saved = await AsyncStorage.getItem('user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.role && parsed.role !== 'buyer') {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('user');
          setUser(null);
        } else {
          setUser(parsed);
        }
      } else {
        await AsyncStorage.removeItem('token');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (credentials: { email: string; password: string }) => {
    const data = await authAPI.login(credentials);
    // Market app is for buyers only
    if (data.user?.role && data.user.role !== 'buyer') {
      throw new Error('This app is for buyers only. Please use the correct app for your account type.');
    }
    await AsyncStorage.setItem('token', data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const register = async (formData: any) => {
    const data = await authAPI.register(formData);
    return data;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setUser(null);
  };

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
