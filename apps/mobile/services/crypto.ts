import { createCryptoService } from "@viclip/utils";
import { getRandomBytes } from "expo-crypto";
import {
  Buffer,
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
} from "react-native-quick-crypto";

// Provide a custom randomBytes function that uses expo-crypto or react-native-quick-crypto
// expo-crypto's getRandomBytes returns a Uint8Array, we convert to Buffer
const customRandomBytes = (size: number) => {
  return Buffer.from(getRandomBytes(size));
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
export const setActiveDEK = service.setActiveDEK;
export const getActiveDEK = service.getActiveDEK;
export const isKeyLoaded = service.isKeyLoaded;
