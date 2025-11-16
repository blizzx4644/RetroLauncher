import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, CheckCircle, Loader2, Package, Cpu, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { tauriApi, RetroArchStatus, RetroArchCore, RecommendedEmulator } from '../utils/tauri';
import { useStore } from '../store/useStore';
import { open as openUrl } from '@tauri-apps/api/shell';
import { open as openDialog } from '@tauri-apps/api/dialog';
import { listen } from '@tauri-apps/api/event';

const RetroArchManager = () => {
  const { t } = useTranslation();
  const { addDownload, updateDownloadProgress } = useStore();
  const [retroArchStatus, setRetroArchStatus] = useState<RetroArchStatus | null>(null);
  const [installingRetroArch, setInstallingRetroArch] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [cores, setCores] = useState<RetroArchCore[]>([]);
  const [allCores, setAllCores] = useState<RetroArchCore[]>([]);
  const [installingCore, setInstallingCore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [installingAll, setInstallingAll] = useState(false);
  // const [installAllMessage, setInstallAllMessage] = useState<string | null>(null);
  const [showExternalModal, setShowExternalModal] = useState(false);
  const [extLoading, setExtLoading] = useState(false);
  const [recommended, setRecommended] = useState<RecommendedEmulator[]>([]);
  const [installingExtId, setInstallingExtId] = useState<string | null>(null);
  const installedCount = allCores.filter(c => c.installed).length;
  const totalCount = allCores.length;
  // First core popup removed for a smoother UX

  // Generate platform filters dynamically from detected cores
  const platforms = [
    { id: 'all', name: t('emulator.platform_all') },
    ...Array.from(new Set(allCores.map(c => c.platform)))
      .filter(p => p !== 'unknown')
      .sort()
      .map(platformId => {
        const core = allCores.find(c => c.platform === platformId);
        return {
          id: platformId,
          name: core?.platform_name || platformId.toUpperCase()
        };
      })
  ];

  useEffect(() => {
    loadRetroArchStatus();
  }, []);

  useEffect(() => {
    if (retroArchStatus?.installed) {
      loadAllCores();
    }
  }, [retroArchStatus]);

  useEffect(() => {
    filterCores();
  }, [selectedPlatform, allCores]);

  useEffect(() => {
    let unlisten: null | (() => void) = null;
    (async () => {
      unlisten = await listen('download-progress', (event: any) => {
        const { slug, stage, progress, message, bytesReceived, totalBytes, speedBps, title } = event.payload || {};
        // Update global downloads store
        updateDownloadProgress(slug, stage, progress ?? 0, message ?? '', { bytesReceived, totalBytes, speedBps, title });
      });
    })();
    return () => { if (unlisten) unlisten(); };
  }, []);

  const loadRetroArchStatus = async () => {
    try {
      setLoading(true);
      const status = await tauriApi.checkRetroArchStatus();
      setRetroArchStatus(status);
    } catch (error) {
      console.error('Failed to check RetroArch status:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllCores = async () => {
    try {
      const coresData = await tauriApi.getRetroArchCores();
      setAllCores(coresData);
    } catch (error) {
      console.error('Failed to load cores:', error);
    }
  };

  const filterCores = () => {
    if (selectedPlatform === 'all') {
      setCores(allCores);
    } else {
      setCores(allCores.filter(c => c.platform === selectedPlatform));
    }
  };

  const handleInstallRetroArch = async () => {
    setInstallingRetroArch(true);
    try {
      // Create download entry for RetroArch
      addDownload({ slug: 'retroarch', title: 'RetroArch', stage: 'starting', progress: 0, message: t('download_manager.starting') });
      await tauriApi.installRetroArch();
      await loadRetroArchStatus();
      alert(t('emulator.install_success'));
    } catch (error) {
      console.error('Failed to install RetroArch:', error);
      alert(t('emulator.install_failed', { error: String(error) }));
    } finally {
      setInstallingRetroArch(false);
    }
  };

  const handleInstallCore = async (coreId: string, coreTitle?: string) => {
    setInstallingCore(coreId);
    try {
      // Create download entry for this core
      addDownload({ slug: `core:${coreId}`, title: coreTitle ? `Core ${coreTitle}` : `Core ${coreId}`, stage: 'starting', progress: 0, message: t('download_manager.starting') });
      await tauriApi.installRetroArchCore(coreId);
      await loadAllCores();
      alert(t('emulator.core_install_success'));
    } catch (error) {
      console.error('Failed to install core:', error);
      alert(t('emulator.core_install_failed', { error: String(error) }));
    } finally {
      setInstallingCore(null);
    }
  };

  const handleCoreClick = async (coreId: string) => {
    try {
      await handleInstallCore(coreId, allCores.find(c => c.id === coreId)?.name);
    } catch (e) {
      console.error('Core install failed', e);
    }
  };

  const handleInstallAll = async () => {
    setInstallingAll(true);
    // setInstallAllMessage(t('emulator.preparing'));
    try {
      // Create a single aggregated download entry for bulk install
      addDownload({ slug: 'install_all_cores', title: 'Install All Cores', stage: 'starting', progress: 0, message: t('download_manager.starting') });
      const res = await tauriApi.installAllRetroArchCores(false);
      // setInstallAllMessage(res);
      await loadAllCores();
      alert(`✅ ${res}`);
    } catch (error: any) {
      console.error('Failed to install all cores:', error);
      const msg = typeof error === 'string' ? error : (error?.toString?.() || 'Unknown error');
      // setInstallAllMessage(msg);
      alert(`❌ ${msg}`);
    } finally {
      setInstallingAll(false);
    }
  };

  const handleReinstallAll = async () => {
    setInstallingAll(true);
    // setInstallAllMessage(t('emulator.forcing_reinstall'));
    try {
      // Aggregated popup for force reinstall
      addDownload({ slug: 'install_all_cores', title: 'Install All Cores', stage: 'starting', progress: 0, message: t('download_manager.starting') });
      const res = await tauriApi.installAllRetroArchCores(true);
      // setInstallAllMessage(res);
      await loadAllCores();
      alert(`✅ ${res}`);
    } catch (error: any) {
      console.error('Failed to reinstall all cores:', error);
      const msg = typeof error === 'string' ? error : (error?.toString?.() || 'Unknown error');
      // setInstallAllMessage(msg);
      alert(`❌ ${msg}`);
    } finally {
      setInstallingAll(false);
    }
  };

  const handleUninstallAll = async () => {
    setInstallingAll(true);
    // setInstallAllMessage(t('emulator.uninstalling_all'));
    try {
      const res = await tauriApi.uninstallAllRetroArchCores(false);
      // setInstallAllMessage(res);
      await loadAllCores();
      alert(`✅ ${res}`);
    } catch (error: any) {
      console.error('Failed to uninstall all cores:', error);
      const msg = typeof error === 'string' ? error : (error?.toString?.() || 'Unknown error');
      // setInstallAllMessage(msg);
      alert(`❌ ${msg}`);
    } finally {
      setInstallingAll(false);
    }
  };

  const handleRefresh = async () => {
    await loadAllCores();
    // setInstallAllMessage(t('emulator.refreshed_counter', { installed: installedCount, total: totalCount }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="p-6 border-b border-dark-700 bg-dark-900"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2
              className="text-3xl font-bold bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(90deg, var(--brand-from), var(--brand-to))' }}
            >
              {t('emulator.retroarch_setup')}
            </h2>
            <p className="text-gray-400 mt-1">
              {t('emulator.retroarch_desc')}
            </p>
            {retroArchStatus?.installed && (
              <div className="mt-2 text-sm text-gray-300">{t('emulator.cores_installed_counter', { installed: installedCount, total: totalCount })}</div>
            )}
          </div>

          {/* Action buttons in header */}
          {retroArchStatus?.installed && (
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setShowExternalModal(true);
                  setExtLoading(true);
                  try {
                    const rec = await tauriApi.getRecommendedEmulators();
                    setRecommended(rec);
                  } catch (e) {
                    console.error('Failed to load recommended emulators', e);
                  } finally {
                    setExtLoading(false);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-all"
                title={t('emulator.external_emulators_tooltip')}
              >
                {t('emulator.external_emulators')}
              </button>

              <button
                onClick={handleInstallAll}
                disabled={installingAll}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] rounded-lg hover:from-[var(--brand-from)] hover:to-[var(--brand-to)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {installingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('emulator.installing_all')}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    {t('emulator.install_all')}
                  </>
                )}
              </button>

              <button
                onClick={handleReinstallAll}
                disabled={installingAll}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] rounded-lg hover:from-[var(--brand-from)] hover:to-[var(--brand-to)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {installingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('emulator.reinstalling')}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    {t('emulator.reinstall_all')}
                  </>
                )}
              </button>

              <button
                onClick={handleUninstallAll}
                disabled={installingAll}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {installingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('emulator.uninstalling')}
                  </>
                ) : (
                  <>{t('emulator.uninstall_all')}</>
                )}
              </button>

              <button
                onClick={handleRefresh}
                className="px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm"
              >
                {t('common.refresh')}
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* RetroArch Installation Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${retroArchStatus?.installed ? 'bg-green-500/20' : 'bg-gray-700/50'}`}>
                <Package className={`w-6 h-6 ${retroArchStatus?.installed ? 'text-green-400' : 'text-gray-400'}`} />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">RetroArch</h3>
                {retroArchStatus?.installed ? (
                  <div className="space-y-1">
                    <p className="text-green-400 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      {t('emulator.installed_with_version', { version: retroArchStatus.version })}
                    </p>
                    <p className="text-xs text-gray-400">{retroArchStatus.path}</p>
                  </div>
                ) : (
                  <p className="text-gray-400">{t('emulator.not_installed')}</p>
                )}
              </div>
            </div>

            {!retroArchStatus?.installed && (
              <button
                onClick={handleInstallRetroArch}
                disabled={installingRetroArch}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] rounded-lg hover:from-[var(--brand-from)] hover:to-[var(--brand-to)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {installingRetroArch ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('common.installing')}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    {t('emulator.install_retroarch')}
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>

        {/* Info Banner */}
        {!retroArchStatus?.installed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4"
          >
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-200">
                <p className="font-semibold mb-1">{t('emulator.about_title')}</p>
                <p>{t('emulator.about_desc')}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Cores Management */}
        {retroArchStatus?.installed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            {/* Platform Filters */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => setSelectedPlatform(platform.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                    selectedPlatform === platform.id
                      ? 'bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] text-white shadow-lg'
                      : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  {platform.name}
                </button>
              ))}
            </div>

            {/* Cores Grid - avec scroll */}
            <div className="max-h-[600px] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {cores.map((core) => (
                    <motion.div
                      key={core.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={`bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border ${
                        core.installed ? 'border-green-500/30' : 'border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${core.installed ? 'bg-green-500/20' : 'bg-gray-700/50'}`}>
                            <Cpu className={`w-5 h-5 ${core.installed ? 'text-green-400' : 'text-gray-400'}`} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-white">{core.name}</h4>
                            {core.recommended && (
                              <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                                {t('emulator.recommended')}
                              </span>
                            )}
                          </div>
                        </div>
                        {core.installed && (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        )}
                      </div>

                      <p className="text-sm text-gray-400 mb-1">{core.platform_name}</p>
                      <p className="text-xs text-gray-500 mb-4">{core.description}</p>

                      {!core.installed && (
                        <button
                          onClick={() => handleCoreClick(core.id)}
                          disabled={installingCore === core.id}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {installingCore === core.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t('common.installing')}
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              {t('emulator.install_core')}
                            </>
                          )}
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {cores.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <Cpu className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{t('emulator.no_cores_for_platform')}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* External Emulators Modal */}
      <AnimatePresence>
        {showExternalModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowExternalModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-4xl bg-dark-900 border border-dark-700 rounded-xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold">{t('emulator.external_modal.title')}</h3>
                <button className="px-3 py-1 bg-gray-800 rounded-lg hover:bg-gray-700" onClick={() => setShowExternalModal(false)}>{t('common.close')}</button>
              </div>

              {extLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto pr-2">
                  {recommended.map((emu) => (
                    <div key={emu.id} className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
                      <h4 className="font-semibold text-white">{emu.name}</h4>
                      <p className="text-xs text-gray-400 mb-2">{emu.platform_names?.join(', ') || emu.platforms.join(', ')}</p>
                      <p className="text-xs text-gray-500 mb-4">{emu.description}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            setInstallingExtId(emu.id);
                            try {
                              // Step 1: open official download page
                              if (emu.download_page) {
                                await openUrl(emu.download_page);
                              }

                              // Step 2: browse for executable
                              const exe = await openDialog({
                                title: t('emulator.external_modal.select_exec', { name: emu.name }),
                                filters: [{ name: t('common.executable'), extensions: ['exe'] }],
                                multiple: false,
                              });
                              if (!exe || Array.isArray(exe)) {
                                return; // user cancelled
                              }

                              // Step 3: register emulator for all supported platforms
                              const platforms = emu.platforms && emu.platforms.length > 0 ? emu.platforms : ['unknown'];
                              for (const p of platforms) {
                                await tauriApi.addEmulator({
                                  id: `${emu.id}_${p}`,
                                  name: emu.name,
                                  platform: p,
                                  executable_path: exe,
                                  arguments: '',
                                  icon_path: null as any,
                                } as any);
                              }

                              alert(t('emulator.external_modal.configured', { name: emu.name, platforms: platforms.join(', ') }));
                            } catch (e) {
                              console.error('Failed to configure emulator', e);
                              alert(t('emulator.external_modal.configure_failed', { name: emu.name, error: String(e) }));
                            } finally {
                              setInstallingExtId(null);
                            }
                          }}
                          disabled={installingExtId === emu.id}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] rounded-lg hover:from-[var(--brand-from)] hover:to-[var(--brand-to)] disabled:opacity-50 text-sm"
                        >
                          {installingExtId === emu.id ? (
                            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {t('common.setting_up')}</span>
                          ) : (
                            t('emulator.external_modal.setup')
                          )}
                        </button>
                        <a
                          href={emu.download_page}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm"
                        >
                          {t('emulator.external_modal.website')}
                        </a>
                      </div>
                    </div>
                  ))}
                  {recommended.length === 0 && (
                    <div className="text-gray-400 text-sm">{t('emulator.external_modal.none')}</div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RetroArchManager;
