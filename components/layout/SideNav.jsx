import { useRouter } from 'next/router';
import { useMemo, useState, useCallback } from 'react';

const NAV = [
  {
    type: 'section',
    title: 'Lot attendant',
    id: 'lot-attendant',
    collapsible: false,
    items: [{ label: 'Vehicle status', href: '/vehicle-status' }],
  },
];

const normalize = (p = '') => {
  const base = p.split('#')[0].split('?')[0];
  return base !== '/' ? base.replace(/\/+$/, '') : '/';
};
const sectionContainsPath = (section, path) =>
  section.items?.some((it) => normalize(path) === normalize(it.href));

export default function SideNav({ open, onClose }) {
  const router = useRouter();
  const path = normalize(router.asPath || router.pathname || '/');

  // Auto-derived open state per section from path
  const autoExpanded = useMemo(() => {
    const map = {};
    NAV.forEach((n) => {
      if (n.type !== 'section') return;
      const isCollapsible = n.collapsible !== false;
      if (!isCollapsible) return;
      map[n.id] = sectionContainsPath(n, path);
    });
    return map;
  }, [path]);

  const [overrides, setOverrides] = useState({});
  const isOpenFor = useCallback(
    (node) => {
      if (node.collapsible === false) return true;
      const v = overrides[node.id];
      return v != null ? v : !!autoExpanded[node.id];
    },
    [overrides, autoExpanded]
  );

  const toggle = useCallback(
    (node) => {
      setOverrides((prev) => {
        const current =
          prev[node.id] != null ? prev[node.id] : !!autoExpanded[node.id];
        return { ...prev, [node.id]: !current };
      });
    },
    [autoExpanded]
  );

  const items = useMemo(() => NAV, []);

  return (
    <>
      {/* Overlay on ANY screen when open */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 ${open ? '' : 'hidden'}`}
        onClick={onClose}
      />

      {/* Off-canvas sidebar (always hidden until open) */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-slate-200 bg-white px-4 py-6 transition-transform will-change-transform ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ WebkitOverflowScrolling: 'touch' }}
        aria-hidden={!open}
      >
        {/* Header */}
        <div className="flex items-center gap-2 pr-2 mb-6">
          <img
            onClick={() => router.push('/')}
            src="/voyage-logo.png"
            alt="logo"
            className="w-[160px] mx-auto"
          />
        </div>

        {/* Scrollable nav area */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <nav className="space-y-2">
            {items.map((node, idx) => {
              if (node.type === 'link') {
                const active = path === normalize(node.href);
                return (
                  <a
                    key={`top-${idx}`}
                    href={node.href}
                    onClick={onClose}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? 'bg-slate-100 font-semibold text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span>{node.icon}</span>
                    <span>{node.label}</span>
                  </a>
                );
              }

              const hasItems =
                Array.isArray(node.items) && node.items.length > 0;
              const activeInSection = sectionContainsPath(node, path);

              if (!hasItems) {
                return (
                  <div
                    key={node.id}
                    className="px-3 pt-3 text-xs font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {node.title}
                  </div>
                );
              }

              if (node.collapsible === false) {
                return (
                  <div key={node.id} className="rounded-lg">
                    <div
                      className={`px-3 pt-3 text-xs font-semibold uppercase tracking-wider ${
                        activeInSection ? 'text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      {node.title}
                    </div>
                    <ul className="mt-2 space-y-1 pl-3">
                      {node.items.map((it) => {
                        const active = path === normalize(it.href);
                        return (
                          <li key={it.href}>
                            <a
                              href={it.href}
                              onClick={onClose}
                              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                                active
                                  ? 'bg-slate-100 font-semibold text-slate-900'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                              aria-current={active ? 'page' : undefined}
                            >
                              <span>{it.icon}</span>
                              <span>{it.label}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              }

              const sectionOpen = isOpenFor(node);

              return (
                <div key={node.id} className="rounded-lg">
                  <button
                    type="button"
                    onClick={() => toggle(node)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                      activeInSection
                        ? 'bg-slate-100 font-semibold text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                    aria-expanded={sectionOpen}
                    aria-controls={`section-${node.id}`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{node.title}</span>
                    </span>
                    <svg
                      className={`h-4 w-4 transform transition-transform ${
                        sectionOpen ? 'rotate-90' : ''
                      }`}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6.293 7.293a1 1 0 011.414 0L12 11.586l-4.293 4.293a1 1 0 01-1.414-1.414L9.586 12 6.293 8.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>

                  <div
                    id={`section-${node.id}`}
                    className={`overflow-hidden transition-all ${
                      sectionOpen
                        ? 'max-h-[1000px] ease-in duration-300'
                        : 'max-h-0 ease-out duration-200'
                    }`}
                  >
                    <ul className="mt-1 space-y-1 pl-3">
                      {node.items.map((it) => {
                        const active = path === normalize(it.href);
                        return (
                          <li key={it.href}>
                            <a
                              href={it.href}
                              onClick={onClose}
                              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                                active
                                  ? 'bg-slate-100 font-semibold text-slate-900'
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                              aria-current={active ? 'page' : undefined}
                            >
                              <span>{it.icon}</span>
                              <span>{it.label}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="h-[2000px]" />
        </div>

        {/* Footer */}
        <div className="pt-4 text-xs text-slate-500">© Your Company</div>
      </aside>
    </>
  );
}
