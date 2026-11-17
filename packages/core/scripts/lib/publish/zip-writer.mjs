/**
 * Deterministic zero-dependency CRC32 and PKZIP archive writer
 * for @html-report/core publish bundles.
 */
import zlib from "node:zlib";

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(buf) {
  const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf), "utf8");
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Deterministic zero-dependency ZIP archive writer using node:zlib deflateRawSync + CRC32.
 * Uses a fixed DOS timestamp (1980-01-01 00:00:00) so identical inputs yield identical bytes.
 */
export function createZipBuffer(entries = []) {
  const normalized = entries
    .map((entry) => ({
      name: String(entry.name || "").replace(/\\/g, "/").replace(/^\/+/, ""),
      data: Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data ?? ""), "utf8"),
      compress: entry.compress !== false
    }))
    .filter((entry) => entry.name.length > 0)
    .sort((a, b) => {
      if (a.name === "index.html" && b.name !== "index.html") return -1;
      if (b.name === "index.html" && a.name !== "index.html") return 1;
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });

  const dosTime = 0x0000;
  const dosDate = 0x0021;
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of normalized) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const rawBuf = entry.data;
    const crc = crc32(rawBuf);
    const deflated = entry.compress ? zlib.deflateRawSync(rawBuf) : rawBuf;
    const useDeflate = entry.compress && deflated.length < rawBuf.length;
    const method = useDeflate ? 8 : 0;
    const compBuf = useDeflate ? deflated : rawBuf;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compBuf.length, 18);
    localHeader.writeUInt32LE(rawBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x031e, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compBuf.length, 20);
    centralHeader.writeUInt32LE(rawBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0x81a40000, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compBuf.length;
  }

  const centralDirBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(normalized.length, 8);
  eocd.writeUInt16LE(normalized.length, 10);
  eocd.writeUInt32LE(centralDirBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirBuf, eocd]);
}
