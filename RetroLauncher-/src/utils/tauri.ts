import { invoke } from '@tauri-apps/api/tauri';
import { Game, Emulator } from '../store/useStore';

// CrocDB Types
export interface CrocDBGame {
  slug: string;
  id: string | null;
  title: string;
  platform: string;
  platform_name: string | null;
  description: string | null;
  cover_url: string | null;
  regions: string[];
  download_links: DownloadLink[];
}

export interface DownloadLink {
  name: string;
  format: string;
  url: string;
  filename: string;
  size: number;
  size_str: string;
  host: string;
}

export interface PlatformInfo {
  brand: string;
  name: string;
}

export interface DatabaseInfo {
  total_entries: number;
}

export interface SearchResultsData {
  results: CrocDBGame[];
  total_results: number;
  page: number;
  max_results: number;
}

export interface RecommendedEmulator {
  id: string;
  name: string;
  description: string;
  platforms: string[];
  platform_names: string[];
  website: string;
  download_page: string;
  download_url_windows: string | null;
  download_url_mac: string | null;
  download_url_linux: string | null;
  is_portable: boolean;
  executable_name_windows: string | null;
  executable_name_mac: string | null;
  executable_name_linux: string | null;
  logo_url: string | null;
  install_instructions: string;
}

// RetroArch Types
export interface RetroArchStatus {
  installed: boolean;
  path: string | null;
  version: string | null;
}

export interface RetroArchCore {
  id: string;
  name: string;
  platform: string;
  platform_name: string;
  description: string;
  filename: string;
  installed: boolean;
  recommended: boolean;
}

export const tauriApi = {
  // Game operations
  async getGames(): Promise<Game[]> {
    return await invoke('get_games');
  },

  async addGame(game: Game): Promise<string> {
    return await invoke('add_game', { game });
  },

  async launchGame(gameId: string): Promise<string> {
    return await invoke('launch_game', { gameId });
  },

  async deleteGame(gameId: string): Promise<void> {
    return await invoke('delete_game', { gameId });
  },

  async toggleFavorite(gameId: string): Promise<boolean> {
    return await invoke('toggle_favorite', { gameId });
  },

  async getGameStats(gameId: string): Promise<any> {
    return await invoke('get_game_stats', { gameId });
  },

  // Emulator operations
  async getEmulators(): Promise<Emulator[]> {
    return await invoke('get_emulators');
  },

  async addEmulator(emulator: Emulator): Promise<string> {
    return await invoke('add_emulator', { emulator });
  },

  async getRecommendedEmulators(): Promise<RecommendedEmulator[]> {
    return await invoke('get_recommended_emulators');
  },

  async installEmulator(emulatorId: string): Promise<string> {
    return await invoke('install_emulator', { emulatorId });
  },

  // CrocDB operations
  async searchCrocDB(query: string): Promise<CrocDBGame[]> {
    return await invoke('search_crocdb', { query });
  },

  async searchCrocDBAdvanced(
    searchKey?: string,
    platforms?: string[],
    regions?: string[],
    maxResults?: number,
    page?: number
  ): Promise<SearchResultsData> {
    return await invoke('search_crocdb_advanced', {
      searchKey: searchKey || null,
      platforms: platforms || null,
      regions: regions || null,
      maxResults: maxResults || null,
      page: page || null,
    });
  },

  async getCrocDBEntry(slug: string): Promise<CrocDBGame> {
    return await invoke('get_crocdb_entry', { slug });
  },

  async getRandomCrocDBEntry(): Promise<CrocDBGame> {
    return await invoke('get_random_crocdb_entry');
  },

  async getCrocDBPlatforms(): Promise<Record<string, PlatformInfo>> {
    return await invoke('get_crocdb_platforms');
  },

  async getCrocDBRegions(): Promise<Record<string, string>> {
    return await invoke('get_crocdb_regions');
  },

  async getCrocDBInfo(): Promise<DatabaseInfo> {
    return await invoke('get_crocdb_info');
  },

  async downloadFromCrocDB(slug: string, destination: string): Promise<string> {
    return await invoke('download_from_crocdb', { slug, destination });
  },

  async installGameFromCrocDB(slug: string): Promise<string> {
    return await invoke('install_game_from_crocdb', { slug });
  },

  // Settings operations
  async getSettings(): Promise<any> {
    return await invoke('get_settings');
  },

  async updateSettings(settings: any): Promise<string> {
    return await invoke('update_settings', { settings });
  },

  // RetroArch operations
  async checkRetroArchStatus(): Promise<RetroArchStatus> {
    return await invoke('check_retroarch_status');
  },

  async installRetroArch(): Promise<string> {
    return await invoke('install_retroarch');
  },

  async getRetroArchCores(platform?: string): Promise<RetroArchCore[]> {
    return await invoke('get_retroarch_cores', { platform: platform || null });
  },

  async installRetroArchCore(coreId: string): Promise<string> {
    return await invoke('install_retroarch_core', { coreId });
  },

  async getInstalledCores(): Promise<RetroArchCore[]> {
    return await invoke('get_installed_cores');
  },

  async installAllRetroArchCores(force?: boolean): Promise<string> {
    return await invoke('install_all_retroarch_cores', { force: force ?? null });
  },

  async uninstallAllRetroArchCores(removeCache?: boolean): Promise<string> {
    return await invoke('uninstall_all_retroarch_cores', { remove_cache: removeCache ?? false });
  },

  // Open folder in system file explorer
  async openFolderInExplorer(path: string): Promise<void> {
    return invoke('open_folder_in_explorer', { path });
  },
};
