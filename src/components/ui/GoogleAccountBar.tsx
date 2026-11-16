import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  fetchBackendGoogleSession,
  googleSignIn,
  logoutGoogle,
  refreshGoogleAccessToken,
  subscribeGoogleSession,
} from '../../services/googleAuthService';
import { GoogleSessionStatus } from '../../types/workspace';

interface GoogleAccountBarProps {
  purposeLabel?: string;
  compact?: boolean;
  onSessionChange?: (status: GoogleSessionStatus) => void;
}

const SCOPE_LABELS: Record<string, string> = {
  'https://www.googleapis.com/auth/presentations': 'Google Slides',
  'https://www.googleapis.com/auth/gmail.send': 'Gmail (envio)',
  'https://www.googleapis.com/auth/calendar.events': 'Google Calendar',
};

function formatExpirationTime(expiresAtIso: string | null): string | null {
  if (!expiresAtIso) return null;
  const date = new Date(expiresAtIso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function GoogleAccountBar({
  purposeLabel = 'utilizar Google Slides, Gmail e Google Calendar',
  compact = false,
  onSessionChange,
}: GoogleAccountBarProps) {
  const [session, setSession] = useState<GoogleSessionStatus>({
    connected: false,
    email: null,
    displayName: null,
    expiresAt: null,
    isExpired: false,
    scopes: [],
  });
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeGoogleSession((nextStatus) => {
      setSession(nextStatus);
      onSessionChange?.(nextStatus);
    });
    void fetchBackendGoogleSession();
    return () => unsubscribe();
  }, [onSessionChange]);

  const handleSignIn = async () => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await googleSignIn();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Não foi possível conectar sua conta Google.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleRenew = async () => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await refreshGoogleAccessToken();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Não foi possível renovar o token de acesso do Google.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await logoutGoogle();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Não foi possível desconectar a conta Google.'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const activeScopeNames =
    session.scopes.length > 0
      ? session.scopes.map((s) => SCOPE_LABELS[s] ?? s).join(' · ')
      : 'Google Slides · Gmail (envio) · Google Calendar';

  const expirationClock = formatExpirationTime(session.expiresAt);

  return (
    <div className="space-y-3">
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg text-xs sm:text-sm text-red-900"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {!session.connected ? (
        <div
          className={`${
            compact ? 'p-4' : 'p-5'
          } bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
        >
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              Conecte sua conta Google para {purposeLabel}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              OAuth 2.0 com escopos mínimos (Google Slides, envio no Gmail e
              eventos no Google Calendar). As credenciais ficam cifradas apenas
              no servidor e nunca são armazenadas no navegador.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleSignIn()}
            disabled={isBusy}
            className="gsi-material-button shrink-0"
          >
            <div className="gsi-material-button-state" />
            <div className="gsi-material-button-content-wrapper">
              <div className="gsi-material-button-icon">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  style={{ display: 'block' }}
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
              </div>
              <span className="gsi-material-button-contents">
                {isBusy ? 'Conectando...' : 'Sign in with Google'}
              </span>
            </div>
          </button>
        </div>
      ) : session.isExpired ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
              <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Access token Google expirado</span>
            </div>
            <p className="text-xs text-amber-800">
              A sessão de{' '}
              <strong>{session.email || session.displayName || 'sua conta'}</strong>{' '}
              expirou. Renove o access token para continuar usando as APIs do
              Google.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleRenew()}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              {isBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Renovar token</span>
            </button>
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Desconectar</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`${
            compact ? 'p-3.5' : 'p-4'
          } bg-blue-50/60 border border-blue-200 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-800">
              <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
              <span>
                {session.displayName
                  ? `${session.displayName} (${session.email ?? 'conta Google'})`
                  : session.email || 'Conta Google conectada'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span>Escopos ativos: {activeScopeNames}</span>
              </span>
              {expirationClock && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    Token válido até ~{expirationClock}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleRenew()}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              {isBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Renovar token</span>
            </button>
            <button
              type="button"
              onClick={() => void handleDisconnect()}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 border border-slate-300 hover:border-red-200 text-slate-700 hover:text-red-700 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Desconectar</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
