export const setPassword = (pass: string) => {
  (window as any).__ENC_PASSWORD = pass;
};

export const getPassword = (): string | null => {
  return (window as any).__ENC_PASSWORD || null;
};

export const clearPassword = () => {
  delete (window as any).__ENC_PASSWORD;
};

export const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 300000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

export const encryptData = async (data: any, password: string) => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(password, salt);
  
  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(data));
  
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    encodedData
  );

  let ciphertextStr = '';
  const cipherBytes = new Uint8Array(encryptedBuffer);
  for (let i = 0; i < cipherBytes.byteLength; i++) {
    ciphertextStr += String.fromCharCode(cipherBytes[i]);
  }

  let saltStr = '';
  for (let i = 0; i < salt.byteLength; i++) {
    saltStr += String.fromCharCode(salt[i]);
  }

  let ivStr = '';
  for (let i = 0; i < iv.byteLength; i++) {
    ivStr += String.fromCharCode(iv[i]);
  }

  return {
    ciphertext: btoa(ciphertextStr),
    salt: btoa(saltStr),
    iv: btoa(ivStr)
  };
};

export const decryptData = async (
  encryptedPayload: { ciphertext: string, salt: string, iv: string }, 
  password: string
) => {
  const saltStr = atob(encryptedPayload.salt);
  const salt = new Uint8Array(saltStr.length);
  for (let i = 0; i < saltStr.length; i++) {
    salt[i] = saltStr.charCodeAt(i);
  }

  const ivStr = atob(encryptedPayload.iv);
  const iv = new Uint8Array(ivStr.length);
  for (let i = 0; i < ivStr.length; i++) {
    iv[i] = ivStr.charCodeAt(i);
  }

  const ciphertextStr = atob(encryptedPayload.ciphertext);
  const ciphertext = new Uint8Array(ciphertextStr.length);
  for (let i = 0; i < ciphertextStr.length; i++) {
    ciphertext[i] = ciphertextStr.charCodeAt(i);
  }

  const key = await deriveKey(password, salt);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decryptedBuffer));
};

// ============================================================================
// COLLABORATIVE END-TO-END ENCRYPTION (E2EE)
// ============================================================================

// Helper: Convert Uint8Array to base64url string
const bufferToBase64Url = (buffer: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Helper: Convert base64url string to Uint8Array
const base64UrlToBuffer = (base64url: string): Uint8Array => {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
};

// 1. Generate a high-entropy 256-bit symmetric key for a partner connection
export const generateShareKey = (): string => {
  const rawKey = window.crypto.getRandomValues(new Uint8Array(32)); // 256-bit
  return bufferToBase64Url(rawKey);
};

// 2. Import raw base64url share key into WebCrypto CryptoKey
export const importShareKey = async (shareKeyString: string): Promise<CryptoKey> => {
  const rawBytes = base64UrlToBuffer(shareKeyString);
  return window.crypto.subtle.importKey(
    "raw",
    rawBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

// 3. Encrypt data with partner's shared key (End-to-End Encryption)
export const encryptWithShareKey = async (
  data: any,
  shareKeyString: string
): Promise<{ ciphertext: string; salt: string; iv: string }> => {
  const key = await importShareKey(shareKeyString);
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit AES-GCM IV

  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(data));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    encodedData
  );

  let ciphertextBinary = '';
  const cipherBytes = new Uint8Array(encryptedBuffer);
  for (let i = 0; i < cipherBytes.byteLength; i++) {
    ciphertextBinary += String.fromCharCode(cipherBytes[i]);
  }

  let ivBinary = '';
  for (let i = 0; i < iv.byteLength; i++) {
    ivBinary += String.fromCharCode(iv[i]);
  }

  return {
    ciphertext: btoa(ciphertextBinary),
    salt: '', // Direct symmetric key, salt not required
    iv: btoa(ivBinary)
  };
};

// 4. Decrypt data with partner's shared key
export const decryptWithShareKey = async (
  encryptedPayload: { ciphertext: string; salt?: string; iv: string },
  shareKeyString: string
): Promise<any> => {
  const key = await importShareKey(shareKeyString);

  const ivBinary = atob(encryptedPayload.iv);
  const iv = new Uint8Array(ivBinary.length);
  for (let i = 0; i < ivBinary.length; i++) {
    iv[i] = ivBinary.charCodeAt(i);
  }

  const cipherBinary = atob(encryptedPayload.ciphertext);
  const ciphertext = new Uint8Array(cipherBinary.length);
  for (let i = 0; i < cipherBinary.length; i++) {
    ciphertext[i] = cipherBinary.charCodeAt(i);
  }

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decryptedBuffer));
};

// 5. Local Vault Management for Partner Keys
const PARTNER_KEY_PREFIX = 'lumina_partner_key_';

export const storePartnerKey = (connectionId: string, shareKey: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`${PARTNER_KEY_PREFIX}${connectionId}`, shareKey);
  }
};

export const getPartnerKey = (connectionId: string): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(`${PARTNER_KEY_PREFIX}${connectionId}`) || null;
  }
  return null;
};

export const removePartnerKey = (connectionId: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(`${PARTNER_KEY_PREFIX}${connectionId}`);
  }
};

// ============================================================================
// PASSWORD-PROTECTED COLLABORATIVE SHARING
// ============================================================================

// Compute SHA-256 access verification hash for password validation
export const computeAccessHash = async (password: string, saltBase64: string): Promise<string> => {
  const enc = new TextEncoder();
  const data = enc.encode(`${password}:${saltBase64}:lumina_access_verifier`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Encrypt a shared journal reflection with a user-specified custom password
export const encryptSharedEntryWithPassword = async (
  payload: any,
  password: string
): Promise<{
  encryptedPayload: { ciphertext: string; salt: string; iv: string };
  accessHash: string;
}> => {
  const encryptedPayload = await encryptData(payload, password);
  const accessHash = await computeAccessHash(password, encryptedPayload.salt);
  return {
    encryptedPayload,
    accessHash
  };
};

// Verify password against accessHash and decrypt the shared reflection
export const verifyAndDecryptSharedEntry = async (
  encryptedPayload: { ciphertext: string; salt: string; iv: string },
  accessHash: string | undefined,
  password: string
): Promise<any> => {
  if (accessHash) {
    const computed = await computeAccessHash(password, encryptedPayload.salt);
    if (computed !== accessHash) {
      throw new Error('Incorrect password. Please verify the password shared by your partner.');
    }
  }

  try {
    const data = await decryptData(encryptedPayload, password);
    return data;
  } catch (err) {
    throw new Error('Incorrect password. Please verify the password shared by your partner.');
  }
};


