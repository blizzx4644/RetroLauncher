import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import GameCard from './GameCard';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

const Favorites = () => {
  const { t } = useTranslation();
  const { games } = useStore();

  const favoriteGames = games.filter((game) => game.is_favorite === 1);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="p-6 border-b border-dark-700 bg-dark-900"
      >
        <div className="flex items-center gap-3">
          <Star className="w-8 h-8 text-yellow-500" fill="currentColor" />
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-[var(--brand-from)] to-[var(--brand-to)] bg-clip-text text-transparent">{t('nav.favorites')}</h2>
            <p className="text-dark-400 mt-1">
              {t(favoriteGames.length === 1 ? 'library.games_count' : 'library.games_count_plural', { count: favoriteGames.length })}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {favoriteGames.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col items-center justify-center text-center"
          >
            <Star className="w-24 h-24 mb-4 opacity-20 text-yellow-500" />
            <h3 className="text-2xl font-bold mb-2">{t('favorites.empty')}</h3>
            <p className="text-dark-400">
              {t('favorites.empty_desc')}
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
          >
            {favoriteGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Favorites;
