import * as React from 'react';
import { Route, Switch } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { ProtectedRoute } from '@/routing/ProtectedRoute';
import { RoleBasedDashboard } from '@/routing/RoleBasedDashboard';
import Login from '@/pages/Login';
import ResetPassword from '@/pages/ResetPassword';
import GuestLanding from '@/pages/GuestLanding';
import ProfilePage from '@/pages/Profile';
import CourseManager from '@/pages/CourseManager';
import StudentCourseView from '@/pages/StudentCourseView';
import AIGenerator from '@/pages/AIGenerator';
import ExamRunner from '@/pages/ExamRunner';
import MathSolver from '@/pages/MathSolver';
import CalculusSolver from '@/pages/CalculusSolver';
import Solver from '@/pages/Solver';

const Calculus1Page = React.lazy(
  () => import('@/features/calculus-1/pages/Calculus1Page')
);

function Calculus1Route() {
  return (
    <React.Suspense fallback={<div role="status">جاري التحميل... / Loading...</div>}>
      <Calculus1Page />
    </React.Suspense>
  );
}

const OdePage = React.lazy(
  () => import('@/features/ode/pages/OdePage')
);

function OdeRoute() {
  return (
    <React.Suspense fallback={<div role="status">Loading ODE...</div>}>
      <OdePage />
    </React.Suspense>
  );
}

const LinearAlgebraPage = React.lazy(
  () => import('@/features/linear-algebra/pages/LinearAlgebraPage')
);

function LinearAlgebraRoute() {
  return (
    <React.Suspense fallback={<div role="status">جاري التحميل... / Loading...</div>}>
      <LinearAlgebraPage />
    </React.Suspense>
  );
}

type AppRoutesProps = {
  Home: React.ComponentType;
  CoursePlan: React.ComponentType;
  LessonPage: React.ComponentType;
  Lab: React.ComponentType;
  Quiz: React.ComponentType;
  NotFound: React.ComponentType;
};

export function AppRoutes({
  Home,
  CoursePlan,
  LessonPage,
  Lab,
  Quiz,
  NotFound,
}: AppRoutesProps) {
  const { user, loading } = useAuth();
  const { language, setLanguage } = useLanguage();
  if (loading) return null;

  return (
    <Switch>
      <Route path="/reset-password">
        {() => (
          <ResetPassword
            language={language}
            onToggleLanguage={() =>
              setLanguage(language === 'ar' ? 'en' : 'ar')
            }
          />
        )}
      </Route>
      <Route path="/login">
        {() => (
          <Login
            language={language}
            onToggleLanguage={() =>
              setLanguage(language === 'ar' ? 'en' : 'ar')
            }
          />
        )}
      </Route>
      <Route path="/">
        {() =>
          user
            ? <ProtectedRoute component={RoleBasedDashboard} />
            : (
              <GuestLanding
                language={language}
                onToggleLanguage={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              />
            )
        }
      </Route>
      <Route path="/dashboard">{() => <ProtectedRoute component={RoleBasedDashboard} />}</Route>
      <Route path="/profile">{() => <ProtectedRoute component={ProfilePage} />}</Route>
      <Route path="/course/:id">{(params) => <ProtectedRoute component={CourseManager} roleRequired="instructor" params={params} />}</Route>
      <Route path="/course/:id/view">{(params) => <ProtectedRoute component={StudentCourseView} params={params} />}</Route>
      <Route path="/course/:id/ai-tutor">{(params) => <ProtectedRoute component={AIGenerator} params={params} />}</Route>
      <Route path="/exam/:id">{(params) => <ProtectedRoute component={ExamRunner} params={params} />}</Route>
      <Route path="/ode">
        {() => (
          <ProtectedRoute component={OdeRoute} enginePath="/ode" />
        )}
      </Route>
      <Route path="/linear-algebra">
        {() => (
          <ProtectedRoute
            component={LinearAlgebraRoute}
            enginePath="/linear-algebra"
          />
        )}
      </Route>
      <Route path="/math-solver">{() => <ProtectedRoute component={MathSolver} enginePath="/math-solver" />}</Route>
      <Route path="/solver">{() => <ProtectedRoute component={Solver} enginePath="/solver" />}</Route>
      <Route path="/calculus-1">
        {() => <ProtectedRoute component={Calculus1Route} enginePath="/calculus-1" />}
      </Route>
      <Route path="/calculus">{() => <ProtectedRoute component={CalculusSolver} enginePath="/calculus" />}</Route>
      <Route path="/legacy-home">{() => <ProtectedRoute component={Home} />}</Route>
      <Route path="/legacy-course">{() => <ProtectedRoute component={CoursePlan} />}</Route>
      <Route path="/lesson/:slug">{(params) => <ProtectedRoute component={LessonPage} params={params} />}</Route>
      <Route path="/lab">{() => <ProtectedRoute component={Lab} enginePath="/lab" />}</Route>
      <Route path="/quiz">{() => <ProtectedRoute component={Quiz} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}
