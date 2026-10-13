import * as React from 'react';

import { useLegacyLab } from '../hooks/useLegacyLab';
import { LabHeader } from '../components/LabHeader';
import { LabChart } from '../components/LabChart';
import { LabControls } from '../components/LabControls';

export default function LabPage() {
  const lab = useLegacyLab();

  return (
    <div
      className="mx-auto max-w-6xl"
      dir={lab.isArabic ? 'rtl' : 'ltr'}
    >
      <LabHeader copy={lab.copy} />

      <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
        <LabChart
          copy={lab.copy}
          membership={lab.membership}
          params={lab.params}
          curvePath={lab.curvePath}
          axisLabels={lab.axisLabels}
          isArabic={lab.isArabic}
          functionNames={lab.functionNames}
          functionType={lab.functionType}
        />

        <LabControls
          copy={lab.copy}
          functionNames={lab.functionNames}
          functionType={lab.functionType}
          setFunctionType={lab.setFunctionType}
          params={lab.params}
          update={lab.update}
          resetParams={lab.resetParams}
        />
      </div>
    </div>
  );
}
