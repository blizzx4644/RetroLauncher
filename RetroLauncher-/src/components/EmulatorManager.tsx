import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Gamepad2, Trash2, Edit, Download, ExternalLink, Loader2, FileSearch, Folder } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { tauriApi, RecommendedEmulator } from '../utils/tauri';
import { open } from '@tauri-apps/api/dialog';
import { open as openUrl } from '@tauri-apps/api/shell';

const EmulatorManager = () => {
  const { t } = useTranslation();
  const { emulators, setEmulators } = useStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'recommended' | 'installed'>('recommended');
  const [recommendedEmulators, setRecommendedEmulators] = useState<RecommendedEmulator[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [selectedEmulatorForSetup, setSelectedEmulatorForSetup] = useState<RecommendedEmulator | null>(null);
  const [newEmulator, setNewEmulator] = useState({
    name: '',
    platform: '',
    executable_path: '',
    arguments: '',
  });

  useEffect(() => {
    loadRecommendedEmulators();
  }, []);

  const loadRecommendedEmulators = async () => {
    try {
      const recommended = await tauriApi.getRecommendedEmulators();
      setRecommendedEmulators(recommended);
    } catch (error) {
      console.error('Failed to load recommended emulators:', error);
    }
  };

  const handleOpenSetupGuide = (emulator: RecommendedEmulator) => {
    setSelectedEmulatorForSetup(emulator);
    setShowSetupGuide(true);
  };

  const handleOpenDownloadPage = async (url: string) => {
    try {
      await openUrl(url);
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };

  const handleBrowseExecutable = async () => {
    if (!selectedEmulatorForSetup) return;

    try {
      const selected = await open({
        filters: [{
          name: 'Executable',
          extensions: ['exe', 'app']
        }],
        multiple: false,
      });

      if (selected && typeof selected === 'string') {
        // Add emulator to database for each supported platform
        setInstalling(selectedEmulatorForSetup.id);

        for (let idx = 0; idx < selectedEmulatorForSetup.platforms.length; idx++) {
          const platform = selectedEmulatorForSetup.platforms[idx];
          const emu_id = idx === 0
            ? `${selectedEmulatorForSetup.id}_${platform}`
            : `${selectedEmulatorForSetup.id}_${platform}_${idx}`;

          const platform_name = selectedEmulatorForSetup.platform_names[idx] || platform.toUpperCase();

          const emulatorConfig = {
            id: emu_id,
            name: `${selectedEmulatorForSetup.name} (${platform_name})`,
            platform: platform,
            executable_path: selected,
            arguments: '',
          };

          await tauriApi.addEmulator(emulatorConfig);
        }

        // Refresh emulator list
        const updated = await tauriApi.getEmulators();
        setEmulators(updated);

        setShowSetupGuide(false);
        setActiveTab('installed');
        alert(`✅ ${selectedEmulatorForSetup.name} configured successfully!`);
      }
    } catch (error) {
      console.error('Failed to add emulator:', error);
      alert(`❌ Failed to configure emulator: ${error}`);
    } finally {
      setInstalling(null);
    }
  };

  const handleAddEmulator = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const emulator = {
        id: `emu_${Date.now()}`,
        ...newEmulator,
      };
      await tauriApi.addEmulator(emulator);
      const updated = await tauriApi.getEmulators();
      setEmulators(updated);
      setShowAddModal(false);
      setNewEmulator({ name: '', platform: '', executable_path: '', arguments: '' });
    } catch (error) {
      console.error('Failed to add emulator:', error);
    }
  };

  const platforms = ['NES', 'SNES', 'Genesis', 'N64', 'PS1', 'PS2', 'GBA', 'NDS', '3DS', 'PSP', 'GameCube', 'Wii', 'Other'];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="p-6 border-b border-dark-700 bg-dark-900"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold">{t('emulator.title')}</h2>
            <p className="text-dark-400 mt-1">{emulators.length} emulators configured</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Manually
          </motion.button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('recommended')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'recommended'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-800 text-dark-400 hover:text-white'
            }`}
          >
            Recommended ({recommendedEmulators.length})
          </button>
          <button
            onClick={() => setActiveTab('installed')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'installed'
                ? 'bg-primary-600 text-white'
                : 'bg-dark-800 text-dark-400 hover:text-white'
            }`}
          >
            Your Emulators ({emulators.length})
          </button>
        </div>
      </motion.div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'recommended' ? (
          // Recommended Emulators Tab
          <div>
            <div className="mb-6 p-4 bg-blue-900/20 border border-blue-600 rounded-lg">
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                <FileSearch className="w-5 h-5" />
                Guided Installation
              </h3>
              <p className="text-dark-400">
                Click "Setup Guide" to get step-by-step instructions for installing each emulator. We'll help you download and configure it.
              </p>
            </div>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {recommendedEmulators.map((emulator) => (
                <motion.div
                  key={emulator.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-dark-800 border border-dark-700 rounded-xl p-5 hover:border-primary-500 transition-colors"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Gamepad2 className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg mb-1">{emulator.name}</h3>
                      <p className="text-xs text-dark-400 line-clamp-2">
                        {emulator.description}
                      </p>
                    </div>
                  </div>

                  {/* Platforms */}
                  <div className="mb-3">
                    <p className="text-xs text-dark-500 mb-2">Supports:</p>
                    <div className="flex flex-wrap gap-1">
                      {emulator.platform_names.slice(0, 4).map((platform, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-dark-700 text-xs rounded"
                        >
                          {platform}
                        </span>
                      ))}
                      {emulator.platform_names.length > 4 && (
                        <span className="px-2 py-1 bg-dark-700 text-xs rounded">
                          +{emulator.platform_names.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleOpenSetupGuide(emulator)}
                      className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <FileSearch className="w-4 h-4" />
                      Setup Guide
                    </motion.button>
                    <a
                      href={emulator.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors flex items-center justify-center"
                      onClick={(e) => {
                        e.preventDefault();
                        handleOpenDownloadPage(emulator.website);
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          // Your Emulators Tab
          <div>
            {emulators.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center py-12"
              >
                <Gamepad2 className="w-24 h-24 mb-4 opacity-20" />
                <h3 className="text-2xl font-bold mb-2">No emulators installed</h3>
                <p className="text-dark-400 mb-6">
                  Install emulators from the Recommended tab or add your own
                </p>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab('recommended')}
                    className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors"
                  >
                    Browse Recommended
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowAddModal(true)}
                    className="px-6 py-3 bg-dark-700 hover:bg-dark-600 rounded-lg font-medium transition-colors"
                  >
                    <Plus className="w-5 h-5 inline mr-2" />
                    Add Manually
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {emulators.map((emulator) => (
                  <motion.div
                    key={emulator.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-dark-800 border border-dark-700 rounded-xl p-4 hover:border-primary-500 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center">
                          <Gamepad2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold">{emulator.name}</h3>
                          <p className="text-sm text-dark-400 uppercase">{emulator.platform}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 hover:bg-dark-700 rounded-lg transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-red-600 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-dark-500 font-mono truncate bg-dark-900 p-2 rounded">
                      {emulator.executable_path}
                    </div>
                    {emulator.arguments && (
                      <div className="text-xs text-dark-500 mt-2">
                        Args: <span className="font-mono">{emulator.arguments}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Setup Guide Modal */}
      <AnimatePresence>
        {showSetupGuide && selectedEmulatorForSetup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowSetupGuide(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-dark-900 border border-dark-700 rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Gamepad2 className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{selectedEmulatorForSetup.name} Setup Guide</h2>
                  <p className="text-dark-400">{selectedEmulatorForSetup.description}</p>
                </div>
              </div>

              {/* Installation Steps */}
              <div className="space-y-4 mb-6">
                <div className="p-4 bg-dark-800 rounded-lg border border-dark-700">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm font-bold">
                      1
                    </div>
                    <h3 className="font-bold">Download the Emulator</h3>
                  </div>
                  <p className="text-sm text-dark-400 mb-3 ml-11">
                    {selectedEmulatorForSetup.install_instructions}
                  </p>
                  <button
                    onClick={() => handleOpenDownloadPage(selectedEmulatorForSetup.download_page)}
                    className="ml-11 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Open Download Page
                  </button>
                </div>

                <div className="p-4 bg-dark-800 rounded-lg border border-dark-700">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <h3 className="font-bold">Locate the Executable</h3>
                  </div>
                  <p className="text-sm text-dark-400 mb-3 ml-11">
                    After downloading and extracting, find the executable file:
                  </p>
                  <div className="ml-11 p-3 bg-dark-900 rounded font-mono text-sm">
                    {selectedEmulatorForSetup.executable_name_windows || 'emulator.exe'}
                  </div>
                </div>

                <div className="p-4 bg-dark-800 rounded-lg border border-dark-700">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm font-bold">
                      3
                    </div>
                    <h3 className="font-bold">Configure in RetroLauncher</h3>
                  </div>
                  <p className="text-sm text-dark-400 mb-3 ml-11">
                    Click the button below and browse to the executable file you just downloaded.
                  </p>
                  <button
                    onClick={handleBrowseExecutable}
                    disabled={installing === selectedEmulatorForSetup.id}
                    className="ml-11 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {installing === selectedEmulatorForSetup.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Configuring...
                      </>
                    ) : (
                      <>
                        <Folder className="w-4 h-4" />
                        Browse for Executable
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Platforms supported */}
              <div className="mb-6">
                <h3 className="font-bold mb-2">Platforms Supported:</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedEmulatorForSetup.platform_names.map((platform, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-primary-600/20 border border-primary-600 text-sm rounded"
                    >
                      {platform}
                    </span>
                  ))}
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowSetupGuide(false)}
                className="w-full px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Manual Emulator Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-dark-900 border border-dark-700 rounded-2xl p-6 w-full max-w-md m-4"
            >
              <h3 className="text-2xl font-bold mb-4">Add Emulator Manually</h3>
              <form onSubmit={handleAddEmulator} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <input
                    type="text"
                    required
                    value={newEmulator.name}
                    onChange={(e) => setNewEmulator({ ...newEmulator, name: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-primary-500"
                    placeholder="RetroArch, Dolphin, PCSX2..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Platform</label>
                  <select
                    required
                    value={newEmulator.platform}
                    onChange={(e) => setNewEmulator({ ...newEmulator, platform: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-primary-500"
                  >
                    <option value="">Select platform...</option>
                    {platforms.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Executable Path</label>
                  <input
                    type="text"
                    required
                    value={newEmulator.executable_path}
                    onChange={(e) => setNewEmulator({ ...newEmulator, executable_path: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-primary-500"
                    placeholder="C:\Program Files\RetroArch\retroarch.exe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Arguments (optional)</label>
                  <input
                    type="text"
                    value={newEmulator.arguments}
                    onChange={(e) => setNewEmulator({ ...newEmulator, arguments: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-primary-500"
                    placeholder="-L cores/core.dll"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors"
                  >
                    Save
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmulatorManager;
