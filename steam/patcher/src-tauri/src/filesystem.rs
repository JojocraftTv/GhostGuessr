use std::{
  ffi::OsStr,
  path::{Path, PathBuf, MAIN_SEPARATOR},
};

use crate::{
  asar::ListOptions,
  error::{Error, ErrorKind, Result},
  node::{DirectoryNode, LinkNode, Node},
};
use path_absolutize::*;
use pathdiff::diff_paths;

pub fn get_dir<T: AsRef<Path>>(p: T) -> PathBuf {
  let path = p.as_ref();
  if path == Path::new("") {
    return Path::new(".").to_owned();
  }
  if path == Path::new("/") {
    return Path::new("/").to_owned();
  }
  if path == Path::new("\\") {
    return Path::new("\\").to_owned();
  }
  path
    .parent()
    .map(|v| {
      if v == Path::new("") {
        Path::new(".")
      } else {
        v
      }
    })
    .unwrap_or(path)
    .to_owned()
}

pub fn relative<S: AsRef<Path>, D: AsRef<Path>>(src: S, dest: D) -> Result<PathBuf> {
  let relative_path = diff_paths(&dest.as_ref().absolutize()?, &src.as_ref().absolutize()?)
    .ok_or_else(|| {
      Error::new(ErrorKind::RelativePath(
        src.as_ref().to_string_lossy().into(),
        dest.as_ref().to_string_lossy().into(),
      ))
    })?;
  Ok(relative_path)
}

pub struct Filesystem {
  pub src: PathBuf,
  pub header: Node,
  pub header_size: u64,
  pub offset: u64,
}

impl Filesystem {
  pub fn new(archive: PathBuf) -> Self {
    Filesystem {
      src: archive,
      header: DirectoryNode::default().into(),
      header_size: 0,
      offset: 0,
    }
  }

  pub fn search_node_from_directory_mut(&mut self, p: &str) -> Result<&mut Node> {
    let mut json = &mut self.header;
    let dirs: Vec<&str> = p.split(['\\', '/']).collect();
    for dir in dirs {
      if dir != "." {
        match json {
          Node::Directory(DirectoryNode { files, .. }) => {
            if !files.contains_key(dir) {
              files.insert(dir.to_owned(), DirectoryNode::default().into());
            }
            json = files
              .get_mut(dir)
              .ok_or_else(|| Error::new(ErrorKind::NoSuchEntry(p.to_owned())))?;
          }
          _ => {
            return Err(Error::new(ErrorKind::ExpectDirNode(p.to_owned())));
          }
        };
      }
    }
    Ok(json)
  }

  pub fn search_node_from_directory(&self, p: &str) -> Result<&Node> {
    let mut json = &self.header;
    let dirs: Vec<&str> = p.split(['\\', '/']).collect();
    for dir in dirs {
      if dir != "." {
        match json {
          Node::Directory(DirectoryNode { files, .. }) => {
            json = files
              .get(dir)
              .ok_or_else(|| Error::new(ErrorKind::NoSuchEntry(p.to_owned())))?;
          }
          _ => {
            return Err(Error::new(ErrorKind::ExpectDirNode(p.to_owned())));
          }
        };
      }
    }
    Ok(json)
  }

  pub fn search_dir_node_from_path_mut(&mut self, p: &str) -> Result<&mut DirectoryNode> {
    let path = relative(&self.src, Path::new(p));
    if let Ok(p) = path {
      if p == Path::new("") {
        return Ok(self.header.as_dir_node_mut().unwrap());
      }
      let name = p.file_name().unwrap_or(&OsStr::new(""));
      let dir = &get_dir(p.clone()).to_string_lossy().to_string();
      let node = self.search_node_from_directory_mut(dir)?;
      match node {
        Node::Directory(n) => {
          let key = name.to_string_lossy().to_string();
          if !n.files.contains_key(&key) {
            n.files
              .insert(key.clone(), Node::Directory(DirectoryNode::default()));
          }
          Ok(
            n.files
              .get_mut(&key)
              .unwrap()
              .as_dir_node_mut()
              .ok_or_else(|| {
                Error::new(ErrorKind::ExpectDirNode(p.to_string_lossy().to_string()))
              })?,
          )
        }
        _ => Err(Error::new(ErrorKind::ExpectDirNode(dir.clone()))),
      }
    } else {
      Ok(self.header.as_dir_node_mut().unwrap())
    }
  }

  pub fn insert(&mut self, p: &str, insert_node: Node) -> Result<()> {
    let p = relative(&self.src, Path::new(p))?;
    let name = p.file_name().unwrap_or(&OsStr::new(""));
    let dir = &get_dir(p.clone()).to_string_lossy().to_string();
    let node = self.search_node_from_directory_mut(dir)?;
    match node {
      Node::Directory(n) => {
        let name_string = name.to_string_lossy().to_string();
        if !insert_node.is_dir() || n.files.get(&name_string).is_none() {
          n.files
            .insert(name_string, insert_node);
        }
        Ok(())
      }
      _ => Err(Error::new(ErrorKind::ExpectDirNode(dir.clone()))),
    }
  }

  pub fn insert_link(&mut self, p: &str) -> Result<()> {
    let dest = Path::new(p).canonicalize()?;
    #[cfg(target_os = "windows")]
    let dest = &dest.to_string_lossy()[4..];

    let link = relative(&self.src, dest)?.to_string_lossy().to_string();

    if link.starts_with("..") {
      return Err(Error::new(ErrorKind::BadLink(p.into(), link.into())));
    }
    self.insert(p, Node::Link(LinkNode { link }))?;
    Ok(())
  }

  pub fn list_files(&self, options: &ListOptions) -> Result<Vec<String>> {
    let mut files = Vec::<String>::new();

    fn fill_files_from_metadata(
      options: &ListOptions,
      list: &mut Vec<String>,
      base_path: &PathBuf,
      metadata: &Node,
    ) -> Result<()> {
      match metadata {
        Node::Directory(node) => {
          let DirectoryNode { files, .. } = node;
          for (child_path, child_metadata) in files {
            let full_path = base_path.join(child_path);
            let pack_state = if child_metadata.unpacked() {
              "unpack"
            } else {
              "pack  "
            };
            list.push(if options.is_pack {
              (pack_state.to_owned() + &" : " + full_path.to_string_lossy().as_ref()).into()
            } else {
              full_path.to_string_lossy().to_string()
            });
            fill_files_from_metadata(options, list, &full_path, child_metadata)?
          }
        }
        _ => {
          return Ok(());
        }
      };

      Ok(())
    }
    fill_files_from_metadata(
      &options,
      &mut files,
      &PathBuf::from(MAIN_SEPARATOR.to_string()),
      &self.header,
    )?;
    Ok(files)
  }

  pub fn get_node(&self, p: &str) -> Result<&Node> {
    let dirname = get_dir(&p);
    let node = self.search_node_from_directory(dirname.to_string_lossy().as_ref())?;
    let maybe_name = Path::new(p)
      .file_name()
      .or_else(|| Some(&OsStr::new("..")))
      .and_then(|v| v.to_str());
    if let Some(name) = maybe_name {
      match node {
        Node::Directory(DirectoryNode { files, .. }) => {
          return Ok(
            files
              .get(name)
              .ok_or_else(|| Error::new(ErrorKind::NoSuchEntry(p.to_owned())))?,
          );
        }
        _ => return Err(Error::new(ErrorKind::ExpectDirNode(p.to_owned()))),
      };
    } else {
      Ok(node)
    }
  }

  pub fn get_file(&self, p: &str, follow_links: Option<bool>) -> Result<&Node> {
    let follow_links = follow_links.unwrap_or(true);
    let info = self.get_node(&p)?;
    if follow_links {
      match info {
        Node::Directory(_) => Ok(info),
        Node::File(_) => Ok(info),
        Node::Link(LinkNode { link }) => self.get_file(link, None),
      }
    } else {
      return Ok(info);
    }
  }
}
