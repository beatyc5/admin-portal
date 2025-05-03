// /admin-portal/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCLBU5a7Kx74T62awlrSIoNLkzsss5x8q0",
  authDomain: "mbeatydb.firebaseapp.com",
  projectId: "mbeatydb",
  storageBucket: "mbeatydb.firebasestorage.app",
  messagingSenderId: "122455300954",
  appId: "1:122455300954:web:74dd3682037566e4407163",
  measurementId: "G-SED7V3FVS4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { auth };