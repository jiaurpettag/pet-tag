// Printable round tag designer: tag.html?t=PT-XXXXXX (one tag) or tag.html?n=24 (a sheet of new, unclaimed tags).
// Front: a web QR that opens the pet profile. Back: an offline SMSTO QR that sends "PT-XXXXXX FOUND"
// to the company relay number (see apps-script/Code.gs, doPost SMS branch). Every size is in millimetres,
// so printing at 100% (or "Save as PDF") gives the real tag size for the print shop.
import * as cfg from "./firebase-config.js";

const SITE_URL = cfg.SITE_URL;
const BRAND = cfg.BRAND || "ZiaurIT";
const ID_RE = /^PT-[2-9A-HJKMNP-Z]{6}$/;
const ALPHA = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const TEXT = {
  frontTop: "ট্যাপ/স্ক্যান করে সাহায্য করুন",
  frontBottom: "Powered by " + BRAND,
  backTop: "ইন্টারনেট লাগবে না",
  backBottom: "শুধু মালিককে SMS যাবে",
};
// Layout on a 25-unit circle (1 unit = 1 mm at 25 mm). QR side 12 units leaves a 3 mm ring for the text.
const D = 25, C = D / 2, QR_SIDE = 12, R_TOP = 9.95, R_BOT = 11.2, FS_BN = 2.0, FS_EN = 1.7, MIN_MODULE_MM = 0.3;

const q = new URLSearchParams(location.search);
// ?sms= is only for previews before the company number is set in firebase-config.js.
// Bangladesh numbers are written with the +880 country code so the SMS also goes out from a foreign SIM.
function intl(v) { const d = String(v || "").replace(/[^0-9]/g, ""); return !d ? "" : d.startsWith("880") ? "+" + d : d.startsWith("01") ? "+88" + d : "+" + d; }
const smsNumber = intl(q.get("sms") || cfg.SMS_NUMBER);
const smsSample = !!q.get("sms") && !cfg.SMS_NUMBER;
let size = Number(q.get("size")) || 25;
let showCut = q.get("cut") !== "0";

function newId() { const a = new Uint32Array(6); crypto.getRandomValues(a); return "PT-" + [...a].map(n => ALPHA[n % ALPHA.length]).join(""); }
function normId(v) { v = String(v || "").toUpperCase().replace(/\s/g, ""); if (!v.startsWith("PT-")) v = "PT-" + v.replace(/^PT/, ""); return v; }
const frontData = id => SITE_URL + "?t=" + id;
const backData = id => "SMSTO:" + smsNumber + ":" + id + " FOUND";

let ids = [];
const t = q.get("t"), n = Math.min(60, Math.max(0, Math.floor(Number(q.get("n")) || 0)));
if (t && ID_RE.test(normId(t))) ids = [normId(t)];
else if (n) ids = Array.from({ length: n }, newId);

// QR as one vector path of whole modules (ECC level M: about 15% of the code can be scratched and still scan).
function qrMatrix(text) {
  const tmp = document.createElement("div");
  const m = new QRCode(tmp, { text, width: 64, height: 64, correctLevel: QRCode.CorrectLevel.M })._oQRCode;
  const n = m.getModuleCount(), rows = [];
  for (let r = 0; r < n; r++) { const row = []; for (let c = 0; c < n; c++) row.push(m.isDark(r, c)); rows.push(row); }
  return rows;
}
function qrPath(rows, x0, y0, side) {
  const n = rows.length, s = side / n; let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (rows[r][c]) d += `M${(x0 + c * s).toFixed(4)} ${(y0 + r * s).toFixed(4)}h${s.toFixed(4)}v${s.toFixed(4)}h-${s.toFixed(4)}z`;
  return d;
}

const NS = "http://www.w3.org/2000/svg";
const sv = (tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };
const FONT = { "font-family": "Hind Siliguri, sans-serif", "font-weight": 600 };

// Width of a string in the tag font, measured in a hidden SVG (units = mm on the 25 mm design).
let probe;
function textWidth(s, fs) {
  if (!probe) { probe = sv("svg", { viewBox: "0 0 25 25", width: "250", height: "250" }); probe.style.cssText = "position:absolute;left:-9999px;top:0"; document.body.append(probe); }
  const e = sv("text", { ...FONT, "font-size": fs }, s); probe.append(e); const w = e.getComputedTextLength(); e.remove(); return w;
}

// Bangla "letters" as the reader sees them (e.g. "স্ক্যা" stays one piece). Browsers break Bangla vowel signs and
// ya-phala when text follows an SVG textPath, so each piece is shaped on its own and rotated onto the circle.
function clusters(s) {
  let parts = typeof Intl.Segmenter === "function" ? [...new Intl.Segmenter("bn", { granularity: "grapheme" }).segment(s)].map(x => x.segment) : Array.from(s);
  const out = [];
  for (const p of parts) {
    const prev = out[out.length - 1];
    // Older segmenters split conjuncts after the hasanta (U+09CD) or before a joiner; glue them back.
    if (prev && (/[\u09CD\u200D\u200C]$/.test(prev) || /^[\u0981-\u0983\u09BC-\u09D7\u200D]/.test(p))) out[out.length - 1] = prev + p;
    else out.push(p);
  }
  return out;
}

// Lay text on a circle of radius r around the centre. top: reads left to right over the top, letters pointing out.
// bottom: reads left to right under the QR, letters upright (pointing in).
function arcText(s, fs, r, top) {
  const g = sv("g", { ...FONT, "font-size": fs, fill: "#000", "aria-label": s });
  const parts = clusters(s), ws = parts.map(p => textWidth(p.trim() ? p : "\u00A0", fs)) /* a plain space measures 0 in SVG */, total = ws.reduce((a, b) => a + b, 0);
  let at = -total / 2;
  parts.forEach((p, i) => {
    const a = (at + ws[i] / 2) / r; at += ws[i];
    if (!p.trim()) return;
    const x = C + r * Math.sin(a), y = top ? C - r * Math.cos(a) : C + r * Math.cos(a);
    const deg = (top ? a : -a) * 180 / Math.PI;
    g.append(sv("text", { x: x.toFixed(4), y: y.toFixed(4), "text-anchor": "middle", transform: `rotate(${deg.toFixed(3)} ${x.toFixed(4)} ${y.toFixed(4)})` }, p));
  });
  return g;
}

// One side of the tag. Top text sits on an arc read left to right over the top; bottom text runs under the QR, upright.
function side(data, top, bottom, topFs, botFs) {
  const svg = sv("svg", { viewBox: `0 0 ${D} ${D}`, width: size + "mm", height: size + "mm", role: "img" });
  svg.append(sv("circle", { cx: C, cy: C, r: C, fill: "#fff" }));
  svg.append(sv("circle", { class: "cut", cx: C, cy: C, r: C - 0.05, fill: "none", stroke: "#bbb", "stroke-width": 0.1, "stroke-dasharray": "0.6 0.4" }));
  svg.append(arcText(top, topFs, R_TOP, true), arcText(bottom, botFs, R_BOT, false));
  if (data) {
    const rows = qrMatrix(data);
    svg.append(sv("path", { d: qrPath(rows, C - QR_SIDE / 2, C - QR_SIDE / 2, QR_SIDE), fill: "#000", "shape-rendering": "crispEdges" }));
  } else {
    svg.append(sv("text", { x: C, y: C, "text-anchor": "middle", "dominant-baseline": "middle", "font-family": "Hind Siliguri, sans-serif", "font-size": 1.6, fill: "#b3412e" }, "SMS নম্বর বসানো হয়নি"));
  }
  return svg;
}

// Shrink a ring text only if it is longer than its arc allows (so long brand names still fit).
const MAX_TOP = 25, MAX_BOT = 21;
async function fitSizes() {
  try { await document.fonts.load(`600 18px "Hind Siliguri"`, TEXT.frontTop + TEXT.backTop + TEXT.backBottom); } catch {}
  const w = textWidth;
  const fit = (s, fs, max) => { const l = w(s, fs); return l > max ? fs * max / l : fs; };
  const out = {
    ft: fit(TEXT.frontTop, FS_BN, MAX_TOP), fb: fit(TEXT.frontBottom, FS_EN, MAX_BOT),
    bt: fit(TEXT.backTop, FS_BN, MAX_TOP), bb: fit(TEXT.backBottom, FS_BN, MAX_BOT),
  };
  return out;
}

const app = document.getElementById("app");
const sheet = document.getElementById("sheet");
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? "" : v); }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const bn = x => Number(x).toLocaleString("bn-BD", { maximumFractionDigits: 2 });

function pickView() {
  const i = el("input", { type: "text", placeholder: "PT-XXXXXX", autocapitalize: "characters" });
  const nIn = el("input", { type: "number", min: "1", max: "60", value: "24" });
  app.replaceChildren(el("div", { class: "card" },
    el("h1", {}, "ট্যাগ প্রিন্ট"),
    el("label", {}, "একটা ট্যাগের আইডি", el("div", { class: "row" }, i, el("button", { onclick: () => { location.search = "?t=" + encodeURIComponent(normId(i.value)); } }, "দেখুন"))),
    el("label", {}, "অথবা নতুন খালি ট্যাগ (দোকানে একসাথে ছাপানোর জন্য), কয়টা?", el("div", { class: "row" }, nIn, el("button", { onclick: () => { location.search = "?n=" + nIn.value; } }, "শিট বানান")))));
}

async function render() {
  if (!ids.length) return pickView();
  const fs = await fitSizes();
  const fMods = qrMatrix(frontData(ids[0])).length;
  const bMods = smsNumber ? qrMatrix(backData(ids[0])).length : 0;
  const mm = mods => QR_SIDE * size / D / mods;
  const stat = (label, mods) => {
    const v = mm(mods), ok = v >= MIN_MODULE_MM;
    return el("div", {}, label + ": " + mods + "×" + mods + " ঘর, প্রতিটি ঘর ", el("span", { class: ok ? "good" : "bad" }, bn(v.toFixed(2)) + " মিমি " + (ok ? "✓" : "✗ (০.৩ মিমির কম, ছোট ক্যামেরায় স্ক্যান নাও হতে পারে)")));
  };
  const sizeSel = el("select", { onchange: e => { size = Number(e.target.value); render(); } },
    ...[20, 22, 25, 28, 30].map(s => el("option", { value: s, selected: s === size }, bn(s / 10) + " সেমি" + (s === 25 ? " (সাজেস্টেড)" : ""))));
  const cut = el("input", { type: "checkbox", checked: showCut, onchange: e => { showCut = e.target.checked; sheet.classList.toggle("nocut", !showCut); } });
  const big = el("div", { class: "big" },
    el("figure", {}, side(frontData(ids[0]), TEXT.frontTop, TEXT.frontBottom, fs.ft, fs.fb), el("figcaption", { class: "muted" }, "সামনে: ওয়েব পেজ")),
    el("figure", {}, side(smsNumber ? backData(ids[0]) : "", TEXT.backTop, TEXT.backBottom, fs.bt, fs.bb), el("figcaption", { class: "muted" }, "পেছনে: নেট ছাড়া SMS")));
  app.replaceChildren(el("div", { class: "card" },
    el("h1", {}, ids.length === 1 ? "ট্যাগ " + ids[0] : bn(ids.length) + "টি নতুন ট্যাগ"),
    big,
    smsSample ? el("p", { class: "err" }, "পেছনের QR এ নমুনা নম্বর " + smsNumber + " আছে। আসল কোম্পানি নম্বর বসানোর আগে ছাপাবেন না।") : null,
    !smsNumber ? el("p", { class: "err" }, "পেছনের SMS QR এর জন্য কোম্পানির নম্বর এখনো বসানো হয়নি (firebase-config.js → SMS_NUMBER)।") : null,
    el("div", { class: "opts" },
      el("label", {}, "ট্যাগের মাপ (ব্যাস)", sizeSel),
      el("label", { class: "switch" }, cut, "কাটার দাগ (ধূসর ডট লাইন) দেখাও")),
    el("div", { class: "stats" },
      el("div", {}, "QR এর মাপ: " + bn((QR_SIDE * size / D).toFixed(1)) + " × " + bn((QR_SIDE * size / D).toFixed(1)) + " মিমি"),
      stat("সামনের QR", fMods), smsNumber ? stat("পেছনের QR", bMods) : null,
      el("div", { class: "muted" }, "সামনের QR এ থাকে: " + frontData(ids[0])),
      smsNumber ? el("div", { class: "muted" }, "পেছনের QR এ থাকে: " + backData(ids[0])) : null),
    el("p", { class: "muted" }, "প্রিন্ট বা PDF করার সময় Scale/মাপ ১০০% রাখুন (Fit to page বন্ধ)। ছাপার পর রুলার দিয়ে ব্যাস মেপে দেখুন।"),
    el("div", { class: "row" },
      el("button", { onclick: () => print() }, "প্রিন্ট / PDF সেভ"),
      el("a", { href: "tag.html", class: "small" }, "অন্য ট্যাগ"))));

  sheet.classList.toggle("nocut", !showCut);
  sheet.replaceChildren(...ids.map(id => el("div", { class: "pair" },
    el("div", { class: "sides" },
      side(frontData(id), TEXT.frontTop, TEXT.frontBottom, fs.ft, fs.fb),
      side(smsNumber ? backData(id) : "", TEXT.backTop, TEXT.backBottom, fs.bt, fs.bb)),
    el("span", { class: "lbl" }, id + "  সামনে | পেছনে"))));
  document.body.dataset.ready = "1";
}

if (typeof QRCode === "undefined") app.textContent = "QR লাইব্রেরি লোড হয়নি। ইন্টারনেট চেক করে পেজটি আবার খুলুন।";
else render();
