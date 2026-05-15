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
  inbox?: boolean;
  publicProfile?: boolean;
  metaInsights?: boolean;
  brandDashboard?: boolean;
  reviews?: boolean;
  comments?: boolean;
  fileUploads?: boolean;
  pushNotifications?: boolean;
  withdrawal_requests?: boolean;
  dark_mode?: boolean;
  social_login?: boolean;
  analytics?: boolean;
  
  // Legacy/Feature specific flags to fix lint errors
  show_trending?: boolean;
  show_ai_pilot?: boolean;
  show_market_insights?: boolean;
  show_chat?: boolean;
  allow_payments?: boolean;
  allow_withdrawals?: boolean;
  support?: boolean;
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
    maintenance_mode: false,
    inbox: true,
    publicProfile: true,
    metaInsights: true,
    brandDashboard: true,
    reviews: true,
    comments: true,
    fileUploads: true,
    pushNotifications: true,
    withdrawal_requests: true,
    dark_mode: false,
    social_login: true,
    analytics: true,
    show_trending: true,
    show_ai_pilot: true,
    show_market_insights: true,
    show_chat: true,
    allow_payments: true,
    allow_withdrawals: true,
    support: true
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
