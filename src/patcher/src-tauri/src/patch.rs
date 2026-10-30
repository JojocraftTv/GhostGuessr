//! Installing / removing the GhostGuessr loader in the game's app.asar.
//!
//! Patch = header-level edit of app.asar:
//!   + ghostguessr/bootstrap.js     loader (injects + auto-updates the userscript)
//!   + ghostguessr/config.json      original `main`, script URL, options
//!   + ghostguessr/ghostguessr.user.js  userscript snapshot (offline fallback)
//!   + ghostguessr/patch-info.json  original header + data length (for exact restore)
//!   ~ package.json                 `main` -> ghostguessr/bootstrap.js
//! The game's own files are never modified.

use crate::{
  asar::{Archive, Edit},
  fuses::{self, FuseState},
  game::{self, Install},
  remote,
};
use serde::Serialize;
use serde_json::{json, Value};
use std::{
  fs,
  path::Path,
  time::{SystemTime, UNIX_EPOCH},
};

const DIR: &str = "ghostguessr";
const BOOTSTRAP: &str = include_str!("../payload/bootstrap.js");
const LOADER_MAIN: &str = "ghostguessr/bootstrap.js";
const PATCH_INFO: &str = "ghostguessr/patch-info.json";
pub const PATCHER_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Options {
  #[serde(default)]
  pub devtools: bool,
  #[serde(default = "default_true")]
  pub auto_update: bool,
  #[serde(default)]
  pub channel: Channel,
  /// Script URL for `Channel::Local` (default: webpack dev server).
  #[serde(default)]
  pub local_url: Option<String>,
}

impl Options {
  pub fn script_url(&self) -> Result<String, String> {
    match self.channel {
      Channel::Stable => Ok(remote::STABLE_SCRIPT_URL.to_string()),
      Channel::Beta => Ok(remote::BETA_SCRIPT_URL.to_string()),
      Channel::Local => {
        let url = self
          .local_url
          .as_deref()
          .map(str::trim)
          .filter(|u| !u.is_empty())
          .unwrap_or(remote::LOCAL_SCRIPT_URL);
        if url.starts_with("http://") || url.starts_with("https://") {
          Ok(url.to_string())
        } else {
          Err(format!("Local script URL must start with http:// or https:// (got \"{url}\")."))
        }
      }
    }
  }
}

fn default_true() -> bool {
  true
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, serde::Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Channel {
  #[default]
  Stable,
  /// Rolling beta pre-release; "dev" is accepted for settings saved by older patchers.
  #[serde(alias = "dev")]
  Beta,
  /// Local development server (`pnpm serve`), fetched on every page load.
  Local,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum PatchState {
  /// Game files are untouched.
  Clean,
  /// Patched by this patcher generation.
  Patched {
    patcher_version: String,
    script_version: String,
    patched_at: u64,
    channel: String,
    devtools: bool,
    auto_update: bool,
  },
  /// Patched by GhostGuessr Patcher v1/v2 (full repack, string-edited main.js).
  Legacy,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
  pub game_path: String,
  pub game_version: Option<String>,
  pub exe: Option<String>,
  pub can_launch: bool,
  pub state: PatchState,
  pub backup_exists: bool,
  pub integrity_fuse: Option<FuseState>,
}

fn now_ms() -> u64 {
  SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

fn script_version(text: &str) -> String {
  text
    .lines()
    .take(40)
    .find_map(|line| line.trim().strip_prefix("// @version").map(|v| v.trim().to_string()))
    .unwrap_or_else(|| "unknown".into())
}

fn patch_info(archive: &Archive) -> Option<Value> {
  serde_json::from_str(&archive.read_string(PATCH_INFO).ok()?).ok()
}

fn is_legacy(archive: &Archive) -> bool {
  archive.exists("ghostguessr.user.js")
}

pub fn state_of(archive: &Archive) -> PatchState {
  if let Some(info) = patch_info(archive) {
    let config: Value = archive
      .read_string("ghostguessr/config.json")
      .ok()
      .and_then(|t| serde_json::from_str(&t).ok())
      .unwrap_or(Value::Null);
    let script = archive.read_string("ghostguessr/ghostguessr.user.js").unwrap_or_default();
    return PatchState::Patched {
      patcher_version: info["patcherVersion"].as_str().unwrap_or("?").to_string(),
      script_version: script_version(&script),
      patched_at: info["patchedAt"].as_u64().unwrap_or(0),
      channel: config["channel"].as_str().unwrap_or("stable").to_string(),
      devtools: config["devtools"].as_bool().unwrap_or(false),
      auto_update: config["autoUpdate"].as_bool().unwrap_or(true),
    };
  }
  if is_legacy(archive) {
    PatchState::Legacy
  } else {
    PatchState::Clean
  }
}

pub fn status(install: &Install) -> Result<Status, String> {
  let archive = Archive::open(&install.app_asar()).map_err(|e| format!("Could not read app.asar: {e}"))?;
  let (base_header, _) = base(&archive);
  let game_version = archive
    .read_node("package.json", &base_header["files"]["package.json"])
    .ok()
    .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
    .and_then(|pkg| pkg["version"].as_str().map(str::to_string));
  Ok(Status {
    game_path: install.root.to_string_lossy().to_string(),
    game_version,
    exe: install.exe.as_ref().map(|p| p.to_string_lossy().to_string()),
    can_launch: install.app_id.is_some() || install.exe.is_some(),
    state: state_of(&archive),
    backup_exists: install.backup().exists() || install.legacy_backup().exists(),
    integrity_fuse: install.exe.as_ref().and_then(|exe| fuses::asar_integrity(exe).ok()),
  })
}

/// Header + data length of the unpatched archive.
fn base(archive: &Archive) -> (Value, u64) {
  if let Some(info) = patch_info(archive) {
    if let (Some(header), Some(len)) = (info.get("originalHeader"), info["originalDataLen"].as_u64()) {
      return (header.clone(), len);
    }
  }
  (archive.header.clone(), archive.data_len)
}

/// Copy `src` over `dest` via a temp file so a crash never leaves a half-written archive.
fn safe_copy(src: &Path, dest: &Path) -> Result<(), String> {
  let tmp = dest.with_extension("asar.ghostguessr-copy");
  fs::copy(src, &tmp).map_err(|e| format!("Copy failed: {e}"))?;
  fs::rename(&tmp, dest).map_err(|e| format!("Replace failed: {e}"))
}

pub fn patch(install: &Install, options: &Options, log: &mut dyn FnMut(String)) -> Result<String, String> {
  patch_with_script(install, options, None, log)
}

/// Like [`patch`], but with an explicit userscript (`None` = download it).
pub fn patch_with_script(
  install: &Install,
  options: &Options,
  script: Option<String>,
  log: &mut dyn FnMut(String),
) -> Result<String, String> {
  let app_asar = install.app_asar();
  if game::stop(install)? {
    log("Closed the running game.".into());
  }

  let mut archive = Archive::open(&app_asar).map_err(|e| format!("Could not read app.asar: {e}"))?;

  if is_legacy(&archive) && patch_info(&archive).is_none() {
    if install.legacy_backup().exists() {
      log("Found an old GhostGuessr patch, restoring the original app.asar first.".into());
      safe_copy(&install.legacy_backup(), &app_asar)?;
      let _ = fs::remove_file(install.legacy_backup());
      archive = Archive::open(&app_asar).map_err(|e| format!("Could not read app.asar: {e}"))?;
      if is_legacy(&archive) {
        return Err("The old backup is patched as well. Verify the game files in Steam, then patch again.".into());
      }
    } else {
      return Err("This install was patched by an old patcher and no backup exists. Verify the game files in Steam (Properties → Installed Files), then patch again.".into());
    }
  }

  let previous = patch_info(&archive);
  if previous.is_none() {
    fs::copy(&app_asar, install.backup()).map_err(|e| format!("Could not create backup: {e}"))?;
    log(format!("Backup saved to {}", install.backup().display()));
  }

  let (base_header, base_len) = base(&archive);
  let pkg_bytes = archive
    .read_node("package.json", &base_header["files"]["package.json"])
    .map_err(|e| format!("Could not read the game's package.json: {e}"))?;
  let mut pkg: Value = serde_json::from_slice(&pkg_bytes).map_err(|e| format!("Invalid package.json: {e}"))?;
  let original_main = pkg["main"].as_str().unwrap_or("index.js").trim_start_matches("./").to_string();
  if original_main == LOADER_MAIN {
    return Err("package.json already points at the loader; verify the game files in Steam.".into());
  }
  let main_exists = {
    let mut node = &base_header;
    original_main.split('/').all(|part| match node.get("files").and_then(|f| f.get(part)) {
      Some(next) => {
        node = next;
        true
      }
      None => false,
    })
  };
  if !main_exists {
    return Err(format!("The game's entry point ({original_main}) was not found in app.asar."));
  }
  log(format!("Game entry point: {original_main}"));

  let url = options.script_url()?;
  let downloaded = match script {
    Some(text) => Ok(text),
    None => {
      log(format!("Downloading userscript from {url}…"));
      remote::fetch_script(&url)
    }
  };
  let script = match downloaded {
    Ok(text) => text,
    Err(error) => {
      let cached = archive.read_string("ghostguessr/ghostguessr.user.js").ok().filter(|t| !t.is_empty());
      match cached {
        Some(text) => {
          log(format!("Download failed ({error}); reusing the installed copy."));
          text
        }
        // The local server only has to run while playing; the loader fetches it on every page load.
        None if options.channel == Channel::Local => {
          log(format!("Local server not reachable ({error}). Start it before launching the game (pnpm serve)."));
          String::new()
        }
        None => return Err(format!("Could not download the userscript: {error}")),
      }
    }
  };
  log(format!("Userscript version {}", script_version(&script)));

  let fuse_was_disabled_by_us = previous.as_ref().and_then(|p| p["fuseDisabled"].as_bool()).unwrap_or(false);
  let need_fuse_flip = install
    .exe
    .as_ref()
    .map(|exe| matches!(fuses::asar_integrity(exe), Ok(FuseState::Enabled)))
    .unwrap_or(false);

  let patched_at = now_ms();
  let config = json!({
    "originalMain": original_main,
    "scriptUrl": url,
    "channel": options.channel,
    "autoUpdate": options.auto_update,
    "devtools": options.devtools,
    "patchedAt": patched_at,
    "patcherVersion": PATCHER_VERSION,
  });
  let info = json!({
    "patcherVersion": PATCHER_VERSION,
    "patchedAt": patched_at,
    "originalDataLen": base_len,
    "fuseDisabled": fuse_was_disabled_by_us || need_fuse_flip,
    "originalHeader": base_header,
  });
  pkg["main"] = Value::String(LOADER_MAIN.into());

  let mut edit = Edit::with_base(base_header, base_len);
  edit.put(&format!("{DIR}/bootstrap.js"), BOOTSTRAP.as_bytes());
  edit.put(&format!("{DIR}/config.json"), serde_json::to_string_pretty(&config).unwrap().as_bytes());
  edit.put(&format!("{DIR}/ghostguessr.user.js"), script.as_bytes());
  edit.put(PATCH_INFO, serde_json::to_string(&info).unwrap().as_bytes());
  edit.put("package.json", serde_json::to_string_pretty(&pkg).unwrap().as_bytes());
  edit.write(&archive, &app_asar).map_err(|e| format!("Could not write app.asar: {e}"))?;

  if need_fuse_flip {
    let exe = install.exe.as_ref().unwrap();
    fuses::set_asar_integrity(exe, false).map_err(|e| format!("Could not update {}: {e}", exe.display()))?;
    log("Disabled Electron's asar integrity check (required for the patch).".into());
  }

  Ok(if previous.is_some() { "GhostGuessr updated.".into() } else { "GhostGuessr installed.".into() })
}

pub fn unpatch(install: &Install, log: &mut dyn FnMut(String)) -> Result<String, String> {
  let app_asar = install.app_asar();
  if game::stop(install)? {
    log("Closed the running game.".into());
  }
  let archive = Archive::open(&app_asar).map_err(|e| format!("Could not read app.asar: {e}"))?;

  if let Some(info) = patch_info(&archive) {
    let (header, len) = base(&archive);
    Edit::with_base(header, len)
      .write(&archive, &app_asar)
      .map_err(|e| format!("Could not restore app.asar: {e}"))?;
    if info["fuseDisabled"].as_bool().unwrap_or(false) {
      if let Some(exe) = &install.exe {
        let _ = fuses::set_asar_integrity(exe, true);
        log("Re-enabled Electron's asar integrity check.".into());
      }
    }
    let _ = fs::remove_file(install.backup());
    return Ok("GhostGuessr removed. The game is back to its original state.".into());
  }

  if is_legacy(&archive) {
    for backup in [install.legacy_backup(), install.backup()] {
      if backup.exists() {
        safe_copy(&backup, &app_asar)?;
        let _ = fs::remove_file(&backup);
        return Ok("Old GhostGuessr patch removed.".into());
      }
    }
    return Err("No backup found. Verify the game files in Steam to remove the old patch.".into());
  }

  Ok("GhostGuessr is not installed. Nothing to do.".into())
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::asar::{encode_header, integrity};

  fn fake_install(dir: &Path) -> Install {
    let resources = dir.join("resources");
    fs::create_dir_all(&resources).unwrap();
    let pkg = br#"{"name":"geoguessr-steam-edition","version":"1.1.0","main":"dist/main.js"}"#;
    let main = b"require('electron');";
    let header = json!({ "files": {
      "package.json": { "size": pkg.len(), "offset": "0", "integrity": integrity(pkg) },
      "dist": { "files": { "main.js": { "size": main.len(), "offset": pkg.len().to_string(), "integrity": integrity(main) } } },
      "redistributable_bin": { "unpacked": true, "files": { "win64": { "unpacked": true, "files": {
        "steam_api64.dll": { "size": 3, "unpacked": true, "integrity": integrity(b"dll") } } } } }
    }});
    let mut bytes = encode_header(&header.to_string());
    bytes.extend_from_slice(pkg);
    bytes.extend_from_slice(main);
    fs::write(resources.join("app.asar"), bytes).unwrap();
    Install { root: dir.to_path_buf(), resources, exe: None, app_id: None }
  }

  #[test]
  fn patch_and_unpatch_roundtrip() {
    let dir = tempfile::tempdir().unwrap();
    let install = fake_install(dir.path());
    let original = fs::read(install.app_asar()).unwrap();
    let mut logs = Vec::new();

    let script = || Some("// ==UserScript==\n// @version 3.0.0\n// GhostGuessr test".to_string());
    patch_with_script(&install, &Options::default(), script(), &mut |m| logs.push(m)).unwrap();

    let archive = Archive::open(&install.app_asar()).unwrap();
    let pkg: Value = serde_json::from_str(&archive.read_string("package.json").unwrap()).unwrap();
    assert_eq!(pkg["main"], "ghostguessr/bootstrap.js");
    assert_eq!(pkg["version"], "1.1.0");
    assert!(archive.read_string("ghostguessr/bootstrap.js").unwrap().contains("GhostGuessr Steam loader"));
    let config: Value = serde_json::from_str(&archive.read_string("ghostguessr/config.json").unwrap()).unwrap();
    assert_eq!(config["originalMain"], "dist/main.js");
    assert_eq!(archive.node("redistributable_bin/win64/steam_api64.dll").unwrap()["unpacked"], json!(true));
    assert!(matches!(state_of(&archive), PatchState::Patched { .. }));
    assert!(install.backup().exists());

    // Re-patching keeps a single copy of the payload.
    patch_with_script(&install, &Options::default(), script(), &mut |m| logs.push(m)).unwrap();
    let size_after_repatch = fs::metadata(install.app_asar()).unwrap().len();
    patch_with_script(&install, &Options::default(), script(), &mut |m| logs.push(m)).unwrap();
    assert_eq!(size_after_repatch, fs::metadata(install.app_asar()).unwrap().len());

    unpatch(&install, &mut |m| logs.push(m)).unwrap();
    let restored = Archive::open(&install.app_asar()).unwrap();
    assert_eq!(state_of(&restored), PatchState::Clean);
    assert_eq!(restored.read_string("dist/main.js").unwrap(), "require('electron');");
    assert_eq!(fs::read(install.app_asar()).unwrap(), original);
    assert!(!install.backup().exists());
  }

  #[test]
  fn local_channel_patches_without_running_server() {
    let dir = tempfile::tempdir().unwrap();
    let install = fake_install(dir.path());
    let options: Options =
      serde_json::from_str(r#"{"channel":"local","localUrl":"http://127.0.0.1:9/ghostguessr-core.user.js","devtools":true}"#).unwrap();
    patch(&install, &options, &mut |_| {}).unwrap();
    let archive = Archive::open(&install.app_asar()).unwrap();
    let config: Value = serde_json::from_str(&archive.read_string("ghostguessr/config.json").unwrap()).unwrap();
    assert_eq!(config["channel"], "local");
    assert_eq!(config["scriptUrl"], "http://127.0.0.1:9/ghostguessr-core.user.js");
    assert_eq!(config["devtools"], true);

    let bad: Options = serde_json::from_str(r#"{"channel":"local","localUrl":"file:///x"}"#).unwrap();
    assert!(bad.script_url().is_err());
  }
}
