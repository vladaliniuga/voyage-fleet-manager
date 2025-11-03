import '@/styles/globals.css';
import { useEffect } from 'react';
import { requireAuth } from '@/lib/authGuard';

export default function MyApp({ Component, pageProps, router }) {
  useEffect(() => {
    requireAuth();
  }, []);

  // Allow unauthenticated access only on /login
  const isLogin = router.pathname === '/login';

  const Page = <Component {...pageProps} />;
  return isLogin ? Page : <>{Page}</>; // Layout is applied in each page component to keep control
}
