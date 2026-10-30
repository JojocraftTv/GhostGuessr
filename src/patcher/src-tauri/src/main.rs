#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! GhostGuessr Patcher — Tauri commands. All heavy lifting lives in the
//! modules below; this file only wires them to the UI.

mod asar;
mod fuses;
mod game;
mod patch;
mod remote;

use std::path::PathBuf;
use tauri::{Emitter, Manager};

#[derive(serde::Serialize, Clone)]
struct LogEvent {
  level: &'static str,
  message: String,
}

fn emit_log(app: &tauri::AppHandle, message: String) {
  let _ = app.emit("patcher-log", LogEvent { level: "info", message });
}

/// Resolves the install from the UI path, falling back to auto-detection.
fn install_for(path: Option<String>) -> Result<game::Install, String> {
  match path.as_deref().map(str::trim).filter(|p| !p.is_empty()) {
    Some(p) => game::resolve(&PathBuf::from(p)).ok_or_else(|| format!("No GeoGuessr installation (resources/app.asar) found in \"{p}\".")),
    None => game::detect().ok_or_else(|| "GeoGuessr was not found automatically. Choose the game folder in Settings.".to_string()),
  }
}

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
  tauri::async_runtime::spawn_blocking(f).await.map_err(|e| format!("Task failed: {e}"))?
}

#[tauri::command]
async fn detect_game() -> Option<String> {
  blocking(|| Ok(game::detect().map(|i| i.root.to_string_lossy().to_string()))).await.ok().flatten()
}

#[tauri::command]
fn browse_game() -> Option<String> {
  rfd::FileDialog::new()
    .set_title("Select the GeoGuessr game folder")
    .pick_folder()
    .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_status(path: Option<String>) -> Result<patch::Status, String> {
  blocking(move || patch::status(&install_for(path)?)).await
}

#[tauri::command]
async fn install(app: tauri::AppHandle, path: Option<String>, options: patch::Options) -> Result<String, String> {
  blocking(move || {
    let install = install_for(path)?;
    emit_log(&app, format!("Game folder: {}", install.root.display()));
    patch::patch(&install, &options, &mut |m| emit_log(&app, m))
  })
  .await
}

#[tauri::command]
async fn uninstall(app: tauri::AppHandle, path: Option<String>) -> Result<String, String> {
  blocking(move || {
    let install = install_for(path)?;
    patch::unpatch(&install, &mut |m| emit_log(&app, m))
  })
  .await
}

#[tauri::command]
async fn launch_game(path: Option<String>) -> Result<(), String> {
  blocking(move || game::launch(&install_for(path)?)).await
}

#[tauri::command]
async fn open_game_folder(path: Option<String>) -> Result<(), String> {
  blocking(move || open::that(install_for(path)?.root).map_err(|e| format!("Could not open folder: {e}"))).await
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
  if !url.starts_with("https://") {
    return Err("Only https links can be opened.".into());
  }
  open::that(url).map_err(|e| format!("Could not open link: {e}"))
}

#[tauri::command]
async fn check_update() -> Result<remote::UpdateInfo, String> {
  blocking(remote::check_patcher_update).await
}

#[tauri::command]
fn patcher_channel() -> &'static str {
  remote::PATCHER_CHANNEL
}

#[tauri::command]
fn patcher_version() -> &'static str {
  patch::PATCHER_VERSION
}

fn main_window(app: &tauri::AppHandle) -> Result<tauri::WebviewWindow, String> {
  app
    .get_webview_window("main")
    .or_else(|| app.webview_windows().values().next().cloned())
    .ok_or_else(|| "Main window not found".to_string())
}

#[tauri::command]
fn minimize_window(app: tauri::AppHandle) -> Result<(), String> {
  main_window(&app)?.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn close_window(app: tauri::AppHandle) -> Result<(), String> {
  main_window(&app)?.close().map_err(|e| e.to_string())
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      detect_game,
      browse_game,
      get_status,
      install,
      uninstall,
      launch_game,
      open_game_folder,
      open_url,
      check_update,
      patcher_version,
      patcher_channel,
      minimize_window,
      close_window
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
