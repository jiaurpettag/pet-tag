# পেটট্যাগ সেটআপ গাইড (একবারই করতে হবে)

মোট সময় ১৫-২০ মিনিট। খরচ: ০ টাকা। Firebase এর ফ্রি Spark প্ল্যানে প্রতিদিন ৫০,০০০ বার পড়া আর ২০,০০০ বার লেখা ফ্রি।

## ধাপ ১: Firebase প্রজেক্ট খোলা
1. https://console.firebase.google.com এ যান, Google অ্যাকাউন্ট দিয়ে লগইন করুন।
2. **Create a project** (বা **Add project**) চাপুন।
3. নাম দিন `pet-tag`। **Continue** চাপুন।
4. Google Analytics এর পাতায় সুইচ **বন্ধ** করে দিন (দরকার নেই)। **Create project** চাপুন।
5. "Your new project is ready" এলে **Continue** চাপুন।

## ধাপ ২: ওয়েব অ্যাপ যোগ করে কনফিগ নেওয়া
1. প্রজেক্টের হোম পেজে **`</>`** (Web) আইকনে চাপুন।
2. App nickname: `pet-tag-web`। "Firebase Hosting" এর বক্সে টিক **দেবেন না**। **Register app** চাপুন।
3. একটা কোড দেখাবে, যার মধ্যে `const firebaseConfig = { apiKey: "...", ... }` আছে।
4. `{` থেকে `}` পর্যন্ত পুরো অংশটা কপি করে Claude কে পাঠিয়ে দিন। (এগুলো গোপন নয়, ওয়েবসাইটে সবাই দেখতে পায়। নিরাপত্তা আসে নিচের Rules থেকে।)

## ধাপ ৩: Google লগইন চালু করা
1. বাম মেনুতে **Build → Authentication** এ যান। **Get started** চাপুন।
2. **Sign-in method** ট্যাবে **Google** চাপুন। **Enable** সুইচ অন করুন।
3. Support email এ আপনার ইমেইল বেছে নিন। **Save** চাপুন।
4. একই পেজে **Settings** ট্যাব → **Authorized domains** → **Add domain** চাপুন। লিখুন `jiaurpettag.github.io`। **Add** চাপুন।

## ধাপ ৪: ডাটাবেস (Firestore) চালু করা
1. বাম মেনুতে **Build → Firestore Database** এ যান। **Create database** চাপুন।
2. Location: **asia-southeast1 (Singapore)** বেছে নিন (বাংলাদেশ থেকে ভালো কানেকশন)। **Next** চাপুন।
3. **Start in production mode** বেছে নিন। **Create** চাপুন।
4. উপরের **Rules** ট্যাবে যান। সেখানে যা লেখা আছে সব মুছে ফেলুন।
5. এই রিপোর [`firestore.rules`](firestore.rules) ফাইলের পুরো লেখা কপি করে সেখানে পেস্ট করুন। **Publish** চাপুন।

## ধাপ ৫: ওয়েবসাইট চালু করা (GitHub Pages)
1. GitHub এ রিপোর **Settings** → বাম মেনুতে **Pages** এ যান।
2. **Source**: "Deploy from a branch"। **Branch**: `main`, ফোল্ডার `/ (root)`। **Save** চাপুন।
3. ১-২ মিনিট পর সাইট চালু হবে: https://jiaurpettag.github.io/pet-tag/

## ধাপ ৬: নিজে টেস্ট করা
1. ফোনে খুলুন: https://jiaurpettag.github.io/pet-tag/?owner
2. Google দিয়ে লগইন করুন, **+ ট্যাগ চালু করুন** চেপে একটা পোষা প্রাণী যোগ করুন।
3. **QR কোড** চাপুন, অন্য ফোন দিয়ে স্ক্যান করুন (লগইন ছাড়া)। প্রোফাইল দেখা যাবে, মেসেজ পাঠান।
4. মালিকের প্যানেলের ইনবক্সে মেসেজ চলে আসবে।

## লিংকগুলো
- খুঁজে পাওয়া ব্যক্তির পেজ: `https://jiaurpettag.github.io/pet-tag/?t=PT-XXXXXX` (QR এ এটাই থাকে)
- মালিকের প্যানেল: `https://jiaurpettag.github.io/pet-tag/?owner`

## ধাপ ৭: মালিককে ইমেইল নোটিফিকেশন (Google Apps Script, ফ্রি)
কেউ মেসেজ পাঠালে মালিকের Gmail এ ইমেইল যাবে। মালিকের ইমেইল কোনো পাবলিক পেজে থাকে না। Gmail প্রতিদিন প্রায় ১০০টা ইমেইল ফ্রি পাঠাতে দেয়।
**যে Google অ্যাকাউন্ট দিয়ে Firebase প্রজেক্ট খুলেছেন, সেই অ্যাকাউন্ট দিয়েই নিচের কাজগুলো করুন।**

1. https://script.google.com এ যান। **New project** চাপুন।
2. উপরে বাম দিকে "Untitled project" লেখায় চাপুন, নাম দিন `PetTag Alerts`।
3. বাম পাশে ⚙️ **Project Settings** চাপুন। **Show "appsscript.json" manifest file in editor** এর বক্সে টিক দিন।
4. বাম পাশে **< > Editor** চাপুন। `appsscript.json` ফাইলে চাপুন, ভেতরের সব লেখা মুছে [apps-script/appsscript.json](apps-script/appsscript.json) এর লেখা পেস্ট করুন।
5. `Code.gs` ফাইলে চাপুন, ভেতরের সব লেখা মুছে [apps-script/Code.gs](apps-script/Code.gs) এর লেখা পেস্ট করুন। উপরে 💾 **Save** চাপুন।
6. উপরের ফাংশনের ড্রপডাউন থেকে `testSetup` বেছে **▶ Run** চাপুন। **Review permissions** → আপনার অ্যাকাউন্ট → **Advanced** → **Go to PetTag Alerts (unsafe)** → **Allow** চাপুন। (এটা আপনার নিজের স্ক্রিপ্ট, তাই নিরাপদ।) আপনার Gmail এ একটা টেস্ট ইমেইল আসবে।
7. উপরে ডানে **Deploy** → **New deployment** চাপুন। ⚙️ আইকন থেকে **Web app** বেছে নিন। **Execute as: Me**, **Who has access: Anyone** রাখুন। **Deploy** চাপুন।
8. যে **Web app URL** দেখাবে (`https://script.google.com/macros/s/.../exec`) সেটা কপি করে Claude কে পাঠান। Claude সেটা `firebase-config.js` এ বসিয়ে দেবে।

## ধাপ ৮: নেট ছাড়া SMS QR এর জন্য রিলে ফোন (ট্যাগের পেছনের QR)
ট্যাগের পেছনের QR স্ক্যান করলে খুঁজে পাওয়া ব্যক্তির ফোনে SMS অ্যাপ খুলে যায়, কোম্পানির নম্বর আর `PT-XXXXXX FOUND` লেখা আগে থেকেই বসানো থাকে। তিনি শুধু **Send** চাপবেন। এতে তার ইন্টারনেট লাগে না, শুধু সাধারণ একটা SMS এর খরচ।
SMS টা যায় আপনার কোম্পানির সিমে। সেই সিম যে Android ফোনে আছে, সেটা SMS টা এই সিস্টেমে পাঠায়, সিস্টেম ট্যাগ আইডি দেখে মালিককে ইমেইল করে আর মালিকের ইনবক্সে রাখে।
- খুঁজে পাওয়া ব্যক্তি দেখবেন শুধু **কোম্পানির নম্বর**। মালিকের নম্বর কোথাও নেই।
- মালিক পাবেন খুঁজে পাওয়া ব্যক্তির নম্বর (যিনি SMS পাঠিয়েছেন), যেন ফোন করতে পারেন।
- রিলে ফোনে **ইন্টারনেট (Wi-Fi বা ডাটা) লাগবে**, খুঁজে পাওয়া ব্যক্তির লাগবে না।

**ক) রিলে ফোন রেডি করা**
1. কোম্পানির সিম ফোনে লাগান। Wi-Fi বা মোবাইল ডাটা চালু রাখুন। চার্জারে লাগিয়ে রাখুন।
2. ফোনের Chrome এ খুলুন: https://github.com/bogkonstantin/android_income_sms_gateway_webhook/releases
3. সবচেয়ে উপরের রিলিজের নিচে **Assets** এ `.apk` দিয়ে শেষ হওয়া ফাইলে চাপুন, ডাউনলোড হবে।
4. ডাউনলোড হওয়া ফাইলে চাপুন। "Install unknown apps" জিজ্ঞেস করলে **Settings** → **Allow from this source** চালু করে পেছনে আসুন, **Install** চাপুন।
5. Play Protect সতর্ক করলে **More details** → **Install anyway** চাপুন। (অ্যাপটি ফ্রি, ওপেন সোর্স। Google Play তে SMS ফরোয়ার্ড অ্যাপ রাখতে দেয় না, তাই এই সতর্কতা আসে।)

**খ) Apps Script আপডেট করা** (যে অ্যাকাউন্ট দিয়ে "PetTag Alerts" বানিয়েছিলেন)
1. https://script.google.com → **PetTag Alerts** খুলুন।
2. `Code.gs` এর সব লেখা মুছে [apps-script/Code.gs](apps-script/Code.gs) এর নতুন লেখা পেস্ট করুন। 💾 **Save** চাপুন।
3. উপরের ফাংশনের ড্রপডাউন থেকে `setupSms` বেছে **▶ Run** চাপুন। নিচে **Execution log** এ একটা লিংক আসবে: `https://script.google.com/macros/s/.../exec?key=...`। লিংকটা `/dev?key=` দিয়ে শেষ হলে ওটা ভুল লিংক: **Deploy → Manage deployments** থেকে Web app URL (`/exec`) কপি করে শেষে `?key=...` জুড়ে দিন। এটা গোপন রাখুন, শুধু রিলে ফোনের অ্যাপে বসাবেন। কখনো কাউকে দেখিয়ে ফেললে (যেমন স্ক্রিনশটে) `newSmsKey` বেছে ▶ Run চাপুন, নতুন লিংক ফোনে বসান।
4. উপরে ডানে **Deploy** → **Manage deployments** → ✏️ (Edit) → **Version** এ **New version** → **Deploy** চাপুন। (লিংক একই থাকে।)

**গ) অ্যাপে লিংক বসানো**
1. রিলে ফোনে **SMS to URL Forwarder** অ্যাপ খুলুন। SMS এর অনুমতি চাইলে **Allow** দিন।
2. **+** (Add) চাপুন।
3. **Sender**: `*` লিখুন (সব নম্বর থেকে)।
4. **URL**: ধাপ খ-৩ এর পুরো লিংক পেস্ট করুন।
5. **Text filter** এ লিখুন `(?i)PT` (শুধু ট্যাগের SMS যাবে, ব্যাংক/OTP এর SMS যাবে না)।
6. JSON template যেমন আছে তেমন রাখুন। **Save** চাপুন। স্ট্যাটাস বারে **F** আইকন দেখা যাবে।
7. ফোনের **Settings** → **Apps** → **SMS to URL Forwarder** → **Battery** → **Unrestricted** করুন। Xiaomi/Redmi হলে **Autostart** চালু করুন।
8. Google Messages ব্যবহার করলে: Messages → **Settings** → **RCS chats** বন্ধ করুন (না হলে কিছু মেসেজ SMS হিসেবে আসে না)।

**ঘ) টেস্ট**
1. ব্যক্তিগত ফোন দিয়ে ট্যাগের পেছনের QR (বা `tag.html` পেজের পেছনের QR) স্ক্যান করুন, **Send** চাপুন।
2. ১ মিনিটের মধ্যে মালিকের ইমেইল আর `?owner` ইনবক্সে মেসেজ আসবে, সাথে আপনার নম্বর।

সীমা: Gmail দিনে প্রায় ১০০টা ইমেইল ফ্রি। একই নম্বর থেকে ঘণ্টায় ৫টার বেশি SMS এলে বাকিগুলো বাদ যায় (স্প্যাম ঠেকাতে)।

## ধাপ ৯: গোল ট্যাগ প্রিন্ট (২.৫ সেমি)
1. কোম্পানির নম্বর `firebase-config.js` এর `SMS_NUMBER` এ বসান (যেমন `"+8801712345678"`)। Claude কে নম্বর পাঠালে Claude বসিয়ে দেবে।
2. একটা ট্যাগ: মালিকের প্যানেলে **QR কোড** → **🖨️ গোল ট্যাগের প্রিন্ট ডিজাইন**। অথবা সরাসরি `https://jiaurpettag.github.io/pet-tag/tag.html?t=PT-XXXXXX`
3. দোকানে একসাথে অনেক খালি ট্যাগ: `https://jiaurpettag.github.io/pet-tag/tag.html?n=24` (২৪টা নতুন আইডি, A4 শিটে)। মালিক পরে প্যানেলে **+ ট্যাগ চালু করুন** চেপে ট্যাগের আইডি লিখে চালু করবেন।
4. **প্রিন্ট / PDF সেভ** চাপুন → Destination **Save as PDF** → **More settings** → Scale **Default/100%** → **Save**। PDF টা প্রিন্টের দোকানে দিন।
5. দোকানকে বলুন: ব্যাস ২৫ মিমি, কালো-সাদা, ১০০% মাপে, QR এর ঘর ০.৩৬ মিমি তাই লেজার/UV প্রিন্ট ভালো। ধূসর ডট লাইনটা কাটার দাগ, ওটা ছাপা হবে না।
