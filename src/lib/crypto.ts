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
