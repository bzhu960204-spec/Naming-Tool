import { inflateRawSync } from "node:zlib";

/**
 * Minimal ZIP reader for Office Open XML packages (.xltm/.xlsx are ZIP files).
 * Only the pieces we need: enumerate central-directory entries and inflate a
 * single stored/deflated entry. No third-party dependency.
 */

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

export function readEntries(buf: Buffer): Map<string, ZipEntry> {
  // Find End Of Central Directory (EOCD) record, scanning from the end.
  const EOCD_SIG = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a valid ZIP/Office file (no EOCD record).");

  const cdCount = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16); // central directory offset
  const entries = new Map<string, ZipEntry>();
  const CD_SIG = 0x02014b50;

  for (let n = 0; n < cdCount; n++) {
    if (buf.readUInt32LE(ptr) !== CD_SIG) break;
    const method = buf.readUInt16LE(ptr + 10);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localHeaderOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString("utf8", ptr + 46, ptr + 46 + nameLen);
    entries.set(name, { name, method, compressedSize, localHeaderOffset });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function readZipFile(
  buf: Buffer,
  entries: Map<string, ZipEntry>,
  name: string,
): string | null {
  const e = entries.get(name);
  if (!e) return null;
  const LH_SIG = 0x04034b50;
  const off = e.localHeaderOffset;
  if (buf.readUInt32LE(off) !== LH_SIG) throw new Error(`Bad local header for ${name}`);
  const nameLen = buf.readUInt16LE(off + 26);
  const extraLen = buf.readUInt16LE(off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  const slice = buf.subarray(dataStart, dataStart + e.compressedSize);
  const out = e.method === 0 ? slice : inflateRawSync(slice);
  return out.toString("utf8");
}
