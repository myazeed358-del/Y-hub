import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/utils/supabaseClient';
import { validProfileName } from '@/shared/identity/profileName';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import { Button } from '@workspace/y-hub-ds/components/ui/button';

/** Missing translations only; existing names remain read-only on both client and server. */
export function ProfileNamesForm() {
  const { profile, refreshProfile } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [names, setNames] = useState({ ar: '', en: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const complete = Boolean(profile?.full_name_ar && profile?.full_name_en);
  return <form className="rounded-[2rem] border border-border bg-card p-5 sm:p-7" onSubmit={async event => {
    event.preventDefault();
    if (saving || complete) return;
    const arabic = profile?.full_name_ar || names.ar.trim();
    const english = profile?.full_name_en || names.en.trim();
    if (!validProfileName(arabic, 'ar') || !validProfileName(english, 'en')) {
      setError(ar ? 'أدخل اسمًا عربيًا وإنجليزيًا صحيحًا من 2 إلى 120 حرفًا.' : 'Enter valid Arabic and English names of 2–120 characters.');
      return;
    }
    setSaving(true); setError('');
    try {
      const { error: failure } = await supabase.rpc('complete_own_profile_names', { p_ar: arabic, p_en: english });
      if (failure) throw failure;
      if (mounted.current) await refreshProfile();
    } catch {
      if (mounted.current) setError(ar ? 'تعذر حفظ الاسمين. احتفظنا بما أدخلته؛ حدّث الصفحة إذا اكتمل الاسم من جهاز آخر، ثم حاول مجددًا.' : 'Could not save names. Your input is retained; refresh if another device completed the profile, then retry.');
    } finally { if (mounted.current) setSaving(false); }
  }}>
    <h2 className="text-xl font-black">{ar ? 'الاسم بالعربية والإنجليزية' : 'Arabic and English names'}</h2>
    <p className="my-3 text-sm text-muted-foreground">{ar ? 'استكمل الاسم المفقود. يُعرض الاسم حسب لغة الواجهة، وتبقى الأسماء المحفوظة غير قابلة للتعديل هنا.' : 'Complete missing names. Display follows the interface language; saved names remain read-only here.'}</p>
    <div className="grid gap-5 md:grid-cols-2">
      {(['ar', 'en'] as const).map(locale => {
        const saved = profile?.[`full_name_${locale}`];
        return <div key={locale}>
          <label htmlFor={`profile-name-${locale}`} className="mb-2 block text-sm font-bold">{locale === 'ar' ? (ar ? 'الاسم الكامل بالعربية' : 'Full name in Arabic') : (ar ? 'الاسم الكامل بالإنجليزية' : 'Full name in English')}</label>
          <Input id={`profile-name-${locale}`} dir={locale === 'ar' ? 'rtl' : 'ltr'} required maxLength={120} readOnly={Boolean(saved)} disabled={saving}
            value={saved || names[locale]} onChange={event => setNames(current => ({ ...current, [locale]: event.target.value }))} />
        </div>;
      })}
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {!complete && <Button type="submit" disabled={saving} className="mt-5">{saving ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'استكمال الاسمين' : 'Complete names')}</Button>}
  </form>;
}
