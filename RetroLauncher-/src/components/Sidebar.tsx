import { useTranslation } from 'react-i18next';
import { Library, Star, Download, Gamepad2, Settings } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion } from 'framer-motion';

const Sidebar = () => {
  const { t } = useTranslation();
  const { currentView, setCurrentView } = useStore();

  const navItems = [
    { id: 'library', icon: Library, label: t('nav.library') },
    { id: 'favorites', icon: Star, label: t('nav.favorites') },
    { id: 'download', icon: Download, label: t('nav.download') },
    { id: 'emulators', icon: Gamepad2, label: t('nav.emulators') },
    { id: 'settings', icon: Settings, label: t('nav.settings') },
  ] as const;

  return (
    <motion.aside
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      className="w-64 bg-dark-900 border-r border-dark-700 flex flex-col"
    >
      {/* Logo */}
      <div className="p-6 border-b border-dark-700">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] bg-clip-text text-transparent">
          {t('app.title')}
        </h1>
        <p className="text-sm text-dark-400 mt-1">{t('app.subtitle')}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <motion.button
              key={item.id}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setCurrentView(item.id as any)}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg
                transition-all duration-200
                ${
                  isActive
                    ? 'bg-[var(--brand-from)] text-white shadow-lg'
                    : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </motion.button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-dark-700">
        <div className="text-xs text-dark-500 text-center">
          RetroLauncher v1.0.0
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
