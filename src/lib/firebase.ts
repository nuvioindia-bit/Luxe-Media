import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, Firestore, enableNetwork } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

let app: FirebaseApp;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase Initialization Error:", error);
  app = initializeApp({ apiKey: "empty" }); 
}

const databaseId = (import.meta.env.VITE_FIREBASE_DATABASE_ID && import.meta.env.VITE_FIREBASE_DATABASE_ID !== 'undefined') 
  ? import.meta.env.VITE_FIREBASE_DATABASE_ID.trim() 
  : undefined;

export const auth = getAuth(app);
export const db: Firestore = getFirestore(app, databaseId);
export const storage = getStorage(app);

// Network logic
if (typeof window !== 'undefined') {
  const tryEnableNetwork = async () => {
    try {
      await enableNetwork(db);
    } catch (err) {
      setTimeout(tryEnableNetwork, 3000);
    }
  };
  tryEnableNetwork();
}

/**
 * YEH WOH MISSING FUNCTION HAI (Iske bina Profile page crash ho raha tha)
 */
export async function getDocFromServerWithRetry(docRef: any, maxRetries = 2) {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await getDocFromServer(docRef);
    } catch (err: any) {
      lastError = err;
      if (err.message?.includes('offline') || err.message?.includes('connection')) {
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Firestore Error [${operationType}] at [${path}]:`, message);
  if (message.includes('offline') || message.includes('connection')) return;
  throw new Error(message);
}
