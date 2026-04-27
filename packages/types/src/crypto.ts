export interface CipherLike {
  update(data: string, inputEncoding: "utf8", outputEncoding: "hex"): string;
  final(outputEncoding: "hex"): string;
  getAuthTag(): Uint8Array;
}

export interface DecipherLike {
  setAuthTag(buffer: Uint8Array): void;
  update(data: string, inputEncoding: "hex", outputEncoding: "utf8"): string;
  final(outputEncoding: "utf8"): string;
}

export interface BufferLike extends Uint8Array {
  toString(encoding?: string): string;
}

export interface BufferConstructorLike<
  TBuffer extends BufferLike = BufferLike,
> {
  from(data: Uint8Array | string, encoding?: string): TBuffer;
}

export interface CryptoAPI<TBuffer extends BufferLike = BufferLike> {
  randomBytes: (size: number) => Uint8Array;
  pbkdf2Sync: (
    password: string,
    salt: Uint8Array,
    iterations: number,
    keylen: number,
    digest: string,
  ) => Uint8Array;
  createCipheriv: (
    algorithm: string,
    key: Uint8Array,
    iv: Uint8Array,
  ) => CipherLike;
  createDecipheriv: (
    algorithm: string,
    key: Uint8Array,
    iv: Uint8Array,
  ) => DecipherLike;
  Buffer: BufferConstructorLike<TBuffer>;
}
