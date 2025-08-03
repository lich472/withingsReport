
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBH9u14pK9J8tiCnLr7kzty9pYIoZkSBLQ",
  authDomain: "withings-sleeper.firebaseapp.com",
  projectId: "withings-sleeper",
  storageBucket: "withings-sleeper.firebasestorage.app",
  messagingSenderId: "915548070860",
  appId: "1:915548070860:web:1f3988514df7da1ed37369"
};


const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export { app, auth };
