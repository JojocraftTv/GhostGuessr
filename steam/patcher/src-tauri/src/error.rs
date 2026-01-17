use std::fmt::Display;
use std::io;
use std::num;

use glob::{GlobError, PatternError};

#[derive(Debug)]
pub(crate) enum ErrorKind {
  InvalidHeaderSize,
  InvalidHeader,
  ExpectDirNode(String),
  FileTooLarge(String),
  UnknownOffset(String),
  NoSuchEntry(String),
  RelativePath(Box<str>, Box<str>),
  BadLink(Box<str>, Box<str>),
  Pattern(PatternError),
  Glob(GlobError),
  ParseInt(num::ParseIntError),
  Io(io::Error),
  Json(serde_json::Error),
  Extraction(Vec<Error>),
}

impl Display for ErrorKind {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    match &self {
      Self::InvalidHeaderSize => {
        write!(
          f,
          "{}::ErrorKind::InvalidHeaderSize: Unable to read header size",
          env!("CARGO_PKG_NAME")
        )
      }
      Self::InvalidHeader => {
        write!(
          f,
          "{}::ErrorKind::InvalidHeader: Unable to read header",
          env!("CARGO_PKG_NAME")
        )
      }
      Self::ExpectDirNode(asar_file_path) => {
        write!(
          f,
          "{}::ErrorKind::ExpectDirNode: \"{}\" is not a directory",
          env!("CARGO_PKG_NAME"),
          asar_file_path
        )
      }
      Self::FileTooLarge(file_path) => {
        write!(
          f,
          "{}::ErrorKind::FileTooLarge: {}: file size can not be larger than 4.2GB",
          env!("CARGO_PKG_NAME"),
          file_path
        )
      }
      Self::UnknownOffset(asar_file_path) => {
        write!(
          f,
          "{}::ErrorKind::UnknownOffset: {}",
          env!("CARGO_PKG_NAME"),
          asar_file_path
        )
      }
      Self::NoSuchEntry(asar_file_path) => {
        write!(
          f,
          "{}::ErrorKind::NoSuchEntry: \"{}\" was not found in this archive",
          env!("CARGO_PKG_NAME"),
          asar_file_path
        )
      }
      Self::RelativePath(from, to) => {
        write!(
          f,
          "{}::ErrorKind::RelativePath: Cannot get relative path from {} to {}",
          env!("CARGO_PKG_NAME"),
          from,
          to
        )
      }
      Self::BadLink(asar_file_path, relative_path) => {
        write!(
          f,
          "{}::ErrorKind::BadLink: {}: file \"{}\" links out of the package",
          env!("CARGO_PKG_NAME"),
          asar_file_path,
          relative_path
        )
      }
      Self::Pattern(err) => Display::fmt(err, f),
      Self::Glob(err) => Display::fmt(err, f),
      Self::ParseInt(err) => Display::fmt(err, f),
      Self::Io(err) => Display::fmt(err, f),
      Self::Json(err) => Display::fmt(err, f),
      Self::Extraction(errors) => {
        write!(
          f,
          "{}::ErrorKind::Extraction: Unable to extract some files:\n\n",
          env!("CARGO_PKG_NAME")
        )?;
        for e in errors.iter() {
          write!(
            f,
            "{}",
            e
          )?;
        }
        Ok(())
      },
    }
  }
}

#[derive(Debug)]
struct ErrorImpl {
  kind: ErrorKind,
}

impl ErrorImpl {
  pub fn kind(&self) -> &ErrorKind {
    &self.kind
  }

}

impl Display for ErrorImpl {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    Display::fmt(&self.kind, f)
  }
}

#[derive(Debug)]
pub struct Error {
  repr: Box<ErrorImpl>,
}

impl Error {
  pub(crate) fn new(kind: ErrorKind) -> Self {
    Error {
      repr: Box::new(ErrorImpl { kind }),
    }
  }

  pub(crate) fn kind(&self) -> &ErrorKind {
    self.repr.kind()
  }

}

impl Display for Error {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    Display::fmt(&self.repr, f)
  }
}

impl std::error::Error for Error {
  fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
    match self.kind() {
      ErrorKind::ParseInt(err) => Some(err),
      ErrorKind::Io(err) => Some(err),
      ErrorKind::Json(err) => Some(err),
      ErrorKind::Pattern(err) => Some(err),
      ErrorKind::Glob(err) => Some(err),
      _ => None,
    }
  }
}

impl From<ErrorKind> for Error {
  fn from(value: ErrorKind) -> Self {
    Error::new(value)
  }
}

impl From<num::ParseIntError> for Error {
  fn from(value: num::ParseIntError) -> Self {
    Error::new(ErrorKind::ParseInt(value))
  }
}

impl From<PatternError> for Error {
  fn from(value: PatternError) -> Self {
    Error::new(ErrorKind::Pattern(value))
  }
}

impl From<GlobError> for Error {
  fn from(value: GlobError) -> Self {
    Error::new(ErrorKind::Glob(value))
  }
}

impl From<io::Error> for Error {
  fn from(value: io::Error) -> Self {
    Error::new(ErrorKind::Io(value))
  }
}

impl From<serde_json::Error> for Error {
  fn from(value: serde_json::Error) -> Self {
    Error::new(ErrorKind::Json(value))
  }
}

pub type Result<T> = std::result::Result<T, Error>;
