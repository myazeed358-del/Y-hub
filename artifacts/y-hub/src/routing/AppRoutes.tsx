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
import { moduleRegistry, type ModuleRegistry } from '@/modules';
import { ModulePage } from '@/modules/ModulePage';

type AppRoutesProps = {
  Home: React.ComponentType;
  CoursePlan: React.ComponentType;
  LessonPage: React.ComponentType;
  Lab: React.ComponentType;
  Quiz: React.ComponentType;
  NotFound: React.ComponentType;
  modules?: ModuleRegistry;
};

export function AppRoutes({
  Home,
  CoursePlan,
  LessonPage,
  Quiz,
  NotFound,
  modules = moduleRegistry,
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
      {modules.routes.map(route => (
        <Route key={route.path} path={route.path}>
          {() => <ProtectedRoute component={ModulePage} route={route}
            moduleAccess={route.module.access} engineId={route.module.kind === 'engine' ? route.module.id : undefined} />}
        </Route>
      ))}
      <Route path="/legacy-home">{() => <ProtectedRoute component={Home} />}</Route>
      <Route path="/legacy-course">{() => <ProtectedRoute component={CoursePlan} />}</Route>
      <Route path="/lesson/:slug">{(params) => <ProtectedRoute component={LessonPage} params={params} />}</Route>
      <Route path="/quiz">{() => <ProtectedRoute component={Quiz} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}
