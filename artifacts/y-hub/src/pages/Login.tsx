import { useState } from 'react';
import { useLocation } from 'wouter';
import {
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { loginCopy } from '@/i18n/loginCopy';
import { supabase } from '@/utils/supabaseClient';
import YHubLogo from '@/components/YHubLogo';
import { LoginBrandPanel } from '@/components/login/LoginBrandPanel';
import { LoginSignupFields } from '@/components/login/LoginSignupFields';
import { LoginCredentialsFields } from '@/components/login/LoginCredentialsFields';
import { LoginFormActions } from '@/components/login/LoginFormActions';
import ScientificBackdrop from '@/components/ScientificBackdrop';



type LoginProps = {
  language: 'ar' | 'en';
  onToggleLanguage: () => void;
};

export default function Login({
  language,
  onToggleLanguage,
}: LoginProps) {
  const copy = loginCopy[language];
  const [isSignUp, setIsSignUp] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('mode') === 'signup';
  });

  const [isRecoveryRequest, setIsRecoveryRequest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const { signIn, signUp } = useAuth();
  const [, setLocation] = useLocation();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    age: '',
    major: '',
    study_year: '',
    phone: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const switchMode = () => {
    setIsRecoveryRequest(false);
    setMessage({ text: '', type: '' });
    setIsSignUp((current) => !current);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      if (isRecoveryRequest) {
        const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
        const redirectTo = `${window.location.origin}${basePath}/reset-password`;

        const { error } = await supabase.auth.resetPasswordForEmail(
          formData.email.trim(),
          { redirectTo }
        );

        if (error) throw error;

        setMessage({
          text: copy.forgotSent,
          type: 'success',
        });
      } else if (isSignUp) {
        const nameRegex = /^[\p{L}\s]+$/u;

        if (!nameRegex.test(formData.full_name)) {
          throw new Error(copy.nameError);
        }

        if (!formData.major || !formData.study_year) {
          throw new Error(copy.requiredError);
        }

        await signUp(formData);

        setMessage({
          text: copy.success,
          type: 'success',
        });

        setIsSignUp(false);
      } else {
        await signIn(formData.email, formData.password);
        setLocation('/');
      }
    } catch (error: any) {
      setMessage({
        text: isRecoveryRequest ? copy.forgotFailed : (error.message || copy.unexpectedError),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="relative min-h-[100dvh] overflow-hidden bg-[#020817] text-white"
    >
      <ScientificBackdrop />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,rgba(14,165,233,0.08),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(124,58,237,0.08),transparent_34%)]" />

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <div className="grid w-full max-w-[1320px] overflow-hidden rounded-[30px] border border-cyan-400/15 bg-[#06101f]/85 shadow-[0_0_80px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr]">

          {/* Brand side */}
          <LoginBrandPanel copy={copy} />

          {/* Form side */}
          <section className="relative flex items-center justify-center px-5 py-8 sm:px-10 lg:px-14">
            <button
              type="button"
              onClick={onToggleLanguage}
              className={`absolute top-5 z-20 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-2 text-xs font-black text-cyan-300 transition hover:bg-cyan-400/10 sm:top-8 ${
                language === 'en'
                  ? 'right-5 sm:right-8'
                  : 'left-5 sm:left-8'
              }`}
              aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              {language === 'ar' ? 'EN' : 'AR'}
            </button>

            <div className="w-full max-w-[560px]">

              <div className="mb-8 lg:mb-0">
                <div className="lg:hidden">
                  <YHubLogo size="sm" />
                </div>

                <button
                  type="button"
                  onClick={() => setLocation('/')}
                  className={`absolute top-5 z-20 text-sm font-semibold text-slate-400 transition hover:text-white sm:top-8 ${
                    language === 'ar'
                      ? 'right-5 sm:right-8'
                      : 'left-5 sm:left-8'
                  }`}
                >
                  {copy.backHome}
                </button>
              </div>

              <div className="mb-8">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-400">
                  <span className="h-px w-8 bg-cyan-400/50" />
                  Y HUB
                </div>

                <h1 className="text-3xl font-black sm:text-4xl">
                  {isRecoveryRequest ? copy.forgotTitle : isSignUp ? copy.createTitle : copy.loginTitle}
                </h1>

                <p className="mt-3 leading-7 text-slate-400">
                  {isRecoveryRequest
                      ? copy.forgotDescription
                      : isSignUp
                        ? copy.createDescription
                        : copy.loginDescription}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <LoginSignupFields
                    copy={copy}
                    formData={formData}
                    handleChange={handleChange}
                    handleSelectChange={handleSelectChange}
                  />
                )}

                <LoginCredentialsFields
                  copy={copy}
                  formData={formData}
                  isRecoveryRequest={isRecoveryRequest}
                  handleChange={handleChange}
                />
                <LoginFormActions
                  copy={copy}
                  isSignUp={isSignUp}
                  isRecoveryRequest={isRecoveryRequest}
                  loading={loading}
                  message={message}
                  setMessage={setMessage}
                  setIsRecoveryRequest={setIsRecoveryRequest}
                  switchMode={switchMode}
                />
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
