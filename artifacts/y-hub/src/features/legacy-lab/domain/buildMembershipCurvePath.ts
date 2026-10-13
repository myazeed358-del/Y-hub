import {
  sampleMembershipCurve,
  type MembershipFunctionType,
  type MembershipParameters,
} from '@/utils/fuzzyLogic';

export function buildMembershipCurvePath(
  type: MembershipFunctionType,
  params: MembershipParameters
): string {
  return sampleMembershipCurve(type, params)
    .map(({ x, y }, index) =>
      `${index === 0 ? 'M' : 'L'} ${x * 3.9 + 10} ${194 - y * 160}`
    )
    .join(' ');
}
