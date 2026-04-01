import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyC-vLSZQ7PUAwcDCf70f_JwJE9pmVMM_0s",
  authDomain: "joanna-bot.firebaseapp.com",
  projectId: "joanna-bot",
  storageBucket: "joanna-bot.firebasestorage.app",
  messagingSenderId: "702967678004",
  appId: "1:702967678004:web:164345e8890fa6fa503661",
  measurementId: "G-4QDLJB4SJ0"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
