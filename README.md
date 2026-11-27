# pet-tag

QR pet ID tags. Scanning a tag opens the pet's profile; the finder messages the owner without ever seeing the owner's phone number.

- Static site on GitHub Pages (`index.html`, `app.js`, `style.css`), data in Firebase Firestore, owner login with Google (Firebase Auth). Free tiers only; photos are downscaled JPEGs stored in Firestore, so Firebase Storage (paid plan) is not needed.
- Routes: `?t=PT-XXXXXX` public profile + message form (no login) · `?owner` owner panel (add/edit pets, QR codes, inbox).
- Tag ID: `PT-` + 6 chars from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (31^6 ≈ 887M IDs). Pre-printed tags are claimed by the first owner who saves them. Reserved for a later offline SMSTO QR ("PT-XXXXXX found").
- Security: `firestore.rules`. Owner email alerts: `apps-script/` (Google Apps Script web app; the browser sends only the message ID, the script reads the owner's private email from `owners/{uid}` and emails once). Setup steps (Bangla): [SETUP.md](SETUP.md).

Local testing against the Firebase emulators: serve the folder on `localhost` and open `/?emu` once.
