/* Smart Cup HQ: the "In the Wild" portal.
   A glowing cup in the rail (and in the phone header) opens the Smart Cup · In the Wild prototype in a
   full-screen layer over HQ. HQ keeps running underneath, so nothing reloads and nobody signs in again.
   The prototype is internal, so it ships encrypted (wild.bin: 12-byte IV + AES-256-GCM). Its key is kept
   in Firestore at team/wild, which only the team can read; the admin sets it once by opening HQ with
   #wild=<key> in the address. The prototype's question board is stored under wild/ (see firestore.rules). */
(function(){
  "use strict";
  var BIN = new URL("wild.bin", (document.currentScript && document.currentScript.src) || location.href).href;
  var PENDING = "hq:wild-unlock";
  var ls = {
    get: function(k){ try { return localStorage.getItem(k); } catch (e){ return null; } },
    set: function(k, v){ try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e){} }
  };

  /* an unlock link: remember the key and take it out of the address straight away */
  function readHash(){
    var m = /(?:^#|&)wild=([A-Za-z0-9_-]{43})(?:&|$)/.exec(location.hash);
    if (!m) return false;
    ls.set(PENDING, m[1]);
    try { history.replaceState(history.state, "", location.pathname + location.search); } catch (e){}
    return true;
  }
  readHash();

  var css = [
    ".wild-portal{position:relative;isolation:isolate;overflow:hidden;flex:none;display:flex;align-items:center;gap:12px;width:calc(100% - 28px);margin:2px 14px 8px;padding:9px 12px 9px 8px;border:1.5px solid rgba(240,168,60,.6);background:radial-gradient(130% 160% at 0% 50%,rgba(240,168,60,.17),rgba(193,59,214,.07) 55%,transparent 80%),var(--panel);color:var(--text);cursor:pointer;text-align:left;transition:border-color .25s,box-shadow .25s,transform .25s}",
    ".wild-portal::after{content:\"\";position:absolute;inset:0;z-index:-1;background:linear-gradient(100deg,transparent 35%,rgba(243,239,232,.11) 48%,transparent 62%);transform:translateX(-110%);animation:wpSheen 6s ease-in-out infinite}",
    ".wild-portal:hover,.wild-portal:focus-visible{border-color:var(--amber);box-shadow:0 0 0 1px var(--amber),0 0 30px -6px var(--amber-soft);transform:translateY(-1px);outline:none}",
    ".wp-cup{width:40px;height:48px;flex:none}",
    ".wild-cup{display:block;width:100%;height:100%;overflow:visible}",
    ".wild-cup .ring{fill:none;stroke:#F0A83C;stroke-width:1.3;transform-box:fill-box;transform-origin:center;animation:wpRing 2.8s cubic-bezier(.24,.6,.4,1) infinite}",
    ".wild-cup .ring.r2{animation-delay:1.4s}",
    ".wild-cup .scr{filter:drop-shadow(0 0 4px #F0A83C);animation:wpBeat 2.8s ease-in-out infinite}",
    ".wp-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}",
    ".wp-t small{font:600 9px/1 var(--f-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--amber)}",
    ".wp-t b{font:800 17px/1 var(--f-body);letter-spacing:-.025em;text-transform:uppercase;white-space:nowrap}",
    ".wp-t b i{font:italic 500 19px/1 var(--f-serif);letter-spacing:0;text-transform:none;color:var(--amber)}",
    ".wp-go{font:600 15px/1 var(--f-mono);color:var(--amber);transition:transform .25s}",
    ".wild-portal:hover .wp-go{transform:translate(2px,-2px)}",
    ".wild-mini{position:relative;color:var(--amber)}",
    ".wild-mini .wild-cup{width:24px;height:28px}",
    "@keyframes wpSheen{0%,58%{transform:translateX(-110%)}100%{transform:translateX(110%)}}",
    "@keyframes wpRing{0%{transform:scale(1);opacity:.9}100%{transform:scale(3.4);opacity:0}}",
    "@keyframes wpBeat{0%,100%{opacity:.75}14%{opacity:1}28%{opacity:.8}42%{opacity:1}}",
    "#wild{position:fixed;inset:0;z-index:68;display:flex;flex-direction:column;background:var(--void);padding-top:env(safe-area-inset-top,0px)}",
    "#wild.in{animation:wildIn .65s cubic-bezier(.22,1,.36,1)}",
    "@keyframes wildIn{from{clip-path:circle(0 at var(--ox,50%) var(--oy,50%))}to{clip-path:circle(150% at var(--ox,50%) var(--oy,50%))}}",
    ".wild-bar{flex:none;display:flex;align-items:center;gap:12px;height:48px;padding:0 12px;border-bottom:1.5px solid var(--line-2);background:rgba(8,7,12,.96)}",
    ".wild-back{flex:none;display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 12px 0 9px;border:1.5px solid var(--cream);background:transparent;color:var(--text);font:700 10.5px/1 var(--f-mono);letter-spacing:.12em;text-transform:uppercase;cursor:pointer}",
    ".wild-back:hover,.wild-back:focus-visible{background:var(--cream);color:var(--void);outline:none}",
    ".wild-back svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
    ".wild-title{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:9px;font:600 10px/1 var(--f-mono);letter-spacing:.16em;text-transform:uppercase;color:var(--muted);white-space:nowrap;overflow:hidden}",
    ".wild-title span{overflow:hidden;text-overflow:ellipsis}",
    ".wild-title b{color:var(--amber);font-weight:700}",
    ".wild-title i{flex:none;width:7px;height:7px;border-radius:50%;background:var(--amber);box-shadow:0 0 10px var(--amber);animation:wpBeat 2.8s ease-in-out infinite}",
    ".wild-note{flex:none;min-width:86px;text-align:right;font:600 9.5px/1.2 var(--f-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--lime)}",
    ".wild-stage{position:relative;flex:1;min-height:0}",
    ".wild-stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:var(--void);opacity:0;transition:opacity .5s ease}",
    ".wild-stage.ready iframe{opacity:1}",
    ".wild-msg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;text-align:center;color:var(--muted);font:500 12px/1.65 var(--f-mono)}",
    ".wild-msg .wild-cup{width:64px;height:76px}",
    ".wild-msg p{margin:0;max-width:40ch}",
    ".wild-msg b{color:var(--text)}",
    ".wild-msg button{padding:10px 16px;border:1.5px solid var(--amber);background:transparent;color:var(--amber);font:700 10.5px/1 var(--f-mono);letter-spacing:.12em;text-transform:uppercase;cursor:pointer}",
    "@media (max-width:860px){.wild-portal{margin-top:0}.wild-note{min-width:0}}",
    "@media (max-width:420px){.wild-title{letter-spacing:.1em}}",
    "@media (prefers-reduced-motion:reduce){.wild-portal::after,.wild-cup .ring,.wild-cup .scr,.wild-title i,#wild.in{animation:none}.wild-cup .ring{opacity:0}}"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var CUP = '<svg class="wild-cup" viewBox="0 0 40 48" aria-hidden="true"><circle class="ring" cx="20" cy="27" r="5.5"/><circle class="ring r2" cx="20" cy="27" r="5.5"/>' +
    '<g transform="translate(20 46)"><path d="M-12 -38 L12 -38 L8.5 -2.5 Q0 1 -8.5 -2.5 Z" fill="#1a1624" stroke="#F3EFE8" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<ellipse cx="0" cy="-38" rx="12" ry="2.8" fill="#241f30" stroke="#F3EFE8" stroke-width="1.3"/><circle class="scr" cx="0" cy="-19" r="5" fill="#F0A83C"/></g></svg>';

  /* the two ways in: a card under the logo in the rail, and a cup in the phone header */
  var portal = document.createElement("button");
  portal.type = "button"; portal.className = "wild-portal"; portal.id = "wild-open";
  portal.setAttribute("aria-label", "Open the prototype: Smart Cup in the Wild");
  portal.innerHTML = '<span class="wp-cup">' + CUP + '</span><span class="wp-t"><small>Prototype #01</small><b>In the <i>Wild</i></b></span><span class="wp-go" aria-hidden="true">&#8599;</span>';
  var brand = document.querySelector("#rail .brand"); if (brand) brand.after(portal);
  var mini = document.createElement("button");
  mini.type = "button"; mini.className = "icon-btn wild-mini"; mini.id = "wild-open-m";
  mini.setAttribute("aria-label", "Open the prototype: Smart Cup in the Wild");
  mini.innerHTML = CUP;
  var menu = document.getElementById("menu-btn"); if (menu) menu.before(mini);

  var ov = document.createElement("div");
  ov.id = "wild"; ov.hidden = true;
  ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Smart Cup in the Wild");
  ov.innerHTML = '<div class="wild-bar"><button type="button" class="wild-back" id="wild-close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span>HQ</span></button>' +
    '<div class="wild-title"><i></i><span>Smart Cup · <b>In the Wild</b></span></div><span class="wild-note" id="wild-note"></span></div>' +
    '<div class="wild-stage" id="wild-stage"><div class="wild-msg" id="wild-msg"></div></div>';
  document.body.appendChild(ov);
  var stage = ov.querySelector("#wild-stage"), box = ov.querySelector("#wild-msg"), note = ov.querySelector("#wild-note"), back = ov.querySelector("#wild-close");

  /* HQ's own signed-in api (served by hq-firebase.js once the team member is in) */
  var hqApi = null;
  function hq(){
    if (!hqApi) hqApi = Promise.all([window.claude.use("db"), window.claude.use("user")]).then(function(a){ return {db:a[0], user:a[1]}; });
    return hqApi;
  }

  function b64u(s){ s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function decrypt(k){
    return fetch(BIN, {cache:"no-cache"}).then(function(r){ if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); }).then(function(buf){
      return crypto.subtle.importKey("raw", b64u(k), "AES-GCM", false, ["decrypt"]).then(function(key){
        return crypto.subtle.decrypt({name:"AES-GCM", iv:new Uint8Array(buf, 0, 12)}, key, new Uint8Array(buf, 12));
      }).catch(function(){ throw {stale:true}; });
    }).then(function(pt){ return new TextDecoder().decode(pt); });
  }
  function getKey(){
    return hq().then(function(h){ return h.db.doc("team/wild").get(); }).then(function(s){ var d = s && s.exists ? s.data() : null; return d && d.k || null; });
  }

  /* the prototype's board lives in wild/ instead of the room's threads/; everything else is HQ's own api */
  var subs = [];
  function keep(on){
    return function(next, err){
      var u = on(function(s){ try { next(s); } catch (e){} }, function(e){ try { if (err) err(e); } catch (x){} });
      subs.push(u);
      return function(){ var i = subs.indexOf(u); if (i >= 0) subs.splice(i, 1); u(); };
    };
  }
  function wCol(c){ return {path:c.path, doc:function(id){ return wDoc(c.doc(id)); }, add:c.add, orderBy:function(f, d){ return wCol(c.orderBy(f, d)); }, onSnapshot:keep(c.onSnapshot)}; }
  function wDoc(d){ return {id:d.id, path:d.path, get:d.get, set:d.set, update:d.update, delete:d.delete, onSnapshot:keep(d.onSnapshot), collection:function(s){ return wCol(d.collection(s)); }}; }
  function wild(p){ var s = String(p || "").split("/"); if (s[0] !== "threads") throw {code:"invalid_argument", message:"Only the board is shared here."}; s[0] = "wild"; return s.join("/"); }
  window.__hqWild = {
    use: function(n){
      return hq().then(function(h){
        if (n === "user") return h.user;
        if (n !== "db") return null;
        return {collection:function(p){ return wCol(h.db.collection(wild(p))); }, doc:function(p){ return wDoc(h.db.doc(wild(p))); }};
      });
    }
  };
  var BRIDGE = '<script>window.claude={use:function(n){try{return parent.__hqWild.use(n);}catch(e){return Promise.resolve(null);}}};</' + 'script>';

  var html = null, blobUrl = null, frame = null, inerted = [], lastFocus = null, noteT = 0;
  function say(kind){
    stage.classList.toggle("ready", kind === "");
    if (kind === ""){ box.innerHTML = ""; box.hidden = true; return; }
    box.hidden = false;
    var t = {
      loading: "<p>Opening the prototype…</p>",
      locked: "<p><b>Locked for now.</b><br>It opens here for the whole team as soon as the admin unlocks it once.</p>",
      stale: "<p><b>A newer version is waiting.</b><br>The admin needs to unlock it once more, then it opens here for everyone.</p>",
      error: '<p><b>Couldn’t open it.</b><br>Check your connection, then try again.</p><button type="button" id="wild-retry">Try again</button>'
    }[kind];
    box.innerHTML = CUP + t;
  }
  function mount(t){
    if (!blobUrl){
      var doc = t.replace(/<head>/i, function(h){ return h + BRIDGE; });
      blobUrl = URL.createObjectURL(new Blob([doc], {type:"text/html"}));
    }
    frame = document.createElement("iframe");
    frame.title = "Smart Cup · In the Wild"; frame.setAttribute("allow", "fullscreen");
    var f = frame; f.addEventListener("load", function(){ if (frame === f) say(""); }, {once:true});
    frame.src = blobUrl;
    stage.appendChild(frame);
  }
  function load(){
    say("loading");
    var p = html ? Promise.resolve(html) : getKey().then(function(k){ if (!k) throw {locked:true}; return decrypt(k); }).then(function(t){ html = t; return t; });
    p.then(function(t){ if (!ov.hidden && !frame) mount(t); }, function(e){ if (!ov.hidden) say(e && e.locked ? "locked" : e && e.stale ? "stale" : "error"); });
  }
  function flash(text){ note.textContent = text || ""; clearTimeout(noteT); if (text) noteT = setTimeout(function(){ note.textContent = ""; }, 5000); }
  function open(from, msg){
    if (!ov.hidden) return;
    lastFocus = from || document.activeElement;
    var r = from && from.getBoundingClientRect ? from.getBoundingClientRect() : null;
    ov.style.setProperty("--ox", r && r.width ? (r.left + r.width / 2) + "px" : "50%");
    ov.style.setProperty("--oy", r && r.height ? (r.top + r.height / 2) + "px" : "50%");
    ov.hidden = false; ov.classList.remove("in"); void ov.offsetWidth; ov.classList.add("in");
    Array.prototype.forEach.call(document.body.children, function(el){ if (el !== ov && el.tagName !== "SCRIPT" && el.tagName !== "STYLE" && !el.inert){ el.inert = true; inerted.push(el); } });
    flash(msg);
    try { history.pushState({hqWild:1}, ""); } catch (e){}
    back.focus({preventScroll:true});
    load();
  }
  function close(fromHistory){
    if (ov.hidden) return;
    ov.hidden = true; ov.classList.remove("in"); flash("");
    subs.splice(0).forEach(function(u){ try { u(); } catch (e){} });
    if (frame){ frame.remove(); frame = null; }
    say("loading");
    inerted.splice(0).forEach(function(el){ el.inert = false; });
    if (!fromHistory && history.state && history.state.hqWild) history.back();
    if (lastFocus && lastFocus.focus && lastFocus.isConnected) lastFocus.focus({preventScroll:true});
  }
  ov.addEventListener("animationend", function(){ ov.classList.remove("in"); });
  portal.addEventListener("click", function(){ open(portal); });
  mini.addEventListener("click", function(){ open(mini); });
  back.addEventListener("click", function(){ close(false); });
  box.addEventListener("click", function(e){ if (e.target && e.target.id === "wild-retry") load(); });
  window.addEventListener("popstate", function(){ if (!ov.hidden) close(true); });
  document.addEventListener("keydown", function(e){ if (e.key === "Escape" && !ov.hidden){ e.stopPropagation(); e.preventDefault(); close(false); } }, true);

  function entry(){ return window.matchMedia("(max-width: 860px)").matches ? mini : portal; }

  /* the admin's one-time unlock: check the key really opens this version, then share it with the team */
  function unlock(){
    var pend = ls.get(PENDING);
    if (!pend) return;
    hq().then(function(h){
      return h.user.isOwner().then(function(own){
        if (!own){ ls.set(PENDING, null); return; }
        return decrypt(pend).then(function(t){
          html = t;
          return h.db.doc("team/wild").set({k:pend, at:Date.now()});
        }).then(function(){
          ls.set(PENDING, null);
          open(entry(), "Unlocked for the team");
        }, function(e){
          if (e && e.stale){ ls.set(PENDING, null); open(entry(), "Old unlock link"); }
        });
      });
    }).catch(function(){});
  }
  unlock();
  window.addEventListener("hashchange", function(){ if (readHash()) unlock(); });
})();
