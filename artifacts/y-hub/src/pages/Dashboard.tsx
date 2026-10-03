import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { Link } from 'wouter';
import { supabase } from '@/utils/supabaseClient';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@workspace/y-hub-ds/components/ui/card';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@workspace/y-hub-ds/components/ui/dialog';
import { BookOpen, Plus, Trash2, ArrowRight, Eye, EyeOff, Loader2, BookMarked, Globe, FileEdit, Settings2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

function StatCard({ title, value, icon: Icon, description }: any) {
  return (
    <Card className="bg-[hsl(var(--card))] border-[hsl(var(--border))] shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]">
            <Icon size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{title}</p>
            <h4 className="text-2xl font-bold text-[hsl(var(--foreground))] mt-1">{value}</h4>
            {description && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{description}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [courses, setCourses] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCode, setNewCode] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();

  const loadCourses = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setCourses(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCourses();
  }, [user]);

  const handleCreateCourse = async () => {
    if (!newTitle) {
      toast.error('يرجى إدخال عنوان المساق');
      return;
    }
    
    const { error } = await supabase.from('courses').insert({
      title: newTitle,
      description: newDesc,
      course_code: newCode,
      instructor_id: user?.id,
      is_published: false
    });
    
    if (error) {
      toast.error('فشل إنشاء المساق');
      console.error(error);
    } else {
      toast.success('تم إنشاء المساق بنجاح');
      setNewTitle('');
      setNewDesc('');
      setNewCode('');
      setIsOpen(false);
      loadCourses();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذا المساق نهائياً؟')) {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) toast.error('فشل حذف المساق');
      else {
        toast.success('تم حذف المساق');
        loadCourses();
      }
    }
  };

  const handleToggleStatus = async (course: any) => {
    const { error } = await supabase
      .from('courses')
      .update({ is_published: !course.is_published })
      .eq('id', course.id);
      
    if (error) toast.error('فشل تحديث حالة المساق');
    else {
      toast.success(course.is_published ? 'تم إلغاء نشر المساق' : 'تم نشر المساق');
      loadCourses();
    }
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'أستاذ';
  const publishedCount = courses.filter(c => c.is_published).length;
  const draftCount = courses.length - publishedCount;

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-in fade-in duration-500" dir="rtl">
      
      {/* HERO SECTION */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(var(--card))] to-[hsl(var(--background))] border border-[hsl(var(--border))] p-8 md:p-12 shadow-sm">
        <div className="absolute top-0 right-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-[hsl(var(--primary)/.05)] blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[hsl(var(--foreground))]">
              أهلاً بك، {firstName}
            </h1>
            <p className="mt-2 text-[hsl(var(--muted-foreground))] max-w-xl leading-relaxed">
              مركز إدارة التعليم الأكاديمي. قم ببناء وإدارة مساقاتك، وتتبع تقدم الطلاب من خلال واجهة موحدة واحترافية.
            </p>
          </div>
          <div className="flex gap-3">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/.9)] rounded-xl shadow-lg shadow-[hsl(var(--primary)/.2)]">
                  <Plus size={18} /> مساق جديد
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl" className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl">إنشاء مساق أكاديمي جديد</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[hsl(var(--foreground))]">عنوان المساق</label>
                    <Input value={newTitle} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)} placeholder="مثال: الجبر الخطي المتقدم" className="bg-[hsl(var(--background))]" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[hsl(var(--foreground))]">رمز المساق (Code)</label>
                    <Input value={newCode} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewCode(e.target.value)} placeholder="مثال: MATH301" className="bg-[hsl(var(--background))]" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-[hsl(var(--foreground))]">وصف المساق</label>
                    <Input value={newDesc} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewDesc(e.target.value)} placeholder="وصف قصير لأهداف المساق..." className="bg-[hsl(var(--background))]" />
                  </div>
                  <Button className="w-full mt-2" onClick={handleCreateCourse}>حفظ المساق</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </section>

      {/* OVERVIEW STATS */}
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard 
          title="إجمالي المساقات" 
          value={loading ? '-' : courses.length.toString()} 
          icon={BookMarked} 
          description="المساقات التي تديرها" 
        />
        <StatCard 
          title="المساقات المنشورة" 
          value={loading ? '-' : publishedCount.toString()} 
          icon={Globe} 
          description="متاحة للطلاب حالياً" 
        />
        <StatCard 
          title="مسودات" 
          value={loading ? '-' : draftCount.toString()} 
          icon={FileEdit} 
          description="قيد التحضير والإعداد" 
        />
      </section>

      {/* COURSES CATALOG */}
      <section>
        <div className="flex items-center justify-between mb-6 px-1">
          <h2 className="text-xl font-bold text-[hsl(var(--foreground))]">إدارة المساقات</h2>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[hsl(var(--primary))]" size={40} /></div>
        ) : courses.length === 0 ? (
          <div className="text-center py-24 bg-[hsl(var(--card)/.5)] rounded-3xl border border-dashed border-[hsl(var(--border))]">
            <BookOpen className="mx-auto text-[hsl(var(--muted-foreground)/.5)] mb-4" size={48} />
            <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">لا يوجد مساقات بعد</h3>
            <p className="text-[hsl(var(--muted-foreground))] mt-2 max-w-sm mx-auto">
              ابدأ بإنشاء أول مساق أكاديمي لتقديم المحتوى للطلاب.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {courses.map(course => (
              <Card key={course.id} className={`flex flex-col relative group transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${course.is_published ? 'bg-[hsl(var(--card))] border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/.5)]' : 'bg-[hsl(var(--card)/.6)] border-[hsl(var(--border))] border-dashed hover:border-[hsl(var(--muted-foreground)/.5)]'}`}>
                
                <div className="absolute top-4 left-4 z-10">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${course.is_published ? 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/.2)]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]'}`}>
                    {course.is_published ? 'منشور' : 'مسودة'}
                  </span>
                </div>

                <CardHeader className="pb-4 pt-5 pl-20">
                  <div className="flex items-center mb-2">
                    {course.course_code && (
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] border border-[hsl(var(--border))]">
                        {course.course_code}
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-lg leading-tight">{course.title}</CardTitle>
                  <CardDescription className="line-clamp-2 text-xs mt-2 leading-relaxed text-[hsl(var(--muted-foreground))]">
                    {course.description || 'لا يوجد وصف مقدّم.'}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="flex-1">
                </CardContent>
                
                <CardFooter className="pt-4 border-t border-[hsl(var(--border)/.5)] flex justify-between gap-2">
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(course.id)} className="h-9 w-9 text-[hsl(var(--destructive)/.8)] hover:text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/.1)] rounded-lg">
                      <Trash2 size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(course)} className="h-9 w-9 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] rounded-lg">
                      {course.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                  <Link href={`/course/${course.id}`} className="flex-1">
                    <Button className="w-full gap-2 rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))] border border-[hsl(var(--border))] hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))] hover:border-[hsl(var(--primary))] transition-all">
                      <Settings2 size={16} /> إدارة 
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
