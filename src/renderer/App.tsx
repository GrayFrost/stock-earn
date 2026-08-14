import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { BarChart3, BookOpen, ChevronLeft, ChevronRight, Settings as SettingsIcon } from 'lucide-react';
import type { AppSettings } from '../shared/types';
import { DashboardPage } from './pages/DashboardPage';
import { DetailPage } from './pages/DetailPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { SettingsPage } from './pages/SettingsPage';
import { TooltipProvider } from './components/ui/tooltip';

const SIDEBAR_STORAGE_KEY = 'stock-earn-sidebar-collapsed';

export function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true',
  );

  useEffect(() => { void window.stockEarn.settings.get().then(setSettings); }, []);
  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  if (!settings) return <div className="app-loading"><div className="brand-mark">SE</div><span>正在打开账本…</span></div>;
  if (!settings.initialized) return <OnboardingPage onComplete={() => window.stockEarn.settings.get().then(setSettings)} />;

  return <TooltipProvider><div className={`app-shell color-${settings.colorMode}${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
    <aside className="sidebar" aria-label="主导航">
      <div className="window-drag" />
      <button
        type="button"
        className="sidebar-toggle"
        onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
        aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
        aria-expanded={!sidebarCollapsed}
        title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
      >
        {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>
      <div className="brand">
        <div className="brand-mark">SE</div>
        <div className="brand-copy"><strong>Stock Earn</strong><span>美股盈亏账本</span></div>
      </div>
      <nav>
        <NavLink to="/" end title={sidebarCollapsed ? '总览' : undefined}><BarChart3 size={18} /><span>总览</span></NavLink>
        <NavLink to="/trades" title={sidebarCollapsed ? '交易流水' : undefined}><BookOpen size={18} /><span>交易流水</span></NavLink>
        <NavLink to="/settings" title={sidebarCollapsed ? '设置' : undefined}><SettingsIcon size={18} /><span>设置</span></NavLink>
      </nav>
      <div className="sidebar-note"><span>LOCAL LEDGER</span><p>数据只保存在这台电脑</p></div>
    </aside>
    <main className="app-content">
      <div className="window-drag top-drag" />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/stock/:id" element={<DetailPage />} />
        <Route path="/trades" element={<DashboardPage showAllInitially />} />
        <Route path="/settings" element={<SettingsPage onSettingsChange={(value) => setSettings(value)} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  </div></TooltipProvider>;
}
