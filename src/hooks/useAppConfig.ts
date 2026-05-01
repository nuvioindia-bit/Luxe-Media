import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface AppConfig {
  show_trending?: boolean;
  show_ai_pilot?: boolean;
  show_market_insights?: boolean;
  show_chat?: boolean;
  allow_payments?: boolean;
  allow_withdrawals?: boolean;
  maintenance_mode?: boolean;
}

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>({
    show_trending: true,
    show_ai_pilot: true,
    show_market_insights: true,
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
