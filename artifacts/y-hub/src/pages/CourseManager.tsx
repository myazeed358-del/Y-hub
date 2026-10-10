import { useState, useEffect } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { useRoute, Link } from 'wouter';
import { supabase } from '@/utils/supabaseClient';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@workspace/y-hub-ds/components/ui/card';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@workspace/y-hub-ds/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workspace/y-hub-ds/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/y-hub-ds/components/ui/tabs';
import { ArrowRight, FileText, Link as LinkIcon, Video, Trash2, Loader2, Plus, BrainCircuit, Clock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function CourseManager() {
  const [, params] = useRoute('/course/:id');
  const courseId = params?.id || '';

  const [course, setCourse] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add material states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'pdf' | 'video' | 'link'>('pdf');
  const [newUrl, setNewUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Exam states
  const [isAddExamOpen, setIsAddExamOpen] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [examTimeLimit, setExamTimeLimit] = useState(30);

  // Question states
  const [selectedExam, setSelectedExam] = useState<any | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [qType, setQType] = useState<'mcq' | 'tf' | 'math'>('mcq');
  const [qContent, setQContent] = useState('');
  const [qCorrect, setQCorrect] = useState('');
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']); // For MCQ

  const loadData = async () => {
    setLoading(true);
    const { data: courseData } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (courseData) setCourse(courseData);

    const { data: materialsData } = await supabase.from('course_materials').select('*').eq('course_id', courseId).order('created_at', { ascending: false });
    if (materialsData) setMaterials(materialsData);

    const { data: examsData } = await supabase.from('exams').select('*').eq('course_id', courseId).order('created_at', { ascending: false });
    if (examsData) setExams(examsData);

    setLoading(false);
  };

  const loadQuestions = async (examId: string) => {
    const { data } = await supabase.from('questions').select('*').eq('exam_id', examId).order('created_at', { ascending: true });
    if (data) setQuestions(data);
  };

  useEffect(() => {
    if (courseId) loadData();
  }, [courseId]);

  const handleAddMaterial = async () => {
    if (!newTitle) {
      toast.error('يرجى إدخال عنوان المادة');
      return;
    }
    setIsUploading(true);
    let finalUrl = newUrl;
    if (newType === 'pdf' && uploadFile) {
      const fileName = `${Date.now()}-${uploadFile.name}`;
      const { error } = await supabase.storage.from('materials').upload(fileName, uploadFile);
      if (error) { toast.error('فشل رفع الملف'); setIsUploading(false); return; }
      const { data: pubData } = supabase.storage.from('materials').getPublicUrl(fileName);
      finalUrl = pubData.publicUrl;
    } else if (!newUrl) {
      toast.error('يرجى إدخال الرابط أو اختيار ملف');
      setIsUploading(false);
      return;
    }
    const { error } = await supabase.from('course_materials').insert({
      course_id: courseId, title: newTitle, type: newType, url: finalUrl
    });
    if (error) toast.error('فشل حفظ المادة');
    else {
      toast.success('تمت الإضافة بنجاح');
      setNewTitle(''); setNewUrl(''); setUploadFile(null); setIsAddOpen(false); loadData();
    }
    setIsUploading(false);
  };

  const handleDeleteMaterial = async (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه المادة؟')) {
      const mat = materials.find(m => m.id === id);
      if (mat?.type === 'pdf' && mat.url) {
        const fileName = mat.url.split('/').pop();
        if (fileName) {
          const { error: storageError } = await supabase.storage.from('materials').remove([fileName]);
          if (storageError) {
            toast.error('فشل حذف الملف من التخزين السحابي');
            console.error(storageError);
            return;
          }
        }
      }

      const { error: dbError } = await supabase.from('course_materials').delete().eq('id', id);
      if (dbError) {
        toast.error('فشل حذف المادة من قاعدة البيانات');
      } else {
        toast.success('تم الحذف بنجاح');
        loadData();
      }
    }
  };

  const handleCreateExam = async () => {
    if (!examTitle) {
      toast.error('يرجى كتابة عنوان الاختبار');
      return;
    }
    const { error } = await supabase.from('exams').insert({
      course_id: courseId, title: examTitle, time_limit_minutes: examTimeLimit
    });
    if (error) toast.error('فشل إنشاء الاختبار');
    else {
      toast.success('تم الإنشاء');
      setExamTitle(''); setIsAddExamOpen(false); loadData();
    }
  };

  const handleToggleExamPublish = async (exam: any) => {
    const { error } = await supabase.from('exams').update({ is_published: !exam.is_published }).eq('id', exam.id);
    if (!error) loadData();
  };

  const handleDeleteExam = async (id: string) => {
    if (confirm('تأكيد الحذف؟')) {
      await supabase.from('exams').delete().eq('id', id);
      if (selectedExam?.id === id) setSelectedExam(null);
      loadData();
    }
  };

  const handleAddQuestion = async () => {
    if (!qContent || !qCorrect || !selectedExam) {
      toast.error('أكمل البيانات');
      return;
    }
    
    let optionsToSave = null;
    if (qType === 'mcq') {
      const validOptions = qOptions.filter(o => o.trim() !== '');
      if (validOptions.length < 2) {
        toast.error('أضف خيارين على الأقل');
        return;
      }
      optionsToSave = validOptions;
      if (!validOptions.includes(qCorrect)) {
        toast.error('الإجابة الصحيحة غير موجودة في الخيارات');
        return;
      }
    }
    
    if (qType === 'tf') {
      optionsToSave = ['صح', 'خطأ'];
      if (qCorrect !== 'صح' && qCorrect !== 'خطأ') {
        toast.error('يجب أن تكون الإجابة صح أو خطأ');
        return;
      }
    }

    const { error } = await supabase.from('questions').insert({
      course_id: courseId,
      exam_id: selectedExam.id,
      content: qContent,
      type: qType,
      options: optionsToSave,
      correct_answer: qCorrect
    });

    if (error) toast.error('فشل حفظ السؤال');
    else {
      toast.success('تم الحفظ');
      setQContent(''); setQCorrect(''); setQOptions(['', '', '', '']); setIsAddQuestionOpen(false);
      loadQuestions(selectedExam.id);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (confirm('حذف السؤال؟')) {
      await supabase.from('questions').delete().eq('id', id);
      if (selectedExam) loadQuestions(selectedExam.id);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={48} /></div>;

  return (
    <div className="mx-auto max-w-6xl py-10 px-5" dir="rtl">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard">
          <Button variant="outline" size="icon"><ArrowRight size={16} /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{course?.title}</h1>
          <p className="text-muted-foreground mt-1">إدارة مسار التعليم والاختبارات</p>
        </div>
        <Link href={`/course/${courseId}/ai-tutor`} className="mr-auto">
          <Button variant="outline" className="gap-2">
            <BrainCircuit size={18} />
            تجربة المعلم الذكي
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="materials" className="w-full">
        <TabsList className="mb-6 grid w-full max-w-md grid-cols-2 h-12">
          <TabsTrigger value="materials">المواد التعليمية</TabsTrigger>
          <TabsTrigger value="exams">الاختبارات والتمارين</TabsTrigger>
        </TabsList>

        {/* MATERIALS TAB */}
        <TabsContent value="materials">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">ملفات وروابط المقرر</h2>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild><Button className="gap-2"><Plus size={16} /> إضافة مادة</Button></DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>إضافة مادة</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div><label className="text-sm font-semibold mb-1 block">عنوان المادة</label><Input value={newTitle} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewTitle(e.target.value)} /></div>
                  <div>
                    <label className="text-sm font-semibold mb-1 block">النوع</label>
                    <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">ملف (PDF)</SelectItem>
                        <SelectItem value="video">فيديو</SelectItem>
                        <SelectItem value="link">رابط</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newType === 'pdf' ? (
                    <div><label className="text-sm font-semibold mb-1 block">اختر ملف</label><Input type="file" accept=".pdf" onChange={(e: ChangeEvent<HTMLInputElement>) => setUploadFile(e.target.files?.[0] || null)} /></div>
                  ) : (
                    <div><label className="text-sm font-semibold mb-1 block">الرابط</label><Input dir="ltr" value={newUrl} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewUrl(e.target.value)} /></div>
                  )}
                  <Button className="w-full" onClick={handleAddMaterial} disabled={isUploading}>{isUploading ? <Loader2 className="animate-spin" size={16}/> : 'حفظ'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {materials.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-muted/30 border-dashed border rounded-xl">
                <FileText className="mx-auto text-muted-foreground opacity-50 mb-4" size={48} />
                <h3 className="text-lg font-bold">لا يوجد مواد حتى الآن</h3>
                <p className="text-muted-foreground mt-2">قم بإنشاء مواد وروابط لمقررك ليتمكن الطلاب من تصفحها.</p>
              </div>
            ) : (
              materials.map((mat) => (
                <Card key={mat.id} className="flex flex-row items-center p-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary ml-4"><FileText size={24} /></div>
                  <div className="flex-1"><h4 className="font-bold">{mat.title}</h4><p className="text-xs text-muted-foreground uppercase">{mat.type}</p></div>
                  <Button variant="ghost" className="text-destructive" onClick={() => handleDeleteMaterial(mat.id)}><Trash2 size={16} /></Button>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* EXAMS TAB */}
        <TabsContent value="exams" className="space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">الاختبارات والبنك</h2>
            <Dialog open={isAddExamOpen} onOpenChange={setIsAddExamOpen}>
              <DialogTrigger asChild><Button className="gap-2"><Plus size={16} /> إنشاء اختبار</Button></DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>إعداد اختبار جديد</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div><label htmlFor="examTitle" className="text-sm font-bold mb-1 block">اسم الاختبار</label><Input id="examTitle" value={examTitle} onChange={(e: ChangeEvent<HTMLInputElement>) =>setExamTitle(e.target.value)} /></div>
                  <div><label htmlFor="examTimeLimit" className="text-sm font-bold mb-1 block">المدة (بالدقائق)</label><Input id="examTimeLimit" type="number" value={examTimeLimit} onChange={(e: ChangeEvent<HTMLInputElement>) =>setExamTimeLimit(parseInt(e.target.value))} /></div>
                  <Button className="w-full" onClick={handleCreateExam}>إنشاء</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-1 space-y-4">
              {exams.length === 0 ? (
                <Card className="bg-muted/30 border-dashed text-center py-8">
                  <CardContent className="flex flex-col items-center justify-center p-4">
                    <Clock className="text-muted-foreground opacity-50 mb-2" size={36} />
                    <p className="text-sm font-semibold text-muted-foreground">لا يوجد اختبارات حتى الآن</p>
                  </CardContent>
                </Card>
              ) : exams.map(ex => (
                <Card key={ex.id} className={`cursor-pointer border-2 transition-colors ${selectedExam?.id === ex.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`} onClick={() => { setSelectedExam(ex); loadQuestions(ex.id); }}>
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg flex justify-between">
                      {ex.title} 
                      <span className={`text-[10px] px-2 py-1 rounded-full ${ex.is_published ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>{ex.is_published ? 'منشور' : 'مسودة'}</span>
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2"><Clock size={12}/> {ex.time_limit_minutes} دقيقة</div>
                  </CardHeader>
                  <CardFooter className="p-2 bg-muted/20 flex justify-between border-t">
                    <Button variant="ghost" size="icon" onClick={(e: MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handleDeleteExam(ex.id); }} className="text-destructive h-8 w-8" aria-label="Delete Exam"><Trash2 size={14}/></Button>
                    <Button variant="ghost" size="icon" onClick={(e: MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handleToggleExamPublish(ex); }} className="h-8 w-8" aria-label={ex.is_published ? "Unpublish Exam" : "Publish Exam"}>{ex.is_published ? <EyeOff size={14}/> : <Eye size={14}/>}</Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
            
            <div className="md:col-span-2">
              {selectedExam ? (
                <Card className="border-2 border-primary/20">
                  <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 pb-4">
                    <div>
                      <CardTitle>{selectedExam.title} - الأسئلة</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">يحتوي على {questions.length} أسئلة</p>
                    </div>
                    <Dialog open={isAddQuestionOpen} onOpenChange={setIsAddQuestionOpen}>
                      <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus size={16} /> إضافة سؤال</Button></DialogTrigger>
                      <DialogContent dir="rtl" className="max-w-xl">
                        <DialogHeader><DialogTitle>سؤال جديد</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div>
                            <label className="text-sm font-bold mb-1 block">النوع</label>
                            <Select value={qType} onValueChange={(v:any)=>setQType(v)}>
                              <SelectTrigger><SelectValue/></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mcq">اختيار من متعدد</SelectItem>
                                <SelectItem value="tf">صح أو خطأ</SelectItem>
                                <SelectItem value="math">إجابة رياضية قصيرة</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div><label className="text-sm font-bold mb-1 block">نص السؤال</label><Input value={qContent} onChange={(e: ChangeEvent<HTMLInputElement>) =>setQContent(e.target.value)} /></div>
                          
                          {qType === 'mcq' && (
                            <div className="space-y-2">
                              <label className="text-sm font-bold mb-1 block">الخيارات (امسح الفراغ للإلغاء)</label>
                              {qOptions.map((opt, i) => (
                                <Input key={i} value={opt} onChange={(e: ChangeEvent<HTMLInputElement>) => { const newOpts = [...qOptions]; newOpts[i] = e.target.value; setQOptions(newOpts); }} placeholder={`خيار ${i+1}`} />
                              ))}
                            </div>
                          )}

                          <div>
                            <label className="text-sm font-bold mb-1 block">الإجابة الصحيحة (يجب أن تطابق أحد الخيارات تماماً إن وجدت)</label>
                            {qType === 'tf' ? (
                              <Select value={qCorrect} onValueChange={setQCorrect}>
                                <SelectTrigger><SelectValue placeholder="اختر الإجابة"/></SelectTrigger>
                                <SelectContent><SelectItem value="صح">صح</SelectItem><SelectItem value="خطأ">خطأ</SelectItem></SelectContent>
                              </Select>
                            ) : (
                              <Input value={qCorrect} onChange={(e: ChangeEvent<HTMLInputElement>) =>setQCorrect(e.target.value)} dir="auto" />
                            )}
                          </div>
                          
                          <Button className="w-full mt-4" onClick={handleAddQuestion}>حفظ السؤال</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent className="p-0">
                    {questions.length === 0 ? (
                      <div className="p-10 text-center text-muted-foreground"><BrainCircuit size={48} className="mx-auto mb-4 opacity-50"/> ابدأ في إضافة أسئلة للاختبار</div>
                    ) : (
                      <div className="divide-y">
                        {questions.map((q, i) => (
                          <div key={q.id} className="p-4 hover:bg-muted/10 flex justify-between items-start">
                            <div>
                              <span className="font-bold text-primary ml-2">{i+1}.</span>
                              <span className="font-semibold">{q.content}</span>
                              <div className="mt-2 text-sm text-muted-foreground">
                                {q.type === 'mcq' && q.options?.map((opt: string) => <span key={opt} className={`inline-block border px-2 py-1 rounded ml-2 mb-2 ${opt === q.correct_answer ? 'bg-primary/20 border-primary/40 text-primary' : ''}`}>{opt}</span>)}
                                {q.type === 'tf' && <span className="font-bold text-primary bg-primary/10 px-2 py-1 rounded">الجواب: {q.correct_answer}</span>}
                                {q.type === 'math' && <span className="font-bold text-primary bg-primary/10 px-2 py-1 rounded">الجواب الرياضي: {q.correct_answer}</span>}
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(q.id)} className="text-destructive"><Trash2 size={16}/></Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full flex items-center justify-center border-2 border-dashed rounded-xl p-10 text-muted-foreground">
                  اختر اختباراً من القائمة الجانبية لعرض وتعديل أسئلته
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
