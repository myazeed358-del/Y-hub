import {
  Card,
  CardContent,
} from '@workspace/y-hub-ds/components/ui/card';

interface Props {
  result: { score: number; total_score: number };
}

export function ExamResultSummary({ result }: Props) {
  return (
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
  );
}
