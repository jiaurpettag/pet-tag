Rules tests (19 cases). Run from this folder:

    npm i firebase-tools@13.29.1 @firebase/rules-unit-testing@3.0.4 firebase@10.12.2
    npx firebase emulators:exec --only firestore --project demo-pettag "node rules.test.mjs"
