import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface AppConfig {
  homePage?: boolean;
  wallet?: boolean;
  campaigns?: boolean;
  aiPilot?: boolean;
  referEarn?: boolean;
  notifications?: boolean;
  profile?: boolean;
  maintenance_mode?: boolean;
}

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>({
    homePage: true,
    wallet: true,
    campaigns: true,
    aiPilot: true,
    referEarn: true,
    notifications: true,
    profile: true,
    maintenance_mode: false
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'app_config', 'main'), (snap) => {
      if (snap.exists()) {
        setConfig(snap.data() as AppConfig);
      }
    });

    return () => unsub();
  }, []);

  return config;
}
