import { collection, doc, getDocs, getDoc, setDoc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { Journal } from '../types';
import { getPassword, encryptData, decryptData } from './crypto';

const processJournalDoc = async (data: any, id: string): Promise<Journal> => {
  let journalData = { id, ...data } as Journal;
  const password = getPassword();
  
  if (journalData.encryptedPayload) {
    if (password) {
      try {
        const decrypted = await decryptData(journalData.encryptedPayload, password);
        journalData = { ...journalData, ...decrypted };
      } catch (err) {
        console.error("Failed to decrypt journal", err);
        journalData.title = "🔒 Decryption Failed (Wrong Password?)";
        journalData.messages = [];
        journalData.summary = "Unable to decrypt data.";
      }
    } else {
      journalData.title = "🔒 Encrypted Entry";
      journalData.messages = [];
      journalData.summary = "Please set your password to view this entry.";
    }
  }
  return journalData;
};

export const getJournals = async (userId: string): Promise<Journal[]> => {
  const q = query(
    collection(db, 'users', userId, 'journals'),
    orderBy('updatedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  const journals = await Promise.all(snapshot.docs.map(doc => processJournalDoc(doc.data(), doc.id)));
  return journals;
};

export const getJournal = async (userId: string, journalId: string): Promise<Journal | null> => {
  const docRef = doc(db, 'users', userId, 'journals', journalId);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return await processJournalDoc(snapshot.data(), snapshot.id);
  }
  return null;
};

export const saveJournal = async (userId: string, journal: Journal): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'journals', journal.id);
  const password = getPassword();
  
  if (!password) {
    throw new Error("Zero-Knowledge password is required to save.");
  }

  const { id, title, summary, location, messages, ...baseData } = journal;
  const sensitiveData = { title, summary, location, messages };
  
  const encryptedPayload = await encryptData(sensitiveData, password);
  
  await setDoc(docRef, {
    ...baseData,
    encryptedPayload,
    updatedAt: Date.now(),
    title: "", // clear plaintext
    summary: "", // clear plaintext
    location: "", // clear plaintext
    messages: [] // clear plaintext
  }, { merge: true });
};

