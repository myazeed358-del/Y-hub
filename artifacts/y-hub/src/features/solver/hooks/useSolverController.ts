import { useState, useMemo } from 'react';

import {
  generateReverseTNormChallenge,
  validateReverseChallenge,
  type TNormType,
} from '@/utils/reverseEngine';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { getSolverCopy } from '@/i18n/solverCopy';

import {
  evaluateTNorm,
  normalizeMembershipInput,
} from '../domain/evaluateTNorm';

import { exportSolverPDF } from '../services/solverReportService';

export function useSolverController() {

  const { t, language } = useLanguage();
  const isArabic = language === 'ar';

  const copy = getSolverCopy(isArabic);
  const [a, setA] = useState<string>('0.5');
  const [b, setB] = useState<string>('0.5');
  const [tnorm, setTnorm] = useState<TNormType>('standard');

  const numA = normalizeMembershipInput(a);
  const numB = normalizeMembershipInput(b);

  const { result, proof } = evaluateTNorm(
    numA,
    numB,
    tnorm,
    isArabic
  );

  // Reverse Challenge State
  const [revA, setRevA] = useState<number>(0.8);
  const [revResult, setRevResult] = useState<number>(0.4);
  const [revOperation, setRevOperation] = useState<TNormType>('algebraic');
  const [userAnswerB, setUserAnswerB] = useState<string>('');

  const challenge = useMemo(() => generateReverseTNormChallenge(revOperation, revA, revResult), [revOperation, revA, revResult]);

  const [validation, setValidation] = useState<{ isCorrect: boolean; proof: string } | null>(null);

  const generateNewChallenge = () => {
    const ops: TNormType[] = ['standard', 'algebraic', 'bounded', 'drastic'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    const newA = Number((Math.random() * 0.9 + 0.1).toFixed(1));
    const newB = Number((Math.random() * 0.9 + 0.1).toFixed(1));

    setRevOperation(op);
    setRevA(newA);
    // Use the actual calculation to ensure the challenge result is valid
    let newRes = 0;
    if (op === 'standard') newRes = Math.min(newA, newB);
    if (op === 'algebraic') newRes = newA * newB;
    if (op === 'bounded') newRes = Math.max(0, newA + newB - 1);
    if (op === 'drastic') { if (newB === 1) newRes = newA; else if (newA === 1) newRes = newB; else newRes = 0; }

    setRevResult(Number(newRes.toFixed(2)));
    setUserAnswerB('');
    setValidation(null);
  };

  const handleValidate = () => {
    const ans = parseFloat(userAnswerB);
    if (isNaN(ans)) return;
    setValidation(validateReverseChallenge(challenge, ans, language));
  };

  const { profile } = useAuth();

  const handleForwardExport = () => {
    const userName =
      profile?.full_name?.split(' ')[0] ||
      (isArabic ? 'مستخدم Y HUB' : 'Y HUB User');
    exportSolverPDF({
      title: copy.forwardReport,
      userName,
      operation: tnorm,
      inputs: { [copy.inputA]: numA, [copy.inputB]: numB },
      result,
      proof
    });
  };

  const handleReverseExport = () => {
    if (!validation) return;
    const userName =
      profile?.full_name?.split(' ')[0] ||
      (isArabic ? 'مستخدم Y HUB' : 'Y HUB User');
    exportSolverPDF({
      title: copy.reverseReport,
      userName,
      operation: revOperation,
      inputs: {
        [copy.givenA]: revA,
        [copy.targetResult]: revResult,
        [copy.guessedB]: userAnswerB,
      },
      result: validation.isCorrect ? copy.valid : copy.invalid,
      proof: validation.proof,
      isCorrect: validation.isCorrect
    });
  };


  return {
    t,
    isArabic,
    copy,
    a,
    setA,
    b,
    setB,
    tnorm,
    setTnorm,
    result,
    proof,
    revA,
    revResult,
    revOperation,
    userAnswerB,
    setUserAnswerB,
    challenge,
    validation,
    generateNewChallenge,
    handleValidate,
    handleForwardExport,
    handleReverseExport
  };
}
