import { Link } from 'wouter';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@workspace/y-hub-ds/components/ui/card';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import {
  FileText,
  Link as LinkIcon,
  Video,
  ArrowRight,
  BookOpen,
  BrainCircuit,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Props {
  course: {
    id: string;
    title: string;
    description?: string | null;
  };
  materials: Array<{
    id: string;
    type: string;
    title: string;
    url: string;
  }>;
  exams: Array<{
    id: string;
    title: string;
    time_limit_minutes: number;
  }>;
}

export function StudentCourseContent({
  course,
  materials,
  exams,
}: Props) {
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
