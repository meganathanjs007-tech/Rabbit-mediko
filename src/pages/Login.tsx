import { useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Activity, BellRing, Loader2, QrCode, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { LoadingScreen } from '../components/LoadingScreen';
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
  const { user, authReady, family, familyLoading, language, setLanguage } = useFamily();
  const navigate = useNavigate();
  const t = getT(language);

  const [signingIn, setSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (authReady && user && !familyLoading) {
      navigate(family ? '/dashboard' : '/setup', { replace: true });
    }
  }, [authReady, user, family, familyLoading, navigate]);

  if (!authReady || (user && familyLoading)) {
    return (
      <LoadingScreen
        message={
          language === 'ta'
            ? 'உங்கள் கணக்கு சரிபார்க்கப்படுகிறது...'
            : 'Verifying your Google account...'
        }
      />
    );
  }

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
    <div className="min-h-screen w-full overflow-x-clip bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <BrandLogo size="md" />
          <span className="text-lg font-bold tracking-tight text-slate-900">{t.appName}</span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
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
        </div>
      </header>

      {/* Main Split Showcase & Sign-In */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex items-center">
        <div className="w-full grid lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* Brand & Capabilities Showcase */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="lg:col-span-7 bg-[#0B0B11] text-white rounded-3xl p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-8 border border-slate-800/80"
          >
            <div className="flex items-start sm:items-center gap-4">
              <img
                src="/assets/aistudio/1795024642701_18b5ae14.png"
                alt="Rabbit Mediko emblem"
                referrerPolicy="no-referrer"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0 ring-1 ring-white/10"
              />
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-medium text-emerald-400 tracking-wide">
                  {language === 'ta' ? 'தமிழ் & ஆங்கிலம் · குடும்ப நல செயலி' : 'English & Tamil · Family Health Vault'}
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  {language === 'ta'
                    ? 'குடும்பத்தின் ஆரோக்கியம் ஒரே பாதுகாப்பான இடத்தில்.'
                    : 'Every family member’s vitals, medicines, and meals in one calm vault.'}
                </h1>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 border-t border-white/10 pt-6">
              <div className="space-y-1.5">
                <Activity className="w-5 h-5 text-emerald-400" />
                <p className="text-sm font-semibold text-white">
                  {language === 'ta' ? 'BP & சர்க்கரை பதிவு' : 'BP & Sugar Vault'}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {language === 'ta'
                    ? '7-நாள் வரைபடம் மற்றும் மருத்துவர் PDF அறிக்கை.'
                    : 'Trend charts and one-tap clinical PDF reports.'}
                </p>
              </div>
              <div className="space-y-1.5">
                <BellRing className="w-5 h-5 text-blue-400" />
                <p className="text-sm font-semibold text-white">
                  {language === 'ta' ? 'மருந்து நினைவூட்டல்' : 'Dose Reminders'}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {language === 'ta'
                    ? 'சரியான நேரத்தில் ஒலி & திரை எச்சரிக்கைகள்.'
                    : 'Timely sound and browser alerts across the whole app.'}
                </p>
              </div>
              <div className="space-y-1.5">
                <QrCode className="w-5 h-5 text-rose-400" />
                <p className="text-sm font-semibold text-white">
                  {language === 'ta' ? 'அவசர QR அட்டை' : 'Emergency QR'}
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {language === 'ta'
                    ? 'இரத்த வகை மற்றும் ஒவ்வாமை விவரம் உடனடியாக.'
                    : 'Instant blood group, allergy, and ICE contact access.'}
                </p>
              </div>
            </div>
          </motion.section>

          {/* Google Sign-In Card */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: 0.04 }}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col justify-center space-y-6"
          >
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  {language === 'ta' ? 'பாதுகாப்பான Google உள்நுழைவு' : 'Secure Family Workspace'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                {language === 'ta' ? 'Rabbit Mediko-வில் உள்நுழையவும்' : 'Sign in to Rabbit Mediko'}
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed">{t.appTagline}</p>
            </div>

            <button
              type="button"
              disabled={signingIn}
              onClick={() => void handleGoogleSignIn()}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold disabled:opacity-60 transition-colors min-h-[50px] shadow-xs cursor-pointer"
            >
              {signingIn ? (
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600 shrink-0" />
              ) : (
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
              )}
              <span>{signingIn ? t.login.verifying : t.login.googleBtn}</span>
            </button>

            {errorMsg && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700 leading-relaxed">
                {errorMsg}
              </div>
            )}

            <div className="border-t border-slate-100 pt-4 text-xs text-slate-500">
              <p>
                {language === 'ta'
                  ? 'புதிய குடும்பம் தொடங்கலாம் அல்லது 8-எழுத்து குறியீடு மூலம் ஏற்கனவே உள்ள குடும்பத்தில் சேரலாம்.'
                  : 'Create a new family workspace or join an existing one with an 8-character invite code.'}
              </p>
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
