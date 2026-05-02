import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, enableIndexedDbPersistence, Firestore, enableNetwork } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfigLocal from '../../firebase-applet-config.json';

// Use environment variables if present (Netlify/Vercel/Production), 
// otherwise fallback to local config (AI Studio Dev).
const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY !== '' && import.meta.env.VITE_FIREBASE_API_KEY !== 'undefined') ? import.meta.env.VITE_FIREBASE_API_KEY : firebaseConfigLocal.apiKey,
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN !== '' && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN !== 'undefined') ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN : firebaseConfigLocal.authDomain,
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_PROJECT_ID !== '' && import.meta.env.VITE_FIREBASE_PROJECT_ID !== 'undefined') ? import.meta.env.VITE_FIREBASE_PROJECT_ID : firebaseConfigLocal.projectId,
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET && import.meta.env.VITE_FIREBASE_STORAGE_BUCKET !== '' && import.meta.env.VITE_FIREBASE_STORAGE_BUCKET !== 'undefined') ? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET : firebaseConfigLocal.storageBucket,
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID && import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID !== '' && import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID !== 'undefined') ? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID : firebaseConfigLocal.messagingSenderId,
  appId: (import.meta.env.VITE_FIREBASE_APP_ID && import.meta.env.VITE_FIREBASE_APP_ID !== '' && import.meta.env.VITE_FIREBASE_APP_ID !== 'undefined') ? import.meta.env.VITE_FIREBASE_APP_ID : firebaseConfigLocal.appId,
};

let app: FirebaseApp;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase initialization failed:", error);
  app = initializeApp(firebaseConfigLocal);
}

const databaseId = (import.meta.env.VITE_FIREBASE_DATABASE_ID && import.meta.env.VITE_FIREBASE_DATABASE_ID.trim() !== '' && import.meta.env.VITE_FIREBASE_DATABASE_ID !== 'undefined') 
  ? import.meta.env.VITE_FIREBASE_DATABASE_ID.trim() 
  : firebaseConfigLocal.firestoreDatabaseId;

export const auth = getAuth(app);
export const db: Firestore = getFirestore(app, databaseId);
export const storage = getStorage(app);

// IndexedDB persistence is disabled as it can cause "client is offline" locks in some environments.
if (typeof window !== 'undefined') {
  const tryEnableNetwork = async () => {
    try {
      await enableNetwork(db);
      console.log("Firestore network enabled successfully.");
    } catch (err) {
      console.warn("Firestore enableNetwork failed, retrying in 2s...", err);
      setTimeout(tryEnableNetwork, 2000);
    }
  };
  tryEnableNetwork();
}

/**
 * Robust helper to fetch a document from server with retry logic for "offline" errors.
 */
export async function getDocFromServerWithRetry(docRef: any, maxRetries = 2) {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await getDocFromServer(docRef);
    } catch (err: any) {
      lastError = err;
      if (err.message?.includes('offline') || err.message?.includes('connection')) {
        console.warn(`Firestore getDocFromServer failed (offline), attempt ${i + 1}/${maxRetries}. Retrying...`);
        if (typeof window !== 'undefined') await enableNetwork(db).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  const errorJson = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorJson);
  
  // If it's a connection/offline error, don't throw to avoid crashing the whole UI
  if (message.includes('offline') || message.includes('connection')) {
    return;
  }
  
  throw new Error(errorJson);
}
