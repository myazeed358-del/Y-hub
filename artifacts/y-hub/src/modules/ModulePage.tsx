import * as React from 'react';
import { ErrorBoundary } from '@/shared/errors/ErrorBoundary';
import { DefaultFallback } from '@/shared/errors/DefaultErrorFallback';
import type { ErrorFallbackProps } from '@/shared/errors/types';
import type { RegisteredModuleRoute } from './registry';

/** Mounted only after the host guard grants access; errors stay inside the route. */
export function ModulePage({ route }: { route: RegisteredModuleRoute }) {
  const [attempt, retry] = React.useReducer((value: number) => value + 1, 0);
  const Entry = React.useMemo(() => React.lazy(route.load), [route.load, attempt]);
  const Fallback = ({ error, resetError }: ErrorFallbackProps) => (
    <DefaultFallback error={error} resetError={() => { retry(); resetError(); }} />
  );
  return (
    <ErrorBoundary key={route.path} resetKey={route.path} FallbackComponent={Fallback}>
      <React.Suspense fallback={<div role="status">جاري التحميل... / Loading...</div>}>
        <Entry />
      </React.Suspense>
    </ErrorBoundary>
  );
}
