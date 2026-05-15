import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  user: any | null;
  setUser: (user: any | null) => void;
  config: any;
  updateConfig: (config: any) => void;
  notifications: any[];
  addNotification: (notification: any) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      config: {},
      updateConfig: (config) => set((state) => ({ config: { ...state.config, ...config } })),
      notifications: [],
      addNotification: (notification) => set((state) => ({ 
        notifications: [notification, ...state.notifications].slice(0, 50) 
      })),
    }),
    {
      name: 'rexo-storage',
    }
  )
);
