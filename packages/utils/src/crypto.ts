import { CRYPTO_CONFIG } from "@viclip/constants";
import type { BufferLike, CryptoAPI } from "@viclip/types";

/** Validate the wire format before adapters can permissively decode malformed hex. */
export function isEncryptedPayload(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  const [ivHex, authTagHex, encryptedHex] = parts;
  return (
    new RegExp(`^[0-9a-f]{${CRYPTO_CONFIG.ivLength * 2}}$`, "i").test(ivHex) &&
    /^[0-9a-f]{32}$/i.test(authTagHex) &&
    encryptedHex.length % 2 === 0 &&
    /^[0-9a-f]*$/i.test(encryptedHex)
  );
}

export const createCryptoService = <TBuffer extends BufferLike = BufferLike>(
  api: CryptoAPI<TBuffer>,
) => {
  let activeDEK: TBuffer | null = null;

  return {
    generateDEK: () =>
      api.Buffer.from(api.randomBytes(CRYPTO_CONFIG.keyLength)),

    generateSalt: () =>
      api.Buffer.from(api.randomBytes(CRYPTO_CONFIG.saltLength)).toString(
        "hex",
      ),

    deriveKEK: (password: string, saltHex: string) => {
      if (
        typeof saltHex !== "string" ||
        !new RegExp(`^[0-9a-f]{${CRYPTO_CONFIG.saltLength * 2}}$`, "i").test(
          saltHex,
        )
      ) {
        throw new Error("Invalid encryption salt");
      }
      return api.pbkdf2Sync(
        password,
        api.Buffer.from(saltHex, "hex"),
        CRYPTO_CONFIG.pbkdf2Iterations,
        CRYPTO_CONFIG.keyLength,
        CRYPTO_CONFIG.pbkdf2Digest,
      );
    },

    encrypt: (text: string, key: Uint8Array): string => {
      try {
        const iv = api.randomBytes(CRYPTO_CONFIG.ivLength);
        const cipher = api.createCipheriv(CRYPTO_CONFIG.algorithm, key, iv);

        let encrypted = cipher.update(text, "utf8", "hex");
        encrypted += cipher.final("hex");

        const authTag = cipher.getAuthTag();

        return `${api.Buffer.from(iv).toString("hex")}:${api.Buffer.from(authTag).toString("hex")}:${encrypted}`;
      } catch {
        throw new Error("Encryption failed");
      }
    },

    decrypt: (encryptedText: string, key: Uint8Array): string => {
      if (!isEncryptedPayload(encryptedText)) {
        throw new Error("Invalid encrypted data format");
      }
      const parts = encryptedText.split(":");
      const [ivHex, authTagHex, encryptedHex] = parts;

      const iv = api.Buffer.from(ivHex, "hex");
      const authTag = api.Buffer.from(authTagHex, "hex");
      const decipher = api.createDecipheriv(CRYPTO_CONFIG.algorithm, key, iv);

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    },

    wrapKey: function (dek: TBuffer, kek: Uint8Array): string {
      return this.encrypt(dek.toString("hex"), kek);
    },

    unwrapKey: function (wrappedDEK: string, kek: Uint8Array): TBuffer {
      const dekHex = this.decrypt(wrappedDEK, kek);
      if (
        !new RegExp(`^[0-9a-f]{${CRYPTO_CONFIG.keyLength * 2}}$`, "i").test(
          dekHex,
        )
      ) {
        throw new Error("Invalid wrapped encryption key");
      }
      return api.Buffer.from(dekHex, "hex");
    },

    setActiveDEK: (key: TBuffer) => {
      if (key.length !== CRYPTO_CONFIG.keyLength) {
        throw new Error(
          `Invalid key length. Expected ${CRYPTO_CONFIG.keyLength} bytes.`,
        );
      }
      if (activeDEK && activeDEK !== key) activeDEK.fill(0);
      activeDEK = key;
      console.info("Active encryption key set in memory");
    },

    clearActiveDEK: () => {
      if (activeDEK && typeof activeDEK.fill === "function") {
        activeDEK.fill(0);
      }
      activeDEK = null;
      console.info("Active encryption key cleared from memory");
    },

    getActiveDEK: (): TBuffer => {
      if (!activeDEK) {
        throw new Error(
          "Encryption key not initialized. User must login first.",
        );
      }
      return activeDEK;
    },

    isKeyLoaded: (): boolean => {
      return !!activeDEK;
    },
  };
};
