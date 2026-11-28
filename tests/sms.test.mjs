// Offline SMS relay (apps-script/Code.gs handleSms) against the Firestore emulator.
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { execFileSync } from "child_process";
import { createHash, randomUUID } from "crypto";
import { doc, setDoc, getDocs, collection, updateDoc, query, where } from "firebase/firestore";
const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const env = await initializeTestEnvironment({ projectId: "pet-tag-78771", firestore: { rules, host: "127.0.0.1", port: 8080 } });
await env.clearFirestore();
const alice = env.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
let pass = 0, fail = 0; const ok = (n, c) => { c ? pass++ : fail++; console.log(c ? "ok  " : "FAIL", n); };
await setDoc(doc(alice, "owners/alice"), { email: "alice@example.com", notify: true });
await setDoc(doc(alice, "pets/PT-7K3M9Q"), { ownerUid: "alice", name: "মিনি", species: "", note: "", showOwner: false, petPhoto: "", ownerPhoto: "", updatedAt: Date.now() });

const sent = [], cache = new Map(), props = new Map();
const UrlFetchApp = { fetch(url, o = {}) {
  url = url.replace("https://firestore.googleapis.com", "http://127.0.0.1:8080");
  const args = ["-s", "-w", "\n%{http_code}", "-X", (o.method || "get").toUpperCase(), "-H", "Authorization: Bearer owner"];
  if (o.payload) args.push("-H", "Content-Type: application/json", "-d", o.payload);
  const r = execFileSync("curl", [...args, url]).toString(); const i = r.lastIndexOf("\n");
  return { getResponseCode: () => Number(r.slice(i + 1)), getContentText: () => r.slice(0, i) };
} };
const ctx = { UrlFetchApp, MailApp: { sendEmail: m => sent.push(m) }, ScriptApp: { getOAuthToken: () => "owner", getService: () => ({ getUrl: () => "https://script.google.com/macros/s/X/dev" }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) }, ContentService: { createTextOutput: s => s },
  Session: { getActiveUser: () => ({ getEmail: () => "me@x.com" }) }, Logger: { log: s => logs.push(s) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v), deleteProperty: k => props.delete(k) }) },
  CacheService: { getScriptCache: () => ({ get: k => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
  Utilities: { DigestAlgorithm: { SHA_256: "sha256" }, computeDigest: (a, s) => [...createHash(a).update(s).digest()], base64Encode: b => Buffer.from(b).toString("base64"), getUuid: () => randomUUID() } };
const logs = [];
const src = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");
const gs = new Function(...Object.keys(ctx), src + "; return { doPost, setupSms, newSmsKey };")(...Object.values(ctx));
const sms = (key, body) => gs.doPost({ parameter: { key }, postData: { contents: typeof body === "string" ? body : JSON.stringify(body) } });
const inbox = async () => (await getDocs(query(collection(alice, "messages"), where("ownerUid", "==", "alice")))).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());

ok("no key set yet -> rejected", sms("x", { from: "+8801711111111", text: "PT-7K3M9Q FOUND" }) === "bad key");
gs.setupSms();
const key = props.get("SMS_KEY");
ok("setupSms makes a key and logs the link", /^[0-9a-f]{32}$/.test(key) && logs[0].includes("/exec?key=" + key));
ok("editor /dev URL is replaced by the live /exec URL", !logs[0].includes("/dev") && logs[0].includes("AKfycbzDvTQ") && logs[0].includes("/exec?key="));
ok("wrong key rejected", sms("wrong", { from: "+8801711111111", text: "PT-7K3M9Q FOUND" }) === "bad key");
ok("garbage body rejected", sms(key, "not json") === "bad request");
ok("SMS without tag id ignored", sms(key, { from: "+8801711111111", text: "hello" }) === "no tag");
ok("finder SMS saved + emailed", sms(key, { from: "+8801711111111", text: "PT-7K3M9Q FOUND. Dhanmondi 27", sentStamp: 1 }) === "sent");
let msgs = await inbox();
ok("one message in owner's inbox", msgs.length === 1);
ok("message has finder number, text, sms marker", msgs[0]?.finderPhone === "+8801711111111" && msgs[0].message.includes("Dhanmondi") && msgs[0].via === "sms" && msgs[0].read === false && msgs[0].petName === "মিনি");
ok("createdAt is a real timestamp", typeof msgs[0]?.createdAt?.toMillis === "function");
ok("email went to owner's private address", sent[0]?.to === "alice@example.com" && sent[0].htmlBody.includes("নেট ছাড়া"));
ok("app retry of same SMS not duplicated", sms(key, { from: "+8801711111111", text: "PT-7K3M9Q FOUND. Dhanmondi 27", sentStamp: 1 }) === "already sent" && sent.length === 1);
ok("lowercase / no dash tag id still found", sms(key, { from: "01722222222", text: "pt 7k3m9q found", sentStamp: 2 }) === "sent");
ok("unknown tag id not saved", sms(key, { from: "01733333333", text: "PT-ZZZZZZ FOUND", sentStamp: 3 }) === "unknown tag" && (await inbox()).length === 2);
for (let i = 0; i < 4; i++) sms(key, { from: "01744444444", text: "PT-7K3M9Q FOUND " + i, sentStamp: 10 + i });
ok("6th SMS in an hour from one number is blocked", sms(key, { from: "01744444444", text: "PT-7K3M9Q FOUND x", sentStamp: 99 }) === "sent"
  && sms(key, { from: "01744444444", text: "PT-7K3M9Q FOUND y", sentStamp: 100 }) === "rate limited");
msgs = await inbox();
ok("owner can mark an SMS message read", await updateDoc(doc(alice, "messages/" + msgs[0].id), { read: true }).then(() => true, () => false));
ok("web alert path still works with ?key absent", gs.doPost({ parameter: {}, postData: { contents: JSON.stringify({ id: "../x" }) } }) === "bad id");
await setDoc(doc(alice, "owners/alice"), { notify: false }, { merge: true });
gs.newSmsKey();
ok("newSmsKey replaces the key; old link stops working", props.get("SMS_KEY") !== key && sms(key, { from: "01766666666", text: "PT-7K3M9Q FOUND", sentStamp: 7 }) === "bad key");
ok("owner turned alerts off -> saved, no email", sms(props.get("SMS_KEY"), { from: "01755555555", text: "PT-7K3M9Q FOUND", sentStamp: 5 }) === "saved");
console.log(`\n${pass} passed, ${fail} failed`); await env.cleanup(); process.exit(fail ? 1 : 0);
