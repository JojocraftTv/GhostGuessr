#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
  fs,
  path::{Path, PathBuf},
  time::Duration,
  process::Command,
};
use tauri::Manager;
use winreg::enums::HKEY_CURRENT_USER;
use winreg::RegKey;

mod asar;
mod crawlfs;
mod disk;
mod error;
mod filesystem;
mod integrity;
mod node;
mod pickle;

use crate::asar::{create_package_with_options, extract_all, list_package, CreateOptions};

const DEFAULT_RESOURCES_PATH: &str =
  "";
const SCRIPT_URL: &str =
  "https://github.com/JojocraftTv/GhostGuessr/raw/refs/heads/main/dist/ghostguessr-core.user.js";

#[tauri::command]
fn detect_resources_path() -> Option<String> {
  find_resources_path(None)
    .map(|path| to_game_root(&path))
    .map(|path| path.to_string_lossy().to_string())
}

#[derive(serde::Serialize)]
struct PatchStatus {
  resources_path: String,
  patched: bool,
  backup_exists: bool,
}

#[tauri::command]
async fn get_status(
  app: tauri::AppHandle,
  resources_path: Option<String>,
) -> Result<PatchStatus, String> {
  tauri::async_runtime::spawn_blocking(move || get_status_inner(&app, resources_path))
    .await
    .map_err(|e| format!("Status task failed: {e}"))?
}

#[tauri::command]
fn browse_resources_path() -> Option<String> {
  rfd::FileDialog::new()
    .set_title("Select GeoGuessr game folder")
    .pick_folder()
    .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
fn open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
  let _ = app;
  open::that(url).map_err(|e| format!("Failed to open URL: {e}"))
}

#[tauri::command]
fn minimize_window(app: tauri::AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .or_else(|| app.webview_windows().values().next().cloned());
  if let Some(window) = window {
    window.minimize().map_err(|e| format!("Minimize failed: {e}"))
  } else {
    Err("Main window not found".to_string())
  }
}

#[tauri::command]
fn close_window(app: tauri::AppHandle) -> Result<(), String> {
  let window = app
    .get_webview_window("main")
    .or_else(|| app.webview_windows().values().next().cloned());
  if let Some(window) = window {
    window.close().map_err(|e| format!("Close failed: {e}"))
  } else {
    Err("Main window not found".to_string())
  }
}

#[tauri::command]
async fn patch(
  app: tauri::AppHandle,
  resources_path: Option<String>,
  enable_devtools: bool,
) -> Result<String, String> {
  tauri::async_runtime::spawn_blocking(move || patch_inner(&app, resources_path, enable_devtools))
    .await
    .map_err(|e| format!("Patch task failed: {e}"))?
}

fn patch_inner(
  _app: &tauri::AppHandle,
  resources_path: Option<String>,
  enable_devtools: bool,
) -> Result<String, String> {
  kill_geoguessr().map_err(|e| format!("Failed to stop GeoGuessr: {e}"))?;
  let resources = find_resources_path(resources_path.as_deref())
    .ok_or_else(|| "Resources path not found. Use the input to set it.".to_string())?;

  let app_asar = resources.join("app.asar");
  let backup = resources.join("app.asar.bak");
  let extracted = resources.join("app.asar.extracted");
  let ghost_script = extracted.join("ghostguessr.user.js");
  let main_js = extracted.join("main.js");

  if !app_asar.exists() {
    return Err(format!("app.asar not found at {}", app_asar.display()));
  }

  if !backup.exists() {
    fs::copy(&app_asar, &backup)
      .map_err(|e| format!("Failed to create backup: {e}"))?;
  }

  if extracted.exists() {
    fs::remove_dir_all(&extracted)
      .map_err(|e| format!("Failed to remove old extract: {e}"))?;
  }
  fs::create_dir_all(&extracted)
    .map_err(|e| format!("Failed to create extract dir: {e}"))?;

  extract_all(&app_asar, &extracted).map_err(|e| format!("Asar extract failed: {e}"))?;

  let mut script = fetch_remote_script()?;
  let script_hash = compute_string_hash(&script);
  let hash_inject = format!("try {{ localStorage.setItem('gg_current_script_hash', '{}'); }} catch(e) {{}}\n", script_hash);
  script.insert_str(0, &hash_inject);

  fs::write(&ghost_script, script)
    .map_err(|e| format!("Failed to write ghost script: {e}"))?;

  patch_main_js(&main_js, enable_devtools)?;

  let mut options = CreateOptions::new();
  options.unpack_dir = Some("gg-steamworks-fork".to_string());
  create_package_with_options(&extracted, &app_asar, &options)
    .map_err(|e| format!("Asar pack failed: {e}"))?;

  if extracted.exists() {
    fs::remove_dir_all(&extracted)
      .map_err(|e| format!("Failed to remove extracted folder: {e}"))?;
  }

  Ok(format!("Patched successfully. Backup: {}", backup.display()))
}

#[tauri::command]
async fn unpatch(resources_path: Option<String>) -> Result<String, String> {
  tauri::async_runtime::spawn_blocking(move || unpatch_inner(resources_path))
    .await
    .map_err(|e| format!("Unpatch task failed: {e}"))?
}

fn unpatch_inner(resources_path: Option<String>) -> Result<String, String> {
  kill_geoguessr().map_err(|e| format!("Failed to stop GeoGuessr: {e}"))?;
  let resources = find_resources_path(resources_path.as_deref())
    .ok_or_else(|| "Resources path not found. Use the input to set it.".to_string())?;

  let app_asar = resources.join("app.asar");
  let backup = resources.join("app.asar.bak");

  if !backup.exists() {
    return Err("Backup not found. Nothing to restore.".to_string());
  }

  fs::copy(&backup, &app_asar)
    .map_err(|e| format!("Failed to restore backup: {e}"))?;

  fs::remove_file(&backup)
    .map_err(|e| format!("Failed to remove backup: {e}"))?;

  Ok("Backup restored and removed. app.asar has been unpatched.".to_string())
}

fn patch_main_js(path: &Path, enable_devtools: bool) -> Result<(), String> {
  let source = fs::read_to_string(path)
    .map_err(|e| format!("Failed to read main.js: {e}"))?;

  let header_need = "const { app, BrowserWindow, shell, session } = require(\"electron\");";
  let header_replace = [
    "const { app, BrowserWindow, shell, session } = require(\"electron\");",
    "const fs = require(\"fs\");",
    "const path = require(\"path\");",
  ].join("\n");

  let inject_block = [
    "const buildGhostInject = (raw) => {",
    "  const prefix = `(() => {",
    "  if (window.__ghostguessrInjected) return;",
    "  window.__ghostguessrInjected = true;",
    "`;",
    "  const suffix = `\\n})();`;",
    "  return `${prefix}\\n${raw}\\n${suffix}`;",
    "};",
    "",
    "const ghostScriptPath = path.join(__dirname, \"ghostguessr.user.js\");",
    "let ghostInject = \"\";",
    "try {",
    "  const ghostRaw = fs.readFileSync(ghostScriptPath, \"utf8\");",
    "  ghostInject = buildGhostInject(ghostRaw);",
    "} catch (error) {",
    "  log.error(\"Failed to load GhostGuessr script:\", error);",
    "}",
  ].join("\n");

  let base_url = "const baseUrl = environments[environment];";
  let load_need = "  mainWindow.loadFile(\"index.html\");";
  let hook_block = [
    "  mainWindow.webContents.on(",
    "    \"did-frame-finish-load\",",
    "    (event, isMainFrame, frameProcessId, frameRoutingId) => {",
    "      if (isMainFrame || !ghostInject) {",
    "        return;",
    "      }",
    "      const mainFrame = mainWindow.webContents.mainFrame;",
    "      if (!mainFrame || !mainFrame.frames) {",
    "        return;",
    "      }",
    "      const frame = mainFrame.frames.find(",
    "        (child) =>",
    "          child.processId === frameProcessId &&",
    "          child.routingId === frameRoutingId,",
    "      );",
    "      if (!frame || !frame.url.startsWith(baseUrl)) {",
    "        return;",
    "      }",
    "      frame.executeJavaScript(ghostInject).catch((error) => {",
    "        log.error(\"Failed to inject GhostGuessr script:\", error);",
    "      });",
    "    },",
    "  );",
  ].join("\n");

  let mut updated = source.clone();
  if !updated.contains("ghostguessr.user.js") {
    if !updated.contains(header_need) || !updated.contains(base_url) || !updated.contains(load_need) {
      return Err("main.js structure not recognized.".to_string());
    }
    updated = updated.replace(header_need, &header_replace);
    updated = updated.replace(base_url, &format!("{}\n\n{}", base_url, inject_block));
    updated = updated.replace(load_need, &format!("{}\n\n{}", load_need, hook_block));
  }

  if enable_devtools {
    if updated.contains("devTools: !isProd,") {
      updated = updated.replace("devTools: !isProd,", "devTools: true,");
    }

    if !updated.contains("openDevTools") && updated.contains(load_need) {
      updated = updated.replace(
        load_need,
        &format!(
          "{}\n\n  mainWindow.webContents.openDevTools({{ mode: \"detach\" }});",
          load_need
        ),
      );
    }
  }

  if updated != source {
    fs::write(path, updated)
      .map_err(|e| format!("Failed to write main.js: {e}"))?;
  }

  Ok(())
}

fn fetch_remote_script() -> Result<String, String> {
  let client = reqwest::blocking::Client::builder()
    .timeout(Duration::from_secs(10))
    .build()
    .map_err(|e| format!("Failed to build HTTP client: {e}"))?;
  let response = client
    .get(SCRIPT_URL)
    .send()
    .map_err(|e| format!("Failed to download script: {e}"))?;
  if !response.status().is_success() {
    return Err(format!(
      "Failed to download script: HTTP {}",
      response.status()
    ));
  }
  response
    .text()
    .map_err(|e| format!("Failed to read script body: {e}"))
}

fn find_resources_path(input: Option<&str>) -> Option<PathBuf> {
  if let Some(path) = input {
    let candidate = PathBuf::from(path);
    if candidate.join("app.asar").exists() {
      return Some(candidate);
    }
    let resources_candidate = candidate.join("resources");
    if resources_candidate.join("app.asar").exists() {
      return Some(resources_candidate);
    }
  }

  let mut candidates = vec![PathBuf::from(DEFAULT_RESOURCES_PATH)];

  if let Some(steam_path) = get_steam_path() {
    let library_folders = steam_path.join("steamapps").join("libraryfolders.vdf");
    let libraries = parse_library_folders(&library_folders);
    for lib in libraries {
      candidates.push(
        lib.join("steamapps")
          .join("common")
          .join("GeoGuessr Duels")
          .join("resources"),
      );
    }
  }

  candidates.into_iter().find(|path| path.join("app.asar").exists())
}

fn get_steam_path() -> Option<PathBuf> {
  let hkcu = RegKey::predef(HKEY_CURRENT_USER);
  let steam = hkcu.open_subkey("Software\\Valve\\Steam").ok()?;
  let steam_path: String = steam.get_value("SteamPath").ok()?;
  Some(PathBuf::from(steam_path))
}

fn parse_library_folders(path: &Path) -> Vec<PathBuf> {
  let raw = fs::read_to_string(path).unwrap_or_default();
  let mut paths = Vec::new();

  for line in raw.lines() {
    let trimmed = line.trim();
    if !trimmed.starts_with("\"path\"") {
      continue;
    }
    let parts: Vec<&str> = trimmed.split('"').collect();
    if parts.len() >= 4 {
      let cleaned = parts[3].replace("\\\\", "\\");
      paths.push(PathBuf::from(cleaned));
    }
  }

  paths
}

fn get_status_inner(
  _app: &tauri::AppHandle,
  resources_path: Option<String>,
) -> Result<PatchStatus, String> {
  let resources = find_resources_path(resources_path.as_deref())
    .ok_or_else(|| "Resources path not found. Use the input to set it.".to_string())?;
  let app_asar = resources.join("app.asar");
  let backup = resources.join("app.asar.bak");
  if !app_asar.exists() {
    return Err(format!("app.asar not found at {}", app_asar.display()));
  }
  let patched = is_patched(&app_asar)?;

  Ok(PatchStatus {
    resources_path: to_game_root(&resources).to_string_lossy().to_string(),
    patched,
    backup_exists: backup.exists(),
  })
}

fn to_game_root(resources: &Path) -> PathBuf {
  resources
    .parent()
    .map(|parent| parent.to_path_buf())
    .unwrap_or_else(|| resources.to_path_buf())
}

fn is_patched(app_asar: &Path) -> Result<bool, String> {
  let list = list_package(app_asar).map_err(|e| format!("Asar list failed: {e}"))?;
  Ok(list.iter().any(|line| line.trim_end().ends_with("ghostguessr.user.js")))
}

fn kill_geoguessr() -> Result<(), String> {
  #[cfg(target_os = "windows")]
  {
    let filter = "IMAGENAME eq GeoGuessr.exe";
    let list_out = Command::new("tasklist")
      .args(&["/FI", filter, "/NH"])
      .output()
      .map_err(|e| format!("Failed to run tasklist: {e}"))?;
    let stdout = String::from_utf8_lossy(&list_out.stdout).to_string();
    let l = stdout.to_lowercase();
    if l.contains("no tasks are running") || !l.contains("geoguessr.exe") {
      return Ok(());
    }

    let kill_out = Command::new("taskkill")
      .args(&["/IM", "GeoGuessr.exe", "/F"])
      .output()
      .map_err(|e| format!("Failed to run taskkill: {e}"))?;
    if kill_out.status.success() {
      return Ok(());
    }
    let so = String::from_utf8_lossy(&kill_out.stdout);
    let se = String::from_utf8_lossy(&kill_out.stderr);
    return Err(format!("taskkill failed: {} {}", so, se));
  }

  #[cfg(not(target_os = "windows"))]
  {
    if let Ok(pgrep_out) = Command::new("pgrep").arg("-f").arg("GeoGuessr").output() {
      if !pgrep_out.stdout.is_empty() {
        let _ = Command::new("pkill").arg("-f").arg("GeoGuessr").output();
      }
    }
    Ok(())
  }
}

use sha2::{Digest, Sha256};
use std::io::Read;

#[derive(serde::Serialize)]
struct UpdateInfo {
  available: bool,
  url: String,
  version: String,
  download_url: Option<String>,
}

#[tauri::command]
async fn check_update() -> Result<UpdateInfo, String> {
  tauri::async_runtime::spawn_blocking(move || check_update_inner())
    .await
    .map_err(|e| format!("Update check task failed: {e}"))?
}

fn check_update_inner() -> Result<UpdateInfo, String> {
  let current_exe = std::env::current_exe()
    .map_err(|e| format!("Failed to get current exe path: {e}"))?;
  
  let local_hash = compute_file_hash(&current_exe)?;
  
  let client = reqwest::blocking::Client::builder()
    .user_agent("GhostGuessr-Patcher")
    .timeout(Duration::from_secs(10))
    .build()
    .map_err(|e| format!("Client build error: {e}"))?;
    
  let resp = client.get("https://api.github.com/repos/JojocraftTv/GhostGuessr/releases/latest")
    .send()
    .map_err(|e| format!("GitHub API request failed: {e}"))?;
    
  if !resp.status().is_success() {
    return Err(format!("GitHub API returned {}", resp.status()));
  }
  
  let release: serde_json::Value = resp.json()
    .map_err(|e| format!("Failed to parse release JSON: {e}"))?;
    
  let tag_name = release["tag_name"].as_str().unwrap_or("unknown").to_string();
  let html_url = release["html_url"].as_str().unwrap_or("").to_string();
  let assets = release["assets"].as_array().ok_or("No assets found in release")?;
  
  let exe_asset = assets.iter().find(|a| {
    a["name"].as_str().map(|n| n.ends_with(".exe")).unwrap_or(false)
  });
  let exe_url = exe_asset.and_then(|a| a["browser_download_url"].as_str()).map(|s| s.to_string());
  
  let sha_asset = assets.iter().find(|a| {
    a["name"].as_str().map(|n| n.ends_with(".sha256") || n.contains("SHA256")).unwrap_or(false)
  });
  
  let mut available = false;
  
  if let Some(asset) = sha_asset {
    if let Some(url) = asset["browser_download_url"].as_str() {
      if let Ok(hash_resp) = client.get(url).send() {
        if let Ok(hash_text) = hash_resp.text() {
          let clean_local = local_hash.trim().to_lowercase();
          let clean_remote = hash_text.to_lowercase();
          available = !clean_remote.contains(&clean_local);
        }
      }
    }
  } else {
    let current_version = env!("CARGO_PKG_VERSION");
    let clean_tag = tag_name.trim_start_matches('v');
    available = clean_tag != current_version;
  }
  
  Ok(UpdateInfo {
    available,
    url: html_url,
    version: tag_name,
    download_url: exe_url,
  })
}

fn compute_file_hash(path: &Path) -> Result<String, String> {
  let mut file = fs::File::open(path).map_err(|e| format!("Failed to open file: {e}"))?;
  let mut hasher = Sha256::new();
  let mut buffer = [0; 8192];
  loop {
    let count = file.read(&mut buffer).map_err(|e| format!("Failed to read file: {e}"))?;
    if count == 0 { break; }
    hasher.update(&buffer[..count]);
  }
  Ok(hex::encode(hasher.finalize()))
}

fn compute_string_hash(content: &str) -> String {
  let mut hasher = Sha256::new();
  hasher.update(content.as_bytes());
  hex::encode(hasher.finalize())
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      detect_resources_path,
      browse_resources_path,
      get_status,
      open_url,
      minimize_window,
      close_window,
      patch,
      unpatch,
      check_update
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}