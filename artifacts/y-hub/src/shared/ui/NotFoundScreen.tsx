import * as React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center text-center"><div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--muted))] font-mono text-xl">404</div><h1 className="text-3xl font-extrabold">هذه الصفحة خارج المسار</h1><p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">يبدو أن هذه النقطة لم تُرسم بعد. عد إلى مكتبك لنكمل من حيث توقفنا.</p><Link href="/" data-testid="link-not-found-home" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-5 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]">العودة إلى المكتب <ArrowRight size={16} /></Link></div>;
}
