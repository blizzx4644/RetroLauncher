import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Globe, Palette, Layout, Info, FolderOpen, Shield, Gamepad2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { appDataDir, join } from '@tauri-apps/api/path';
import { message } from '@tauri-apps/api/dialog';
import { tauriApi } from '../utils/tauri';

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, layout, setLayout, bigPictureMode, setBigPictureMode, colorPalette, setColorPalette, bpColorPalette, setBpColorPalette, setLanguage, windowedFullscreen, setWindowedFullscreen } = useStore();

  const languages = [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
  ];

  const handleLanguageChange = (langCode: string) => {
    setLanguage(langCode);
    i18n.changeLanguage(langCode);
  };

  const handleThemeChange = (newTheme: 'dark' | 'light' | 'auto') => {
    setTheme(newTheme);
    console.log('Theme changed to:', newTheme);
  };

  const handleLayoutChange = (newLayout: 'compact' | 'comfortable') => {
    setLayout(newLayout);
    console.log('Layout changed to:', newLayout);
  };

  const handleOpenFolder = async (folderPath: string, folderName: string) => {
    try {
      await tauriApi.openFolderInExplorer(folderPath);
    } catch (error) {
      console.error(`Error opening folder ${folderPath}:`, error);
      await message(
        `Impossible d'ouvrir le dossier ${folderName}.\n\nChemin: ${folderPath}\n\nErreur: ${error}`,
        { title: 'Erreur', type: 'error' }
      );
    }
  };

  const openAppFolder = async () => {
    try {
      const base = await appDataDir();
      console.log('Opening app data directory:', base);
      await handleOpenFolder(base, 'de l\'application');
    } catch (error) {
      console.error('Failed to get app data dir:', error);
      await message(
        'Impossible de déterminer le dossier de l\'application.\n\nErreur: ' + error,
        { title: 'Erreur', type: 'error' }
      );
    }
  };

  const openRetroArchFolder = async () => {
    try {
      const base = await appDataDir();
      const dir = await join(base, 'retroarch');
      console.log('Opening RetroArch directory:', dir);
      await handleOpenFolder(dir, 'RetroArch');
    } catch (error) {
      console.error('Failed to open RetroArch folder:', error);
      await message(
        'Erreur lors de l\'ouverture du dossier RetroArch.\n\nErreur: ' + error,
        { type: 'error' }
      );
    }
  };

  const openGamesFolder = async () => {
    try {
      const base = await appDataDir();
      const dir = await join(base, 'games');
      console.log('Opening games directory:', dir);
      await handleOpenFolder(dir, 'des jeux');
    } catch (error) {
      console.error('Failed to open games folder:', error);
      await message(
        'Erreur lors de l\'ouverture du dossier des jeux.\n\nErreur: ' + error,
        { type: 'error' }
      );
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="p-6 border-b border-dark-700 bg-dark-900"
      >
        <h2
          className="text-3xl font-bold bg-clip-text text-transparent"
          style={{ backgroundImage: 'linear-gradient(90deg, var(--brand-from), var(--brand-to))' }}
        >
          {t('settings.title')}
        </h2>
        <p className="text-dark-400 mt-1">{t('settings.subtitle')}</p>
      </motion.div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Language Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-effect rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{t('settings.language')}</h3>
                <p className="text-sm text-dark-400">{t('settings.language_desc')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {languages.map((lang) => (
                <motion.button
                  key={lang.code}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`
                    p-4 rounded-lg border-2 transition-all
                    ${
                      i18n.language === lang.code
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-dark-700 hover:border-dark-600'
                    }
                  `}
                >
                  <div className="text-3xl mb-2">{lang.flag}</div>
                  <div className="font-medium">{lang.name}</div>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Appearance Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-effect rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{t('settings.appearance')}</h3>
                <p className="text-sm text-dark-400">{t('settings.appearance_desc')}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('settings.theme')}</label>
                <div className="grid grid-cols-3 gap-3">
                  {['dark', 'light', 'auto'].map((themeOption) => (
                    <button
                      key={themeOption}
                      onClick={() => handleThemeChange(themeOption as 'dark' | 'light' | 'auto')}
                      className={`p-3 rounded-lg border-2 font-medium transition-all ${
                        theme === themeOption
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-dark-700 hover:border-dark-600'
                      }`}
                    >
                      {t(`settings.${themeOption}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Palette (Normal Mode) */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('settings.palette_normal')}</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'purplePink', from: '#a855f7', to: '#ec4899', label: t('settings.palette_purple_pink') },
                    { id: 'tealOrange', from: '#14b8a6', to: '#f97316', label: t('settings.palette_teal_orange') },
                    { id: 'emeraldBlue', from: '#10b981', to: '#3b82f6', label: t('settings.palette_emerald_blue') },
                    { id: 'redGold', from: '#ef4444', to: '#f59e0b', label: t('settings.palette_red_gold') },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setColorPalette(p.id as any)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        colorPalette === p.id ? 'border-primary-500 bg-primary-500/10' : 'border-dark-700 hover:border-dark-600'
                      }`}
                    >
                      <div className="h-6 rounded bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(90deg, ${p.from}, ${p.to})` }} />
                      <div className="mt-2 text-sm">{p.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Palette (Big Picture) */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('settings.palette_bp')}</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'purplePink', from: '#a855f7', to: '#ec4899', label: t('settings.palette_purple_pink') },
                    { id: 'tealOrange', from: '#14b8a6', to: '#f97316', label: t('settings.palette_teal_orange') },
                    { id: 'emeraldBlue', from: '#10b981', to: '#3b82f6', label: t('settings.palette_emerald_blue') },
                    { id: 'redGold', from: '#ef4444', to: '#f59e0b', label: t('settings.palette_red_gold') },
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => setBpColorPalette(p.id as any)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        bpColorPalette === p.id ? 'border-primary-500 bg-primary-500/10' : 'border-dark-700 hover:border-dark-600'
                      }`}
                    >
                      <div className="h-6 rounded bg-gradient-to-r" style={{ backgroundImage: `linear-gradient(90deg, ${p.from}, ${p.to})` }} />
                      <div className="mt-2 text-sm">{p.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Windowed Fullscreen (Borderless) */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('settings.windowed_fullscreen')}</label>
                <div className="flex items-center justify-between p-3 rounded-lg border-2 border-dark-700">
                  <span className="text-sm text-dark-300">{t('settings.windowed_fullscreen_desc')}</span>
                  <button
                    onClick={() => setWindowedFullscreen(!windowedFullscreen)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${windowedFullscreen ? 'bg-primary-600' : 'bg-dark-700'}`}
                    aria-pressed={windowedFullscreen}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${windowedFullscreen ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Big Picture Mode */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-effect rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{t('big_picture.title')}</h3>
                <p className="text-sm text-dark-400">{t('big_picture.subtitle')}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg">
                <div>
                  <p className="font-medium">{t('big_picture.enable')}</p>
                  <p className="text-sm text-dark-400">{t('big_picture.enable_desc')}</p>
                </div>
                <button
                  onClick={() => setBigPictureMode(!bigPictureMode)}
                  className={`relative w-14 h-7 rounded-full transition-colors ${
                    bigPictureMode ? 'bg-primary-600' : 'bg-dark-700'
                  }`}
                >
                  <motion.div
                    animate={{ x: bigPictureMode ? 28 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-5 h-5 bg-white rounded-full"
                  />
                </button>
              </div>
              <div className="p-3 bg-purple-900/20 border border-purple-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 mt-0.5 text-purple-400 flex-shrink-0" />
                  <div className="text-sm text-purple-300">
                    <p className="font-medium mb-1">{t('big_picture.controls_title')}</p>
                    <ul className="space-y-1 text-xs">
                      <li>• {t('big_picture.controls.navigate')}</li>
                      <li>• {t('big_picture.controls.select_play')}</li>
                      <li>• {t('big_picture.controls.back')}</li>
                      <li>• {t('big_picture.controls.toggle_favorite')}</li>
                      <li>• {t('big_picture.controls.show_info')}</li>
                      <li>• {t('big_picture.controls.start_play')}</li>
                      <li>• {t('big_picture.controls.select_main')}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Layout Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-effect rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <Layout className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{t('settings.layout')}</h3>
                <p className="text-sm text-dark-400">{t('settings.layout_desc')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {['compact', 'comfortable'].map((layoutOption) => (
                <button
                  key={layoutOption}
                  onClick={() => handleLayoutChange(layoutOption as 'compact' | 'comfortable')}
                  className={`p-3 rounded-lg border-2 font-medium transition-all ${
                    layout === layoutOption
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-dark-700 hover:border-dark-600'
                  }`}
                >
                  {t(`settings.${layoutOption}`)}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Storage / Paths */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-effect rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{t('settings.storage.title')}</h3>
                <p className="text-sm text-dark-400">{t('settings.storage.description')}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-blue-900/20 border border-blue-800 rounded-lg mb-4">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 mt-0.5 text-blue-400 flex-shrink-0" />
                  <p className="text-sm text-blue-300">
                    {t('settings.storage.info')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={openAppFolder}
                  className="px-4 py-3 bg-dark-800 hover:bg-dark-700 rounded-lg border border-dark-700 hover:border-primary-500 transition-colors text-left"
                >
                  <div className="font-semibold flex items-center gap-2">
                    {t('settings.storage.app_folder')}
                  </div>
                  <div className="text-xs text-dark-400 mt-1">{t('settings.storage.app_folder_desc')}</div>
                </button>

                <button
                  onClick={openRetroArchFolder}
                  className="px-4 py-3 bg-dark-800 hover:bg-dark-700 rounded-lg border border-dark-700 hover:border-primary-500 transition-colors text-left"
                >
                  <div className="font-semibold flex items-center gap-2">
                    {t('settings.storage.retroarch_folder')}
                  </div>
                  <div className="text-xs text-dark-400 mt-1">{t('settings.storage.retroarch_folder_desc')}</div>
                </button>

                <button
                  onClick={openGamesFolder}
                  className="px-4 py-3 bg-dark-800 hover:bg-dark-700 rounded-lg border border-dark-700 hover:border-primary-500 transition-colors text-left"
                >
                  <div className="font-semibold">{t('settings.storage.games_folder')}</div>
                  <div className="text-xs text-dark-400 mt-1">{t('settings.storage.games_folder_desc')}</div>
                </button>
              </div>
            </div>
          </motion.div>

          {/* About */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-effect rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{t('settings.about')}</h3>
                <p className="text-sm text-dark-400">{t('settings.about_desc')}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-dark-400">
              <p>
                <strong className="text-white">{t('settings.about_version')}:</strong> 1.0.0
              </p>
              <p>
                <strong className="text-white">{t('settings.about_built_with')}:</strong> Tauri + React + TypeScript
              </p>
              <p>
                <strong className="text-white">{t('settings.about_features')}:</strong> CrocDB Integration, Multi-language
                Support, Game Statistics Tracking
              </p>
              <p className="pt-4 border-t border-dark-700">
                {t('settings.about_tagline')}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
