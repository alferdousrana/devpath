// ---------------------------------------------------------------------------
// App configuration.
// The Firebase web config is NOT a secret: it only identifies your project.
// Firestore Security Rules are what protect the data.
// Paste the values from Firebase Console → Project settings → Your apps → Web app.
// Leave apiKey empty to run in local-only mode (no cloud sync) while you set up.
// ---------------------------------------------------------------------------
export const firebaseConfig = {
  apiKey: "AIzaSyB8wP_92MoamwtdLiJFVZ9Vzofz3BkUzRA",
  authDomain: "devpath-d3c50.firebaseapp.com",
  projectId: "devpath-d3c50",
  storageBucket: "devpath-d3c50.firebasestorage.app",
  messagingSenderId: "218122841531",
  appId: "1:218122841531:web:97d09c2c8e1fd4820de89e",
  measurementId: "G-YQH7QWMMMR",
};

export const APP = {
  name: "DevPath",
  version: "1.0.0",
  defaultTrack: "backend",
  passPercent: 70,          // default exam pass threshold
  weakAccuracy: 0.7,        // topic accuracy below this = weak
  minAnswersForWeak: 3,     // need at least this many answers to judge a topic
  firebaseSdk: "10.12.2"
};

// XP is derived from the activity log, never stored as a counter,
// so two devices can never overwrite each other's XP.
export const XP = {
  lesson: 20, quizAttempt: 5, correct: 2, examTaken: 10, examPassed: 50,
  logicCorrect: 8, codingSolved: 25
};

export const DEFAULT_GOALS = { lessons: 1, mcq: 10, logic: 1, review: 5, weeklyXp: 400 };

// Spaced review intervals (days) per Leitner box. Passing the last box = mastered.
export const REVIEW_INTERVALS = [1, 2, 4, 8];

export const isFirebaseConfigured = () => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
