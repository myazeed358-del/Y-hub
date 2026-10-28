import * as React from 'react';

import { useLegacyHome } from '../hooks/useLegacyHome';
import { HomeHero } from '../components/HomeHero';
import { HomeLearningProgress } from '../components/HomeLearningProgress';
import { HomeToolGrid } from '../components/HomeToolGrid';

export default function HomePage({ learningPath }: { learningPath?: React.ReactNode }) {
  const {
    language,
    t,
  } = useLegacyHome();

  return (
    <div className="space-y-10">
      <HomeHero language={language} t={t} />

      <HomeLearningProgress
        language={language}
        t={t}
        learningPath={learningPath}
      />

      <HomeToolGrid t={t} language={language} />
    </div>
  );
}
