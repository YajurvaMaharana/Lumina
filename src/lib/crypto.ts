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

  const ciphertextArray = Array.from(new Uint8Array(encryptedBuffer));
  const saltArray = Array.from(salt);
  const ivArray = Array.from(iv);

  return {
    ciphertext: btoa(String.fromCharCode.apply(null, ciphertextArray)),
    salt: btoa(String.fromCharCode.apply(null, saltArray)),
    iv: btoa(String.fromCharCode.apply(null, ivArray))
  };
};

export const decryptData = async (
  encryptedPayload: { ciphertext: string, salt: string, iv: string }, 
  password: string
) => {
  const salt = new Uint8Array(atob(encryptedPayload.salt).split('').map(c => c.charCodeAt(0)));
  const iv = new Uint8Array(atob(encryptedPayload.iv).split('').map(c => c.charCodeAt(0)));
  const ciphertext = new Uint8Array(atob(encryptedPayload.ciphertext).split('').map(c => c.charCodeAt(0)));

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
