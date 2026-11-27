/**
 * PetTag email alerts.
 *
 * The finder's browser POSTs {"id": "<messageId>"} here right after saving a message.
 * This script (running as the Firebase project owner) reads that message from Firestore,
 * looks up the pet owner's private email in owners/{uid}, sends one email, and marks the
 * message `notified` so it is never sent twice. Nothing else from the request is trusted.
 *
 * Gmail quota for a personal Google account: about 100 emails per day.
 */
const PROJECT_ID = 'pet-tag-78771';
const SITE_URL = 'https://jiaurpettag.github.io/pet-tag/';
const MAX_AGE_MS = 15 * 60 * 1000; // only alert for messages saved in the last 15 minutes
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/';

function doPost(e) {
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

function doGet() { return out('PetTag alerts are running.'); }

function sendAlert(to, m) {
  const pet = m.petName || m.tagId || 'আপনার পোষা প্রাণী';
  const rows = [
    ['পোষা প্রাণী', pet + ' (' + (m.tagId || '') + ')'],
    ['যিনি পেয়েছেন', m.finderName || 'নাম দেননি'],
    ['তার ফোন', m.finderPhone || 'দেননি'],
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
