import {
  type CipherGCM,
  createCipheriv,
  createDecipheriv,
  type DecipherGCM,
  pbkdf2Sync,
  randomBytes,
} from "node:crypto";
import { createCryptoService } from "@viclip/utils";

// Instantiate the shared crypto service with Node.js crypto primitives
const service = createCryptoService({
  randomBytes,
  pbkdf2Sync,
  createCipheriv: (algorithm, key, iv) =>
    createCipheriv(algorithm, key, iv) as CipherGCM,
  createDecipheriv: (algorithm, key, iv) =>
    createDecipheriv(algorithm, key, iv) as DecipherGCM,
  Buffer,
});

// Export the bound functions to match the previous API exactly
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
