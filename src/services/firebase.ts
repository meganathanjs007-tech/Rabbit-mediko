import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import appletConfig from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(
  app,
  import.meta.env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId
);
export const auth = getAuth(app);
export const storage = getStorage(app);

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
  };
}

export function getFriendlyFirebaseError(error: unknown, language: 'en' | 'ta' = 'en'): string {
  const code = (error as { code?: string })?.code ?? '';
  const rawMessage = error instanceof Error ? error.message : String(error ?? '');

  let innerMessage = rawMessage;
  try {
    const parsed = JSON.parse(rawMessage) as { error?: string };
    if (parsed?.error) innerMessage = parsed.error;
  } catch {
    // Plain message
  }

  if (code === 'permission-denied' || innerMessage.toLowerCase().includes('permission')) {
    return language === 'ta'
      ? 'அணுகல் அனுமதி இல்லை. தயவுசெய்து மீண்டும் உள்நுழைந்து முயற்சிக்கவும்.'
      : 'Permission denied for this action. Please refresh or check your family access.';
  }
  if (code === 'unavailable' || innerMessage.toLowerCase().includes('offline')) {
    return language === 'ta'
      ? 'இணைய இணைப்பு தற்காலிகமாக இல்லை. மீண்டும் முயற்சிக்கவும்.'
      : 'Network temporarily unavailable. Please try again.';
  }
  return innerMessage || (language === 'ta' ? 'பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.' : 'Something went wrong. Please try again.');
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(getFriendlyFirebaseError(error));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration. Firestore client is offline.');
    }
  }
}

void testConnection();
