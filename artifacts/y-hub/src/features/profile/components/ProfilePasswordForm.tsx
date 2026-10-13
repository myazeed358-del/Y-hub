import type {
  Dispatch,
  FormEvent,
  SetStateAction,
} from 'react';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@workspace/y-hub-ds/components/ui/button';
import { Input } from '@workspace/y-hub-ds/components/ui/input';
import type { getProfileCopy } from '@/i18n/profileCopy';

interface PasswordData {
  current: string;
  next: string;
  confirm: string;
}

interface ProfilePasswordFormProps {
  copy: ReturnType<typeof getProfileCopy>;
  passwordData: PasswordData;
  setPasswordData: Dispatch<SetStateAction<PasswordData>>;
  passwordSaving: boolean;
  handlePasswordChange: (
    event: FormEvent<HTMLFormElement>
  ) => Promise<void>;
}

export function ProfilePasswordForm({
  copy,
  passwordData,
  setPasswordData,
  passwordSaving,
  handlePasswordChange,
}: ProfilePasswordFormProps) {
  return (
          <form
            onSubmit={handlePasswordChange}
            className="rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7"
          >
            <div className="mb-6">
              <h2 className="flex items-center gap-2 text-xl font-black">
                <LockKeyhole size={21} className="text-[hsl(var(--primary))]" />
                {copy.passwordTitle}
              </h2>
              <p className="mt-2 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
                {copy.passwordDescription}
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="profile-current-password" className="text-sm font-bold">
                  {copy.currentPassword}
                </label>
                <Input
                  id="profile-current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={passwordData.current}
                  onChange={(event) =>
                    setPasswordData((current) => ({
                      ...current,
                      current: event.target.value,
                    }))
                  }
                  dir="ltr"
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="profile-new-password" className="text-sm font-bold">
                  {copy.newPassword}
                </label>
                <Input
                  id="profile-new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={passwordData.next}
                  onChange={(event) =>
                    setPasswordData((current) => ({
                      ...current,
                      next: event.target.value,
                    }))
                  }
                  dir="ltr"
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="profile-confirm-password" className="text-sm font-bold">
                  {copy.confirmPassword}
                </label>
                <Input
                  id="profile-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={passwordData.confirm}
                  onChange={(event) =>
                    setPasswordData((current) => ({
                      ...current,
                      confirm: event.target.value,
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
                disabled={passwordSaving}
                className="h-12 min-w-44 gap-2 rounded-xl px-6 font-black"
              >
                <LockKeyhole size={17} />
                {passwordSaving ? copy.changingPassword : copy.changePassword}
              </Button>
            </div>
          </form>
  );
}
