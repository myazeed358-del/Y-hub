import { useState, useEffect } from 'react';
import { useRoute, Link } from 'wouter';
import { supabase } from '@/utils/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@workspace/y-hub-ds/components/ui/card';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { FileText, Link as LinkIcon, Video, ArrowRight, Loader2, BookOpen, BrainCircuit, ShieldAlert, UserPlus } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { toast } from 'sonner';

export default function StudentCourseView() {
  const [, params] = useRoute('/course/:id/view');
  const courseId = params?.id || '';
  const { user } = useAuth();

  const [course, setCourse] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null); // null = still checking
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    async function loadCourse() {
      if (!courseId || !user) return;
      setLoading(true);

      // Always fetch the course metadata (discoverable)
      const { data: courseData } = await supabase
        .from('courses')
        .select('id, title, description, course_code, is_published')
        .eq('id', courseId)
        .single();

      if (courseData) setCourse(courseData);

      // Check enrollment status
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .select('id')
        .eq('course_id', courseId)
        .eq('student_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      const enrolled = !!enrollment;
      setIsEnrolled(enrolled);

      if (enrolled) {
        // Only fetch protected content if enrolled — RLS enforces this server-side too
        const { data: materialsData } = await supabase
          .from('course_materials')
          .select('*')
          .eq('course_id', courseId)
          .order('created_at', { ascending: false });
        if (materialsData) setMaterials(materialsData);

        const { data: examsData } = await supabase
          .from('exams')
          .select('*')
          .eq('course_id', courseId)
          .eq('is_published', true)
          .order('created_at', { ascending: false });
        if (examsData) setExams(examsData);
      }

      setLoading(false);
    }
    loadCourse();
  }, [courseId, user]);

  const handleEnroll = async () => {
    if (!user || !courseId) return;
    setEnrolling(true);
    try {
      const { error } = await supabase.from('course_enrollments').insert({
        course_id: courseId,
        student_id: user.id,
        status: 'active',
      });

      if (error) {
        if (error.code === '23505') {
          toast.info('أنت مسجّل في هذا المساق مسبقاً');
          setIsEnrolled(true);
        } else {
          toast.error('فشل التسجيل: ' + error.message);
        }
      } else {
        toast.success('تم التسجيل في المساق بنجاح!');
        setIsEnrolled(true);
        // Reload materials & exams now that we're enrolled
        const { data: materialsData } = await supabase
          .from('course_materials')
          .select('*')
          .eq('course_id', courseId)
          .order('created_at', { ascending: false });
        if (materialsData) setMaterials(materialsData);

        const { data: examsData } = await supabase
          .from('exams')
          .select('*')
          .eq('course_id', courseId)
          .eq('is_published', true)
          .order('created_at', { ascending: false });
        if (examsData) setExams(examsData);
      }
    } catch (e: any) {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={48} /></div>;
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <h3 className="text-xl font-bold">المقرر غير موجود أو غير متاح</h3>
        <Link href="/dashboard"><Button className="mt-4">العودة للوحة القيادة</Button></Link>
      </div>
    );
  }

  // Enrollment gate — course is visible but content is locked
  if (!isEnrolled) {
    return (
      <div className="mx-auto max-w-2xl py-20 px-5 text-center" dir="rtl">
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-full bg-[hsl(var(--primary)/.1)] flex items-center justify-center">
            <ShieldAlert className="text-[hsl(var(--primary))]" size={40} />
          </div>
        </div>
        <h2 className="text-2xl font-extrabold text-[hsl(var(--foreground))]">{course.title}</h2>
        <p className="mt-3 text-[hsl(var(--muted-foreground))] leading-relaxed max-w-md mx-auto">
          {course.description || 'هذا المساق يتطلب التسجيل للوصول إلى محتواه.'}
        </p>
        <div className="mt-2 inline-block">
          {course.course_code && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/.2)]">
              {course.course_code}
            </span>
          )}
        </div>
        <div className="mt-8 p-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <p className="font-bold text-lg mb-1">التسجيل مطلوب</p>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
            سجّل في هذا المساق للوصول إلى المواد الدراسية والاختبارات والمعلم الذكي.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button
              className="gap-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/.9)] rounded-xl px-8"
              onClick={handleEnroll}
              disabled={enrolling}
            >
              {enrolling ? (
                <><Loader2 size={16} className="animate-spin" /> جاري التسجيل...</>
              ) : (
                <><UserPlus size={18} /> سجّل الآن</>
              )}
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" className="rounded-xl gap-2">
                <ArrowRight size={16} /> العودة للوحة القيادة
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Enrolled — render full course view
  return (
    <div className="mx-auto max-w-5xl py-10 px-5" dir="rtl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="outline" size="icon"><ArrowRight size={16} /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{course.title}</h1>
            <p className="text-muted-foreground mt-1">{course.description || 'لا يوجد وصف'}</p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="flex gap-4 mb-8">
        <Link href={`/course/${course.id}/ai-tutor`}>
          <Button size="lg" className="gap-2 font-bold bg-primary text-primary-foreground hover:bg-primary/90">
            <BookOpen size={20} />
            الدخول للمعلم الذكي (AI Tutor)
          </Button>
        </Link>
      </div>

      <div className="mb-10">
        <h2 className="text-2xl font-bold mb-6">مواد المقرر الدراسية</h2>
        {materials.length === 0 ? (
          <Card className="bg-muted/30 border-dashed text-center py-12">
            <CardContent className="flex flex-col items-center justify-center">
              <BookOpen className="text-muted-foreground opacity-50 mb-4" size={48} />
              <h3 className="text-lg font-bold">لا يوجد مواد متاحة</h3>
              <p className="text-muted-foreground mt-2">لم يتم إضافة أي مواد أو روابط لهذا المقرر بعد.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {materials.map((mat) => (
              <Card key={mat.id} className="flex flex-row items-center p-4 hover:bg-muted/20 transition-colors">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary ml-4 shrink-0">
                  {mat.type === 'pdf' ? <FileText size={24} /> : mat.type === 'video' ? <Video size={24} /> : <LinkIcon size={24} />}
                </div>
                <div className="flex-1 overflow-hidden">
                  <h4 className="font-bold truncate">{mat.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 uppercase">{mat.type}</p>
                </div>
                <Button variant="secondary" className="mr-4" onClick={() => window.open(mat.url, '_blank')}>
                  {mat.type === 'link' || mat.type === 'video' ? 'فتح الرابط' : 'عرض الملف'}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-6">الاختبارات والتمارين</h2>
        {exams.length === 0 ? (
          <Card className="bg-muted/30 border-dashed text-center py-12">
            <CardContent className="flex flex-col items-center justify-center">
              <BrainCircuit className="text-muted-foreground opacity-50 mb-4" size={48} />
              <h3 className="text-lg font-bold">لا يوجد اختبارات</h3>
              <p className="text-muted-foreground mt-2">لم يقم المعلم بنشر أي اختبارات بعد.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {exams.map((ex) => (
              <Card key={ex.id} className="flex flex-col relative group">
                <CardHeader>
                  <CardTitle className="text-xl">{ex.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">المدة المسموحة: {ex.time_limit_minutes} دقيقة</p>
                </CardHeader>
                <CardContent className="flex-1"></CardContent>
                <CardFooter className="border-t pt-4">
                  <Link href={`/exam/${ex.id}`}>
                    <Button className="w-full font-bold">ابدأ الاختبار</Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
