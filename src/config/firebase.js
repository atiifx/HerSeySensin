import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Firebase yapılandırman
const firebaseConfig = {
  apiKey: "AIzaSyC18qpYNhmJepVPNs88gn2-u4_ceRs1gvE",
  authDomain: "herseysenx.firebaseapp.com",
  databaseURL: "https://herseysenx-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "herseysenx",
  storageBucket: "herseysenx.firebasestorage.app",
  messagingSenderId: "1066675038193",
  appId: "1:1066675038193:web:d86e14d9a88e4746cb8650"
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);

// Anlık veri alışverişi yapacağımız Realtime Database'i dışa aktar
export const db = getDatabase(app);
export default app;