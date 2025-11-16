import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Game {
  id: string;
  title: string;
  platform: string;
  rom_path: string;
  cover_path?: string;
  emulator_id: string;
  description?: string;
  release_year?: number;
  genre?: string;
  developer?: string;
  is_favorite: number;
  play_count: number;
  total_playtime: number;
  last_played?: string;
}

export interface Emulator {
  id: string;
  name: string;
  platform: string;
  executable_path: string;
  arguments?: string;
  icon_path?: string;
}

export interface DownloadProgress {
  slug: string;
  title: string;
  stage: string;
  progress: number;
  message: string;
  bytesReceived?: number;
  totalBytes?: number;
  speedBps?: number;
}

interface AppStore {
  games: Game[];
  emulators: Emulator[];
  downloads: DownloadProgress[];
  selectedGame: Game | null;
  viewMode: 'grid' | 'list';
  currentView: 'library' | 'favorites' | 'platforms' | 'download' | 'emulators' | 'external_emulators' | 'settings';
  searchQuery: string;
  filterPlatform: string | null;
  sortBy: 'title' | 'platform' | 'play_count' | 'last_played';
  theme: 'dark' | 'light' | 'auto';
  layout: 'compact' | 'comfortable';
  bigPictureMode: boolean;
  bpKeyboardLayout: 'qwerty' | 'azerty';
  bpShowHints: boolean;
  bpGridScale: 'small' | 'medium' | 'large';
  bpReduceMotion: boolean;
  bpStartView: 'main' | 'library' | 'favorites' | 'bp_download';
  colorPalette: 'purplePink' | 'tealOrange' | 'emeraldBlue' | 'redGold';
  bpColorPalette: 'purplePink' | 'tealOrange' | 'emeraldBlue' | 'redGold';
  language: string; // i18n language code
  windowedFullscreen: boolean; // borderless fullscreen

  setGames: (games: Game[]) => void;
  setEmulators: (emulators: Emulator[]) => void;
  setSelectedGame: (game: Game | null) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setCurrentView: (view: 'library' | 'favorites' | 'platforms' | 'download' | 'emulators' | 'external_emulators' | 'settings') => void;
  setSearchQuery: (query: string) => void;
  setFilterPlatform: (platform: string | null) => void;
  setSortBy: (sortBy: 'title' | 'platform' | 'play_count' | 'last_played') => void;
  setTheme: (theme: 'dark' | 'light' | 'auto') => void;
  setLayout: (layout: 'compact' | 'comfortable') => void;
  setBigPictureMode: (enabled: boolean) => void;
  setBpKeyboardLayout: (layout: 'qwerty' | 'azerty') => void;
  setBpShowHints: (show: boolean) => void;
  setBpGridScale: (scale: 'small' | 'medium' | 'large') => void;
  setBpReduceMotion: (v: boolean) => void;
  setBpStartView: (v: 'main' | 'library' | 'favorites' | 'bp_download') => void;
  setColorPalette: (p: 'purplePink' | 'tealOrange' | 'emeraldBlue' | 'redGold') => void;
  setBpColorPalette: (p: 'purplePink' | 'tealOrange' | 'emeraldBlue' | 'redGold') => void;
  setLanguage: (lang: string) => void;
  setWindowedFullscreen: (enabled: boolean) => void;
  addDownload: (download: DownloadProgress) => void;
  updateDownloadProgress: (slug: string, stage: string, progress: number, message: string, details?: { bytesReceived?: number; totalBytes?: number; speedBps?: number; title?: string }) => void;
  removeDownload: (slug: string) => void;
  toggleFavorite: (gameId: string) => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      games: [],
      emulators: [],
      downloads: [],
      selectedGame: null,
      viewMode: 'grid',
      currentView: 'library',
      searchQuery: '',
      filterPlatform: null,
      sortBy: 'title',
      theme: 'dark',
      layout: 'comfortable',
      bigPictureMode: false,
      bpKeyboardLayout: 'qwerty',
      bpShowHints: true,
      bpGridScale: 'medium',
      bpReduceMotion: false,
      bpStartView: 'main',
      colorPalette: 'purplePink',
      bpColorPalette: 'purplePink',
      language: 'en',
      windowedFullscreen: false,

      setGames: (games) => set({ games }),
      setEmulators: (emulators) => set({ emulators }),
      setSelectedGame: (selectedGame) => set({ selectedGame }),
      setViewMode: (viewMode) => set({ viewMode }),
      setCurrentView: (currentView) => set({ currentView }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setFilterPlatform: (filterPlatform) => set({ filterPlatform }),
      setSortBy: (sortBy) => set({ sortBy }),
      setTheme: (theme) => set({ theme }),
      setLayout: (layout) => set({ layout }),
      setBigPictureMode: (bigPictureMode) => set({ bigPictureMode }),
      setBpKeyboardLayout: (bpKeyboardLayout) => set({ bpKeyboardLayout }),
      setBpShowHints: (bpShowHints) => set({ bpShowHints }),
      setBpGridScale: (bpGridScale) => set({ bpGridScale }),
      setBpReduceMotion: (bpReduceMotion) => set({ bpReduceMotion }),
      setBpStartView: (bpStartView) => set({ bpStartView }),
      setColorPalette: (colorPalette) => set({ colorPalette }),
      setBpColorPalette: (bpColorPalette) => set({ bpColorPalette }),
      setLanguage: (language) => set({ language }),
      setWindowedFullscreen: (windowedFullscreen) => set({ windowedFullscreen }),
      addDownload: (download) => set((state) => {
        const exists = state.downloads.find(d => d.slug === download.slug);
        if (exists) {
          return {
            downloads: state.downloads.map(d => d.slug === download.slug ? { ...d, ...download } : d)
          };
        }
        return { downloads: [...state.downloads, download] };
      }),
      updateDownloadProgress: (slug, stage, progress, message, details) => set((state) => {
        const exists = state.downloads.some(d => d.slug === slug);
        const updated = state.downloads.map(d =>
          d.slug === slug
            ? { ...d, stage, progress, message, bytesReceived: details?.bytesReceived ?? d.bytesReceived, totalBytes: details?.totalBytes ?? d.totalBytes, speedBps: details?.speedBps ?? d.speedBps, title: details?.title ?? d.title }
            : d
        );
        // Avoid auto-creating popups for per-core events during bulk operations
        if (!exists && !slug.startsWith('core:')) {
          // Create if missing using provided details
          updated.push({
            slug,
            title: details?.title || slug,
            stage,
            progress,
            message,
            bytesReceived: details?.bytesReceived,
            totalBytes: details?.totalBytes,
            speedBps: details?.speedBps,
          });
        }
        return { downloads: updated };
      }),
      removeDownload: (slug) => set((state) => ({
        downloads: state.downloads.filter(d => d.slug !== slug)
      })),
      toggleFavorite: (gameId) => set((state) => ({
        games: state.games.map((game) =>
          game.id === gameId ? { ...game, is_favorite: game.is_favorite ? 0 : 1 } : game
        ),
      })),
    }),
    {
      name: 'retrolauncher-settings',
      partialize: (state) => ({
        theme: state.theme,
        layout: state.layout,
        viewMode: state.viewMode,
        sortBy: state.sortBy,
        bpKeyboardLayout: state.bpKeyboardLayout,
        bpShowHints: state.bpShowHints,
        bpGridScale: state.bpGridScale,
        bpReduceMotion: state.bpReduceMotion,
        bpStartView: state.bpStartView,
        colorPalette: state.colorPalette,
        bpColorPalette: state.bpColorPalette,
        language: state.language,
        windowedFullscreen: state.windowedFullscreen,
      })
    }
  )
);
