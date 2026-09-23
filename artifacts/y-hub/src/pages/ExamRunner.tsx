import { useState, useEffect } from 'react';
import { useRoute, Link } from 'wouter';
import { supabase } from '@/utils/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@workspace/y-hub-ds/components/ui/card';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@workspace/y-hub-ds/components/ui/radio-group';
import { Label } from '@workspace/y-hub-ds/components/ui/label';
import { Loader2, Clock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export default function ExamRunner() {
  const [, params] = useRoute('/exam/:id');
  const examId = params?.id || '';
  const { user } = useAuth();

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    async function loadExam() {
      if (!examId || !user) return;
      setLoading(true);

      // Check if already taken
      const { data: existingResult } = await supabase
        .from('student_results')
        .select('*')
        .eq('exam_id', examId)
        .eq('student_id', user.id)
        .maybeSingle();

      if (existingResult) {
        setResult(existingResult);
        setIsSubmitted(true);
      }

      const { data: examData } = await supabase.from('exams').select('*').eq('id', examId).single();
      if (examData) {
        setExam(examData);
        if (!existingResult) setTimeLeft(examData.time_limit_minutes * 60);
      }

      // Fetch questions using SECURE RPC (no correct_answer field returned)
      const { data: qData, error: qError } = await supabase.rpc('get_exam_questions', { p_exam_id: examId });
      if (qData) {
        setQuestions(qData);
      } else if (qError) {
        console.error("Failed to load questions safely", qError);
      }
      
      setLoading(false);
    }
    loadExam();
  }, [examId, user]);

  useEffect(() => {
    if (!isSubmitted && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && !isSubmitted && exam) {
      handleSubmit(); // Auto submit
    }
  }, [timeLeft, isSubmitted, exam]);

  const handleSubmit = async () => {
    if (isSubmitted || !user) return;
    setIsSubmitted(true);

    // Call SECURE RPC for grading
    const { data, error } = await supabase.rpc('submit_exam', { 
      p_exam_id: examId, 
      p_answers: answers 
    });

    if (!error && data) {
      setResult(data);
      toast.success('تم تسليم الاختبار بنجاح');
    } else {
      toast.error('حدث خطأ أثناء حفظ النتيجة');
      console.error(error);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={48} /></div>;

  if (!exam) return <div className="text-center py-20"><h2 className="text-2xl font-bold">الاختبار غير موجود أو غير متاح</h2></div>;

  return (
    <div className="mx-auto max-w-4xl py-6 px-4 md:py-10 md:px-5" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link href={`/course/${exam.course_id}/view`}>
            <Button variant="outline" size="icon" className="shrink-0"><ArrowRight size={16} /></Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">{exam.title}</h1>
        </div>
        {!isSubmitted && (
          <div className="flex items-center gap-2 text-destructive font-mono text-xl mt-2 md:mt-0 md:mr-auto bg-destructive/10 px-4 py-2 rounded-lg font-bold">
            <Clock size={20} /> {formatTime(timeLeft)}
          </div>
        )}
      </div>

      {isSubmitted && result ? (
        <Card className="mb-8 border-primary/20 bg-primary/5 shadow-md">
          <CardContent className="py-10 text-center">
            <h2 className="text-3xl font-bold mb-4">نتيجة الاختبار</h2>
            <div className="text-5xl font-extrabold text-primary mb-4">
              {result.score} / {result.total_score}
            </div>
            <p className="text-muted-foreground text-lg">
              تم تسجيل إجاباتك بنجاح. {result.score >= result.total_score / 2 ? 'عمل ممتاز!' : 'استمر في المحاولة وراجع الدروس.'}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-6">
        {questions.map((q, i) => (
          <Card key={q.id} className={isSubmitted ? 'opacity-80 grayscale-[20%]' : ''}>
            <CardHeader>
              <CardTitle className="text-lg flex justify-between items-start">
                <span><span className="text-primary ml-2">{i + 1}.</span> {q.content}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {q.type === 'mcq' && (
                <RadioGroup 
                  disabled={isSubmitted} 
                  value={answers[q.id] || ''} 
                  onValueChange={(val) => setAnswers(prev => ({...prev, [q.id]: val}))}
                  className="space-y-3"
                >
                  {q.options?.map((opt: string, optIdx: number) => (
                    <div key={optIdx} className="flex items-center space-x-2 space-x-reverse">
                      <RadioGroupItem value={opt} id={`q-${q.id}-opt-${optIdx}`} />
                      <Label htmlFor={`q-${q.id}-opt-${optIdx}`}>{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
              
              {q.type === 'tf' && (
                <RadioGroup 
                  disabled={isSubmitted} 
                  value={answers[q.id] || ''} 
                  onValueChange={(val) => setAnswers(prev => ({...prev, [q.id]: val}))}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="صح" id={`q-${q.id}-t`} />
                    <Label htmlFor={`q-${q.id}-t`}>صح</Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="خطأ" id={`q-${q.id}-f`} />
                    <Label htmlFor={`q-${q.id}-f`}>خطأ</Label>
                  </div>
                </RadioGroup>
              )}

              {q.type === 'math' && (
                <Input 
                  disabled={isSubmitted} 
                  value={answers[q.id] || ''} 
                  onChange={e => setAnswers(prev => ({...prev, [q.id]: e.target.value}))} 
                  placeholder="أدخل الإجابة الرياضية هنا" 
                  dir="ltr"
                  className="max-w-md font-mono"
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!isSubmitted && (
        <div className="mt-8 flex justify-end">
          <Button size="lg" onClick={handleSubmit} className="px-10 font-bold" disabled={loading}>تسليم الاختبار</Button>
        </div>
      )}
    </div>
  );
}
