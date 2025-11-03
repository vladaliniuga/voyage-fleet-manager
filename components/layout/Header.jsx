import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { RiMenu2Line } from 'react-icons/ri';

export default function Header({ onMenu }) {
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUserEmail(user.email || '');
      else setUserEmail('');
    });
    return () => unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-700 bg-black backdrop-blur print:hidden">
      <div className="mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            size="square"
            variant="dark"
            onClick={onMenu}
            aria-label="Open menu"
          >
            <RiMenu2Line />
          </Button>
          <div className="text-sm text-slate-200">
            {userEmail || 'Not signed in'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => signOut(auth)} size="sm" variant="dark">
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
