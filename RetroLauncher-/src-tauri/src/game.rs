use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Game {
    pub id: String,
    pub title: String,
    pub platform: String,
    pub rom_path: String,
    pub cover_path: Option<String>,
    pub emulator_id: String,
    pub description: Option<String>,
    pub release_year: Option<i32>,
    pub genre: Option<String>,
    pub developer: Option<String>,
    #[sqlx(default)]
    pub is_favorite: i64,
    #[sqlx(default)]
    pub play_count: i64,
    #[sqlx(default)]
    pub total_playtime: i64,
    pub last_played: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct GameStats {
    pub play_count: i64,
    pub total_playtime: i64,
    pub last_played: Option<String>,
}

pub struct GameLibrary {
    pub games: Vec<Game>,
}

impl GameLibrary {
    pub fn new() -> Self {
        GameLibrary { games: Vec::new() }
    }

    pub fn add_game(&mut self, game: Game) {
        self.games.push(game);
    }

    pub fn get_by_platform(&self, platform: &str) -> Vec<&Game> {
        self.games.iter()
            .filter(|g| g.platform == platform)
            .collect()
    }

    pub fn get_favorites(&self) -> Vec<&Game> {
        self.games.iter()
            .filter(|g| g.is_favorite == 1)
            .collect()
    }
}
