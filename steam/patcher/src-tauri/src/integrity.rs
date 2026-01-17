use sha2::{Digest, Sha256};
use std::{fs::File, io::Read, path::Path};

use crate::error::Result;
use crate::node::{Integrity, IntegrityAlgorithm};

const BLOCK_SIZE: usize = 4 * 1024 * 1024;
pub const BUFFER_SIZE: usize = 64 * 1024;

pub fn get_file_integrity<T: AsRef<Path>>(path: T) -> Result<Integrity> {
  let mut fd = File::open(path)?;
  let mut file_hash = Sha256::new();
  let mut blocks: Vec<String> = vec![];
  let mut current_block_size: usize = 0;
  let mut current_block_hash = Sha256::new();
  let mut buffer = vec![0; BUFFER_SIZE];

  loop {
    let read_size = fd.read(&mut buffer)?;
    if read_size == 0 {
      blocks.push(hex::encode(current_block_hash.finalize()));
      break;
    }
    let mut chunk = &buffer[0..read_size];

    file_hash.update(&chunk);

    loop {
      let diff_to_slice = std::cmp::min(BLOCK_SIZE - current_block_size, chunk.len());
      current_block_size += diff_to_slice;
      current_block_hash.update(&chunk[0..diff_to_slice]);
      if current_block_size == BLOCK_SIZE {
        blocks.push(hex::encode(current_block_hash.finalize()));
        current_block_hash = Sha256::new();
        current_block_size = 0;
      }
      if diff_to_slice < chunk.len() {
        chunk = &chunk[diff_to_slice..];
      } else {
        break;
      }
    }
  }

  Ok(Integrity {
    algorithm: IntegrityAlgorithm::SHA256,
    hash: hex::encode(file_hash.finalize()),
    block_size: BLOCK_SIZE,
    blocks: blocks,
  })
}
