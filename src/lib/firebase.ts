// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getDataConnect } from 'firebase/data-connect';
import firebaseConfig from '../../firebase-applet-config.json';
import { connectorConfig } from '../generated/dataconnect';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
export const dataConnect = getDataConnect(app, connectorConfig);
