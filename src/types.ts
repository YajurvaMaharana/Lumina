export interface Journal {
  id: string;
  userId: string;
  title: string;
  summary: string;
  location?: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  
  // Encrypted fields (when saved to Firestore)
  encryptedPayload?: {
    ciphertext: string;
    salt: string;
    iv: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
