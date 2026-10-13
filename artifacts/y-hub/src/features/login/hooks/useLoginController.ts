import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { loginCopy } from '@/i18n/loginCopy';
import { loginAuthService } from '../services/loginAuthService';
import { validateSignUpForm } from '../domain/validateSignUpForm';
import type { LoginFormData, LoginProps } from '../types';

export function useLoginController(
  language: LoginProps['language']
) {
  const copy = loginCopy[language];
  const [isSignUp, setIsSignUp] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('mode') === 'signup';
  });

  const [isRecoveryRequest, setIsRecoveryRequest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const { signIn, signUp } = useAuth();
  const [, setLocation] = useLocation();

  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    full_name: '',
    age: '',
    major: '',
    study_year: '',
    phone: '',
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const switchMode = () => {
    setIsRecoveryRequest(false);
    setMessage({ text: '', type: '' });
    setIsSignUp((current) => !current);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      if (isRecoveryRequest) {
        await loginAuthService.requestPasswordRecovery(
          formData.email.trim()
        );

        setMessage({
          text: copy.forgotSent,
          type: 'success',
        });
      } else if (isSignUp) {
        validateSignUpForm(
          formData,
          copy.nameError,
          copy.requiredError
        );

        await signUp(formData);

        setMessage({
          text: copy.success,
          type: 'success',
        });

        setIsSignUp(false);
      } else {
        await signIn(formData.email, formData.password);
        setLocation('/');
      }
    } catch (error: any) {
      setMessage({
        text: isRecoveryRequest ? copy.forgotFailed : (error.message || copy.unexpectedError),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };


  return {
    copy,
    isSignUp,
    isRecoveryRequest,
    loading,
    message,
    setMessage,
    setIsRecoveryRequest,
    formData,
    handleChange,
    handleSelectChange,
    switchMode,
    handleSubmit,
    setLocation
  };
}
