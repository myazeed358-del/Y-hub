import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@workspace/y-hub-ds/components/ui/card';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workspace/y-hub-ds/components/ui/select';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const { signIn, signUp } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    age: '',
    major: '',
    study_year: '',
    phone: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });
    
    try {
      if (isSignUp) {
        // Validation
        const nameRegex = /^[\p{L}\s]+$/u;
        if (!nameRegex.test(formData.full_name)) {
          throw new Error('الاسم يجب أن يحتوي على حروف فقط بدون أرقام أو رموز.');
        }
        if (!formData.major || !formData.study_year) {
           throw new Error('يرجى تعبئة التخصص والسنة الدراسية.');
        }
        
        await signUp(formData);
        setMessage({ text: 'تم التسجيل بنجاح! يرجى مراجعة بريدك الإلكتروني وتأكيده قبل تسجيل الدخول.', type: 'success' });
        setIsSignUp(false);
      } else {
        await signIn(formData.email, formData.password);
        setLocation('/');
      }
    } catch (error: any) {
      setMessage({ text: error.message || 'حدث خطأ غير متوقع', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto mb-4 flex justify-center">
            <img src="/logo.png" alt="Y Hub Logo" className="h-20 w-auto object-contain" />
          </div>
          <CardTitle className="text-2xl font-bold">{isSignUp ? 'إنشاء حساب جديد' : 'تسجيل الدخول إلى Y Hub'}</CardTitle>
          <CardDescription>{isSignUp ? 'أدخل بياناتك لإنشاء حسابك (الاسم والعمر غير قابلين للتعديل لاحقاً)' : 'قم بإدخال البريد الإلكتروني وكلمة المرور'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
            {isSignUp && (
              <>
                <div className="space-y-2 text-right">
                  <label htmlFor="full_name" className="text-sm font-medium">الاسم الثنائي (مع الكنية)</label>
                  <Input 
                    id="full_name" type="text" name="full_name" required value={formData.full_name} onChange={handleChange} 
                    placeholder="مثال: أحمد عبد الله"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-right">
                  <div className="space-y-2">
                    <label htmlFor="age" className="text-sm font-medium">العمر</label>
                    <Input id="age" type="number" name="age" min="10" max="99" required value={formData.age} onChange={handleChange} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="phone" className="text-sm font-medium">رقم الهاتف</label>
                    <Input id="phone" type="tel" name="phone" required value={formData.phone} onChange={handleChange} dir="ltr" />
                  </div>
                </div>
                <div className="space-y-2 text-right">
                  <label className="text-sm font-medium">التخصص الأكاديمي</label>
                  <Select value={formData.major} onValueChange={(val: string) => handleSelectChange('major', val)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="اختر التخصص" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mathematics">رياضيات (Mathematics)</SelectItem>
                      <SelectItem value="medicine">طب وصيدلة (Medicine)</SelectItem>
                      <SelectItem value="engineering">هندسة (Engineering)</SelectItem>
                      <SelectItem value="humanities">علوم إنسانية (Humanities)</SelectItem>
                      <SelectItem value="cs">برمجة (CS)</SelectItem>
                      <SelectItem value="general">عام (General)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 text-right">
                  <label className="text-sm font-medium">السنة الدراسية</label>
                  <Select value={formData.study_year} onValueChange={(val: string) => handleSelectChange('study_year', val)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="اختر السنة الدراسية" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">السنة الأولى</SelectItem>
                      <SelectItem value="2">السنة الثانية</SelectItem>
                      <SelectItem value="3">السنة الثالثة</SelectItem>
                      <SelectItem value="4">السنة الرابعة</SelectItem>
                      <SelectItem value="5">أخرى / تخرج</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            <div className="space-y-2 text-right">
              <label htmlFor="email" className="text-sm font-medium">البريد الإلكتروني</label>
              <Input 
                id="email" type="email" name="email" required value={formData.email} onChange={handleChange}
                placeholder="name@example.com" dir="ltr"
              />
            </div>
            <div className="space-y-2 text-right">
              <label htmlFor="password" className="text-sm font-medium">كلمة المرور</label>
              <Input 
                id="password" type="password" name="password" required value={formData.password} onChange={handleChange}
                dir="ltr" minLength={6}
              />
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? 'جاري التحميل...' : (isSignUp ? 'إنشاء الحساب' : 'تسجيل الدخول')}
            </Button>
            
            {message.text && (
              <div className={`text-center text-sm font-medium p-3 rounded ${message.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                {message.text}
              </div>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-[hsl(var(--border))] pt-4">
          <Button variant="link" className="text-sm" onClick={() => { setIsSignUp(!isSignUp); setMessage({text: '', type: ''}); }}>
            {isSignUp ? 'لديك حساب بالفعل؟ سجل دخولك' : 'ليس لديك حساب؟ أنشئ حساباً جديداً'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
