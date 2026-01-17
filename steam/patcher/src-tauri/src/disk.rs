use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use crate::pickle::Pickle;
use tempfile::NamedTempFile;

use crate::filesystem::get_dir;
use crate::{
  error::{Error, ErrorKind, Result},
  node::Node,
};

pub fn read_archive_header<T: AsRef<Path>>(archive: T) -> Result<(String, Node, usize, File)> {
  let mut fd = File::open(archive)?;
  let mut size_buf = [0u8; 8];
  fd.read(&mut size_buf)
    .map_err(|_| Error::new(ErrorKind::InvalidHeaderSize))?;
  let size_pickle = Pickle::from_slice(&size_buf);
  let size = size_pickle.create_iterator().read_uint32() as usize;
  let mut header_buf = vec![0u8; size];
  fd.read(&mut header_buf)
    .map_err(|_| Error::new(ErrorKind::InvalidHeader))?;

  let header_pickle = Pickle::from_vec(header_buf);
  let header = header_pickle.create_iterator().read_string();
  let json_value = serde_json::from_str(&header)?;
  Ok((header, json_value, size, fd))
}

pub struct FileItem {
  pub filename: String,
  pub unpack: bool,
  pub transformed_file: Option<NamedTempFile>,
}

pub fn write_filesystem<T: AsRef<Path>>(
  dest: T,
  filesystem: &crate::filesystem::Filesystem,
  files: &mut Vec<FileItem>,
) -> Result<()> {
  let mut header_pickle = Pickle::new();
  header_pickle.write_string(&serde_json::to_string(&filesystem.header)?);
  let header_buf = header_pickle.to_vec();

  let mut size_pickle = Pickle::new();
  size_pickle.write_uint32(header_buf.len() as u32);
  let size_buf = size_pickle.to_vec();

  let mut options = std::fs::OpenOptions::new();
  options.create(true).write(true);
  let mut asar = options.open(&dest)?;

  asar.write(&size_buf)?;
  asar.write(&header_buf)?;

  for f in files.iter_mut() {
    if f.unpack {
      let filename = crate::filesystem::relative(&filesystem.src, &f.filename)?;
      let target =
        PathBuf::from(dest.as_ref().to_string_lossy().to_string() + &".unpacked").join(filename);
      std::fs::create_dir_all(get_dir(&target))?;
      std::fs::copy(&f.filename, &target)?;
    } else {
      if let Some(transformed_filename) = &mut f.transformed_file {
        let fd = transformed_filename.as_file_mut();
        fd.seek(SeekFrom::Start(0))?;
        std::io::copy(fd, &mut asar)?;
        std::fs::remove_file(transformed_filename)?;
      } else {
        let mut fd = File::open(&f.filename)?;
        std::io::copy(&mut fd, &mut asar)?;
      }
    }
  }

  Ok(())
}
