//! Electron fuse handling.
//!
//! If the game was built with `EnableEmbeddedAsarIntegrityValidation`, Electron
//! refuses to start with a modified app.asar. We detect that fuse in the game
//! executable and, when needed, switch it off (and back on when unpatching).

use std::{fs, io, path::Path};

const SENTINEL: &[u8] = b"dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX";
const FUSE_ASAR_INTEGRITY: usize = 4;
const ENABLED: u8 = b'1';
const DISABLED: u8 = b'0';

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
pub enum FuseState {
  Enabled,
  Disabled,
  Missing,
}

/// Byte position of the asar-integrity fuse in `exe`, if the fuse wire exists.
fn fuse_position(bytes: &[u8]) -> Option<usize> {
  let start = bytes.windows(SENTINEL.len()).position(|w| w == SENTINEL)? + SENTINEL.len();
  let _version = *bytes.get(start)?;
  let len = *bytes.get(start + 1)? as usize;
  if FUSE_ASAR_INTEGRITY >= len {
    return None;
  }
  Some(start + 2 + FUSE_ASAR_INTEGRITY)
}

pub fn asar_integrity(exe: &Path) -> io::Result<FuseState> {
  let bytes = fs::read(exe)?;
  Ok(match fuse_position(&bytes).map(|pos| bytes[pos]) {
    Some(ENABLED) => FuseState::Enabled,
    Some(DISABLED) => FuseState::Disabled,
    _ => FuseState::Missing,
  })
}

/// Sets the asar-integrity fuse. Returns `true` if the file was changed.
pub fn set_asar_integrity(exe: &Path, enabled: bool) -> io::Result<bool> {
  let mut bytes = fs::read(exe)?;
  let Some(pos) = fuse_position(&bytes) else { return Ok(false) };
  let wanted = if enabled { ENABLED } else { DISABLED };
  if bytes[pos] == wanted || (bytes[pos] != ENABLED && bytes[pos] != DISABLED) {
    return Ok(false);
  }
  bytes[pos] = wanted;
  fs::write(exe, bytes)?;
  Ok(true)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn flips_integrity_fuse() {
    let dir = tempfile::tempdir().unwrap();
    let exe = dir.path().join("game.exe");
    let mut bytes = b"MZ....".to_vec();
    bytes.extend_from_slice(SENTINEL);
    bytes.extend_from_slice(&[1, 8]);
    bytes.extend_from_slice(b"01001100");
    fs::write(&exe, &bytes).unwrap();
    assert_eq!(asar_integrity(&exe).unwrap(), FuseState::Enabled);
    assert!(set_asar_integrity(&exe, false).unwrap());
    assert_eq!(asar_integrity(&exe).unwrap(), FuseState::Disabled);
    assert!(!set_asar_integrity(&exe, false).unwrap());
  }
}
