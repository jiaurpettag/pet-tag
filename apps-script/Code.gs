/**
 * PetTag email alerts.
 *
 * The finder's browser POSTs {"id": "<messageId>"} here right after saving a message.
 * This script (running as the Firebase project owner) reads that message from Firestore,
 * looks up the pet owner's private email in owners/{uid}, sends one email, and marks the
 * message `notified` so it is never sent twice. Nothing else from the request is trusted.
 *
 * Offline SMS relay: the back of each tag has an SMSTO QR that texts "PT-XXXXXX FOUND" to the company SIM.
 * An Android phone with that SIM runs the "SMS to URL Forwarder" app, which POSTs each SMS here as
 * {"from","text","sentStamp"} to this URL + "?key=<SMS_KEY>". The script finds the tag, saves the SMS in the
 * owner's inbox, and emails the owner. The owner's phone number is never stored or shown anywhere.
 *
 * Gmail quota for a personal Google account: about 100 emails per day.
 */
const PROJECT_ID = 'pet-tag-78771';
const SITE_URL = 'https://jiaurpettag.github.io/pet-tag/';
const MAX_AGE_MS = 15 * 60 * 1000; // only alert for messages saved in the last 15 minutes
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/';

const SMS_TAG_RE = /PT[-\s]?([2-9A-HJKMNP-Z]{6})/;
const SMS_PER_HOUR = 5; // per sender number, so one phone cannot flood an owner

function doPost(e) {
  if (e && e.parameter && e.parameter.key !== undefined) return handleSms(e);
  let id = '';
  try { id = String(JSON.parse(e.postData.contents).id || ''); } catch (err) { return out('bad request'); }
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return out('bad id');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return out('busy');
  try {
    const msg = getDoc('messages/' + id);
    if (!msg) return out('not found');
    if (msg.notified === true) return out('already sent');
    const created = Date.parse(msg.createdAt || '');
    if (!created || Date.now() - created > MAX_AGE_MS) return out('too old');

    const owner = msg.ownerUid ? getDoc('owners/' + msg.ownerUid) : null;
    if (!owner || !owner.email || owner.notify === false) { markNotified(id); return out('no email'); }

    sendAlert(owner.email, msg);
    markNotified(id);
    return out('sent');
  } finally {
    lock.releaseLock();
  }
}

function handleSms(e) {
  const key = PropertiesService.getScriptProperties().getProperty('SMS_KEY');
  if (!key || String(e.parameter.key) !== key) return out('bad key');
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out('bad request'); }
  const from = String(d.from || '').replace(/[^0-9+]/g, '').slice(0, 20);
  const text = String(d.text || '').trim().slice(0, 1000);
  const m = text.toUpperCase().match(SMS_TAG_RE);
  if (!from || !m) return out('no tag');
  const tagId = 'PT-' + m[1];

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return out('busy');
  try {
    // The phone app retries until it gets a 2xx, so the same SMS can arrive twice: remember it for 6 hours.
    const cache = CacheService.getScriptCache();
    const dupKey = 'sms:' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, from + '|' + text + '|' + (d.sentStamp || '')));
    if (cache.get(dupKey)) return out('already sent');
    const rateKey = 'rate:' + from, count = Number(cache.get(rateKey) || 0);
    if (count >= SMS_PER_HOUR) return out('rate limited');
    cache.put(rateKey, String(count + 1), 3600);

    const pet = getDoc('pets/' + tagId);
    if (!pet || !pet.ownerUid) { cache.put(dupKey, '1', 21600); return out('unknown tag'); }
    const msg = {
      tagId: tagId, ownerUid: pet.ownerUid, petName: pet.name || '', finderName: 'SMS (নেট ছাড়া)', finderPhone: from,
      location: '', mapUrl: '', message: text, read: false, notified: true, via: 'sms', createdAt: new Date().toISOString(),
    };
    createDoc('messages', msg);
    cache.put(dupKey, '1', 21600);
    const owner = getDoc('owners/' + pet.ownerUid);
    if (!owner || !owner.email || owner.notify === false) return out('saved');
    sendAlert(owner.email, msg);
    return out('sent');
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return out('PetTag alerts are running.'); }

function sendAlert(to, m) {
  const pet = m.petName || m.tagId || 'আপনার পোষা প্রাণী';
  const rows = [
    ['পোষা প্রাণী', pet + ' (' + (m.tagId || '') + ')'],
    ['যিনি পেয়েছেন', m.finderName || 'নাম দেননি'],
    ['তার ফোন', m.finderPhone || 'দেননি'],
    ['যেভাবে এসেছে', m.via === 'sms' ? 'ট্যাগের পেছনের QR থেকে SMS (নেট ছাড়া)' : 'ওয়েব পেজের ফর্ম'],
    ['জায়গা', m.location || 'লেখেননি'],
    ['মেসেজ', m.message || ''],
  ];
  const map = /^https:\/\/maps\.google\.com\/\?q=-?[0-9.]+,-?[0-9.]+$/.test(m.mapUrl || '') ? m.mapUrl : '';
  const text = rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') +
    (map ? '\nম্যাপ: ' + map : '') + '\n\nইনবক্স খুলুন: ' + SITE_URL + '?owner';
  const html = '<div style="font-family:sans-serif;font-size:15px;line-height:1.6">' +
    '<h2 style="margin:0 0 12px">' + esc(pet) + ' কে কেউ খুঁজে পেয়েছেন</h2>' +
    rows.map(function (r) { return '<p style="margin:4px 0"><b>' + r[0] + ':</b> ' + esc(r[1]) + '</p>'; }).join('') +
    (map ? '<p><a href="' + map + '">📍 ম্যাপে লোকেশন দেখুন</a></p>' : '') +
    '<p><a href="' + SITE_URL + '?owner">মালিকের প্যানেলে ইনবক্স খুলুন</a></p></div>';
  MailApp.sendEmail({ to: to, subject: 'পেটট্যাগ: ' + pet + ' এর খবর এসেছে', body: text, htmlBody: html, name: 'PetTag' });
}

function getDoc(path) {
  const res = UrlFetchApp.fetch(BASE + path, { headers: headers(), muteHttpExceptions: true });
  if (res.getResponseCode() === 404) return null;
  if (res.getResponseCode() !== 200) throw new Error('Firestore ' + res.getResponseCode() + ': ' + res.getContentText());
  const d = JSON.parse(res.getContentText());
  const f = d.fields || {}, o = {};
  Object.keys(f).forEach(function (k) {
    const v = f[k];
    o[k] = 'stringValue' in v ? v.stringValue : 'booleanValue' in v ? v.booleanValue :
      'timestampValue' in v ? v.timestampValue : 'integerValue' in v ? Number(v.integerValue) : null;
  });
  return o;
}

function createDoc(collection, o) {
  const fields = {};
  Object.keys(o).forEach(function (k) {
    const v = o[k];
    fields[k] = typeof v === 'boolean' ? { booleanValue: v } : k === 'createdAt' ? { timestampValue: v } : { stringValue: String(v) };
  });
  const res = UrlFetchApp.fetch(BASE + collection, {
    method: 'post', contentType: 'application/json', headers: headers(), muteHttpExceptions: true, payload: JSON.stringify({ fields: fields }),
  });
  if (res.getResponseCode() !== 200) throw new Error('Firestore ' + res.getResponseCode() + ': ' + res.getContentText());
}

function markNotified(id) {
  UrlFetchApp.fetch(BASE + 'messages/' + id + '?updateMask.fieldPaths=notified', {
    method: 'patch', contentType: 'application/json', headers: headers(), muteHttpExceptions: true,
    payload: JSON.stringify({ fields: { notified: { booleanValue: true } } }),
  });
}

function headers() {
  // x-goog-user-project bills the Firestore call to the Firebase project, where the Firestore API is enabled.
  return { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': PROJECT_ID };
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}

function out(s) { return ContentService.createTextOutput(s); }

/** Run this once from the editor (Run ▶) to approve permissions and send yourself a test email. */
function testSetup() {
  const me = Session.getActiveUser().getEmail();
  getDoc('pets/PT-2222AA'); // proves Firestore access works (404 is fine)
  sendAlert(me, { petName: 'টেস্ট', tagId: 'PT-TEST00', finderName: 'টেস্ট', finderPhone: '', location: 'টেস্ট', message: 'এটা একটা টেস্ট ইমেইল। সব ঠিক আছে।', mapUrl: '' });
  Logger.log('Test email sent to ' + me);
}

/**
 * Run once from the editor (choose setupSms, then Run ▶). It makes a secret key for the SMS phone and logs the
 * full link to paste into the "SMS to URL Forwarder" app. Running it again shows the same link.
 */
function setupSms() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('SMS_KEY');
  if (!key) { key = Utilities.getUuid().replace(/-/g, ''); props.setProperty('SMS_KEY', key); }
  Logger.log('SMS phone link (paste into the app): ' + ScriptApp.getService().getUrl() + '?key=' + key);
}
