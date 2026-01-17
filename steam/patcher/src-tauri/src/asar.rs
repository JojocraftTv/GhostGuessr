use std::{
  collections::HashMap,
  ffi::OsStr,
  fs::{File, Metadata},
  io::{Read, Seek, Write},
  path::{Path, PathBuf},
};

#[cfg(not(target_os = "windows"))]
use std::os::unix::prelude::MetadataExt;

use crate::{
  crawlfs::{crawl_filesystem, determine_file_type},
  disk::{read_archive_header, FileItem},
  error::{Error, ErrorKind, Result},
  filesystem::{get_dir, Filesystem},
  integrity::{get_file_integrity, BUFFER_SIZE},
  node::{DirectoryNode, FileNode, LinkNode, Node},
};
use glob::MatchOptions;
use path_absolutize::*;

#[cfg(not(target_os = "windows"))]
use std::os::unix::fs::OpenOptionsExt;

#[cfg(target_os = "windows")]
const FOLLOW_LINKS: bool = true;

#[cfg(not(target_os = "windows"))]
const FOLLOW_LINKS: bool = false;

#[cfg(target_os = "windows")]
fn symlink<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) -> std::io::Result<()> {
  let fullorigin = get_dir(link.as_ref()).join(&original);
  if std::fs::metadata(&fullorigin)?.is_dir() {
    std::os::windows::fs::symlink_dir(&original, link)
  } else {
    std::os::windows::fs::symlink_file(&original, link)
  }
}

#[cfg(not(target_os = "windows"))]
fn symlink<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) -> std::io::Result<()> {
  std::os::unix::fs::symlink(original, link)
}

#[derive(Clone)]
pub struct ListOptions {
  pub is_pack: bool,
}

impl ListOptions {
  pub fn new() -> Self {
    ListOptions { is_pack: false }
  }
}

pub struct AsarFile {
  fd: File,
  filesystem: Filesystem,
}

impl AsarFile {
  pub fn open<T: AsRef<Path>>(archive: T) -> Result<Self> {
    let (_, header, header_size, fd) = read_archive_header(&archive)?;
    let mut filesystem = Filesystem::new(archive.as_ref().absolutize()?.to_path_buf());
    filesystem.header = header;
    filesystem.header_size = header_size as u64;
    Ok(AsarFile { fd, filesystem })
  }

  pub fn list(&self, options: &ListOptions) -> Result<Vec<String>> {
    self.filesystem.list_files(options)
  }

  fn extract_file_node<T: AsRef<Path>>(
    &mut self,
    filename: &str,
    node: FileNode,
    dest: T,
  ) -> Result<()> {
    let FileNode {
      offset,
      size,
      unpacked,
      executable,
      ..
    } = node;
    let info_size = size;
    let info_unpacked = unpacked.unwrap_or(false);
    if info_unpacked {
      let unpacked_dir = self.filesystem.src.to_string_lossy().as_ref().to_owned() + &".unpacked";
      let target_path = PathBuf::from(unpacked_dir).join(&filename);
      std::fs::create_dir_all(crate::filesystem::get_dir(&dest))?;
      std::fs::copy(target_path, &dest)?;
    } else {
      let info_offset = u64::from_str_radix(
        &offset
          .as_ref()
          .ok_or_else(|| Error::new(ErrorKind::UnknownOffset(filename.to_owned())))?,
        10,
      )?;
      let offset = 8u64 + self.filesystem.header_size + info_offset;

      let mut left = info_size;
      self.fd.seek(std::io::SeekFrom::Start(offset))?;
      let mut options = std::fs::OpenOptions::new();
      options.create(true).write(true);
      if executable.unwrap_or(false) {
        #[cfg(not(target_os = "windows"))]
        options.mode(0o755);
      }
      let mut buffer = vec![0; BUFFER_SIZE];
      let mut dest_fd = options.open(&dest)?;
      while left > 0 {
        let read_size = self.fd.read(&mut buffer)?;
        assert!(read_size > 0, "failed to read file: {}", filename);
        if read_size > left {
          dest_fd.write(&buffer[0..left])?;
          break;
        } else {
          dest_fd.write(&buffer[0..read_size])?;
          left -= read_size;
        };
      }
    }

    Ok(())
  }

  pub fn extract_all<T: AsRef<Path>>(&mut self, dest: T) -> Result<()> {
    let filenames = self.list(&ListOptions::new())?;
    std::fs::create_dir_all(&dest)?;

    let mut extraction_erros: Vec<Error> = Vec::new();
    for full_path in filenames.iter() {
      let filename = &full_path[1..];
      let dest_ref = dest.as_ref();
      let dest_filename = dest_ref.join(filename);
      let file = self.filesystem.get_file(filename, Some(FOLLOW_LINKS))?;

      match file {
        Node::Directory(..) => {
          std::fs::create_dir_all(&dest_filename)?;
        }
        Node::Link(LinkNode { link }) => {
          let link_src_path = dest_ref.join(link);
          let link_src_path = crate::filesystem::get_dir(link_src_path);
          let link_dest_path = crate::filesystem::get_dir(&dest_filename);
          let relative_path = crate::filesystem::relative(&link_dest_path, &link_src_path)?;
          let _ = std::fs::remove_file(&dest_filename);
          let link_to =
            relative_path.join(PathBuf::from(link).file_name().unwrap_or(&OsStr::new("..")));
          symlink(link_to, &dest_filename)?;
        }
        Node::File(node) => {
          if let Err(e) = self.extract_file_node(filename, node.clone(), dest_filename.as_path()) {
            extraction_erros.push(e);
          }
        }
      };
    }

    if extraction_erros.len() > 0 {
      return Err(Error::new(ErrorKind::Extraction(extraction_erros)));
    }

    Ok(())
  }
}

pub struct CreateOptions {
  pub pattern: String,
  pub dot: Option<bool>,
  pub ordering: Option<PathBuf>,
  pub unpack_dir: Option<String>,
  pub unpack: Option<String>,
  pub transform: Option<fn(&str) -> Option<Box<dyn Transform>>>,
}

pub trait Transform: Read + Write {
  fn transform(&mut self, buf: &[u8]) -> std::io::Result<usize> {
    Ok(self.write(buf)?)
  }
}

impl CreateOptions {
  pub fn new() -> Self {
    CreateOptions {
      pattern: "/**/*".to_owned(),
      dot: None,
      ordering: None,
      unpack_dir: None,
      unpack: None,
      transform: None,
    }
  }
}

pub fn list_package<T: AsRef<Path>>(archive: T) -> Result<Vec<String>> {
  list_package_with_options(archive, &ListOptions::new())
}

pub fn list_package_with_options<T: AsRef<Path>>(
  archive: T,
  options: &ListOptions,
) -> Result<Vec<String>> {
  let asar = AsarFile::open(archive)?;
  asar.list(options)
}

pub fn extract_all<T: AsRef<Path>, U: AsRef<Path>>(archive: T, dest: U) -> Result<()> {
  let mut asar = AsarFile::open(archive)?;
  asar.extract_all(dest)
}

pub fn create_package_with_options<S: AsRef<Path>, D: AsRef<Path>>(
  src: S,
  dest: D,
  options: &CreateOptions,
) -> Result<()> {
  let (filenames, mut metadata) = crawl_filesystem(
    src.as_ref().to_string_lossy().to_string() + &options.pattern,
    MatchOptions {
      case_sensitive: true,
      require_literal_separator: false,
      require_literal_leading_dot: options.dot.map(|v| !v).unwrap_or(false),
    },
  )?;

  create_package_from_files(src, dest, &filenames, &mut metadata, options)
}

pub fn create_package_from_files<S: AsRef<Path>, D: AsRef<Path>>(
  src: S,
  dest: D,
  filenames: &Vec<String>,
  metadata: &mut HashMap<String, Metadata>,
  options: &CreateOptions,
) -> Result<()> {
  let src = src.as_ref().absolutize()?;
  let dest = dest.as_ref().absolutize()?;

  let mut filesystem = Filesystem::new(src.to_path_buf());

  let mut filenames_sorted: Vec<String> = vec![];
  if let Some(ordering) = &options.ordering {
    let mut ordering_files: Vec<String> = vec![];
    for line in std::fs::read_to_string(ordering)?.lines() {
      let mut l: &str = line;
      if l.contains(":") {
        l = line.split(':').last().unwrap();
      }
      l = l.trim();
      if l.starts_with("/") {
        l = &l[1..];
      }
      ordering_files.push(l.to_owned());
    }

    let mut ordering: Vec<String> = vec![];
    for f in ordering_files {
      let mut str: PathBuf = src.to_path_buf();
      for path_component in f.split(['/', '\\']) {
        str = str.join(Path::new(path_component));
        ordering.push(str.to_string_lossy().to_string());
      }
    }

    let mut missing = 0;
    let total = filenames.len();

    for file in ordering {
      if !filenames_sorted.contains(&file) && filenames.contains(&file) {
        filenames_sorted.push(file)
      }
    }

    for file in filenames {
      if !filenames_sorted.contains(file) {
        filenames_sorted.push(file.clone());
        missing += 1
      }
    }

    println!(
      "Ordering file has {}% coverage.",
      ((total - missing) / total) * 100
    );
  } else {
    for file in filenames {
      filenames_sorted.push(file.clone());
    }
  }

  let mut unpack_dirs: Vec<String> = vec![];

  let mut files: Vec<FileItem> = vec![];

  for filename in &filenames_sorted {
    if !metadata.contains_key(filename) {
      metadata.insert(filename.clone(), determine_file_type(filename)?);
    }

    let stat = metadata.get(filename).unwrap();

    let mut should_unpack = false;
    if stat.is_dir() {
      if let Some(unpack_dir) = &options.unpack_dir {
        let relative_path = crate::filesystem::relative(&src, Path::new(filename))?;
        should_unpack = is_unpacked_dir(
          &relative_path.to_string_lossy().to_string(),
          unpack_dir,
          &mut unpack_dirs,
        )?;
      } else {
        should_unpack = false
      }
      let mut directory_node = DirectoryNode::default();
      if should_unpack {
        directory_node.unpacked = Some(true);
      }
      filesystem.insert(filename, Node::Directory(directory_node))?;
    } else if stat.is_file() {
      if let Some(unpack) = &options.unpack {
        should_unpack = minimatch(filename, unpack, true)?;
      }
      if !should_unpack {
        if let Some(unpack_dir) = &options.unpack_dir {
          let dirname = crate::filesystem::relative(&src, &get_dir(filename))?;
          should_unpack = is_unpacked_dir(
            &dirname.to_string_lossy().to_string(),
            unpack_dir,
            &mut unpack_dirs,
          )?;
        }
      }

      let mut file_item = FileItem {
        filename: filename.clone(),
        unpack: should_unpack,
        transformed_file: None,
      };

      let dirpath = get_dir(filename).to_string_lossy().to_string();
      let dir_node = filesystem.search_dir_node_from_path_mut(&dirpath)?;
      let basename = Path::new(&filename)
        .file_name()
        .unwrap_or(&OsStr::new(""))
        .to_str()
        .unwrap_or(&"");
      let mut insert_file_node = FileNode::default();
      if should_unpack || dir_node.unpacked.unwrap_or(false) {
        insert_file_node.size = stat.len() as usize;
        insert_file_node.unpacked = Some(true);
        insert_file_node.integrity = Some(get_file_integrity(filename)?);
        dir_node
          .files
          .insert(basename.to_owned(), Node::File(insert_file_node));
        files.push(file_item);
        continue;
      }

      let size: usize;
      if let Some(transform) = &options.transform {
        let maybe_transformer = transform(filename);
        if let Some(mut transformer) = maybe_transformer {
          let mut original_file = File::open(filename)?;
          let mut tmpfile = tempfile::Builder::new().tempfile()?;
          let mut buffer = vec![0u8; BUFFER_SIZE];
          loop {
            let mut read_size = original_file.read(&mut buffer)?;
            if read_size == 0 {
              transformer.flush()?;
              read_size = transformer.read(&mut buffer)?;
              if read_size > 0 {
                tmpfile.write(&buffer[0..read_size])?;
              }
              tmpfile.flush()?;
              break;
            }
            transformer.transform(&buffer[0..read_size])?;
            read_size = transformer.read(&mut buffer)?;
            if read_size > 0 {
              tmpfile.write(&buffer[0..read_size])?;
            }
          }
          size = tmpfile.as_file().metadata()?.len() as usize;
          file_item.transformed_file = Some(tmpfile)
        } else {
          size = stat.len() as usize;
        }
      } else {
        size = stat.len() as usize;
      }

      if size > u32::MAX as usize {
        return Err(Error::new(ErrorKind::FileTooLarge(filename.clone())));
      }

      insert_file_node.size = size;
      insert_file_node.offset = Some(filesystem.offset.to_string());
      insert_file_node.integrity = Some(get_file_integrity(filename)?);

      #[cfg(not(target_os = "windows"))]
      {
        if stat.mode() & 0o100 != 0 {
          insert_file_node.executable = Some(true);
        }
      }

      filesystem.offset += size as u64;
      filesystem.insert(filename, Node::File(insert_file_node))?;
      files.push(file_item);
    } else if stat.is_symlink() {
      filesystem.insert_link(&filename)?;
    }
  }

  std::fs::create_dir_all(get_dir(&dest))?;
  crate::disk::write_filesystem(&dest, &filesystem, &mut files)?;
  Ok(())
}

fn multiple_pattern(pattern: &str) -> Option<(usize, usize, Vec<&str>)> {
  let mut begin: usize = usize::MAX;
  let mut end: usize = usize::MAX;
  for (i, c) in pattern.chars().enumerate() {
    if c == '{' && begin == usize::MAX {
      begin = i;
    }
    if c == '}' && end == usize::MAX && i >= begin {
      end = i + 1;
      break;
    }
  }
  if begin != usize::MAX && end != usize::MAX {
    let items: Vec<&str> = pattern[begin + 1..end - 1].split(',').collect();
    Some((begin, end, items))
  } else {
    None
  }
}

fn minimatch(path: &str, pattern: &str, match_base: bool) -> Result<bool> {
  let value = if match_base {
    Path::new(path)
      .file_name()
      .unwrap_or(&OsStr::new(""))
      .to_str()
      .unwrap_or(&"")
  } else {
    path
  };
  let mut patterns: Vec<String> = vec![pattern.to_owned()];
  loop {
    let mut should_continue = false;
    patterns = patterns
      .iter()
      .map(|pattern| {
        if let Some((begin, end, items)) = multiple_pattern(pattern) {
          should_continue = true;
          let sub: Vec<String> = items
            .iter()
            .map(|item| pattern[0..begin].to_owned() + *item + &pattern[end..])
            .collect();
          sub
        } else {
          vec![pattern.clone()]
        }
      })
      .flatten()
      .collect();
    if !should_continue {
      break;
    }
  }

  let result = patterns.iter().any(|pattern| {
    let g = glob::Pattern::new(pattern);
    if let Ok(glob) = g {
      glob.matches(value)
    } else {
      false
    }
  });
  Ok(result)
}

fn is_unpacked_dir(dir_path: &str, pattern: &str, unpack_dirs: &mut Vec<String>) -> Result<bool> {
  if dir_path.starts_with(pattern) || minimatch(dir_path, pattern, false)? {
    let dir_path_string = dir_path.to_owned();
    if !unpack_dirs.contains(&dir_path_string) {
      unpack_dirs.push(dir_path_string);
    }
    return Ok(true);
  } else {
    match unpack_dirs
      .iter()
      .find(|unpack_dir| dir_path.starts_with(*unpack_dir))
    {
      Some(_) => Ok(true),
      None => Ok(false),
    }
  }
}
