const encoder = new TextEncoder();
const decoder = new TextDecoder();

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    table[value] = crc >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const dosDateTime = (date = new Date()) => {
  const year = Math.max(1980, date.getFullYear());
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const day = ((year - 1980) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time, day };
};

const concat = (parts: Uint8Array[]) => {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
};

const header = (size: number) => new Uint8Array(size);
const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

export const textToBytes = (value: string) => encoder.encode(value);
export const bytesToText = (value: Uint8Array) => decoder.decode(value);

export function createZip(entries: Record<string, Uint8Array>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  const now = dosDateTime();
  const normalized = Object.entries(entries).map(([name, data]) => ({ name: name.replaceAll('\\', '/'), data }));

  for (const entry of normalized) {
    const nameBytes = encoder.encode(entry.name);
    const checksum = crc32(entry.data);
    const local = header(30);
    const localView = view(local);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, now.time, true);
    localView.setUint16(12, now.day, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, entry.data.byteLength, true);
    localView.setUint32(22, entry.data.byteLength, true);
    localView.setUint16(26, nameBytes.byteLength, true);
    localView.setUint16(28, 0, true);
    localParts.push(local, nameBytes, entry.data);

    const central = header(46);
    const centralView = view(central);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, now.time, true);
    centralView.setUint16(14, now.day, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, entry.data.byteLength, true);
    centralView.setUint32(24, entry.data.byteLength, true);
    centralView.setUint16(28, nameBytes.byteLength, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralParts.push(central, nameBytes);
    localOffset += local.byteLength + nameBytes.byteLength + entry.data.byteLength;
  }

  const centralDirectory = concat(centralParts);
  const end = header(22);
  const endView = view(end);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, normalized.length, true);
  endView.setUint16(10, normalized.length, true);
  endView.setUint32(12, centralDirectory.byteLength, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);
  return concat([...localParts, centralDirectory, end]);
}

export function readZip(bytes: Uint8Array): Record<string, Uint8Array> {
  const output: Record<string, Uint8Array> = {};
  const dataView = view(bytes);
  let offset = 0;
  while (offset + 4 <= bytes.byteLength) {
    const signature = dataView.getUint32(offset, true);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    if (signature !== 0x04034b50) throw new Error('The ZIP archive contains an unsupported structure.');
    if (offset + 30 > bytes.byteLength) throw new Error('The ZIP archive is truncated.');
    const flags = dataView.getUint16(offset + 6, true);
    const compression = dataView.getUint16(offset + 8, true);
    const compressedSize = dataView.getUint32(offset + 18, true);
    const uncompressedSize = dataView.getUint32(offset + 22, true);
    const nameLength = dataView.getUint16(offset + 26, true);
    const extraLength = dataView.getUint16(offset + 28, true);
    if (flags & 0x08) throw new Error('The ZIP archive uses data descriptors, which are not supported by ScopeLogic backups.');
    if (compression !== 0) throw new Error('The ZIP archive is compressed with an unsupported method.');
    if (compressedSize !== uncompressedSize) throw new Error('The ZIP archive has inconsistent file sizes.');
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.byteLength) throw new Error('The ZIP archive is truncated.');
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    if (name && !name.endsWith('/')) output[name] = bytes.slice(dataStart, dataEnd);
    offset = dataEnd;
  }
  return output;
}
