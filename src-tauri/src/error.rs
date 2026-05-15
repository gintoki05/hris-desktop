use std::{fmt, io};

#[derive(Debug)]
pub enum AppError {
    Database(String),
    FileSystem(String),
    Path(String),
    Supabase(String),
}

impl AppError {
    pub fn user_message(&self) -> String {
        match self {
            Self::Database(message) => format!("Database lokal gagal diproses: {message}"),
            Self::FileSystem(message) => format!("File lokal gagal diproses: {message}"),
            Self::Path(message) => format!("Path lokal tidak valid: {message}"),
            Self::Supabase(message) => format!("Publish Supabase gagal: {message}"),
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.user_message())
    }
}

impl From<io::Error> for AppError {
    fn from(error: io::Error) -> Self {
        Self::FileSystem(error.to_string())
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Database(error.to_string())
    }
}
