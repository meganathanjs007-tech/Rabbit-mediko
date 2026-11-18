import { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { HeartPulse } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { useFamily } from '../hooks/useFamily';
import { getT } from '../utils/i18n';

function formatGoogleAuthError(err: unknown, lang: 'en' | 'ta'): string {
  const code = (err as { code?: string })?.code ?? '';
  const message = err instanceof Error ? err.message : 'Google sign-in failed';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return lang === 'ta'
      ? 'உள்நுழைவு சாளரம் மூடப்பட்டது. மீண்டும் முயற்சிக்கவும்.'
      : 'Sign-in window was closed. Please try again.';
  }
  if (code === 'auth/popup-blocked') {
    return lang === 'ta'
      ? 'உலாவியில் பாப்-அப் தடுக்கப்பட்டுள்ளது. பாப்-அப்களை அனுமதித்து மீண்டும் முயற்சிக்கவும்.'
      : 'Browser blocked the sign-in popup. Please allow popups and try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    return lang === 'ta'
      ? `இந்த தளம் (${host}) Firebase Authorized Domains-ல் சேர்க்கப்படவில்லை.`
      : `Domain "${host}" is not authorized in Firebase Console -> Authentication -> Settings -> Authorized domains.`;
  }
  if (code === 'auth/network-request-failed') {
    return lang === 'ta'
      ? 'இணைய இணைப்பு பிழை. மீண்டும் முயற்சிக்கவும்.'
      : 'Network error while signing in. Please check your connection and retry.';
  }
  return message;
}

export default function Login() {
  const { user, family, familyLoading, language, setLanguage } = useFamily();
  const navigate = useNavigate();
  const t = getT(language);

  const [signingIn, setSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (user && !familyLoading) {
      navigate(family ? '/dashboard' : '/setup', { replace: true });
    }
  }, [user, family, familyLoading, navigate]);

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      toast.success(language === 'ta' ? 'வெற்றிகரமாக உள்நுழைந்தீர்கள்!' : 'Signed in with Google');
    } catch (err: unknown) {
      setErrorMsg(formatGoogleAuthError(err, language));
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Minimal Header */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
            <HeartPulse className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">{t.appName}</span>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => void setLanguage('en')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              language === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => void setLanguage('ta')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              language === 'ta' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            தமிழ்
          </button>
        </div>
      </header>

      {/* Focused Google Sign-In Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6"
        >
          <div className="space-y-1.5 text-center">
            <h1 className="text-xl font-bold text-slate-900">
              {language === 'ta' ? 'Rabbit Mediko-வில் உள்நுழையவும்' : 'Sign in to Rabbit Mediko'}
            </h1>
            <p className="text-sm text-slate-500">{t.appTagline}</p>
          </div>

          <button
            type="button"
            disabled={signingIn}
            onClick={() => void handleGoogleSignIn()}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold disabled:opacity-60 transition-colors min-h-[48px] shadow-xs cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>{signingIn ? t.login.verifying : t.login.googleBtn}</span>
          </button>

          {errorMsg && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700 leading-relaxed">
              {errorMsg}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
