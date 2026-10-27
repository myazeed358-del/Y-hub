import type { LoginFormData } from '../types';
import type { ChangeEvent } from 'react';
import {
  GraduationCap,
  Layers3,
  Phone,
  User,
} from 'lucide-react';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/y-hub-ds/components/ui/select';
import type { loginCopy } from '@/i18n/loginCopy';

interface LoginSignupFieldsProps {
  copy: (typeof loginCopy)[keyof typeof loginCopy];
  formData: LoginFormData;
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleSelectChange: (name: string, value: string) => void;
}

export function LoginSignupFields({
  copy,
  formData,
  handleChange,
  handleSelectChange,
}: LoginSignupFieldsProps) {
  return (
    <>
                    {(['ar', 'en'] as const).map(language => {
                      const field = `full_name_${language}` as const;
                      return <div key={field} className="space-y-2">
                        <label htmlFor={field} className="text-sm font-bold text-foreground dark:text-slate-300">
                          {language === 'ar' ? copy.arabicName : copy.englishName}
                        </label>
                        <div className="relative">
                          <User className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-slate-500" />
                          <Input id={field} name={field} type="text" required maxLength={120}
                            dir={language === 'ar' ? 'rtl' : 'ltr'} autoComplete="off"
                            value={formData[field]} onChange={handleChange}
                            placeholder={language === 'ar' ? 'أحمد عبد الله' : 'Ahmad Abdullah'}
                            className="h-12 border-input bg-background dark:border-white/[0.08] dark:bg-white/[0.025] pr-11 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-slate-600 focus-visible:ring-primary/40 dark:focus-visible:ring-cyan-400/40" />
                        </div>
                      </div>;
                    })}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label
                          htmlFor="age"
                          className="text-sm font-bold text-foreground dark:text-slate-300"
                        >
                          {copy.age}
                        </label>

                        <div className="relative">
                          <Layers3 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-slate-500" />

                          <Input
                            id="age"
                            type="number"
                            name="age"
                            min="10"
                            max="99"
                            required
                            value={formData.age}
                            onChange={handleChange}
                            placeholder="20"
                            className="h-12 border-input bg-background dark:border-white/[0.08] dark:bg-white/[0.025] pr-11 text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-slate-600 focus-visible:ring-primary/40 dark:focus-visible:ring-cyan-400/40"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label
                          htmlFor="phone"
                          className="text-sm font-bold text-foreground dark:text-slate-300"
                        >
                          {copy.phone}
                        </label>

                        <div className="relative">
                          <Phone className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-slate-500" />

                          <Input
                            id="phone"
                            type="tel"
                            name="phone"
                            required
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="07XXXXXXXX"
                            dir="ltr"
                            className="h-12 border-input bg-background dark:border-white/[0.08] dark:bg-white/[0.025] px-11 text-left text-foreground dark:text-white placeholder:text-muted-foreground dark:placeholder:text-slate-600 focus-visible:ring-primary/40 dark:focus-visible:ring-cyan-400/40"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground dark:text-slate-300">
                        {copy.major}
                      </label>

                      <Select
                        value={formData.major}
                        onValueChange={(value: string) =>
                          handleSelectChange('major', value)
                        }
                      >
                        <SelectTrigger className="h-12 border-input bg-background dark:border-white/[0.08] dark:bg-white/[0.025] text-foreground dark:text-white focus:ring-primary/40 dark:focus:ring-cyan-400/40">
                          <div className="flex items-center gap-3">
                            <GraduationCap className="h-4 w-4 text-muted-foreground dark:text-slate-500" />
                            <SelectValue placeholder={copy.majorPlaceholder} />
                          </div>
                        </SelectTrigger>

                        <SelectContent className="max-h-[320px] overflow-y-auto">
                          <SelectItem value="mathematics">
                            {copy.mathematics}
                          </SelectItem>

                          <SelectItem value="medicine">
                            {copy.medicine}
                          </SelectItem>

                          <SelectItem value="engineering">
                            {copy.engineering}
                          </SelectItem>

                          <SelectItem value="humanities">
                            {copy.humanities}
                          </SelectItem>

                          <SelectItem value="cs">
                            {copy.cs}
                          </SelectItem>

                          <SelectItem value="general">
                            {copy.general}
                          </SelectItem>

                          <SelectItem value="business_administration">
                            {copy.businessAdministration}
                          </SelectItem>

                          <SelectItem value="finance">
                            {copy.finance}
                          </SelectItem>

                          <SelectItem value="accounting">
                            {copy.accounting}
                          </SelectItem>

                          <SelectItem value="hotel_management">
                            {copy.hotelManagement}
                          </SelectItem>

                          <SelectItem value="tourism_management">
                            {copy.tourismManagement}
                          </SelectItem>

                          <SelectItem value="law">
                            {copy.law}
                          </SelectItem>

                          <SelectItem value="nursing">
                            {copy.nursing}
                          </SelectItem>

                          <SelectItem value="biological_sciences">
                            {copy.biologicalSciences}
                          </SelectItem>

                          <SelectItem value="applied_english">
                            {copy.appliedEnglish}
                          </SelectItem>

                          <SelectItem value="english_language_literature">
                            {copy.englishLanguageLiterature}
                          </SelectItem>

                          <SelectItem value="arabic_language_literature">
                            {copy.arabicLanguageLiterature}
                          </SelectItem>

                          <SelectItem value="french_language_literature">
                            {copy.frenchLanguageLiterature}
                          </SelectItem>

                          <SelectItem value="computer_information_systems">
                            {copy.computerInformationSystems}
                          </SelectItem>

                          <SelectItem value="business_information_technology">
                            {copy.businessInformationTechnology}
                          </SelectItem>

                          <SelectItem value="cybersecurity">
                            {copy.cybersecurity}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-bold text-foreground dark:text-slate-300">
                        {copy.studyYear}
                      </label>

                      <Select
                        value={formData.study_year}
                        onValueChange={(value: string) =>
                          handleSelectChange('study_year', value)
                        }
                      >
                        <SelectTrigger className="h-12 border-input bg-background dark:border-white/[0.08] dark:bg-white/[0.025] text-foreground dark:text-white focus:ring-primary/40 dark:focus:ring-cyan-400/40">
                          <div className="flex items-center gap-3">
                            <Layers3 className="h-4 w-4 text-muted-foreground dark:text-slate-500" />
                            <SelectValue placeholder={copy.studyYearPlaceholder} />
                          </div>
                        </SelectTrigger>

                        <SelectContent>
                          <SelectItem value="1">{copy.year1}</SelectItem>
                          <SelectItem value="2">{copy.year2}</SelectItem>
                          <SelectItem value="3">{copy.year3}</SelectItem>
                          <SelectItem value="4">{copy.year4}</SelectItem>
                          <SelectItem value="5">{copy.year5}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
    </>
  );
}
