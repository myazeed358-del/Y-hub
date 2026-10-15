import { ThemeToggle } from '@/components/ThemeToggle';
import YHubLogo from '@/components/YHubLogo';
import ScientificBackdrop from '@/components/ScientificBackdrop';
import { LoginBrandPanel } from '../components/LoginBrandPanel';
import { LoginSignupFields } from '../components/LoginSignupFields';
import { LoginCredentialsFields } from '../components/LoginCredentialsFields';
import { LoginFormActions } from '../components/LoginFormActions';
import { useLoginController } from '../hooks/useLoginController';
import type { LoginProps } from '../types';

export default function LoginPage({
  language,
  onToggleLanguage,
}: LoginProps) {
  const {
    copy,
    isSignUp,
    isRecoveryRequest,
    loading,
    message,
    setMessage,
    setIsRecoveryRequest,
    formData,
    handleChange,
    handleSelectChange,
    switchMode,
    handleSubmit,
    setLocation
  } = useLoginController(language);

  return (
    <div
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="relative min-h-[100dvh] overflow-hidden bg-background text-foreground dark:bg-[#020817] dark:text-white"
    >
      <ScientificBackdrop />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,rgba(14,165,233,0.08),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(124,58,237,0.08),transparent_34%)]" />

      <div className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <div className="grid w-full max-w-[1320px] overflow-hidden rounded-[30px] border border-border/70 bg-card/95 shadow-[0_24px_80px_rgba(15,23,42,0.14)] dark:border-cyan-400/15 dark:bg-[#06101f]/85 dark:shadow-[0_0_80px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr]">

          {/* Brand side */}
          <LoginBrandPanel copy={copy} />

          {/* Form side */}
          <section className="relative flex items-center justify-center px-5 pb-10 pt-24 sm:px-10 sm:pb-12 sm:pt-28 lg:px-14">
            <div className={`absolute top-5 z-20 sm:top-8 ${
              language === 'en'
                ? 'right-20 sm:right-24'
                : 'left-20 sm:left-24'
            }`}>
              <ThemeToggle />
            </div>

            <button
              type="button"
              onClick={onToggleLanguage}
              className={`absolute top-5 z-20 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-black text-primary transition hover:bg-primary/10 dark:border-cyan-400/20 dark:bg-cyan-400/[0.06] dark:text-cyan-300 dark:hover:bg-cyan-400/10 sm:top-8 ${
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
                <div className="inline-flex rounded-xl border border-[#36D5E8]/60 bg-[#E8EDF3] p-2 shadow-[0_0_16px_rgba(54,213,232,0.14)] lg:hidden dark:border-0 dark:bg-[#06101f] dark:shadow-none">
                  <YHubLogo
                    size="sm"
                    className="[&_.font-black]:text-[#172B45] [&_.text-slate-500]:text-[#536B80] dark:[&_.font-black]:text-white dark:[&_.text-slate-500]:text-slate-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setLocation('/')}
                  className={`absolute top-5 z-20 text-sm font-semibold text-muted-foreground transition hover:text-foreground dark:text-slate-400 dark:hover:text-white sm:top-8 ${
                    language === 'ar'
                      ? 'right-5 sm:right-8'
                      : 'left-5 sm:left-8'
                  }`}
                >
                  {copy.backHome}
                </button>
              </div>

              <div className="mb-8">
                <h1 className="text-3xl font-black sm:text-4xl">
                  {isRecoveryRequest ? copy.forgotTitle : isSignUp ? copy.createTitle : copy.loginTitle}
                </h1>

                <p className="mt-3 leading-7 text-muted-foreground dark:text-slate-400">
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
