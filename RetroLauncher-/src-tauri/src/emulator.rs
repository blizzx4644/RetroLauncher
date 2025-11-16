use serde::{Deserialize, Serialize};
use sqlx;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EmulatorConfig {
    pub id: String,
    pub name: String,
    pub platform: String,
    pub executable_path: String,
    pub arguments: Option<String>,
    pub icon_path: Option<String>,
}

impl EmulatorConfig {
    pub fn new(
        id: String,
        name: String,
        platform: String,
        executable_path: String,
    ) -> Self {
        EmulatorConfig {
            id,
            name,
            platform,
            executable_path,
            arguments: None,
            icon_path: None,
        }
    }

    pub fn with_arguments(mut self, arguments: String) -> Self {
        self.arguments = Some(arguments);
        self
    }

    pub fn with_icon(mut self, icon_path: String) -> Self {
        self.icon_path = Some(icon_path);
        self
    }
}

// Recommended emulators with download information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendedEmulator {
    pub id: String,
    pub name: String,
    pub description: String,
    pub platforms: Vec<String>,
    pub platform_names: Vec<String>,
    pub website: String,
    pub download_page: String,
    pub download_url_windows: Option<String>,
    pub download_url_mac: Option<String>,
    pub download_url_linux: Option<String>,
    pub is_portable: bool,
    pub executable_name_windows: Option<String>,
    pub executable_name_mac: Option<String>,
    pub executable_name_linux: Option<String>,
    pub logo_url: Option<String>,
    pub install_instructions: String,
}

pub fn get_recommended_emulators() -> Vec<RecommendedEmulator> {
    vec![
        // RetroArch - Multi-platform
        RecommendedEmulator {
            id: "retroarch".to_string(),
            name: "RetroArch".to_string(),
            description: "All-in-one emulator supporting 50+ systems (NES, SNES, N64, PlayStation, etc.)".to_string(),
            platforms: vec![
                "nes".to_string(),
                "snes".to_string(),
                "n64".to_string(),
                "gba".to_string(),
                "gbc".to_string(),
                "gb".to_string(),
                "genesis".to_string(),
                "ps1".to_string(),
            ],
            platform_names: vec![
                "NES".to_string(),
                "SNES".to_string(),
                "N64".to_string(),
                "Game Boy Advance".to_string(),
                "Game Boy Color".to_string(),
                "Game Boy".to_string(),
                "Sega Genesis / Mega Drive".to_string(),
                "PlayStation 1".to_string(),
            ],
            website: "https://www.retroarch.com".to_string(),
            download_page: "https://www.retroarch.com/index.php?page=platforms".to_string(),
            download_url_windows: None, // URLs change frequently, use download page
            download_url_mac: None,
            download_url_linux: None,
            is_portable: true,
            executable_name_windows: Some("retroarch.exe".to_string()),
            executable_name_mac: Some("RetroArch.app".to_string()),
            executable_name_linux: Some("retroarch".to_string()),
            logo_url: Some("https://www.retroarch.com/images/retroarch-logo.png".to_string()),
            install_instructions: "Download the Windows installer or portable version, extract if needed, and point to retroarch.exe".to_string(),
        },
        // PPSSPP - PSP
        RecommendedEmulator {
            id: "ppsspp".to_string(),
            name: "PPSSPP".to_string(),
            description: "PlayStation Portable emulator".to_string(),
            platforms: vec!["psp".to_string()],
            platform_names: vec!["PlayStation Portable".to_string()],
            website: "https://www.ppsspp.org".to_string(),
            download_page: "https://www.ppsspp.org/download".to_string(),
            download_url_windows: None,
            download_url_mac: None,
            download_url_linux: None,
            is_portable: true,
            executable_name_windows: Some("PPSSPPWindows64.exe".to_string()),
            executable_name_mac: Some("PPSSPP.app".to_string()),
            executable_name_linux: Some("PPSSPPSDL".to_string()),
            logo_url: None,
            install_instructions: "Download the Windows version, extract the ZIP, and point to PPSSPPWindows64.exe".to_string(),
        },
        // Dolphin - GameCube/Wii
        RecommendedEmulator {
            id: "dolphin".to_string(),
            name: "Dolphin".to_string(),
            description: "GameCube and Wii emulator".to_string(),
            platforms: vec!["gamecube".to_string(), "wii".to_string()],
            platform_names: vec!["GameCube".to_string(), "Wii".to_string()],
            website: "https://dolphin-emu.org".to_string(),
            download_page: "https://dolphin-emu.org/download/".to_string(),
            download_url_windows: None,
            download_url_mac: None,
            download_url_linux: None,
            is_portable: true,
            executable_name_windows: Some("Dolphin.exe".to_string()),
            executable_name_mac: Some("Dolphin.app".to_string()),
            executable_name_linux: Some("dolphin-emu".to_string()),
            logo_url: None,
            install_instructions: "Download the latest beta version, extract the 7z archive, and point to Dolphin.exe".to_string(),
        },
        // PCSX2 - PlayStation 2
        RecommendedEmulator {
            id: "pcsx2".to_string(),
            name: "PCSX2".to_string(),
            description: "PlayStation 2 emulator".to_string(),
            platforms: vec!["ps2".to_string()],
            platform_names: vec!["PlayStation 2".to_string()],
            website: "https://pcsx2.net".to_string(),
            download_page: "https://pcsx2.net/downloads/".to_string(),
            download_url_windows: None,
            download_url_mac: None,
            download_url_linux: None,
            is_portable: true,
            executable_name_windows: Some("pcsx2-qt.exe".to_string()),
            executable_name_mac: Some("PCSX2.app".to_string()),
            executable_name_linux: Some("pcsx2-qt".to_string()),
            logo_url: None,
            install_instructions: "Download the Windows installer or portable version, extract if needed, and point to pcsx2-qt.exe".to_string(),
        },
        // mGBA - Game Boy Advance
        RecommendedEmulator {
            id: "mgba".to_string(),
            name: "mGBA".to_string(),
            description: "Game Boy Advance emulator (also supports GB/GBC)".to_string(),
            platforms: vec!["gba".to_string(), "gb".to_string(), "gbc".to_string()],
            platform_names: vec!["Game Boy Advance".to_string(), "Game Boy".to_string(), "Game Boy Color".to_string()],
            website: "https://mgba.io".to_string(),
            download_page: "https://mgba.io/downloads.html".to_string(),
            download_url_windows: None,
            download_url_mac: None,
            download_url_linux: None,
            is_portable: true,
            executable_name_windows: Some("mGBA.exe".to_string()),
            executable_name_mac: Some("mGBA.app".to_string()),
            executable_name_linux: Some("mgba".to_string()),
            logo_url: None,
            install_instructions: "Download the Windows build, extract the 7z archive, and point to mGBA.exe".to_string(),
        },
        // DeSmuME - Nintendo DS
        RecommendedEmulator {
            id: "desmume".to_string(),
            name: "DeSmuME".to_string(),
            description: "Nintendo DS emulator with high compatibility".to_string(),
            platforms: vec!["nds".to_string(), "ds".to_string()],
            platform_names: vec!["Nintendo DS".to_string(), "Nintendo DS".to_string()],
            website: "https://desmume.org".to_string(),
            download_page: "https://desmume.org/download/".to_string(),
            download_url_windows: None,
            download_url_mac: None,
            download_url_linux: None,
            is_portable: true,
            executable_name_windows: Some("DeSmuME.exe".to_string()),
            executable_name_mac: Some("DeSmuME.app".to_string()),
            executable_name_linux: Some("desmume".to_string()),
            logo_url: None,
            install_instructions: "Download the Windows x64 version, extract the ZIP, and point to DeSmuME.exe".to_string(),
        },
        // Cemu - Wii U
        RecommendedEmulator {
            id: "cemu".to_string(),
            name: "Cemu".to_string(),
            description: "Wii U emulator with excellent performance".to_string(),
            platforms: vec!["wiiu".to_string()],
            platform_names: vec!["Wii U".to_string()],
            website: "https://cemu.info".to_string(),
            download_page: "https://cemu.info/#download".to_string(),
            download_url_windows: None,
            download_url_mac: None,
            download_url_linux: None,
            is_portable: true,
            executable_name_windows: Some("Cemu.exe".to_string()),
            executable_name_mac: None,
            executable_name_linux: Some("Cemu.AppImage".to_string()),
            logo_url: None,
            install_instructions: "Download the latest Windows version, extract the ZIP, and point to Cemu.exe. Note: Requires powerful hardware".to_string(),
        },
        // Citra - Nintendo 3DS
        RecommendedEmulator {
            id: "citra".to_string(),
            name: "Citra".to_string(),
            description: "Nintendo 3DS emulator".to_string(),
            platforms: vec!["3ds".to_string()],
            platform_names: vec!["Nintendo 3DS".to_string()],
            website: "https://citra-emu.org".to_string(),
            download_page: "https://citra-emu.org/download/".to_string(),
            download_url_windows: None,
            download_url_mac: None,
            download_url_linux: None,
            is_portable: true,
            executable_name_windows: Some("citra-qt.exe".to_string()),
            executable_name_mac: Some("citra-qt.app".to_string()),
            executable_name_linux: Some("citra-qt".to_string()),
            logo_url: None,
            install_instructions: "Download Citra Nightly, extract the archive, and point to citra-qt.exe".to_string(),
        },
    ]
}

pub fn get_recommended_emulator_by_id(id: &str) -> Option<RecommendedEmulator> {
    get_recommended_emulators()
        .into_iter()
        .find(|e| e.id == id)
}

pub fn get_recommended_emulators_for_platform(platform: &str) -> Vec<RecommendedEmulator> {
    get_recommended_emulators()
        .into_iter()
        .filter(|e| e.platforms.iter().any(|p| p.to_lowercase() == platform.to_lowercase()))
        .collect()
}
