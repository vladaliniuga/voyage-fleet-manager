import { useState } from 'react';
import Header from './Header';
import SideNav from './SideNav';

export default function DashboardLayout({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="h-dvh overflow-hidden flex flex-col  bg-black">
      {/* SideNav overlays the page when open */}
      <SideNav open={open} onClose={() => setOpen(false)} />

      {/* Main column */}
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
        <Header onMenu={() => setOpen(true)} />

        {/* Scrollable content area */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <main className="mx-auto w-full max-w-7xl min-h-full">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
