import * as React from 'react';
import { XCircle } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { canRoleAccessEngineRoute } from '@/config/majorEngineAccess';
import Login from '@/pages/Login';

type RouteRole = NonNullable<ReturnType<typeof useAuth>['role']>;

type ProtectedRouteProps<Props extends object> = Props & {
  component: React.ComponentType<Props>;
  roleRequired?: RouteRole;
  enginePath?: string;
  params?: Record<string, string | undefined>;
};

export function ProtectedRoute<Props extends object>({
  component: Component,
  roleRequired,
  enginePath,
  ...rest
}: ProtectedRouteProps<Props>) {
  const { user, role, profile, loading } = useAuth();
  const { language, setLanguage } = useLanguage();

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="text-lg font-semibold text-muted-foreground animate-pulse">جاري التحقق من الصلاحيات...</div>
    </div>
  );

  if (!user) {
    return (
      <Login
        language={language}
        onToggleLanguage={() =>
          setLanguage(language === 'ar' ? 'en' : 'ar')
        }
      />
    );
  }

  if (
    enginePath &&
    !canRoleAccessEngineRoute(role, profile?.major, enginePath)
  ) {
    return (
      <div className="flex min-h-[70vh] w-full flex-col items-center justify-center space-y-4 px-4 text-center">
        <XCircle className="h-14 w-14 text-[hsl(var(--destructive))]" />

        <h2 className="text-2xl font-bold">
          {language === 'ar'
            ? 'هذه الأداة غير متاحة لحسابك'
            : 'This tool is not available for your account'}
        </h2>

        <p className="max-w-md text-sm leading-7 text-[hsl(var(--muted-foreground))]">
          {language === 'ar'
            ? 'يستطيع الطالب استخدام الأدوات المرتبطة بتخصصه الأكاديمي فقط.'
            : 'Students can use only the academic engines associated with their major.'}
        </p>

        <Link href="/">
          <Button variant="default">
            {language === 'ar'
              ? 'العودة إلى الصفحة الرئيسية'
              : 'Back to overview'}
          </Button>
        </Link>
      </div>
    );
  }

  // Strict RBAC enforcement with admin bypass
  if (roleRequired && role !== roleRequired && role !== 'super_admin' && role !== 'admin') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center space-y-4 bg-background px-4 text-center">
        <XCircle className="h-16 w-16 text-destructive" />
        <h2 className="text-2xl font-bold">Access Denied (عذراً، وصول مرفوض)</h2>
        <p className="text-muted-foreground max-w-md">عذراً، هذه الصفحة مخصصة لحسابات ({roleRequired}) فقط. لا تملك الصلاحيات الكافية للوصول.</p>
        <Link href="/">
          <Button variant="default">العودة للصفحة الرئيسية</Button>
        </Link>
      </div>
    );
  }

  return <Component {...(rest as Props)} />;
}
