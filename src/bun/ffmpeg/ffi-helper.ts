import { dlopen, ptr } from "bun:ffi";

const msvcrt = dlopen("C:\\Windows\\System32\\msvcrt.dll", {
  memcpy: { args: ["ptr", "ptr", "usize"], returns: "ptr" },
});
const { memcpy } = msvcrt.symbols;

export function readBytes(addr: number, size: number): Uint8Array {
  const dest = new Uint8Array(size);
  memcpy(ptr(dest), addr as any, size);
  return dest;
}

export function writePtr(addr: number, value: bigint): void {
  const src = new BigUint64Array([value]);
  memcpy(addr as any, ptr(src), 8);
}

export function writeInt32(addr: number, value: number): void {
  const src = new Int32Array([value]);
  memcpy(addr as any, ptr(src), 4);
}

export function writeInt64(addr: number, value: bigint): void {
  const src = new BigInt64Array([value]);
  memcpy(addr as any, ptr(src), 8);
}
