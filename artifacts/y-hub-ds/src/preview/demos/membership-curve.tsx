import { MembershipCurve } from '../../components/ui/membership-curve';

export function MembershipCurveDemo() {
  return (
    <div className="grid gap-4 rounded-2xl border bg-card p-8 sm:grid-cols-3">
      {[
        ['Triangular', 'triangle', 'primary'],
        ['Trapezoidal', 'trapezoid', 'accent'],
        ['Gaussian', 'gaussian', 'coral'],
      ].map(([label, type, tone]) => (
        <div key={label} className="rounded-xl bg-muted/60 p-4">
          <p className="text-sm font-semibold">{label}</p>
          <div className="mt-5 h-28">
            <MembershipCurve type={type as 'triangle' | 'trapezoid' | 'gaussian'} tone={tone as 'primary' | 'accent' | 'coral'} />
          </div>
        </div>
      ))}
    </div>
  );
}