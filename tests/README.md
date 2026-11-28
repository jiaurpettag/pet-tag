Rules tests (19 cases), email-alert script tests (14 cases) and offline SMS relay tests (17 cases, `sms.test.mjs`).

    npm i firebase-tools@13.29.1 @firebase/rules-unit-testing@3.0.4 firebase@10.12.2
    npx firebase emulators:exec --only firestore --project demo-pettag "node rules.test.mjs"
    npx firebase emulators:exec --only firestore --project pet-tag-78771 "node alerts.test.mjs && node sms.test.mjs"
