import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null); // 'atakan' | 'cemre'
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('@app_user');
        if (storedUser) {
          selectUser(storedUser, false);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const selectUser = async (userId, save = true) => {
    setUser(userId);
    setPartner(userId === 'atakan' ? 'cemre' : 'atakan');
    if (save) {
      await AsyncStorage.setItem('@app_user', userId);
    }
  };

  const switchUser = async () => {
    await AsyncStorage.removeItem('@app_user');
    setUser(null);
    setPartner(null);
  };

  return (
    <UserContext.Provider value={{ user, partner, selectUser, switchUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};