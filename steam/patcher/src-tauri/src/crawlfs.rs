use std::{collections::HashMap, fs::Metadata, path::Path};

use glob::{glob_with, MatchOptions};

use crate::error::Result;

pub fn determine_file_type<T: AsRef<Path>>(path: T) -> Result<Metadata> {
  Ok(std::fs::symlink_metadata(path)?)
}

pub fn crawl_filesystem<T: AsRef<Path>>(
  dir: T,
  options: MatchOptions,
) -> Result<(Vec<String>, HashMap<String, Metadata>)> {
  let mut metadata: HashMap<String, Metadata> = HashMap::new();
  let crawled = glob_with(dir.as_ref().to_string_lossy().as_ref(), options)?;
  let results: Result<Vec<(String, Metadata)>> = crawled
    .map(|filename| -> Result<(String, Metadata)> {
      let str = filename?;
      let stat = determine_file_type(&str)?;
      return Ok((str.to_string_lossy().as_ref().to_owned(), stat));
    })
    .collect();
  let results = results?;
  let mut links: Vec<String> = vec![];
  let filenames: Vec<&String> = results
    .iter()
    .map(|(filename, t)| {
      metadata.insert(filename.clone(), t.clone());
      if t.is_symlink() {
        links.push(filename.clone())
      }
      filename
    })
    .collect();

  let filenames: Vec<String> = filenames
    .iter()
    .filter(|filename| {
      let exact_link_index = links
        .iter()
        .position(|link| **filename == link)
        .unwrap_or(usize::MAX);
      links.iter().enumerate().all(|(index, link)| {
        if index == exact_link_index {
          return true;
        }
        !filename.starts_with(link)
      })
    })
    .map(|f| (*f).clone())
    .collect();

  Ok((filenames, metadata))
}
