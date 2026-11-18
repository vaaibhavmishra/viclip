import { getAuth } from "@react-native-firebase/auth";
import { CRYPTO_CONFIG } from "@viclip/constants";
import { createCryptoService } from "@viclip/utils";
import { getRandomValues } from "expo-crypto";
import {
  Buffer,
  createCipheriv,
  createDecipheriv,
  pbkdf2,
  pbkdf2Sync,
} from "react-native-quick-crypto";

// Provide a custom randomBytes function that uses expo-crypto or react-native-quick-crypto
// expo-crypto's getRandomValues returns a Uint8Array, we convert to Buffer
const customRandomBytes = (size: number) => {
  // Direct native randomness fails closed; getRandomBytes can use Math.random in development.
  return Buffer.from(getRandomValues(new Uint8Array(size)));
};

const service = createCryptoService({
  randomBytes: customRandomBytes,
  pbkdf2Sync,
  createCipheriv: (algorithm, key, iv) => createCipheriv(algorithm, key, iv),
  createDecipheriv: (algorithm, key, iv) =>
    createDecipheriv(algorithm, key, iv),
  Buffer,
});

export const generateDEK = service.generateDEK;
export const generateSalt = service.generateSalt;
export const deriveKEK = service.deriveKEK;
export const encrypt = service.encrypt;
export const decrypt = service.decrypt;
export const wrapKey = service.wrapKey.bind(service);
export const unwrapKey = service.unwrapKey.bind(service);
let keyOwner: string | null = null;

export function setActiveDEK(key: Buffer, userId: string): void {
  if (!userId || getAuth().currentUser?.uid !== userId) {
    throw new Error("Encryption key belongs to an inactive account");
  }
  service.setActiveDEK(key);
  keyOwner = userId;
}

export function clearActiveDEK(): void {
  service.clearActiveDEK();
  keyOwner = null;
}

export function isKeyLoaded(userId = getAuth().currentUser?.uid): boolean {
  if (!userId || keyOwner !== userId || getAuth().currentUser?.uid !== userId) {
    clearActiveDEK();
    return false;
  }
  return service.isKeyLoaded();
}

export function getActiveDEK(): Buffer {
  if (!isKeyLoaded())
    throw new Error("Encryption key is unavailable for the current account");
  return service.getActiveDEK();
}

/** Derive the same interoperable KEK without blocking the JavaScript thread. */
export function deriveKEKAsync(
  password: string,
  saltHex: string,
): Promise<Buffer> {
  if (
    !new RegExp(`^[0-9a-f]{${CRYPTO_CONFIG.saltLength * 2}}$`, "i").test(
      saltHex,
    )
  ) {
    return Promise.reject(new Error("Invalid encryption salt"));
  }
  return new Promise((resolve, reject) => {
    pbkdf2(
      password,
      Buffer.from(saltHex, "hex"),
      CRYPTO_CONFIG.pbkdf2Iterations,
      CRYPTO_CONFIG.keyLength,
      CRYPTO_CONFIG.pbkdf2Digest,
      (error, key) => {
        if (error || !key || key.length !== CRYPTO_CONFIG.keyLength) {
          reject(new Error("Key derivation failed"));
        } else resolve(key);
      },
    );
  });
}
