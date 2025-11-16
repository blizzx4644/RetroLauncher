use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use std::io::Write;
use std::env;
use tauri::Manager;
use futures_util::StreamExt;
use std::time::{Instant, Duration};

const RETROARCH_VERSION: &str = "1.21.0";
const RETROARCH_DOWNLOAD_URL: &str = "https://buildbot.libretro.com/stable/1.21.0/windows/x86_64/RetroArch.7z";
const CORES_BASE_URL: &str = "https://buildbot.libretro.com/stable/1.21.0/windows/x86_64/latest/cores";
const CORES_PACK_URL: &str = "https://buildbot.libretro.com/stable/1.21.0/windows/x86_64/RetroArch_cores.7z";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetroArchStatus {
    pub installed: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetroArchCore {
    pub id: String,
    pub name: String,
    pub platform: String,
    pub platform_name: String,
    pub description: String,
    pub filename: String,
    pub installed: bool,
    pub recommended: bool,
    // Some cores can have alternative filenames in packs (historical or variant builds)
    pub alt_filenames: Option<Vec<String>>,
}

// Get all available cores mapped by platform
pub fn get_available_cores() -> Vec<RetroArchCore> {
    vec![
        // NES
        RetroArchCore {
            id: "nestopia".to_string(),
            name: "Nestopia UE".to_string(),
            platform: "nes".to_string(),
            platform_name: "Nintendo Entertainment System".to_string(),
            description: "Accurate NES emulator".to_string(),
            filename: "nestopia_libretro.dll".to_string(),
            installed: false,
            recommended: true,
            alt_filenames: None,
        },
        RetroArchCore {
            id: "fceumm".to_string(),
            name: "FCEUmm".to_string(),
            platform: "nes".to_string(),
            platform_name: "Nintendo Entertainment System".to_string(),
            description: "Fast and compatible NES emulator".to_string(),
            filename: "fceumm_libretro.dll".to_string(),
            installed: false,
            recommended: false,
            alt_filenames: None,
        },
        // SNES
        RetroArchCore {
            id: "snes9x".to_string(),
            name: "Snes9x".to_string(),
            platform: "snes".to_string(),
            platform_name: "Super Nintendo".to_string(),
            description: "Accurate and fast SNES emulator".to_string(),
            filename: "snes9x_libretro.dll".to_string(),
            installed: false,
            recommended: true,
            alt_filenames: None,
        },
        RetroArchCore {
            id: "bsnes".to_string(),
            name: "bsnes".to_string(),
            platform: "snes".to_string(),
            platform_name: "Super Nintendo".to_string(),
            description: "Cycle-accurate SNES emulator (high CPU usage)".to_string(),
            filename: "bsnes_libretro.dll".to_string(),
            installed: false,
            recommended: false,
            alt_filenames: Some(vec![
                "bsnes_hd_beta_libretro.dll".to_string(),
                "bsnes_mercury_accuracy_libretro.dll".to_string(),
                "bsnes_accuracy_libretro.dll".to_string(),
                "bsnes_mercury_balanced_libretro.dll".to_string(),
                "bsnes_balanced_libretro.dll".to_string(),
            ]),
        },
        // N64
        RetroArchCore {
            id: "mupen64plus_next".to_string(),
            name: "Mupen64Plus-Next".to_string(),
            platform: "n64".to_string(),
            platform_name: "Nintendo 64".to_string(),
            description: "Modern N64 emulator".to_string(),
            filename: "mupen64plus_next_libretro.dll".to_string(),
            installed: false,
            recommended: true,
            alt_filenames: None,
        },
        RetroArchCore {
            id: "parallel_n64".to_string(),
            name: "ParaLLEl N64".to_string(),
            platform: "n64".to_string(),
            platform_name: "Nintendo 64".to_string(),
            description: "Alternative N64 emulator".to_string(),
            filename: "parallel_n64_libretro.dll".to_string(),
            installed: false,
            recommended: false,
            alt_filenames: None,
        },
        // Game Boy / Game Boy Color
        RetroArchCore {
            id: "gambatte".to_string(),
            name: "Gambatte".to_string(),
            platform: "gb".to_string(),
            platform_name: "Game Boy / Game Boy Color".to_string(),
            description: "Accurate GB/GBC emulator".to_string(),
            filename: "gambatte_libretro.dll".to_string(),
            installed: false,
            recommended: true,
            alt_filenames: None,
        },
        RetroArchCore {
            id: "gambatte_gbc".to_string(),
            name: "Gambatte".to_string(),
            platform: "gbc".to_string(),
            platform_name: "Game Boy Color".to_string(),
            description: "Accurate GB/GBC emulator".to_string(),
            filename: "gambatte_libretro.dll".to_string(),
            installed: false,
            recommended: true,
            alt_filenames: None,
        },
        // Game Boy Advance
        RetroArchCore {
            id: "mgba".to_string(),
            name: "mGBA".to_string(),
            platform: "gba".to_string(),
            platform_name: "Game Boy Advance".to_string(),
            description: "Modern and accurate GBA emulator".to_string(),
            filename: "mgba_libretro.dll".to_string(),
            installed: false,
            recommended: true,
            alt_filenames: None,
        },
        RetroArchCore {
            id: "vba_next".to_string(),
            name: "VBA Next".to_string(),
            platform: "gba".to_string(),
            platform_name: "Game Boy Advance".to_string(),
            description: "Fast GBA emulator".to_string(),
            filename: "vba_next_libretro.dll".to_string(),
            installed: false,
            recommended: false,
            alt_filenames: None,
        },
        // Sega Genesis / Mega Drive
        RetroArchCore {
            id: "genesis_plus_gx".to_string(),
            name: "Genesis Plus GX".to_string(),
            platform: "genesis".to_string(),
            platform_name: "Sega Genesis / Mega Drive".to_string(),
            description: "Accurate Genesis/Mega Drive emulator".to_string(),
            filename: "genesis_plus_gx_libretro.dll".to_string(),
            installed: false,
            recommended: true,
            alt_filenames: None,
        },
        RetroArchCore {
            id: "picodrive".to_string(),
            name: "PicoDrive".to_string(),
            platform: "genesis".to_string(),
            platform_name: "Sega Genesis / Mega Drive".to_string(),
            description: "Fast Genesis emulator".to_string(),
            filename: "picodrive_libretro.dll".to_string(),
            installed: false,
            recommended: false,
            alt_filenames: None,
        },
        // PlayStation 1
        RetroArchCore {
            id: "swanstation".to_string(),
            name: "SwanStation".to_string(),
            platform: "ps1".to_string(),
            platform_name: "PlayStation 1".to_string(),
            description: "Modern PS1 emulator with enhancements".to_string(),
            filename: "swanstation_libretro.dll".to_string(),
            installed: false,
            recommended: true,
            alt_filenames: None,
        },
        RetroArchCore {
            id: "beetle_psx_hw".to_string(),
            name: "Beetle PSX HW".to_string(),
            platform: "ps1".to_string(),
            platform_name: "PlayStation 1".to_string(),
            description: "Accurate PS1 emulator with hardware rendering".to_string(),
            filename: "mednafen_psx_hw_libretro.dll".to_string(),
            installed: false,
            recommended: false,
            alt_filenames: None,
        },
        // Sega Master System
        RetroArchCore {
            id: "genesis_plus_gx_sms".to_string(),
            name: "Genesis Plus GX".to_string(),
            platform: "sms".to_string(),
            platform_name: "Sega Master System".to_string(),
            description: "Accurate SMS emulator".to_string(),
            filename: "genesis_plus_gx_libretro.dll".to_string(),
            installed: false,
            recommended: true,
            alt_filenames: None,
        },
        // Atari 2600
        RetroArchCore {
            id: "stella".to_string(),
            name: "Stella".to_string(),
            platform: "atari2600".to_string(),
            platform_name: "Atari 2600".to_string(),
            description: "Atari 2600 emulator".to_string(),
            filename: "stella_libretro.dll".to_string(),
            installed: false,
            recommended: true,
            alt_filenames: None,
        },
    ]
}

// Get cores for a specific platform
pub fn get_cores_for_platform(platform: &str, retroarch_path: &Path) -> Vec<RetroArchCore> {
    let mut cores = get_available_cores()
        .into_iter()
        .filter(|core| core.platform == platform)
        .collect::<Vec<_>>();

    // Check which cores are installed
    let cores_dir = retroarch_path.join("cores");
    for core in cores.iter_mut() {
        let core_path = cores_dir.join(&core.filename);
        core.installed = core_path.exists();
    }

    cores
}

// Get all installed cores
pub fn get_installed_cores(retroarch_path: &Path) -> Vec<RetroArchCore> {
    let mut all_cores = get_available_cores();
    let cores_dir = retroarch_path.join("cores");

    for core in all_cores.iter_mut() {
        let core_path = cores_dir.join(&core.filename);
        core.installed = core_path.exists();
    }

    all_cores.into_iter().filter(|c| c.installed).collect()
}

// Check if RetroArch is installed
pub fn check_retroarch_status(app_dir: &Path) -> RetroArchStatus {
    let retroarch_path = app_dir.join("retroarch");
    let exe_path = retroarch_path.join("retroarch.exe");

    if exe_path.exists() {
        RetroArchStatus {
            installed: true,
            path: Some(exe_path.to_string_lossy().to_string()),
            version: Some(RETROARCH_VERSION.to_string()),
        }
    } else {
        RetroArchStatus {
            installed: false,
            path: None,
            version: None,
        }
    }
}

// Download RetroArch portable
pub async fn download_retroarch(app_dir: &Path, app_handle: Option<&tauri::AppHandle>) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let download_dir = app_dir.join("downloads");
    fs::create_dir_all(&download_dir)?;

    let file_path = download_dir.join("RetroArch.7z");

    println!("Downloading RetroArch from: {}", RETROARCH_DOWNLOAD_URL);

    // Stream download with progress
    let mut resp = reqwest::get(RETROARCH_DOWNLOAD_URL).await?;
    let total = resp.content_length().unwrap_or(0);
    let mut file = fs::File::create(&file_path)?;
    let mut downloaded: u64 = 0;
    let start = Instant::now();
    let mut last_emit = Instant::now();
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let data = chunk?;
        file.write_all(&data)?;
        downloaded += data.len() as u64;
        if last_emit.elapsed() >= Duration::from_millis(120) {
            if let Some(handle) = app_handle {
                let speed_bps = (downloaded as f64 / start.elapsed().as_secs_f64().max(0.001)) as f64;
                let pct = if total > 0 { (downloaded as f32 / total as f32) * 100.0 } else { 0.0 };
                let _ = handle.emit_all("download-progress", serde_json::json!({
                    "slug": "retroarch",
                    "stage": "downloading_retroarch",
                    "progress": pct,
                    "message": "Downloading RetroArch...",
                    "bytesReceived": downloaded,
                    "totalBytes": total,
                    "speedBps": speed_bps,
                    "title": "RetroArch",
                }));
            }
            last_emit = Instant::now();
        }
    }

    println!("Downloaded RetroArch to: {:?}", file_path);

    Ok(file_path)
}

// Extract RetroArch using 7z
pub fn extract_retroarch(archive_path: &Path, app_dir: &Path, app_handle: Option<&tauri::AppHandle>) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let extract_dir = app_dir.join("retroarch");

    // Remove existing installation
    if extract_dir.exists() {
        fs::remove_dir_all(&extract_dir)?;
    }

    fs::create_dir_all(&extract_dir)?;

    println!("Extracting RetroArch to: {:?}", extract_dir);

    // Use sevenz_rust crate to extract
    if let Some(handle) = app_handle { let _ = handle.emit_all("download-progress", serde_json::json!({
        "slug": "retroarch",
        "stage": "extracting_retroarch",
        "progress": 10.0,
        "message": "Extracting RetroArch...",
        "title": "RetroArch",
    })); }
    sevenz_rust::decompress_file(archive_path, &extract_dir)
        .map_err(|e| format!("Failed to extract 7z archive: {}", e))?;

    // The archive extracts to a "RetroArch-Win64" subdirectory, move contents up
    let inner_dir = extract_dir.join("RetroArch-Win64");
    if inner_dir.exists() {
        // Move all files from inner_dir to extract_dir
        for entry in fs::read_dir(&inner_dir)? {
            let entry = entry?;
            let src = entry.path();
            let dst = extract_dir.join(entry.file_name());

            if src.is_dir() {
                copy_dir_all(&src, &dst)?;
                fs::remove_dir_all(&src)?;
            } else {
                fs::copy(&src, &dst)?;
                fs::remove_file(&src)?;
            }
        }
        fs::remove_dir(&inner_dir)?;
    }

    if let Some(handle) = app_handle { let _ = handle.emit_all("download-progress", serde_json::json!({
        "slug": "retroarch",
        "stage": "completed",
        "progress": 100.0,
        "message": "RetroArch installed",
        "title": "RetroArch",
    })); }

    Ok(extract_dir)
}

// Download the official cores pack (contains all cores) into app downloads dir
async fn download_cores_pack(app_dir: &Path, app_handle: Option<&tauri::AppHandle>) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let download_dir = app_dir.join("downloads");
    fs::create_dir_all(&download_dir)?;
    let archive_path = download_dir.join("RetroArch_cores.7z");

    // If pack already exists, skip download
    if archive_path.exists() {
        println!("Cores pack already downloaded, reusing: {:?}", archive_path);
        return Ok(archive_path);
    }

    println!("Downloading RetroArch cores pack from: {}", CORES_PACK_URL);
    let mut resp = reqwest::get(CORES_PACK_URL).await?;
    if !resp.status().is_success() {
        return Err(format!("Failed to download cores pack (HTTP {}): {}", resp.status(), CORES_PACK_URL).into());
    }
    let total = resp.content_length().unwrap_or(0);
    let mut f = fs::File::create(&archive_path)?;
    let mut downloaded: u64 = 0;
    let start = Instant::now();
    let mut last_emit = Instant::now();
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let data = chunk?;
        f.write_all(&data)?;
        downloaded += data.len() as u64;
        if last_emit.elapsed() >= Duration::from_millis(150) {
            if let Some(handle) = app_handle {
                let speed_bps = (downloaded as f64 / start.elapsed().as_secs_f64().max(0.001)) as f64;
                let pct = if total > 0 { (downloaded as f32 / total as f32) * 100.0 } else { 0.0 };
                let _ = handle.emit_all("download-progress", serde_json::json!({
                    "slug": "cores_pack",
                    "stage": "downloading_cores",
                    "progress": pct,
                    "message": "Downloading cores pack...",
                    "bytesReceived": downloaded,
                    "totalBytes": total,
                    "speedBps": speed_bps,
                    "title": "RetroArch Cores",
                }));
            }
            last_emit = Instant::now();
        }
    }
    println!("Cores pack downloaded successfully");
    Ok(archive_path)
}

// Ensure cores pack is extracted once into an application cache directory and return that path
fn ensure_cores_cache_extracted(app_dir: &Path) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let cache_dir = app_dir.join("cache").join("retroarch_cores");
    let marker = cache_dir.join(".extracted");
    if marker.exists() {
        return Ok(cache_dir);
    }
    fs::create_dir_all(&cache_dir)?;

    // Download pack (cached in downloads by download_cores_pack)
    // Note: download_cores_pack is async; call it from async context and pass the path here.
    // This function only extracts when called from install_core after download.
    // Perform extraction
    // Safety: If extraction partially existed, we clear it to avoid mixed state
    if cache_dir.exists() {
        // keep dir but ensure it's clean enough for extraction; sevenz_rust writes files anyway
    }
    Ok(cache_dir)
}

// Extract all cores from the official pack directly into retroarch/cores
fn extract_cores_pack(archive_path: &Path, retroarch_path: &Path, app_handle: Option<&tauri::AppHandle>) -> Result<(), Box<dyn std::error::Error>> {
    let cores_dir = retroarch_path.join("cores");
    fs::create_dir_all(&cores_dir)?;
    println!("Extracting cores pack to: {:?}", cores_dir);
    // The 7z file contains many DLLs; extract into cores directory
    sevenz_rust::decompress_file(archive_path, &cores_dir)
        .map_err(|e| format!("Failed to extract cores pack: {}", e))?;
    if let Some(handle) = app_handle { let _ = handle.emit_all("download-progress", serde_json::json!({
        "slug": "cores_pack",
        "stage": "completed",
        "progress": 100.0,
        "message": "Cores pack extracted",
        "title": "RetroArch Cores",
    })); }
    Ok(())
}

// Download and install a core
pub async fn install_core(core_id: &str, retroarch_path: &Path, app_handle: Option<&tauri::AppHandle>) -> Result<String, Box<dyn std::error::Error>> {
    let cores = get_available_cores();
    // Try to find in predefined list first
    let predefined = cores.iter().find(|c| c.id == core_id).cloned();

    // Build a core descriptor even if not predefined
    let core: RetroArchCore = if let Some(core) = predefined {
        core
    } else {
        // Fallback: infer from id (detected cores from Ressource/)
        let filename = format!("{}_libretro.dll", core_id);
        let (platform, platform_name, base_desc) = detect_platform_from_core_name(core_id);
        RetroArchCore {
            id: core_id.to_string(),
            name: core_id.replace('_', " "),
            platform: platform.to_string(),
            platform_name: platform_name.to_string(),
            description: format!("{} - {}", base_desc, core_id.replace('_', " ")),
            filename,
            installed: false,
            recommended: false,
            alt_filenames: None,
        }
    };

    let cores_dir = retroarch_path.join("cores");
    fs::create_dir_all(&cores_dir)?;

    // If already installed, return early
    let target_core_path = cores_dir.join(&core.filename);
    if target_core_path.exists() {
        return Ok(format!("Core {} already installed", core.name));
    }

    // Try individual core zip first (some cores may still be accessible this way)
    let core_zip_url = format!("{}/{}.zip", CORES_BASE_URL, core.filename);
    println!("Attempting individual core download: {}", core_zip_url);
    let try_individual = reqwest::get(&core_zip_url).await;
    let mut used_pack = false;
    if let Ok(resp) = try_individual {
        if resp.status().is_success() {
            // stream the individual core zip and emit progress
            let total = resp.content_length().unwrap_or(0);
            let mut stream = resp.bytes_stream();
            let temp_zip = cores_dir.join(format!("{}.zip", core.id));
            let mut f = fs::File::create(&temp_zip)?;
            let mut downloaded: u64 = 0;
            let start = Instant::now();
            let mut last_emit = Instant::now();
            while let Some(chunk) = stream.next().await {
                let data = chunk?;
                f.write_all(&data)?;
                downloaded += data.len() as u64;
                if last_emit.elapsed() >= Duration::from_millis(120) {
                    if let Some(handle) = app_handle {
                        let speed_bps = (downloaded as f64 / start.elapsed().as_secs_f64().max(0.001)) as f64;
                        let pct = if total > 0 { (downloaded as f32 / total as f32) * 100.0 } else { 0.0 };
                        let _ = handle.emit_all("download-progress", serde_json::json!({
                            "slug": format!("core:{}", core.id),
                            "stage": "downloading_core",
                            "progress": pct,
                            "message": format!("Downloading core {}...", core.name),
                            "bytesReceived": downloaded,
                            "totalBytes": total,
                            "speedBps": speed_bps,
                            "title": format!("Core {}", core.name),
                        }));
                    }
                    last_emit = Instant::now();
                }
            }
            // Extract dll from the zip
            let zip_file = fs::File::open(&temp_zip)?;
            let mut archive = zip::ZipArchive::new(zip_file)?;
            let mut extracted = false;
            for i in 0..archive.len() {
                let mut zf = archive.by_index(i)?;
                let name = zf.name().to_string();
                if name.to_lowercase().ends_with(".dll") {
                    println!("Found DLL in individual core zip: {}", name);
                    let mut out = fs::File::create(&target_core_path)?;
                    std::io::copy(&mut zf, &mut out)?;
                    extracted = true;
                    break;
                }
            }
            fs::remove_file(&temp_zip).ok();
            if extracted {
                println!("Installed core via individual zip: {:?}", target_core_path);
                if let Some(handle) = app_handle { let _ = handle.emit_all("download-progress", serde_json::json!({
                    "slug": format!("core:{}", core.id),
                    "stage": "completed",
                    "progress": 100.0,
                    "message": format!("Core {} installed", core.name),
                    "title": format!("Core {}", core.name),
                })); }
                return Ok(format!("Core {} installed successfully", core.name));
            } else {
                // No DLL in zip -> fallback to pack
                println!("No DLL found in individual core zip, falling back to cores pack");
                used_pack = true;
            }
        } else {
            used_pack = true; // fallback to pack
        }
    } else {
        used_pack = true; // network error on individual, try pack
    }

    // Fallback: download and reuse the official cores pack, then copy the single DLL needed
    if used_pack {
        // Prepare cache once
        let app_dir = retroarch_path.parent().ok_or("Invalid retroarch path")?;
        let _cache_dir = prepare_cores_cache(app_dir, app_handle).await?;
    }

    // After extraction (or if pack already cached), the DLL may be inside a subfolder.
    // Look for it inside the cache and copy to cores directory.
    if !target_core_path.exists() {
        let _ = install_core_from_cache(&core, retroarch_path)?;
    }

    if target_core_path.exists() {
        println!("Installed core file at: {:?}", target_core_path);
        if let Some(handle) = app_handle { let _ = handle.emit_all("download-progress", serde_json::json!({
            "slug": format!("core:{}", core.id),
            "stage": "completed",
            "progress": 100.0,
            "message": format!("Core {} installed", core.name),
            "title": format!("Core {}", core.name),
        })); }
        Ok(format!("Core {} installed successfully", core.name))
    } else {
        Err(format!(
            "Failed to install core '{}'. File '{}' not found in cache/cores/resources. See logs for details.",
            core.name, core.filename
        ).into())
    }
}

// Prepare cores cache: download and extract the cores pack once, with events
pub async fn prepare_cores_cache(app_dir: &Path, app_handle: Option<&tauri::AppHandle>) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let pack_path = download_cores_pack(app_dir, app_handle).await?;
    let cache_dir = ensure_cores_cache_extracted(app_dir)?;
    let cache_marker = cache_dir.join(".extracted");
    if !cache_marker.exists() {
        if let Some(handle) = app_handle { let _ = handle.emit_all("download-progress", serde_json::json!({
            "slug": "cores_pack",
            "stage": "extracting_cores",
            "progress": 5.0,
            "message": "Extracting cores pack...",
            "title": "RetroArch Cores",
        })); }
        sevenz_rust::decompress_file(&pack_path, &cache_dir)
            .map_err(|e| format!("Failed to extract cores pack to cache: {}", e))?;
        let mut f = fs::File::create(&cache_marker)?;
        f.write_all(b"ok")?;
        if let Some(handle) = app_handle { let _ = handle.emit_all("download-progress", serde_json::json!({
            "slug": "cores_pack",
            "stage": "completed",
            "progress": 100.0,
            "message": "Cores pack ready",
            "title": "RetroArch Cores",
        })); }
    }
    Ok(cache_dir)
}

// Try to install a core by copying from cache/resources into retroarch/cores. Returns true if copied.
pub fn install_core_from_cache(core: &RetroArchCore, retroarch_path: &Path) -> Result<bool, Box<dyn std::error::Error>> {
    let cores_dir = retroarch_path.join("cores");
    let target_core_path = cores_dir.join(&core.filename);
    if target_core_path.exists() {
        return Ok(true);
    }
    let app_dir = retroarch_path.parent().ok_or("Invalid retroarch path")?;
    let cache_dir = app_dir.join("cache").join("retroarch_cores");
    let mut candidates = vec![core.filename.clone()];
    if let Some(alts) = &core.alt_filenames { candidates.extend(alts.clone()); }
    if let Some(found) = find_any_file_recursive(&cache_dir, &candidates)
        .or_else(|| get_resource_cores_dir().as_ref().and_then(|r| find_any_file_recursive(r, &candidates))) {
        fs::create_dir_all(&cores_dir)?;
        fs::copy(found, &target_core_path)?;
        return Ok(true);
    }
    Ok(false)
}

// Get recommended core for a platform
pub fn get_recommended_core_for_platform(platform: &str) -> Option<String> {
    let cores = get_available_cores();
    cores.iter()
        .find(|c| c.platform == platform && c.recommended)
        .map(|c| c.id.clone())
}

// Get any installed core for a platform (preferred: recommended, fallback: any)
pub fn get_any_installed_core_for_platform(platform: &str, retroarch_path: &Path) -> Option<RetroArchCore> {
    // Use full detection (predefined + detected in cores dir)
    let mut cores = get_all_cores_with_detection(retroarch_path)
        .into_iter()
        .filter(|c| c.platform == platform && c.installed)
        .collect::<Vec<_>>();

    // Prefer recommended among installed
    if let Some(core) = cores.iter().find(|c| c.recommended) {
        return Some(core.clone());
    }

    // Fallback to any installed
    cores.into_iter().next()
}

// Helper function to detect platform from core name
fn detect_platform_from_core_name(core_name: &str) -> (&str, &str, &str) {
    // Returns (platform_id, platform_name, description)
    let name_lower = core_name.to_lowercase();

    // NES cores
    if name_lower.contains("fceumm") || name_lower.contains("nestopia") ||
       name_lower.contains("quicknes") || name_lower.contains("mesen") {
        return ("nes", "Nintendo Entertainment System", "NES emulator core");
    }

    // SNES cores
    if name_lower.contains("snes9x") || name_lower.contains("bsnes") ||
       name_lower.contains("mednafen_snes") || name_lower.contains("mesen-s") {
        return ("snes", "Super Nintendo", "SNES emulator core");
    }

    // N64 cores
    if name_lower.contains("mupen64") || name_lower.contains("parallel_n64") {
        return ("n64", "Nintendo 64", "N64 emulator core");
    }

    // GameBoy/GBC cores
    if name_lower.contains("gambatte") || name_lower.contains("sameboy") ||
       name_lower.contains("gearboy") || name_lower.contains("tgbdual") {
        return ("gb", "Game Boy / Game Boy Color", "GB/GBC emulator core");
    }

    // GBA cores
    if name_lower.contains("mgba") || name_lower.contains("vba") ||
       name_lower.contains("gpsp") || name_lower.contains("mednafen_gba") {
        return ("gba", "Game Boy Advance", "GBA emulator core");
    }

    // Genesis/Mega Drive cores
    if name_lower.contains("genesis_plus_gx") || name_lower.contains("picodrive") ||
       name_lower.contains("blastem") {
        return ("genesis", "Sega Genesis / Mega Drive", "Genesis/MD emulator core");
    }

    // Master System cores
    if name_lower.contains("gearsystem") || name_lower.contains("picodrive") ||
       name_lower.contains("smsplus") {
        return ("sms", "Sega Master System", "SMS emulator core");
    }

    // PS1 cores
    if name_lower.contains("mednafen_psx") || name_lower.contains("pcsx_rearmed") ||
       name_lower.contains("swanstation") || name_lower.contains("beetle_psx") {
        return ("ps1", "PlayStation 1", "PS1 emulator core");
    }

    // PS2 cores
    if name_lower.contains("pcsx2") || name_lower.contains("play") {
        return ("ps2", "PlayStation 2", "PS2 emulator core");
    }

    // PSP cores
    if name_lower.contains("ppsspp") {
        return ("psp", "PlayStation Portable", "PSP emulator core");
    }

    // Nintendo DS cores
    if name_lower.contains("desmume") || name_lower.contains("melonds") {
        return ("nds", "Nintendo DS", "DS emulator core");
    }

    // 3DS cores
    if name_lower.contains("citra") || name_lower.contains("panda3ds") {
        return ("3ds", "Nintendo 3DS", "3DS emulator core");
    }

    // GameCube/Wii cores
    if name_lower.contains("dolphin") {
        return ("gc", "GameCube / Wii", "GameCube/Wii emulator core");
    }

    // Dreamcast cores
    if name_lower.contains("flycast") {
        return ("dreamcast", "Sega Dreamcast", "Dreamcast emulator core");
    }

    // Saturn cores
    if name_lower.contains("mednafen_saturn") || name_lower.contains("yabause") ||
       name_lower.contains("yabasanshiro") || name_lower.contains("kronos") {
        return ("saturn", "Sega Saturn", "Saturn emulator core");
    }

    // Atari 2600 cores
    if name_lower.contains("stella") || name_lower.contains("prosystem") {
        return ("atari2600", "Atari 2600", "Atari 2600 emulator core");
    }

    // Atari 5200/7800 cores
    if name_lower.contains("a5200") || name_lower.contains("prosystem") {
        return ("atari7800", "Atari 5200/7800", "Atari emulator core");
    }

    // Lynx cores
    if name_lower.contains("lynx") || name_lower.contains("handy") {
        return ("lynx", "Atari Lynx", "Lynx emulator core");
    }

    // Neo Geo cores
    if name_lower.contains("neocd") || name_lower.contains("geolith") ||
       name_lower.contains("fbneo") || name_lower.contains("fbalpha") {
        return ("neogeo", "Neo Geo", "Neo Geo emulator core");
    }

    // Arcade cores
    if name_lower.contains("mame") || name_lower.contains("fbneo") ||
       name_lower.contains("fbalpha") {
        return ("arcade", "Arcade", "Arcade emulator core");
    }

    // DOS cores
    if name_lower.contains("dosbox") {
        return ("dos", "MS-DOS", "DOS emulator core");
    }

    // PC Engine/TurboGrafx cores
    if name_lower.contains("mednafen_pce") || name_lower.contains("mednafen_supergrafx") {
        return ("pce", "PC Engine / TurboGrafx-16", "PC Engine emulator core");
    }

    // WonderSwan cores
    if name_lower.contains("mednafen_wswan") {
        return ("wonderswan", "WonderSwan", "WonderSwan emulator core");
    }

    // Virtual Boy cores
    if name_lower.contains("mednafen_vb") {
        return ("virtualboy", "Virtual Boy", "Virtual Boy emulator core");
    }

    // Atari 800 cores
    if name_lower.contains("atari800") {
        return ("atari800", "Atari 8-bit", "Atari 800 emulator core");
    }

    // Amiga cores
    if name_lower.contains("puae") {
        return ("amiga", "Commodore Amiga", "Amiga emulator core");
    }

    // C64 cores
    if name_lower.contains("vice") {
        return ("c64", "Commodore 64", "C64 emulator core");
    }

    // MSX cores
    if name_lower.contains("bluemsx") || name_lower.contains("fmsx") {
        return ("msx", "MSX", "MSX emulator core");
    }

    // Jaguar cores
    if name_lower.contains("virtualjaguar") {
        return ("jaguar", "Atari Jaguar", "Jaguar emulator core");
    }

    // 3DO cores
    if name_lower.contains("opera") {
        return ("3do", "3DO", "3DO emulator core");
    }

    // CD-i cores
    if name_lower.contains("cdi") || name_lower.contains("same_cdi") {
        return ("cdi", "Philips CD-i", "CD-i emulator core");
    }

    // Vectrex cores
    if name_lower.contains("vecx") {
        return ("vectrex", "Vectrex", "Vectrex emulator core");
    }

    // Game & Watch cores
    if name_lower.contains("gw_libretro") {
        return ("gameandwatch", "Game & Watch", "Game & Watch emulator core");
    }

    // Default: Unknown
    ("unknown", "Multiple Platforms", "Multi-platform core")
}

// Scan the cores directory and detect all installed cores (even unknown ones)
pub fn scan_installed_cores_from_directory(cores_path: &Path, mark_as_installed: bool) -> Vec<RetroArchCore> {
    let cores_dir = cores_path.join("cores");
    let mut detected_cores = Vec::new();

    if !cores_dir.exists() {
        return detected_cores;
    }

    // Read all .dll files in the cores directory
    if let Ok(entries) = std::fs::read_dir(&cores_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("dll") {
                if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                    // Extract core name from filename (remove _libretro.dll)
                    let core_id = filename.replace("_libretro.dll", "");
                    let core_name = core_id.replace("_", " ");

                    // Check if this core is already in our predefined list
                    let all_cores = get_available_cores();
                    let is_known = all_cores.iter().any(|c| c.filename == filename);

                    if !is_known {
                        // Detect platform from core name
                        let (platform, platform_name, base_desc) = detect_platform_from_core_name(&core_id);

                        // Create a core entry for detected cores
                        detected_cores.push(RetroArchCore {
                            id: core_id.clone(),
                            name: core_name.clone(),
                            platform: platform.to_string(),
                            platform_name: platform_name.to_string(),
                            description: format!("{} - {}", base_desc, core_name),
                            filename: filename.to_string(),
                            installed: mark_as_installed,
                            recommended: false,
                            alt_filenames: None,
                        });
                    }
                }
            }
        }
    }

    detected_cores
}

// Get all cores (predefined + detected from directory)
pub fn get_all_cores_with_detection(retroarch_path: &Path) -> Vec<RetroArchCore> {
    let mut all_cores = get_available_cores();

    // Mark installed cores
    for core in &mut all_cores {
        core.installed = is_core_installed(retroarch_path, core);
    }

    // Add detected cores that aren't in the predefined list
    let detected = scan_installed_cores_from_directory(retroarch_path, true);
    all_cores.extend(detected);

    all_cores
}

// Get all cores including from resource directory (for UI display)
pub fn get_all_cores_with_detection_and_resource(retroarch_path: &Path, resource_path: Option<&Path>) -> Vec<RetroArchCore> {
    let mut all_cores = get_all_cores_with_detection(retroarch_path);

    // Add cores from resource directory (mark as NOT installed - they're just available)
    if let Some(res_path) = resource_path {
        let detected_resource = scan_installed_cores_from_directory(res_path, false);

        // Merge, avoiding duplicates
        for resource_core in detected_resource {
            if !all_cores.iter().any(|c| c.id == resource_core.id) {
                all_cores.push(resource_core);
            }
        }
    }

    all_cores
}

// Helper function to check if a core is installed
pub fn is_core_installed(retroarch_path: &Path, core: &RetroArchCore) -> bool {
    let cores_dir = retroarch_path.join("cores");
    let core_path = cores_dir.join(&core.filename);
    if core_path.exists() {
        return true;
    }
    if let Some(alts) = &core.alt_filenames {
        for alt in alts {
            if cores_dir.join(alt).exists() {
                return true;
            }
        }
    }
    false
}

// Recursively search a directory for any of the candidate filenames
fn find_any_file_recursive(root: &Path, candidates: &[String]) -> Option<PathBuf> {
    if !root.exists() { return None; }
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        if let Ok(read) = fs::read_dir(&dir) {
            for entry in read.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    stack.push(path);
                } else if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
                    for cand in candidates {
                        if name.eq_ignore_ascii_case(cand) {
                            return Some(path);
                        }
                    }
                }
            }
        }
    }
    None
}

// Uninstall all cores by removing all DLLs from retroarch/cores. Optionally remove the extracted cache.
pub fn uninstall_all_cores(retroarch_path: &Path, remove_cache: bool) -> Result<usize, Box<dyn std::error::Error>> {
    let cores_dir = retroarch_path.join("cores");
    let mut removed = 0usize;
    if cores_dir.exists() {
        if let Ok(entries) = fs::read_dir(&cores_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("dll") {
                    fs::remove_file(&path).ok();
                    removed += 1;
                }
            }
        }
    }

    if remove_cache {
        if let Some(app_dir) = retroarch_path.parent() {
            let cache_dir = app_dir.join("cache").join("retroarch_cores");
            if cache_dir.exists() {
                let _ = fs::remove_dir_all(&cache_dir);
            }
        }
    }

    Ok(removed)
}

// Helper to copy directories recursively
fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}

// Try to locate a local resources cores directory (useful for offline installs)
fn get_resource_cores_dir() -> Option<PathBuf> {
    // Strategy: start from current executable directory and probe typical locations
    if let Ok(exe) = env::current_exe() {
        let mut cur = exe.parent().map(|p| p.to_path_buf());
        // Walk up a few levels to find project root containing 'Ressource/RetroArch-Win64/cores'
        for _ in 0..5 {
            if let Some(dir) = &cur {
                let candidate = dir.join("Ressource").join("RetroArch-Win64").join("cores");
                if candidate.exists() {
                    return Some(candidate);
                }
                cur = dir.parent().map(|p| p.to_path_buf());
            }
        }
    }
    None
}
