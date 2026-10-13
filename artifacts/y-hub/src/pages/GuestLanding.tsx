import { GuestLandingBackground } from '@/components/guest-landing/GuestLandingBackground';
import { guestCopy } from '@/i18n/guestLandingCopy';
import { GuestLandingHeader } from '@/components/guest-landing/GuestLandingHeader';
import { GuestLandingHeroIntro } from '@/components/guest-landing/GuestLandingHeroIntro';
import { GuestLandingDashboardPreview } from '@/components/guest-landing/GuestLandingDashboardPreview';

type GuestLandingProps = {
  language: 'ar' | 'en';
  onToggleLanguage: () => void;
};

export default function GuestLanding({
  language,
  onToggleLanguage,
}: GuestLandingProps) {
  const copy = guestCopy[language];

  return (
    <main
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      className="relative min-h-screen overflow-hidden bg-[#050914] text-white"
    >
      {/* Background */}
      <GuestLandingBackground />

      {/* Header */}
      <GuestLandingHeader language={language} copy={copy} onToggleLanguage={onToggleLanguage} />

      {/* Hero */}
      <section dir="ltr" className="relative z-10 mx-auto grid min-h-[calc(100vh-100px)] w-full max-w-[1600px] items-center gap-6 px-6 pb-12 pt-2 lg:grid-cols-[0.78fr_1.22fr] lg:px-14 lg:pb-16">
        {/* Text */}
        <GuestLandingHeroIntro language={language} copy={copy} />
        {/* Student dashboard preview */}
        <GuestLandingDashboardPreview language={language} copy={copy} />
      </section>
    </main>
  );
}
