//! Network access: userscript download and patcher update check.

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{fs, io::Read, path::Path, time::Duration};

/// Script of the latest full release (v* tag).
pub const STABLE_SCRIPT_URL: &str = "https://github.com/JojocraftTv/GhostGuessr/releases/latest/download/ghostguessr-core.user.js";
/// Script of the rolling "beta" pre-release (rebuilt on every push to main).
pub const BETA_SCRIPT_URL: &str = "https://github.com/JojocraftTv/GhostGuessr/releases/download/beta/ghostguessr-core.user.js";
/// Default local dev server URL (`pnpm serve` / webpack-dev-server).
pub const LOCAL_SCRIPT_URL: &str = "http://localhost:8080/ghostguessr-core.user.js";
/// Release channel this patcher was built for (CI sets GG_CHANNEL=beta for pre-releases).
pub const PATCHER_CHANNEL: &str = match option_env!("GG_CHANNEL") {
  Some(channel) => channel,
  None => "stable",
};

fn releases_api() -> &'static str {
  if PATCHER_CHANNEL == "beta" {
    "https://api.github.com/repos/JojocraftTv/GhostGuessr/releases/tags/beta"
  } else {
    "https://api.github.com/repos/JojocraftTv/GhostGuessr/releases/latest"
  }
}
pub const RELEASES_URL: &str = "https://github.com/JojocraftTv/GhostGuessr/releases/latest";

fn client() -> Result<reqwest::blocking::Client, String> {
  reqwest::blocking::Client::builder()
    .user_agent(concat!("GhostGuessr-Patcher/", env!("CARGO_PKG_VERSION")))
    .timeout(Duration::from_secs(15))
    .build()
    .map_err(|e| format!("HTTP client error: {e}"))
}

/// Downloads the userscript and sanity-checks it.
pub fn fetch_script(url: &str) -> Result<String, String> {
  #[cfg(debug_assertions)]
  let url = std::env::var("GHOSTGUESSR_SCRIPT_URL").unwrap_or_else(|_| url.to_string());

  let response = client()?.get(url).send().map_err(|e| format!("request failed: {e}"))?;
  if !response.status().is_success() {
    return Err(format!("HTTP {}", response.status()));
  }
  let text = response.text().map_err(|e| format!("could not read response: {e}"))?;
  if !text.contains("==UserScript==") || !text.contains("GhostGuessr") {
    return Err("downloaded file is not the GhostGuessr userscript".into());
  }
  Ok(text)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
  pub available: bool,
  pub current: String,
  pub latest: String,
  pub url: String,
}

fn file_sha256(path: &Path) -> Option<String> {
  let mut file = fs::File::open(path).ok()?;
  let mut hasher = Sha256::new();
  let mut buf = vec![0u8; 64 * 1024];
  loop {
    let n = file.read(&mut buf).ok()?;
    if n == 0 {
      break;
    }
    hasher.update(&buf[..n]);
  }
  Some(hex::encode(hasher.finalize()))
}

fn version_gt(a: &str, b: &str) -> bool {
  let parse = |v: &str| -> Vec<u64> { v.trim_start_matches('v').split(['.', '-']).map(|p| p.parse().unwrap_or(0)).collect() };
  let (a, b) = (parse(a), parse(b));
  for i in 0..a.len().max(b.len()) {
    let (x, y) = (a.get(i).copied().unwrap_or(0), b.get(i).copied().unwrap_or(0));
    if x != y {
      return x > y;
    }
  }
  false
}

/// Compares the newest release of this patcher's channel with this build, using the
/// release's update.json ({ version, digest }) when available, else the tag.
pub fn check_patcher_update() -> Result<UpdateInfo, String> {
  let client = client()?;
  let release: serde_json::Value = client
    .get(releases_api())
    .send()
    .and_then(|r| r.error_for_status())
    .map_err(|e| format!("GitHub request failed: {e}"))?
    .json()
    .map_err(|e| format!("Invalid GitHub response: {e}"))?;

  let current = env!("CARGO_PKG_VERSION").to_string();
  let url = release["html_url"].as_str().unwrap_or(RELEASES_URL).to_string();
  let update: serde_json::Value = release["assets"]
    .as_array()
    .and_then(|assets| assets.iter().find(|a| a["name"] == "update.json"))
    .and_then(|asset| asset["browser_download_url"].as_str())
    .and_then(|u| client.get(u).send().ok()?.json::<serde_json::Value>().ok())
    .unwrap_or(serde_json::Value::Null);

  let latest = update["version"]
    .as_str()
    .map(str::to_string)
    .unwrap_or_else(|| release["tag_name"].as_str().unwrap_or("").to_string())
    .trim_start_matches('v')
    .to_string();
  let digest = update["digest"].as_str().map(|d| d.trim().to_lowercase());

  let available = if latest.is_empty() || latest == current {
    false
  } else {
    match (digest, std::env::current_exe().ok().and_then(|exe| file_sha256(&exe))) {
      (Some(remote), Some(local)) => remote != format!("sha256:{local}"),
      _ => version_gt(&latest, &current),
    }
  };

  Ok(UpdateInfo { available, current, latest, url })
}

#[cfg(test)]
mod tests {
  use super::version_gt;

  #[test]
  fn compares_versions() {
    assert!(version_gt("3.0.1", "3.0.0"));
    assert!(version_gt("v3.1", "3.0.9"));
    assert!(!version_gt("3.0.0", "3.0.0"));
    assert!(!version_gt("2.9.9", "3.0.0"));
  }
}
