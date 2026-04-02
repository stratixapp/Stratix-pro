/**
 * STRATIX auth.js v5.0 — Firebase Auth + Google Sign-In + localStorage fallback
 * API surface 100% backward-compatible with v4.0
 */

const STRATIX_AUTH = (() => {
  const UK = 'sx_users', SK = 'sx_session';

  const getUsers  = () => { try { return JSON.parse(localStorage.getItem(UK)) || []; } catch { return []; } };
  const saveUsers = u  => { try { localStorage.setItem(UK, JSON.stringify(u)); } catch(e) { console.error('Save users failed', e); } };

  async function hashPassword(password) {
    const data = new TextEncoder().encode(password + 'sx_salt_2026');
    const buf  = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  function legacyHash(p) {
    let h = 5381;
    for (let i = 0; i < p.length; i++) { h = ((h << 5) + h) ^ p.charCodeAt(i); h |= 0; }
    return (h >>> 0).toString(36);
  }

  const FB       = () => window.STRATIX_FB_AUTH  || null;
  const FB_STORE = () => window.STRATIX_FB_STORE || null;

  async function fbGetUserProfile(uid) {
    const db = FB_STORE();
    if (!db || !uid) return null;
    try {
      const doc = await db.collection('stratix_users').doc(uid).get();
      return doc.exists ? doc.data() : null;
    } catch(e) { return null; }
  }

  async function fbSaveUserProfile(uid, profile) {
    const db = FB_STORE();
    if (!db || !uid) return;
    try { await db.collection('stratix_users').doc(uid).set(profile, { merge: true }); } catch(e) {}
  }

  function setSession(user) {
    const sess = {
      userId:   user.id || user.uid,
      name:     user.name  || user.displayName || 'User',
      phone:    user.phone || '',
      biz:      user.biz   || user.businessName || '',
      bizType:  user.bizType || user.businessType || 'other',
      email:    user.email,
      plan:     'enterprise',
      avatar:   user.avatar || (user.name || user.displayName || 'U').charAt(0).toUpperCase(),
      photoURL: user.photoURL || null,
      loginAt:  new Date().toISOString(),
      expiresAt:new Date(Date.now() + 8*60*60*1000).toISOString(),
      source:   user._source || 'local',
    };
    localStorage.setItem(SK, JSON.stringify(sess));
    return sess;
  }

  function getSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SK));
      if (!s) return null;
      if (s.expiresAt && new Date(s.expiresAt) < new Date()) { localStorage.removeItem(SK); return null; }
      s.expiresAt = new Date(Date.now() + 8*60*60*1000).toISOString();
      localStorage.setItem(SK, JSON.stringify(s));
      return s;
    } catch { return null; }
  }

  async function registerLocal({ name, phone, biz, bizType, email, pass }) {
    const users = getUsers();
    if (users.find(u => u.email === email)) return { success: false, message: 'Account with this email already exists.' };
    const pwHash = await hashPassword(pass);
    const user = { id:'u_'+Date.now(), name, phone:phone||'', biz, bizType:bizType||'transport', email,
      password:pwHash, hashVersion:2, plan:'enterprise', avatar:name.charAt(0).toUpperCase(), createdAt:new Date().toISOString() };
    users.push(user); saveUsers(users);
    try { const sk=`sx_${user.id}_settings`; const ex=JSON.parse(localStorage.getItem(sk))||{}; ex.businessType=bizType||'transport'; localStorage.setItem(sk,JSON.stringify(ex)); } catch(e){}
    setSession(user);
    return { success:true, user };
  }

  async function registerFirebase({ name, phone, biz, bizType, email, pass }) {
    const auth = FB();
    if (!auth) return registerLocal({ name, phone, biz, bizType, email, pass });
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      const uid  = cred.user.uid;
      await cred.user.updateProfile({ displayName: name });
      const profile = { id:uid, name, phone:phone||'', biz, bizType:bizType||'transport', email,
        plan:'enterprise', avatar:name.charAt(0).toUpperCase(), createdAt:new Date().toISOString(), _source:'firebase' };
      await fbSaveUserProfile(uid, profile);
      const users = getUsers();
      if (!users.find(u=>u.email===email)) { users.push({...profile, password:'FIREBASE'}); saveUsers(users); }
      try { const sk=`sx_${uid}_settings`; const ex=JSON.parse(localStorage.getItem(sk))||{}; ex.businessType=bizType||'transport'; localStorage.setItem(sk,JSON.stringify(ex)); } catch(e){}
      setSession({...profile, _source:'firebase'});
      return { success:true, user:profile };
    } catch(e) {
      return { success:false, message: e.code==='auth/email-already-in-use'?'Account with this email already exists.':
        e.code==='auth/weak-password'?'Password too weak (min 6 chars).':e.message };
    }
  }

  async function loginLocal(email, pass) {
    const users = getUsers();
    const user  = users.find(u => u.email === email);
    if (!user) return { success:false, message:'Invalid email or password.' };
    let match = false;
    if (user.hashVersion === 2) {
      const h = await hashPassword(pass);
      match = h.length === user.password.length && Array.from(h).every((c,i)=>c===user.password[i]);
    } else {
      const lh = legacyHash(pass);
      match = lh.length === (user.password||'').length && Array.from(lh).every((c,i)=>c===user.password[i]);
      if (match) { const idx=users.findIndex(u=>u.email===email); users[idx].password=await hashPassword(pass); users[idx].hashVersion=2; saveUsers(users); }
    }
    if (!match) return { success:false, message:'Invalid email or password.' };
    setSession(user);
    return { success:true, user };
  }

  async function loginFirebase(email, pass) {
    const auth = FB();
    if (!auth) return loginLocal(email, pass);
    try {
      const cred = await auth.signInWithEmailAndPassword(email, pass);
      const uid  = cred.user.uid;
      let profile = await fbGetUserProfile(uid);
      if (!profile) { const users=getUsers(); profile=users.find(u=>u.email===email)||{ id:uid, name:cred.user.displayName||email.split('@')[0], email, bizType:'other', biz:'', phone:'' }; }
      setSession({...profile, id:uid, _source:'firebase'});
      return { success:true };
    } catch(e) {
      return { success:false, message: e.code==='auth/wrong-password'||e.code==='auth/user-not-found'?'Invalid email or password.':
        e.code==='auth/too-many-requests'?'Too many attempts. Try again later.':e.message };
    }
  }

  // ── GOOGLE SIGN-IN ──────────────────────────────────────────────────────────
  // ── Helper: process a Firebase Google user after popup OR redirect ─────────
  async function _processGoogleUser(fbUser) {
    const uid = fbUser.uid;
    let profile = await fbGetUserProfile(uid);
    const isNew = !profile;
    if (isNew) {
      profile = { id:uid, name:fbUser.displayName||fbUser.email.split('@')[0], email:fbUser.email,
        phone:fbUser.phoneNumber||'', biz:'', bizType:'other', plan:'enterprise',
        avatar:(fbUser.displayName||'U').charAt(0).toUpperCase(),
        photoURL:fbUser.photoURL||null, createdAt:new Date().toISOString(), _source:'google' };
      await fbSaveUserProfile(uid, profile);
    } else { profile._source='google'; }
    const users = getUsers();
    const idx = users.findIndex(u=>u.email===fbUser.email);
    if (idx===-1) { users.push({...profile, password:'GOOGLE_SSO'}); saveUsers(users); }
    else { users[idx]={...users[idx],...profile}; saveUsers(users); }
    try { const sk=`sx_${uid}_settings`; const ex=JSON.parse(localStorage.getItem(sk))||{}; if(!ex.businessType)ex.businessType=profile.bizType||'other'; localStorage.setItem(sk,JSON.stringify(ex)); } catch(e){}
    setSession({...profile, id:uid, _source:'google'});
    return { success:true, isNew, user:profile };
  }

  async function googleSignIn() {
    const auth = FB();
    if (!auth) return { success:false, message:'Firebase not configured. Fill in firebase_config.js first.' };

    // Check if we're returning from a redirect (handles popup-blocked case)
    try {
      const redirectResult = await auth.getRedirectResult();
      if (redirectResult && redirectResult.user) {
        return await _processGoogleUser(redirectResult.user);
      }
    } catch(e) { /* no redirect result, continue to popup */ }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      // Try popup first (better UX — no page reload)
      const result = await auth.signInWithPopup(provider);
      return await _processGoogleUser(result.user);
    } catch(e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-cancelled-by-user') {
        // Popup was blocked (common on mobile & some browsers) — fall back to redirect
        localStorage.setItem('sx_google_redirect', '1');
        await auth.signInWithRedirect(provider);
        return { success:false, message:'_redirect_' }; // page will reload
      }
      if (e.code === 'auth/popup-closed-by-user') return { success:false, message:'Sign-in cancelled.' };
      return { success:false, message: e.message || 'Google sign-in failed.' };
    }
  }

  async function register(opts) { return FB() ? registerFirebase(opts) : registerLocal(opts); }
  async function login(email, pass) { return FB() ? loginFirebase(email, pass) : loginLocal(email, pass); }

  async function logout() {
    localStorage.removeItem(SK);
    const auth = FB();
    if (auth) { try { await auth.signOut(); } catch(e) {} }
    if (typeof doLogout === 'function') { doLogout(); return; }
    window.location.href = 'login.html';
  }

  function requireAuth() { const s=getSession(); if(!s){window.location.href='login.html';return null;} return s; }

  function updateProfile(u) {
    const s=getSession(); if(!s) return false;
    const users=getUsers(); const i=users.findIndex(x=>x.id===s.userId);
    if(i===-1) return false;
    const merged=Object.assign({},users[i],u);
    if(!merged.bizType&&users[i].bizType) merged.bizType=users[i].bizType;
    users[i]=merged; saveUsers(users); setSession(users[i]);
    const auth=FB(); if(auth&&auth.currentUser) fbSaveUserProfile(auth.currentUser.uid, merged).catch(()=>{});
    return true;
  }

  function upgradePlan() { return true; }
  function hasPremium()  { return true; }

  (function bindAuthListener() {
    const auth = FB(); if(!auth) return;
    auth.onAuthStateChanged(fbUser => {
      if (!fbUser) { const s=getSession(); if(s&&s.source==='firebase') localStorage.removeItem(SK); }
      else { const s=getSession(); if(s&&s.userId===fbUser.uid){ s.expiresAt=new Date(Date.now()+8*60*60*1000).toISOString(); localStorage.setItem(SK,JSON.stringify(s)); } }
    });
  })();

  return { register, login, googleSignIn, logout, getSession, requireAuth, updateProfile, upgradePlan, hasPremium };
})();

/* ─── STRATIX_DB v5.0 — localStorage + optional Firestore sync ──────────── */
const STRATIX_DB = (() => {
  const key    = k => { const s=STRATIX_AUTH.getSession(); return s?`sx_${s.userId}_${k}`:`sx_g_${k}`; };
  const get    = k => { try{return JSON.parse(localStorage.getItem(key(k)));}catch{return null;} };
  const getArr = k => get(k)||[];

  let _warnShown = false;
  function _warnStorageFull() {
    if(_warnShown) return;
    try { let t=0; for(let i=0;i<localStorage.length;i++) t+=(localStorage.getItem(localStorage.key(i))||'').length*2;
      if(t>4000000){_warnShown=true;setTimeout(()=>{if(typeof NOTIFY!=='undefined')NOTIFY.show('⚠️ Storage ~80% full. Export via Settings!','warning',8000);},1000);}
    } catch(e){}
  }

  async function _syncToFirestore(k, v) {
    const db=window.STRATIX_FB_STORE; if(!db) return;
    const flags=window.STRATIX_FB_FLAGS; if(!flags||!flags.SYNC_TO_FIRESTORE) return;
    const auth=window.STRATIX_FB_AUTH; const uid=auth&&auth.currentUser?auth.currentUser.uid:null; if(!uid) return;
    try { await db.collection('stratix_data').doc(uid).collection('data').doc(k).set({value:JSON.stringify(v),updatedAt:new Date().toISOString()}); } catch(e){}
  }

  async function loadFromFirestore() {
    const db=window.STRATIX_FB_STORE; if(!db) return;
    const auth=window.STRATIX_FB_AUTH; const uid=auth&&auth.currentUser?auth.currentUser.uid:null; if(!uid) return;
    const flags=window.STRATIX_FB_FLAGS; if(!flags||!flags.SYNC_TO_FIRESTORE) return;
    try {
      const snap=await db.collection('stratix_data').doc(uid).collection('data').get();
      snap.forEach(doc=>{const k=doc.id;const lKey=`sx_${uid}_${k}`;if(!localStorage.getItem(lKey)){try{localStorage.setItem(lKey,doc.data().value);}catch(e){}}});
      console.info('[STRATIX] Firestore sync loaded ✓');
    } catch(e){ console.warn('[STRATIX] Firestore load failed:',e.message); }
  }

  function set(k, v) {
    try { localStorage.setItem(key(k),JSON.stringify(v)); _warnStorageFull(); _syncToFirestore(k,v); }
    catch(e) { if(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED') setTimeout(()=>{ if(typeof NOTIFY!=='undefined') NOTIFY.show('❌ Storage full! Settings → Export Data to backup.','error',10000); },100); }
  }

  const _listeners = {};
  function _broadcast(collection, action, item) {
    (_listeners[collection]||[]).forEach(fn=>{try{fn({collection,action,item});}catch(e){}});
    try { document.dispatchEvent(new CustomEvent('stratix:datachange',{detail:{collection,action,item}})); } catch(e){}
  }
  function onChange(collection, fn) { if(!_listeners[collection])_listeners[collection]=[]; _listeners[collection].push(fn); }

  const push = (k,item) => { const a=getArr(k); item.id=item.id||Date.now().toString(36)+Math.random().toString(36).slice(2,5); item.createdAt=item.createdAt||new Date().toISOString(); a.push(item); set(k,a); _broadcast(k,'push',item); return item; };
  const update=(k,id,u)=>{ const a=getArr(k),i=a.findIndex(x=>x.id===id); if(i!==-1){Object.assign(a[i],u);set(k,a);_broadcast(k,'update',a[i]);return true;}return false; };
  const remove=(k,id)=>{ set(k,getArr(k).filter(x=>x.id!==id)); _broadcast(k,'remove',{id}); };

  const getSettings=()=>{
    const defaults={businessName:'',ownerName:'',businessType:'transport',currency:'INR',currencySymbol:'₹',gstNumber:'',phone:'',address:'',state:'Kerala',panNumber:'',notifyWhatsapp:false,notifyEmail:true,language:'en',financialYear:'2025-26',reminderTime:'08:00',bankName:'',bankAcc:'',bankIFSC:'',upiId:'',anthropicApiKey:'',pfNumber:'',esiNumber:'',invoicePrefix:'INV',compactView:false,timezone:'Asia/Kolkata'};
    const stored=get('settings')||{}; const base=Object.assign({},defaults,stored);
    try{const sk=sessionStorage.getItem('sx_api_key');if(sk)base.anthropicApiKey=sk;}catch(e){}
    return base;
  };
  const saveSettings=s=>{ try{if(s.anthropicApiKey)sessionStorage.setItem('sx_api_key',s.anthropicApiKey);}catch(e){} set('settings',Object.assign({},s,{anthropicApiKey:''})); };

  const exportAll=()=>{
    const keys=['transactions','goals','notes','reminders','trips','fleet','invoices','orders','gstEntries','clients','settings','employees','payslips','bankAccounts','bankTransactions','fct_workers','fct_machines','fct_rawmats','fct_batches','rtl_items','rtl_bills','svc_projects'];
    const d={}; keys.forEach(k=>{d[k]=get(k);}); if(d.settings)d.settings=Object.assign({},d.settings,{anthropicApiKey:''}); d._v='5.0'; d._exported=new Date().toISOString(); return d;
  };
  const importAll=d=>{
    ['transactions','goals','notes','reminders','trips','fleet','invoices','orders','gstEntries','clients','settings','employees','payslips','bankAccounts','bankTransactions','fct_workers','fct_machines','fct_rawmats','fct_batches','rtl_items','rtl_bills','svc_projects'].forEach(k=>{if(d[k]!==undefined)set(k,d[k]);});
  };

  return {get,set,getArr,push,update,remove,getSettings,saveSettings,exportAll,importAll,onChange,loadFromFirestore};
})();

/* ─── Toast Notifications ───────────────────────────────────────────────── */
const NOTIFY = {
  show(msg,type='info',ms=3200){
    let c=document.getElementById('toastContainer');
    if(!c){c=document.createElement('div');c.id='toastContainer';c.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:90%;max-width:360px';document.body.appendChild(c);}
    const icons={success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'};const colors={success:'#00d68f',error:'#e84040',info:'#4f9ef0',warning:'#2563EB'};
    const t=document.createElement('div');
    t.style.cssText=`background:#F8FAFC;border:1px solid ${colors[type]}44;border-radius:12px;padding:12px 18px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 32px rgba(0,0,0,.6);pointer-events:all;font-family:var(--font,'Inter',sans-serif);font-size:13px;color:#0F172A;width:100%;animation:toastIn .3s ease`;
    t.innerHTML=`<span style="flex-shrink:0">${icons[type]}</span><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(()=>{t.style.animation='toastOut .3s ease forwards';setTimeout(()=>t.remove(),300);},ms);
  }
};

/* ─── XSS Protection ────────────────────────────────────────────────────── */
function escapeHTML(str){
  if(str===null||str===undefined)return'';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}
