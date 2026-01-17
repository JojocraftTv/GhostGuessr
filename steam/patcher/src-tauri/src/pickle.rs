const SIZE_INT32: usize = 4;
const SIZE_UINT32: usize = 4;
const SIZE_INT64: usize = 8;
const SIZE_UINT64: usize = 8;
const SIZE_FLOAT: usize = 4;
const SIZE_DOUBLE: usize = 8;

const PAYLOAD_UNIT: usize = 64;

const CAPACITY_READ_ONLY: u64 = 9007199254740992;

fn align_int(i: usize, alignment: usize) -> usize {
  i + (alignment - (i % alignment)) % alignment
}

pub struct PickleIterator<'a> {
  payload: &'a Vec<u8>,
  payload_offset: usize,
  read_index: usize,
  end_index: usize,
}

impl<'a> PickleIterator<'a> {
  pub fn new(pickle: &'a Pickle) -> Self {
    PickleIterator {
      payload: &pickle.header,
      payload_offset: pickle.header_size,
      read_index: 0,
      end_index: pickle.get_payload_size(),
    }
  }

  pub fn read_bool(&mut self) -> bool {
    let value = self.read_int32();
    value != 0
  }

  pub fn read_int32(&mut self) -> i32 {
    let read_payload_offset = self.get_read_payload_offset_and_advance(SIZE_INT32);
    let mut buf = [0u8; SIZE_INT32];
    buf.copy_from_slice(&self.payload[read_payload_offset..read_payload_offset + SIZE_INT32]);
    i32::from_le_bytes(buf)
  }

  pub fn read_uint32(&mut self) -> u32 {
    let read_payload_offset = self.get_read_payload_offset_and_advance(SIZE_UINT32);
    let mut buf = [0u8; SIZE_UINT32];
    buf.copy_from_slice(&self.payload[read_payload_offset..read_payload_offset + SIZE_UINT32]);
    u32::from_le_bytes(buf)
  }

  pub fn read_int64(&mut self) -> i64 {
    let read_payload_offset = self.get_read_payload_offset_and_advance(SIZE_INT64);
    let mut buf = [0u8; SIZE_INT64];
    buf.copy_from_slice(&self.payload[read_payload_offset..read_payload_offset + SIZE_INT64]);
    i64::from_le_bytes(buf)
  }

  pub fn read_uint64(&mut self) -> u64 {
    let read_payload_offset = self.get_read_payload_offset_and_advance(SIZE_UINT64);
    let mut buf = [0u8; SIZE_UINT64];
    buf.copy_from_slice(&self.payload[read_payload_offset..read_payload_offset + SIZE_UINT64]);
    u64::from_le_bytes(buf)
  }

  pub fn read_float(&mut self) -> f32 {
    let read_payload_offset = self.get_read_payload_offset_and_advance(SIZE_FLOAT);
    let mut buf = [0u8; SIZE_FLOAT];
    buf.copy_from_slice(&self.payload[read_payload_offset..read_payload_offset + SIZE_FLOAT]);
    f32::from_le_bytes(buf)
  }

  pub fn read_double(&mut self) -> f64 {
    let read_payload_offset = self.get_read_payload_offset_and_advance(SIZE_DOUBLE);
    let mut buf = [0u8; SIZE_DOUBLE];
    buf.copy_from_slice(&self.payload[read_payload_offset..read_payload_offset + SIZE_DOUBLE]);
    f64::from_le_bytes(buf)
  }

  pub fn read_string(&mut self) -> String {
    let length = self.read_int32() as usize;
    let read_payload_offset = self.get_read_payload_offset_and_advance(length);
    unsafe {
      String::from_utf8_unchecked(
        self.payload[read_payload_offset..read_payload_offset + length].to_vec(),
      )
    }
  }

  fn get_read_payload_offset_and_advance(&mut self, length: usize) -> usize {
    assert!(
      length <= self.end_index - self.read_index,
      "chromium_pickle: Failed to read data with length of {}",
      length
    );
    let read_payload_offset = self.payload_offset + self.read_index;
    self.advance(length);
    read_payload_offset
  }

  fn advance(&mut self, size: usize) {
    let aligned_size = align_int(size, SIZE_UINT32);
    if self.end_index - self.read_index < aligned_size {
      self.read_index = self.end_index;
    } else {
      self.read_index += aligned_size;
    }
  }
}

pub struct Pickle {
  header: Vec<u8>,
  header_size: usize,
  capacity_after_header: u64,
  write_offset: usize,
}

impl Default for Pickle {
  fn default() -> Self {
    let mut pickle = Pickle {
      header: vec![0; 0],
      header_size: SIZE_UINT32,
      capacity_after_header: 0,
      write_offset: 0,
    };
    pickle.resize(PAYLOAD_UNIT);
    pickle.set_payload_size(0);
    pickle
  }
}

impl Pickle {
  pub fn new() -> Self {
    Self::default()
  }

  pub fn from_slice(buffer: &[u8]) -> Self {
    Self::from_vec(buffer.to_vec())
  }

  pub fn from_vec(buffer: Vec<u8>) -> Self {
    const UINT32_SIZE: usize = std::mem::size_of::<u32>();
    let mut payload_size_buffer = [0u8; UINT32_SIZE];
    let len = buffer.len();
    if len >= UINT32_SIZE {
      payload_size_buffer.copy_from_slice(&buffer[0..UINT32_SIZE]);
    } else {
      for i in 0..len {
        payload_size_buffer[i] = buffer[i];
      }
    }

    let mut pickle = Pickle {
      header: buffer.to_vec(),
      header_size: len - u32::from_le_bytes(payload_size_buffer) as usize,
      capacity_after_header: CAPACITY_READ_ONLY,
      write_offset: 0,
    };
    if pickle.header_size > len {
      pickle.header_size = 0
    }
    if pickle.header_size != align_int(pickle.header_size, SIZE_UINT32) {
      pickle.header_size = 0
    }
    if pickle.header_size == 0 {
      pickle.header = vec![0; 0]
    }
    pickle
  }

  pub fn to_vec(&self) -> Vec<u8> {
    let end = self.header_size + self.get_payload_size();
    self.header[0..end].to_vec()
  }

  pub fn create_iterator(&self) -> PickleIterator<'_> {
    PickleIterator::new(&self)
  }

  pub fn write_bool(&mut self, value: bool) {
    self.write_int32(if value { 1 } else { 0 });
  }

  pub fn write_int32(&mut self, value: i32) {
    self.write_bytes(&value.to_le_bytes(), SIZE_INT32);
  }

  pub fn write_uint32(&mut self, value: u32) {
    self.write_bytes(&value.to_le_bytes(), SIZE_UINT32);
  }

  pub fn write_int64(&mut self, value: i64) {
    self.write_bytes(&value.to_le_bytes(), SIZE_INT64);
  }

  pub fn write_uint64(&mut self, value: u64) {
    self.write_bytes(&value.to_le_bytes(), SIZE_UINT64);
  }

  pub fn write_float(&mut self, value: f32) {
    self.write_bytes(&value.to_le_bytes(), SIZE_FLOAT);
  }

  pub fn write_double(&mut self, value: f64) {
    self.write_bytes(&value.to_le_bytes(), SIZE_DOUBLE);
  }

  pub fn write_string(&mut self, value: &str) {
    let bytes = value.as_bytes();
    let length = bytes.len();
    self.write_int32(length as i32);
    self.write_bytes(&bytes, length);
  }

  fn write_bytes(&mut self, data: &[u8], length: usize) {
    let data_length = align_int(length, SIZE_UINT32 as usize);
    let new_size = self.write_offset + data_length;
    if new_size as u64 > self.capacity_after_header {
      let double_cap = self.capacity_after_header * 2;
      self.resize(if double_cap > new_size as u64 {
        double_cap as usize
      } else {
        new_size
      });
    }

    let ofs = self.header_size + self.write_offset;
    self.header[ofs..ofs + length].copy_from_slice(data);

    let end_offset = self.header_size + self.write_offset + length;
    self.header[end_offset..end_offset + data_length - length].fill(0);
    self.set_payload_size(new_size);
    self.write_offset = new_size;
  }

  pub fn resize(&mut self, new_capacity: usize) {
    let new_capacity = align_int(new_capacity, PAYLOAD_UNIT);
    self.header = [self.header.clone(), vec![0; new_capacity]].concat();
    self.capacity_after_header = new_capacity as u64;
  }

  pub fn get_payload_size(&self) -> usize {
    u32::from_le_bytes(
      self.header[0..4]
        .try_into()
        .unwrap_or_else(|_| [0, 0, 0, 0]),
    ) as usize
  }

  pub fn set_payload_size(&mut self, payload_size: usize) {
    self.header[0..4].copy_from_slice(&(payload_size as u32).to_le_bytes());
  }
}

impl From<&Pickle> for Vec<u8> {
  fn from(value: &Pickle) -> Self {
    value.to_vec()
  }
}
