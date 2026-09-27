(function(){
"use strict";
const $ = id => document.getElementById(id);
const PL = window.PulsePlanner;
const store = {
  get(k, d){ try { const v = localStorage.getItem("pulse." + k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem("pulse." + k, JSON.stringify(v)); } catch(e){} }
};
function h(tag, attrs){
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs){ const v = attrs[k]; if (v == null || v === false) continue;
    if (k === "class") e.className = v; else if (k === "style") e.style.cssText = v; else if (k === "text") e.textContent = v;
    else if (k.slice(0,2) === "on") e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v); }
  for (let i = 2; i < arguments.length; i++){ [].concat(arguments[i]).forEach(c => { if (c == null || c === false) return; e.append(c.nodeType ? c : String(c)); }); }
  return e;
}
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
const areaVar = a => "--area:var(--a-" + (a || "other") + ")";
const AREAS = PL.AREAS, AL = PL.AREA_LABEL, DOWS = PL.DOW_SHORT;
const pad = n => String(n).padStart(2,"0");

/* ---------- profile + clock ---------- */
const DEF_PROFILE = {wake:"07:00", sleep:"23:30", peak:"morning", restDay:0, focusGoal:120, tz:"Europe/Lisbon", about:"Marketing lead and CEO of Smart Cup in Lisbon.", areas:{business:5, health:4, finance:3, learning:3, relationships:4, mind:3, home:2}};
let profile = Object.assign({}, DEF_PROFILE, store.get("profile", {}));
profile.areas = Object.assign({}, DEF_PROFILE.areas, profile.areas || {});
function nowIn(d){
  const p = {};
  try { new Intl.DateTimeFormat("en-GB",{timeZone:profile.tz || "Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).formatToParts(d || new Date()).forEach(x => p[x.type] = x.value); }
  catch(e){ new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Lisbon",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).formatToParts(d || new Date()).forEach(x => p[x.type] = x.value); }
  const hh = +p.hour % 24;
  return {date:p.year+"-"+p.month+"-"+p.day, ym:p.year+"-"+p.month, h:hh, m:+p.minute, s:+p.second, hm:pad(hh)+":"+p.minute, min:hh*60 + (+p.minute) + (+p.second)/60};
}
function days(a,b){ return Math.round((Date.parse(b+"T12:00:00Z") - Date.parse(a+"T12:00:00Z"))/86400000); }
const addDays = PL.addDays, toMin = PL.toMin, fromMin = PL.fromMin;
function fmtDay(iso){ const d = new Date(iso+"T12:00:00Z"); return {d:d.toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"}), w:d.toLocaleDateString("en-GB",{weekday:"short",timeZone:"UTC"}), long:d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"})}; }
function monthName(ym){ return new Date(ym+"-15T12:00:00Z").toLocaleDateString("en-GB",{month:"long",year:"numeric",timeZone:"UTC"}); }
function prevMonth(ym){ let [y,m] = ym.split("-").map(Number); m--; if (!m){ m = 12; y--; } return y + "-" + pad(m); }
let T = nowIn();
function tickClock(){ T = nowIn(); $("clock").textContent = T.hm; }
tickClock();

/* ---------- data ---------- */
const MEMORY = [
  {k:"Product", v:"Reusable bar cup with a living screen. Two cups near each other match at random. No app, no personal data."},
  {k:"Market", v:"Lisbon first: Bairro Alto, Cais do Sodré, Santos. Dating app fatigue, the in-person trend, strong tourism."},
  {k:"Timeline", v:"Prototypes Oct 2026 to Mar 2027 · Go/No-Go Mar 2027 · launch night Jul 2027."},
  {k:"Marketing now", v:"Quiet phase: experience brief, brand, interviews, sales decks. Public campaign ONLY after Go/No-Go."},
  {k:"Funding", v:"Startup Lisboa incubation, From Start-to-Table, angels after Go/No-Go, a drinks partner."},
  {k:"Private details", v:"Prices, money and legal notes stay in your private Pulse page on claude.ai, not in this app."}
];
const SEED_PLAN = [
  ["2026-09-28","Write the job post for the technical lead","you"],
  ["2026-09-29","Check the From Start-to-Table 8th edition deadline","you"],
  ["2026-09-30","Find a startup lawyer and send the Fichário list","you"],
  ["2026-10-01","Prototype month 1 starts: tech decision and components","team"],
  ["2026-10-05","Experience brief: write the night scenario","you"],
  ["2026-10-08","Write every screen text: pulse, match, brand, drop, low battery","you"],
  ["2026-10-10","Prototype budget number due from the tech lead","team"],
  ["2026-10-12","Parts for the two prototypes should have arrived","team"],
  ["2026-10-15","Tone of voice one-pager","you"],
  ["2026-10-19","Submit the Startup Lisboa incubation application","you"],
  ["2026-10-22","First lawyer meeting: company, founders agreement, unpaid work, IP","you"],
  ["2026-10-26","From Start-to-Table: last year's deadline, confirm this year's","you"],
  ["2026-10-30","Deliver the experience brief to the tech team","you"]
];
let plan = store.get("plan", null);
if (!plan){ plan = SEED_PLAN.map((p,i) => ({id:"s"+i, date:p[0], text:p[1], who:p[2], done:false, draft:true})); }
plan.forEach(p => { if (!p.area) p.area = p.who === "team" ? "business" : PL.detectArea(p.text) === "other" ? "business" : PL.detectArea(p.text); if (!p.prio) p.prio = 2; if (!p.kind) p.kind = p.who === "team" ? "milestone" : "task"; if (!p.id) p.id = uid(); });
let tasks = store.get("tasks", []);
let log = store.get("log", []);
let fixed = store.get("fixed", []);
let habits = store.get("habits", null);
if (!habits){ habits = [{id:uid(), text:"Move 30 minutes", area:"health", created:T.date, log:{}}, {id:uid(), text:"Read 20 pages", area:"learning", created:T.date, log:{}}, {id:uid(), text:"No phone first hour", area:"mind", created:T.date, log:{}}]; store.set("habits", habits); }
let goals = store.get("goals", []);
let checkins = store.get("checkins", {});
let focusLog = store.get("focus", []);
let months = store.get("months", {});
let ritual = store.get("ritual", {});
function savePlan(){ store.set("plan", plan); }
savePlan();

/* ---------- canvas core ---------- */
const cv = $("cv"), cx = cv.getContext("2d");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
let speaking = false, listening = false, awake = false, thinking = false;
function draw(t){
  const W = cv.width, c = W/2; cx.clearRect(0,0,W,W);
  const ph = (t/1000*1.1)%1, beat = Math.exp(-Math.pow((ph-.08)*18,2)) + .6*Math.exp(-Math.pow((ph-.3)*18,2));
  const e = speaking ? .9 : listening ? .7 : thinking ? .8 : awake ? .45 : .25;
  for (let i=0;i<4;i++){ cx.beginPath(); cx.arc(c,c,110+i*30+beat*5*e*(4-i),0,Math.PI*2); cx.strokeStyle = i===0 ? "rgba(62,224,143,.95)" : "rgba(228,241,234,"+(.2-i*.04)+")"; cx.lineWidth = i===0 ? 3 : 1.2; cx.stroke(); }
  cx.save(); cx.translate(c,c); cx.rotate(t/(thinking ? 1500 : 9000));
  for (let i=0;i<60;i++){ const a=i/60*Math.PI*2, r1=236, r2=i%5===0?252:244; cx.beginPath(); cx.moveTo(Math.cos(a)*r1,Math.sin(a)*r1); cx.lineTo(Math.cos(a)*r2,Math.sin(a)*r2); cx.strokeStyle = i%5===0 ? "rgba(62,224,143,.75)" : "rgba(228,241,234,.22)"; cx.lineWidth = 2; cx.stroke(); }
  cx.restore();
  const r = 80 + beat*12*e, g = cx.createRadialGradient(c,c,4,c,c,r);
  g.addColorStop(0,"rgba(62,224,143,"+(.45+beat*.4)+")"); g.addColorStop(1,"rgba(62,224,143,0)");
  cx.fillStyle = g; cx.beginPath(); cx.arc(c,c,r,0,Math.PI*2); cx.fill();
  cx.beginPath();
  for (let x=-130;x<=130;x+=3){ const n=x/130, env=Math.exp(-n*n*3), y=Math.sin(n*18+t/170)*22*env*(speaking?1.3:listening?.9:thinking?.7:awake?.45:.12)*(1+beat*.5); x===-130?cx.moveTo(c+x,c+y):cx.lineTo(c+x,c+y); }
  cx.strokeStyle = "#E4F1EA"; cx.lineWidth = 2.4; cx.stroke();
  cx.fillStyle = "rgba(228,241,234,.8)"; cx.font = "600 15px ui-monospace, Menlo, monospace"; cx.textAlign = "center";
  cx.fillText(speaking ? "SPEAKING" : listening ? "LISTENING" : thinking ? "THINKING" : awake ? "ONLINE" : "STANDBY", c, c-104);
}
function loop(t){ draw(t); if (!reduce) requestAnimationFrame(loop); }
requestAnimationFrame(loop);

/* ---------- voice out ---------- */
const synth = window.speechSynthesis;
let voice = null, voices = [];
function vScore(v){
  let s = 0;
  if (/premium/i.test(v.name)) s += 90; if (/enhanced/i.test(v.name)) s += 70; if (/natural|neural/i.test(v.name)) s += 70;
  if (/^en[-_]GB/i.test(v.lang)) s += 25; else if (/^en[-_](US|IE|AU)/i.test(v.lang)) s += 18; else s += 8;
  if (/ava|serena|zoe|samantha|kate|stephanie|karen|moira|tessa|allison|susan|sonia|libby|jenny|aria|female/i.test(v.name)) s += 25;
  if (/daniel|arthur|oliver|fred|alex|tom|aaron|rishi|gordon|reed|ralph|albert|eddy|grandpa|grandma|rocko|shelley|sandy|flo|jester|bells|boing|bubbles|cellos|whisper|zarvox|trinoids|organ|superstar|bahh|wobble|junior|good news|bad news/i.test(v.name)) s -= 120;
  return s;
}
function loadVoices(){
  if (!synth) return;
  voices = synth.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang)).sort((a,b) => vScore(b)-vScore(a));
  const saved = store.get("voice", null);
  voice = voices.find(v => v.name === saved) || voices[0] || null;
  const sel = $("voiceSel"); sel.innerHTML = "";
  if (!voices.length){ sel.appendChild(h("option", {text:"No English voice found"})); return; }
  voices.slice(0,20).forEach(v => { const o = h("option", {value:v.name, text:v.name + " (" + v.lang + ")"}); if (v === voice) o.selected = true; sel.appendChild(o); });
}
if (synth){ loadVoices(); synth.addEventListener && synth.addEventListener("voiceschanged", loadVoices); setTimeout(loadVoices, 800); }
$("voiceSel").addEventListener("change", e => { voice = voices.find(v => v.name === e.target.value) || voice; store.set("voice", voice && voice.name); say("Hello, Mr. Jibladze. This is how I sound now."); });
$("testVoice").addEventListener("click", () => say("Good day, Mr. Jibladze. Pulse is online and ready."));
function speechText(t){ return t.replace(/€\s?(\d[\d,.]*)k\b/gi,"$1 thousand euros").replace(/€\s?(\d[\d,.]*)/g,"$1 euros").replace(/\bGo\s*\/\s*No-Go\b/gi,"go, no go").replace(/\bMr\.\s/g,"Mister ").replace(/Jibladze/g,"Jib-lahd-zeh").replace(/[★▸·•]/g," ").replace(/\s+/g," ").trim(); }
function say(text, opt){
  opt = opt || {};
  const latin = /[a-z]/i.test(text || "") && !/[\u10A0-\u10FF\u0400-\u04FF]/.test(text || "");
  if (!synth || !voice || !text || !latin){ if (opt.onEnd) setTimeout(opt.onEnd, 50); if (opt.onStart) opt.onStart(false); return; }
  if (!opt.queue) synth.cancel();
  const parts = speechText(text).match(/[^.!?]+[.!?]*\s*/g) || [speechText(text)];
  const chunks = []; let cur = "";
  parts.forEach(p => { if ((cur+p).length > 170 && cur){ chunks.push(cur.trim()); cur = p; } else cur += p; });
  if (cur.trim()) chunks.push(cur.trim());
  chunks.forEach((c,i) => {
    const u = new SpeechSynthesisUtterance(c);
    u.voice = voice; u.lang = voice.lang; u.rate = 1; u.pitch = 1;
    if (i === 0) u.onstart = () => { speaking = true; if (opt.onStart) opt.onStart(true); };
    if (i === chunks.length-1) u.onend = u.onerror = () => { speaking = false; if (opt.onEnd) opt.onEnd(); };
    synth.speak(u);
  });
}

/* ---------- small ui helpers ---------- */
let tt = null;
function type(el, text){
  clearInterval(tt); el.textContent = "";
  const c = h("span", {class:"caret"});
  if (reduce){ el.textContent = text; el.appendChild(c); return; }
  let i = 0; tt = setInterval(() => { i += 2; el.textContent = text.slice(0,i); el.appendChild(c); if (i >= text.length) clearInterval(tt); }, 22);
}
let toastT = null;
function toast(title, text, ms){
  const t = $("toast"); t.innerHTML = ""; t.append(h("b", {text:title}), text); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms || 5000);
}
$("toast").addEventListener("click", () => $("toast").hidden = true);
function chime(){
  try {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    const a = new A(); [0, .18, .36].forEach((d, i) => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = [660, 880, 1320][i]; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.0001, a.currentTime + d); g.gain.exponentialRampToValueAtTime(.2, a.currentTime + d + .02); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + d + .35); o.start(a.currentTime + d); o.stop(a.currentTime + d + .4); });
  } catch(e){}
  try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch(e){}
}
function chipRow(values, current, onPick, labels){
  const row = h("div", {class:"chips"});
  values.forEach((v, i) => row.appendChild(h("button", {type:"button", "aria-pressed":String(current === v), onclick: () => onPick(v)}, labels ? labels[i] : String(v))));
  return row;
}
function download(name, mime, data){
  const a = document.createElement("a");
  a.href = "data:" + mime + ";charset=utf-8," + encodeURIComponent(data);
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- day model ---------- */
function blocksFor(date){
  const d = PL.dow(date);
  const fx = fixed.filter(f => (f.days || []).includes(d)).map(f => ({id:"f:"+f.id, date, time:f.start, dur:Math.max(15, toMin(f.end) - toMin(f.start)), text:f.text, area:f.area || "other", kind:"fixed"}));
  return fx.concat(plan.filter(p => p.date === date)).sort((a,b) => String(a.time || "99").localeCompare(String(b.time || "99")));
}
function realItems(date){ return plan.filter(p => p.date === date && p.kind !== "ritual" && p.who !== "team"); }
function currentBlock(){
  const list = blocksFor(T.date).filter(b => b.time);
  const cur = list.find(b => toMin(b.time) <= T.min && T.min < toMin(b.time) + (b.dur || 30) && !b.done);
  const next = list.find(b => toMin(b.time) > T.min && !b.done);
  return {cur, next};
}
function focusMins(date){ return focusLog.filter(f => f.date === date).reduce((s, f) => s + f.mins, 0); }
function dayScore(date){
  const parts = [];
  const items = realItems(date); if (items.length) parts.push([items.filter(p => p.done).length / items.length, .4]);
  const hs = habits.filter(x => x.created <= date); if (hs.length && (items.length || hs.some(x => x.log[date]) || date === T.date)) parts.push([hs.filter(x => x.log[date]).length / hs.length, .25]);
  const c = checkins[date];
  if (c && c.energy) parts.push([((c.energy || 3) + (c.mood || 3)) / 10, .15]);
  if (c && c.rating) parts.push([c.rating / 5, .1]);
  const f = focusMins(date); if (parts.length || f) parts.push([Math.min(1, f / Math.max(15, profile.focusGoal || 120)), .2]);
  if (!parts.length) return null;
  const w = parts.reduce((s, p) => s + p[1], 0);
  return Math.round(100 * parts.reduce((s, p) => s + p[0] * p[1], 0) / w);
}
function weekScore(){ const xs = []; for (let i = 0; i < 7; i++){ const s = dayScore(addDays(T.date, -i)); if (s != null) xs.push(s); } return xs.length ? Math.round(xs.reduce((a,b) => a+b, 0) / xs.length) : null; }
function energyByDow(){
  const sum = [0,0,0,0,0,0,0], n = [0,0,0,0,0,0,0];
  Object.keys(checkins).forEach(d => { if (days(d, T.date) <= 70 && checkins[d].energy){ const w = PL.dow(d); sum[w] += checkins[d].energy; n[w]++; } });
  return sum.map((s, i) => n[i] ? Math.round(10 * s / n[i]) / 10 : null);
}
function streak(hb){ let d = hb.log[T.date] ? T.date : addDays(T.date, -1), n = 0; while (hb.log[d]){ n++; d = addDays(d, -1); } return n; }

/* orders = quick tasks + plan items due today or overdue (open) */
function todayOrders(){
  const t = tasks.filter(x => x.day === T.date || (!x.done && x.day < T.date));
  const p = plan.filter(x => x.who !== "team" && x.kind !== "habit" && x.kind !== "ritual" && !x.done && x.date <= T.date && (x.date === T.date || x.date >= addDays(T.date, -14))).map(x => ({id:"p:"+x.id, text:(x.time && x.date === T.date ? x.time + " " : "") + x.text, done:false, fromPlan:true, day:x.date}));
  return t.concat(p);
}
function openOrders(){ return todayOrders().filter(x => !x.done); }

/* ---------- home ---------- */
const NUMW = ["no","one","two","three","four","five","six","seven","eight","nine","ten"];
function helloWord(){ const hr = T.h; return hr < 5 ? "Good evening" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening"; }
function weekAhead(){ const end = addDays(T.date, 7); return plan.filter(p => !p.done && p.kind !== "habit" && p.kind !== "ritual" && p.date > T.date && p.date <= end); }
function monthWeek(){
  const m = months[T.ym]; if (!m || !m.result || !m.result.weeks) return null;
  return m.result.weeks.find(w => w.from <= T.date && T.date <= w.to) || null;
}
function briefData(){
  const open = openOrders(), week = weekAhead();
  const go = days(T.date,"2027-03-31"), launch = days(T.date,"2027-07-01");
  const stage = T.date < "2026-10-01" ? "Plan agreed, prototype phase starts on 1 October." : T.date <= "2027-03-31" ? "Prototype phase: " + go + " days to Go/No-Go." : T.date < "2027-07-01" ? "The Signal: " + launch + " days to launch night." : "After launch.";
  const stars = plan.filter(p => p.date === T.date && p.star && !p.done).map(p => p.text);
  const mw = monthWeek();
  const gaps = [];
  const slipped = overdue().length; if (slipped) gaps.push(slipped + " planned " + (slipped === 1 ? "block" : "blocks") + " slipped in the last two weeks. Re-schedule them from the banner above.");
  const hb = habits.filter(x => !x.log[T.date]); if (hb.length && T.h >= 17) gaps.push(hb.length + " habits still open today: " + hb.map(x => x.text).join(", ") + ".");
  if (!months[T.ym]) gaps.push("No month plan for " + monthName(T.ym) + " yet.");
  gaps.push("The technical lead is still missing.");
  return {
    headline: stage + " " + (open.length ? "You have " + open.length + " open " + (open.length===1?"order":"orders") + " today." : "Nothing open for today."),
    theme: mw ? mw.theme : null,
    focus: (stars.length ? stars : open.map(o => o.text)).slice(0,3),
    week: week.slice(0,4).map(p => fmtDay(p.date).w + " " + fmtDay(p.date).d + ": " + p.text),
    gaps
  };
}
function renderBrief(){
  const b = briefData(), el = $("brief"); el.innerHTML = "";
  el.appendChild(h("p", {class:"brief-h", text:b.headline}));
  const blocks = [["Focus · top 3", b.focus], ["Next 7 days", b.week], ["Watch", b.gaps]];
  if (b.theme) blocks.unshift(["This week's theme", [b.theme]]);
  blocks.forEach(([k, arr]) => { if (!arr.length) return; el.appendChild(h("div", {class:"k", text:k})); el.appendChild(h("ul", null, arr.map(x => h("li", {text:x})))); });
}
function renderNow(){
  const el = $("now"); el.innerHTML = "";
  const {cur, next} = currentBlock();
  if (cur){
    const s = toMin(cur.time), e = s + (cur.dur || 30), left = Math.max(0, Math.round(e - T.min));
    el.style.cssText = areaVar(cur.area);
    el.append(h("div", {class:"lbl"}, h("span", {text:"Now" + (cur.star ? " ★" : "")}), h("span", {text:AL[cur.area] || ""})),
      h("div", {class:"what", text:cur.text}),
      h("div", {class:"when", text:cur.time + "–" + fromMin(e) + " · " + left + " min left"}),
      h("div", {class:"bar"}, h("i", {style:"width:" + Math.min(100, Math.round(100 * (T.min - s) / (e - s))) + "%"})));
    const acts = h("div", {class:"acts left"});
    if (cur.kind !== "fixed"){
      acts.append(h("button", {class:"btn hot sm", type:"button", onclick: () => { setDone(cur.id, true); toast("Done", cur.text); }}, "Done"),
        h("button", {class:"btn sm", type:"button", onclick: () => openFocus(cur.text, Math.max(5, left), cur.area)}, "Focus " + Math.max(5, left) + "m"),
        h("button", {class:"btn ghost sm", type:"button", onclick: () => { moveLater(cur.id); }}, "Later"));
    }
    el.appendChild(acts);
    if (next) el.appendChild(h("div", {class:"next"}, "Then ", h("b", {text:next.time}), " " + next.text));
  } else if (next){
    const inMin = Math.round(toMin(next.time) - T.min);
    el.style.cssText = areaVar(next.area);
    el.append(h("div", {class:"lbl"}, h("span", {text:"Next in " + (inMin >= 60 ? Math.floor(inMin/60) + "h " + (inMin % 60) + "m" : inMin + " min")}), h("span", {text:AL[next.area] || ""})),
      h("div", {class:"what", text:next.text}), h("div", {class:"when", text:next.time + " · " + (next.dur || 30) + " min"}));
    if (inMin > 20) el.appendChild(h("div", {class:"next", text:"Free window now. Use it for a quick win: " + (openOrders()[0] ? openOrders()[0].text : "a 20 minute walk") + "."}));
  } else {
    const open = openOrders();
    el.style.cssText = "";
    el.append(h("div", {class:"lbl"}, h("span", {text:T.h >= 21 ? "Wind down" : "Free"}), h("span", {text:""})),
      h("div", {class:"what", text: T.h >= 21 ? "Close the day. Tomorrow is planned." : open.length ? open[0].text : "Nothing scheduled right now"}),
      h("div", {class:"when", text: open.length ? open.length + " open orders" : "Plan more on the Plan tab"}));
  }
}
function renderCheckin(){
  const el = $("checkin"); el.innerHTML = "";
  const c = checkins[T.date] || {};
  const save = () => { checkins[T.date] = c; store.set("checkins", checkins); };
  if (!c.energy || !c.mood || !c.sleep){
    $("chkWhen").textContent = "morning";
    el.appendChild(h("div", {class:"chk-q", text:"Energy right now"}));
    el.appendChild(chipRow([1,2,3,4,5], c.energy, v => { c.energy = v; save(); renderCheckin(); }));
    el.appendChild(h("div", {class:"chk-q", text:"Mood"}));
    el.appendChild(chipRow([1,2,3,4,5], c.mood, v => { c.mood = v; save(); renderCheckin(); }, ["😞","😕","😐","🙂","🔥"]));
    el.appendChild(h("div", {class:"chk-q", text:"Hours slept"}));
    el.appendChild(chipRow([5,6,7,8,9], c.sleep, v => { c.sleep = v; save(); renderCheckin(); renderLife(); toast("Check-in saved", c.energy <= 2 ? "Low energy noted. Pulse suggests only your starred items today, and an early night." : "Pulse will use this to shape your plans."); }, ["≤5","6","7","8","9+"]));
  } else if (T.h >= 17 && !c.rating){
    $("chkWhen").textContent = "evening";
    el.appendChild(h("div", {class:"chk-q", text:"How did today go?"}));
    const win = h("input", {class:"field", placeholder:"Biggest win today", value:c.win || ""});
    const blk = h("input", {class:"field", placeholder:"What got in the way?", value:c.block || "", style:"margin-top:8px"});
    el.appendChild(chipRow([1,2,3,4,5], c.rating, v => { c.rating = v; c.win = win.value.trim(); c.block = blk.value.trim(); save(); renderCheckin(); renderLife(); renderScore(); toast("Day closed", "Score " + dayScore(T.date) + ". " + (v >= 4 ? "Strong day. Protect the same rhythm tomorrow." : "Tomorrow starts with your first star, before messages.")); }, ["1","2","3","4","5"]));
    el.appendChild(h("div", {style:"margin-top:10px"}, win, blk));
    el.appendChild(h("p", {class:"note", style:"margin:8px 0 0", text:"Type your win and blocker first, then tap a number to close the day."}));
  } else {
    $("chkWhen").textContent = c.rating ? "day closed" : "evening at 17:00";
    el.appendChild(h("div", {class:"done-note", text:"✓ Energy " + c.energy + "/5 · Mood " + c.mood + "/5 · Sleep " + c.sleep + "h" + (c.rating ? " · Day " + c.rating + "/5" : "")}));
    if (c.win) el.appendChild(h("p", {class:"note", style:"margin:6px 0 0", text:"Win: " + c.win}));
    el.appendChild(h("div", {class:"acts left", style:"margin-top:8px"}, h("button", {class:"btn ghost sm", type:"button", onclick: () => { delete checkins[T.date]; store.set("checkins", checkins); renderCheckin(); }}, "Redo")));
  }
}
function tlRow(b, date, isToday){
  const s = b.time ? toMin(b.time) : null, e = s != null ? s + (b.dur || 30) : null;
  const cls = ["tl-row"];
  if (b.kind === "fixed") cls.push("fixed");
  if (b.done) cls.push("done");
  if (isToday && s != null && s <= T.min && T.min < e) cls.push("cur");
  else if (isToday && e != null && e <= T.min && !b.done) cls.push("past");
  const meta = [AL[b.area] || "", b.dur ? b.dur + " min" : "", b.kind === "deep" ? "deep work" : b.kind === "habit" ? "habit" : b.kind === "fixed" ? "fixed" : b.kind === "milestone" ? "team" : "", b.conflict ? "clash" : ""].filter(Boolean).join(" · ");
  const body = h("div", {class:"tl-b", style:areaVar(b.area)}, h("div", {class:"t"}, b.star ? h("span", {class:"star", text:"★ "}) : null, b.text), h("div", {class:"m", text:meta}));
  const ctl = h("div", {class:"tl-c"});
  if (b.kind !== "fixed"){
    const cb = h("input", {type:"checkbox", "aria-label":"Done: " + b.text}); cb.checked = !!b.done;
    cb.addEventListener("change", () => setDone(b.id, cb.checked));
    const x = h("button", {class:"x", type:"button", "aria-label":"Remove", text:"✕", onclick: () => { if (confirm("Remove \"" + b.text + "\"?")){ plan = plan.filter(p => p.id !== b.id); savePlan(); renderAll(); } }});
    ctl.append(cb, x);
  }
  return h("div", {class:cls.join(" ")}, h("div", {class:"tl-t", text:b.time || "—"}), body, ctl);
}
function renderTimeline(el, date){
  el.innerHTML = "";
  const list = blocksFor(date), isToday = date === T.date;
  if (!list.length){ el.appendChild(h("div", {class:"empty", text:"Nothing planned. Add something below, or plan the month."})); return list; }
  let lined = !isToday;
  list.forEach(b => {
    if (!lined && b.time && toMin(b.time) > T.min){ el.appendChild(h("div", {class:"nowline"}, h("span", {text:"NOW " + T.hm}), h("i"))); lined = true; }
    el.appendChild(tlRow(b, date, isToday));
  });
  if (!lined) el.appendChild(h("div", {class:"nowline"}, h("span", {text:"NOW " + T.hm}), h("i")));
  return list;
}
function renderToday(){
  const list = renderTimeline($("timeline"), T.date);
  const real = list.filter(b => b.kind !== "fixed");
  const mins = real.reduce((s, b) => s + (b.dur || 0), 0);
  $("tlSum").textContent = real.filter(b => b.done).length + "/" + real.length + " done · " + Math.round(mins/6)/10 + "h";
}
function renderTasks(){
  const ul = $("tasks"); ul.innerHTML = "";
  const list = tasks.filter(x => x.day === T.date || (!x.done && x.day < T.date));
  list.forEach(o => {
    const cb = h("input", {type:"checkbox", "aria-label":"Done: " + o.text}); cb.checked = !!o.done;
    cb.addEventListener("change", () => complete({id:o.id}, cb.checked));
    const x = h("button", {class:"x", type:"button", text:"✕", "aria-label":"Remove", onclick: () => removeOrder({id:o.id})});
    ul.appendChild(h("li", {class:o.done ? "done" : ""}, cb, h("div", null, h("div", {class:"t", text:o.text}), h("div", {class:"m", text:"Order" + (o.day < T.date ? " · overdue" : "")})), x));
  });
  if (!list.length) ul.appendChild(h("li", {class:"empty", style:"border:none;background:none", text:"No quick orders. Planned blocks are in the timeline above."}));
}
function renderScore(){
  const s = weekScore(); $("roScore").textContent = s == null ? "--" : s;
  const real = blocksFor(T.date).filter(b => b.kind !== "fixed" && b.kind !== "ritual");
  $("roToday").innerHTML = ""; $("roToday").append(String(real.filter(b => b.done).length), h("small", {text:"/" + real.length}));
  $("roGo").innerHTML = ""; $("roGo").append(String(Math.max(0, days(T.date,"2027-03-31"))), h("small", {text:"d"}));
}
function overdue(){ return plan.filter(p => !p.done && p.date < T.date && p.date >= addDays(T.date, -14) && p.kind !== "habit" && p.kind !== "ritual" && p.who !== "team"); }
function renderBanners(){
  const el = $("banners"); el.innerHTML = "";
  const rt = ritualTarget();
  if (rt && ritual[rt] !== "done"){
    const missed = rt === T.ym;
    el.appendChild(h("div", {class:"banner"}, h("b", {text: missed ? "No plan for " + monthName(rt) : "Tonight · month protocol"}),
      h("p", {text: missed ? "The month started without a plan. Ten minutes now saves the whole month." : "Last day of the month. Close " + monthName(prevMonth(rt)) + " and write the whole plan for " + monthName(rt) + ". Pulse will organise it."}),
      h("div", {class:"acts left", style:"margin-top:2px"}, h("button", {class:"btn hot sm", type:"button", onclick: () => openRitual(rt)}, missed ? "Plan it now" : "Start"))));
  }
  const od = overdue();
  if (od.length){
    el.appendChild(h("div", {class:"banner warn"}, h("b", {text:od.length + " slipped " + (od.length === 1 ? "block" : "blocks")}),
      h("p", {text:"Pulse can re-slot them into the lightest days of the coming week."}),
      h("div", {class:"acts left", style:"margin-top:2px"}, h("button", {class:"btn sm", type:"button", onclick: () => { const n = reschedule(od); toast("Re-scheduled", n + " blocks moved into the next 7 days."); renderAll(); }}, "Re-schedule"), h("button", {class:"btn ghost sm", type:"button", onclick: () => { od.forEach(p => p.done = true); savePlan(); renderAll(); }}, "Drop them"))));
  }
  if (PL.dow(T.date) === 0 && T.h >= 17){
    const from = addDays(T.date, -6), wk = plan.filter(p => p.date >= from && p.date <= T.date && p.kind !== "ritual" && p.who !== "team");
    const done = wk.filter(p => p.done).length, fm = focusLog.filter(f => f.date >= from).reduce((s, f) => s + f.mins, 0);
    el.appendChild(h("div", {class:"banner"}, h("b", {text:"Weekly review"}),
      h("p", {text:done + " of " + wk.length + " blocks done this week (" + (wk.length ? Math.round(100 * done / wk.length) : 0) + "%), " + Math.round(fm/6)/10 + "h of focus, life score " + (weekScore() == null ? "--" : weekScore()) + ". Pick next week's top 3 tomorrow morning."})));
  }
}
function renderHome(){ renderScore(); renderBanners(); renderNow(); renderCheckin(); renderToday(); renderBrief(); renderTasks(); }

/* ---------- actions on plan ---------- */
function setDone(id, done){
  const p = plan.find(x => x.id === id); if (!p) return;
  p.done = done; if (done) p.doneAt = Date.now();
  if (done && p.goalId){ const g = goals.find(x => x.id === p.goalId); if (g){ g.progress = Math.min(g.target, (g.progress || 0) + 1); store.set("goals", goals); } }
  savePlan(); renderAll();
}
function dayLoad(date){ return plan.filter(p => p.date === date && !p.done).reduce((s, p) => s + (p.dur || 30), 0); }
function reschedule(list){
  let n = 0;
  const start = T.h >= 20 ? addDays(T.date, 1) : T.date;
  list.forEach(p => {
    let best = null, bl = Infinity;
    for (let i = 0; i < 7; i++){ const d = addDays(start, i); if (PL.dow(d) === +profile.restDay && p.prio < 3) continue; const l = dayLoad(d) + i * 5; if (l < bl){ bl = l; best = d; } }
    if (best){ p.date = best; p.moved = (p.moved || 0) + 1; n++; }
  });
  savePlan(); return n;
}
function moveLater(id){
  const p = plan.find(x => x.id === id); if (!p) return;
  const list = blocksFor(T.date).filter(b => b.time);
  const lastEnd = list.reduce((m, b) => Math.max(m, toMin(b.time) + (b.dur || 30)), T.min);
  const sleep = toMin(profile.sleep) || 1410;
  if (lastEnd + (p.dur || 30) <= sleep - 45){ p.time = fromMin(Math.ceil((lastEnd + 10)/15)*15); toast("Moved", p.text + " → " + p.time + " today."); }
  else { p.date = addDays(T.date, 1); toast("Moved", p.text + " → tomorrow " + (p.time || "")); }
  savePlan(); renderAll();
}
function addTask(text){ text = String(text||"").trim(); if (!text) return null; const t = {id:uid(), text, day:T.date, done:false}; tasks.push(t); store.set("tasks", tasks); renderAll(); return t; }
function complete(o, done){
  if (o.fromPlan || String(o.id).slice(0,2) === "p:"){ setDone(String(o.id).replace(/^p:/, ""), done); return; }
  const t = tasks.find(x => x.id === o.id); if (t){ t.done = done; store.set("tasks", tasks); }
  renderAll();
}
function removeOrder(o){
  if (String(o.id).slice(0,2) === "p:"){ plan = plan.filter(x => "p:"+x.id !== o.id); savePlan(); }
  else { tasks = tasks.filter(x => x.id !== o.id); store.set("tasks", tasks); }
  renderAll();
}
$("addForm").addEventListener("submit", e => { e.preventDefault(); addTask($("newTask").value); $("newTask").value = ""; });

/* ---------- plan tab ---------- */
let viewMonth = T.ym, selDay = T.date;
AREAS.forEach(a => $("pArea").appendChild(h("option", {value:a, text:AL[a]})));
$("pArea").value = "business";
function renderMonthCard(){
  const el = $("monthCard"); el.innerHTML = "";
  const m = months[viewMonth];
  $("mTitle").textContent = monthName(viewMonth);
  $("planMonth").textContent = m ? "Edit month plan" : "Plan this month";
  $("rebuild").hidden = !m;
  if (!m || !m.result) { el.appendChild(h("p", {class:"note", style:"margin-top:12px", text:"No month plan yet. Write everything you want from " + monthName(viewMonth) + " in one place and Pulse will turn it into days and hours."})); return; }
  const r = m.result;
  const card = h("div", {class:"card", style:"margin-top:14px"});
  card.append(h("div", {style:"display:flex;justify-content:space-between;gap:8px;align-items:center"}, h("span", {class:"k-lab", text:"Month strategy"}), h("span", {class:"src" + (r.source === "ai" ? " ai" : ""), text:r.source === "ai" ? "Claude" : "Pulse engine"})));
  card.append(h("p", {class:"brief-h", style:"margin:8px 0 0", text:r.summary}));
  if (r.stats && r.stats.load != null) card.append(h("p", {class:"note", style:"margin:6px 0 0", text:r.stats.hours + "h planned · " + r.stats.deepHours + "h deep work · load " + r.stats.load + "%"}));
  const done = plan.filter(p => p.src === "m:" + viewMonth), dn = done.filter(p => p.done).length;
  if (done.length) card.append(h("div", {class:"goal", style:"margin-top:10px;background:none"}, h("div", {class:"gh"}, h("span", {class:"t", text:"Month progress"}), h("span", {class:"p", text:dn + "/" + done.length})), h("div", {class:"gb"}, h("i", {style:"width:" + Math.round(100 * dn / done.length) + "%"}))));
  if (r.weeks && r.weeks.length) card.append(h("div", {class:"weeks"}, r.weeks.map(w => h("div", {class:"week"}, h("div", {class:"wl", text:w.label}), h("div", {class:"wt", text:w.theme}), w.focus && w.focus.length ? h("ul", null, w.focus.map(f => h("li", {text:f}))) : null))));
  if (r.rules && r.rules.length){ card.append(h("div", {class:"k-lab", style:"margin-top:14px", text:"Boost rules"})); card.append(h("ul", {class:"rules"}, r.rules.map(x => h("li", {text:x})))); }
  el.appendChild(card);
}
function renderCal(){
  const el = $("cal"); el.innerHTML = "";
  ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(d => el.appendChild(h("div", {class:"h", text:d})));
  const first = viewMonth + "-01", off = (PL.dow(first) + 6) % 7, dim = PL.daysInMonth(viewMonth);
  for (let i = 0; i < off; i++) el.appendChild(h("button", {class:"out", type:"button", tabindex:"-1", "aria-hidden":"true"}));
  for (let d = 1; d <= dim; d++){
    const iso = viewMonth + "-" + pad(d);
    const items = plan.filter(p => p.date === iso && p.kind !== "habit");
    const load = plan.filter(p => p.date === iso).reduce((s, p) => s + (p.dur || 30), 0);
    const areas = []; items.forEach(p => { if (!areas.includes(p.area)) areas.push(p.area); });
    const cls = [iso === T.date ? "today" : "", iso === selDay ? "sel" : "", iso < T.date ? "past" : ""].join(" ");
    el.appendChild(h("button", {type:"button", class:cls, "aria-label":fmtDay(iso).long + ", " + items.length + " items", onclick: () => { selDay = iso; renderPlan(); }},
      h("span", {class:"ld", style:"height:" + Math.min(100, Math.round(load / 6)) + "%"}),
      h("span", {class:"n", text:String(d)}),
      h("span", {class:"dots"}, areas.slice(0,6).map(a => h("i", {style:areaVar(a)})))));
  }
}
function renderPlan(){
  renderMonthCard(); renderCal();
  $("dayTitle").textContent = fmtDay(selDay).long;
  renderTimeline($("dayTl"), selDay);
  $("pDate").value = selDay;
}
$("mPrev").addEventListener("click", () => { viewMonth = prevMonth(viewMonth); selDay = viewMonth === T.ym ? T.date : viewMonth + "-01"; renderPlan(); });
$("mNext").addEventListener("click", () => { viewMonth = PL.nextMonth(viewMonth); selDay = viewMonth === T.ym ? T.date : viewMonth + "-01"; renderPlan(); });
$("planMonth").addEventListener("click", () => openRitual(viewMonth, true));
$("rebuild").addEventListener("click", () => { const m = months[viewMonth]; if (m) openRitual(viewMonth, true, true); });
$("planForm").addEventListener("submit", e => {
  e.preventDefault(); const text = $("pText").value.trim(), date = $("pDate").value; if (!text || !date) return;
  const it = PL.parseLine(text, date.slice(0,7));
  plan.push({id:uid(), date, time:$("pTime").value || it.time || null, dur:it.dur || 45, text:it.text || text, area:$("pArea").value || it.area, prio:it.prio, kind:"task", who:"you", done:false});
  savePlan(); $("pText").value = ""; $("pTime").value = ""; renderAll(); toast("Added", text + " · " + fmtDay(date).d);
});
function icsEsc(s){ return String(s).replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n"); }
function icsStamp(){ return new Date().toISOString().replace(/[-:]/g,"").slice(0,15) + "Z"; }
function ics(){
  const tz = profile.tz || "Europe/Lisbon", stamp = icsStamp();
  const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Pulse//Jibladze//EN","CALSCALE:GREGORIAN","X-WR-CALNAME:Pulse"];
  const list = plan.filter(p => !p.done && p.date >= T.date && p.kind !== "habit" && p.date <= addDays(T.date, 45)).slice(0, 200);
  list.forEach(p => {
    const d = p.date.replace(/-/g,""), s = p.time ? toMin(p.time) : 9*60, e = s + (p.dur || 30);
    lines.push("BEGIN:VEVENT","UID:pulse-"+p.id+"@jibladze","DTSTAMP:"+stamp,
      "DTSTART;TZID="+tz+":"+d+"T"+fromMin(s).replace(":","")+"00","DTEND;TZID="+tz+":"+d+"T"+fromMin(Math.min(e, 1439)).replace(":","")+"00",
      "SUMMARY:"+icsEsc((p.star ? "★ " : "") + p.text),"DESCRIPTION:"+icsEsc((AL[p.area] || "") + " · planned by Pulse"),
      "BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:"+icsEsc(p.text),"TRIGGER:-PT10M","END:VALARM","END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return {data:lines.join("\r\n"), n:list.length};
}
$("toCal").addEventListener("click", () => {
  const r = ics();
  if (!r.n){ $("calNote").textContent = "Nothing upcoming to add."; return; }
  download("pulse-plan.ics", "text/calendar", r.data);
  $("calNote").textContent = r.n + " blocks for the next 45 days sent to Calendar (habits stay in Pulse). On iPhone tap \"Add All\". Each one alerts you 10 minutes before.";
});
function ritualIcs(){
  const tz = profile.tz || "Europe/Lisbon", start = T.ym.replace("-","") + pad(PL.daysInMonth(T.ym));
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Pulse//Jibladze//EN","BEGIN:VEVENT","UID:pulse-month-ritual@jibladze","DTSTAMP:"+icsStamp(),
    "DTSTART;TZID="+tz+":"+start+"T210000","DTEND;TZID="+tz+":"+start+"T214500","RRULE:FREQ=MONTHLY;BYMONTHDAY=-1",
    "SUMMARY:Pulse · Month protocol: write next month's plan","DESCRIPTION:Open Pulse. Review the month, write the whole plan for next month, let Pulse organise it.",
    "BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:Month protocol in Pulse","TRIGGER:PT0M","END:VALARM",
    "BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:Month protocol tonight at 21:00","TRIGGER:-PT3H","END:VALARM","END:VEVENT","END:VCALENDAR"].join("\r\n");
}
$("ritualCal").addEventListener("click", () => { download("pulse-month-ritual.ics", "text/calendar", ritualIcs()); $("calNote").textContent = "A repeating event on the last day of every month at 21:00 (alert at 18:00 and 21:00). Tap it to open Pulse, and the month protocol will be waiting."; });

/* ---------- life tab ---------- */
function ringSvg(v, size, stroke){
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg"); svg.setAttribute("viewBox", "0 0 " + size + " " + size);
  const mk = (col, dash) => { const e = document.createElementNS(ns, "circle"); e.setAttribute("cx", size/2); e.setAttribute("cy", size/2); e.setAttribute("r", r); e.setAttribute("fill", "none"); e.setAttribute("stroke", col); e.setAttribute("stroke-width", stroke); if (dash != null){ e.setAttribute("stroke-dasharray", c); e.setAttribute("stroke-dashoffset", c * (1 - dash)); e.setAttribute("stroke-linecap", "butt"); e.style.transition = "stroke-dashoffset 1s"; } return e; };
  svg.append(mk("#1C3429"), mk(v >= 70 ? "#3EE08F" : v >= 45 ? "#FFC857" : "#FF6B5E", Math.max(0, Math.min(1, v / 100))));
  return svg;
}
function renderLife(){
  const s = weekScore();
  const ring = $("ring"); ring.innerHTML = ""; ring.append(ringSvg(s || 0, 132, 10), h("b", {text:s == null ? "--" : String(s)}), h("small", {text:"/ 100"}));
  const from = addDays(T.date, -6);
  const wk = plan.filter(p => p.date >= from && p.date <= T.date && p.kind !== "ritual" && p.who !== "team");
  const fm = focusLog.filter(f => f.date >= from).reduce((a, f) => a + f.mins, 0);
  let hDone = 0, hAll = 0; for (let i = 0; i < 7; i++){ const d = addDays(T.date, -i); habits.forEach(x => { if (x.created <= d){ hAll++; if (x.log[d]) hDone++; } }); }
  const cs = Object.keys(checkins).filter(d => d >= from).map(d => checkins[d]).filter(c => c.energy);
  const en = cs.length ? (cs.reduce((a, c) => a + c.energy, 0) / cs.length).toFixed(1) : "--";
  $("minis").innerHTML = "";
  [["Plan done", wk.length ? Math.round(100 * wk.filter(p => p.done).length / wk.length) + "%" : "--"], ["Focus", Math.round(fm/6)/10 + "h"], ["Habits", hAll ? Math.round(100 * hDone / hAll) + "%" : "--"], ["Energy", en]].forEach(([k, v]) => $("minis").appendChild(h("div", {class:"mini"}, h("div", {class:"k", text:k}), h("div", {class:"v", text:v}))));
  $("scoreNote").textContent = s == null ? "Your score builds from plan completion, habits, focus time and check-ins. Start with today's check-in." : s >= 75 ? "Top form. Keep the rhythm and raise one goal a notch." : s >= 50 ? "Solid. The fastest gain: finish your 3 stars before noon." : "Below your level. Cut today to the 3 stars, sleep early, restart tomorrow.";
  renderWheel(); renderHeat(); renderEnergy(); renderHabits(); renderGoals();
}
function renderWheel(){
  const svg = $("wheel"), ns = "http://www.w3.org/2000/svg"; svg.innerHTML = "";
  const axes = AREAS.filter(a => a !== "other"), cx0 = 170, cy0 = 150, R = 105;
  const from = addDays(T.date, -29), mins = {};
  plan.filter(p => p.done && p.date >= from && p.date <= T.date).forEach(p => mins[p.area] = (mins[p.area] || 0) + (p.dur || 30));
  focusLog.filter(f => f.date >= from).forEach(f => mins[f.area] = (mins[f.area] || 0) + f.mins);
  habits.forEach(x => { Object.keys(x.log).forEach(d => { if (d >= from) mins[x.area] = (mins[x.area] || 0) + 20; }); });
  const max = Math.max(60, ...axes.map(a => mins[a] || 0));
  const pt = (i, v) => { const ang = -Math.PI/2 + i * 2 * Math.PI / axes.length; return [cx0 + Math.cos(ang) * R * v, cy0 + Math.sin(ang) * R * v]; };
  const add = (tag, at) => { const e = document.createElementNS(ns, tag); for (const k in at) e.setAttribute(k, at[k]); svg.appendChild(e); return e; };
  [.25,.5,.75,1].forEach(v => add("polygon", {points:axes.map((a, i) => pt(i, v).join(",")).join(" "), fill:"none", stroke:"#1C3429", "stroke-width":1}));
  axes.forEach((a, i) => { const [x, y] = pt(i, 1); add("line", {x1:cx0, y1:cy0, x2:x, y2:y, stroke:"#1C3429"}); const [lx, ly] = pt(i, 1.2); const t = add("text", {x:lx, y:ly + 4, "text-anchor":"middle", fill:"#7F9E90", "font-size":11, "font-family":"ui-monospace, Menlo, monospace"}); t.textContent = AL[a].toUpperCase(); });
  add("polygon", {points:axes.map((a, i) => pt(i, (profile.areas[a] || 3) / 5).join(",")).join(" "), fill:"none", stroke:"#E4F1EA", "stroke-dasharray":"4 4", "stroke-width":1.2, opacity:.6});
  add("polygon", {points:axes.map((a, i) => pt(i, Math.max(.04, (mins[a] || 0) / max)).join(",")).join(" "), fill:"rgba(62,224,143,.22)", stroke:"#3EE08F", "stroke-width":2});
  axes.forEach((a, i) => { const [x, y] = pt(i, Math.max(.04, (mins[a] || 0) / max)); add("circle", {cx:x, cy:y, r:3.5, fill:"var(--a-" + a + ")"}); });
  const gap = axes.map(a => [a, (profile.areas[a] || 3) / 5 - (mins[a] || 0) / max]).sort((a,b) => b[1] - a[1])[0];
  $("wheelNote").textContent = Object.keys(mins).length ? "Green is where your time actually went, the dashed line is what you said matters. Biggest gap: " + AL[gap[0]] + ". Next month's plan should give it more blocks." : "Complete blocks, habits and focus sessions and the wheel fills in. The dashed line is your stated priorities.";
}
function renderHeat(){
  const el = $("heat"); el.innerHTML = "";
  ["M","T","W","T","F","S","S"].forEach(d => el.appendChild(h("div", {class:"h", text:d})));
  const monday = addDays(T.date, -((PL.dow(T.date) + 6) % 7) - 28);
  for (let i = 0; i < 35; i++){
    const d = addDays(monday, i), s = d <= T.date ? dayScore(d) : null;
    const bg = s == null ? "" : "background:rgba(62,224,143," + (0.12 + 0.88 * s / 100).toFixed(2) + ")";
    el.appendChild(h("i", {class:d === T.date ? "t" : "", style:bg, title:fmtDay(d).d + (s == null ? "" : ": " + s)}));
  }
}
function renderEnergy(){
  const el = $("ebars"); el.innerHTML = "";
  const e = energyByDow(), order = [1,2,3,4,5,6,0];
  order.forEach(i => el.appendChild(h("div", null, h("em", {text:e[i] == null ? "" : String(e[i])}), h("i", {style:"height:" + (e[i] ? Math.round(e[i] / 5 * 80) : 2) + "px;" + (e[i] && e[i] < 3 ? "background:var(--warn)" : "")}), h("span", {text:DOWS[i]}))));
  const known = order.filter(i => e[i] != null);
  if (known.length < 3){ $("eNote").textContent = "Do the morning check-in daily. After a couple of weeks Pulse knows your strong and weak days and plans around them."; return; }
  const best = known.slice().sort((a,b) => e[b] - e[a])[0], worst = known.slice().sort((a,b) => e[a] - e[b])[0];
  $("eNote").textContent = "Strongest: " + DOWS[best] + " (" + e[best] + "). Weakest: " + DOWS[worst] + " (" + e[worst] + "). Month plans put deep work on strong days and keep weak days light.";
}
function renderHabits(){
  const el = $("habits"); el.innerHTML = "";
  habits.forEach(x => {
    const dots = []; for (let i = 6; i >= 0; i--){ const d = addDays(T.date, -i); dots.push(h("i", {class:x.log[d] ? "on" : "", title:d})); }
    const on = !!x.log[T.date];
    el.appendChild(h("div", {class:"habit", style:areaVar(x.area)},
      h("div", null, h("div", {class:"t", text:x.text}), h("div", {class:"m"}, dots, h("span", {style:"margin-left:6px", text:"🔥 " + streak(x)}))),
      h("button", {class:"x", type:"button", "aria-label":"Delete habit", text:"✕", onclick: () => { if (confirm("Delete habit \"" + x.text + "\"?")){ habits = habits.filter(y => y !== x); store.set("habits", habits); renderLife(); renderScore(); } }}),
      h("button", {class:"tick", type:"button", "aria-pressed":String(on), "aria-label":"Done today: " + x.text, onclick: () => { if (on) delete x.log[T.date]; else { x.log[T.date] = true; chime(); } store.set("habits", habits); renderLife(); renderScore(); renderBrief(); }}, on ? "✓" : "")));
  });
  const done = habits.filter(x => x.log[T.date]).length;
  $("habSum").textContent = done + "/" + habits.length + " today";
  if (!habits.length) el.appendChild(h("div", {class:"empty", text:"No habits yet."}));
}
$("habForm").addEventListener("submit", e => { e.preventDefault(); const v = $("habIn").value.trim(); if (!v) return; habits.push({id:uid(), text:v, area:PL.detectArea(v), created:T.date, log:{}}); store.set("habits", habits); $("habIn").value = ""; renderLife(); });
function renderGoals(){
  const el = $("goals"); el.innerHTML = "";
  if (!goals.length){ el.appendChild(h("div", {class:"empty", text:"No goals yet. Your month plan's top 3 become goals automatically."})); return; }
  goals.forEach(g => {
    const pct = Math.round(100 * Math.min(1, (g.progress || 0) / Math.max(1, g.target || 1)));
    let pace = "";
    if (g.due && g.created && pct < 100){ const total = Math.max(1, days(g.created, g.due)), gone = Math.max(0, days(g.created, T.date)); const exp = Math.min(100, Math.round(100 * gone / total)); pace = pct >= exp ? "on pace" : "behind " + (exp - pct) + "%"; }
    const step = d => { g.progress = Math.max(0, Math.min(g.target, (g.progress || 0) + d)); store.set("goals", goals); if (g.progress >= g.target && d > 0){ chime(); toast("Goal reached", g.text); } renderGoals(); };
    el.appendChild(h("div", {class:"goal", style:areaVar(g.area)},
      h("div", {class:"gh"}, h("span", {class:"t", text:g.text}), h("span", {class:"p", text:(g.progress || 0) + "/" + g.target})),
      h("div", {class:"gb"}, h("i", {style:"width:" + pct + "%"})),
      h("div", {class:"gc"}, h("span", {text:(g.due ? "due " + fmtDay(g.due).d : "no deadline") + (pace ? " · " + pace : "")}),
        h("span", {style:"display:flex;gap:6px"}, h("button", {class:"btn ghost sm", type:"button", onclick: () => step(-1)}, "−"), h("button", {class:"btn sm", type:"button", onclick: () => step(1)}, "+1"), h("button", {class:"x", type:"button", text:"✕", "aria-label":"Delete goal", onclick: () => { if (confirm("Delete goal?")){ goals = goals.filter(y => y !== g); store.set("goals", goals); renderGoals(); } }})))));
  });
}
$("goalForm").addEventListener("submit", e => { e.preventDefault(); const t = $("gText").value.trim(); if (!t) return; goals.push({id:uid(), text:t, area:PL.detectArea(t), target:Math.max(1, +$("gTarget").value || 1), progress:0, due:$("gDue").value || null, created:T.date}); store.set("goals", goals); $("gText").value = ""; $("gTarget").value = ""; $("gDue").value = ""; renderGoals(); });

/* profile */
DOWS.forEach((d, i) => $("prRest").appendChild(h("option", {value:String(i), text:d})));
function fillProfile(){
  $("prWake").value = profile.wake; $("prSleep").value = profile.sleep; $("prPeak").value = profile.peak; $("prRest").value = String(profile.restDay);
  $("prFocus").value = profile.focusGoal; $("prTz").value = profile.tz; $("prAbout").value = profile.about || "";
  const box = $("prAreas"); box.innerHTML = "";
  AREAS.filter(a => a !== "other").forEach(a => box.appendChild(h("div", {class:"row", style:"grid-template-columns:110px 1fr;align-items:center"}, h("span", {class:"lab", text:AL[a]}), chipRow([1,2,3,4,5], profile.areas[a], v => { profile.areas[a] = v; fillProfile(); }))));
}
$("prSave").addEventListener("click", () => {
  profile.wake = $("prWake").value || "07:00"; profile.sleep = $("prSleep").value || "23:30"; profile.peak = $("prPeak").value; profile.restDay = +$("prRest").value;
  profile.focusGoal = Math.max(0, +$("prFocus").value || 0); profile.about = $("prAbout").value.trim();
  const tz = $("prTz").value.trim() || "Europe/Lisbon"; try { new Intl.DateTimeFormat("en", {timeZone:tz}); profile.tz = tz; } catch(e){ $("prNote").textContent = "Unknown time zone, kept " + profile.tz + "."; }
  store.set("profile", profile); tickClock(); renderAll();
  $("prNote").textContent = "Saved. The next month plan (or Re-optimise) will use it.";
});
/* fixed blocks */
const fxDays = new Set([1,2,3,4,5]);
function renderFixed(){
  const pick = $("fxDays"); pick.innerHTML = "";
  [1,2,3,4,5,6,0].forEach(i => pick.appendChild(h("button", {type:"button", "aria-pressed":String(fxDays.has(i)), onclick: () => { fxDays.has(i) ? fxDays.delete(i) : fxDays.add(i); renderFixed(); }}, DOWS[i])));
  const el = $("fixedList"); el.innerHTML = "";
  if (!fixed.length) el.appendChild(h("div", {class:"empty", text:"No fixed blocks."}));
  fixed.forEach(f => el.appendChild(h("div", {class:"habit", style:areaVar(f.area)}, h("div", null, h("div", {class:"t", text:f.text}), h("div", {class:"m", text:f.start + "–" + f.end + " · " + [1,2,3,4,5,6,0].filter(i => f.days.includes(i)).map(i => DOWS[i]).join(" ")})), h("span"), h("button", {class:"x", type:"button", text:"✕", "aria-label":"Delete block", onclick: () => { fixed = fixed.filter(y => y !== f); store.set("fixed", fixed); renderFixed(); renderAll(); }}))));
}
$("fixedForm").addEventListener("submit", e => {
  e.preventDefault(); const t = $("fxText").value.trim(), s = $("fxStart").value, en = $("fxEnd").value;
  if (!t || !s || !en || toMin(en) <= toMin(s) || !fxDays.size) return;
  fixed.push({id:uid(), text:t, start:s, end:en, days:[...fxDays], area:PL.detectArea(t) === "other" ? "business" : PL.detectArea(t)}); store.set("fixed", fixed); $("fxText").value = ""; renderFixed(); renderAll();
});

/* ---------- Claude ---------- */
let ai = store.get("ai", {});
function aiOn(){ return !!(ai && ai.key); }
function renderAiBadge(){ const b = $("aiBadge"); b.textContent = aiOn() ? "Claude" : "Local brain"; b.classList.toggle("on", aiOn()); }
async function claude(opt){
  if (!aiOn()) throw new Error("No API key");
  const model = ai.model || "claude-opus-5";
  const body = {model, max_tokens:opt.max || 4000, system:opt.system, messages:opt.messages};
  const oc = {};
  if (opt.schema) oc.format = {type:"json_schema", schema:opt.schema};
  if (opt.effort && !/haiku/.test(model)) oc.effort = opt.effort;
  if (Object.keys(oc).length) body.output_config = oc;
  const headers = {"content-type":"application/json", "x-api-key":ai.key, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true"};
  if (model === "claude-opus-5"){ body.fallbacks = "default"; headers["anthropic-beta"] = "server-side-fallback-2026-07-01"; }
  let r;
  try { r = await fetch("https://api.anthropic.com/v1/messages", {method:"POST", headers, body:JSON.stringify(body)}); }
  catch(e){ throw new Error("No connection to Claude."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok){ const msg = (j.error && j.error.message) || ("HTTP " + r.status); throw new Error(r.status === 401 ? "The API key was rejected." : r.status === 429 ? "Rate limited, try again in a minute." : msg); }
  if (j.stop_reason === "refusal") throw new Error("Claude declined this request.");
  if (j.stop_reason === "max_tokens") throw new Error("The answer was too long and got cut off.");
  return (j.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
}
function lifeContext(){
  const e = energyByDow();
  const recent = []; for (let i = 1; i <= 7; i++){ const d = addDays(T.date, -i); const s = dayScore(d); if (s != null) recent.push(d + ": score " + s + (checkins[d] ? ", energy " + checkins[d].energy + ", mood " + checkins[d].mood + (checkins[d].win ? ", win: " + checkins[d].win : "") + (checkins[d].block ? ", blocker: " + checkins[d].block : "") : "")); }
  return [
    "Person: Mr. Jibladze. " + (profile.about || ""),
    "Rhythm: wakes " + profile.wake + ", sleeps " + profile.sleep + ", best focus in the " + profile.peak + ", rest day " + DOWS[profile.restDay] + ", focus goal " + profile.focusGoal + " min/day, time zone " + profile.tz + ".",
    "Life area priorities (1-5): " + AREAS.filter(a => a !== "other").map(a => AL[a] + " " + profile.areas[a]).join(", ") + ".",
    "Fixed weekly blocks: " + (fixed.length ? fixed.map(f => f.text + " " + f.start + "-" + f.end + " on " + f.days.map(i => DOWS[i]).join("/")).join("; ") : "none") + ".",
    "Average energy by weekday (1-5): " + DOWS.map((d, i) => d + " " + (e[i] == null ? "?" : e[i])).join(", ") + ".",
    "Goals: " + (goals.length ? goals.map(g => g.text + " (" + (g.progress || 0) + "/" + g.target + (g.due ? ", due " + g.due : "") + ")").join("; ") : "none") + ".",
    "Habits: " + habits.map(x => x.text + " (streak " + streak(x) + ")").join("; ") + ".",
    "Last 7 days: " + (recent.join(" | ") || "no data yet") + ".",
    "Business memory: " + MEMORY.map(f => f.k + ": " + f.v).join(" ")
  ].join("\n");
}
const PLAN_SCHEMA = {type:"object", additionalProperties:false, required:["summary","rules","weeks","habits","items"], properties:{
  summary:{type:"string"},
  rules:{type:"array", items:{type:"string"}},
  weeks:{type:"array", items:{type:"object", additionalProperties:false, required:["label","theme","focus"], properties:{label:{type:"string"}, theme:{type:"string"}, focus:{type:"array", items:{type:"string"}}}}},
  habits:{type:"array", items:{type:"object", additionalProperties:false, required:["text","area","dur","time","dows"], properties:{text:{type:"string"}, area:{type:"string", enum:AREAS}, dur:{type:"integer"}, time:{type:"string"}, dows:{type:"array", items:{type:"integer"}}}}},
  items:{type:"array", items:{type:"object", additionalProperties:false, required:["date","time","dur","text","area","prio","kind","star"], properties:{date:{type:"string"}, time:{type:"string"}, dur:{type:"integer"}, text:{type:"string"}, area:{type:"string", enum:AREAS}, prio:{type:"integer"}, kind:{type:"string", enum:["deep","task","admin","event","ritual"]}, star:{type:"boolean"}}}}
}};
async function aiBuild(input, local){
  const system = "You are Pulse, the private chief of staff of Mr. Jibladze. You turn a raw monthly brain-dump into the most effective realistic schedule possible: highest-leverage work first, deep work in his peak energy window, strong weekdays for hard work and weak weekdays kept light, admin batched, projects split into phases that finish with a buffer before deadlines, rest protected, weekly planning (Monday morning) and weekly review (Sunday evening) and a month review with next month's planning on the last day at 21:00. Never schedule over fixed blocks or outside wake/sleep. Keep total planned load under about 65% of waking free time. Write every task text in the same language he used. Be honest: if the plan is overloaded, say what to cut.";
  const user = [
    "Month to plan: " + input.month + ". Plan only dates from " + input.first + " to the end of that month. Today is " + T.date + ".",
    "", "ABOUT HIM", lifeContext(),
    input.review ? "\nHIS REVIEW OF LAST MONTH\nWin: " + (input.review.win || "-") + "\nWhat slowed him down: " + (input.review.slow || "-") + "\nStop doing: " + (input.review.stop || "-") : "",
    "\nTOP 3 FOR THE MONTH\n" + ((input.top3 || []).filter(Boolean).join("\n") || "(not given)"),
    "\nHIS PLAN, AS WRITTEN\n" + input.text,
    "\nDRAFT FROM THE LOCAL ENGINE (improve on it; do not copy blindly)\n" + local.items.filter(i => i.kind !== "habit").slice(0, 160).map(i => i.date + " " + (i.time || "--:--") + " " + i.dur + "m " + i.text).join("\n"),
    "\nOUTPUT RULES",
    "- habits: each recurring activity once, with dows (0=Sunday..6=Saturday), a start time HH:MM and duration in minutes. Do not repeat habits in items.",
    "- items: every one-off block with date YYYY-MM-DD, time HH:MM (24h), dur in minutes, area, prio 1-3, kind, and star=true for at most 3 items per day (the must-dos).",
    "- weeks: one entry per calendar week of the month: label like 'Week 1 · 1-4 Oct', a sharp theme, and the 3 focus outcomes.",
    "- rules: 5 to 8 concrete boost strategies specific to his plan (what to batch, delegate, cut, automate, the one lever that moves everything). No generic advice.",
    "- summary: 2 or 3 honest sentences about the month's strategy and load."
  ].join("\n");
  const txt = await claude({system, messages:[{role:"user", content:user}], schema:PLAN_SCHEMA, max:32000});
  const j = JSON.parse(txt);
  const okT = t => /^\d{2}:\d{2}$/.test(t || "") && toMin(t) < 1440;
  const inMonth = d => /^\d{4}-\d{2}-\d{2}$/.test(d || "") && d.slice(0,7) === input.month && d >= input.first;
  const items = (j.items || []).filter(i => inMonth(i.date) && i.text).map(i => ({date:i.date, time:okT(i.time) ? i.time : null, dur:Math.max(5, Math.min(480, i.dur || 30)), text:String(i.text).slice(0, 200), area:AREAS.includes(i.area) ? i.area : "other", prio:Math.max(1, Math.min(3, i.prio || 2)), kind:i.kind || "task", star:!!i.star}));
  (j.habits || []).forEach(hb => {
    const dws = (hb.dows || []).filter(n => n >= 0 && n <= 6); if (!dws.length || !hb.text) return;
    for (let d = input.first; d.slice(0,7) === input.month; d = addDays(d, 1)){ if (dws.includes(PL.dow(d))) items.push({date:d, time:okT(hb.time) ? hb.time : null, dur:Math.max(5, Math.min(240, hb.dur || 30)), text:String(hb.text).slice(0, 200), area:AREAS.includes(hb.area) ? hb.area : "other", prio:2, kind:"habit", star:false}); }
  });
  if (items.length < 3) throw new Error("Claude returned an empty schedule.");
  items.sort((a,b) => a.date === b.date ? String(a.time || "99").localeCompare(String(b.time || "99")) : a.date < b.date ? -1 : 1);
  const mins = items.reduce((s, i) => s + i.dur, 0), deep = items.filter(i => i.kind === "deep").reduce((s, i) => s + i.dur, 0);
  return {month:input.month, items, weeks:(j.weeks || []).map(w => Object.assign({}, w, {from:null, to:null})), rules:j.rules || [], summary:j.summary || "", source:"ai",
    stats:{hours:Math.round(mins/6)/10, deepHours:Math.round(deep/6)/10, load:local.stats.capacityHours ? Math.round(100 * mins / 60 / local.stats.capacityHours) : null, blocks:items.length}};
}
function fixWeekRanges(res){
  /* give AI weeks real from/to dates, matching local calendar weeks */
  const first = res.items.length ? res.items[0].date : res.month + "-01";
  const ws = []; let d = first;
  while (d.slice(0,7) === res.month){ const k = addDays(d, -((PL.dow(d) + 6) % 7)); let w = ws.find(x => x.k === k); if (!w){ w = {k, from:d, to:d}; ws.push(w); } w.to = d; d = addDays(d, 1); }
  res.weeks.forEach((w, i) => { if (!w.from && ws[i]){ w.from = ws[i].from; w.to = ws[i].to; } });
}

/* ---------- month ritual ---------- */
function ritualTarget(){
  if (PL.isLastDay(T.date) && T.h >= 18) return PL.nextMonth(T.ym);
  if (+T.date.slice(8) <= 5 && !months[T.ym]) return T.ym;
  return null;
}
let R = null;
function monthStats(ym){
  const items = plan.filter(p => p.date.slice(0,7) === ym && p.kind !== "ritual" && p.who !== "team");
  const done = items.filter(p => p.done).length;
  const fm = focusLog.filter(f => f.date.slice(0,7) === ym).reduce((s, f) => s + f.mins, 0);
  let hd = 0, ha = 0; const dim = PL.daysInMonth(ym);
  for (let d = 1; d <= dim; d++){ const iso = ym + "-" + pad(d); if (iso > T.date) break; habits.forEach(x => { if (x.created <= iso){ ha++; if (x.log[iso]) hd++; } }); }
  const sc = []; for (let d = 1; d <= dim; d++){ const iso = ym + "-" + pad(d); if (iso > T.date) break; const s = dayScore(iso); if (s != null) sc.push([iso, s]); }
  const best = sc.slice().sort((a,b) => b[1] - a[1])[0];
  return {items:items.length, done, pct:items.length ? Math.round(100 * done / items.length) : null, focusH:Math.round(fm/6)/10, habits:ha ? Math.round(100 * hd / ha) : null, score:sc.length ? Math.round(sc.reduce((a, x) => a + x[1], 0) / sc.length) : null, best};
}
function openRitual(target, manual, jumpToBuild){
  const m = months[target];
  R = {target, step:jumpToBuild ? 3 : 1, text:m ? m.text : "", top3:m ? (m.top3 || ["","",""]).slice() : ["","",""], review:(m && m.review) || {win:"", slow:"", stop:""}, manual:!!manual, result:null};
  while (R.top3.length < 3) R.top3.push("");
  $("rit").hidden = false; $("ritDate").textContent = T.date.split("-").reverse().join(".");
  hideOrders(); renderRitual();
  if (jumpToBuild) runBuild();
  else if (!manual) say(helloWord() + ", Mr. Jibladze. It's the month protocol. First we close " + monthName(prevMonth(target)).split(" ")[0] + ", then you tell me everything you want from " + monthName(target).split(" ")[0] + ", and I'll organise it.");
}
function closeRitual(snooze){
  $("rit").hidden = true;
  if (snooze && R){ ritual[R.target] = "snooze:" + Date.now(); store.set("ritual", ritual); }
  R = null; renderAll();
}
const TPL = [["Top 3", "TOP 3:\n1. \n2. \n3. "], ["Business", "\nBusiness:\n- "], ["Health", "\nHealth:\n- gym 3x a week\n- "], ["Money", "\nMoney:\n- "], ["People", "\nPeople:\n- "], ["Learning", "\nLearning:\n- "], ["Dates", "\nFixed dates:\n- "]];
function renderRitual(){
  const box = $("ritBody"); box.innerHTML = "";
  document.querySelectorAll("#rit .steps i").forEach((i, k) => i.classList.toggle("on", k < R.step));
  const prev = prevMonth(R.target), tn = monthName(R.target).split(" ")[0], pn = monthName(prev).split(" ")[0];
  if (R.step === 1){
    const st = monthStats(prev);
    box.append(h("div", {class:"rit-big"}, "Close " + pn, h("span", {text:"Open " + tn})));
    box.append(h("div", {class:"rit-stats"}, [["Blocks done", st.items ? st.done + "/" + st.items : "--"], ["Completion", st.pct == null ? "--" : st.pct + "%"], ["Focus", st.focusH + "h"], ["Avg score", st.score == null ? "--" : String(st.score)]].map(([k, v]) => h("div", null, h("div", {class:"k", text:k}), h("div", {class:"v", text:v})))));
    if (st.best) box.append(h("p", {class:"note", text:"Best day: " + fmtDay(st.best[0]).long + " (score " + st.best[1] + "). Habits kept: " + (st.habits == null ? "--" : st.habits + "%") + "."}));
    const f = (key, label, ph) => { const t = h("textarea", {class:"field", rows:"2", placeholder:ph}); t.value = R.review[key] || ""; t.addEventListener("input", () => R.review[key] = t.value); return h("div", {class:"row"}, h("label", {class:"lab", text:label}), t); };
    box.append(f("win", "Biggest win of " + pn, "What went best?"), f("slow", "What slowed you down", "Time sinks, people, habits"), f("stop", "One thing to stop in " + tn, "Say no to…"));
    box.append(h("div", {class:"ops-foot"}, h("button", {class:"btn ghost", type:"button", onclick: () => closeRitual(true)}, "Later"), h("button", {class:"btn hot", type:"button", onclick: () => { R.step = 2; renderRitual(); }}, "Next")));
  } else if (R.step === 2){
    box.append(h("div", {class:"rit-big"}, tn, h("span", {text:"Whole plan"})));
    box.append(h("p", {class:"note", text:"Write everything: goals, projects, deadlines, meetings, habits, people, money. One thing per line. Plain words, any language. Pulse understands dates (\"15 Oct\", \"by 20th\"), times (\"at 15:00\"), repeats (\"gym 3x a week\", \"every Monday\"), durations (\"2h\") and \"!\" for important."}));
    const labs = ["Top goal 1","Top goal 2","Top goal 3"];
    box.append(h("div", {class:"lab", style:"margin:10px 0 6px", text:"Top 3 outcomes for " + tn}));
    R.top3.forEach((v, i) => { const inp = h("input", {class:"field", placeholder:labs[i], value:v, style:"margin-bottom:6px"}); inp.addEventListener("input", () => R.top3[i] = inp.value); box.appendChild(inp); });
    const ta = h("textarea", {class:"field rit-ta", placeholder:"Launch the landing page by 20th !\nInvestor meeting 14 Oct at 15:00\nGym 3x a week\nRead 2 books\nCall the lawyer\nPay rent on 5th\nDinner with family every Sunday\nLearn Portuguese 30 min daily"});
    ta.value = R.text; ta.addEventListener("input", () => { R.text = ta.value; btn.disabled = !ta.value.trim() && !R.top3.some(Boolean); });
    box.append(h("div", {class:"lab", style:"margin:12px 0 0", text:"Everything else"}), h("div", {class:"tpl"}, TPL.map(([k, v]) => h("button", {type:"button", onclick: () => { ta.value += (ta.value && !/\n$/.test(ta.value) ? "\n" : "") + v.replace(/^\n/, ta.value ? "\n" : ""); R.text = ta.value; ta.focus(); btn.disabled = false; }}, "+ " + k))), ta);
    const btn = h("button", {class:"btn hot", type:"button", onclick: () => { R.step = 3; renderRitual(); runBuild(); }}, "Build my month");
    btn.disabled = !R.text.trim() && !R.top3.some(Boolean);
    box.append(h("div", {class:"ops-foot"}, h("button", {class:"btn ghost", type:"button", onclick: () => { R.step = 1; renderRitual(); }}, "Back"), btn));
    setTimeout(() => ta.focus(), 50);
  } else if (R.step === 3){
    box.append(h("div", {class:"rit-big"}, tn, h("span", {text:R.result ? "Ready" : "Building"})));
    if (!R.result){ box.append(h("div", {class:"proc", id:"proc"})); return; }
    const r = R.result;
    box.append(h("div", {style:"display:flex;justify-content:space-between;align-items:center;gap:8px"}, h("span", {class:"k-lab", text:"Strategy"}), h("span", {class:"src" + (r.source === "ai" ? " ai" : ""), text:r.source === "ai" ? "Claude" : "Pulse engine"})));
    box.append(h("p", {class:"brief-h", style:"margin:6px 0", text:r.summary}));
    if (R.aiError) box.append(h("p", {class:"note", style:"color:var(--warn)", text:"Claude was not reachable (" + R.aiError + "), so the built-in engine planned this."}));
    const dim = PL.daysInMonth(R.target), loads = [];
    for (let d = 1; d <= dim; d++){ const iso = R.target + "-" + pad(d); loads.push([iso, r.items.filter(i => i.date === iso).reduce((s, i) => s + i.dur, 0)]); }
    const mx = Math.max(60, ...loads.map(x => x[1]));
    box.append(h("div", {class:"k-lab", style:"margin-top:10px", text:"Load per day"}), h("div", {class:"loadbar"}, loads.map(([iso, v]) => h("i", {class:PL.dow(iso) === +profile.restDay ? "rest" : v > 480 ? "hi" : "", style:"height:" + Math.max(3, Math.round(100 * v / mx)) + "%", title:iso + ": " + Math.round(v/6)/10 + "h"}))));
    box.append(h("div", {class:"weeks"}, (r.weeks || []).map(w => h("div", {class:"week"}, h("div", {class:"wl", text:w.label}), h("div", {class:"wt", text:w.theme}), w.focus && w.focus.length ? h("ul", null, w.focus.map(f => h("li", {text:f}))) : null))));
    if (r.rules && r.rules.length){ box.append(h("div", {class:"k-lab", style:"margin-top:12px", text:"Boost rules"}), h("ul", {class:"rules"}, r.rules.map(x => h("li", {text:x})))); }
    const firstDay = r.items.length ? r.items[0].date : null;
    if (firstDay){ box.append(h("div", {class:"k-lab", style:"margin-top:12px", text:"First day · " + fmtDay(firstDay).long})); box.append(h("div", {class:"tl", style:"margin-top:6px"}, r.items.filter(i => i.date === firstDay).map(i => h("div", {class:"tl-row"}, h("div", {class:"tl-t", text:i.time || "—"}), h("div", {class:"tl-b", style:areaVar(i.area)}, h("div", {class:"t"}, i.star ? h("span", {class:"star", text:"★ "}) : null, i.text), h("div", {class:"m", text:(AL[i.area] || "") + " · " + i.dur + " min"})), h("span"))))); }
    box.append(h("div", {class:"ops-foot"},
      h("button", {class:"btn ghost", type:"button", onclick: () => { R.step = 2; R.result = null; renderRitual(); }}, "Edit"),
      h("button", {class:"btn", type:"button", onclick: () => { R.result = null; renderRitual(); runBuild(); }}, "Rebuild"),
      h("button", {class:"btn hot", type:"button", onclick: acceptRitual}, "Accept & load")));
  }
}
async function runBuild(){
  const target = R.target, first = target === T.ym ? (T.h >= 20 ? addDays(T.date, 1) : T.date) : target + "-01";
  const keep = plan.filter(p => p.date.slice(0,7) === target && !(p.src === "m:" + target && !p.done));
  const input = {month:target, first, text:R.text, top3:R.top3, profile, fixed, today:first, energyByDow:energyByDow(), existing:keep.filter(p => p.date >= first && !p.done), review:R.review};
  const steps = ["> reading " + R.text.split(/\n/).filter(l => l.trim()).length + " lines + top 3", "> loading your rhythm: wake " + profile.wake + ", sleep " + profile.sleep + ", peak " + profile.peak, "> mapping energy by weekday", "> protecting " + fixed.length + " fixed blocks and " + keep.length + " existing items", "> splitting projects into phases, deadlines with buffer", "> batching calls, emails and payments", "> front-loading what matters most", aiOn() ? "> Claude is optimising the whole month…" : "> scoring load, starring the top 3 per day"];
  thinking = true;
  const lines = []; const proc = () => $("proc");
  for (const s of steps){ lines.push(s); if (proc()) proc().textContent = lines.join("\n") + "_"; await new Promise(r => setTimeout(r, reduce ? 0 : 320)); }
  let res = PL.build(input);
  R.aiError = null;
  if (aiOn()){
    try { res = await aiBuild(input, res); fixWeekRanges(res); }
    catch(e){ R.aiError = e.message; }
  }
  thinking = false;
  if (!R || R.target !== target) return;
  R.result = res; R.first = first; renderRitual();
  say(res.source === "ai" ? "Your month is ready. " + res.summary : "Your month is ready. " + res.summary.replace(/:.*/, ".") + " Have a look before you accept.");
}
function acceptRitual(){
  const r = R.result, t = R.target, src = "m:" + t;
  plan = plan.filter(p => !(p.src === src && !p.done && p.date >= R.first));
  const gids = [];
  R.top3.filter(x => x.trim()).forEach(x => {
    let g = goals.find(y => y.text === x.trim());
    if (!g){ g = {id:uid(), text:x.trim(), area:PL.detectArea(x), target:1, progress:0, due:t + "-" + pad(PL.daysInMonth(t)), created:T.date, month:t}; goals.push(g); }
    gids.push(g);
  });
  r.items.forEach(i => {
    const g = gids.find(g => i.text.includes(g.text) && /^Ship/.test(i.text));
    plan.push(Object.assign({id:uid(), who:"you", done:false, src}, i, g ? {goalId:g.id} : {}));
  });
  months[t] = {text:R.text, top3:R.top3, review:R.review, at:Date.now(), result:{summary:r.summary, weeks:r.weeks, rules:r.rules, stats:r.stats, source:r.source}};
  ritual[t] = "done";
  store.set("months", months); store.set("ritual", ritual); store.set("goals", goals); savePlan();
  const n = r.items.length;
  $("rit").hidden = true; R = null;
  viewMonth = t; selDay = t === T.ym ? T.date : t + "-01";
  switchView("plan"); renderAll();
  chime();
  toast("Month loaded", n + " blocks are in your plan. Use \"Upcoming to Calendar\" to get alerts on your iPhone.", 7000);
  say("Done. " + n + " blocks are loaded. I'll keep you on track every day.");
}

/* ---------- focus mode ---------- */
let F = null, wakeLock = null;
function openFocus(text, mins, area){
  const cur = currentBlock().cur;
  F = {text:text || (cur && cur.kind !== "fixed" ? cur.text : ""), mins:mins || 50, area:area || (cur ? cur.area : "business"), running:false};
  $("focus").hidden = false; renderFocus();
}
function renderFocus(){
  const box = $("focusBody"); box.innerHTML = "";
  if (!F.running){
    const inp = h("input", {class:"field", placeholder:"What are you focusing on?", value:F.text});
    inp.addEventListener("input", () => F.text = inp.value);
    box.append(h("div", {class:"row"}, h("label", {class:"lab", text:"Task"}), inp),
      h("div", {class:"lab", style:"margin:6px 0", text:"Minutes"}),
      chipRow([15,25,50,90], [15,25,50,90].includes(F.mins) ? F.mins : null, v => { F.mins = v; renderFocus(); }),
      h("div", {class:"lab", style:"margin:12px 0 6px", text:"Area"}),
      chipRow(AREAS, F.area, v => { F.area = v; renderFocus(); }, AREAS.map(a => AL[a])),
      h("p", {class:"note", text:"The screen stays on. Phone face up, notifications silent, one task only."}),
      h("div", {class:"ops-foot"}, h("button", {class:"btn ghost", type:"button", onclick: closeFocus}, "Close"), h("button", {class:"btn hot", type:"button", onclick: startFocus}, "Start " + F.mins + " min")));
    return;
  }
  const svgBox = h("div", {class:"focus-ring", id:"fRing"});
  box.append(h("div", {class:"focus-what", text:F.text || "Deep work"}), svgBox,
    h("div", {class:"ops-foot"}, h("button", {class:"btn ghost", type:"button", onclick: () => endFocus(false)}, "Stop"), h("button", {class:"btn", type:"button", onclick: () => { F.end += 5*60000; F.total += 5*60000; tickFocus(); }}, "+5 min")));
  tickFocus();
}
async function startFocus(){
  F.running = true; F.start = Date.now(); F.total = F.mins * 60000; F.end = F.start + F.total;
  try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request("screen"); } catch(e){}
  renderFocus(); say("Focus started. " + F.mins + " minutes. I'll call you when it's done.");
}
function tickFocus(){
  if (!F || !F.running) return;
  const ring = $("fRing"); if (!ring) return;
  const left = Math.max(0, F.end - Date.now()), done = 1 - left / F.total;
  const mm = Math.floor(left / 60000), ss = Math.floor(left / 1000) % 60;
  ring.innerHTML = ""; ring.append(ringSvg(done * 100, 300, 8), h("div", {class:"c"}, h("b", {text:pad(mm) + ":" + pad(ss)}), h("span", {text:Math.round(done * 100) + "% · " + AL[F.area]})));
  ring.querySelector("circle:last-child").setAttribute("stroke", "#3EE08F");
  $("focusClock").textContent = T.hm;
  if (left <= 0) endFocus(true);
}
function endFocus(full){
  if (!F) return;
  const mins = Math.round((Math.min(Date.now(), F.end) - F.start) / 60000);
  if (mins >= 5){ focusLog.push({date:T.date, mins, text:F.text, area:F.area}); store.set("focus", focusLog); }
  try { wakeLock && wakeLock.release(); } catch(e){} wakeLock = null;
  F.running = false;
  if (full){ chime(); say("Time. " + mins + " minutes of deep work done. Take a five minute break."); }
  toast(full ? "Session complete" : "Session stopped", mins + " min logged" + (F.text ? " · " + F.text : ""));
  closeFocus();
}
function closeFocus(){ if (F && F.running) return endFocus(false); $("focus").hidden = true; F = null; renderAll(); }
$("focusBtn").addEventListener("click", () => openFocus());

/* ---------- orders overlay ---------- */
const GL = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&/<>*+=";
let opsT = [];
function scramble(el, text, dur){
  if (reduce){ el.textContent = text; return; }
  const s0 = performance.now();
  const step = t => { const p = Math.min(1,(t-s0)/dur), k = Math.floor(p*text.length); let o = text.slice(0,k); for (let i=k;i<text.length;i++) o += text[i]===" " ? " " : GL[Math.floor(Math.random()*GL.length)]; el.textContent = o; if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function showOrders(){
  const list = openOrders(), rows = $("opsRows");
  opsT.forEach(clearTimeout); opsT = []; rows.innerHTML = "";
  $("opsDate").textContent = T.date.split("-").reverse().join(".");
  $("opsCount").textContent = String(list.length).padStart(2,"0");
  $("opsSub").textContent = list.length === 1 ? "Active order" : "Active orders";
  $("ops").hidden = false;
  scramble($("opsTitle"), "ORDERS FOR MR. JIBLADZE", 700);
  if (!list.length) rows.appendChild(h("div", {class:"op-row show"}, h("span", {class:"op-id", text:"CLEAR"}), h("span", {class:"op-t", text:"No open orders today."})));
  list.forEach((o,i) => {
    const r = h("div", {class:"op-row"}, h("span", {class:"op-id", text:"ORD-" + String(i+1).padStart(2,"0")}), h("span", {class:"op-t"}));
    rows.appendChild(r);
    opsT.push(setTimeout(() => { r.classList.add("show"); scramble(r.lastChild, o.text, 900); }, 800 + i*1100));
  });
}
function hideOrders(){ $("ops").hidden = true; opsT.forEach(clearTimeout); }
$("opsAck").addEventListener("click", hideOrders);
const ORD = ["First","Second","Third","Fourth","Fifth","Sixth","Seventh"];
function ordersSpeech(list){ return list.map((o,i) => (ORD[i]||"Next") + ". " + o.text + ".").join(" "); }
$("showOrders").addEventListener("click", () => { const l = openOrders(); showOrders(); if (l.length) say("Here's your list. " + ordersSpeech(l)); });

/* ---------- wake ---------- */
function greetingLine(){
  const n = openOrders().length, {cur, next} = currentBlock();
  let s = helloWord() + ", Mr. Jibladze. Nice to have you back. " + briefData().headline.replace(/You have .*$/,"").trim() + " ";
  if (cur) s += "Right now: " + cur.text + ". ";
  else if (next) s += "Next up at " + next.time + ": " + next.text + ". ";
  if (n) s += "You've got " + (NUMW[n]||n) + " " + (n===1?"thing":"things") + " on your list today.";
  else s += "Your list is clear today.";
  const sc = weekScore(); if (sc != null) s += " Life score " + sc + ".";
  return s.replace(/\s+/g," ").trim();
}
function wake(){
  awake = true;
  const line = greetingLine(), list = openOrders();
  $("greet").innerHTML = ""; $("greet").append(helloWord() + ",", h("span", {text:"Mr. Jibladze"}));
  type($("say"), line);
  say(line);
  if (ritualTarget() && ritual[ritualTarget()] !== "done"){ setTimeout(() => openRitual(ritualTarget()), 2500); return; }
  if (list.length){
    let shown = false; const show = () => { if (!shown){ shown = true; showOrders(); } };
    say("Let me put them on the screen. " + ordersSpeech(list), {queue:true, onStart: ok => ok ? show() : setTimeout(show, 2600)});
    setTimeout(show, 9000);
  }
}
$("wake").addEventListener("click", wake);
$("core").addEventListener("click", wake);
$("greet").innerHTML = ""; $("greet").append(helloWord() + ",", h("span", {text:"Mr. Jibladze"}));
type($("say"), "Standing by. Tap the core or Wake Pulse.");

/* ---------- talk ---------- */
function addLog(role, text){ log.push({role, text, at:Date.now()}); log = log.slice(-80); store.set("log", log); renderLog(); }
function renderLog(){
  const el = $("log"); el.innerHTML = "";
  if (!log.length) el.appendChild(h("div", {class:"msg her"}, h("span", {class:"w", text:"Pulse"}), "I'm listening, Mr. Jibladze. Ask what to do now, how you're doing, or tell me something to add."));
  log.slice(-30).forEach(l => el.appendChild(h("div", {class:"msg " + (l.role === "me" ? "me" : "her")}, h("span", {class:"w", text:l.role === "me" ? "You" : "Pulse"}), l.text)));
  if (thinking && $("v-talk").classList.contains("on")) el.appendChild(h("div", {class:"msg her think", text:"Pulse is thinking…"}));
  el.scrollTop = el.scrollHeight;
  if ($("v-talk").classList.contains("on")) window.scrollTo(0, document.body.scrollHeight);
}
const QUICK = ["What now?", "How am I doing?", "What's this week?", "Plan my month", "Start focus"];
QUICK.forEach(q => $("quick").appendChild(h("button", {type:"button", onclick: () => handle(q)}, q)));
function renderTalkHint(){ $("talkHint").textContent = 'Try: "add task call the lawyer" · "done one" · "read my brief" · "days to launch" · "habits".' + (aiOn() ? " Anything else goes to Claude right here." : " Anything else opens Claude. Add an API key in More to talk here."); }
const NUMS = {one:1,first:1,two:2,second:2,to:2,too:2,three:3,third:3,four:4,fourth:4,for:4,five:5,fifth:5,six:6,sixth:6};
function nowReply(){
  const {cur, next} = currentBlock();
  if (cur){ const left = Math.round(toMin(cur.time) + (cur.dur || 30) - T.min); return "Right now: " + cur.text + ", " + left + " minutes left." + (next ? " Then at " + next.time + ": " + next.text + "." : ""); }
  if (next) return "Nothing booked this minute. Next at " + next.time + ": " + next.text + "." + (openOrders()[0] ? " Until then, knock out: " + openOrders()[0].text + "." : "");
  const o = openOrders(); return o.length ? "Your schedule is clear. Best use of the time: " + o[0].text + "." : "Nothing left today. Rest, or plan tomorrow.";
}
function scoreReply(){
  const s = weekScore(), st = monthStats(T.ym);
  return (s == null ? "No score yet, start with the morning check-in." : "Life score " + s + " over the last seven days.") + (st.pct != null ? " This month you finished " + st.done + " of " + st.items + " blocks, " + st.pct + " percent." : "") + " Focus this month: " + st.focusH + " hours.";
}
function handle(raw){
  const q = String(raw || "").trim(); if (!q) return;
  addLog("me", q);
  const s = q.toLowerCase().replace(/[.,!?]/g,"");
  let m, reply = null, afterNow = null, afterEnd = null;
  if ((m = s.match(/^(?:add (?:a )?(?:task|order)|remind me to|new task|task)\s+(.+)$/))){
    const t = addTask(m[1].charAt(0).toUpperCase() + m[1].slice(1)); reply = t ? "Added to today: " + t.text + "." : "I didn't catch the task.";
  } else if ((m = s.match(/^(?:done|complete|finished|mark)\s+(?:task |order |number )?(\w+)/))){
    const n = NUMS[m[1]] || parseInt(m[1],10), l = openOrders();
    if (n && l[n-1]){ complete(l[n-1], true); reply = "Done: " + l[n-1].text + ". Nice work."; } else reply = "Which one? Say done one, done two, and so on.";
  } else if (/(what now|what should i do|right now|^now$|რა ვქნა|ახლა რა)/.test(s)){
    reply = nowReply();
  } else if (/(^next$|what's next|whats next|შემდეგ)/.test(s)){
    const n = currentBlock().next; reply = n ? "Next at " + n.time + ": " + n.text + "." : "Nothing else is scheduled today.";
  } else if (/(plan my month|month plan|plan the month|new month|თვის გეგმა)/.test(s)){
    reply = "Opening the month protocol."; afterNow = () => openRitual(ritualTarget() || (PL.isLastDay(T.date) ? PL.nextMonth(T.ym) : T.ym), true);
  } else if (/(start focus|focus mode|^focus$|deep work)/.test(s)){
    reply = "Focus mode. Pick your time and go."; afterNow = () => openFocus();
  } else if (/(how am i doing|my score|life score|progress|როგორ ვარ)/.test(s)){
    reply = scoreReply();
  } else if (/(habit|ჩვევ)/.test(s)){
    const open = habits.filter(x => !x.log[T.date]); reply = open.length ? "Still open today: " + open.map(x => x.text).join(", ") + "." : "All habits done today. Streak intact.";
  } else if (/(orders|tasks|to do|todo|my list|what do i have)/.test(s)){
    const l = openOrders(); reply = l.length ? "You have " + (NUMW[l.length]||l.length) + " open. " + ordersSpeech(l) : "Your list is clear today."; afterNow = showOrders;
  } else if (/(brief|status|update|report)/.test(s)){
    const b = briefData(); reply = b.headline + (b.theme ? " This week's theme: " + b.theme + "." : "") + (b.week.length ? " Coming up: " + b.week.slice(0,2).join(". ") + "." : "");
  } else if (/(this week|next week|coming up|schedule)/.test(s)){
    const w = weekAhead(); reply = w.length ? "Next seven days. " + w.slice(0,6).map(p => fmtDay(p.date).w + ": " + p.text).join(". ") + "." : "Nothing planned for the next seven days.";
  } else if (/(launch|go no go|go\/no go|how many days|countdown)/.test(s)){
    reply = days(T.date,"2027-03-31") + " days to Go, no go, and " + days(T.date,"2027-07-01") + " days to launch night.";
  } else if (/^(hi|hello|hey|good (morning|afternoon|evening)|გამარჯობა)/.test(s)){
    reply = helloWord() + ", Mr. Jibladze. What can I do for you?";
  } else if (/^(thank|thanks|მადლობ)/.test(s)){
    reply = "Any time, Mr. Jibladze.";
  } else if (aiOn()){
    aiChat(q); return;
  } else {
    reply = "That one needs deeper thinking. I'll open Claude with your question ready.";
    afterEnd = () => openClaude(q);
  }
  respond(reply, afterNow, afterEnd);
}
function respond(reply, afterNow, afterEnd){
  addLog("her", reply);
  say(reply, {onEnd: () => { if (afterEnd) afterEnd(); else if (convo() && heardByVoice) listen(); heardByVoice = false; }});
  if (afterNow) setTimeout(afterNow, 300);
}
const CHAT_SCHEMA = {type:"object", additionalProperties:false, required:["reply","add_today","add_plan"], properties:{reply:{type:"string"}, add_today:{type:"array", items:{type:"string"}}, add_plan:{type:"array", items:{type:"object", additionalProperties:false, required:["date","time","text"], properties:{date:{type:"string"}, time:{type:"string"}, text:{type:"string"}}}}}};
async function aiChat(q){
  thinking = true; renderLog();
  const today = blocksFor(T.date).map(b => (b.time || "--:--") + " " + b.text + (b.done ? " (done)" : "")).join("\n") || "(empty)";
  const system = "You are Pulse, the warm, sharp private chief of staff of Mr. Jibladze. You know his whole life context below. Answer briefly (2-5 sentences, spoken aloud), concretely, in the language he used. Push him toward his highest-leverage action, protect his energy, and be honest. If he asks you to add something to today or to a date, put it in add_today or add_plan (date YYYY-MM-DD, time HH:MM or empty) and confirm in the reply; otherwise leave those arrays empty.\n\n" + lifeContext() + "\n\nNow: " + T.date + " " + T.hm + " (" + fmtDay(T.date).w + ").\nToday's schedule:\n" + today + "\nMonth strategy: " + (months[T.ym] && months[T.ym].result ? months[T.ym].result.summary : "none yet");
  const msgs = [];
  log.slice(-12).forEach(l => { const role = l.role === "me" ? "user" : "assistant"; if (msgs.length && msgs[msgs.length-1].role === role) msgs[msgs.length-1].content += "\n" + l.text; else msgs.push({role, content:l.text}); });
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  try {
    const j = JSON.parse(await claude({system, messages:msgs, schema:CHAT_SCHEMA, max:3000, effort:"low"}));
    (j.add_today || []).forEach(t => t && addTask(t));
    (j.add_plan || []).forEach(p => { if (/^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.text){ plan.push({id:uid(), date:p.date, time:/^\d{2}:\d{2}$/.test(p.time) ? p.time : null, dur:45, text:p.text, area:PL.detectArea(p.text), prio:2, kind:"task", who:"you", done:false}); } });
    if ((j.add_plan || []).length){ savePlan(); renderAll(); }
    thinking = false; respond(j.reply || "Done.");
  } catch(e){
    thinking = false; respond("I couldn't reach Claude: " + e.message + " Try again, or use Deep talk.");
  }
}
let heardByVoice = false;
function openClaude(q){
  const p = "You are Pulse, the private chief of staff of Mr. Jibladze. Answer warmly and briefly.\n\n" + lifeContext() + "\nToday's open orders:\n" + (openOrders().map(o => "- " + o.text).join("\n") || "- none") + "\n\nHis question: " + (q || "What should I focus on today?");
  try { navigator.clipboard && navigator.clipboard.writeText(p); } catch(e){}
  window.location.href = "https://claude.ai/new?q=" + encodeURIComponent(p);
}
$("askClaude").addEventListener("click", () => openClaude(""));
$("clearLog").addEventListener("click", () => { log = []; store.set("log", log); renderLog(); });
$("typeForm").addEventListener("submit", e => { e.preventDefault(); const v = $("typeIn").value; $("typeIn").value = ""; handle(v); });

/* ---------- mic ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
function convo(){ return $("convo").checked; }
$("convo").checked = store.get("convo", true);
$("convo").addEventListener("change", () => store.set("convo", $("convo").checked));
$("speakBlocks").checked = store.get("speakBlocks", false);
$("speakBlocks").addEventListener("change", () => store.set("speakBlocks", $("speakBlocks").checked));
$("recLang").value = store.get("recLang", "en-US");
$("recLang").addEventListener("change", () => store.set("recLang", $("recLang").value));
function listen(){
  if (!SR){ $("heard").hidden = false; $("heard").textContent = "Voice input is not available here. Type instead."; setTimeout(() => $("heard").hidden = true, 3500); return; }
  if (listening) { try { rec.stop(); } catch(e){} return; }
  if (synth) synth.cancel();
  rec = new SR(); rec.lang = $("recLang").value || "en-US"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  let final = "";
  rec.onstart = () => { listening = true; awake = true; $("mic").classList.add("live"); $("heard").hidden = false; $("heard").textContent = "Listening…"; };
  rec.onresult = e => { let t = ""; for (let i = e.resultIndex; i < e.results.length; i++){ t += e.results[i][0].transcript; if (e.results[i].isFinal) final += e.results[i][0].transcript; } $("heard").textContent = t || final; };
  rec.onerror = e => { $("heard").textContent = e.error === "not-allowed" ? "Allow the microphone for Pulse in Settings › Safari › Microphone." : "I didn't hear anything."; };
  rec.onend = () => { listening = false; $("mic").classList.remove("live"); setTimeout(() => $("heard").hidden = true, 1200); if (final.trim()){ switchView("talk"); heardByVoice = true; handle(final); } };
  try { rec.start(); } catch(e){ listening = false; }
}
$("mic").addEventListener("click", listen);

/* ---------- tabs ---------- */
function switchView(v){
  document.querySelectorAll(".view").forEach(x => x.classList.toggle("on", x.id === "v-"+v));
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.v === v));
  store.set("tab", v);
  if (v === "talk") renderLog();
  if (v === "plan") renderPlan();
  if (v === "life") renderLife();
  window.scrollTo(0,0);
}
document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => switchView(b.dataset.v)));

/* ---------- more: ai, notifications, data ---------- */
function fillAi(){ $("aiKey").value = ai.key ? "••••••••" + ai.key.slice(-4) : ""; $("aiModel").value = ai.model || "claude-opus-5"; renderAiBadge(); renderTalkHint(); }
$("aiSave").addEventListener("click", () => {
  const k = $("aiKey").value.trim();
  if (k && !/^•/.test(k)) ai.key = k;
  ai.model = $("aiModel").value; store.set("ai", ai); fillAi();
  $("aiNote").textContent = aiOn() ? "Saved. Month plans and chat now use " + $("aiModel").selectedOptions[0].textContent + "." : "Model saved. Add a key to switch Claude on.";
});
$("aiTest").addEventListener("click", async () => {
  $("aiNote").textContent = "Testing…";
  try { const t = await claude({system:"Reply with one short friendly sentence.", messages:[{role:"user", content:"Say hello to Mr. Jibladze as Pulse."}], max:200}); $("aiNote").textContent = "✓ " + t; }
  catch(e){ $("aiNote").textContent = "✗ " + e.message; }
});
$("aiClear").addEventListener("click", () => { ai = {model:ai.model}; store.set("ai", ai); fillAi(); $("aiNote").textContent = "Key removed from this phone."; });
function notifState(){ const n = window.Notification; $("notifNote").textContent = !n ? "This browser can't show notifications. On iPhone, add Pulse to the Home Screen first." : n.permission === "granted" ? "Notifications are on while Pulse is open or in the background." : n.permission === "denied" ? "Notifications are blocked in Settings." : ""; }
$("notifBtn").addEventListener("click", async () => { try { if (window.Notification) await Notification.requestPermission(); } catch(e){} notifState(); });
$("ritualNow").addEventListener("click", () => openRitual(PL.isLastDay(T.date) ? PL.nextMonth(T.ym) : T.ym, true));
const KEYS = ["plan","tasks","log","profile","fixed","habits","goals","checkins","focus","months","ritual","voice","convo","speakBlocks","recLang"];
$("exportBtn").addEventListener("click", () => {
  const data = {app:"pulse", v:2, at:new Date().toISOString(), data:{}};
  KEYS.forEach(k => data.data[k] = store.get(k, null));
  download("pulse-backup-" + T.date + ".json", "application/json", JSON.stringify(data, null, 1));
  $("dataNote").textContent = "Backup saved. Your API key is not included.";
});
$("importIn").addEventListener("change", e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { const j = JSON.parse(r.result); if (j.app !== "pulse" || !j.data) throw new Error("not a Pulse backup"); KEYS.forEach(k => { if (j.data[k] != null) store.set(k, j.data[k]); }); location.reload(); } catch(err){ $("dataNote").textContent = "Import failed: " + err.message; } };
  r.readAsText(f);
});
MEMORY.forEach(f => $("facts").appendChild(h("div", {class:"fact"}, h("div", {class:"k", text:f.k}), h("div", {class:"v", text:f.v}))));
let resetArm = false;
$("reset").addEventListener("click", () => {
  if (!resetArm){ resetArm = true; $("reset").textContent = "Tap again to confirm"; $("resetNote").textContent = "This clears plans, habits, goals, check-ins and chat on this phone. Export a backup first."; setTimeout(() => { resetArm = false; $("reset").textContent = "Reset data on this phone"; }, 4000); return; }
  KEYS.concat(["tab"]).forEach(k => { try { localStorage.removeItem("pulse."+k); } catch(e){} });
  location.reload();
});

/* ---------- live loop: block alerts + month ritual ---------- */
const alerted = new Set();
function alertBlocks(){
  blocksFor(T.date).forEach(b => {
    if (!b.time || b.done || b.kind === "fixed") return;
    const s = toMin(b.time), key = T.date + b.id;
    if (T.min >= s && T.min < s + 1.5 && !alerted.has(key)){
      alerted.add(key);
      toast("Starting now · " + b.time, b.text, 9000); chime();
      if ($("speakBlocks").checked) say("It's " + b.time + ". Time for " + b.text + ".");
      try { if (window.Notification && Notification.permission === "granted" && document.hidden) new Notification("Pulse · " + b.time, {body:b.text, icon:"icon-192.png", tag:key}); } catch(e){}
    }
  });
}
function checkRitual(){
  const t = ritualTarget(); if (!t || !$("rit").hidden || !$("focus").hidden) return;
  const st = ritual[t];
  if (st === "done") return;
  if (st && /^snooze:/.test(st) && Date.now() - +st.slice(7) < 2 * 3600000) return;
  if (t !== T.ym && T.h < 20) return; /* the protocol itself opens at 20:00 on the last day; before that the banner announces it */
  openRitual(t);
}
let lastDate = T.date, lastMin = -1;
function tick(){
  tickClock();
  if (F && F.running) tickFocus();
  const mm = Math.floor(T.min);
  if (mm !== lastMin){
    lastMin = mm;
    if (mm % 60 === 0 && !awake){ $("greet").innerHTML = ""; $("greet").append(helloWord() + ",", h("span", {text:"Mr. Jibladze"})); }
    if (T.date !== lastDate){ lastDate = T.date; viewMonth = T.ym; selDay = T.date; renderAll(); }
    else if ($("v-home").classList.contains("on")){ renderNow(); renderScore(); renderToday(); }
    alertBlocks(); checkRitual();
  }
}
setInterval(tick, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden){ tickClock(); renderAll(); checkRitual(); } });

function renderAll(){
  renderHome();
  if ($("v-plan").classList.contains("on")) renderPlan();
  if ($("v-life").classList.contains("on")) renderLife();
}
fillProfile(); renderFixed(); fillAi(); notifState();
renderAll(); renderLog();
switchView(store.get("tab", "home"));
setTimeout(checkRitual, 1200);
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
