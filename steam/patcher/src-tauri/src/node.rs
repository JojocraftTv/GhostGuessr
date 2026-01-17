use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fmt::Display};

#[derive(Clone, Serialize, Deserialize)]
pub enum IntegrityAlgorithm {
  #[serde(rename = "SHA256")]
  SHA256,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Integrity {
  pub algorithm: IntegrityAlgorithm,
  pub hash: String,
  pub block_size: usize,
  pub blocks: Vec<String>,
}

#[derive(Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
  pub size: usize,

  #[serde(default)]
  #[serde(skip_serializing_if = "Option::is_none")]
  pub offset: Option<String>,

  #[serde(default)]
  #[serde(skip_serializing_if = "Option::is_none")]
  pub unpacked: Option<bool>,

  #[serde(default)]
  #[serde(skip_serializing_if = "Option::is_none")]
  pub executable: Option<bool>,

  #[serde(default)]
  #[serde(skip_serializing_if = "Option::is_none")]
  pub integrity: Option<Integrity>,
}

#[derive(Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkNode {
  pub link: String,
}

#[derive(Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryNode {
  #[serde(default)]
  #[serde(skip_serializing_if = "Option::is_none")]
  pub unpacked: Option<bool>,

  pub files: BTreeMap<String, Node>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(untagged)]
pub enum Node {
  File(FileNode),
  Directory(DirectoryNode),
  Link(LinkNode),
}

impl Node {
  pub fn is_dir(&self) -> bool {
    if let Self::Directory(..) = self {
      true
    } else {
      false
    }
  }

  pub fn as_dir_node_mut(&mut self) -> Option<&mut DirectoryNode> {
    match self {
      Self::Directory(node) => Some(node),
      _ => None,
    }
  }

  pub fn unpacked(&self) -> bool {
    match self {
      Self::Directory(DirectoryNode { unpacked, .. }) => unpacked.unwrap_or(false),
      Self::File(FileNode { unpacked, .. }) => unpacked.unwrap_or(false),
      Self::Link(..) => false,
    }
  }

}

impl From<DirectoryNode> for Node {
  fn from(value: DirectoryNode) -> Self {
    Node::Directory(value)
  }
}

impl From<FileNode> for Node {
  fn from(value: FileNode) -> Self {
    Node::File(value)
  }
}

impl Display for Node {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{}", serde_json::to_string(&self).unwrap())
  }
}
