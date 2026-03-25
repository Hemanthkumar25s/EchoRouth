import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, RecaptchaVerifier, signInWithPhoneNumber, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider, getToken } from 'firebase/app-check';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();


// Initialize App Check
if (typeof window !== 'undefined') {
  try {
    // Enable debug mode for development if needed
    // (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = 'AI-STUDIO-DEBUG-TOKEN-12345';

    const appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider('6LdqEpYsAAAAAF2Os2RZMU7CS6GfTaeHnXBJP7bR'),
      isTokenAutoRefreshEnabled: true
    });
    console.log("Firebase App Check (v3) initialized successfully.");
    
    getToken(appCheck).then(() => {
      console.log("App Check token retrieved successfully.");
    }).catch((err) => {
      console.warn("App Check token retrieval failed. If you still see errors, ensure both domains are added to reCAPTCHA console:", err.message);
    });
  } catch (error) {
    console.error("Error initializing Firebase App Check:", error);
  }
}



export const loginWithGoogle = async () => {
  try {
    console.log("Attempting Google Sign-In for domain:", window.location.hostname);
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error: any) {
    console.error("Full Firebase Auth Error Object:", error);
    console.error("Error Code:", error.code);
    console.error("Error Message:", error.message);
    
    if (error.code === 'auth/internal-error') {
      console.error("CRITICAL: auth/internal-error detected. Troubleshooting steps:");
      console.error("1. Ensure 'Identity Toolkit API' is enabled in Google Cloud Console.");
      console.error("2. Ensure 'Google' provider is fully configured with a support email in Firebase Console.");
      console.error("3. Check for API Key restrictions in Google Cloud Console Credentials.");
    }
    throw error;
  }
};

export const loginWithEmail = async (email: string, pass: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result;
  } catch (error) {
    console.error("Email Login Error:", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};

// Test connection to Firestore
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test successful.");
    return true;
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is reporting as offline.");
      return false;
    }
    // "Permission denied" or other errors mean the server was reached
    console.log("Firestore connection test: Server reached (but access may be restricted).");
    return true;
  }
}
testFirestoreConnection();
