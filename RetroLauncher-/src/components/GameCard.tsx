import { motion } from 'framer-motion';
import { Play, Star, Trash2 } from 'lucide-react';
import { Game, useStore } from '../store/useStore';
import { tauriApi } from '../utils/tauri';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/tauri';

interface GameCardProps {
  game: Game;
  onGameUpdate?: () => void;
  viewMode?: 'grid' | 'list';
}

const GameCard = ({ game, onGameUpdate, viewMode = 'grid' }: GameCardProps) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const { setGames } = useStore();

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLaunching(true);
    try {
      await tauriApi.launchGame(game.id);
      // Refresh games to update play count
      const games = await tauriApi.getGames();
      setGames(games);
    } catch (error) {
      console.error('Failed to launch game:', error);
      alert(`Failed to launch game: ${error}`);
    } finally {
      setIsLaunching(false);
      onGameUpdate?.();
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await tauriApi.toggleFavorite(game.id);
      // Refresh games from database to sync favorite status
      const games = await tauriApi.getGames();
      setGames(games);
      onGameUpdate?.();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      alert(`Failed to toggle favorite: ${error}`);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${game.title}"?`)) {
      return;
    }

    try {
      await tauriApi.deleteGame(game.id);
      const games = await tauriApi.getGames();
      setGames(games);
      onGameUpdate?.();
      setShowContextMenu(false);
    } catch (error) {
      console.error('Failed to delete game:', error);
      alert(`Failed to delete game: ${error}`);
    }
  };

  const handleClickOutside = () => {
    setShowContextMenu(false);
  };

  // List view layout
  if (viewMode === 'list') {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ scale: 1.02 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          onContextMenu={handleContextMenu}
          className="relative group cursor-pointer bg-dark-800 rounded-xl overflow-hidden border border-dark-700 hover:border-primary-500 transition-colors"
        >
          <div className="flex items-center gap-4 p-4">
            {/* Cover Image */}
            <div className="relative w-24 h-32 rounded-lg overflow-hidden bg-dark-900 flex-shrink-0">
              {game.cover_path ? (
                <img
                  src={convertFileSrc(game.cover_path)}
                  alt={game.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-4xl opacity-20">🎮</div>
                </div>
              )}
            </div>

            {/* Game Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-xl mb-1 truncate">{game.title}</h3>
              <p className="text-sm text-dark-400 mb-2">{game.platform}</p>
              {game.play_count > 0 && (
                <p className="text-xs text-primary-400">
                  {t('game.play_count')}: {game.play_count}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleToggleFavorite}
                className={`p-2 rounded-lg transition-colors ${
                  game.is_favorite
                    ? 'bg-yellow-500 text-white'
                    : 'bg-dark-700 hover:bg-dark-600'
                }`}
              >
                <Star
                  className="w-5 h-5"
                  fill={game.is_favorite ? 'currentColor' : 'none'}
                />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePlay}
                disabled={isLaunching}
                className="bg-primary-600 hover:bg-primary-700 px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Play className="w-4 h-4" fill="currentColor" />
                {isLaunching ? t('common.loading') : t('game.play')}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Context Menu */}
        {showContextMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={handleClickOutside}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                position: 'fixed',
                left: contextMenuPosition.x,
                top: contextMenuPosition.y,
                zIndex: 50,
              }}
              className="bg-dark-800 border border-dark-700 rounded-lg shadow-xl overflow-hidden min-w-[150px]"
            >
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left hover:bg-red-600/20 transition-colors flex items-center gap-2 text-red-400"
              >
                <Trash2 className="w-4 h-4" />
                Delete Game
              </button>
            </motion.div>
          </>
        )}
      </>
    );
  }

  // Grid view layout (default)
  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onContextMenu={handleContextMenu}
        className="relative group cursor-pointer"
      >
        {/* Game Cover */}
        <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-dark-800 shadow-xl">
          {game.cover_path ? (
            <img
              src={convertFileSrc(game.cover_path)}
              alt={game.title}
              className="w-full h-full object-cover"
              onLoad={() => {
                console.log('✅ Image loaded:', game.title, game.cover_path);
              }}
              onError={(e) => {
                console.error('❌ Failed to load image:', game.title);
                console.error('   Original path:', game.cover_path);
                if (game.cover_path) {
                  console.error('   Converted URL:', convertFileSrc(String(game.cover_path)));
                }
                console.error('   Error:', e);
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-6xl opacity-20">🎮</div>
            </div>
          )}

          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
          >
            <div className="absolute inset-0 flex flex-col justify-end p-4">
              {/* Game Info */}
              <div className="mb-3">
                <h3 className="font-bold text-lg mb-1 line-clamp-2">{game.title}</h3>
                <p className="text-xs text-dark-300">{game.platform}</p>
                {game.play_count > 0 && (
                  <p className="text-xs text-primary-400 mt-1">
                    {t('game.play_count')}: {game.play_count}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handlePlay}
                  disabled={isLaunching}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4" fill="currentColor" />
                  {isLaunching ? t('common.loading') : t('game.play')}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleToggleFavorite}
                  className={`p-2 rounded-lg transition-colors ${
                    game.is_favorite
                      ? 'bg-yellow-500 text-white'
                      : 'bg-dark-700 hover:bg-dark-600'
                  }`}
                >
                  <Star
                    className="w-5 h-5"
                    fill={game.is_favorite ? 'currentColor' : 'none'}
                  />
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Favorite Badge */}
          {game.is_favorite === 1 && !isHovered && (
            <div className="absolute top-3 right-3">
              <Star className="w-5 h-5 text-yellow-500" fill="currentColor" />
            </div>
          )}
        </div>
      </motion.div>

      {/* Context Menu */}
      {showContextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={handleClickOutside}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              position: 'fixed',
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
              zIndex: 50,
            }}
            className="bg-dark-800 border border-dark-700 rounded-lg shadow-xl overflow-hidden min-w-[150px]"
          >
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-left hover:bg-red-600/20 transition-colors flex items-center gap-2 text-red-400"
            >
              <Trash2 className="w-4 h-4" />
              Delete Game
            </button>
          </motion.div>
        </>
      )}
    </>
  );
};

export default GameCard;
