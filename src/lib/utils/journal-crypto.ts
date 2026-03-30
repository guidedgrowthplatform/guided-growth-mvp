/**
 * Journal Entry Encryption
 * Client-side AES-GCM 256-bit encryption for journal entries.
 * The server never sees plaintext — only encrypted ciphertext is transmitted and stored.
 *
 * Key derivation: PBKDF2(userId + APP_SALT)
 * Encryption: AES-GCM with random 12-byte IV per entry
 * Storage format: base64(iv) + "." + base64(ciphertext)
 */

// App-level salt (constant, can be part of the public bundle)
const APP_SALT = 'life-growth-tracker-journal-v1';

/**
 * Derive a 256-bit AES key from a user ID using PBKDF2.
 * The key is deterministic per user but cannot be reversed without the password.
 *
 * @param userId - The user's ID (from auth store)
 * @returns Promise<CryptoKey> - The derived key for AES-GCM
 */
export async function deriveKey(userId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId + APP_SALT),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(APP_SALT),
      iterations: 100000,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false, // not exportable
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a journal entry plaintext.
 *
 * @param plaintext - The journal entry text
 * @param userId - The user's ID (used for key derivation)
 * @returns Promise<string> - Ciphertext in format "base64(iv).base64(ciphertext)"
 * @throws If encryption fails
 */
export async function encryptJournal(plaintext: string, userId: string): Promise<string> {
  try {
    const key = await deriveKey(userId);
    const encoder = new TextEncoder();

    // Generate a random 12-byte IV for this entry
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the plaintext
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(plaintext),
    );

    // Return as "base64(iv).base64(ciphertext)" for storage
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));

    return `${ivBase64}.${ciphertextBase64}`;
  } catch (error) {
    console.error('Journal encryption failed:', error);
    throw new Error('Failed to encrypt journal entry');
  }
}

/**
 * Decrypt a journal entry ciphertext.
 *
 * @param ciphertext - Encrypted text in format "base64(iv).base64(ciphertext)"
 * @param userId - The user's ID (used for key derivation)
 * @returns Promise<string> - The decrypted plaintext
 * @throws If decryption fails or ciphertext format is invalid
 */
export async function decryptJournal(ciphertext: string, userId: string): Promise<string> {
  try {
    // Parse the storage format
    const parts = ciphertext.split('.');
    if (parts.length !== 2) {
      throw new Error('Invalid ciphertext format (expected "iv.ciphertext")');
    }

    const ivBase64 = parts[0];
    const ciphertextBase64 = parts[1];

    // Decode from base64
    const iv = new Uint8Array(
      atob(ivBase64)
        .split('')
        .map((c) => c.charCodeAt(0)),
    );
    const ciphertextBytes = new Uint8Array(
      atob(ciphertextBase64)
        .split('')
        .map((c) => c.charCodeAt(0)),
    );

    // Derive the key
    const key = await deriveKey(userId);

    // Decrypt
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextBytes);

    return new TextDecoder().decode(plaintext);
  } catch (error) {
    console.error('Journal decryption failed:', error);
    throw new Error('Failed to decrypt journal entry');
  }
}
