import type { MathStep, InequalityTransformationData } from '../types/step';

interface InequalityStepOptions {
  type?: MathStep['type'];
  details?: Record<string, unknown>;
  transformation?: InequalityTransformationData;
}

/** Single shared trace writer for all inequality strategies. */
export class InequalityStepWriter {
  public appendStep(
    steps: MathStep[],
    title: string,
    explanation: string,
    options: InequalityStepOptions = {}
  ): void {
    steps.push({
      id: `inequality_${steps.length}`,
      title,
      explanation,
      ...options
    });
  }
}
