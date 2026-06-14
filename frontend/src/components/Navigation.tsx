'use client';

/**
 * 사이드바 네비게이션 컴포넌트
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const NAV_ITEMS = [
  { href: '/', label: '대시보드', icon: '🏠' },
  { href: '/schedule', label: '근무표', icon: '📅' },
  { href: '/requests', label: '희망 오프 신청', icon: '📝' },
  { href: '/nurses', label: '간호사 관리', icon: '👩‍⚕️' },
  { href: '/stats', label: '통계', icon: '📊' },
  { href: '/settings', label: '설정', icon: '⚙️' },
];

export default function Navigation() {
  const pathname = usePathname();
  const { isLoggedIn, wardName, logout } = useAuth();

  // 로그인 페이지에서는 네비게이션 숨김
  if (!isLoggedIn || pathname === '/login') return null;

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="flex items-center h-14 gap-6">
          {/* 로고 */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="text-xl">🏥</span>
            <span className="font-bold text-gray-900 text-sm">
              Nurse Scheduler <span className="text-blue-600">AI</span>
            </span>
          </Link>

          {/* 네비게이션 링크 */}
          <div className="flex items-center gap-1 overflow-x-auto flex-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
                    whitespace-nowrap transition-colors
                    ${isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                  `}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* 병동 정보 + 로그아웃 */}
          <div className="flex items-center gap-3 shrink-0">
            {wardName && (
              <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
                {wardName}
              </span>
            )}
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors whitespace-nowrap"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
