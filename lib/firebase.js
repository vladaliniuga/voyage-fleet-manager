// lib/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBHhdkLbXMrWMdO1L1PoPd3IW02KFnKs5E',
  authDomain: 'voyage-rental-cars-database.firebaseapp.com',
  projectId: 'voyage-rental-cars-database',
  storageBucket: 'voyage-rental-cars-database.appspot.com',
  messagingSenderId: '7539309962',
  appId: '1:7539309962:web:d22b937fd0acb65f145c73',
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
