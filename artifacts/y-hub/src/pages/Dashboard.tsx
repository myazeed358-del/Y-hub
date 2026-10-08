import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'wouter';
import {
  ArrowUpRight,
  BookMarked,
  BookOpen,
  Eye,
  EyeOff,
  FileEdit,
  Globe2,
  GraduationCap,
  Loader2,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/utils/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '../App';

import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/y-hub-ds/components/ui/dialog';

interface Course {
  id: string;
  title: string;
  description?: string | null;
  course_code?: string | null;
  instructor_id?: string | null;
  is_published: boolean;
  created_at?: string | null;
}

export default function Dashboard() {
  const { user, profile, role } = useAuth();
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [courses, setCourses] = useState<Course[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCode, setNewCode] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const copy = isArabic
    ? {
        workspace: 'مساحة المدرّس',
        welcome: 'أهلاً بك،',
        subtitle:
          'ابنِ مساقاتك الأكاديمية وأدر محتواها ونشرها من مساحة واحدة متناسقة داخل Y HUB.',
        newCourse: 'مساق جديد',
        createCourse: 'إنشاء مساق أكاديمي جديد',
        courseTitle: 'عنوان المساق',
        courseTitlePlaceholder: 'مثال: الجبر الخطي المتقدم',
        courseCode: 'رمز المساق',
        courseCodePlaceholder: 'مثال: MATH301',
        courseDescription: 'وصف المساق',
        courseDescriptionPlaceholder: 'وصف مختصر لأهداف ومحتوى المساق...',
        saveCourse: 'حفظ المساق',
        totalCourses: 'إجمالي المساقات',
        totalDescription: 'كل المساقات التي تديرها',
        published: 'المساقات المنشورة',
        publishedDescription: 'متاحة للطلاب حالياً',
        drafts: 'المسودات',
        draftsDescription: 'قيد التحضير والإعداد',
        courseManagement: 'إدارة المساقات',
        courseManagementSubtitle:
          'راجع المساقات، غيّر حالة النشر أو ادخل إلى مساحة إدارة المحتوى.',
        noCourses: 'لا توجد مساقات بعد',
        noCoursesText:
          'ابدأ بإنشاء أول مساق أكاديمي. سيظهر هنا فور حفظه.',
        publishedBadge: 'منشور',
        draftBadge: 'مسودة',
        noDescription: 'لم تتم إضافة وصف لهذا المساق بعد.',
        manage: 'إدارة المساق',
        publish: 'نشر المساق',
        unpublish: 'إلغاء النشر',
        delete: 'حذف المساق',
        loading: 'جاري تحميل المساقات...',
        titleRequired: 'يرجى إدخال عنوان المساق',
        createSuccess: 'تم إنشاء المساق بنجاح',
        createError: 'تعذر إنشاء المساق',
        deleteConfirm: 'هل أنت متأكد من حذف هذا المساق نهائياً؟',
        deleteSuccess: 'تم حذف المساق',
        deleteError: 'تعذر حذف المساق',
        publishSuccess: 'تم نشر المساق',
        unpublishSuccess: 'تم إلغاء نشر المساق',
        statusError: 'تعذر تحديث حالة المساق',
        academicControl: 'إدارة أكاديمية موحدة',
        sync: 'متصل بقاعدة البيانات',
        roleInstructor: 'مدرّس',
        roleAdmin: 'مدير',
        roleSuperAdmin: 'مدير رئيسي',
      }
    : {
        workspace: 'Instructor workspace',
        welcome: 'Welcome,',
        subtitle:
          'Build, organize and publish your academic courses from one consistent Y HUB workspace.',
        newCourse: 'New course',
        createCourse: 'Create a new academic course',
        courseTitle: 'Course title',
        courseTitlePlaceholder: 'Example: Advanced Linear Algebra',
        courseCode: 'Course code',
        courseCodePlaceholder: 'Example: MATH301',
        courseDescription: 'Course description',
        courseDescriptionPlaceholder:
          'A short description of the course goals and content...',
        saveCourse: 'Save course',
        totalCourses: 'Total courses',
        totalDescription: 'All courses you manage',
        published: 'Published courses',
        publishedDescription: 'Currently available to students',
        drafts: 'Draft courses',
        draftsDescription: 'Still being prepared',
        courseManagement: 'Course management',
        courseManagementSubtitle:
          'Review courses, control publishing, or open the content workspace.',
        noCourses: 'No courses yet',
        noCoursesText:
          'Create your first academic course. It will appear here immediately.',
        publishedBadge: 'Published',
        draftBadge: 'Draft',
        noDescription: 'No description has been added to this course yet.',
        manage: 'Manage course',
        publish: 'Publish course',
        unpublish: 'Unpublish course',
        delete: 'Delete course',
        loading: 'Loading courses...',
        titleRequired: 'Please enter a course title',
        createSuccess: 'Course created successfully',
        createError: 'Could not create the course',
        deleteConfirm: 'Are you sure you want to permanently delete this course?',
        deleteSuccess: 'Course deleted',
        deleteError: 'Could not delete the course',
        publishSuccess: 'Course published',
        unpublishSuccess: 'Course unpublished',
        statusError: 'Could not update the course status',
        academicControl: 'Unified academic management',
        sync: 'Database connected',
        roleInstructor: 'Instructor',
        roleAdmin: 'Admin',
        roleSuperAdmin: 'Super Admin',
      };

  const loadCourses = async () => {
    if (!user) {
      setCourses([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load instructor courses:', error);
      setCourses([]);
    } else {
      setCourses((data ?? []) as Course[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadCourses();
  }, [user]);

  const resetCourseForm = () => {
    setNewTitle('');
    setNewDesc('');
    setNewCode('');
  };

  const handleCreateCourse = async () => {
    if (!newTitle.trim()) {
      toast.error(copy.titleRequired);
      return;
    }

    if (!user) return;

    const { error } = await supabase.from('courses').insert({
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      course_code: newCode.trim() || null,
      instructor_id: user.id,
      is_published: false,
    });

    if (error) {
      console.error('Failed to create course:', error);
      toast.error(copy.createError);
      return;
    }

    toast.success(copy.createSuccess);
    resetCourseForm();
    setIsOpen(false);
    await loadCourses();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(copy.deleteConfirm)) return;

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete course:', error);
      toast.error(copy.deleteError);
      return;
    }

    toast.success(copy.deleteSuccess);
    await loadCourses();
  };

  const handleToggleStatus = async (course: Course) => {
    const { error } = await supabase
      .from('courses')
      .update({ is_published: !course.is_published })
      .eq('id', course.id);

    if (error) {
      console.error('Failed to update course status:', error);
      toast.error(copy.statusError);
      return;
    }

    toast.success(
      course.is_published
        ? copy.unpublishSuccess
        : copy.publishSuccess
    );

    await loadCourses();
  };

  const accountName =
    profile?.full_name?.trim() ||
    user?.email?.split('@')[0] ||
    (isArabic ? 'مستخدم Y HUB' : 'Y HUB User');

  const firstName = accountName.split(/\s+/)[0] || accountName;

  const publishedCount = courses.filter(
    (course) => course.is_published
  ).length;

  const draftCount = courses.length - publishedCount;

  const roleLabel =
    role === 'super_admin'
      ? copy.roleSuperAdmin
      : role === 'admin'
        ? copy.roleAdmin
        : copy.roleInstructor;

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="mx-auto w-full max-w-[1320px] space-y-7 animate-in fade-in duration-500"
    >
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-800/80 bg-[#0b1220]/90 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.24)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/[0.09] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-violet-500/[0.08] blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/[0.06] px-3 py-1.5 text-[11px] font-black text-cyan-300">
                <GraduationCap size={14} />
                {copy.workspace}
              </span>

              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                <ShieldCheck size={13} />
                {roleLabel}
              </span>
            </div>

            <h1 className="max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
              {copy.welcome}{' '}
              <span className="bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">
                {firstName}
              </span>
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
              {copy.subtitle}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-2">
                <Sparkles size={13} className="text-violet-400" />
                {copy.academicControl}
              </span>

              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,.9)]" />
                {copy.sync}
              </span>
            </div>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="h-12 gap-2 rounded-2xl bg-cyan-400 px-5 font-black text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,.18)] hover:bg-cyan-300">
                <Plus size={18} />
                {copy.newCourse}
              </Button>
            </DialogTrigger>

            <DialogContent
              dir={isArabic ? 'rtl' : 'ltr'}
              className="border-slate-800 bg-[#0b1220] text-slate-100 sm:max-w-lg"
            >
              <DialogHeader>
                <DialogTitle className="text-xl font-black">
                  {copy.createCourse}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5 pt-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-300">
                    {copy.courseTitle}
                  </label>

                  <Input
                    value={newTitle}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setNewTitle(event.target.value)
                    }
                    placeholder={copy.courseTitlePlaceholder}
                    className="h-12 border-slate-800 bg-slate-950/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-300">
                    {copy.courseCode}
                  </label>

                  <Input
                    value={newCode}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setNewCode(event.target.value)
                    }
                    placeholder={copy.courseCodePlaceholder}
                    className="h-12 border-slate-800 bg-slate-950/50"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-300">
                    {copy.courseDescription}
                  </label>

                  <Input
                    value={newDesc}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setNewDesc(event.target.value)
                    }
                    placeholder={copy.courseDescriptionPlaceholder}
                    className="h-12 border-slate-800 bg-slate-950/50"
                  />
                </div>

                <Button
                  onClick={handleCreateCourse}
                  className="mt-2 h-12 w-full rounded-xl bg-cyan-400 font-black text-slate-950 hover:bg-cyan-300"
                >
                  {copy.saveCourse}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title={copy.totalCourses}
          value={loading ? '—' : courses.length.toString()}
          description={copy.totalDescription}
          icon={BookMarked}
          tone="cyan"
        />

        <StatCard
          title={copy.published}
          value={loading ? '—' : publishedCount.toString()}
          description={copy.publishedDescription}
          icon={Globe2}
          tone="violet"
        />

        <StatCard
          title={copy.drafts}
          value={loading ? '—' : draftCount.toString()}
          description={copy.draftsDescription}
          icon={FileEdit}
          tone="slate"
        />
      </section>

      <section className="rounded-[2rem] border border-slate-800/80 bg-[#0b1220]/65 p-5 sm:p-7">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-400">
              Y HUB
            </p>

            <h2 className="text-xl font-black text-white sm:text-2xl">
              {copy.courseManagement}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {copy.courseManagementSubtitle}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-4">
            <Loader2
              className="animate-spin text-cyan-400"
              size={34}
            />
            <p className="text-sm text-slate-500">
              {copy.loading}
            </p>
          </div>
        ) : courses.length === 0 ? (
          <div className="flex min-h-[290px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-slate-800 bg-slate-950/25 px-6 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.05]">
              <BookOpen
                className="text-slate-600"
                size={30}
              />
            </div>

            <h3 className="text-lg font-black text-slate-200">
              {copy.noCourses}
            </h3>

            <p className="mt-2 max-w-md text-sm leading-7 text-slate-500">
              {copy.noCoursesText}
            </p>

            <Button
              onClick={() => setIsOpen(true)}
              className="mt-6 gap-2 rounded-xl bg-cyan-400 font-black text-slate-950 hover:bg-cyan-300"
            >
              <Plus size={16} />
              {copy.newCourse}
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <article
                key={course.id}
                className="group relative flex min-h-[280px] flex-col overflow-hidden rounded-[1.5rem] border border-slate-800 bg-slate-950/35 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/20 hover:bg-slate-950/55 hover:shadow-[0_20px_45px_rgba(0,0,0,.18)]"
              >
                <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-cyan-400/[0.04] blur-3xl transition-opacity group-hover:bg-cyan-400/[0.08]" />

                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.05] bg-white/[0.025] text-cyan-400">
                    <BookOpen size={20} />
                  </div>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${
                      course.is_published
                        ? 'border-cyan-400/15 bg-cyan-400/[0.06] text-cyan-300'
                        : 'border-violet-400/15 bg-violet-400/[0.06] text-violet-300'
                    }`}
                  >
                    {course.is_published
                      ? copy.publishedBadge
                      : copy.draftBadge}
                  </span>
                </div>

                <div className="relative mt-5 flex-1">
                  {course.course_code && (
                    <div className="mb-2 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                      {course.course_code}
                    </div>
                  )}

                  <h3 className="line-clamp-2 text-lg font-black leading-7 text-slate-100">
                    {course.title}
                  </h3>

                  <p className="mt-3 line-clamp-3 text-xs leading-6 text-slate-500">
                    {course.description || copy.noDescription}
                  </p>
                </div>

                <div className="relative mt-6 border-t border-slate-800/80 pt-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title={copy.delete}
                      onClick={() => handleDelete(course.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 text-slate-500 transition-colors hover:border-red-400/20 hover:bg-red-500/[0.07] hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>

                    <button
                      type="button"
                      title={
                        course.is_published
                          ? copy.unpublish
                          : copy.publish
                      }
                      onClick={() => handleToggleStatus(course)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 text-slate-500 transition-colors hover:border-violet-400/20 hover:bg-violet-500/[0.07] hover:text-violet-300"
                    >
                      {course.is_published ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>

                    <Link
                      href={`/course/${course.id}`}
                      className="min-w-0 flex-1"
                    >
                      <Button className="h-10 w-full gap-2 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.07] font-bold text-cyan-300 hover:bg-cyan-400/[0.12] hover:text-cyan-200">
                        <Settings2 size={15} />
                        {copy.manage}
                        <ArrowUpRight size={14} />
                      </Button>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: 'cyan' | 'violet' | 'slate';
}) {
  const toneClasses = {
    cyan: {
      wrapper: 'border-cyan-400/10 bg-cyan-400/[0.035]',
      icon: 'border-cyan-400/10 bg-cyan-400/[0.07] text-cyan-300',
    },
    violet: {
      wrapper: 'border-violet-400/10 bg-violet-400/[0.035]',
      icon: 'border-violet-400/10 bg-violet-400/[0.07] text-violet-300',
    },
    slate: {
      wrapper: 'border-slate-800 bg-white/[0.02]',
      icon: 'border-white/[0.05] bg-white/[0.025] text-slate-400',
    },
  }[tone];

  return (
    <div
      className={`rounded-[1.5rem] border p-5 transition-transform duration-200 hover:-translate-y-0.5 ${toneClasses.wrapper}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${toneClasses.icon}`}
        >
          <Icon size={21} />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">
            {title}
          </p>

          <div className="mt-1 text-2xl font-black text-white">
            {value}
          </div>

          <p className="mt-1 truncate text-[10px] text-slate-600">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
