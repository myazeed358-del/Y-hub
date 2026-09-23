import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@workspace/y-hub-ds/components/ui/card';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { UserRound, GraduationCap, Shield, Phone, Hash } from 'lucide-react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { supabase } from '@/utils/supabaseClient';
import { toast } from 'sonner';

export default function Profile() {
  const { user, profile, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    major: '',
    study_year: '',
    phone: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        age: profile.age?.toString() || '',
        major: profile.major || '',
        study_year: profile.study_year || '',
        phone: profile.phone || ''
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          age: parseInt(formData.age, 10) || null,
          major: formData.major,
          study_year: formData.study_year,
          phone: formData.phone
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('تم تحديث الملف الشخصي بنجاح!');
    } catch (error: any) {
      toast.error(error.message || 'فشل تحديث البيانات');
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-3xl p-6" dir="rtl">
      <Card className="shadow-lg border-2">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="text-2xl flex items-center gap-2">
            <UserRound className="text-primary" /> الملف الشخصي
          </CardTitle>
          <CardDescription>إدارة معلومات حسابك الشخصي والأكاديمي</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Read-only Role Badge */}
          <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-xl border border-primary/20">
            <Shield className="text-primary" size={24} />
            <div>
              <p className="text-sm font-semibold text-primary">الصلاحية الحالية (Role)</p>
              <p className="text-lg font-bold capitalize">{role === 'instructor' ? 'معلم / مدرب (Instructor)' : role === 'admin' ? 'مدير (Admin)' : 'طالب (Student)'}</p>
            </div>
            <div className="mr-auto">
              <span className="text-xs text-muted-foreground bg-background px-3 py-1 rounded-full border shadow-sm">غير قابل للتعديل</span>
            </div>
          </div>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2"><UserRound size={16} /> الاسم الكامل</label>
                <Input name="full_name" value={formData.full_name} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">الاسم لا يمكن تغييره بعد التسجيل.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2"><Hash size={16} /> العمر</label>
                <Input name="age" type="number" value={formData.age} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2"><GraduationCap size={16} /> التخصص الأكاديمي</label>
                <Input name="major" value={formData.major} onChange={handleChange} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-2"><GraduationCap size={16} /> السنة الدراسية</label>
                <Input name="study_year" value={formData.study_year} onChange={handleChange} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold flex items-center gap-2"><Phone size={16} /> رقم الهاتف</label>
                <Input name="phone" value={formData.phone} onChange={handleChange} dir="ltr" className="text-right" />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full mt-6 h-12 text-lg font-bold">
              {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
