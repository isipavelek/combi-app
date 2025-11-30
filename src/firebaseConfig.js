import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getMessaging } from 'firebase/messaging';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBvRzi4aDOgzdTHtnQmJh_fRh3kqurBXeA",
  authDomain: "combiapp-e585a.firebaseapp.com",
  projectId: "combiapp-e585a",
  storageBucket: "combiapp-e585a.firebasestorage.app",
  messagingSenderId: "884793176289",
  appId: "1:884793176289:web:7402bda2ef660077c607a0",
  measurementId: "G-QNHCT5VXK8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const messaging = getMessaging(app);
const functions = getFunctions(app);

export { app, db, auth, provider, messaging, functions };
