import { getRandomBytes } from 'expo-crypto'
import {
  Buffer,
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  randomBytes,
} from 'react-native-quick-crypto'

// Constants for encryption
const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 12 // 96 bits (standard for GCM)
const SALT_LENGTH = 16
const PBKDF2_ITERATIONS = 100000
const PBKDF2_DIGEST = 'sha256'

// Singleton to hold the active Data Encryption Key (DEK) in memory
let activeDEK: Buffer | null = null

/**
 * Generates a random 32-byte Data Encryption Key (DEK)
 */
export function generateDEK(): Buffer {
  return Buffer.from(getRandomBytes(KEY_LENGTH))
}

/**
 * Generates a random 16-byte Salt
 */
export function generateSalt(): string {
  return Buffer.from(getRandomBytes(SALT_LENGTH)).toString('hex')
}

/**
 * Derives a Key Encryption Key (KEK) from a password and salt using PBKDF2
 */
export function deriveKEK(password: string, saltHex: string): Buffer {
  return pbkdf2Sync(
    password,
    Buffer.from(saltHex, 'hex'),
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST,
  )
}

/**
 * Encrypts a text string using the provided Key (AES-256-GCM)
 * Format: IV (hex) : AuthTag (hex) : Ciphertext (hex)
 */
export function encrypt(text: string, key: Buffer): string {
  try {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // Return format: IV:Tag:Ciphertext
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  } catch (error) {
    console.error('Encryption failed:', error)
    throw new Error('Encryption failed')
  }
}

/**
 * Decrypts a text string using the provided Key (AES-256-GCM)
 * Expects format: IV (hex) : AuthTag (hex) : Ciphertext (hex)
 */
export function decrypt(encryptedText: string, key: Buffer): string {
  try {
    const parts = encryptedText.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format')
    }

    const [ivHex, authTagHex, encryptedHex] = parts

    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = createDecipheriv(ALGORITHM, key, iv)

    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.debug('Decryption failed:', error)
    // Return original text or empty string on failure?
    // For security, we should throw, but for UX we might want to handle gracefully.
    // Throwing ensures we don't accidentally treat ciphertext as plaintext.
    throw error
  }
}

/**
 * Helper to wrap (encrypt) the DEK using the KEK
 * Returns base64 string of the encrypted DEK
 */
export function wrapKey(dek: Buffer, kek: Buffer): string {
  // We treat the DEK as the "text" to encrypt, but we need to handle it as buffer
  // Re-using encrypt() would require converting buffer to string, which might be messy with encodings.
  // Let's write a buffer-specific encrypt/decrypt if needed, or just hex encode the DEK first.

  // Simplest: DEK -> Hex String -> Encrypt(KEK)
  return encrypt(dek.toString('hex'), kek)
}

/**
 * Helper to unwrap (decrypt) the DEK using the KEK
 */
export function unwrapKey(wrappedDEK: string, kek: Buffer): Buffer {
  const dekHex = decrypt(wrappedDEK, kek)
  return Buffer.from(dekHex, 'hex')
}

/**
 * Sets the active Data Encryption Key in memory
 */
export function setActiveDEK(key: Buffer) {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Invalid key length. Expected ${KEY_LENGTH} bytes.`)
  }
  activeDEK = key
  console.info('Active encryption key set in memory')
}

/**
 * Gets the active Data Encryption Key
 * Throws if not set
 */
export function getActiveDEK(): Buffer {
  if (!activeDEK) {
    throw new Error('Encryption key not initialized. User must login first.')
  }
  return activeDEK
}

/**
 * Checks if key is loaded
 */
export function isKeyLoaded(): boolean {
  return !!activeDEK
}
