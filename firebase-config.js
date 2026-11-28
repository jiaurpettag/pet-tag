// Firebase web config. These values are public by design (security comes from firestore.rules),
// so committing them is safe. Source: Firebase console → Project settings → Your apps → Web app.
export const firebaseConfig = {
  apiKey: "AIzaSyDU2bBrm6q26JAnvPhhFUIhKNK_H1YngMk",
  authDomain: "pet-tag-78771.firebaseapp.com",
  projectId: "pet-tag-78771",
  storageBucket: "pet-tag-78771.firebasestorage.app",
  messagingSenderId: "1018028610475",
  appId: "1:1018028610475:web:d49d3de1d76c3a247b38ee",
};

// The public address of this site. QR codes point to SITE_URL + "?t=PT-XXXXXX".
export const SITE_URL = "https://jiaurpettag.github.io/pet-tag/";

// Email alerts: the Web app URL of the deployed Google Apps Script (apps-script/Code.gs). Empty = no emails.
export const NOTIFY_URL = "https://script.google.com/macros/s/AKfycbzDvTQMHIbhBFOL242jeQmMxM5l7VKN3biM1XD2hOmgdtj6xozRiH6AWpsqYh2efg-V/exec";

// Offline SMS QR (back of the tag): the company SIM number in the relay Android phone, with country code,
// e.g. "+8801712345678". Empty = the back side is not printed yet. Never put a pet owner's number here.
export const SMS_NUMBER = "";

// Brand shown on the front ring: "Powered by <BRAND>".
export const BRAND = "ZiaurIT";
