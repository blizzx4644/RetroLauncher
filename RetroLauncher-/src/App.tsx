import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from './store/useStore';
import { tauriApi } from './utils/tauri';

import Sidebar from './components/Sidebar';
import Library from './components/Library';
import Favorites from './components/Favorites';
import Download from './components/Download';
import RetroArchManager from './components/RetroArchManager';
import Settings from './components/Settings';
import DownloadManager from './components/DownloadManager';
import BigPictureMode from './components/BigPictureMode';

function App() {
  const { i18n } = useTranslation();
  const { currentView, setGames, setEmulators, theme, layout, bigPictureMode, colorPalette, bpColorPalette, language } = useStore();

  useEffect(() => {
    // Load initial data
    const loadData = async () => {
      try {
        const games = await tauriApi.getGames();
        setGames(games);

        const emulators = await tauriApi.getEmulators();
        setEmulators(emulators);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };

    loadData();
  }, [setGames, setEmulators]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.remove('light');
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
      }
    };

    if (theme === 'auto') {
      // Detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark);

      // Listen for system theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      applyTheme(theme === 'dark');
    }
  }, [theme]);

  // Apply layout
  useEffect(() => {
    const root = document.documentElement;
    if (layout === 'compact') {
      root.style.setProperty('--spacing-scale', '0.75');
      root.style.setProperty('--font-scale', '0.9');
    } else {
      root.style.setProperty('--spacing-scale', '1');
      root.style.setProperty('--font-scale', '1');
    }
  }, [layout]);

  // Apply color palette (normal vs Big Picture)
  useEffect(() => {
    const root = document.documentElement;
    const palette = bigPictureMode ? bpColorPalette : colorPalette;

    // Define palettes (HSL for --primary, HEX for gradient brand vars)
    const map: Record<string, { primary: string; ring: string; brandFrom: string; brandTo: string }> = {
      purplePink: {
        primary: '271 81% 56%',
        ring: '271 81% 56%',
        brandFrom: '#a855f7', // purple-500
        brandTo: '#ec4899',   // pink-500
      },
      tealOrange: {
        primary: '173 80% 40%',
        ring: '173 80% 40%',
        brandFrom: '#14b8a6', // teal-500
        brandTo: '#f97316',   // orange-500
      },
      emeraldBlue: {
        primary: '160 84% 39%',
        ring: '160 84% 39%',
        brandFrom: '#10b981', // emerald-500
        brandTo: '#3b82f6',   // blue-500
      },
      redGold: {
        primary: '0 84% 60%',
        ring: '0 84% 60%',
        brandFrom: '#ef4444', // red-500
        brandTo: '#f59e0b',   // amber-500
      },
    };

    const cfg = map[palette] || map.purplePink;
    root.style.setProperty('--primary', cfg.primary);
    root.style.setProperty('--ring', cfg.ring);
    root.style.setProperty('--brand-from', cfg.brandFrom);
    root.style.setProperty('--brand-to', cfg.brandTo);
  }, [colorPalette, bpColorPalette, bigPictureMode]);

  // Apply persisted language on startup and when it changes
  useEffect(() => {
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  const renderView = () => {
    switch (currentView) {
      case 'library':
        return <Library />;
      case 'favorites':
        return <Favorites />;
      case 'download':
        return <Download />;
      case 'emulators':
        return <RetroArchManager />;
      case 'settings':
        return <Settings />;
      default:
        return <Library />;
    }
  };

  return (
    <div className={bigPictureMode ? "flex h-screen text-white" : "flex h-screen bg-dark-950 text-white"}>
      {bigPictureMode ? (
        // Big Picture gets a brand gradient background
        (() => {
          const map: Record<string, { from: string; to: string }> = {
            purplePink: { from: '#a855f7', to: '#ec4899' },
            tealOrange: { from: '#14b8a6', to: '#f97316' },
            emeraldBlue: { from: '#10b981', to: '#3b82f6' },
            redGold: { from: '#ef4444', to: '#f59e0b' },
          };
          const p = map[bpColorPalette] || map.purplePink;
          return (
            <div
              className="w-full h-full"
              style={{ backgroundImage: `linear-gradient(135deg, ${p.from}, ${p.to})` }}
            >
              <BigPictureMode />
            </div>
          );
        })()
      ) : (
        <>
          <Sidebar />
          <main className="flex-1 overflow-hidden">
            {renderView()}
          </main>

          {/* Download Manager - Floating notifications */}
          <DownloadManager />
        </>
      )}
    </div>
  );
}

export default App;
