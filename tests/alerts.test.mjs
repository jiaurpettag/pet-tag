import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { execFileSync } from "child_process";
import { doc, setDoc, addDoc, collection, serverTimestamp, getDoc, Timestamp } from "firebase/firestore";
const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const env = await initializeTestEnvironment({ projectId: "pet-tag-78771", firestore: { rules, host: "127.0.0.1", port: 8080 } });
const alice = env.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
const anon = env.unauthenticatedContext().firestore();
let pass = 0, fail = 0; const ok = (n, c) => { c ? pass++ : fail++; console.log(c ? "ok  " : "FAIL", n); };
const tryp = async p => { try { await p; return true; } catch { return false; } };
// rules: owner email privacy
ok("owner saves own email", await tryp(setDoc(doc(alice, "owners/alice"), { email: "alice@example.com", notify: true }, { merge: true })));
ok("owner cannot save someone else's email", !(await tryp(setDoc(doc(alice, "owners/alice"), { email: "x@evil.com" }, { merge: true }))));
ok("anon cannot read owner email", !(await tryp(getDoc(doc(anon, "owners/alice")))));
ok("photo + email merge works", await tryp(setDoc(doc(alice, "owners/alice"), { photo: "" }, { merge: true })));
await setDoc(doc(alice, "pets/PT-7K3M9Q"), { ownerUid: "alice", name: "মিনি", species: "", note: "", showOwner: false, petPhoto: "", ownerPhoto: "", updatedAt: Date.now() });
const ref = await addDoc(collection(anon, "messages"), { tagId: "PT-7K3M9Q", ownerUid: "alice", petName: "মিনি", finderName: "রহিম", finderPhone: "01700000000", location: "ধানমন্ডি <b>", mapUrl: "https://maps.google.com/?q=23.74610,90.37420", message: "পেয়েছি", read: false, createdAt: serverTimestamp() });
// load Code.gs with mocks
const sent = [];
const UrlFetchApp = { fetch(url, o = {}) {
  url = url.replace("https://firestore.googleapis.com", "http://127.0.0.1:8080");
  const args = ["-s", "-w", "\n%{http_code}", "-X", (o.method || "get").toUpperCase(), "-H", "Authorization: Bearer owner"];
  if (o.payload) args.push("-H", "Content-Type: application/json", "-d", o.payload);
  const r = execFileSync("curl", [...args, url]).toString(); const i = r.lastIndexOf("\n");
  return { getResponseCode: () => Number(r.slice(i + 1)), getContentText: () => r.slice(0, i) };
} };
const ctx = { UrlFetchApp, MailApp: { sendEmail: m => sent.push(m) }, ScriptApp: { getOAuthToken: () => "owner" },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) }, ContentService: { createTextOutput: s => s },
  Session: { getActiveUser: () => ({ getEmail: () => "me@x.com" }) }, Logger: { log() {} } };
const src = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");
const gs = new Function(...Object.keys(ctx), src + "; return { doPost, doGet };")(...Object.values(ctx));
const post = id => gs.doPost({ postData: { contents: JSON.stringify({ id }) } });
ok("first call sends", post(ref.id) === "sent");
ok("email went to owner's private address", sent[0]?.to === "alice@example.com");
ok("html escaped", sent[0]?.htmlBody.includes("ধানমন্ডি &lt;b&gt;"));
ok("map link in email", sent[0]?.htmlBody.includes("maps.google.com/?q=23.74610,90.37420"));
ok("second call does not resend", post(ref.id) === "already sent" && sent.length === 1);
ok("unknown id ignored", post("abcdefghij1234567890") === "not found");
ok("garbage id rejected", post("../../owners/alice") === "bad id");
await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), "messages/oldmsg1234567"), { tagId: "PT-7K3M9Q", ownerUid: "alice", petName: "x", message: "x", read: false, createdAt: Timestamp.fromMillis(Date.now() - 3600e3) }); });
ok("old message ignored", post("oldmsg1234567") === "too old");
await setDoc(doc(alice, "owners/alice"), { notify: false }, { merge: true });
const ref2 = await addDoc(collection(anon, "messages"), { tagId: "PT-7K3M9Q", ownerUid: "alice", petName: "মিনি", finderName: "", finderPhone: "", location: "", mapUrl: "", message: "২", read: false, createdAt: serverTimestamp() });
ok("owner turned alerts off -> no email", post(ref2.id) === "no email" && sent.length === 1);
ok("owner can still mark read after notified", await tryp((await import("firebase/firestore")).updateDoc(doc(alice, "messages/" + ref.id), { read: true })));
console.log(`\n${pass} passed, ${fail} failed`); await env.cleanup(); process.exit(fail ? 1 : 0);
