'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/Button';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/compose', label: 'Compose' },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-base font-semibold text-slate-900">
            Scheduled Email
          </Link>
          <nav className="flex gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  pathname === link.href ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:inline">{user?.email}</span>
          <Button variant="secondary" onClick={logout} className="py-1.5">
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
