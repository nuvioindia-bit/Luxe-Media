import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, enableIndexedDbPersistence, Firestore, enableNetwork } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

let app: FirebaseApp;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase initialization failed:", error);
  throw error;
}

export const auth = getAuth(app);
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
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
