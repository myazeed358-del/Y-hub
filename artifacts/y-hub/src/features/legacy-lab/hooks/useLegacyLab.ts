import { useMemo, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';

import {
  membershipValue,
  type MembershipFunctionType,
} from '@/utils/fuzzyLogic';

import { labCopy } from '../constants/labCopy';
import { buildMembershipCurvePath } from '../domain/buildMembershipCurvePath';

type FunctionType = MembershipFunctionType;

export function useLegacyLab() {

  const { language } = useLanguage();
  const copy = labCopy[language];
  const isArabic = language === 'ar';
  const axisLabels = isArabic
    ? { zero: '٠', fifty: '٥٠', hundred: '١٠٠', one: '١' }
    : { zero: '0', fifty: '50', hundred: '100', one: '1' };
  const [functionType, setFunctionType] = useState<FunctionType>('triangle');
  const [params, setParams] = useState({ a: 20, b: 45, c: 72, d: 88, center: 55, spread: 16, x: 58 });
  const update = (key: keyof typeof params, value: number) => setParams((current) => ({ ...current, [key]: value }));
  const membership = useMemo(() => membershipValue(functionType, params.x, params), [functionType, params]);
  const curvePath = useMemo(
    () => buildMembershipCurvePath(functionType, params),
    [functionType, params]
  );
  const functionNames: Record<FunctionType, string> = {
    triangle: copy.triangle,
    trapezoid: copy.trapezoid,
    gaussian: copy.gaussian,
  };
  const resetParams = () => setParams({ a: 20, b: 45, c: 72, d: 88, center: 55, spread: 16, x: 58 });
  return {
    copy,
    isArabic,
    axisLabels,
    functionType,
    setFunctionType,
    params,
    update,
    membership,
    curvePath,
    functionNames,
    resetParams,
  };
}

export type LegacyLabController =
  ReturnType<typeof useLegacyLab>;
