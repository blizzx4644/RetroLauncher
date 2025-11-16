// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::Manager;
use std::path::PathBuf;

mod database;
mod emulator;
mod crocdb;
mod game;
mod retroarch;

use database::Database;
use emulator::EmulatorConfig;
use game::Game;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppState {
    pub db_path: std::path::PathBuf,
}

// Game launching command
#[tauri::command]
async fn launch_game(game_id: String, state: tauri::State<'_, Database>, app_handle: tauri::AppHandle) -> Result<String, String> {
    let game = state.get_game(&game_id).await
        .map_err(|e| e.to_string())?;

    // Get app directory for RetroArch path
    let app_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    let retroarch_path = app_dir.join("retroarch");
    let retroarch_exe = retroarch_path.join("retroarch.exe");

    if !retroarch_exe.exists() {
        return Err("RetroArch is not installed. Please install it from the Emulators tab.".to_string());
    }

    // Get any installed core for the platform (preferred: recommended, fallback: any)
    let core = retroarch::get_any_installed_core_for_platform(&game.platform, &retroarch_path)
        .ok_or(format!(
            "No core installed for platform '{}'. Please install a core from the Emulators tab.",
            game.platform
        ))?;

    let core_path = retroarch_path.join("cores").join(&core.filename);

    if !core_path.exists() {
        return Err(format!("Core '{}' is not installed. Please install it from the Emulators tab.", core.name));
    }

    // Update play count and last played
    state.update_game_stats(&game_id).await
        .map_err(|e| e.to_string())?;

    // Launch game with RetroArch
    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new(&retroarch_exe);
        // Fullscreen
        cmd.arg("--fullscreen");
        cmd.arg("-L");
        cmd.arg(core_path);
        cmd.arg(&game.rom_path);

        cmd.spawn().map_err(|e| format!("Failed to launch game: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        let mut cmd = Command::new("sh");
        cmd.arg("-c");
        let launch_cmd = format!("\"{}\" --fullscreen -L \"{}\" \"{}\"",
            retroarch_exe.to_string_lossy(),
            core_path.to_string_lossy(),
            game.rom_path
        );
        cmd.arg(launch_cmd);
        cmd.spawn().map_err(|e| format!("Failed to launch game: {}", e))?;
    }

    Ok(format!("Launched: {}", game.title))
}

// Get all games from library
#[tauri::command]
async fn get_games(state: tauri::State<'_, Database>) -> Result<Vec<Game>, String> {
    state.get_all_games().await.map_err(|e| e.to_string())
}

// Delete a game
#[tauri::command]
async fn delete_game(game_id: String, state: tauri::State<'_, Database>) -> Result<(), String> {
    state.delete_game(&game_id).await.map_err(|e| e.to_string())
}

// Add game to library
#[tauri::command]
async fn add_game(game: Game, state: tauri::State<'_, Database>) -> Result<String, String> {
    state.add_game(game).await.map_err(|e| e.to_string())?;
    Ok("Game added successfully".to_string())
}

// Search CrocDB
#[tauri::command]
async fn search_crocdb(query: String) -> Result<Vec<crocdb::CrocDBGame>, String> {
    crocdb::search_games(&query).await.map_err(|e| e.to_string())
}

// Search CrocDB with advanced filters
#[tauri::command]
async fn search_crocdb_advanced(
    search_key: Option<String>,
    platforms: Option<Vec<String>>,
    regions: Option<Vec<String>>,
    max_results: Option<i32>,
    page: Option<i32>,
) -> Result<crocdb::SearchResultsData, String> {
    crocdb::search_games_advanced(search_key, platforms, regions, max_results, page)
        .await
        .map_err(|e| e.to_string())
}

// Get specific CrocDB entry by slug
#[tauri::command]
async fn get_crocdb_entry(slug: String) -> Result<crocdb::CrocDBGame, String> {
    crocdb::get_entry(&slug).await.map_err(|e| e.to_string())
}

// Get random CrocDB entry
#[tauri::command]
async fn get_random_crocdb_entry() -> Result<crocdb::CrocDBGame, String> {
    crocdb::get_random_entry().await.map_err(|e| e.to_string())
}

// Get available platforms from CrocDB
#[tauri::command]
async fn get_crocdb_platforms() -> Result<std::collections::HashMap<String, crocdb::PlatformInfo>, String> {
    crocdb::get_platforms().await.map_err(|e| e.to_string())
}

// Get available regions from CrocDB
#[tauri::command]
async fn get_crocdb_regions() -> Result<std::collections::HashMap<String, String>, String> {
    crocdb::get_regions().await.map_err(|e| e.to_string())
}

// Get CrocDB database info
#[tauri::command]
async fn get_crocdb_info() -> Result<crocdb::DatabaseInfo, String> {
    crocdb::get_database_info().await.map_err(|e| e.to_string())
}

// Download from CrocDB
#[tauri::command]
async fn download_from_crocdb(slug: String, destination: String) -> Result<String, String> {
    crocdb::download_game(&slug, &destination).await.map_err(|e| e.to_string())
}

// Install game from CrocDB (download, extract, add to library)
#[tauri::command]
async fn install_game_from_crocdb(
    slug: String,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, Database>
) -> Result<String, String> {
    // Get app data directory for installation
    let app_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    let install_dir = app_dir.join("games");
    std::fs::create_dir_all(&install_dir)
        .map_err(|e| format!("Failed to create games directory: {}", e))?;

    // Install the game (download + extract) with progress events
    let install_result = crocdb::install_game_complete(
        &slug,
        "retroarch",
        &install_dir.to_string_lossy().to_string(),
        Some(&app_handle)
    ).await.map_err(|e| e.to_string())?;

    // Generate unique ID
    let game_id = format!("crocdb_{}", slug.replace("-", "_"));

    // Add to database
    let game = game::Game {
        id: game_id.clone(),
        title: install_result.title.clone(),
        platform: install_result.platform.clone(),
        rom_path: install_result.rom_path,
        cover_path: install_result.cover_path,
        emulator_id: "retroarch".to_string(), // Placeholder, not used anymore
        description: Some(format!("Downloaded from CrocDB: {}", slug)),
        release_year: None,
        genre: None,
        developer: None,
        is_favorite: 0,
        play_count: 0,
        total_playtime: 0,
        last_played: None,
    };

    state.add_game(game).await.map_err(|e| e.to_string())?;

    Ok(format!("Game '{}' installed successfully!", install_result.title))
}

// Emulator management
#[tauri::command]
async fn get_emulators(state: tauri::State<'_, Database>) -> Result<Vec<EmulatorConfig>, String> {
    state.get_all_emulators().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn add_emulator(emulator: EmulatorConfig, state: tauri::State<'_, Database>) -> Result<String, String> {
    state.add_emulator(emulator).await.map_err(|e| e.to_string())?;
    Ok("Emulator added successfully".to_string())
}

// Get recommended emulators
#[tauri::command]
async fn get_recommended_emulators() -> Result<Vec<emulator::RecommendedEmulator>, String> {
    Ok(emulator::get_recommended_emulators())
}

// Download and install an emulator
#[tauri::command]
async fn install_emulator(
    emulator_id: String,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, Database>
) -> Result<String, String> {
    use std::fs::File;
    use std::io::BufReader;
    use zip::ZipArchive;

    // Get recommended emulator info
    let recommended = emulator::get_recommended_emulator_by_id(&emulator_id)
        .ok_or("Emulator not found in recommendations")?;

    // Get app data directory
    let app_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    let emulators_dir = app_dir.join("emulators").join(&emulator_id);
    std::fs::create_dir_all(&emulators_dir)
        .map_err(|e| format!("Failed to create emulators directory: {}", e))?;

    // Determine download URL based on OS
    let download_url = if cfg!(target_os = "windows") {
        recommended.download_url_windows
    } else if cfg!(target_os = "macos") {
        recommended.download_url_mac
    } else {
        recommended.download_url_linux
    }.ok_or("No download URL available for your operating system")?;

    // Download the emulator
    let filename = download_url.split('/').last().unwrap_or("emulator.zip");
    let download_path = emulators_dir.join(filename);

    let client = reqwest::Client::new();
    let response = client.get(&download_url).send().await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    let bytes = response.bytes().await
        .map_err(|e| format!("Failed to read download: {}", e))?;

    std::fs::write(&download_path, bytes)
        .map_err(|e| format!("Failed to save download: {}", e))?;

    // Extract if it's an archive
    let extract_dir = emulators_dir.join("app");
    if filename.ends_with(".zip") {
        let file = File::open(&download_path)
            .map_err(|e| format!("Failed to open archive: {}", e))?;
        let reader = BufReader::new(file);
        let mut archive = ZipArchive::new(reader)
            .map_err(|e| format!("Failed to read archive: {}", e))?;

        std::fs::create_dir_all(&extract_dir)
            .map_err(|e| format!("Failed to create extract directory: {}", e))?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)
                .map_err(|e| format!("Failed to read archive entry: {}", e))?;
            let outpath = extract_dir.join(file.name());

            if file.name().ends_with('/') {
                std::fs::create_dir_all(&outpath)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            } else {
                if let Some(p) = outpath.parent() {
                    std::fs::create_dir_all(p)
                        .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                }
                let mut outfile = File::create(&outpath)
                    .map_err(|e| format!("Failed to create file: {}", e))?;
                std::io::copy(&mut file, &mut outfile)
                    .map_err(|e| format!("Failed to extract file: {}", e))?;
            }
        }
    } else if filename.ends_with(".7z") {
        return Err("7z extraction not yet supported. Please extract manually and add the emulator path.".to_string());
    }

    // Find executable
    let executable_name = if cfg!(target_os = "windows") {
        recommended.executable_name_windows
    } else if cfg!(target_os = "macos") {
        recommended.executable_name_mac
    } else {
        recommended.executable_name_linux
    }.ok_or("No executable name configured for your OS")?;

    // Search for the executable in the extracted directory
    let mut executable_path = None;
    for entry in std::fs::read_dir(&extract_dir)
        .map_err(|e| format!("Failed to read extract directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        // Check if it's the executable or search in subdirectories
        if path.file_name() == Some(std::ffi::OsStr::new(&executable_name)) {
            executable_path = Some(path);
            break;
        }

        // Search in subdirectories (one level deep)
        if path.is_dir() {
            for sub_entry in std::fs::read_dir(&path)
                .map_err(|e| format!("Failed to read subdirectory: {}", e))? {
                let sub_entry = sub_entry.map_err(|e| format!("Failed to read subentry: {}", e))?;
                let sub_path = sub_entry.path();
                if sub_path.file_name() == Some(std::ffi::OsStr::new(&executable_name)) {
                    executable_path = Some(sub_path);
                    break;
                }
            }
        }

        if executable_path.is_some() {
            break;
        }
    }

    let executable_path = executable_path
        .ok_or(format!("Could not find executable '{}' in extracted files", executable_name))?;

    // Add emulator to database for each supported platform
    for (idx, platform) in recommended.platforms.iter().enumerate() {
        let emu_id = if idx == 0 {
            format!("{}_{}", emulator_id, platform)
        } else {
            format!("{}_{}_{}", emulator_id, platform, idx)
        };

        // Create a String for the uppercase platform to avoid temporary value issue
        let platform_upper = platform.to_uppercase();
        let platform_name = recommended.platform_names.get(idx)
            .map(|s| s.as_str())
            .unwrap_or(&platform_upper);

        let emulator_config = EmulatorConfig {
            id: emu_id,
            name: format!("{} ({})", recommended.name, platform_name),
            platform: platform.clone(),
            executable_path: executable_path.to_string_lossy().to_string(),
            arguments: None,
            icon_path: None,
        };

        state.add_emulator(emulator_config).await
            .map_err(|e| format!("Failed to add emulator to database: {}", e))?;
    }

    Ok(format!("{} installed successfully!", recommended.name))
}

// Get user settings
#[tauri::command]
async fn get_settings(state: tauri::State<'_, Database>) -> Result<serde_json::Value, String> {
    state.get_settings().await.map_err(|e| e.to_string())
}

// Update user settings
#[tauri::command]
async fn update_settings(settings: serde_json::Value, state: tauri::State<'_, Database>) -> Result<String, String> {
    state.update_settings(settings).await.map_err(|e| e.to_string())?;
    Ok("Settings updated".to_string())
}

// Toggle favorite
#[tauri::command]
async fn toggle_favorite(game_id: String, state: tauri::State<'_, Database>) -> Result<bool, String> {
    state.toggle_favorite(&game_id).await.map_err(|e| e.to_string())
}

// Get game stats
#[tauri::command]
async fn get_game_stats(game_id: String, state: tauri::State<'_, Database>) -> Result<game::GameStats, String> {
    state.get_game_stats(&game_id).await.map_err(|e| e.to_string())
}

// RetroArch management
#[tauri::command]
async fn check_retroarch_status(app_handle: tauri::AppHandle) -> Result<retroarch::RetroArchStatus, String> {
    let app_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    Ok(retroarch::check_retroarch_status(&app_dir))
}

#[tauri::command]
async fn install_retroarch(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    // Download RetroArch
    let archive_path = retroarch::download_retroarch(&app_dir, Some(&app_handle))
        .await
        .map_err(|e| e.to_string())?;

    // Extract RetroArch
    let extract_path = retroarch::extract_retroarch(&archive_path, &app_dir, Some(&app_handle))
        .map_err(|e| e.to_string())?;

    // Prepare cores cache immediately (download + extract core pack)
    // This ensures the UI can list all available cores from the local cache on first launch
    let _ = retroarch::prepare_cores_cache(&app_dir, Some(&app_handle))
        .await
        .map_err(|e| e.to_string())?;

    Ok(format!("RetroArch installed successfully to: {:?}", extract_path))
}

#[tauri::command]
async fn get_retroarch_cores(platform: Option<String>, app_handle: tauri::AppHandle) -> Result<Vec<retroarch::RetroArchCore>, String> {
    let app_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    let retroarch_path = app_dir.join("retroarch");

    // Prefer listing available cores from the prepared AppData cache
    // AppData/Roaming/com.retrolauncher.app/cache/retroarch_cores/RetroArch-Win64
    let cache_retroarch = app_dir.join("cache").join("retroarch_cores").join("RetroArch-Win64");
    let resource_retroarch = if cache_retroarch.exists() {
        println!("✅ Using cached cores directory at: {:?}", cache_retroarch);
        Some(cache_retroarch)
    } else {
        None
    };

    // Get all cores with automatic detection (installed + available from resource)
    let all_cores = retroarch::get_all_cores_with_detection_and_resource(
        &retroarch_path,
        resource_retroarch.as_deref()
    );

    println!("📦 Total cores detected: {}", all_cores.len());

    // Filter by platform if specified
    if let Some(platform_id) = platform {
        let filtered: Vec<_> = all_cores.into_iter().filter(|c| c.platform == platform_id).collect();
        println!("🎯 Filtered to platform '{}': {} cores", platform_id, filtered.len());
        Ok(filtered)
    } else {
        println!("📊 Returning all {} cores", all_cores.len());
        Ok(all_cores)
    }
}

#[tauri::command]
async fn install_retroarch_core(core_id: String, app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    let retroarch_path = app_dir.join("retroarch");

    if !retroarch_path.exists() {
        return Err("RetroArch is not installed".to_string());
    }

    retroarch::install_core(&core_id, &retroarch_path, Some(&app_handle))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_installed_cores(app_handle: tauri::AppHandle) -> Result<Vec<retroarch::RetroArchCore>, String> {
    let app_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    let retroarch_path = app_dir.join("retroarch");

    // Use the new detection function that scans the cores directory
    let all_cores = retroarch::get_all_cores_with_detection(&retroarch_path);

    // Return only installed cores
    let installed_cores: Vec<retroarch::RetroArchCore> = all_cores
        .into_iter()
        .filter(|c| c.installed)
        .collect();

    Ok(installed_cores)
}

// Uninstall all RetroArch cores (optionally remove cache)
#[tauri::command]
async fn uninstall_all_retroarch_cores(app_handle: tauri::AppHandle, remove_cache: Option<bool>) -> Result<String, String> {
    let app_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    let retroarch_path = app_dir.join("retroarch");
    if !retroarch_path.exists() {
        return Err("RetroArch is not installed".to_string());
    }

    let removed = retroarch::uninstall_all_cores(&retroarch_path, remove_cache.unwrap_or(false))
        .map_err(|e| e.to_string())?;

    Ok(format!("Removed {} core DLLs{}", removed, if remove_cache.unwrap_or(false) { " and cleared cache" } else { "" }))
}

#[tauri::command]
async fn install_all_retroarch_cores(app_handle: tauri::AppHandle, force: Option<bool>) -> Result<String, String> {
    let app_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;

    let retroarch_path = app_dir.join("retroarch");
    if !retroarch_path.exists() {
        return Err("RetroArch is not installed".to_string());
    }

    // Prepare cores cache once to speed up installs
    let _ = retroarch::prepare_cores_cache(&app_dir, Some(&app_handle))
        .await
        .map_err(|e| e.to_string())?;

    // Detect optional resource directory (Ressource/RetroArch-Win64) like in get_retroarch_cores
    let mut resource_retroarch = None;
    let dev_path = std::path::PathBuf::from("D:\\RetroLauncher\\Ressource\\RetroArch-Win64");
    if dev_path.exists() {
        resource_retroarch = Some(dev_path);
    } else if let Ok(current) = std::env::current_dir() {
        let rel_path = current.join("Ressource").join("RetroArch-Win64");
        if rel_path.exists() {
            resource_retroarch = Some(rel_path);
        }
    }

    // Get full cores list with detection + resources (predefined + detected + resource DLLs)
    let all = retroarch::get_all_cores_with_detection_and_resource(&retroarch_path, resource_retroarch.as_deref());
    let mut installed_count = 0usize;
    let mut skipped_count = 0usize;
    let mut errors: Vec<String> = vec![];
    let do_force = force.unwrap_or(false);

    let total = all.len().max(1) as f32;
    let mut processed: f32 = 0.0;

    for core in all {
        // Skip if already installed
        let target = retroarch_path.join("cores").join(&core.filename);
        if target.exists() {
            if do_force {
                let _ = std::fs::remove_file(&target);
            } else {
                skipped_count += 1;
                processed += 1.0;
                let _ = app_handle.emit_all("download-progress", serde_json::json!({
                    "slug": "install_all_cores",
                    "stage": "copying",
                    "progress": (processed / total) * 100.0,
                    "message": format!("Skipping {} (already installed)", core.id),
                    "title": "Install All Cores",
                }));
                continue;
            }
        }

        match retroarch::install_core(&core.id, &retroarch_path, Some(&app_handle)).await {
            Ok(_) => installed_count += 1,
            Err(e) => errors.push(format!("{}: {}", core.id, e)),
        }

        processed += 1.0;
        let _ = app_handle.emit_all("download-progress", serde_json::json!({
            "slug": "install_all_cores",
            "stage": "copying",
            "progress": (processed / total) * 100.0,
            "message": format!("Processed {} / {} cores", processed as i32, total as i32),
            "title": "Install All Cores",
        }));
    }

    if errors.is_empty() {
        let _ = app_handle.emit_all("download-progress", serde_json::json!({
            "slug": "install_all_cores",
            "stage": "completed",
            "progress": 100.0,
            "message": "All cores processed",
            "title": "Install All Cores",
        }));
        Ok(format!(
            "All cores processed. Installed: {}, Skipped: {}",
            installed_count, skipped_count
        ))
    } else {
        Err(format!(
            "Installed: {}, Skipped: {}, Errors: {} -> {:?}",
            installed_count,
            skipped_count,
            errors.len(),
            errors
        ))
    }
}

// Check if cores cache is prepared (extracted), to control first-core popup behavior
#[tauri::command]
async fn is_cores_cache_ready(app_handle: tauri::AppHandle) -> Result<bool, String> {
    let app_dir = app_handle.path_resolver()
        .app_data_dir()
        .ok_or("Failed to get app data directory")?;
    let marker = app_dir.join("cache").join("retroarch_cores").join(".extracted");
    Ok(marker.exists())
}

// Open folder in explorer
#[tauri::command]
fn open_folder_in_explorer(path: String) -> Result<(), String> {
    // Vérifier que le chemin existe
    let path_obj = std::path::Path::new(&path);
    if !path_obj.exists() {
        // Créer le dossier s'il n'existe pas
        std::fs::create_dir_all(path_obj)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Utiliser la commande système pour ouvrir l'explorateur Windows
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open explorer: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open finder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialize database
            let app_dir = app.path_resolver()
                .app_data_dir()
                .expect("Failed to get app data directory");

            // Create app directory if it doesn't exist
            std::fs::create_dir_all(&app_dir).expect("Failed to create app directory");

            let db_path = app_dir.join("retrolauncher.db");
            println!("Database path: {:?}", db_path);

            let db = tauri::async_runtime::block_on(async {
                Database::new(&db_path).await.expect("Failed to initialize database")
            });

            app.manage(db);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            launch_game,
            get_games,
            delete_game,
            add_game,
            search_crocdb,
            search_crocdb_advanced,
            get_crocdb_entry,
            get_random_crocdb_entry,
            get_crocdb_platforms,
            get_crocdb_regions,
            get_crocdb_info,
            download_from_crocdb,
            install_game_from_crocdb,
            get_emulators,
            add_emulator,
            get_recommended_emulators,
            install_emulator,
            get_settings,
            update_settings,
            toggle_favorite,
            get_game_stats,
            check_retroarch_status,
            install_retroarch,
            get_retroarch_cores,
            install_retroarch_core,
            get_installed_cores,
            uninstall_all_retroarch_cores,
            install_all_retroarch_cores,
            is_cores_cache_ready,
            open_folder_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
