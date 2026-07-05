'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMe, login as apiLogin, register as apiRegister, User } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    getMe()
      .then((userData) => {
        setUser(userData);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    const token = response.access_token || response.token;
    if (!token) {
      throw new Error('No token received from server');
    }
    localStorage.setItem('token', token);
    const userData = await getMe();
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      const response = await apiRegister(email, username, password);
      const token = response.access_token || response.token;
      if (!token) {
        throw new Error('No token received from server');
      }
      localStorage.setItem('token', token);
      const userData = await getMe();
      setUser(userData);
      return userData;
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    disconnectSocket();
    setUser(null);
  }, []);

  return { user, loading, login, register, logout };
}
