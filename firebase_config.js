/**
 * ╔═══════════════════════════════════════════════════════════════╗
 * ║   STRATIX — Firebase Configuration                           ║
 * ║   Project: stratix-pro                                       ║
 * ╚═══════════════════════════════════════════════════════════════╝
 */

const STRATIX_FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDwUyT7Mq13Kfz_P90hH4cJXA5jHg4Ds1k",
  authDomain:        "stratix-pro.firebaseapp.com",
  projectId:         "stratix-pro",
  storageBucket:     "stratix-pro.firebasestorage.app",
  messagingSenderId: "744364078635",
  appId:             "1:744364078635:web:e1a97378c4def4d5b3dc6e",
  measurementId:     "G-4R4BT4ND99"
};

const STRATIX_FB_COLLECTIONS = {
  users:    'stratix_users',
  userdata: 'stratix_data',
};

const STRATIX_FB_FLAGS = {
  ENABLED:           true,   // ✅ Firebase active
  SYNC_TO_FIRESTORE: true,
  REALTIME_SYNC:     false,
  OFFLINE_FIRST:     true,
};

(function initFirebase() {
  if (!STRATIX_FB_FLAGS.ENABLED) {
    window.STRATIX_FB = null; window.STRATIX_FB_AUTH = null; window.STRATIX_FB_STORE = null;
    return;
  }
  if (typeof firebase === 'undefined') {
    console.warn('[STRATIX] Firebase SDK not loaded.');
    window.STRATIX_FB = null; window.STRATIX_FB_AUTH = null; window.STRATIX_FB_STORE = null;
    return;
  }
  try {
    if (!firebase.apps || firebase.apps.length === 0) {
      firebase.initializeApp(STRATIX_FIREBASE_CONFIG);
    }
    window.STRATIX_FB       = firebase.app();
    window.STRATIX_FB_AUTH  = firebase.auth();
    window.STRATIX_FB_STORE = firebase.firestore();

    if (STRATIX_FB_FLAGS.OFFLINE_FIRST) {
      window.STRATIX_FB_STORE.enablePersistence({ synchronizeTabs: true })
        .catch(e => console.warn('[STRATIX] Offline persistence:', e.code));
    }

    // Set Google provider language to English
    window.STRATIX_FB_AUTH.languageCode = 'en';

    // Init Analytics (uses measurementId automatically)
    try {
      if (typeof firebase.analytics === 'function') {
        window.STRATIX_FB_ANALYTICS = firebase.analytics();
        console.info('[STRATIX] Analytics active ✓');
      }
    } catch(e) {}

    console.info('[STRATIX] Firebase connected ✓ — stratix-pro');
  } catch(e) {
    console.error('[STRATIX] Firebase init error:', e);
    window.STRATIX_FB = null; window.STRATIX_FB_AUTH = null; window.STRATIX_FB_STORE = null;
  }
})();
