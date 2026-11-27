import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, connectAuthEmulator, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where,
  onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, SITE_URL } from "./firebase-config.js";

// Tag ID scheme: "PT-" + 6 chars from a 31-letter alphabet without 0/O/1/I/L (31^6 ≈ 887 million IDs).
// The same ID will later go into an offline SMSTO QR ("PT-XXXXXX found") sent to a company number.
const ALPHA = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const ID_RE = /^PT-[2-9A-HJKMNP-Z]{6}$/;

const app = document.getElementById("app");
const hdrId = document.getElementById("hdrId");

const configured = !String(firebaseConfig.apiKey).includes("REPLACE_ME");
let auth, db;
if (configured) {
  const fb = initializeApp(firebaseConfig);
  auth = getAuth(fb);
  db = getFirestore(fb);
  // Local testing only: open http://localhost:PORT/?emu once to use the Firebase emulators.
  if (location.hostname === "localhost") {
    try { if (new URLSearchParams(location.search).has("emu")) sessionStorage.setItem("emu", "1"); } catch {}
    let emu = false; try { emu = sessionStorage.getItem("emu") === "1"; } catch {}
    if (emu) { connectFirestoreEmulator(db, "127.0.0.1", 8080); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true }); }
  }
}

let unsub = [];
const clearSubs = () => { unsub.forEach(f => { try { f(); } catch {} }); unsub = []; };

// ---------- helpers ----------
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  // Grammarly and similar extensions can swallow Bangla keyboard (IME) input in form fields; opt every field out.
  if (tag === "input" || tag === "textarea") { e.setAttribute("data-gramm", "false"); e.setAttribute("data-gramm_editor", "false"); e.setAttribute("data-enable-grammarly", "false"); }
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) { if (k == null) continue; e.append(k.nodeType ? k : document.createTextNode(String(k))); }
  return e;
}
const card = (...kids) => el("div", { class: "card" }, ...kids);
// replaceChildren() would print a null child as the text "null", so drop empty slots first.
const fill = (node, ...kids) => node.replaceChildren(...kids.flat().filter(k => k != null && k !== false));
const show = (...nodes) => fill(app, ...nodes);
const safeImg = s => (typeof s === "string" && s.startsWith("data:image/jpeg;base64,") ? s : null);
const safeMap = s => (typeof s === "string" && /^https:\/\/maps\.google\.com\/\?q=-?[0-9.]+,-?[0-9.]+$/.test(s) ? s : null);
function newId() { const a = new Uint32Array(6); crypto.getRandomValues(a); return "PT-" + [...a].map(n => ALPHA[n % ALPHA.length]).join(""); }
function normId(v) { v = String(v || "").toUpperCase().replace(/\s/g, ""); if (!v.startsWith("PT-")) v = "PT-" + v.replace(/^PT/, ""); return v; }
function fmt(ts) { try { const d = ts?.toDate ? ts.toDate() : new Date(ts); return d.toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" }); } catch { return ""; } }

// Downscale an uploaded photo to a small JPEG data URL so it fits in a Firestore document (free plan, no Storage needed).
function shrink(file, max = 560, q = 0.72) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = rej;
    r.onload = () => {
      const im = new Image();
      im.onerror = rej;
      im.onload = () => {
        const s = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", q));
      };
      im.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

// ---------- routing: ?t=PT-XXXXXX (finder) · ?owner (owner panel) · nothing (home) ----------
function route() {
  clearSubs();
  hdrId.hidden = true;
  if (!configured) return show(card(el("h2", {}, "সাইট এখনো সেটআপ হয়নি"), el("p", { class: "muted" }, "firebase-config.js ফাইলে Firebase কনফিগ বসাতে হবে। SETUP.md দেখুন।")));
  const p = new URLSearchParams(location.search);
  const t = p.get("t");
  if (t) return finderView(normId(t));
  if (p.has("owner")) return ownerView();
  homeView();
}

function homeView() {
  const i = el("input", { type: "text", id: "lookup", placeholder: "PT-XXXXXX", "aria-label": "ট্যাগ আইডি", autocapitalize: "characters" });
  const f = el("form", { class: "row" }, i, el("button", { type: "submit" }, "খুঁজুন"));
  f.addEventListener("submit", e => { e.preventDefault(); location.search = "?t=" + encodeURIComponent(normId(i.value)); });
  show(
    card(el("h1", {}, "হারানো পোষা প্রাণী খুঁজে পেয়েছেন?"), el("p", {}, "ট্যাগের QR কোড স্ক্যান করুন, বা ট্যাগে লেখা আইডি দিন।"), f),
    card(el("h2", {}, "আপনি কি পোষা প্রাণীর মালিক?"), el("p", { class: "muted" }, "ট্যাগ চালু করতে, ছবি বদলাতে বা মেসেজ পড়তে মালিকের প্যানেলে যান।"),
      el("a", { href: "?owner", class: "brand", style: "font-size:1rem" }, "মালিকের প্যানেল →"))
  );
}

// ---------- finder side ----------
function finderView(id) {
  hdrId.textContent = id; hdrId.hidden = false;
  if (!ID_RE.test(id)) return show(card(el("h2", {}, "আইডিটি ঠিক নেই"), el("p", { class: "muted" }, "ট্যাগের আইডি দেখতে এমন: PT-7K3M9Q")));
  const t = setTimeout(() => show(card(el("p", { class: "err" }, "সংযোগ ধীর। ইন্টারনেট চেক করে পেজটি আবার খুলুন।"))), 10000);
  unsub.push(onSnapshot(doc(db, "pets", id), s => {
    clearTimeout(t);
    if (!s.exists()) return show(card(el("h2", {}, "এই ট্যাগটি এখনো চালু হয়নি"), el("p", { class: "muted" }, "আইডি " + id + " এর কোনো প্রোফাইল পাওয়া যায়নি।")));
    renderProfile(id, s.data());
  }, () => { clearTimeout(t); show(card(el("p", { class: "err" }, "প্রোফাইল লোড হয়নি।"))); }));
}

function renderProfile(id, p) {
  const photo = safeImg(p.petPhoto), oph = p.showOwner ? safeImg(p.ownerPhoto) : null;
  document.title = (p.name || "পোষা প্রাণী") + " · পেটট্যাগ";
  show(
    el("div", { class: "hero" }, photo ? el("img", { src: photo, alt: (p.name || "পোষা প্রাণী") + " এর ছবি" }) : el("div", { class: "ph" }, "ছবি নেই")),
    card(
      el("span", { class: "status" }, "আমি হয়তো হারিয়ে গেছি"),
      el("h1", {}, p.name || "নাম নেই"),
      p.species ? el("p", { class: "muted" }, p.species) : null,
      p.note ? el("div", { class: "note" }, p.note) : null,
      oph ? el("div", { class: "owner" }, el("img", { src: oph, alt: "মালিকের ছবি" }),
              el("div", {}, el("strong", {}, "আমার মালিক"), el("div", { class: "muted" }, "নিরাপত্তার জন্য মালিকের ফোন নম্বর লুকানো।")))
          : el("p", { class: "muted" }, "নিরাপত্তার জন্য মালিকের ফোন নম্বর লুকানো। নিচের ফর্মে মেসেজ দিন, মালিকের কাছে পৌঁছে যাবে।")
    ),
    messageForm(id, p)
  );
}

function messageForm(id, pet) {
  const out = el("p", { role: "status" });
  const locStatus = el("span", { class: "muted" });
  let mapUrl = "";
  const locBtn = el("button", { type: "button", class: "ghost small", onclick: () => {
    if (!navigator.geolocation) { locStatus.textContent = "এই ফোনে লোকেশন পাওয়া যাচ্ছে না।"; return; }
    locStatus.textContent = "লোকেশন খোঁজা হচ্ছে…";
    navigator.geolocation.getCurrentPosition(
      pos => { mapUrl = `https://maps.google.com/?q=${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`; locStatus.className = "ok"; locStatus.textContent = "লোকেশন যুক্ত হয়েছে ✓"; },
      () => { locStatus.className = "err"; locStatus.textContent = "লোকেশনের অনুমতি পাওয়া যায়নি। জায়গার নাম লিখে দিন।"; },
      { enableHighAccuracy: true, timeout: 15000 });
  } }, "📍 আমার লোকেশন শেয়ার করুন");
  const f = el("form", { class: "card" },
    el("h2", {}, "মালিককে মেসেজ দিন"),
    el("label", {}, "আপনার নাম", el("input", { type: "text", id: "fName", maxlength: "60", autocomplete: "name" })),
    el("label", {}, "আপনার ফোন (ঐচ্ছিক, মালিক যেন আপনাকে ফোন করতে পারেন)", el("input", { type: "tel", id: "fPhone", maxlength: "20", inputmode: "tel", autocomplete: "tel" })),
    el("label", {}, "কোথায় পেয়েছেন", el("input", { type: "text", id: "fLoc", maxlength: "300", placeholder: "এলাকা, রাস্তা, দোকানের নাম" })),
    el("div", { class: "row" }, locBtn, locStatus),
    el("label", {}, "মেসেজ", el("textarea", { id: "fMsg", maxlength: "1000", required: true, placeholder: "যেমন: আপনার বিড়ালটি আমার কাছে নিরাপদে আছে" })),
    el("button", { type: "submit", id: "fSend" }, "মেসেজ পাঠান"), out);
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const v = k => f.querySelector("#" + k).value.trim();
    if (!v("fMsg")) { out.className = "err"; out.textContent = "মেসেজ লিখুন।"; return; }
    const b = f.querySelector("#fSend"); b.disabled = true; out.className = "muted"; out.textContent = "পাঠানো হচ্ছে…";
    try {
      await addDoc(collection(db, "messages"), {
        tagId: id, ownerUid: pet.ownerUid, petName: pet.name || "",
        finderName: v("fName"), finderPhone: v("fPhone"), location: v("fLoc"), mapUrl,
        message: v("fMsg"), read: false, createdAt: serverTimestamp(),
      });
      f.replaceChildren(el("h2", {}, "ধন্যবাদ!"), el("p", { class: "ok" }, "মেসেজ মালিকের কাছে পৌঁছেছে। সম্ভব হলে প্রাণীটিকে নিরাপদ জায়গায় রাখুন।"));
    } catch {
      b.disabled = false; out.className = "err"; out.textContent = "মেসেজ পাঠানো যায়নি। ইন্টারনেট চেক করে আবার চেষ্টা করুন।";
    }
  });
  return f;
}

// ---------- owner side ----------
let currentUser = null;
function ownerView() {
  if (!currentUser) {
    const out = el("p", { role: "status" });
    return show(card(
      el("h2", {}, "মালিকের প্যানেল"),
      el("p", { class: "muted" }, "Google অ্যাকাউন্ট দিয়ে লগইন করুন। আপনার ফোন নম্বর আমরা নিই না।"),
      el("button", { class: "btn-google", onclick: async () => {
        const prov = new GoogleAuthProvider();
        try { await signInWithPopup(auth, prov); }
        catch (err) {
          if (err?.code === "auth/popup-blocked" || err?.code === "auth/operation-not-supported-in-this-environment") return signInWithRedirect(auth, prov);
          out.className = "err"; out.textContent = "লগইন হয়নি (" + (err?.code || "unknown") + ")।";
        }
      } }, "Google দিয়ে লগইন"), out));
  }
  const uid = currentUser.uid;
  const editBox = el("div");
  const inboxBox = card(el("h2", {}, "ইনবক্স"), el("p", { class: "muted" }, "লোড হচ্ছে…"));
  const petsBox = card(el("h2", {}, "আমার পোষা প্রাণী"), el("p", { class: "muted" }, "লোড হচ্ছে…"));
  show(
    el("div", { class: "row", style: "justify-content:space-between" },
      el("button", { onclick: () => openEditor(editBox, null, {}) }, "+ ট্যাগ চালু করুন"),
      el("button", { class: "ghost small", onclick: () => signOut(auth) }, "লগআউট")),
    editBox, inboxBox, petsBox);

  unsub.push(onSnapshot(query(collection(db, "pets"), where("ownerUid", "==", uid)), s => {
    const list = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    fill(petsBox, el("h2", {}, "আমার পোষা প্রাণী (" + list.length.toLocaleString("bn-BD") + ")"),
      list.length ? null : el("p", { class: "muted" }, "এখনো কোনো ট্যাগ চালু করা হয়নি। উপরের বাটন চাপুন।"),
      ...list.map(p => {
        const im = safeImg(p.petPhoto);
        return el("div", { class: "pet" }, im ? el("img", { src: im, alt: "" }) : el("div", { class: "noimg" }),
          el("div", { class: "meta" }, el("strong", {}, p.name || "নাম নেই"), el("span", { class: "tagid", style: "align-self:flex-start" }, p.id),
            el("div", { class: "row" },
              el("button", { class: "small", onclick: () => openEditor(editBox, p.id, p) }, "এডিট"),
              el("button", { class: "small ghost", onclick: () => showQr(editBox, p) }, "QR কোড"),
              el("a", { class: "small", href: "?t=" + p.id }, "পেজ দেখুন"))));
      }));
  }, () => fill(petsBox, el("p", { class: "err" }, "তালিকা লোড হয়নি।"))));

  unsub.push(onSnapshot(query(collection(db, "messages"), where("ownerUid", "==", uid)), s => {
    const msgs = s.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    const unread = msgs.filter(m => !m.read).length;
    document.title = (unread ? `(${unread}) ` : "") + "পেটট্যাগ · মালিক";
    fill(inboxBox, el("h2", {}, "ইনবক্স" + (unread ? " · " + unread.toLocaleString("bn-BD") + "টি নতুন" : "")),
      msgs.length ? null : el("p", { class: "muted" }, "কেউ ট্যাগ স্ক্যান করে মেসেজ দিলে এখানে দেখাবে।"),
      ...msgs.map(m => {
        const map = safeMap(m.mapUrl);
        return el("div", { class: "msg" + (m.read ? "" : " unread") },
          el("strong", {}, (m.petName || m.tagId) + " · " + (m.finderName || "নাম দেননি")),
          el("span", { class: "muted" }, fmt(m.createdAt)),
          el("span", {}, m.message || ""),
          m.location ? el("span", {}, "জায়গা: " + m.location) : null,
          map ? el("a", { href: map, target: "_blank", rel: "noopener" }, "📍 ম্যাপে লোকেশন দেখুন") : null,
          m.finderPhone ? el("span", {}, "ফোন: ", el("a", { href: "tel:" + m.finderPhone.replace(/[^0-9+]/g, "") }, m.finderPhone)) : null,
          el("div", { class: "row" },
            m.read ? null : el("button", { class: "small ghost", onclick: e => { e.target.disabled = true; updateDoc(doc(db, "messages", m.id), { read: true }).catch(() => { e.target.disabled = false; }); } }, "পড়েছি"),
            el("button", { class: "small ghost", onclick: e => { e.target.disabled = true; deleteDoc(doc(db, "messages", m.id)).catch(() => { e.target.disabled = false; }); } }, "মুছুন")));
      }));
  }, () => fill(inboxBox, el("p", { class: "err" }, "ইনবক্স লোড হয়নি।"))));
}

async function openEditor(box, id, p) {
  const isNew = !id;
  // The owner's own photo lives in a private doc (owners/{uid}); it is copied to the public pet page only when the toggle is on.
  let ownerPhoto = null;
  try { const o = await getDoc(doc(db, "owners", currentUser.uid)); ownerPhoto = o.exists() ? o.data().photo || null : null; } catch {}
  const st = { petPhoto: p.petPhoto || null, ownerPhoto };
  const out = el("p", { role: "status" });
  const pv = el("img", { class: "thumb", alt: "", src: safeImg(st.petPhoto) || false });
  const ov = el("img", { class: "thumb", alt: "", src: safeImg(st.ownerPhoto) || false });
  const fileIn = (key, img) => {
    const i = el("input", { type: "file", accept: "image/*", id: key + "File" });
    i.addEventListener("change", async () => {
      if (!i.files[0]) return;
      try { st[key] = await shrink(i.files[0]); img.src = st[key]; }
      catch { out.className = "err"; out.textContent = "ছবিটি খোলা যায়নি।"; }
    });
    return i;
  };
  const idIn = el("input", { type: "text", id: "pId", value: id || newId(), autocapitalize: "characters", readonly: !isNew });
  const f = el("form", { class: "card" },
    el("h2", {}, isNew ? "নতুন ট্যাগ চালু করুন" : "এডিট: " + (p.name || "")),
    el("label", {}, "ট্যাগ আইডি" + (isNew ? " (ট্যাগে আইডি ছাপা থাকলে সেটা লিখুন)" : ""), idIn),
    el("label", {}, "পোষা প্রাণীর ছবি (চেহারা পরিষ্কার দেখা যায় এমন)", el("div", { class: "row" }, pv, fileIn("petPhoto", pv))),
    el("label", {}, "নাম", el("input", { type: "text", id: "pName", maxlength: "40", required: true, value: p.name || "" })),
    el("label", {}, "ধরন (ঐচ্ছিক)", el("input", { type: "text", id: "pSpecies", maxlength: "60", placeholder: "যেমন: বিড়াল, সাদা-কমলা", value: p.species || "" })),
    el("label", {}, "যিনি খুঁজে পাবেন তার জন্য নোট (ঐচ্ছিক)", el("textarea", { id: "pNote", maxlength: "300", placeholder: "যেমন: ভীতু, কাছে গেলে আস্তে কথা বলুন" }, p.note || "")),
    el("label", {}, "আপনার ছবি (ঐচ্ছিক)", el("div", { class: "row" }, ov, fileIn("ownerPhoto", ov))),
    el("label", { class: "switch" }, el("input", { type: "checkbox", id: "pShow", checked: !!p.showOwner }), "পেজে আমার ছবি দেখাও"),
    el("p", { class: "muted" }, "ফোন নম্বর এখানে নেওয়া হয় না, তাই পেজে কখনো দেখাবে না।"),
    el("div", { class: "row" }, el("button", { type: "submit" }, "সেভ করুন"), el("button", { type: "button", class: "ghost", onclick: () => box.replaceChildren() }, "বাতিল")),
    out);
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const tag = normId(idIn.value);
    if (!ID_RE.test(tag)) { out.className = "err"; out.textContent = "আইডি ঠিক নেই। দেখতে এমন হবে: PT-7K3M9Q"; return; }
    const showOwner = f.querySelector("#pShow").checked;
    const data = {
      ownerUid: currentUser.uid,
      name: f.querySelector("#pName").value.trim(),
      species: f.querySelector("#pSpecies").value.trim(),
      note: f.querySelector("#pNote").value.trim(),
      showOwner,
      petPhoto: st.petPhoto || "",
      ownerPhoto: showOwner && st.ownerPhoto ? st.ownerPhoto : "",
      updatedAt: Date.now(),
    };
    out.className = "muted"; out.textContent = "সেভ হচ্ছে…";
    try {
      if (st.ownerPhoto !== ownerPhoto) await setDoc(doc(db, "owners", currentUser.uid), { photo: st.ownerPhoto || "" });
      await setDoc(doc(db, "pets", tag), data);
      box.replaceChildren(card(el("p", { class: "ok" }, data.name + " সেভ হয়েছে। ট্যাগ আইডি: " + tag)));
    } catch (err) {
      out.className = "err";
      out.textContent = err?.code === "permission-denied"
        ? "এই আইডির ট্যাগ অন্য কেউ আগেই চালু করেছে, অথবা কোনো ঘরে লেখা বেশি লম্বা।"
        : "সেভ হয়নি। ইন্টারনেট চেক করে আবার চেষ্টা করুন।";
    }
  });
  box.replaceChildren(f);
  box.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Draw the QR ourselves: whole-pixel modules (no blur), black on white, and a 4-module white quiet zone
// baked into the image, so phone camera apps (not only Google Lens) detect it, on screen or printed.
function qrImage(text, px = 12) {
  const tmp = document.createElement("div");
  const qr = new QRCode(tmp, { text, width: 64, height: 64, correctLevel: QRCode.CorrectLevel.M });
  const m = qr._oQRCode, n = m.getModuleCount(), quiet = 4, size = (n + quiet * 2) * px;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, size, size);
  g.fillStyle = "#000000";
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (m.isDark(r, col)) g.fillRect((col + quiet) * px, (r + quiet) * px, px, px);
  return c.toDataURL("image/png");
}

function showQr(box, p) {
  const link = SITE_URL + "?t=" + p.id;
  let img;
  try { img = el("img", { class: "qrimg", src: qrImage(link), alt: "QR কোড " + p.id }); }
  catch { img = el("p", { class: "err" }, "QR তৈরি হয়নি।"); }
  fill(box, card(
    el("h2", {}, (p.name || "") + " এর ট্যাগ QR"),
    el("div", { class: "qrbox" }, img, el("span", { class: "id" }, p.id)),
    el("p", { class: "muted", style: "overflow-wrap:anywhere" }, link),
    el("p", { class: "muted" }, "ছবিটি লম্বা চেপে বা রাইট-ক্লিক করে সেভ করুন, তারপর ট্যাগ প্রিন্টে দিন। ট্যাগে QR অন্তত ২ সেমি চওড়া রাখুন।"),
    el("button", { class: "ghost small", style: "align-self:flex-start", onclick: () => box.replaceChildren() }, "বন্ধ করুন")));
}

// ---------- start ----------
if (configured) {
  let first = true;
  onAuthStateChanged(auth, u => {
    currentUser = u;
    if (first || new URLSearchParams(location.search).has("owner")) { first = false; route(); }
  });
} else {
  route();
}
