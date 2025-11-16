import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import { useStore, Game } from '../store/useStore';
import { useGamepad } from '../hooks/useGamepad';
import { tauriApi, RetroArchCore, CrocDBGame, PlatformInfo } from '../utils/tauri';
import DownloadManager from './DownloadManager';
import { listen } from '@tauri-apps/api/event';
import {
  Play,
  Heart,
  Star,
  Clock,
  Gamepad2,
  X,
  Info,
  ArrowLeft,
  Download as DownloadIcon,
  Cpu,
  Loader2,
  Search,
  Keyboard,
  Settings as SettingsIcon
} from 'lucide-react';

type View = 'main' | 'library' | 'favorites' | 'details' | 'bp_emulators' | 'bp_download' | 'bp_settings';

const BigPictureMode = () => {
  const { t } = useTranslation();
  const {
    games,
    setBigPictureMode,
    setGames,
    bpKeyboardLayout,
    setBpKeyboardLayout,
    addDownload,
    updateDownloadProgress,
    removeDownload,
    bpShowHints,
    bpGridScale,
    bpReduceMotion,
    bpStartView,
    setBpShowHints,
    setBpGridScale,
    setBpReduceMotion,
    setBpStartView,
  } = useStore();
  const [currentView, setCurrentView] = useState<View>(bpStartView as View);
  const [lastListView, setLastListView] = useState<'library'|'favorites'>('library');
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [showGameInfo, setShowGameInfo] = useState(false);
  const gameRefs = useRef<(HTMLDivElement | null)[]>([]);
  const coreRefs = useRef<(HTMLDivElement | null)[]>([]);
  const COLS = bpGridScale === 'small' ? 6 : bpGridScale === 'large' ? 4 : 5; // colonnes dynamiques
  const motionTransition = { duration: bpReduceMotion ? 0 : 0.3 };

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Emulators BP state
  const [cores, setCores] = useState<RetroArchCore[]>([]);
  const [selectedCoreIndex, setSelectedCoreIndex] = useState(0);
  const [loadingCores, setLoadingCores] = useState(false);
  const [coreCols, setCoreCols] = useState(3);
  const coresContainerRef = useRef<HTMLDivElement | null>(null);

  // Download BP state (Random)
  const [downloadingRandom, setDownloadingRandom] = useState(false);

  // Download BP state (Search CrocDB)
  const [searchBP, setSearchBP] = useState('');
  const [resultsBP, setResultsBP] = useState<CrocDBGame[]>([]);
  const [isSearchingBP, setIsSearchingBP] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const resultRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [resultsCols, setResultsCols] = useState(4);
  const RESULTS_COLS = resultsCols;

  // Virtual Keyboard state (BP Download)
  const [showKb, setShowKb] = useState(false);
  const [kbRow, setKbRow] = useState(0);
  const [kbCol, setKbCol] = useState(0);
  const qwertyRows: string[][] = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['q','w','e','r','t','y','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l'],
    ['z','x','c','v','b','n','m'],
    ['SPACE','BACK','CLEAR','ENTER','CLOSE']
  ];
  const azertyRows: string[][] = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['a','z','e','r','t','y','u','i','o','p'],
    ['q','s','d','f','g','h','j','k','l','m'],
    ['w','x','c','v','b','n'],
    ['SPACE','BACK','CLEAR','ENTER','CLOSE']
  ];
  const kbRows = bpKeyboardLayout === 'azerty' ? azertyRows : qwertyRows;
  const currentKey = () => {
    const row = kbRows[kbRow] || [];
    return row[Math.min(kbCol, Math.max(0, row.length - 1))];
  };
  const clampKb = (r: number, c: number) => {
    const rr = Math.max(0, Math.min(kbRows.length - 1, r));
    const maxC = Math.max(0, (kbRows[rr]?.length || 1) - 1);
    const cc = Math.max(0, Math.min(maxC, c));
    return { rr, cc };
  };
  const pressKey = (k: string) => {
    if (k === 'SPACE') setSearchBP(prev => prev + ' ');
    else if (k === 'BACK') setSearchBP(prev => prev.slice(0, -1));
    else if (k === 'CLEAR') setSearchBP('');
    else if (k === 'ENTER') handleSearchCrocDB();
    else if (k === 'CLOSE') setShowKb(false);
    else setSearchBP(prev => prev + k);
  };

  // Filters (BP Download)
  const [showFilters, setShowFilters] = useState(false);
  const [availablePlatformsBP, setAvailablePlatformsBP] = useState<Record<string, PlatformInfo>>({});
  const [availableRegionsBP, setAvailableRegionsBP] = useState<Record<string, string>>({});
  const [selectedPlatformsBP, setSelectedPlatformsBP] = useState<string[]>([]);
  const [selectedRegionsBP, setSelectedRegionsBP] = useState<string[]>([]);
  const [hideNoImageBP, setHideNoImageBP] = useState(false);
  const [filterFocusSection, setFilterFocusSection] = useState<'platforms'|'regions'>('platforms');
  const [filterIndex, setFilterIndex] = useState(0);
  const FILTER_COLS = 3;
  const platformItemRefs = useRef<(HTMLButtonElement|null)[]>([]);
  const regionItemRefs = useRef<(HTMLButtonElement|null)[]>([]);
  const platformListRef = useRef<HTMLDivElement|null>(null);
  const regionListRef = useRef<HTMLDivElement|null>(null);

  // BP Settings focus handling
  const bpSettingsRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [bpSettingsIndex, setBpSettingsIndex] = useState(0);

  // Helper: switch filters section keeping row/col when possible
  const switchFilterSection = (target: 'platforms'|'regions') => {
    const row = Math.floor(filterIndex / FILTER_COLS);
    const col = filterIndex % FILTER_COLS;
    const targetCount = target === 'platforms'
      ? Object.keys(availablePlatformsBP).length
      : Object.keys(availableRegionsBP).length;
    const desired = row * FILTER_COLS + col;
    const clamped = Math.max(0, Math.min(targetCount - 1, desired));
    setFilterFocusSection(target);
    setFilterIndex(clamped);
  };

  // Ensure focused filter item stays in view
  useEffect(() => {
    if (!showFilters) return;
    const isPlat = filterFocusSection === 'platforms';
    const refs = isPlat ? platformItemRefs.current : regionItemRefs.current;
    const el = refs[filterIndex];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [showFilters, filterFocusSection, filterIndex]);

  useEffect(() => {
    setSearchQuery('');
    setShowSearchBar(false);
    setSelectedGameIndex(0);
    if (currentView === 'bp_settings') {
      // initialize focus to first control
      setBpSettingsIndex(0);
      requestAnimationFrame(() => {
        const el = bpSettingsRefs.current[0];
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      });
    }
  }, [currentView]);

  const menuItems = [
    { id: 'library', label: t('big_picture.menu.library'), icon: Gamepad2 },
    { id: 'favorites', label: t('big_picture.menu.favorites'), icon: Heart },
    { id: 'bp_download', label: t('big_picture.menu.download'), icon: DownloadIcon },
    { id: 'bp_emulators', label: t('big_picture.menu.emulators'), icon: Cpu },
    { id: 'bp_settings', label: t('settings.title'), icon: SettingsIcon },
    { id: 'exit', label: t('big_picture.menu.exit'), icon: X },
  ];
  const MENU_COLS = 3;

  // Filter games based on search query
  const filterGames = (gamesList: Game[]) => {
    if (!searchQuery.trim()) return gamesList;

    const query = searchQuery.toLowerCase();
    return gamesList.filter((game) =>
      game.title.toLowerCase().includes(query) ||
      game.platform.toLowerCase().includes(query) ||
      (game.genre && game.genre.toLowerCase().includes(query)) ||
      (game.developer && game.developer.toLowerCase().includes(query))
    );
  };

  const displayGames = filterGames(
    currentView === 'favorites'
      ? games.filter((g) => g.is_favorite === 1)
      : games
  );

  // Focus search input when search bar is shown
  useEffect(() => {
    if (showSearchBar && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearchBar]);

  // Load games on mount if not present
  useEffect(() => {
    (async () => {
      try {
        if (!games || games.length === 0) {
          const list = await tauriApi.getGames();
          setGames(list);
        }
      } catch (e) {
        console.error('Failed to load games:', e);
      }
    })();
  }, []);

  // Load cores when entering emulators BP
  useEffect(() => {
    const load = async () => {
      if (currentView !== 'bp_emulators') return;
      try {
        setLoadingCores(true);
        const list = await tauriApi.getRetroArchCores();
        setCores(list);
        setSelectedCoreIndex(0);
      } catch (e) {
        console.error('Failed to load cores', e);
      } finally {
        setLoadingCores(false);
      }
    };
    load();
  }, [currentView]);

  // Compute dynamic columns for cores grid (BP Emulators)
  useEffect(() => {
    if (currentView !== 'bp_emulators') return;
    // Aligner aux breakpoints Tailwind: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
    const updateCols = () => {
      const w = window.innerWidth;
      const cols = w >= 1024 ? 3 : w >= 768 ? 2 : 1;
      setCoreCols(cols);
    };
    updateCols();
    const ro = new ResizeObserver(updateCols);
    if (coresContainerRef.current) ro.observe(coresContainerRef.current);
    const onResize = () => updateCols();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
    };
  }, [currentView]);

  // Scroll to selected game
  useEffect(() => {
    if (gameRefs.current[selectedGameIndex]) {
      gameRefs.current[selectedGameIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }
  }, [selectedGameIndex]);

  // Auto-scroll for emulator cores grid
  useEffect(() => {
    if (coreRefs.current[selectedCoreIndex]) {
      coreRefs.current[selectedCoreIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [selectedCoreIndex]);

  // Auto-scroll selected search result into view
  useEffect(() => {
    if (resultRefs.current[selectedResultIndex]) {
      resultRefs.current[selectedResultIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [selectedResultIndex]);

  // Sync selectedGame with store when favorites change
  useEffect(() => {
    if (selectedGame) {
      const updatedGame = games.find((g) => g.id === selectedGame.id);
      if (updatedGame && updatedGame.is_favorite !== selectedGame.is_favorite) {
        setSelectedGame(updatedGame);
      }
    }
  }, [games, selectedGame]);

  // Load platforms/regions when entering bp_download
  useEffect(() => {
    if (currentView !== 'bp_download') return;
    (async () => {
      try {
        const plats = await tauriApi.getCrocDBPlatforms();
        setAvailablePlatformsBP(plats);
      } catch (e) { console.error('Failed to load platforms', e); }
      try {
        const regs = await tauriApi.getCrocDBRegions();
        setAvailableRegionsBP(regs);
      } catch (e) { console.error('Failed to load regions', e); }
    })();
  }, [currentView]);

  // Results grid columns (responsive)
  useEffect(() => {
    const updateCols = () => {
      const w = window.innerWidth;
      const cols = w >= 1024 ? 4 : w >= 640 ? 2 : 1; // lg:4, sm:2, base:1
      setResultsCols(cols);
    };
    updateCols();
    const onResize = () => updateCols();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleLaunchGame = async (game: Game) => {
    try {
      await tauriApi.launchGame(game.id);
      // Refresh games to update play count and last played
      const updatedGames = await tauriApi.getGames();
      setGames(updatedGames);
    } catch (error) {
      console.error('Failed to launch game:', error);
    }
  };

  const handleToggleFavorite = async (gameId: string) => {
    try {
      await tauriApi.toggleFavorite(gameId);
      const updated = await tauriApi.getGames();
      setGames(updated);
      if (selectedGame && selectedGame.id === gameId) {
        const refreshed = updated.find(g => g.id === gameId);
        if (refreshed) setSelectedGame(refreshed);
      }
    } catch (e) {
      console.error('Failed to toggle favorite:', e);
    }
  };

  // Install selected core (BP Emulators)
  const handleInstallSelectedCore = async () => {
    const core = cores[selectedCoreIndex];
    if (!core || core.installed) return;
    try {
      setLoadingCores(true);
      await tauriApi.installRetroArchCore(core.id);
      const list = await tauriApi.getRetroArchCores();
      setCores(list);
    } catch (e) {
      console.error('Failed to install core:', e);
      alert(`Failed to install core: ${e}`);
    } finally {
      setLoadingCores(false);
    }
  };

  // BP Download: search CrocDB
  const handleSearchCrocDB = async () => {
    if (!searchBP.trim()) return;
    try {
      setIsSearchingBP(true);
      const resp = await tauriApi.searchCrocDBAdvanced(
        searchBP.trim(),
        selectedPlatformsBP.length>0?selectedPlatformsBP:undefined,
        selectedRegionsBP.length>0?selectedRegionsBP:undefined,
        40,
        1
      );
      const base = resp.results;
      const filtered = hideNoImageBP ? base.filter(g => !!g.cover_url) : base;
      setResultsBP(filtered);
      setSelectedResultIndex(0);
    } catch (e) {
      console.error('Failed to search CrocDB', e);
      alert(`Search failed: ${e}`);
    } finally {
      setIsSearchingBP(false);
    }
  };

  const handleInstallSelectedSearch = async () => {
    const g = resultsBP[selectedResultIndex];
    if (!g) return;
    try {
      setDownloadingRandom(true);
      addDownload({ slug: g.slug, title: g.title, stage: 'starting', progress: 0, message: 'Starting download...' });
      await tauriApi.installGameFromCrocDB(g.slug);
      const updatedGames = await tauriApi.getGames();
      setGames(updatedGames);
    } catch (e) {
      console.error('Failed to install from search', e);
      alert(`Failed to install: ${e}`);
    } finally {
      setTimeout(() => setDownloadingRandom(false), 1000);
    }
  };

  // Download BP: install random from CrocDB
  const handleInstallRandom = async () => {
    try {
      setDownloadingRandom(true);
      const entry = await tauriApi.getRandomCrocDBEntry();
      addDownload({ slug: entry.slug, title: entry.title, stage: 'starting', progress: 0, message: 'Starting download...' });
      await tauriApi.installGameFromCrocDB(entry.slug);
      const updatedGames = await tauriApi.getGames();
      setGames(updatedGames);
    } catch (e) {
      console.error('Failed to install random game', e);
      alert(`Failed to install: ${e}`);
    } finally {
      setTimeout(() => setDownloadingRandom(false), 1200);
    }
  };

  // Gamepad navigation
  useGamepad({
    onUp: () => {
      if (currentView === 'bp_download' && showKb) {
        const { rr, cc } = clampKb(kbRow - 1, kbCol);
        setKbRow(rr); setKbCol(cc);
      } else if (currentView === 'main') {
        setSelectedMenuIndex((prev) => Math.max(0, prev - MENU_COLS));
      } else if (currentView === 'library' || currentView === 'favorites') {
        setSelectedGameIndex((prev) => Math.max(0, prev - COLS));
      } else if (currentView === 'bp_emulators') {
        if (cores.length === 0) return;
        setSelectedCoreIndex((prev) => Math.max(0, prev - coreCols));
      } else if (currentView === 'bp_download' && !showKb && !showFilters) {
        setSelectedResultIndex((prev) => Math.max(0, prev - RESULTS_COLS));
      } else if (currentView === 'bp_download' && showFilters) {
        const next = filterIndex - FILTER_COLS;
        if (next < 0 && filterFocusSection==='regions') {
          // move to platforms, same row/col
          switchFilterSection('platforms');
        } else {
          setFilterIndex((prev)=> Math.max(0, prev - FILTER_COLS));
        }
      } else if (currentView === 'bp_settings') {
        setBpSettingsIndex((prev) => Math.max(0, prev - 3));
        const el = bpSettingsRefs.current[Math.max(0, bpSettingsIndex - 3)];
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    },
    onDown: () => {
      if (currentView === 'bp_download' && showKb) {
        const { rr, cc } = clampKb(kbRow + 1, kbCol);
        setKbRow(rr); setKbCol(cc);
      } else if (currentView === 'main') {
        setSelectedMenuIndex((prev) => Math.min(menuItems.length - 1, prev + MENU_COLS));
      } else if (currentView === 'library' || currentView === 'favorites') {
        setSelectedGameIndex((prev) => Math.min(displayGames.length - 1, prev + COLS));
      } else if (currentView === 'bp_emulators') {
        if (cores.length === 0) return;
        setSelectedCoreIndex((prev) => Math.min(cores.length - 1, prev + coreCols));
      } else if (currentView === 'bp_download' && !showKb && !showFilters) {
        setSelectedResultIndex((prev) => Math.min(resultsBP.length - 1, prev + RESULTS_COLS));
      } else if (currentView === 'bp_download' && showFilters) {
        const next = filterIndex + FILTER_COLS;
        if (next > Object.keys(availablePlatformsBP).length - 1 && filterFocusSection==='platforms') {
          // move to regions, same row/col
          switchFilterSection('regions');
        } else {
          setFilterIndex((prev)=> Math.min(Math.max(0, Object.keys(availablePlatformsBP).length-1), prev + FILTER_COLS));
        }
      } else if (currentView === 'bp_settings') {
        setBpSettingsIndex((prev) => Math.min(bpSettingsRefs.current.length - 1, prev + 3));
        const el = bpSettingsRefs.current[Math.min(bpSettingsRefs.current.length - 1, bpSettingsIndex + 3)];
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    },
    onLeft: () => {
      if (currentView === 'bp_download' && showKb) {
        const { rr, cc } = clampKb(kbRow, kbCol - 1);
        setKbRow(rr); setKbCol(cc);
      } else if (currentView === 'main') {
        setSelectedMenuIndex((prev) => Math.max(0, prev - 1));
      } else if (currentView === 'library' || currentView === 'favorites') {
        setSelectedGameIndex((prev) => {
          if (prev % COLS === 0) {
            const newIndex = Math.max(0, prev - 1);
            const rowStart = Math.floor(newIndex / COLS) * COLS;
            const rowEnd = Math.min(rowStart + COLS - 1, displayGames.length - 1);
            return Math.min(rowEnd, newIndex);
          }
          return Math.max(0, prev - 1);
        });
      } else if (currentView === 'bp_emulators') {
        if (cores.length === 0) return;
        setSelectedCoreIndex((prev) => Math.max(0, prev - 1));
      } else if (currentView === 'bp_download' && !showKb && !showFilters) {
        setSelectedResultIndex((prev) => Math.max(0, prev - 1));
      } else if (currentView === 'bp_download' && showFilters) {
        if (filterIndex % FILTER_COLS === 0) {
          // move to other section, keep row/col
          switchFilterSection(filterFocusSection === 'platforms' ? 'regions' : 'platforms');
        } else {
          setFilterIndex((prev)=> Math.max(0, prev - 1));
        }
      } else if (currentView === 'bp_settings') {
        setBpSettingsIndex((prev) => Math.max(0, prev - 1));
        const el = bpSettingsRefs.current[Math.max(0, bpSettingsIndex - 1)];
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    },
    onRight: () => {
      if (currentView === 'bp_download' && showKb) {
        const { rr, cc } = clampKb(kbRow, kbCol + 1);
        setKbRow(rr); setKbCol(cc);
      } else if (currentView === 'main') {
        setSelectedMenuIndex((prev) => Math.min(menuItems.length - 1, prev + 1));
      } else if (currentView === 'library' || currentView === 'favorites') {
        setSelectedGameIndex((prev) => {
          const isRowEnd = (prev % COLS) === COLS - 1 || prev + 1 >= displayGames.length;
          if (isRowEnd) {
            const rowStart = Math.floor(prev / COLS) * COLS;
            return rowStart;
          }
          return Math.min(displayGames.length - 1, prev + 1);
        });
      } else if (currentView === 'bp_emulators') {
        if (cores.length === 0) return;
        setSelectedCoreIndex((prev) => Math.min(cores.length - 1, prev + 1));
      } else if (currentView === 'bp_download' && !showKb && !showFilters) {
        setSelectedResultIndex((prev) => Math.min(resultsBP.length - 1, prev + 1));
      } else if (currentView === 'bp_download' && showFilters) {
        const atRowEnd = (filterIndex % FILTER_COLS) === FILTER_COLS - 1 || filterIndex + 1 >= Object.keys(availablePlatformsBP).length;
        if (atRowEnd) {
          switchFilterSection(filterFocusSection === 'platforms' ? 'regions' : 'platforms');
        } else {
          setFilterIndex((prev)=> Math.min(Math.max(0, Object.keys(availablePlatformsBP).length-1), prev + 1));
        }
      } else if (currentView === 'bp_settings') {
        setBpSettingsIndex((prev) => Math.min(bpSettingsRefs.current.length - 1, prev + 1));
        const el = bpSettingsRefs.current[Math.min(bpSettingsRefs.current.length - 1, bpSettingsIndex + 1)];
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    },
    onLB: () => {
      if (currentView === 'main') {
        setSelectedMenuIndex((prev) => Math.max(0, prev - 3));
      } else if (currentView === 'library' || currentView === 'favorites') {
        setSelectedGameIndex((prev) => Math.max(0, prev - COLS * 3));
      } else if (currentView === 'bp_emulators') {
        if (cores.length === 0) return;
        setSelectedCoreIndex((prev) => Math.max(0, prev - coreCols * 3));
      } else if (currentView === 'bp_download' && !showKb && !showFilters) {
        setSelectedResultIndex((prev) => Math.max(0, prev - RESULTS_COLS * 3));
      } else if (currentView === 'bp_download' && showFilters) {
        switchFilterSection('platforms');
      }
    },
    onRB: () => {
      if (currentView === 'main') {
        setSelectedMenuIndex((prev) => Math.min(menuItems.length - 1, prev + 3));
      } else if (currentView === 'library' || currentView === 'favorites') {
        setSelectedGameIndex((prev) => Math.min(displayGames.length - 1, prev + COLS * 3));
      } else if (currentView === 'bp_emulators') {
        if (cores.length === 0) return;
        setSelectedCoreIndex((prev) => Math.min(cores.length - 1, prev + coreCols * 3));
      } else if (currentView === 'bp_download' && !showKb && !showFilters) {
        setSelectedResultIndex((prev) => Math.min(resultsBP.length - 1, prev + RESULTS_COLS * 3));
      } else if (currentView === 'bp_download' && showFilters) {
        switchFilterSection('regions');
      }
    },
    onA: () => {
      if (currentView === 'main') {
        const selected = menuItems[selectedMenuIndex];
        if (selected.id === 'exit') {
          setBigPictureMode(false);
        } else if (selected.id === 'library') {
          setLastListView('library');
          setCurrentView('library');
          setSelectedGameIndex(0);
        } else if (selected.id === 'favorites') {
          setLastListView('favorites');
          setCurrentView('favorites');
          setSelectedGameIndex(0);
        } else if (selected.id === 'bp_emulators') {
          setCurrentView('bp_emulators');
          setSelectedCoreIndex(0);
        } else if (selected.id === 'bp_download') {
          setCurrentView('bp_download');
        } else if (selected.id === 'bp_settings') {
          setCurrentView('bp_settings');
        }
      } else if (currentView === 'library' || currentView === 'favorites') {
        const game = displayGames[selectedGameIndex];
        if (game) {
          setSelectedGame(game);
          setCurrentView('details');
        }
      } else if (currentView === 'details' && selectedGame) {
        handleLaunchGame(selectedGame);
      } else if (currentView === 'bp_emulators') {
        handleInstallSelectedCore();
      } else if (currentView === 'bp_download') {
        if (showKb) {
          const k = currentKey();
          if (k) pressKey(k);
        } else if (showFilters) {
          // Toggle selection of focused filter item
          if (filterFocusSection==='platforms') {
            const keys = Object.keys(availablePlatformsBP);
            const id = keys[filterIndex] as string | undefined;
            if (id) {
              setSelectedPlatformsBP((prev)=> prev.includes(id)? prev.filter(x=>x!==id) : [...prev, id]);
            }
          } else {
            const keys = Object.keys(availableRegionsBP);
            const id = keys[filterIndex] as string | undefined;
            if (id) {
              setSelectedRegionsBP((prev)=> prev.includes(id)? prev.filter(x=>x!==id) : [...prev, id]);
            }
          }
        } else if (resultsBP.length > 0) {
          handleInstallSelectedSearch();
        } else if (!downloadingRandom) {
          handleInstallRandom();
        }
      } else if (currentView === 'bp_settings') {
        const el = bpSettingsRefs.current[bpSettingsIndex];
        if (el) el.click();
      }
    },
    onB: () => {
      if (showKb) {
        setShowKb(false);
      } else if (showFilters) {
        setShowFilters(false);
      } else if (currentView === 'details') {
        setCurrentView(lastListView);
        setSelectedGame(null);
        setShowGameInfo(false);
      } else if (currentView === 'library' || currentView === 'favorites' || currentView === 'bp_emulators' || currentView === 'bp_download' || currentView === 'bp_settings') {
        setCurrentView('main');
      }
    },
    onY: () => {
      if (currentView === 'details') {
        setShowGameInfo((prev) => !prev);
      } else if (currentView === 'bp_emulators') {
        // refresh list
        (async () => {
          try {
            setLoadingCores(true);
            const list = await tauriApi.getRetroArchCores();
            setCores(list);
          } finally {
            setLoadingCores(false);
          }
        })();
      } else if (currentView === 'bp_download') {
        // Y toggles Filters (close KB if open)
        if (showKb) setShowKb(false);
        setShowFilters((prev)=>!prev);
        if (!showFilters) { setFilterFocusSection('platforms'); setFilterIndex(0); }
      }
    },
    onRT: () => {
      if (currentView === 'bp_download') {
        // RT toggles Virtual Keyboard (close Filters if open)
        if (showFilters) setShowFilters(false);
        setShowKb((prev)=>!prev);
        if (!showKb) { setKbRow(0); setKbCol(0); }
      }
    },
    onStart: () => {
      if (currentView === 'details' && selectedGame) {
        handleLaunchGame(selectedGame);
      }
    },
    onSelect: () => {
      if (currentView !== 'main') {
        setCurrentView('main');
        setSelectedGame(null);
        setShowGameInfo(false);
      }
    },
    onLT: () => {
      if (currentView === 'library' || currentView === 'favorites') {
        setShowSearchBar((prev) => !prev);
      }
    },
  });

  // Main Menu View
  const renderMainMenu = () => (
    <motion.div
      key="main"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={motionTransition}
      className="h-full flex flex-col items-center justify-center gap-8 overflow-visible"
    >
      <h1 className="text-6xl font-extrabold tracking-tight">
        {t('big_picture.title')}
      </h1>
      <p className="text-xl text-gray-300 max-w-2xl text-center">
        {t('big_picture.subtitle')}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {menuItems.map((item, index) => (
          <motion.button
            key={item.id}
            onClick={() => {
              if (item.id === 'exit') {
                setBigPictureMode(false);
              } else if (item.id === 'library') {
                setLastListView('library');
                setCurrentView('library');
                setSelectedGameIndex(0);
              } else if (item.id === 'favorites') {
                setLastListView('favorites');
                setCurrentView('favorites');
                setSelectedGameIndex(0);
              } else if (item.id === 'bp_emulators') {
                setCurrentView('bp_emulators');
                setSelectedCoreIndex(0);
              } else if (item.id === 'bp_download') {
                setCurrentView('bp_download');
              } else if (item.id === 'bp_settings') {
                setCurrentView('bp_settings');
              }
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className={`px-10 py-6 rounded-2xl border-2 ${
              selectedMenuIndex === index
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-gray-700 hover:border-gray-500'
            }`}
          >
            <div className="flex items-center justify-center gap-3 text-2xl font-bold">
              <item.icon />
              {item.label}
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );

  // Library/Favorites View
  const renderGameGrid = () => (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={motionTransition}
      className="h-full flex flex-col relative overflow-visible"
    >
      <div className="flex items-center justify-between mb-8 px-8 pt-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentView('main')}
            className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700"
          >
            <ArrowLeft size={28} />
          </button>
          <h2 className="text-4xl font-bold">
            {currentView === 'favorites' ? t('big_picture.menu.favorites') : t('big_picture.menu.library')}
          </h2>
        </div>
        <div className="flex items-center gap-4">
          {showSearchBar ? (
            <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2">
              <Search className="text-purple-400 ml-2" size={24} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search games..."
                className="w-96 px-4 py-3 bg-transparent text-white text-xl placeholder-gray-400 focus:outline-none"
              />
              {searchQuery && (
                <div className="px-3 py-1 bg-purple-600 rounded-lg text-sm font-semibold">
                  {displayGames.length} results
                </div>
              )}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchBar(false);
                }}
                className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          ) : (
            <>
              <div className="text-xl text-gray-400">
                {displayGames.length} {t('big_picture.games')}
              </div>
              <button
                onClick={() => setShowSearchBar(true)}
                className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <Search size={24} />
              </button>
            </>
          )}
        </div>
      </div>

      {displayGames.length === 0 && searchQuery ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Search className="w-24 h-24 mx-auto mb-4 opacity-20" />
            <p className="text-2xl text-gray-400 mb-2">No games found</p>
            <p className="text-gray-500">Try a different search term</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedGameIndex(0);
              }}
              className="mt-6 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
            >
              Clear Search
            </button>
          </div>
        </div>
      ) : displayGames.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-2xl text-gray-400">{t('big_picture.no_games')}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-8 overflow-visible">
          <div className={`grid ${COLS===6?'grid-cols-6':COLS===4?'grid-cols-4':'grid-cols-5'} gap-6 pt-8 pb-64`}>
            {displayGames.map((game, index) => (
              <motion.div
                key={game.id}
                ref={(el) => (gameRefs.current[index] = el)}
                onClick={() => {
                  setSelectedGame(game);
                  setCurrentView('details');
                }}
                className={`relative aspect-[3/4] rounded-xl cursor-pointer transition-all ${
                  selectedGameIndex === index
                    ? 'ring-4 ring-purple-500 scale-105 z-10'
                    : 'hover:scale-105'
                }`}
                whileHover={{ scale: selectedGameIndex === index ? 1.05 : 1.02 }}
                whileTap={{ scale: 0.95 }}
                transition={motionTransition}
              >
                {game.cover_path ? (
                  <img
                    src={convertFileSrc(game.cover_path)}
                    alt={game.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <Gamepad2 size={48} className="text-gray-600" />
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                  <h3 className="text-lg font-semibold truncate">{game.title}</h3>
                  <p className="text-sm text-gray-400">{game.platform}</p>
                </div>

                {game.is_favorite === 1 && (
                  <div className="absolute top-2 right-2">
                    <Heart size={24} className="fill-red-500 text-red-500" />
                  </div>
                )}

                {selectedGameIndex === index && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 left-2 bg-purple-600 rounded-full p-2"
                  >
                    <Play size={20} />
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
      {bpShowHints && (
        <div className="absolute bottom-6 left-0 right-0 text-center text-gray-400 text-sm">
          <p>
            {showSearchBar
              ? 'Type to search • LT to close • B to go back'
              : 'A to select • B to go back • LT to search • LB/RB to page'}
          </p>
        </div>
      )}
    </motion.div>
  );

  // Game Details View
  const renderGameDetails = () => {
    if (!selectedGame) return null;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={motionTransition}
        className="h-full flex p-8 gap-8"
      >
        {/* Game Cover */}
        <div className="w-1/3">
          <motion.div
            className="aspect-[3/4] rounded-2xl shadow-2xl"
            whileHover={{ scale: 1.05 }}
          >
            {selectedGame.cover_path ? (
              <img
                src={convertFileSrc(selectedGame.cover_path)}
                alt={selectedGame.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                <Gamepad2 size={96} className="text-gray-600" />
              </div>
            )}
          </motion.div>
        </div>

        {/* Game Info */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-5xl font-bold mb-4">{selectedGame.title}</h1>
              <div className="flex items-center gap-4 text-xl text-gray-400">
                <span className="px-4 py-2 bg-gray-800 rounded-lg">
                  {selectedGame.platform}
                </span>
                {selectedGame.release_year && (
                  <span className="px-4 py-2 bg-gray-800 rounded-lg">
                    {selectedGame.release_year}
                  </span>
                )}
                {selectedGame.genre && (
                  <span className="px-4 py-2 bg-gray-800 rounded-lg">
                    {selectedGame.genre}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setCurrentView(lastListView)}
              className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700"
            >
              <X size={28} />
            </button>
          </div>

          {showGameInfo && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-6 bg-gray-800/50 rounded-xl"
            >
              {selectedGame.description && (
                <p className="text-lg text-gray-300 mb-4">{selectedGame.description}</p>
              )}
              {selectedGame.developer && (
                <p className="text-gray-400">
                  <strong>Developer:</strong> {selectedGame.developer}
                </p>
              )}
            </motion.div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Star className="text-yellow-500" size={24} />
                <span className="text-gray-400">Play Count</span>
              </div>
              <p className="text-3xl font-bold">{selectedGame.play_count}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="text-blue-500" size={24} />
                <span className="text-gray-400">Playtime</span>
              </div>
              <p className="text-3xl font-bold">
                {Math.round(selectedGame.total_playtime / 60)}h
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Heart
                  className={selectedGame.is_favorite ? 'text-red-500 fill-red-500' : 'text-gray-500'}
                  size={24}
                />
                <span className="text-gray-400">Favorite</span>
              </div>
              <p className="text-3xl font-bold">
                {selectedGame.is_favorite ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <motion.button
              onClick={() => handleLaunchGame(selectedGame)}
              className="w-full p-6 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-4 text-2xl font-bold"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Play size={32} />
              Play Game
            </motion.button>

            <motion.button
              onClick={() => handleToggleFavorite(selectedGame.id)}
              className={`w-full p-4 rounded-xl transition-all flex items-center justify-center gap-3 text-xl ${
                selectedGame.is_favorite
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Heart
                size={24}
                className={selectedGame.is_favorite ? 'fill-white' : ''}
              />
              {selectedGame.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
            </motion.button>

            <motion.button
              onClick={() => setShowGameInfo((prev) => !prev)}
              className="w-full p-4 rounded-xl bg-gray-700 hover:bg-gray-600 transition-all flex items-center justify-center gap-3 text-xl"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Info size={24} />
              {showGameInfo ? 'Hide Info' : 'Show Info'}
            </motion.button>
          </div>

          <div className="mt-auto pt-6 text-gray-400 text-center">
            <p>
              START to play • X to favorite • Y to toggle info • B to go back
            </p>
          </div>
        </div>
      </motion.div>
    );
  };

  // Emulators BP View (grid 3 columns)
  const renderEmulatorsBP = () => (
    <motion.div
      key="bp_emulators"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={motionTransition}
      className="h-full flex flex-col px-8 pt-8"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentView('main')} className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700">
            <ArrowLeft size={28} />
          </button>
          <h2 className="text-4xl font-bold">{t('emulator.retroarch_title')}</h2>
        </div>
        <div className="text-sm text-gray-400">{t('emulator.cores_installed_counter', { installed: cores.filter(c=>c.installed).length, total: cores.length })}</div>
      </div>

      {loadingCores ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-purple-500" /></div>
      ) : (
        <div ref={coresContainerRef} className="flex-1 overflow-y-auto pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cores.map((core, idx) => (
              <motion.div
                key={core.id}
                ref={(el) => (coreRefs.current[idx] = el)}
                className={`p-4 rounded-xl border ${selectedCoreIndex===idx?'border-purple-500 bg-purple-500/10':'border-gray-700 bg-gray-800/50'}`}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedCoreIndex(idx)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${core.installed?'bg-green-500/20':'bg-gray-700/50'}`}>
                      <Cpu className={`${core.installed?'text-green-400':'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="font-semibold">{core.name}</div>
                      <div className="text-xs text-gray-400">{core.platform_name}</div>
                    </div>
                  </div>
                  {core.installed && <span className="text-green-400 text-xs">{t('emulator.installed')}</span>}
                </div>
                {!core.installed && idx===selectedCoreIndex && (
                  <button onClick={handleInstallSelectedCore} className="mt-2 w-full px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                    {t('emulator.install_core')}
                  </button>
                )}
              </motion.div>
            ))}
          </div>
          {cores.length===0 && (
            <div className="flex items-center justify-center py-12 text-gray-400">{t('emulator.no_cores_for_platform')}</div>
          )}
        </div>
      )}
      {bpShowHints && (
        <div className="py-4 text-center text-gray-400">A: {t('emulator.install_core')} • B: {t('common.back')} • Y: {t('common.refresh')}</div>
      )}
    </motion.div>
  );

  // Download BP View (Search CrocDB)
  const renderDownloadBP = () => (
    <motion.div
      key="bp_download"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={motionTransition}
      className="h-full flex flex-col px-8 pt-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentView('main')} className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700">
            <ArrowLeft size={28} />
          </button>
          <h2 className="text-4xl font-bold">{t('download.title')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2">
            <Search className="text-purple-400 ml-2" size={24} />
            <input
              value={searchBP}
              onChange={(e) => setSearchBP(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearchCrocDB(); }}
              placeholder={t('download.search')}
              className="bg-transparent outline-none placeholder-gray-400"
            />
          </div>
          <button
            onClick={handleSearchCrocDB}
            disabled={isSearchingBP}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50"
          >
            {isSearchingBP ? t('common.loading') : t('common.search') || 'Search'}
          </button>
          <button
            onClick={() => { setShowKb(true); setKbRow(0); setKbCol(0); }}
            className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center gap-2"
            title="Virtual Keyboard"
          >
            <Keyboard size={18} /> {t('big_picture.keyboard.toggle') || 'KB'}
          </button>
          <button
            onClick={() => { setShowFilters(true); setFilterFocusSection('platforms'); setFilterIndex(0); }}
            className="px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center gap-2"
            title={t('download.filters')}
          >
            {t('download.filters')}
          </button>
        </div>
      </div>

      {/* Results grid */}
      <div className="flex-1 overflow-y-auto pb-8">
        {resultsBP.length === 0 && !isSearchingBP ? (
          <div className="h-full flex items-center justify-center text-gray-400">{t('download_manager.preparing')}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-visible">
            {resultsBP.map((g, idx) => (
              <motion.div
                key={g.slug}
                ref={(el) => (resultRefs.current[idx] = el)}
                className={`rounded-xl border ${selectedResultIndex===idx?'border-purple-500 ring-4 ring-purple-500/50':'border-gray-700'} bg-gray-800/50 cursor-pointer overflow-visible`}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedResultIndex(idx)}
              >
                <div className="w-full aspect-[3/4] bg-gray-900 flex items-center justify-center overflow-hidden rounded-t-xl">
                  {g.cover_url ? (
                    <img src={g.cover_url} alt={g.title} className="w-full h-full object-cover" />
                  ) : (
                    <Gamepad2 className="w-12 h-12 text-gray-600" />
                  )}
                </div>
                <div className="p-3">
                  <div className="font-semibold truncate" title={g.title}>{g.title}</div>
                  {g.platform && <div className="text-xs text-gray-400 mt-1">{g.platform}</div>}
                  {idx===selectedResultIndex && (
                    <button onClick={handleInstallSelectedSearch} className="mt-3 w-full px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                      {t('common.install') || 'Install'}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Virtual Keyboard Modal */}
      {showKb && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-6">
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700 w-[900px] max-w-[95vw]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Keyboard />
                <h3 className="text-2xl font-bold">Virtual Keyboard ({bpKeyboardLayout.toUpperCase()})</h3>
              </div>
              <button onClick={() => setShowKb(false)} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700"><X /></button>
            </div>
            <div className="mb-4">
              <div className="px-4 py-3 bg-gray-800 rounded-lg text-gray-300">{searchBP || ' '}</div>
            </div>
            <div className="space-y-3">
              {kbRows.map((row, rIdx) => (
                <div key={rIdx} className="flex items-center justify-center gap-2">
                  {row.map((k, cIdx) => {
                    const selected = showKb && kbRow===rIdx && kbCol===cIdx;
                    const isAction = ['SPACE','BACK','CLEAR','ENTER','CLOSE'].includes(k);
                    const label = k==='SPACE'?'⎵ Space':k==='BACK'?'⌫ Back':k==='CLEAR'?'✖ Clear':k==='ENTER'?'↵ Enter':k==='CLOSE'?'✖ Close':k.toUpperCase();
                    return (
                      <button
                        key={cIdx}
                        onClick={() => pressKey(k)}
                        className={`px-3 py-3 rounded-lg border ${selected?'border-purple-500 ring-4 ring-purple-500/40':'border-gray-700'} ${isAction?'bg-gray-800/80':'bg-gray-800'} hover:bg-gray-700 min-w-[52px] text-lg`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="text-center text-gray-400 text-sm mt-4">Use D-Pad to navigate • A to type • B to close • Y to toggle</div>
          </div>
        </div>
      )}

      {/* Filters Modal */}
      {showFilters && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-8 z-50">
          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-700 w-[1200px] max-w-[98vw] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold">{t('download.filters')}</h3>
              <button onClick={() => setShowFilters(false)} className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700"><X /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xl font-semibold mb-2">{t('download.platforms')}</h4>
                <div ref={platformListRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-3">
                  {Object.keys(availablePlatformsBP).map((pid, idx) => (
                    <button ref={(el)=> platformItemRefs.current[idx]=el} key={pid} onClick={() => setSelectedPlatformsBP(prev=> prev.includes(pid)? prev.filter(x=>x!==pid) : [...prev, pid])} className={`px-3 py-2 rounded-lg border ${selectedPlatformsBP.includes(pid)?'border-purple-500 bg-purple-500/10':'border-gray-700 bg-gray-800 hover:bg-gray-700'} ${filterFocusSection==='platforms' && filterIndex===idx?'ring-4 ring-purple-500/40':''}`}>
                      {availablePlatformsBP[pid]?.name || pid}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2">{t('download.regions')}</h4>
                <div ref={regionListRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-3">
                  {Object.keys(availableRegionsBP).map((rid, idx) => (
                    <button ref={(el)=> regionItemRefs.current[idx]=el} key={rid} onClick={() => setSelectedRegionsBP(prev=> prev.includes(rid)? prev.filter(x=>x!==rid) : [...prev, rid])} className={`px-3 py-2 rounded-lg border ${selectedRegionsBP.includes(rid)?'border-purple-500 bg-purple-500/10':'border-gray-700 bg-gray-800 hover:bg-gray-700'} ${filterFocusSection==='regions' && filterIndex===idx?'ring-4 ring-purple-500/40':''}`}>
                      {availableRegionsBP[rid] || rid}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 mt-6">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input type="checkbox" checked={hideNoImageBP} onChange={(e)=> setHideNoImageBP(e.target.checked)} />
                  {t('download.hide_no_image') || 'Hide games without image'}
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => { setSelectedPlatformsBP([]); setSelectedRegionsBP([]); }} className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600">{t('download.clear_filters')}</button>
                <button onClick={() => { setShowFilters(false); handleSearchCrocDB(); }} className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">{t('common.search')}</button>
              </div>
            </div>
            <div className="text-center text-gray-400 text-sm mt-3">D-Pad: navigate • A: toggle • B: close • Search applies filters</div>
          </div>
        </div>
      )}

      {bpShowHints && (
        <div className="py-3 text-center text-gray-400 text-sm">D-Pad to navigate • A to install • B to back • RT to Keyboard • Y to Filters</div>
      )}
    </motion.div>
  );

  // Big Picture Settings View
  const renderBPSettings = () => (
    <motion.div
      key="bp_settings"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={motionTransition}
      className="h-full flex flex-col px-8 pt-8"
    >
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setCurrentView('main')} className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700"><ArrowLeft size={28} /></button>
        <h2 className="text-4xl font-bold">Big Picture Settings</h2>
      </div>
      <div className="max-w-3xl space-y-6">
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-semibold mb-3">Virtual Keyboard Layout</h3>
          <div className="flex gap-3">
            <button
              ref={(el)=> (bpSettingsRefs.current[0]=el)}
              onClick={() => setBpKeyboardLayout('qwerty')}
              className={`px-4 py-2 rounded-lg ${bpKeyboardLayout==='qwerty'?'bg-gradient-to-r from-purple-500 to-pink-500':'bg-gray-700 hover:bg-gray-600'} ${bpSettingsIndex===0?'ring-4 ring-purple-500/40':''}`}
            >QWERTY</button>
            <button
              ref={(el)=> (bpSettingsRefs.current[1]=el)}
              onClick={() => setBpKeyboardLayout('azerty')}
              className={`px-4 py-2 rounded-lg ${bpKeyboardLayout==='azerty'?'bg-gradient-to-r from-purple-500 to-pink-500':'bg-gray-700 hover:bg-gray-600'} ${bpSettingsIndex===1?'ring-4 ring-purple-500/40':''}`}
            >AZERTY</button>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-semibold mb-3">Start View</h3>
          <div className="flex gap-3 flex-wrap">
            {(['main','library','favorites','bp_download'] as const).map((v, i) => (
              <button
                key={v}
                ref={(el)=> (bpSettingsRefs.current[2 + i]=el)}
                onClick={() => { setBpStartView(v); setCurrentView(v); }}
                className={`px-4 py-2 rounded-lg ${bpStartView===v?'bg-gradient-to-r from-purple-500 to-pink-500':'bg-gray-700 hover:bg-gray-600'} ${bpSettingsIndex===(2+i)?'ring-4 ring-purple-500/40':''}`}
              >{v}</button>
            ))}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-semibold mb-3">Grid Size</h3>
          <div className="flex gap-3">
            <button
              ref={(el)=> (bpSettingsRefs.current[6]=el)}
              onClick={() => setBpGridScale('small')}
              className={`px-4 py-2 rounded-lg ${bpGridScale==='small'?'bg-gradient-to-r from-purple-500 to-pink-500':'bg-gray-700 hover:bg-gray-600'} ${bpSettingsIndex===6?'ring-4 ring-purple-500/40':''}`}
            >Small (more)</button>
            <button
              ref={(el)=> (bpSettingsRefs.current[7]=el)}
              onClick={() => setBpGridScale('medium')}
              className={`px-4 py-2 rounded-lg ${bpGridScale==='medium'?'bg-gradient-to-r from-purple-500 to-pink-500':'bg-gray-700 hover:bg-gray-600'} ${bpSettingsIndex===7?'ring-4 ring-purple-500/40':''}`}
            >Medium</button>
            <button
              ref={(el)=> (bpSettingsRefs.current[8]=el)}
              onClick={() => setBpGridScale('large')}
              className={`px-4 py-2 rounded-lg ${bpGridScale==='large'?'bg-gradient-to-r from-purple-500 to-pink-500':'bg-gray-700 hover:bg-gray-600'} ${bpSettingsIndex===8?'ring-4 ring-purple-500/40':''}`}
            >Large (bigger covers)</button>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-semibold mb-3">Hints & Motion</h3>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <button
              ref={(el)=> (bpSettingsRefs.current[9]=el)}
              onClick={() => setBpShowHints(!bpShowHints)}
              className={`px-4 py-2 rounded-lg ${bpShowHints?'bg-gradient-to-r from-purple-500 to-pink-500':'bg-gray-700 hover:bg-gray-600'} ${bpSettingsIndex===9?'ring-4 ring-purple-500/40':''}`}
            >{bpShowHints?'Hints: ON':'Hints: OFF'}</button>
            <button
              ref={(el)=> (bpSettingsRefs.current[10]=el)}
              onClick={() => setBpReduceMotion(!bpReduceMotion)}
              className={`px-4 py-2 rounded-lg ${bpReduceMotion?'bg-gradient-to-r from-purple-500 to-pink-500':'bg-gray-700 hover:bg-gray-600'} ${bpSettingsIndex===10?'ring-4 ring-purple-500/40':''}`}
            >{bpReduceMotion?'Reduce Motion: ON':'Reduce Motion: OFF'}</button>
          </div>
        </div>
      </div>
      {bpShowHints && (
        <div className="mt-auto py-3 text-center text-gray-400 text-sm">A to select • B to back</div>
      )}
    </motion.div>
  );

  // Listen to download progress events (same behavior as normal mode)
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        unlisten = await listen('download-progress', (event: any) => {
          const { slug, stage, progress, message } = event.payload || {};
          updateDownloadProgress(slug, stage, progress, message || '');
          if ((stage === 'completed' || progress >= 100) && slug) {
            // Slight delay to let user see 100%
            setTimeout(() => removeDownload(slug), 3000);
          }
        });
      } catch (err) {
        console.error('Failed to listen download-progress in BigPictureMode', err);
      }
    })();
    return () => { if (unlisten) unlisten(); };
  }, [updateDownloadProgress, removeDownload]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-900 via-gray-900 to-black text-white">
      <AnimatePresence mode="wait">
        {currentView === 'main' && renderMainMenu()}
        {(currentView === 'library' || currentView === 'favorites') && (
          <AnimatePresence mode="wait">{
            renderGameGrid()
          }</AnimatePresence>
        )}
        {currentView === 'details' && (
          <AnimatePresence mode="wait">{
            renderGameDetails()
          }</AnimatePresence>
        )}
        {currentView === 'bp_emulators' && renderEmulatorsBP()}
        {currentView === 'bp_download' && renderDownloadBP()}
        {currentView === 'bp_settings' && renderBPSettings()}
      </AnimatePresence>
      {/* Floating downloads manager (like normal mode) */}
      <DownloadManager />
    </div>
  );
};

export default BigPictureMode;
