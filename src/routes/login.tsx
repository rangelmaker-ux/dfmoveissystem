import { createFileRoute, redirect } from '@tanstack/react-router';
import { LoginPage } from './index';
import { validateStoredAccess } from '@/hooks/use-auth';

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    if (typeof window === 'undefined') {
      return;
    }

    const access = await validateStoredAccess();
    if (access.authorized && access.account) {
      throw redirect({ to: access.account.role === 'ADMIN' ? '/admin/dashboard' : '/projetista/dashboard' });
    }

  },
  component: LoginPage,
});
