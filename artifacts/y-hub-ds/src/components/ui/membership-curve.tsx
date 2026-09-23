import { cn } from '../../lib/utils';

type CurveType = 'triangle' | 'trapezoid' | 'gaussian';

export function MembershipCurve({
  type = 'triangle',
  tone = 'primary',
  className,
}: {
  type?: CurveType;
  tone?: 'primary' | 'accent' | 'coral';
  className?: string;
}) {
  const color = tone === 'accent' ? 'hsl(var(--accent))' : tone === 'coral' ? 'hsl(var(--chart-4))' : 'hsl(var(--primary))';
  const path = type === 'gaussian'
    ? 'M 2 94 C 16 94 21 91 28 80 C 40 55 49 17 61 17 C 74 17 83 55 94 80 C 101 91 106 94 118 94'
    : type === 'trapezoid'
      ? 'M 2 94 L 28 94 L 44 20 L 78 20 L 98 94 L 118 94'
      : 'M 2 94 L 58 18 L 118 94';

  return (
    <svg className={cn('h-full w-full', className)} viewBox="0 0 120 100" preserveAspectRatio="none" role="img" aria-label={`${type} membership curve`}>
      <path d="M 2 94 H 118" stroke="currentColor" strokeOpacity=".16" strokeWidth="1" />
      <path d="M 2 94 V 8" stroke="currentColor" strokeOpacity=".16" strokeWidth="1" />
      <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}