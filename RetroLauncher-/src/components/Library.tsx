import { useTranslation } from 'react-i18next';
import { Search, Grid3x3, List, Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import GameCard from './GameCard';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';

const Library = () => {
  const { t } = useTranslation();
  const { games, viewMode, setViewMode, searchQuery, setSearchQuery, sortBy, setSortBy, setCurrentView } = useStore();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const filteredGames = useMemo(() => {
    let filtered = [...games];

    // Platform filter
    if (selectedPlatform) {
      filtered = filtered.filter((game) => game.platform === selectedPlatform);
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((game) =>
        game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.platform.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'platform':
          return a.platform.localeCompare(b.platform);
        case 'play_count':
          return b.play_count - a.play_count;
        case 'last_played':
          return (b.last_played || '').localeCompare(a.last_played || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [games, searchQuery, sortBy, selectedPlatform]);

  const platforms = useMemo(() => {
    const uniquePlatforms = new Set(games.map(g => g.platform));
    return Array.from(uniquePlatforms);
  }, [games]);

  const handlePlatformFilter = (platform: string | null) => {
    setSelectedPlatform(platform);
  };

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
            <h2 className="text-3xl font-bold bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] bg-clip-text text-transparent">{t('library.title')}</h2>
            <p className="text-dark-400 mt-1">
              {t(filteredGames.length === 1 ? 'library.games_count' : 'library.games_count_plural', { count: filteredGames.length })}
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCurrentView('download')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-5 h-5" />
            {t('library.add_game')}
          </motion.button>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
            <input
              type="text"
              placeholder={t('library.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-primary-500 transition-colors cursor-pointer"
          >
            <option value="title">{t('library.sort_by')}: Title</option>
            <option value="platform">{t('library.sort_by')}: Platform</option>
            <option value="play_count">{t('library.sort_by')}: Play Count</option>
            <option value="last_played">{t('library.sort_by')}: Last Played</option>
          </select>

          {/* View Mode */}
          <div className="flex gap-1 p-1 bg-dark-800 rounded-lg border border-dark-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-primary-600' : 'hover:bg-dark-700'
              }`}
            >
              <Grid3x3 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list' ? 'bg-primary-600' : 'hover:bg-dark-700'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Platform Filter Pills */}
        {platforms.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handlePlatformFilter(null)}
              className={`px-3 py-1 border rounded-full text-sm transition-colors ${
                selectedPlatform === null
                  ? 'bg-primary-600 border-primary-600'
                  : 'bg-dark-800 border-dark-700 hover:bg-dark-700'
              }`}
            >
              All
            </motion.button>
            {platforms.map((platform) => (
              <motion.button
                key={platform}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePlatformFilter(platform)}
                className={`px-3 py-1 border rounded-full text-sm transition-colors ${
                  selectedPlatform === platform
                    ? 'bg-primary-600 border-primary-600'
                    : 'bg-dark-800 border-dark-700 hover:bg-dark-700 hover:border-dark-600'
                }`}
              >
                {platform}
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Game Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredGames.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col items-center justify-center text-center"
          >
            <div className="text-8xl mb-4 opacity-20">🎮</div>
            <h3 className="text-2xl font-bold mb-2">{t('library.empty')}</h3>
            <p className="text-dark-400 mb-6">
              {t('library.add_game')}
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentView('download')}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-5 h-5 inline mr-2" />
              {t('library.add_game')}
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`
              grid gap-6
              ${
                viewMode === 'grid'
                  ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
                  : 'grid-cols-1'
              }
            `}
          >
            {filteredGames.map((game) => (
              <GameCard key={game.id} game={game} viewMode={viewMode} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Library;
