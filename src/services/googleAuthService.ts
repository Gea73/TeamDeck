import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { GoogleSessionStatus } from '../types/workspace';

export const SCOPES = [
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
] as const;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

function buildGoogleProvider(loginHintEmail?: string | null): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  for (const scope of SCOPES) {
    provider.addScope(scope);
  }
  if (loginHintEmail) {
    provider.setCustomParameters({ login_hint: loginHintEmail });
  }
  return provider;
}

// Estado público da sessão apenas (nunca armazena accessToken no navegador)
let isSigningIn = false;
let cachedSessionStatus: GoogleSessionStatus = {
  connected: false,
  email: null,
  displayName: null,
  expiresAt: null,
  isExpired: false,
  scopes: [],
};

type SessionListener = (status: GoogleSessionStatus) => void;
const listeners = new Set<SessionListener>();

function notifySessionListeners(status: GoogleSessionStatus): void {
  cachedSessionStatus = status;
  for (const listener of listeners) {
    listener(status);
  }
}

export function subscribeGoogleSession(listener: SessionListener): () => void {
  listeners.add(listener);
  listener(cachedSessionStatus);
  return () => {
    listeners.delete(listener);
  };
}

export interface GoogleAuthSession {
  user: {
    uid: string;
    displayName: string | null;
    email: string | null;
  };
  sessionStatus: GoogleSessionStatus;
}

async function syncTokenToBackendVault(
  accessToken: string
): Promise<GoogleSessionStatus> {
  const response = await fetch('/api/google/session', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errPayload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      errPayload?.error ||
        'Não foi possível validar e armazenar a sessão Google de forma segura no servidor.'
    );
  }

  const status = (await response.json()) as GoogleSessionStatus;
  notifySessionListeners(status);
  return status;
}

export async function fetchBackendGoogleSession(): Promise<GoogleSessionStatus> {
  try {
    const response = await fetch('/api/google/session', {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) {
      return cachedSessionStatus;
    }
    const status = (await response.json()) as GoogleSessionStatus;
    notifySessionListeners(status);
    return status;
  } catch {
    return cachedSessionStatus;
  }
}

export const initAuth = (
  onAuthSuccess?: (user: User) => void,
  onAuthFailure?: () => void
) => {
  void fetchBackendGoogleSession();

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (isSigningIn) return;
    const backendStatus = await fetchBackendGoogleSession();
    if (user && backendStatus.connected && !backendStatus.isExpired) {
      onAuthSuccess?.(user);
    } else if (!backendStatus.connected || backendStatus.isExpired) {
      onAuthFailure?.();
    }
  });
};

export const googleSignIn = async (): Promise<GoogleAuthSession> => {
  try {
    isSigningIn = true;
    const provider = buildGoogleProvider();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'Não foi possível obter o token de autorização OAuth 2.0.'
      );
    }

    const sessionStatus = await syncTokenToBackendVault(credential.accessToken);

    return {
      user: {
        uid: result.user.uid,
        displayName: sessionStatus.displayName ?? result.user.displayName,
        email: sessionStatus.email ?? result.user.email,
      },
      sessionStatus,
    };
  } finally {
    isSigningIn = false;
  }
};

/**
 * Renova o access token OAuth 2.0 da conta conectada e atualiza o cofre do servidor.
 */
export const refreshGoogleAccessToken = async (): Promise<GoogleSessionStatus> => {
  try {
    isSigningIn = true;
    const currentUser = auth.currentUser;
    const provider = buildGoogleProvider(
      currentUser?.email ?? cachedSessionStatus.email
    );

    const result = currentUser
      ? await reauthenticateWithPopup(currentUser, provider)
      : await signInWithPopup(auth, provider);

    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível renovar o access token do Google.');
    }

    return await syncTokenToBackendVault(credential.accessToken);
  } finally {
    isSigningIn = false;
  }
};

export const getCachedGoogleSessionStatus = (): GoogleSessionStatus => {
  return cachedSessionStatus;
};

export const logoutGoogle = async (): Promise<void> => {
  try {
    await fetch('/api/google/session', {
      method: 'DELETE',
      credentials: 'include',
    });
  } catch {
    // prossegue com signOut local mesmo se servidor estiver indisponível
  }
  await auth.signOut();
  notifySessionListeners({
    connected: false,
    email: null,
    displayName: null,
    expiresAt: null,
    isExpired: false,
    scopes: [],
  });
};
