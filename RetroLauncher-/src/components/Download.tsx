import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Download as DownloadIcon, Loader2, Filter, X, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { tauriApi, CrocDBGame, PlatformInfo } from '../utils/tauri';
import { useStore } from '../store/useStore';
import { listen } from '@tauri-apps/api/event';

const Download = () => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CrocDBGame[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<CrocDBGame | null>(null);
  const [boxartCache, setBoxartCache] = useState<Record<string, string>>({});

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [availablePlatforms, setAvailablePlatforms] = useState<Record<string, PlatformInfo>>({});
  const [availableRegions, setAvailableRegions] = useState<Record<string, string>>({});
  const [hideGamesWithoutImage, setHideGamesWithoutImage] = useState(false);

  const { games, setGames, addDownload, updateDownloadProgress, removeDownload } = useStore();

  // Load platforms and regions on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load available platforms and regions for filters
        const platforms = await tauriApi.getCrocDBPlatforms();
        setAvailablePlatforms(platforms);

        const regions = await tauriApi.getCrocDBRegions();
        setAvailableRegions(regions);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
  }, []);

  // Listen to download progress events
  useEffect(() => {
    console.log('🎧 Setting up download-progress listener');

    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      unlistenFn = await listen('download-progress', (event: any) => {
        const { slug, stage, progress, message, bytesReceived, totalBytes, speedBps, title } = event.payload || {};
        console.log('📥 Download progress event:', { slug, stage, progress, message });

        // Always update the progress display
        updateDownloadProgress(slug, stage, progress, message, { bytesReceived, totalBytes, speedBps, title });

        // Check if installation is complete (only on explicit completed stage)
        if (stage === 'completed') {
          console.log('✅ Installation completed! Cleaning up in 3 seconds...');

          setTimeout(() => {
            console.log('🧹 Removing download and refreshing library...');
            removeDownload(slug);
            setInstalling(null);

            // Refresh games library
            tauriApi.getGames().then(games => {
              setGames(games);
              console.log('📚 Library refreshed successfully:', games.length, 'games');
            }).catch(err => {
              console.error('❌ Failed to refresh library:', err);
            });
          }, 3000);
        }
      });

      console.log('✅ Download-progress listener setup complete');
    };

    setupListener().catch(err => {
      console.error('❌ Failed to setup listener:', err);
    });

    return () => {
      console.log('🔇 Cleaning up download-progress listener');
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []); // Empty dependencies - listener persists for component lifetime

  // Load boxarts for visible games progressively
  useEffect(() => {
    const loadBoxarts = async () => {
      // Load boxarts for the first 12 games (visible on screen)
      const visibleGames = searchResults.slice(0, 12);

      for (const game of visibleGames) {
        // Skip if already cached
        if (boxartCache[game.slug]) continue;

        try {
          const fullGame = await tauriApi.getCrocDBEntry(game.slug);
          if (fullGame.cover_url) {
            setBoxartCache(prev => ({ ...prev, [game.slug]: fullGame.cover_url! }));
          }
        } catch (error) {
          console.error(`Failed to load boxart for ${game.slug}:`, error);
        }
      }
    };

    if (searchResults.length > 0) {
      loadBoxarts();
    }
  }, [searchResults]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() && selectedPlatforms.length === 0 && selectedRegions.length === 0) return;

    setIsSearching(true);
    try {
      console.log('🔍 Searching CrocDB...', {
        query: searchQuery,
        platforms: selectedPlatforms,
        regions: selectedRegions
      });

      // Use advanced search with filters
      const response = await tauriApi.searchCrocDBAdvanced(
        searchQuery.trim() || undefined,
        selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
        selectedRegions.length > 0 ? selectedRegions : undefined,
        50, // max results
        1   // page
      );

      console.log('✅ CrocDB Response:', response);
      console.log('📊 Total results:', response.total_results);
      console.log('📊 Current results:', response.results.length);

      if (response.results.length > 0) {
        console.log('🎮 First game:', response.results[0]);
        console.log('🔗 Download links:', response.results[0].download_links);
        console.log('🔗 Links count:', response.results[0].download_links?.length || 0);
      }

      setSearchResults(response.results);
    } catch (error) {
      console.error('❌ Search failed:', error);
      alert(`Search failed: ${error}`);
    } finally {
      setIsSearching(false);
    }
  };

  const clearFilters = () => {
    setSelectedPlatforms([]);
    setSelectedRegions([]);
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  };

  const toggleRegion = (region: string) => {
    setSelectedRegions(prev =>
      prev.includes(region) ? prev.filter(r => r !== region) : [...prev, region]
    );
  };

  const handleInstallClick = async (game: CrocDBGame) => {
    setInstalling(game.slug);

    // Add to download manager
    addDownload({
      slug: game.slug,
      title: game.title,
      stage: 'starting',
      progress: 0,
      message: 'Starting download...'
    });

    try {
      await tauriApi.installGameFromCrocDB(game.slug);
      // Success is handled by the progress event listener
    } catch (error) {
      console.error('Failed to install game:', error);
      removeDownload(game.slug);
      setInstalling(null);
      alert(`Failed to install game: ${error}`);
    }
  };

  const handleRandomGame = async () => {
    setIsSearching(true);
    try {
      const game = await tauriApi.getRandomCrocDBEntry();
      setSearchResults([game]);
    } catch (error) {
      console.error('Failed to get random game:', error);
    } finally {
      setIsSearching(false);
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
        <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] bg-clip-text text-transparent">{t('download.title')}</h2>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
              <input
                type="text"
                placeholder={t('download.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-primary-500 transition-colors"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors"
            >
              Search
            </motion.button>

            {(selectedPlatforms.length > 0 || selectedRegions.length > 0) && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={clearFilters}
                className="px-4 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </motion.button>
            )}
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={handleRandomGame}
            disabled={isSearching}
            className="px-6 py-3 bg-dark-700 hover:bg-dark-600 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            🎲 Random
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => setShowFilters(prev => !prev)}
            className="px-6 py-3 bg-dark-700 hover:bg-dark-600 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Filter className="w-5 h-5" />
            Filters
          </motion.button>
        </form>
      </motion.div>

      {/* Filters */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-6 border-b border-dark-700 bg-dark-900"
        >
          <h3 className="text-2xl font-bold mb-4">Filters</h3>
          <div className="flex gap-3 mb-4">
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
            <button
              onClick={() => setHideGamesWithoutImage(!hideGamesWithoutImage)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                hideGamesWithoutImage
                  ? 'bg-primary-600 hover:bg-primary-700'
                  : 'bg-dark-700 hover:bg-dark-600'
              }`}
            >
              <Package className="w-4 h-4" />
              {hideGamesWithoutImage ? 'Showing games with images only' : 'Show all games'}
            </button>
          </div>
          {/* Scrollable filters container */}
          <div className="max-h-96 overflow-y-auto pr-2 space-y-4">
            <div>
              <h4 className="text-xl font-bold mb-2">Platforms</h4>
              <div className="flex flex-wrap gap-2">
                {Object.keys(availablePlatforms).map((platformId) => (
                  <button
                    key={platformId}
                    onClick={() => togglePlatform(platformId)}
                    className={`px-4 py-2 bg-dark-800 rounded-lg border-2 transition-all text-left ${
                      selectedPlatforms.includes(platformId)
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-dark-700 hover:border-dark-600'
                    }`}
                  >
                    {availablePlatforms[platformId].name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xl font-bold mb-2">Regions</h4>
              <div className="flex flex-wrap gap-2">
                {Object.keys(availableRegions).map((regionId) => (
                  <button
                    key={regionId}
                    onClick={() => toggleRegion(regionId)}
                    className={`px-4 py-2 bg-dark-800 rounded-lg border-2 transition-all text-left ${
                      selectedRegions.includes(regionId)
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-dark-700 hover:border-dark-600'
                    }`}
                  >
                    {availableRegions[regionId]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-6">
        {searchResults.length === 0 && !isSearching ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col items-center justify-center text-center"
          >
            <DownloadIcon className="w-24 h-24 mb-4 opacity-20" />
            <h3 className="text-2xl font-bold mb-2">Search CrocDB</h3>
            <p className="text-dark-400">
              Search for ROMs from the CrocDB database
            </p>
            <p className="text-dark-500 text-sm mt-2">
              Try searching for "Mario", "Zelda", or click Random!
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {searchResults
              .filter(game => !hideGamesWithoutImage || game.cover_url)
              .map((game) => (
                <motion.div
                  key={game.slug}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden hover:border-primary-500 transition-colors"
                >
                  {/* Cover Image */}
                  <div className="w-full aspect-[3/4] bg-dark-900 flex items-center justify-center overflow-hidden">
                    {boxartCache[game.slug] || game.cover_url ? (
                      <img
                        src={boxartCache[game.slug] || game.cover_url!}
                        alt={game.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to placeholder if image fails to load
                          e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect fill="%23374151" width="200" height="300"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" fill="%239CA3AF" font-size="20"%3ENo Image%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    ) : (
                      <div className="text-dark-600 text-center p-4">
                        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Loading...</p>
                      </div>
                    )}
                  </div>

                  {/* Game Info */}
                  <div className="p-4">
                    <h3 className="font-bold text-lg mb-1 truncate" title={game.title}>
                      {game.title}
                    </h3>
                    <p className="text-sm text-dark-400 mb-2 uppercase font-semibold">
                      {game.platform}
                    </p>

                    {/* Regions */}
                    {game.regions && game.regions.length > 0 && (
                      <div className="flex gap-1 mb-3 flex-wrap">
                        {game.regions.map((region) => (
                          <span
                            key={region}
                            className="px-2 py-1 bg-dark-700 text-xs rounded uppercase"
                          >
                            {region}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Download Links */}
                    {game.download_links?.length > 0 && (
                      <div className="mb-3 p-2 bg-dark-900 rounded-lg">
                        <p className="text-xs text-dark-400 mb-1">
                          {game.download_links.length} download{game.download_links.length > 1 ? 's' : ''} available
                        </p>
                        <p className="text-xs text-dark-500">
                          Size: {game.download_links[0].size_str}
                        </p>
                      </div>
                    )}

                    {/* Install Button */}
                    {(() => {
                      const isInstalled = games.some(g => g.id === `crocdb_${game.slug.replace(/-/g, '_')}`);
                      return (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleInstallClick(game)}
                          disabled={isInstalled || installing === game.slug || !game.download_links || game.download_links.length === 0}
                          className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isInstalled ? (
                            <>
                              ✓ Installed
                            </>
                          ) : installing === game.slug ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Installing...
                            </>
                          ) : (
                            <>
                              <DownloadIcon className="w-4 h-4" />
                              {game.download_links?.length > 0 ? 'Install to Library' : 'No Links Available'}
                            </>
                          )}
                        </motion.button>
                      );
                    })()}
                  </div>
                </motion.div>
              ))}
          </div>
        )}
      </div>

      {/* Game Details Modal */}
      {selectedGame && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedGame(null)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-dark-900 border border-dark-700 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex gap-6 mb-6">
                {selectedGame.cover_url && (
                  <img
                    src={selectedGame.cover_url}
                    alt={selectedGame.title}
                    className="w-40 h-56 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{selectedGame.title}</h2>
                  <p className="text-dark-400 mb-2">Platform: {selectedGame.platform}</p>
                  {selectedGame.id && (
                    <p className="text-dark-500 text-sm mb-2">ROM ID: {selectedGame.id}</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {selectedGame.regions.map((region) => (
                      <span
                        key={region}
                        className="px-3 py-1 bg-dark-700 text-sm rounded uppercase"
                      >
                        {region}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Download Links */}
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-3">Download Links</h3>
                <div className="space-y-2">
                  {selectedGame.download_links?.map((link, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-dark-800 rounded-lg border border-dark-700"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">{link.name}</p>
                          <p className="text-sm text-dark-400">
                            Format: {link.format} • Host: {link.host}
                          </p>
                        </div>
                        <span className="text-sm text-primary-400">{link.size_str}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Install from Details */}
              <button
                onClick={() => {
                  setSelectedGame(null);
                  handleInstallClick(selectedGame);
                }}
                disabled={false}
                className="w-full mb-3 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <DownloadIcon className="w-4 h-4" />
                Install to Library
              </button>

              {/* Close Button */}
              <button
                onClick={() => setSelectedGame(null)}
                className="w-full px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Download;
