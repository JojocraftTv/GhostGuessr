//! Locating the Steam installation of GeoGuessr and controlling its process.

use std::{
  fs,
  path::{Path, PathBuf},
  process::Command,
};

/// A resolved game installation.
#[derive(Debug, Clone)]
pub struct Install {
  /// Game root (contains the .exe).
  pub root: PathBuf,
  /// `<root>/resources`.
  pub resources: PathBuf,
  /// Main executable, if found.
  pub exe: Option<PathBuf>,
  /// Steam app id, if found.
  pub app_id: Option<String>,
}

impl Install {
  pub fn app_asar(&self) -> PathBuf {
    self.resources.join("app.asar")
  }

  pub fn backup(&self) -> PathBuf {
    self.resources.join("app.asar.ghostguessr.bak")
  }

  /// Backup written by patcher versions < 3.
  pub fn legacy_backup(&self) -> PathBuf {
    self.resources.join("app.asar.bak")
  }
}

/// Executables in the game folder that are not the game itself.
const HELPER_EXES: &[&str] = &["uninstall", "unins", "crashpad", "notification_helper", "elevate", "squirrel", "update"];

fn find_exe(root: &Path) -> Option<PathBuf> {
  let entries = fs::read_dir(root).ok()?;
  let mut exes: Vec<PathBuf> = entries
    .filter_map(|e| e.ok().map(|e| e.path()))
    .filter(|p| p.extension().map(|e| e.eq_ignore_ascii_case("exe")).unwrap_or(false))
    .filter(|p| {
      let name = p.file_stem().map(|s| s.to_string_lossy().to_lowercase()).unwrap_or_default();
      !HELPER_EXES.iter().any(|helper| name.contains(helper))
    })
    .collect();
  // Prefer something called "geoguessr", else the largest exe (the Electron binary).
  exes.sort_by_key(|p| {
    let is_game = p.file_name().map(|n| n.to_string_lossy().to_lowercase().contains("geoguessr")).unwrap_or(false);
    let size = fs::metadata(p).map(|m| m.len()).unwrap_or(0);
    (std::cmp::Reverse(is_game), std::cmp::Reverse(size))
  });
  exes.into_iter().next()
}

/// Resolves a user supplied path: game root, `resources` folder or app.asar itself.
pub fn resolve(input: &Path) -> Option<Install> {
  let mut candidate = input.to_path_buf();
  if candidate.file_name().map(|n| n == "app.asar").unwrap_or(false) {
    candidate.pop();
  }
  let resources = if candidate.join("app.asar").is_file() {
    candidate.clone()
  } else if candidate.join("resources").join("app.asar").is_file() {
    candidate.join("resources")
  } else {
    return None;
  };
  let root = resources.parent().map(Path::to_path_buf).unwrap_or_else(|| resources.clone());
  let app_id = find_app_id(&root);
  Some(Install { exe: find_exe(&root), app_id, root, resources })
}

/// Searches all Steam libraries for a GeoGuessr installation.
pub fn detect() -> Option<Install> {
  for library in steam_libraries() {
    let common = library.join("steamapps").join("common");
    let Ok(entries) = fs::read_dir(&common) else { continue };
    let mut dirs: Vec<PathBuf> = entries
      .filter_map(|e| e.ok().map(|e| e.path()))
      .filter(|p| p.is_dir() && p.file_name().map(|n| n.to_string_lossy().to_lowercase().contains("geoguessr")).unwrap_or(false))
      .collect();
    dirs.sort();
    if let Some(install) = dirs.iter().find_map(|dir| resolve(dir)) {
      return Some(install);
    }
  }
  None
}

fn steam_libraries() -> Vec<PathBuf> {
  let mut roots: Vec<PathBuf> = Vec::new();
  if let Some(path) = steam_path_from_registry() {
    roots.push(path);
  }
  for fallback in [
    r"C:\Program Files (x86)\Steam",
    r"C:\Program Files\Steam",
    r"D:\Steam",
    r"D:\SteamLibrary",
  ] {
    roots.push(PathBuf::from(fallback));
  }
  if let Some(home) = std::env::var_os("HOME") {
    roots.push(PathBuf::from(&home).join(".steam/steam"));
    roots.push(PathBuf::from(&home).join(".local/share/Steam"));
  }

  let mut libraries: Vec<PathBuf> = Vec::new();
  for root in roots {
    let vdf = root.join("steamapps").join("libraryfolders.vdf");
    for library in std::iter::once(root.clone()).chain(parse_library_folders(&vdf)) {
      if library.exists() && !libraries.contains(&library) {
        libraries.push(library);
      }
    }
  }
  libraries
}

#[cfg(target_os = "windows")]
fn steam_path_from_registry() -> Option<PathBuf> {
  use winreg::{enums::HKEY_CURRENT_USER, RegKey};
  let steam = RegKey::predef(HKEY_CURRENT_USER).open_subkey(r"Software\Valve\Steam").ok()?;
  let path: String = steam.get_value("SteamPath").ok()?;
  Some(PathBuf::from(path))
}

#[cfg(not(target_os = "windows"))]
fn steam_path_from_registry() -> Option<PathBuf> {
  None
}

/// Extracts `"path" "..."` entries from Steam's libraryfolders.vdf.
pub fn parse_library_folders(path: &Path) -> Vec<PathBuf> {
  let raw = fs::read_to_string(path).unwrap_or_default();
  raw
    .lines()
    .filter_map(|line| {
      let parts: Vec<&str> = line.trim().split('"').collect();
      (parts.len() >= 4 && parts[1] == "path").then(|| PathBuf::from(parts[3].replace("\\\\", "\\")))
    })
    .collect()
}

/// Finds the Steam app id via `steam_appid.txt` or the library's appmanifest files.
fn find_app_id(root: &Path) -> Option<String> {
  if let Ok(id) = fs::read_to_string(root.join("steam_appid.txt")) {
    let id = id.trim();
    if !id.is_empty() && id.chars().all(|c| c.is_ascii_digit()) {
      return Some(id.to_string());
    }
  }
  let install_dir = root.file_name()?.to_string_lossy().to_string();
  let steamapps = root.parent()?.parent()?; // <library>/steamapps/common/<game>
  for entry in fs::read_dir(steamapps).ok()?.flatten() {
    let name = entry.file_name().to_string_lossy().to_string();
    if !(name.starts_with("appmanifest_") && name.ends_with(".acf")) {
      continue;
    }
    let text = fs::read_to_string(entry.path()).unwrap_or_default();
    if vdf_value(&text, "installdir").map(|dir| dir.eq_ignore_ascii_case(&install_dir)).unwrap_or(false) {
      return vdf_value(&text, "appid");
    }
  }
  None
}

fn vdf_value(text: &str, key: &str) -> Option<String> {
  text.lines().find_map(|line| {
    let parts: Vec<&str> = line.trim().split('"').collect();
    (parts.len() >= 4 && parts[1].eq_ignore_ascii_case(key)).then(|| parts[3].to_string())
  })
}

/// Stops running game processes so app.asar is not locked. Returns whether something was stopped.
pub fn stop(install: &Install) -> Result<bool, String> {
  let Some(exe) = &install.exe else { return Ok(false) };
  let name = exe.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
  if name.is_empty() {
    return Ok(false);
  }

  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let list = Command::new("tasklist")
      .args(["/FI", &format!("IMAGENAME eq {name}"), "/NH"])
      .creation_flags(CREATE_NO_WINDOW)
      .output()
      .map_err(|e| format!("tasklist failed: {e}"))?;
    if !String::from_utf8_lossy(&list.stdout).to_lowercase().contains(&name.to_lowercase()) {
      return Ok(false);
    }
    let kill = Command::new("taskkill")
      .args(["/IM", &name, "/F", "/T"])
      .creation_flags(CREATE_NO_WINDOW)
      .output()
      .map_err(|e| format!("taskkill failed: {e}"))?;
    if !kill.status.success() {
      return Err(format!("Could not stop {name}. Close the game and try again."));
    }
    std::thread::sleep(std::time::Duration::from_millis(1200));
    Ok(true)
  }

  #[cfg(not(target_os = "windows"))]
  {
    let stopped = Command::new("pkill").args(["-f", &name]).status().map(|s| s.success()).unwrap_or(false);
    Ok(stopped)
  }
}

/// Launches the game through Steam (falls back to the exe).
pub fn launch(install: &Install) -> Result<(), String> {
  if let Some(id) = &install.app_id {
    return open::that(format!("steam://rungameid/{id}")).map_err(|e| format!("Could not start Steam: {e}"));
  }
  let exe = install.exe.as_ref().ok_or("Game executable not found")?;
  Command::new(exe).current_dir(&install.root).spawn().map(|_| ()).map_err(|e| format!("Could not start the game: {e}"))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parses_library_folders() {
    let dir = tempfile::tempdir().unwrap();
    let vdf = dir.path().join("libraryfolders.vdf");
    fs::write(&vdf, "\"libraryfolders\"\n{\n\t\"0\"\n\t{\n\t\t\"path\"\t\t\"C:\\\\Program Files (x86)\\\\Steam\"\n\t}\n\t\"1\"\n\t{\n\t\t\"path\"\t\t\"D:\\\\SteamLibrary\"\n\t}\n}").unwrap();
    let libs = parse_library_folders(&vdf);
    assert_eq!(libs, vec![PathBuf::from(r"C:\Program Files (x86)\Steam"), PathBuf::from(r"D:\SteamLibrary")]);
  }

  #[test]
  fn resolves_install_and_app_id() {
    let dir = tempfile::tempdir().unwrap();
    let steamapps = dir.path().join("steamapps");
    let root = steamapps.join("common").join("GeoGuessr");
    fs::create_dir_all(root.join("resources")).unwrap();
    fs::write(root.join("resources/app.asar"), b"x").unwrap();
    fs::write(root.join("GeoGuessr.exe"), b"exe").unwrap();
    fs::write(root.join("Uninstall GeoGuessr.exe"), b"exe-but-bigger").unwrap();
    fs::write(steamapps.join("appmanifest_3478870.acf"), "\"AppState\"\n{\n\t\"appid\"\t\t\"3478870\"\n\t\"installdir\"\t\t\"GeoGuessr\"\n}").unwrap();
    let install = resolve(&root).unwrap();
    assert_eq!(install.exe.unwrap().file_name().unwrap(), "GeoGuessr.exe");
    assert_eq!(install.app_id.as_deref(), Some("3478870"));
    assert!(resolve(&root.join("resources")).is_some());
  }
}
