import { onAuthStateChanged } from 'firebase/auth';
import Router from 'next/router';
import { auth } from './firebase';

// Call in pages to protect them (Pages Router pattern)
export function requireAuth() {
  if (typeof window === 'undefined') return;
  onAuthStateChanged(auth, (user) => {
    const isLogin = Router.pathname === '/login';
    if (!user && !isLogin) Router.replace('/login');
    if (user && isLogin) Router.replace('/');
  });
}
