Rules tests (19 cases) and email-alert script tests (14 cases).

    npm i firebase-tools@13.29.1 @firebase/rules-unit-testing@3.0.4 firebase@10.12.2
    npx firebase emulators:exec --only firestore --project demo-pettag "node rules.test.mjs"
    npx firebase emulators:exec --only firestore --project pet-tag-78771 "node alerts.test.mjs"
