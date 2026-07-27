import { Suspense } from 'react';
import ResetPasswordForm from './_components/reset-password-form';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
