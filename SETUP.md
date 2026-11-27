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
