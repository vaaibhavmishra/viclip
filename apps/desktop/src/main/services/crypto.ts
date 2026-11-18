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
let activeUserId: string | null = null;
const keyWaiters = new Set<() => void>();

export const setActiveDEK = (key: Uint8Array, userId: string): void => {
  if (!userId) throw new Error("Encryption key must belong to an account");
  service.setActiveDEK(key as unknown as Buffer<ArrayBuffer>);
  activeUserId = userId;
  for (const notify of [...keyWaiters]) notify();
};

export const isKeyLoaded = (userId: string): boolean =>
  activeUserId === userId && service.isKeyLoaded();

export const waitForKeyLoaded = (
  timeoutMs: number,
  userId: string,
): Promise<boolean> => {
  if (isKeyLoaded(userId)) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const finish = (): void => {
      clearTimeout(timer);
      keyWaiters.delete(onChanged);
      resolve(isKeyLoaded(userId));
    };
    const onChanged = (): void => {
      if (isKeyLoaded(userId) || activeUserId === null) finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    keyWaiters.add(onChanged);
  });
};

export const getActiveDEK = (userId: string): Buffer => {
  if (!isKeyLoaded(userId))
    throw new Error("Encryption key unavailable for this account");
  return service.getActiveDEK();
};
export const clearActiveDEK = (): void => {
  service.clearActiveDEK();
  activeUserId = null;
  for (const notify of [...keyWaiters]) notify();
};
