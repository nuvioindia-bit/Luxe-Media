import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, Firestore, enableNetwork } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * REXOTOOL SAFE FIREBASE CONFIG
 * Yeh code Netlify dashboard ke variables ko priority deta hai.
 * Agar variables nahi milte, toh yeh crash hone ki jagah console mein error dikhayega,
 * taaki aapki screen WHITE na ho.
 */

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
  // Check ki kya zaroori keys maujood hain
  if (!firebaseConfig.apiKey) {
    throw new Error("Firebase API Key is missing in Environment Variables");
  }
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase Initialization Error:", error);
  // Dummy initialization taaki exported variables undefined na hon aur app crash na ho
  app = initializeApp({ apiKey: "empty" }); 
}

// Database ID handles dynamically
const databaseId = (import.meta.env.VITE_FIREBASE_DATABASE_ID && import.meta.env.VITE_FIREBASE_DATABASE_ID !== 'undefined') 
  ? import.meta.env.VITE_FIREBASE_DATABASE_ID.trim() 
  : undefined;

export const auth = getAuth(app);
export const db: Firestore = getFirestore(app, databaseId);
export const storage = getStorage(app);

// Network logic taaki connection bana rahe
if (typeof window !== 'undefined') {
  const tryEnableNetwork = async () => {
    try {
      await enableNetwork(db);
      console.log("Firestore network connected.");
    } catch (err) {
      setTimeout(tryEnableNetwork, 3000);
    }
  };
  tryEnableNetwork();
}

/**
 * Operation Types for Firestore
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/**
 * Error Handler - White screen se bachne ke liye throw nahi karega agar connection issue ho
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  
  console.error(`Firestore Error [${operationType}] at [${path}]:`, message);

  // Connection ya offline error par UI nahi udayenge
  if (message.includes('offline') || message.includes('connection')) {
    return;
  }

  // Sirf critical errors throw karein
  throw new Error(message);
}
