import { collection, doc, getDocs, getDoc, setDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { Journal, Message } from '../types';

export const getJournals = async (userId: string): Promise<Journal[]> => {
  const q = query(
    collection(db, 'users', userId, 'journals'),
    orderBy('updatedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Journal));
};

export const getJournal = async (userId: string, journalId: string): Promise<Journal | null> => {
  const docRef = doc(db, 'users', userId, 'journals', journalId);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as Journal;
  }
  return null;
};

export const saveJournal = async (userId: string, journal: Journal): Promise<void> => {
  const docRef = doc(db, 'users', userId, 'journals', journal.id);
  const { id, ...data } = journal;
  await setDoc(docRef, {
    ...data,
    updatedAt: Date.now(),
  }, { merge: true });
};
