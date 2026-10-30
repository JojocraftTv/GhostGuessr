//! Minimal, header-level ASAR archive editing.
//!
//! The patcher never extracts and re-packs the game archive. It only rewrites
//! the JSON header and appends new file contents to the end of the data
//! section. Everything else — offsets of existing files, `unpacked` flags for
//! native modules (koffi, steam_api64.dll, ...), symlinks, executable bits —
//! stays exactly as the game shipped it.
//!
//! Layout (Chromium pickle encoding):
//! ```text
//! u32 4 | u32 header_pickle_len | u32 payload_len | u32 json_len | json | pad to 4 | data...
//! ```
//! File offsets in the header are relative to the start of `data`.

use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::{
  fs::{self, File},
  io::{self, BufReader, BufWriter, Read, Seek, SeekFrom, Write},
  path::{Path, PathBuf},
};

pub const BLOCK_SIZE: usize = 4 * 1024 * 1024;

#[derive(Debug)]
pub struct Archive {
  pub path: PathBuf,
  pub header: Value,
  /// Absolute file offset where the data section starts.
  pub data_offset: u64,
  /// Length of the data section.
  pub data_len: u64,
}

fn read_u32(buf: &[u8], at: usize) -> io::Result<u32> {
  buf
    .get(at..at + 4)
    .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
    .ok_or_else(|| invalid("archive header is truncated"))
}

fn invalid(msg: &str) -> io::Error {
  io::Error::new(io::ErrorKind::InvalidData, msg.to_string())
}

/// Integrity block in the format Electron expects.
pub fn integrity(data: &[u8]) -> Value {
  let blocks: Vec<String> = data
    .chunks(BLOCK_SIZE)
    .map(|chunk| hex::encode(Sha256::digest(chunk)))
    .collect();
  json!({
    "algorithm": "SHA256",
    "hash": hex::encode(Sha256::digest(data)),
    "blockSize": BLOCK_SIZE,
    "blocks": if blocks.is_empty() { vec![hex::encode(Sha256::digest([]))] } else { blocks },
  })
}

/// Serialises a header JSON string into the two pickles that prefix the archive.
pub fn encode_header(json_text: &str) -> Vec<u8> {
  let json_len = json_text.len();
  let padded = (json_len + 3) & !3;
  let payload_len = 4 + padded; // string length prefix + padded string
  let header_pickle_len = 4 + payload_len; // pickle payload size prefix + payload
  let mut out = Vec::with_capacity(8 + header_pickle_len);
  out.extend_from_slice(&4u32.to_le_bytes());
  out.extend_from_slice(&(header_pickle_len as u32).to_le_bytes());
  out.extend_from_slice(&(payload_len as u32).to_le_bytes());
  out.extend_from_slice(&(json_len as u32).to_le_bytes());
  out.extend_from_slice(json_text.as_bytes());
  out.resize(8 + header_pickle_len, 0);
  out
}

impl Archive {
  pub fn open(path: &Path) -> io::Result<Self> {
    let mut file = File::open(path)?;
    let total = file.metadata()?.len();
    let mut size_pickle = [0u8; 8];
    file.read_exact(&mut size_pickle)?;
    let header_pickle_len = read_u32(&size_pickle, 4)? as usize;
    if header_pickle_len < 8 || header_pickle_len as u64 > total {
      return Err(invalid("not an asar archive"));
    }
    let mut header_pickle = vec![0u8; header_pickle_len];
    file.read_exact(&mut header_pickle)?;
    let json_len = read_u32(&header_pickle, 4)? as usize;
    let json_bytes = header_pickle
      .get(8..8 + json_len)
      .ok_or_else(|| invalid("archive header is truncated"))?;
    let header: Value = serde_json::from_slice(json_bytes).map_err(|e| invalid(&format!("bad asar header: {e}")))?;
    if !header.get("files").map(Value::is_object).unwrap_or(false) {
      return Err(invalid("asar header has no files"));
    }
    let data_offset = 8 + header_pickle_len as u64;
    Ok(Self { path: path.to_path_buf(), header, data_offset, data_len: total - data_offset })
  }

  fn unpacked_dir(&self) -> PathBuf {
    let mut name = self.path.as_os_str().to_owned();
    name.push(".unpacked");
    PathBuf::from(name)
  }

  /// Header node for `a/b/c.js` (forward slashes), if it exists.
  pub fn node(&self, entry: &str) -> Option<&Value> {
    let mut node = &self.header;
    for part in entry.split('/').filter(|p| !p.is_empty()) {
      node = node.get("files")?.get(part)?;
    }
    Some(node)
  }

  pub fn exists(&self, entry: &str) -> bool {
    self.node(entry).is_some()
  }

  /// Reads a regular file from the archive (or from `app.asar.unpacked`).
  pub fn read(&self, entry: &str) -> io::Result<Vec<u8>> {
    let node = self.node(entry).ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, format!("{entry} not in archive")))?;
    self.read_node(entry, node)
  }

  /// Reads the file described by `node` (which may come from an older header of this archive).
  pub fn read_node(&self, entry: &str, node: &Value) -> io::Result<Vec<u8>> {
    if node.get("unpacked").and_then(Value::as_bool).unwrap_or(false) {
      return fs::read(self.unpacked_dir().join(entry));
    }
    let size = node.get("size").and_then(Value::as_u64).ok_or_else(|| invalid("entry has no size"))?;
    let offset: u64 = match node.get("offset") {
      Some(Value::String(s)) => s.parse().map_err(|_| invalid("bad offset"))?,
      Some(Value::Number(n)) => n.as_u64().ok_or_else(|| invalid("bad offset"))?,
      _ => return Err(invalid("entry has no offset")),
    };
    if offset + size > self.data_len {
      return Err(invalid("entry points outside of the archive"));
    }
    let mut file = File::open(&self.path)?;
    file.seek(SeekFrom::Start(self.data_offset + offset))?;
    let mut buf = vec![0u8; size as usize];
    file.read_exact(&mut buf)?;
    Ok(buf)
  }

  pub fn read_string(&self, entry: &str) -> io::Result<String> {
    String::from_utf8(self.read(entry)?).map_err(|_| invalid("entry is not UTF-8"))
  }
}

/// A pending set of header edits plus data to append.
pub struct Edit {
  header: Value,
  /// Bytes of the original data section to keep (allows dropping a previous patch).
  keep_data: u64,
  appended: Vec<u8>,
}

impl Edit {
  pub fn new(archive: &Archive) -> Self {
    Self { header: archive.header.clone(), keep_data: archive.data_len, appended: Vec::new() }
  }

  /// Starts from an explicit header / data length (used to revert an earlier patch).
  pub fn with_base(header: Value, keep_data: u64) -> Self {
    Self { header, keep_data, appended: Vec::new() }
  }

  fn dir_mut(&mut self, parts: &[&str]) -> &mut Map<String, Value> {
    let mut node = &mut self.header;
    for part in parts {
      let files = node
        .as_object_mut()
        .expect("asar node is an object")
        .entry("files")
        .or_insert_with(|| Value::Object(Map::new()));
      node = files
        .as_object_mut()
        .expect("files is an object")
        .entry(part.to_string())
        .or_insert_with(|| json!({ "files": {} }));
    }
    node
      .as_object_mut()
      .expect("asar node is an object")
      .entry("files")
      .or_insert_with(|| Value::Object(Map::new()))
      .as_object_mut()
      .expect("files is an object")
  }

  /// Adds or replaces a file. Replaced content stays in the data section but is no longer referenced.
  pub fn put(&mut self, entry: &str, data: &[u8]) {
    let parts: Vec<&str> = entry.split('/').filter(|p| !p.is_empty()).collect();
    let (name, dirs) = parts.split_last().expect("entry has a name");
    let offset = self.keep_data + self.appended.len() as u64;
    self.appended.extend_from_slice(data);
    let node = json!({ "size": data.len(), "offset": offset.to_string(), "integrity": integrity(data) });
    self.dir_mut(dirs).insert(name.to_string(), node);
  }

  /// Removes a file or directory node.
  pub fn remove(&mut self, entry: &str) -> Option<Value> {
    let parts: Vec<&str> = entry.split('/').filter(|p| !p.is_empty()).collect();
    let (name, dirs) = parts.split_last()?;
    self.dir_mut(dirs).remove(*name)
  }

  pub fn set_node(&mut self, entry: &str, node: Value) {
    let parts: Vec<&str> = entry.split('/').filter(|p| !p.is_empty()).collect();
    let (name, dirs) = parts.split_last().expect("entry has a name");
    self.dir_mut(dirs).insert(name.to_string(), node);
  }

  pub fn header(&self) -> &Value {
    &self.header
  }

  /// Writes the new archive next to `source` and atomically replaces `dest`.
  pub fn write(self, source: &Archive, dest: &Path) -> io::Result<()> {
    let json_text = serde_json::to_string(&self.header).map_err(|e| invalid(&e.to_string()))?;
    let tmp = dest.with_extension("asar.ghostguessr-tmp");
    {
      let mut out = BufWriter::new(File::create(&tmp)?);
      out.write_all(&encode_header(&json_text))?;
      let mut input = BufReader::new(File::open(&source.path)?);
      input.seek(SeekFrom::Start(source.data_offset))?;
      let copied = io::copy(&mut input.take(self.keep_data), &mut out)?;
      if copied != self.keep_data {
        drop(out);
        let _ = fs::remove_file(&tmp);
        return Err(invalid("archive ended early while copying"));
      }
      out.write_all(&self.appended)?;
      out.flush()?;
      out.get_ref().sync_all()?;
    }
    // Validate before replacing the game file.
    if let Err(error) = Archive::open(&tmp) {
      let _ = fs::remove_file(&tmp);
      return Err(error);
    }
    fs::rename(&tmp, dest).or_else(|_| {
      // rename can fail across volumes or when the target is locked; fall back to copy.
      fs::copy(&tmp, dest)?;
      fs::remove_file(&tmp)
    })
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  /// Builds a small archive with `package.json` packed and `bin/native.dll` unpacked.
  fn fixture(dir: &Path) -> PathBuf {
    let pkg = br#"{"name":"game","main":"dist/main.js"}"#;
    let main = b"console.log('game');";
    let header = json!({ "files": {
      "package.json": { "size": pkg.len(), "offset": "0", "integrity": integrity(pkg) },
      "dist": { "files": { "main.js": { "size": main.len(), "offset": pkg.len().to_string(), "integrity": integrity(main) } } },
      "bin": { "unpacked": true, "files": { "native.dll": { "size": 3, "unpacked": true, "integrity": integrity(b"dll") } } }
    }});
    let path = dir.join("app.asar");
    let mut bytes = encode_header(&header.to_string());
    bytes.extend_from_slice(pkg);
    bytes.extend_from_slice(main);
    fs::write(&path, bytes).unwrap();
    fs::create_dir_all(dir.join("app.asar.unpacked/bin")).unwrap();
    fs::write(dir.join("app.asar.unpacked/bin/native.dll"), b"dll").unwrap();
    path
  }

  #[test]
  fn reads_and_appends() {
    let dir = tempfile::tempdir().unwrap();
    let path = fixture(dir.path());
    let archive = Archive::open(&path).unwrap();
    assert_eq!(archive.read_string("dist/main.js").unwrap(), "console.log('game');");
    assert_eq!(archive.read("bin/native.dll").unwrap(), b"dll");

    let mut edit = Edit::new(&archive);
    edit.put("ghostguessr/bootstrap.js", b"require('../dist/main.js')");
    edit.put("package.json", br#"{"main":"ghostguessr/bootstrap.js"}"#);
    edit.write(&archive, &path).unwrap();

    let patched = Archive::open(&path).unwrap();
    assert_eq!(patched.read_string("ghostguessr/bootstrap.js").unwrap(), "require('../dist/main.js')");
    assert_eq!(patched.read_string("package.json").unwrap(), r#"{"main":"ghostguessr/bootstrap.js"}"#);
    assert_eq!(patched.read_string("dist/main.js").unwrap(), "console.log('game');");
    assert_eq!(patched.node("bin/native.dll").unwrap()["unpacked"], json!(true));
  }
}
