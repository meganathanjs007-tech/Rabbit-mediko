import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Activity,
  BrainCircuit,
  CalendarHeart,
  FileHeart,
  HeartPulse,
  LayoutDashboard,
  Menu,
  Pill,
  QrCode,
  Settings,
  ShoppingBasket,
  X,
} from 'lucide-react';
import { useFamily } from '../hooks/useFamily';
import { getT } from '../utils/i18n';

export function BottomNav() {
  const { language } = useFamily();
  const t = getT(language);
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryTabs = [
    { to: '/dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { to: '/vault', label: t.nav.vault, icon: FileHeart },
    { to: '/meals', label: t.nav.meals, icon: CalendarHeart },
    { to: '/medicines', label: t.nav.medicines, icon: Pill },
  ];

  const moreLinks = [
    { to: '/emergency-qr', label: t.nav.emergency, icon: QrCode },
    { to: '/insights', label: t.nav.insights, icon: BrainCircuit },
    { to: '/grocery', label: t.nav.grocery, icon: ShoppingBasket },
    { to: '/settings', label: t.nav.settings, icon: Settings },
  ];

  const isMoreActive = moreLinks.some((item) => location.pathname === item.to);

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="fixed bottom-16 left-0 right-0 bg-white rounded-t-3xl border-t border-slate-200 p-5 shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">{t.nav.more}</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {moreLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-3 rounded-xl border text-sm font-medium min-h-[48px] transition-colors ${
                        isActive
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-slate-100'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 h-16 px-1"
      >
        <div className="grid grid-cols-5 h-full max-w-lg mx-auto">
          {primaryTabs.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 min-h-[44px] text-[11px] font-medium transition-colors ${
                    isActive ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span className="truncate max-w-[68px]">{item.label}</span>
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex flex-col items-center justify-center gap-1 min-h-[44px] text-[11px] font-medium transition-colors cursor-pointer ${
              isMoreActive || moreOpen ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span>{t.nav.more}</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { family, language, setLanguage } = useFamily();
  const t = getT(language);

  const navItems = [
    { to: '/dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { to: '/vault', label: t.nav.vault, icon: Activity },
    { to: '/meals', label: t.nav.meals, icon: CalendarHeart },
    { to: '/medicines', label: t.nav.medicines, icon: Pill },
    { to: '/emergency-qr', label: t.nav.emergency, icon: QrCode },
    { to: '/insights', label: t.nav.insights, icon: BrainCircuit },
    { to: '/grocery', label: t.nav.grocery, icon: ShoppingBasket },
    { to: '/settings', label: t.nav.settings, icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="h-16 px-5 flex items-center gap-2.5 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <HeartPulse className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            {t.appName}
          </span>
        </div>

        <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto" aria-label="Sidebar Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-3">
          {family && (
            <div className="text-xs text-slate-500 px-1 truncate">
              <span className="font-medium text-slate-800">{family.familyName}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => void setLanguage('en')}
              className={`py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                language === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => void setLanguage('ta')}
              className={`py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                language === 'ta' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              தமிழ்
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Compact Mobile Header */}
        <header className="lg:hidden sticky top-0 z-30 h-13 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <HeartPulse className="w-4 h-4" />
            </div>
            <span className="text-base font-bold text-slate-900 truncate whitespace-nowrap">
              {t.appName}
            </span>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => void setLanguage('en')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                language === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => void setLanguage('ta')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                language === 'ta' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              தமிழ்
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
