import {
  type CipherGCM,
  createCipheriv,
  createDecipheriv,
  type DecipherGCM,
  pbkdf2Sync,
  randomBytes,
} from "node:crypto";
import { CRYPTO_CONFIG } from "@viclip/constants";
import { describe, expect, it } from "vitest";
import { createCryptoService } from "./crypto";

describe("createCryptoService", () => {
  const nodeCryptoApi = {
    randomBytes,
    pbkdf2Sync,
    createCipheriv: (algorithm: string, key: Uint8Array, iv: Uint8Array) =>
      createCipheriv(algorithm, key, iv) as CipherGCM,
    createDecipheriv: (algorithm: string, key: Uint8Array, iv: Uint8Array) =>
      createDecipheriv(algorithm, key, iv) as DecipherGCM,
    Buffer,
  };

  it("should generate a 32-byte Data Encryption Key (DEK)", () => {
    const cryptoService = createCryptoService(nodeCryptoApi);
    const dek = cryptoService.generateDEK();

    expect(dek).toBeDefined();
    expect(dek.length).toBe(CRYPTO_CONFIG.keyLength);
  });

  it("should generate a random salt as a valid hex string", () => {
    const cryptoService = createCryptoService(nodeCryptoApi);
    const salt1 = cryptoService.generateSalt();
    const salt2 = cryptoService.generateSalt();

    expect(salt1).toHaveLength(CRYPTO_CONFIG.saltLength * 2);
    expect(salt2).toHaveLength(CRYPTO_CONFIG.saltLength * 2);
    expect(salt1).not.toBe(salt2);
  });

  it("should derive deterministic KEK using PBKDF2", () => {
    const cryptoService = createCryptoService(nodeCryptoApi);
    const password = "SuperSecretPassword123!";
    const salt = cryptoService.generateSalt();

    const kek1 = cryptoService.deriveKEK(password, salt);
    const kek2 = cryptoService.deriveKEK(password, salt);
    const kekDifferent = cryptoService.deriveKEK("OtherPassword", salt);

    expect(kek1.length).toBe(CRYPTO_CONFIG.keyLength);
    expect(Buffer.from(kek1).toString("hex")).toBe(
      Buffer.from(kek2).toString("hex"),
    );
    expect(Buffer.from(kek1).toString("hex")).not.toBe(
      Buffer.from(kekDifferent).toString("hex"),
    );
  });

  it("should encrypt and decrypt plaintext accurately", () => {
    const cryptoService = createCryptoService(nodeCryptoApi);
    const key = cryptoService.generateDEK();
    const secretMessage = "ViClip universal sync test message: 🚀 123 !@#$%";

    const encrypted = cryptoService.encrypt(secretMessage, key);

    // Verify format: iv:authTag:ciphertext
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    const [ivHex, authTagHex, cipherHex] = parts;
    expect(ivHex).toHaveLength(CRYPTO_CONFIG.ivLength * 2);
    expect(authTagHex).toBeDefined();
    expect(cipherHex).toBeDefined();

    // Verify decryption
    const decrypted = cryptoService.decrypt(encrypted, key);
    expect(decrypted).toBe(secretMessage);
  });

  it("should fail decryption when ciphertext or authTag is tampered with", () => {
    const cryptoService = createCryptoService({
      ...nodeCryptoApi,
      randomBytes: (size: number) => Buffer.alloc(size, 250),
    });
    const key = Buffer.alloc(CRYPTO_CONFIG.keyLength, 1);
    const encrypted = cryptoService.encrypt("Sensitive clipboard data", key);
    const parts = encrypted.split(":");

    // This fixed vector ends in aa, which made the former literal replacement a no-op.
    expect(parts[2].endsWith("aa")).toBe(true);

    // Tamper with the ciphertext
    const tamperedCipher = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -1)}b`;

    expect(() => {
      cryptoService.decrypt(tamperedCipher, key);
    }).toThrow();

    const tag = parts[1];
    const tamperedTag = `${tag[0] === "0" ? "1" : "0"}${tag.slice(1)}`;
    expect(() =>
      cryptoService.decrypt(`${parts[0]}:${tamperedTag}:${parts[2]}`, key),
    ).toThrow();
  });

  it("should throw error for invalid encrypted data format", () => {
    const cryptoService = createCryptoService(nodeCryptoApi);
    const key = cryptoService.generateDEK();

    expect(() => {
      cryptoService.decrypt("invalid-format-string", key);
    }).toThrow("Invalid encrypted data format");
  });

  it("should wrap and unwrap DEK using KEK", () => {
    const cryptoService = createCryptoService(nodeCryptoApi);
    const dek = cryptoService.generateDEK();
    const kek = cryptoService.deriveKEK(
      "user-password",
      cryptoService.generateSalt(),
    );

    const wrapped = cryptoService.wrapKey(dek, kek);
    const unwrapped = cryptoService.unwrapKey(wrapped, kek);

    expect(unwrapped.toString("hex")).toBe(dek.toString("hex"));
  });

  it("rejects noncanonical payloads instead of silently truncating invalid hex", () => {
    const service = createCryptoService(nodeCryptoApi);
    const key = service.generateDEK();
    const payload = service.encrypt("Authenticated content", key);
    const [iv, tag, ciphertext] = payload.split(":");
    for (const malformed of [
      `${iv}:${tag}:${ciphertext}zz`,
      `${iv}zz:${tag}:${ciphertext}`,
      `${iv}:${tag}zz:${ciphertext}`,
      `${iv}:${tag.slice(0, 24)}:${ciphertext}`,
      `${iv}:${tag}:${ciphertext}0`,
    ]) {
      expect(() => service.decrypt(malformed, key)).toThrow();
    }
  });

  it("rejects an authenticated wrapped value that is not a 32-byte key", () => {
    const service = createCryptoService(nodeCryptoApi);
    const kek = service.generateDEK();
    const malformedWrapped = service.encrypt("00", kek);
    expect(() => service.unwrapKey(malformedWrapped, kek)).toThrow();
  });

  it("rejects invalid salts before key derivation", () => {
    const service = createCryptoService(nodeCryptoApi);
    expect(() => service.deriveKEK("password", "00zz")).toThrow();
  });

  it("zeroes a replaced active key before retaining its replacement", () => {
    const service = createCryptoService(nodeCryptoApi);
    const first = service.generateDEK();
    const next = service.generateDEK();
    service.setActiveDEK(first);
    service.setActiveDEK(next);
    expect(first).toEqual(Buffer.alloc(32));
    expect(service.getActiveDEK()).toBe(next);
  });

  it("should manage active in-memory DEK lifecycle", () => {
    const cryptoService = createCryptoService(nodeCryptoApi);

    expect(cryptoService.isKeyLoaded()).toBe(false);
    expect(() => cryptoService.getActiveDEK()).toThrow(
      "Encryption key not initialized. User must login first.",
    );

    // Test invalid key length rejection
    expect(() => {
      cryptoService.setActiveDEK(Buffer.from("too-short") as unknown as Buffer);
    }).toThrow("Invalid key length. Expected 32 bytes.");

    // Test valid key set
    const validDek = cryptoService.generateDEK();
    cryptoService.setActiveDEK(validDek);

    expect(cryptoService.isKeyLoaded()).toBe(true);
    expect(cryptoService.getActiveDEK().toString("hex")).toBe(
      validDek.toString("hex"),
    );

    // Test clearing key from memory
    cryptoService.clearActiveDEK();
    expect(validDek).toEqual(Buffer.alloc(CRYPTO_CONFIG.keyLength));
    expect(cryptoService.isKeyLoaded()).toBe(false);
    expect(() => cryptoService.getActiveDEK()).toThrow(
      "Encryption key not initialized. User must login first.",
    );
  });
  it("rejects truncated tags and malformed hex before authenticated decryption", () => {
    const service = createCryptoService(nodeCryptoApi);
    const key = service.generateDEK();
    const [iv, tag, cipher] = service.encrypt("secret", key).split(":");
    for (const payload of [
      `${iv}:${tag.slice(0, 8)}:${cipher}`,
      `${iv}:${tag}:${cipher}zz`,
      `${iv}:${tag}:${cipher}0`,
      `${iv}00:${tag}:${cipher}`,
    ]) {
      expect(() => service.decrypt(payload, key)).toThrow();
    }
  });

  it("rejects malformed salts and wrapped keys of the wrong length", () => {
    const service = createCryptoService(nodeCryptoApi);
    const key = service.generateDEK();
    expect(() => service.deriveKEK("password", "zz")).toThrow();
    expect(() => service.unwrapKey(service.encrypt("aa", key), key)).toThrow();
  });

  it("authenticates IV and full tag and permits authenticated empty plaintext", () => {
    const service = createCryptoService(nodeCryptoApi);
    const key = service.generateDEK();
    const [iv, tag, cipher] = service.encrypt("secret", key).split(":");
    const flip = (value: string): string =>
      `${value[0] === "0" ? "1" : "0"}${value.slice(1)}`;
    expect(() =>
      service.decrypt(`${flip(iv)}:${tag}:${cipher}`, key),
    ).toThrow();
    expect(() =>
      service.decrypt(`${iv}:${flip(tag)}:${cipher}`, key),
    ).toThrow();
    expect(service.decrypt(service.encrypt("", key), key)).toBe("");
  });

  it("zeroes the old key when replacing the active key", () => {
    const service = createCryptoService(nodeCryptoApi);
    const first = service.generateDEK();
    service.setActiveDEK(first);
    service.setActiveDEK(service.generateDEK());
    expect(first).toEqual(Buffer.alloc(32));
  });
});
