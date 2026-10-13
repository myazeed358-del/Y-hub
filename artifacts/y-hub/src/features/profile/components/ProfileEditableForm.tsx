import type {
  Dispatch,
  FormEvent,
  SetStateAction,
} from 'react';
import {
  GraduationCap,
  Hash,
  Phone,
  Save,
} from 'lucide-react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/y-hub-ds/components/ui/select';
import type { getProfileCopy } from '@/i18n/profileCopy';

interface ProfileFormData {
  age: string;
  study_year: string;
  phone: string;
}

interface ProfileEditableFormProps {
  copy: ReturnType<typeof getProfileCopy>;
  formData: ProfileFormData;
  setFormData: Dispatch<SetStateAction<ProfileFormData>>;
  isStudent: boolean;
  saving: boolean;
  hasChanges: boolean;
  handleSave: (event: FormEvent) => Promise<void>;
}

export function ProfileEditableForm({
  copy,
  formData,
  setFormData,
  isStudent,
  saving,
  hasChanges,
  handleSave,
}: ProfileEditableFormProps) {
  return (
          <form
            onSubmit={handleSave}
            className="rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7"
          >
            <div className="mb-6">
              <h2 className="text-xl font-black">{copy.editableInfo}</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="profile-age"
                  className="flex items-center gap-2 text-sm font-bold"
                >
                  <Hash size={16} className="text-[hsl(var(--primary))]" />
                  {copy.age}
                </label>

                <Input
                  id="profile-age"
                  type="number"
                  min={13}
                  max={120}
                  step={1}
                  value={formData.age}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      age: event.target.value,
                    }))
                  }
                  className="h-12"
                />
              </div>

              {isStudent && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-bold">
                    <GraduationCap
                      size={16}
                      className="text-[hsl(var(--primary))]"
                    />
                    {copy.studyYear}
                  </label>

                  <Select
                    value={formData.study_year}
                    onValueChange={(value) =>
                      setFormData((current) => ({
                        ...current,
                        study_year: value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder={copy.selectYear} />
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
              )}

              <div className="space-y-2 md:col-span-2">
                <label
                  htmlFor="profile-phone"
                  className="flex items-center gap-2 text-sm font-bold"
                >
                  <Phone size={16} className="text-[hsl(var(--primary))]" />
                  {copy.phone}
                </label>

                <Input
                  id="profile-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  dir="ltr"
                  className="h-12"
                />
              </div>
            </div>

            <div className="mt-7 flex justify-end">
              <Button
                type="submit"
                disabled={saving || !hasChanges}
                className="h-12 min-w-44 gap-2 rounded-xl px-6 font-black"
              >
                <Save size={17} />
                {saving ? copy.saving : copy.save}
              </Button>
            </div>
          </form>
  );
}
