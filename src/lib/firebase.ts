import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, enableIndexedDbPersistence, Firestore, enableNetwork } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Use environment variables if present (Netlify/Vercel/Production).
// We check if the value is a real API key (usually starts with AIza or is long enough)
const isEnvValid = (val: any) => {
  if (!val || typeof val !== 'string') return false;
  const v = val.trim();
  if (v === '' || v === 'undefined' || v === 'null') return false;
  return v.length > 10;
};

// Configuration prioritizing environment variables, falling back to rexotool defaults
// HARDCODED FALLBACKS for Netlify/Production stability
const firebaseConfig = {
  apiKey: isEnvValid(import.meta.env.VITE_FIREBASE_API_KEY) ? import.meta.env.VITE_FIREBASE_API_KEY : 'AIzaSyC_h2j8rOdEUp3prN_VSyY1Dx2Fxzrx7UU',
  authDomain: isEnvValid(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN) ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN : 'rexotool.firebaseapp.com',
  projectId: isEnvValid(import.meta.env.VITE_FIREBASE_PROJECT_ID) ? import.meta.env.VITE_FIREBASE_PROJECT_ID : 'rexotool',
  storageBucket: isEnvValid(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET) ? import.meta.env.VITE_FIREBASE_STORAGE_BUCKET : 'rexotool.firebasestorage.app',
  messagingSenderId: isEnvValid(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID) ? import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID : '555700155865',
  appId: isEnvValid(import.meta.env.VITE_FIREBASE_APP_ID) ? import.meta.env.VITE_FIREBASE_APP_ID : '1:555700155865:web:83721335b112d620e155c8',
  databaseURL: 'https://rexotool-default-rtdb.asia-southeast1.firebasedatabase.app/'
};

let app: FirebaseApp;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.warn("Firebase initialization warning:", error);
  // Fail-safe empty app
  app = initializeApp({
    apiKey: "missing",
    authDomain: "missing",
    projectId: "missing",
    storageBucket: "missing",
    messagingSenderId: "missing",
    appId: "missing"
  });
}

const databaseId = isEnvValid(import.meta.env.VITE_FIREBASE_DATABASE_ID) 
  ? import.meta.env.VITE_FIREBASE_DATABASE_ID.trim() 
  : '(default)';

export const auth = getAuth(app);
export const db: Firestore = getFirestore(app, databaseId);
export const storage = getStorage(app);

/**
 * Robust helper to fetch a document from server with retry logic for "offline" errors.
 * CRITICAL: Do NOT delete this function.
 */
export async function getDocFromServerWithRetry(docRef: any, maxRetries = 2) {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await getDocFromServer(docRef);
    } catch (err: any) {
      lastError = err;
      const msg = err.message || '';
      if (msg.includes('offline') || msg.includes('connection')) {
        console.warn(`Firestore getDocFromServer failed (offline), attempt ${i + 1}/${maxRetries}. Retrying...`);
        // Only try to enable network if we are in a browser
        if (typeof window !== 'undefined') {
            await enableNetwork(db).catch(() => {});
        }
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
  
  // For READ operations, we can sometimes ignore offline errors to prevent UI crashes
  const isRead = operationType === OperationType.GET || operationType === OperationType.LIST;
  const isOffline = message.includes('offline') || message.includes('connection');
  
  if (isRead && isOffline) {
    return;
  }
  
  // For WRITES or non-offline errors, we must throw so the UI can respond
  throw new Error(errorJson);
}
