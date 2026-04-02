# STRATIX v5.0 — Integration Guide

## What's New in v5.0

### 1. Firebase Auth + Google Sign-In
- `firebase_config.js` — fill in your project credentials
- `auth.js` v5.0 — Firebase Email/Password + Google Sign-In + localStorage fallback
- Firestore cloud sync (optional, background, non-blocking)
- Offline-first: app works 100% without Firebase configured

### 2. Deep Interconnects (`interconnect.js`)
All modules now talk to each other automatically:
- Dashboard auto-refreshes on any data change (no manual reload)
- Trip saved → transactions created automatically
- Invoice printed → saved to Invoice Aging + CRM outstanding updated
- Payment marked → CRM cleared + revenue transaction created
- New employee → salary reminder auto-created
- Firebase sync badge (⏫ Syncing / ☁️ Saved / 📶 Offline)
- Cross-tab sync via localStorage events

### 3. Mobile-First CSS
- iOS zoom prevention (all inputs ≥ 16px on mobile)
- 44px minimum touch targets (Apple HIG)
- Bottom sheet modals on mobile
- Safe area insets for notched phones
- Sticky table headers, horizontal scroll with touch
- Login page full-screen on mobile, left panel hidden

---

## Firebase Setup (5 minutes)

1. Go to https://console.firebase.google.com
2. **Create Project** → name it `stratix-yourname`
3. **Authentication** → Sign-in Methods → Enable:
   - Email/Password ✓
   - Google ✓ (add your support email as project support email)
4. **Firestore Database** → Create → Start in production mode → Pick your region
5. **Project Settings** → General → Your Apps → Add Web App → Copy config
6. Open `firebase_config.js` → paste your config → set `ENABLED: true`

### Firestore Security Rules
Paste this in Firebase Console → Firestore → Rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /stratix_users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /stratix_data/{userId}/data/{key} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Firebase Hosting (optional — deploy in 2 minutes)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # select your project, set public dir to "." (current folder)
firebase deploy
```
Your app will be live at `https://YOUR-PROJECT-ID.web.app`

---

## File Load Order (index.html)

```html
<!-- Firebase SDK -->
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>
<script src="firebase_config.js"></script>  <!-- ← your project config -->

<!-- Core -->
<script src="auth.js"></script>      <!-- Auth + STRATIX_DB + NOTIFY + escapeHTML -->
<script src="store.js"></script>
<script src="components.js"></script>
<script src="upgrades.js"></script>
<script src="analytics.js"></script>
<script src="stratix_ai.js"></script>
<script src="features.js"></script>
<script src="logistics.js"></script>
<script src="erp.js"></script>
<script src="vertical.js"></script>
<script src="v_transport.js"></script>
<script src="v_retail.js"></script>
<script src="v_services.js"></script>
<script src="new_features.js"></script>
<script src="app.js"></script>
<script src="onboarding.js"></script>
<script src="finance_deep.js"></script>
<script src="v_factory_deep.js"></script>
<script src="interconnect.js"></script>  <!-- ← NEW: load second-to-last -->
<script src="polish.js"></script>        <!-- ← always last -->
```

---

## Interconnect API

```js
// Mark a client's full outstanding as paid (creates revenue transaction)
APP._markClientPaid(clientId);

// Mark a specific invoice as paid (partial amount supported)
IC.markInvoicePaid(invoiceId, optionalAmount);

// Manually trigger dashboard refresh
IC.scheduleDashboardRefresh();

// Force reload from Firestore
STRATIX_DB.loadFromFirestore();

// Listen for any data change
document.addEventListener('stratix:datachange', e => {
  console.log(e.detail.collection, e.detail.action, e.detail.item);
});

// Listen for settings save
document.addEventListener('stratix:settingssaved', e => {
  console.log('New business type:', e.detail.businessType);
});
```

---

## Bug Fixes in v5.0

| # | Module | Fix |
|---|--------|-----|
| 1 | auth.js | Constant-time password comparison (timing attack prevention) |
| 2 | auth.js | Legacy DJB2 → SHA-256 auto-upgrade on login |
| 3 | app.js | Chart `.destroy()` wrapped in try/catch (prevents crash on re-render) |
| 4 | app.js | `Math.max(...[])` → `Math.max(0, ...)` (prevents -Infinity on empty data) |
| 5 | app.js | Global `window.onerror` + unhandledrejection handler |
| 6 | app.js | `_markClientPaid()` — direct payment from Invoice Aging |
| 7 | finance_deep.js | Floating-point rounding on all tax calculations |
| 8 | v_factory_deep.js | Floating-point rounding on production cost calculations |
| 9 | features.js | GST row accumulation floating-point fix |
| 10 | index.html | Cloudflare email obfuscation scripts removed (breaks on Firebase Hosting) |
| 11 | style_patch.css | iOS input zoom prevention (font-size: 16px on mobile) |
| 12 | style_patch.css | 44px touch targets on all interactive elements |
| 13 | style_patch.css | Bottom-nav safe-area-inset for notched phones |
| 14 | style.css | toastIn/toastOut animations (were missing, toast appeared with no animation) |
| 15 | STRATIX_DB | onChange() event bus for cross-module reactivity |
| 16 | STRATIX_DB | loadFromFirestore() for cloud-to-local sync |

---

## Folder Structure
```
stratix_saas/
├── firebase_config.js   ← NEW: fill in your Firebase project config
├── interconnect.js      ← NEW: deep cross-module wiring
├── auth.js              ← v5.0: Firebase + Google Sign-In
├── index.html           ← v5.0: Firebase SDKs + Google button
├── login.html           ← v5.0: Firebase SDKs + Google button
├── style.css            ← unchanged
├── style_patch.css      ← v5.0: +250 lines mobile-first CSS
├── app.js               ← v5.0: _markClientPaid, settingssaved event
├── store.js             ← unchanged
├── components.js        ← unchanged
├── analytics.js         ← v5.0: Math.max guards
├── features.js          ← v5.0: GST rounding fix
├── finance_deep.js      ← v5.0: payroll floating-point fix
├── v_factory_deep.js    ← v5.0: production cost rounding fix
├── erp.js               ← unchanged (tables already had tbl-scroll)
└── ... (other files unchanged)
```
