import * as React from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/features/app-shell';
import { AppRoutes } from '@/routing/AppRoutes';
import Home from '@/pages/legacy/Home';
import CoursePlan from '@/pages/legacy/CoursePlan';
import LessonPage from '@/pages/legacy/LessonPage';
import NotFound from '@/pages/legacy/NotFound';
import Lab from '@/pages/legacy/Lab';
import Quiz from '@/pages/legacy/Quiz';

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

export function ApplicationFrame() {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))]">
        <div className="text-sm font-semibold text-[hsl(var(--muted-foreground))] animate-pulse">
          جاري تحميل Y HUB...
        </div>
      </div>
    );
  }

  const routes = (
    <RoutedErrorBoundary>
      <AppRoutes
        Home={Home}
        CoursePlan={CoursePlan}
        LessonPage={LessonPage}
        Lab={Lab}
        Quiz={Quiz}
        NotFound={NotFound}
      />
    </RoutedErrorBoundary>
  );

  const isAuthRoute =
    location.startsWith('/login') ||
    location.startsWith('/reset-password');

  if (!user || isAuthRoute) {
    return routes;
  }

  return <AppShell>{routes}</AppShell>;
}
