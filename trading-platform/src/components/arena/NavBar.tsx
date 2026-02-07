'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Swords } from 'lucide-react';

export function NavBar() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Trading', icon: Activity },
    { href: '/arena', label: 'Arena', icon: Swords },
  ];

  return (
    <nav className="bg-[#080808] border-b border-gray-800 px-4 py-0">
      <div className="flex items-center gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                isActive
                  ? 'text-white border-indigo-500'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
