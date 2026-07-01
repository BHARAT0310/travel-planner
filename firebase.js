


import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase configuration structure (Using user's provided placeholder structure)
const firebaseConfig = {

    apiKey: "AIzaSyDsQP3dbp25KZi7KVH013dfPdW86HhUt40",

    authDomain: "bani-travel-planner.firebaseapp.com",

    projectId: "bani-travel-planner",

    storageBucket: "bani-travel-planner.firebasestorage.app",

    messagingSenderId: "682323357279",

    appId: "1:682323357279:web:34de4b3415a93fbad835ea"

};
// Initialize Firebase App
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export instances and modular SDK utilities
export { 
  db, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy 
};