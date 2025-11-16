use sqlx::{SqlitePool, sqlite::{SqlitePoolOptions, SqliteConnectOptions}};
use std::path::Path;
use serde_json::Value as JsonValue;

use crate::game::{Game, GameStats};
use crate::emulator::EmulatorConfig;

pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new(db_path: &Path) -> Result<Self, sqlx::Error> {
        // Ensure the parent directory exists with proper error handling
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                sqlx::Error::Io(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to create database directory: {}", e)
                ))
            })?;
        }

        // Create connection options with proper settings
        let connect_options = SqliteConnectOptions::new()
            .filename(db_path)
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(connect_options)
            .await?;

        // Create tables
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                platform TEXT NOT NULL,
                rom_path TEXT NOT NULL,
                cover_path TEXT,
                emulator_id TEXT NOT NULL,
                description TEXT,
                release_year INTEGER,
                genre TEXT,
                developer TEXT,
                is_favorite INTEGER DEFAULT 0,
                play_count INTEGER DEFAULT 0,
                total_playtime INTEGER DEFAULT 0,
                last_played TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            "#
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS emulators (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                platform TEXT NOT NULL,
                executable_path TEXT NOT NULL,
                arguments TEXT,
                icon_path TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            "#
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            "#
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS screenshots (
                id TEXT PRIMARY KEY,
                game_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (game_id) REFERENCES games(id)
            )
            "#
        )
        .execute(&pool)
        .await?;

        Ok(Database { pool })
    }

    // Game operations
    pub async fn add_game(&self, game: Game) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO games (id, title, platform, rom_path, cover_path, emulator_id,
                              description, release_year, genre, developer)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&game.id)
        .bind(&game.title)
        .bind(&game.platform)
        .bind(&game.rom_path)
        .bind(&game.cover_path)
        .bind(&game.emulator_id)
        .bind(&game.description)
        .bind(game.release_year)
        .bind(&game.genre)
        .bind(&game.developer)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_game(&self, id: &str) -> Result<Game, sqlx::Error> {
        let game = sqlx::query_as::<_, Game>(
            "SELECT * FROM games WHERE id = ?"
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;

        Ok(game)
    }

    pub async fn get_all_games(&self) -> Result<Vec<Game>, sqlx::Error> {
        let games = sqlx::query_as::<_, Game>(
            "SELECT * FROM games ORDER BY title ASC"
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(games)
    }

    pub async fn delete_game(&self, id: &str) -> Result<(), sqlx::Error> {
        // First, get the game to retrieve file paths
        let game = self.get_game(id).await?;

        // Delete the entire game directory (which contains .zip, extracted/, cover, etc.)
        // The ROM path is typically: .../games/PLATFORM/GAME_NAME/extracted/rom_file
        // We want to delete: .../games/PLATFORM/GAME_NAME/
        let rom_path = std::path::Path::new(&game.rom_path);

        // Navigate up from ROM to find the game directory
        // Structure: games/platform/game_name/extracted/rom_file
        // We need to go up to game_name directory
        if let Some(game_dir) = rom_path.parent()  // extracted/
            .and_then(|p| p.parent())                // game_name/
        {
            if game_dir.exists() {
                if let Err(e) = std::fs::remove_dir_all(game_dir) {
                    eprintln!("Warning: Failed to delete game directory {}: {}", game_dir.display(), e);
                }
            }
        } else {
            // Fallback: delete individual files if we can't find the game directory
            if std::path::Path::new(&game.rom_path).exists() {
                if let Err(e) = std::fs::remove_file(&game.rom_path) {
                    eprintln!("Warning: Failed to delete ROM file {}: {}", game.rom_path, e);
                }
            }

            if let Some(cover_path) = &game.cover_path {
                if std::path::Path::new(cover_path).exists() {
                    if let Err(e) = std::fs::remove_file(cover_path) {
                        eprintln!("Warning: Failed to delete cover file {}: {}", cover_path, e);
                    }
                }
            }
        }

        // Delete the database entry
        sqlx::query("DELETE FROM games WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn update_game_stats(&self, game_id: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            UPDATE games
            SET play_count = play_count + 1,
                last_played = datetime('now')
            WHERE id = ?
            "#
        )
        .bind(game_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn toggle_favorite(&self, game_id: &str) -> Result<bool, sqlx::Error> {
        let result: (i64,) = sqlx::query_as(
            "SELECT is_favorite FROM games WHERE id = ?"
        )
        .bind(game_id)
        .fetch_one(&self.pool)
        .await?;

        let new_value = if result.0 == 0 { 1 } else { 0 };

        sqlx::query("UPDATE games SET is_favorite = ? WHERE id = ?")
            .bind(new_value)
            .bind(game_id)
            .execute(&self.pool)
            .await?;

        Ok(new_value == 1)
    }

    pub async fn get_game_stats(&self, game_id: &str) -> Result<GameStats, sqlx::Error> {
        let stats = sqlx::query_as::<_, GameStats>(
            "SELECT play_count, total_playtime, last_played FROM games WHERE id = ?"
        )
        .bind(game_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(stats)
    }

    // Emulator operations
    pub async fn add_emulator(&self, emulator: EmulatorConfig) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
            INSERT INTO emulators (id, name, platform, executable_path, arguments, icon_path)
            VALUES (?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&emulator.id)
        .bind(&emulator.name)
        .bind(&emulator.platform)
        .bind(&emulator.executable_path)
        .bind(&emulator.arguments)
        .bind(&emulator.icon_path)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_emulator(&self, id: &str) -> Result<EmulatorConfig, sqlx::Error> {
        let emulator = sqlx::query_as::<_, EmulatorConfig>(
            "SELECT * FROM emulators WHERE id = ?"
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;

        Ok(emulator)
    }

    pub async fn get_all_emulators(&self) -> Result<Vec<EmulatorConfig>, sqlx::Error> {
        let emulators = sqlx::query_as::<_, EmulatorConfig>(
            "SELECT * FROM emulators ORDER BY name ASC"
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(emulators)
    }

    // Settings operations
    pub async fn get_settings(&self) -> Result<JsonValue, sqlx::Error> {
        let rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT key, value FROM settings"
        )
        .fetch_all(&self.pool)
        .await?;

        let mut settings = serde_json::Map::new();
        for (key, value) in rows {
            if let Ok(parsed) = serde_json::from_str(&value) {
                settings.insert(key, parsed);
            }
        }

        Ok(JsonValue::Object(settings))
    }

    pub async fn update_settings(&self, settings: JsonValue) -> Result<(), sqlx::Error> {
        if let Some(obj) = settings.as_object() {
            for (key, value) in obj {
                let value_str = serde_json::to_string(value).unwrap();
                sqlx::query(
                    r#"
                    INSERT INTO settings (key, value) VALUES (?, ?)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value
                    "#
                )
                .bind(key)
                .bind(value_str)
                .execute(&self.pool)
                .await?;
            }
        }

        Ok(())
    }
}
