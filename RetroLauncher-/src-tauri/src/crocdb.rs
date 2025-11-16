use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::{Write};
use std::path::Path;
use tauri::Manager;

const CROCDB_API_BASE: &str = "https://api.crocdb.net";

// ============================================================================
// API Response Structures
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub info: HashMap<String, serde_json::Value>,
    pub data: T,
}

// ============================================================================
// Entry/Game Structures
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrocDBEntry {
    pub slug: String,
    pub rom_id: Option<String>,
    pub title: String,
    pub platform: String,
    pub boxart_url: Option<String>,
    pub regions: Vec<String>,
    pub links: Vec<CrocDBLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrocDBLink {
    pub name: String,
    #[serde(rename = "type")]
    pub link_type: String,
    pub format: String,
    pub url: String,
    pub filename: String,
    pub host: String,
    pub size: i64,
    pub size_str: String,
    pub source_url: String,
}

// Simplified structure for frontend consumption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrocDBGame {
    pub slug: String,
    pub id: Option<String>,
    pub title: String,
    pub platform: String,
    pub platform_name: Option<String>,
    pub description: Option<String>,
    pub cover_url: Option<String>,
    pub regions: Vec<String>,
    pub download_links: Vec<DownloadLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadLink {
    pub name: String,
    pub format: String,
    pub url: String,
    pub filename: String,
    pub size: i64,
    pub size_str: String,
    pub host: String,
}

// ============================================================================
// Platform & Region Structures
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformInfo {
    pub brand: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformsData {
    pub platforms: HashMap<String, PlatformInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegionsData {
    pub regions: HashMap<String, String>,
}

// ============================================================================
// Search Structures
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platforms: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub regions: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rom_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_results: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<i32>,
}

// Raw structure for deserializing API response (contains CrocDBEntry with "links")
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SearchResultsDataRaw {
    pub results: Vec<CrocDBEntry>,
    pub current_results: i32,
    pub total_results: i32,
    pub current_page: i32,
    pub total_pages: i32,
}

// Converted structure for frontend (contains CrocDBGame with "download_links")
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultsData {
    pub results: Vec<CrocDBGame>,
    pub current_results: i32,
    pub total_results: i32,
    pub current_page: i32,
    pub total_pages: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryData {
    pub entry: CrocDBEntry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseInfo {
    pub total_entries: i64,
}

// ============================================================================
// API Functions
// ============================================================================

/// Search for games in CrocDB
pub async fn search_games(query: &str) -> Result<Vec<CrocDBGame>, Box<dyn std::error::Error>> {
    println!("🔍 CrocDB: Searching for '{}'", query);

    let client = reqwest::Client::new();

    let search_request = SearchRequest {
        search_key: Some(query.to_string()),
        platforms: None,
        regions: None,
        rom_id: None,
        max_results: Some(50),
        page: Some(1),
    };

    println!("📤 CrocDB: Sending request to {}/search", CROCDB_API_BASE);

    let response = client
        .post(format!("{}/search", CROCDB_API_BASE))
        .json(&search_request)
        .send()
        .await?;

    let status = response.status();
    println!("📥 CrocDB: Response status: {}", status);

    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        eprintln!("❌ CrocDB: API error: {} - {}", status, error_text);
        return Err(format!("API error: {}", status).into());
    }

    let response_text = response.text().await?;
    println!("📄 CrocDB: Response length: {} bytes", response_text.len());

    let api_response: ApiResponse<SearchResultsDataRaw> = serde_json::from_str(&response_text)
        .map_err(|e| {
            eprintln!("❌ CrocDB: JSON parse error: {}", e);
            eprintln!("📄 Response preview: {}", &response_text[..response_text.len().min(500)]);
            e
        })?;

    println!("✅ CrocDB: Found {} results", api_response.data.results.len());

    // Convert CrocDBEntry to CrocDBGame for easier frontend consumption
    let games: Vec<CrocDBGame> = api_response.data.results
        .into_iter()
        .map(|entry| {
            let game = entry_to_game(entry);
            println!("  📦 Game: {} ({})", game.title, game.platform);
            game
        })
        .collect();

    println!("🎯 CrocDB: Returning {} games", games.len());
    Ok(games)
}

/// Search with advanced filters
pub async fn search_games_advanced(
    search_key: Option<String>,
    platforms: Option<Vec<String>>,
    regions: Option<Vec<String>>,
    max_results: Option<i32>,
    page: Option<i32>,
) -> Result<SearchResultsData, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    let search_request = SearchRequest {
        search_key,
        platforms,
        regions,
        rom_id: None,
        max_results,
        page,
    };

    let response = client
        .post(format!("{}/search", CROCDB_API_BASE))
        .json(&search_request)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()).into());
    }

    // Deserialize to raw structure (CrocDBEntry with "links")
    let api_response: ApiResponse<SearchResultsDataRaw> = response.json().await?;

    // Convert CrocDBEntry to CrocDBGame (links → download_links)
    let converted_results: Vec<CrocDBGame> = api_response.data.results
        .into_iter()
        .map(entry_to_game)
        .collect();

    // Return converted structure
    Ok(SearchResultsData {
        results: converted_results,
        current_results: api_response.data.current_results,
        total_results: api_response.data.total_results,
        current_page: api_response.data.current_page,
        total_pages: api_response.data.total_pages,
    })
}

/// Get a specific game entry by slug
pub async fn get_entry(slug: &str) -> Result<CrocDBGame, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    let request_body = serde_json::json!({ "slug": slug });

    let response = client
        .post(format!("{}/entry", CROCDB_API_BASE))
        .json(&request_body)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()).into());
    }

    let api_response: ApiResponse<EntryData> = response.json().await?;
    Ok(entry_to_game(api_response.data.entry))
}

/// Get a random game entry
pub async fn get_random_entry() -> Result<CrocDBGame, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    let response = client
        .get(format!("{}/entry/random", CROCDB_API_BASE))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()).into());
    }

    let api_response: ApiResponse<EntryData> = response.json().await?;
    Ok(entry_to_game(api_response.data.entry))
}

/// Get all available platforms
pub async fn get_platforms() -> Result<HashMap<String, PlatformInfo>, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    let response = client
        .get(format!("{}/platforms", CROCDB_API_BASE))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()).into());
    }

    let api_response: ApiResponse<PlatformsData> = response.json().await?;
    Ok(api_response.data.platforms)
}

/// Get all available regions
pub async fn get_regions() -> Result<HashMap<String, String>, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    let response = client
        .get(format!("{}/regions", CROCDB_API_BASE))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()).into());
    }

    let api_response: ApiResponse<RegionsData> = response.json().await?;
    Ok(api_response.data.regions)
}

/// Get database information
pub async fn get_database_info() -> Result<DatabaseInfo, Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();

    let response = client
        .get(format!("{}/info", CROCDB_API_BASE))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()).into());
    }

    let api_response: ApiResponse<DatabaseInfo> = response.json().await?;
    Ok(api_response.data)
}

// ============================================================================
// Download Functions
// ============================================================================

/// Stream download with progress events (bytes, total, speed)
async fn stream_download_with_progress(
    url: &str,
    destination: &str,
    slug: &str,
    stage: &str,
    app_handle: Option<&tauri::AppHandle>,
) -> Result<String, Box<dyn std::error::Error>> {
    use futures_util::StreamExt;
    use std::time::{Instant, Duration};

    let client = reqwest::Client::new();
    let mut response = client.get(url).send().await?;
    if !response.status().is_success() {
        return Err(format!("Download failed: {}", response.status()).into());
    }

    // Ensure parent directory exists
    if let Some(parent) = Path::new(destination).parent() {
        std::fs::create_dir_all(parent)?;
    }

    let total = response
        .content_length()
        .unwrap_or(0);
    let mut file = File::create(destination)?;
    let mut downloaded: u64 = 0;
    let mut last_emit = Instant::now();
    let mut window_downloaded: u64 = 0;

    let mut stream = response.bytes_stream();
    let start = Instant::now();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        file.write_all(&chunk)?;
        downloaded += chunk.len() as u64;
        window_downloaded += chunk.len() as u64;

        // Emit every ~120ms to avoid flooding
        if last_emit.elapsed() >= Duration::from_millis(120) {
            let elapsed = start.elapsed().as_secs_f64().max(0.001);
            let speed_bps = (downloaded as f64 / elapsed) as f64;
            let pct = if total > 0 { (downloaded as f32 / total as f32) * 100.0 } else { 0.0 };
            if let Some(handle) = app_handle {
                let _ = handle.emit_all("download-progress", serde_json::json!({
                    "slug": slug,
                    "stage": stage,
                    "progress": pct,
                    "message": format!("Downloading..."),
                    "bytesReceived": downloaded,
                    "totalBytes": total,
                    "speedBps": speed_bps,
                }));
            }
            window_downloaded = 0;
            last_emit = Instant::now();
        }
    }

    // Final emit 100%
    if let Some(handle) = app_handle {
        let _ = handle.emit_all("download-progress", serde_json::json!({
            "slug": slug,
            "stage": stage,
            "progress": 100.0,
            "message": "Download complete",
            "bytesReceived": downloaded,
            "totalBytes": total,
            "speedBps": 0.0,
        }));
    }

    Ok(destination.to_string())
}

/// Download a game from CrocDB by slug (downloads the first available link)
pub async fn download_game(
    slug: &str,
    destination_dir: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    let game = get_entry(slug).await?;

    if game.download_links.is_empty() {
        return Err("No download links available for this game".into());
    }

    // Use the first download link
    let link = &game.download_links[0];
    let destination_path = Path::new(destination_dir)
        .join(&game.platform)
        .join(sanitize_filename(&game.title));
    let destination = destination_path.to_string_lossy().to_string();

    stream_download_with_progress(
        &link.url,
        &destination,
        slug,
        "downloading",
        None,
    ).await?;

    Ok(destination)
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Convert CrocDBEntry to CrocDBGame
fn entry_to_game(entry: CrocDBEntry) -> CrocDBGame {
    let download_links: Vec<DownloadLink> = entry.links
        .into_iter()
        .map(|link| DownloadLink {
            name: link.name,
            format: link.format,
            url: link.url,
            filename: link.filename,
            size: link.size,
            size_str: link.size_str,
            host: link.host,
        })
        .collect();

    CrocDBGame {
        slug: entry.slug,
        id: entry.rom_id,
        title: entry.title,
        platform: entry.platform.clone(),
        platform_name: None, // Can be enriched with platform info if needed
        description: None,   // CrocDB API doesn't provide descriptions in entries
        cover_url: entry.boxart_url,
        regions: entry.regions,
        download_links,
    }
}

/// Helper to extract ROM from compressed archives (ZIP)
pub async fn extract_rom(
    archive_path: &str,
    destination: &str,
) -> Result<String, Box<dyn std::error::Error>> {
    use std::fs::File;
    use std::io::BufReader;
    use zip::ZipArchive;

    let file = File::open(archive_path)?;
    let reader = BufReader::new(file);
    let mut archive = ZipArchive::new(reader)?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let outpath = Path::new(destination).join(file.name());

        if file.name().ends_with('/') {
            std::fs::create_dir_all(&outpath)?;
        } else {
            if let Some(p) = outpath.parent() {
                std::fs::create_dir_all(p)?;
            }
            let mut outfile = File::create(&outpath)?;
            std::io::copy(&mut file, &mut outfile)?;
        }
    }

    Ok(destination.to_string())
}

/// Install a game completely: download, extract, and prepare for library
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallResult {
    pub rom_path: String,
    pub cover_path: Option<String>,
    pub title: String,
    pub platform: String,
    pub slug: String,
}

pub async fn install_game_complete(
    slug: &str,
    _emulator_id: &str,
    install_dir: &str,
    app_handle: Option<&tauri::AppHandle>,
) -> Result<InstallResult, Box<dyn std::error::Error>> {
    // Emit progress event helper
    let emit_progress = |stage: &str, progress: f32, message: &str| {
        if let Some(handle) = app_handle {
            let _ = handle.emit_all("download-progress", serde_json::json!({
                "slug": slug,
                "stage": stage,
                "progress": progress,
                "message": message
            }));
        }
    };

    emit_progress("starting", 0.0, "Starting download...");

    // 1. Get game entry
    let game = get_entry(slug).await?;

    if game.download_links.is_empty() {
        return Err("No download links available".into());
    }

    emit_progress("preparing", 5.0, "Preparing installation...");

    // 2. Create installation directory
    let game_dir = Path::new(install_dir)
        .join(&game.platform)
        .join(sanitize_filename(&game.title));
    std::fs::create_dir_all(&game_dir)?;

    emit_progress("downloading", 10.0, "Downloading game...");

    // 3. Download the game (use first link)
    let link = &game.download_links[0];
    let download_path = game_dir.join(&link.filename);

    stream_download_with_progress(
        &link.url,
        &download_path.to_string_lossy().to_string(),
        slug,
        "downloading",
        app_handle,
    ).await?;

    emit_progress("extracting", 50.0, "Extracting files...");

    // 4. Extract if it's a ZIP file
    let rom_path = if link.filename.ends_with(".zip") {
        let extract_dir = game_dir.join("extracted");
        extract_rom(
            &download_path.to_string_lossy().to_string(),
            &extract_dir.to_string_lossy().to_string()
        ).await?;

        emit_progress("finding_rom", 65.0, "Finding ROM file...");

        // Find the ROM file (common extensions)
        let rom_extensions = vec!["nes", "snes", "sfc", "n64", "z64", "gba", "gb", "gbc",
                                   "nds", "iso", "cue", "bin", "md", "gen", "smd", "gg",
                                   "sms", "pce", "ngp", "ngc", "ws", "wsc"];

        let mut found_rom = None;
        for entry in std::fs::read_dir(&extract_dir)? {
            let entry = entry?;
            let path = entry.path();
            if let Some(ext) = path.extension() {
                if rom_extensions.contains(&ext.to_string_lossy().to_lowercase().as_str()) {
                    found_rom = Some(path);
                    break;
                }
            }
        }

        emit_progress("rom_found", 70.0, "ROM file found!");

        // If we found a ROM, use it; otherwise use the first extracted file
        if let Some(rom) = found_rom {
            rom.to_string_lossy().to_string()
        } else {
            // Fallback: use the first non-directory file
            let mut first_file = None;
            for entry in std::fs::read_dir(&extract_dir)? {
                let entry = entry?;
                let path = entry.path();
                if path.is_file() {
                    first_file = Some(path);
                    break;
                }
            }
            first_file
                .ok_or("No ROM file found in archive")?
                .to_string_lossy()
                .to_string()
        }
    } else {
        emit_progress("preparing_rom", 60.0, "Preparing ROM file...");
        // Not a ZIP, use the downloaded file directly
        download_path.to_string_lossy().to_string()
    };

    println!("✅ ROM prepared: {}", rom_path);
    emit_progress("downloading_cover", 75.0, "Downloading cover art...");

    // 5. Download cover image if available
    let cover_path = if let Some(boxart_url) = &game.cover_url {
        let cover_filename = format!("{}.png", sanitize_filename(&game.title));
        let cover_dest = game_dir.join(&cover_filename);

        match stream_download_with_progress(
            boxart_url,
            &cover_dest.to_string_lossy().to_string(),
            slug,
            "downloading_cover",
            app_handle,
        ).await {
            Ok(_) => Some(cover_dest.to_string_lossy().to_string()),
            Err(_) => None, // Don't fail if cover download fails
        }
    } else {
        None
    };

    emit_progress("completed", 100.0, "Installation complete!");

    Ok(InstallResult {
        rom_path,
        cover_path,
        title: game.title,
        platform: game.platform,
        slug: slug.to_string(),
    })
}

/// Sanitize filename for filesystem
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect()
}
