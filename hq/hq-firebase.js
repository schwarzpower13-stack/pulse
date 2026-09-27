/* Smart Cup HQ: Firebase backend for the room.
   The room's page code was written for claude.ai's db / user / room capabilities; this module serves
   the same small API (doc/collection with get/set/update/delete/onSnapshot, user.me/can/profiles,
   room.presence/onPeers) from Firestore, behind an email sign-in limited to the team. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDPCvwE-B5UcIwFauo4aQLWrBpxU8xm2NE",
  authDomain: "pulse-cup.firebaseapp.com",
  projectId: "pulse-cup",
  storageBucket: "pulse-cup.firebasestorage.app",
  messagingSenderId: "960228406991",
  appId: "1:960228406991:web:83d7102a429a3e1e41a9ba"
};
/* Who may enter. The same list is enforced server-side by the Firestore rules (see firestore.rules). */
const TEAM = ["cgrcasanova@gmail.com", "pjc.casanova@gmail.com", "idavidsrno96@gmail.com", "verdes.eu.genio@gmail.com", "gonvipa@gmail.com", "schwarzpower13@gmail.com"];
const ADMIN = "schwarzpower13@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let fs;
try { fs = initializeFirestore(app, {ignoreUndefinedProperties:true, localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})}); }
catch (e){ fs = initializeFirestore(app, {ignoreUndefinedProperties:true}); }

const $ = id => document.getElementById(id);
const gate = $("hq-gate"), msg = $("hq-g-msg");
const say = (t, err) => { msg.textContent = t || ""; msg.classList.toggle("err", !!err); };
const LSK = "hq:email";
const lsGet = k => { try { return localStorage.getItem(k); } catch (e){ return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e){} };
const allowed = email => TEAM.includes(String(email || "").toLowerCase());

/* ---------- error mapping to the codes the room understands ---------- */
function mapErr(e){
  const c = e && e.code || "";
  if (c === "permission-denied") return {code:"invalid_argument", message:e.message};
  if (c === "resource-exhausted") return {code:"resource_exhausted", message:e.message};
  if (c === "unauthenticated") return {code:"revoked", message:e.message};
  return {code:"unavailable", message:(e && e.message) || String(e)};
}
const fail = e => { throw mapErr(e); };
const snapDoc = s => { const ok = s.exists(); const d = ok ? s.data() : undefined; return {id:s.id, exists:ok, data:() => d, metadata:{fromCache:s.metadata.fromCache, hasPendingWrites:s.metadata.hasPendingWrites}}; };

/* ---------- db ---------- */
function mkDoc(path){
  const ref = doc(fs, path);
  return {
    id:ref.id, path,
    get: () => getDoc(ref).then(snapDoc, fail),
    set: d => setDoc(ref, d).catch(fail),
    update: d => updateDoc(ref, d).catch(fail),
    delete: () => deleteDoc(ref).catch(fail),
    onSnapshot: (next, err) => onSnapshot(ref, s => next(snapDoc(s)), e => err && err(mapErr(e))),
    collection: sub => mkCol(path + "/" + sub)
  };
}
function mkCol(path){
  const ref = collection(fs, path);
  return {
    path,
    doc: id => mkDoc(path + "/" + (id || Math.random().toString(36).slice(2) + Date.now().toString(36))),
    onSnapshot: (next, err) => onSnapshot(ref, s => next({docs:s.docs.map(snapDoc), size:s.size, empty:s.empty, docChanges:() => [], metadata:{fromCache:s.metadata.fromCache, hasPendingWrites:s.metadata.hasPendingWrites}}), e => err && err(mapErr(e)))
  };
}
const db = {doc:mkDoc, collection:mkCol};

/* ---------- people (names for the admin's "who sits here") ---------- */
const people = {};
function watchPeople(){ onSnapshot(collection(fs, "people"), s => { s.docs.forEach(d => { people[d.id] = d.data(); }); }, () => {}); }

/* ---------- room: presence through presence/{uid} with a heartbeat ---------- */
function mkRoom(uid){
  let mine = {}, pushT = 0, last = [], cbs = [];
  const push = () => setDoc(doc(fs, "presence", uid), {p:mine, at:Date.now(), by:uid}).catch(() => {});
  const soon = () => { clearTimeout(pushT); pushT = setTimeout(push, 250); };
  setInterval(() => { if (document.visibilityState === "visible") push(); }, 25000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") push(); });
  window.addEventListener("pagehide", () => { setDoc(doc(fs, "presence", uid), {p:mine, at:0, by:uid}).catch(() => {}); });
  const emit = () => {
    const now = Date.now();
    const peers = last.filter(x => x && now - (x.at || 0) < 70000).map(x => ({kind:"viewer", presence:x.p || {}, by:x.by, isMe:x.by === uid, guest:false}));
    cbs.forEach(fn => { try { fn({peers}); } catch (e){} });
  };
  onSnapshot(collection(fs, "presence"), s => { last = s.docs.map(d => d.data()); emit(); }, () => {});
  setInterval(emit, 30000);
  push();
  return {
    presence: patch => { mine = Object.assign({}, mine, patch || {}); soon(); return Promise.resolve(); },
    onPeers: (fn) => { cbs.push(fn); emit(); return () => { cbs = cbs.filter(x => x !== fn); }; },
    emit: () => Promise.resolve(), on: () => () => {}
  };
}

/* ---------- import from the old claude.ai room (admin, one time) ---------- */
document.addEventListener("change", async e => {
  if (!e.target || e.target.id !== "hq-import") return;
  const f = e.target.files && e.target.files[0]; if (!f) return;
  const out = document.createElement("p"); out.className = "mono"; out.style.marginTop = "8px"; e.target.after(out);
  try {
    const j = JSON.parse(await f.text());
    const cols = j && j.collections; if (!cols) throw new Error("This isn't an HQ export.");
    let n = 0;
    for (const [c, docs] of Object.entries(cols)){
      for (const [id, d] of Object.entries(docs || {})){ await setDoc(doc(fs, c, id), d); n++; out.textContent = "Importing… " + n; }
    }
    out.textContent = "Imported " + n + " items. Done.";
  } catch (err){ out.textContent = "Import failed: " + (err.message || err); }
});

/* ---------- sign in ---------- */
function showGate(sub){ gate.hidden = false; if (sub) $("hq-g-sub").textContent = sub; }
$("hq-g-form").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("hq-g-email").value.trim().toLowerCase();
  if (!allowed(email)){ say("This email isn't on the Smart Cup team. Use the email the admin added, or ask the admin.", true); return; }
  $("hq-g-send").disabled = true; say("Sending…");
  try {
    await sendSignInLinkToEmail(auth, email, {url:location.origin + location.pathname, handleCodeInApp:true});
    lsSet(LSK, email);
    say("Link sent to " + email + ". Open it on this computer or phone (check Spam too).");
  } catch (err){ say(authMsg(err), true); }
  finally { $("hq-g-send").disabled = false; }
});
$("hq-g-google").addEventListener("click", async () => {
  say("");
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (err){ if (err && err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") say(authMsg(err), true); }
});
function authMsg(err){
  const c = err && err.code || "";
  if (c === "auth/operation-not-allowed") return "This sign-in method isn't switched on in Firebase yet. Ask the admin.";
  if (c === "auth/unauthorized-domain" || c === "auth/unauthorized-continue-uri") return "This address isn't allowed in Firebase yet. Ask the admin to add it under Authorized domains.";
  if (c === "auth/invalid-action-code" || c === "auth/expired-action-code") return "That link has expired or was already used. Send a new one.";
  if (c === "auth/network-request-failed") return "No internet connection.";
  if (c === "auth/popup-blocked") return "The browser blocked the Google window. Allow pop-ups, or use the email link.";
  return "Couldn't sign in (" + (c || err && err.message || "error") + ").";
}
async function finishEmailLink(){
  if (!isSignInWithEmailLink(auth, location.href)) return;
  let email = lsGet(LSK);
  if (!email){ showGate("Confirm your email to finish signing in."); $("hq-g-email").focus(); say("Type the email you asked the link for, then tap the button again.");
    const f = $("hq-g-form"), handler = async ev => { ev.preventDefault(); ev.stopImmediatePropagation(); const em = $("hq-g-email").value.trim().toLowerCase(); try { await signInWithEmailLink(auth, em, location.href); lsSet(LSK, null); history.replaceState(null, "", location.pathname); } catch (err){ say(authMsg(err), true); } };
    f.addEventListener("submit", handler, {capture:true, once:true}); return; }
  try { await signInWithEmailLink(auth, email, location.href); lsSet(LSK, null); }
  catch (err){ showGate(); say(authMsg(err), true); }
  history.replaceState(null, "", location.pathname);
}

let started = false;
onAuthStateChanged(auth, async user => {
  if (!user){ if (!isSignInWithEmailLink(auth, location.href)) showGate(); return; }
  const email = String(user.email || "").toLowerCase();
  if (!allowed(email)){ await signOut(auth); showGate(); say(email + " isn't on the Smart Cup team.", true); return; }
  gate.hidden = true;
  if (started) return; started = true;
  const uid = user.uid;
  const name = user.displayName || email.split("@")[0];
  setDoc(doc(fs, "people", uid), {name, email, at:Date.now()}).catch(() => {});
  watchPeople();
  const userApi = {
    me: async () => ({id:uid, name, email, isOwner:email === ADMIN, guest:false}),
    id: async () => uid,
    isOwner: async () => email === ADMIN,
    canEdit: async () => email === ADMIN,
    can: async () => true,
    profiles: async ids => { const o = {}; (ids || []).forEach(id => { const p = people[id]; o[id] = {id, name:p ? (p.name || p.email || "") : "", isMe:id === uid, guest:false}; }); return o; },
    search: async () => []
  };
  window.__hqResolve({db, user:userApi, room:mkRoom(uid)});
  const so = $("hq-signout"); if (so) so.addEventListener("click", async () => { await signOut(auth); location.reload(); });
});
finishEmailLink();

/* logo on the gate */
$("hq-g-mark").innerHTML = '<svg viewBox="0 0 64 64" width="96" height="96" aria-hidden="true" style="overflow:visible"><path d="M25 13 L22 9 M39 13 L42 9 M32 10 L32 5" stroke="#F0A83C" stroke-width="1.5" stroke-linecap="round" fill="none"/><g transform="translate(16 59) rotate(15)"><path d="M-10 -32 L10 -32 L7 -2 Q0 1 -7 -2 Z" fill="#1a1624" stroke="#F3EFE8" stroke-width="1.6" stroke-linejoin="round"/><ellipse cx="0" cy="-32" rx="10" ry="2.4" fill="#241f30" stroke="#F3EFE8" stroke-width="1.2"/><circle cx="0" cy="-17" r="4.3" fill="#F0A83C"/></g><g transform="translate(48 59) rotate(-15)"><path d="M-10 -32 L10 -32 L7 -2 Q0 1 -7 -2 Z" fill="#1a1624" stroke="#F3EFE8" stroke-width="1.6" stroke-linejoin="round"/><ellipse cx="0" cy="-32" rx="10" ry="2.4" fill="#241f30" stroke="#F3EFE8" stroke-width="1.2"/><circle cx="0" cy="-17" r="4.3" fill="#FF2FB9"/></g><g transform="translate(32 21)"><path d="M0 -7 C.6 -2 2 -.6 7 0 C2 .6 .6 2 0 7 C-.6 2 -2 .6 -7 0 C-2 -.6 -.6 -2 0 -7Z" fill="#F0A83C"/></g></svg>';

/* install as an app */
let deferred = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; $("hq-install").hidden = false; });
$("hq-install").addEventListener("click", async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; $("hq-install").hidden = true; });
window.addEventListener("appinstalled", () => { $("hq-install").hidden = true; });
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
