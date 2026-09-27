(function(){
"use strict";

/* =====================================================================
   Pulse Life: a personal AI that learns who you are, then builds and
   runs your life plan. Claude runs through the viewer's own claude.ai
   account (sample capability); data lives in the artifact's private db.
   ===================================================================== */

const PL = window.PulsePlanner;
const I18N = window.PULSE_I18N;
const $ = id => document.getElementById(id);
function h(tag, attrs){
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs){ const v = attrs[k]; if (v == null || v === false) continue;
    if (k === "class") e.className = v; else if (k === "style") e.style.cssText = v; else if (k === "text") e.textContent = v; else if (k === "html") e.innerHTML = v;
    else if (k.slice(0,2) === "on") e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v); }
  for (let i = 2; i < arguments.length; i++){ [].concat(arguments[i]).forEach(c => { if (c == null || c === false) return; e.append(c.nodeType ? c : String(c)); }); }
  return e;
}
const NS = "http://www.w3.org/2000/svg";
function s(tag, attrs, kids){ const e = document.createElementNS(NS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); (kids || []).forEach(c => e.appendChild(c)); return e; }
const ICON = {
  today:'<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>',
  plan:'<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  growth:'<path d="M12 21v-9"/><path d="M12 12c0-4 3-6.5 7.5-6.5 0 4.3-3 6.5-7.5 6.5z"/><path d="M12 14.5c0-3.2-2.4-5.3-6.5-5.3 0 3.6 2.6 5.3 6.5 5.3z"/>',
  you:'<circle cx="12" cy="8.2" r="3.8"/><path d="M4.5 20.5c1.2-3.9 4.1-5.8 7.5-5.8s6.3 1.9 7.5 5.8"/>',
  back:'<path d="M15 5l-7 7 7 7"/>', send:'<path d="M4 12l16-8-6 16-2.5-6.5z"/>', plus:'<path d="M12 5v14M5 12h14"/>', x:'<path d="M6 6l12 12M18 6L6 18"/>',
  spark:'<path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  play:'<path d="M8 5l11 7-11 7z"/>', check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>', stop:'<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>'
};
function icon(name, size){ const e = document.createElementNS(NS, "svg"); e.setAttribute("viewBox", "0 0 24 24"); e.setAttribute("width", size || 22); e.setAttribute("height", size || 22); e.setAttribute("fill", "none"); e.setAttribute("stroke", "currentColor"); e.setAttribute("stroke-width", "1.7"); e.setAttribute("stroke-linecap", "round"); e.setAttribute("stroke-linejoin", "round"); e.setAttribute("aria-hidden", "true"); e.innerHTML = ICON[name] || ""; return e; }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const pad = n => String(n).padStart(2, "0");
const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- local storage (cache + fallback) ---------- */
const LS = {
  get(k, d){ try { const v = localStorage.getItem("pulselife." + k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem("pulselife." + k, JSON.stringify(v)); } catch(e){} },
  del(k){ try { localStorage.removeItem("pulselife." + k); } catch(e){} }
};

/* ---------- language ---------- */
let lang = LS.get("lang", "ka");
function t(k, vars){
  let v = (I18N[lang] && I18N[lang][k] != null) ? I18N[lang][k] : (I18N.en[k] != null ? I18N.en[k] : k);
  if (vars) v = v.replace(/\{(\w+)\}/g, (m, x) => vars[x] != null ? vars[x] : "");
  return v;
}
const LANG_NAME = {ka:"Georgian", en:"English"};

/* ---------- time ---------- */
function isoOf(d){ return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()); }
function now(){ const d = new Date(); return {d, date:isoOf(d), ym:isoOf(d).slice(0,7), h:d.getHours(), min:d.getHours()*60 + d.getMinutes() + d.getSeconds()/60, hm:pad(d.getHours()) + ":" + pad(d.getMinutes())}; }
let T = now();
const addDays = PL.addDays, toMin = PL.toMin, fromMin = PL.fromMin, dowOf = PL.dow;
function daysBetween(a, b){ return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000); }
function locale(){ return lang === "ka" ? "ka-GE" : "en-GB"; }
function fmt(iso, opts){ try { return new Date(iso + "T12:00:00Z").toLocaleDateString(locale(), Object.assign({timeZone:"UTC"}, opts)); } catch(e){ return iso; } }
function dayName(iso, long){ return fmt(iso, {weekday: long ? "long" : "short"}); }
function dayLabel(iso){ return fmt(iso, {weekday:"long", day:"numeric", month:"long"}); }
function monthLabel(ym){ return fmt(ym + "-15", {month:"long", year:"numeric"}); }
function prevMonth(ym){ let [y, m] = ym.split("-").map(Number); m--; if (!m){ m = 12; y--; } return y + "-" + pad(m); }
const DOW_ORDER = [1,2,3,4,5,6,0];
function dowShort(i){ return dayName(addDays("2026-10-04", i)).replace(/\.$/, ""); } /* 2026-10-04 is a Sunday */

/* ---------- vocab ---------- */
const DOMAINS = ["story","daily","body","work","money","people","mind","values","shadows","dreams"];
const AREAS = ["business","health","finance","learning","relationships","mind","home","other"];
const MOODS = {
  dawn:      {m1:"#8FB3FF", m2:"#FFB199", m3:"#C9A7FF"},
  calm:      {m1:"#5CC8C0", m2:"#6E8BFF", m3:"#A8E6CF"},
  energized: {m1:"#FFB347", m2:"#FF6F61", m3:"#FFD86E"},
  focused:   {m1:"#7B6CFF", m2:"#39A9F2", m3:"#B8AEFF"},
  joyful:    {m1:"#FF78B4", m2:"#FFC24B", m3:"#FFA3CF"},
  low:       {m1:"#9DA9DA", m2:"#C4B3E6", m3:"#8AA0C8"},
  stressed:  {m1:"#78C9A4", m2:"#C5E3A0", m3:"#5FA994"}
};
const MOOD_KEYS = ["joyful","energized","focused","calm","low","stressed"];

/* ---------- state ---------- */
function freshCore(){
  return {v:3, name:"", createdAt:Date.now(), updatedAt:0,
    interview:{done:false, turns:0, coverage:{}},
    facts:[], rhythm:{wake:"07:00", sleep:"23:30", peak:"morning", restDay:0},
    fixed:[], routine:[], habits:[], goals:[], programs:[],
    dossier:null, vision:null, rules:[], genesis:{}, mood:{key:null, at:0}, settings:{depth:"fast"}};
}
const S = {
  uid:null,
  core: Object.assign(freshCore(), LS.get("core", {})),
  chat: Object.assign({interview:[], coach:[], updatedAt:0}, LS.get("chat", {})),
  pages: Object.assign({list:[], updatedAt:0}, LS.get("pages", {})),
  months: {}, days: {}
};
(LS.get("idx", []) || []).forEach(n => { const v = LS.get(n, null); if (!v) return; if (n.slice(0,2) === "m-") S.months[n.slice(2)] = v; if (n.slice(0,2) === "d-") S.days[n.slice(2)] = v; });
function month(ym){ return S.months[ym] || (S.months[ym] = {items:[], weeks:[], rules:[], summary:"", source:"", text:"", updatedAt:0}); }
function dayRec(date){ const ym = date.slice(0,7); const m = S.days[ym] || (S.days[ym] = {d:{}, updatedAt:0}); return m.d[date] || (m.d[date] = {done:{}}); }
function peekDay(date){ const m = S.days[date.slice(0,7)]; return m && m.d[date] || null; }

/* ---------- persistence: localStorage now, private db when available ---------- */
let db = null, syncState = "local";
const dirty = new Set(); let saveTimer = null, flushing = false;
function docFor(name){ if (name === "core") return S.core; if (name === "chat") return S.chat; if (name === "pages") return S.pages; if (name.slice(0,2) === "m-") return S.months[name.slice(2)]; if (name.slice(0,2) === "d-") return S.days[name.slice(2)]; return null; }
function save(name){
  const o = docFor(name); if (!o) return;
  o.updatedAt = Date.now();
  LS.set(name, o);
  if (name.slice(0,2) === "m-" || name.slice(0,2) === "d-"){ const idx = LS.get("idx", []); if (!idx.includes(name)){ idx.push(name); LS.set("idx", idx); } }
  dirty.add(name); clearTimeout(saveTimer); saveTimer = setTimeout(flush, 900);
}
const saveMonth = ym => save("m-" + ym), saveDay = date => save("d-" + date.slice(0,7));
async function flush(){
  if (!db || !S.uid || flushing) return;
  flushing = true; setSync("saving");
  try {
    for (const n of [...dirty]){
      dirty.delete(n);
      const o = docFor(n); if (!o) continue;
      try { await db.doc("data/users/" + S.uid + "/" + n).set(clone(o)); }
      catch(e){ if (e && (e.code === "unavailable" || e.code === "resource_exhausted")) dirty.add(n); else { console.warn("save failed", n, e); setSync("error"); } }
    }
  } finally {
    flushing = false;
    if (dirty.size){ saveTimer = setTimeout(flush, 4000); } else if (syncState !== "error") setSync("synced");
  }
}
function setSync(st){ syncState = st; const el = $("syncDot"); if (el){ el.dataset.state = st; el.title = t("sync_" + st); } }
async function connectCloud(){
  if (!window.claude || !claude.use) return;
  try {
    const [d, u] = await Promise.all([claude.use("db"), claude.use("user")]);
    if (!d || !u) return;
    const id = await u.id(); if (!id) return;
    db = d; S.uid = id; setSync("saving");
    const snap = await db.collection("data/users/" + id).get();
    let changed = false;
    snap.docs.forEach(doc => {
      const r = doc.data(); if (!r) return; const n = doc.id; const local = docFor(n);
      if (!local || (r.updatedAt || 0) > (local.updatedAt || 0)){
        if (n === "core") S.core = Object.assign(freshCore(), r);
        else if (n === "chat") S.chat = Object.assign({interview:[], coach:[]}, r);
        else if (n === "pages") S.pages = Object.assign({list:[]}, r);
        else if (n.slice(0,2) === "m-") S.months[n.slice(2)] = r;
        else if (n.slice(0,2) === "d-") S.days[n.slice(2)] = r;
        LS.set(n, r); changed = true;
      } else if ((local.updatedAt || 0) > (r.updatedAt || 0)) dirty.add(n);
    });
    ["core","chat","pages"].forEach(n => { if (!snap.docs.some(d0 => d0.id === n) && (docFor(n).updatedAt || 0) > 0) dirty.add(n); });
    Object.keys(S.months).forEach(k => { if (!snap.docs.some(d0 => d0.id === "m-" + k)) dirty.add("m-" + k); });
    Object.keys(S.days).forEach(k => { if (!snap.docs.some(d0 => d0.id === "d-" + k)) dirty.add("d-" + k); });
    setSync("synced");
    if (dirty.size) flush();
    if (changed){ applyMood(); route(); }
  } catch(e){ console.warn("cloud unavailable", e); setSync("local"); }
}

/* ---------- AI: claude.ai (artifact) or the person's own free key (phone app) ---------- */
let sampler = null, aiState = "wait"; /* wait | ok | none | denied */
let busy = 0;
function setBusy(d){ busy = Math.max(0, busy + d); document.body.classList.toggle("thinking", busy > 0); }
if (window.claude && claude.use){ claude.use("sample").then(fn => { sampler = fn; aiState = fn ? "ok" : "none"; route(); }).catch(() => { aiState = "none"; route(); }); }
else aiState = "none";
const PROVIDERS = {
  gemini:{label:"Google Gemini", free:true, keyUrl:"https://aistudio.google.com/apikey", models:["gemini-flash-latest","gemini-2.5-flash","gemini-2.0-flash"]},
  openrouter:{label:"OpenRouter", free:true, keyUrl:"https://openrouter.ai/keys", url:"https://openrouter.ai/api/v1/chat/completions", models:["deepseek/deepseek-chat-v3-0324:free","meta-llama/llama-3.3-70b-instruct:free"]},
  groq:{label:"Groq", free:true, keyUrl:"https://console.groq.com/keys", url:"https://api.groq.com/openai/v1/chat/completions", models:["llama-3.3-70b-versatile"]},
  claude:{label:"Claude API", free:false, keyUrl:"https://console.anthropic.com/settings/keys", models:["claude-opus-5"]}
};
let aiCfg = Object.assign({provider:"gemini", key:"", model:""}, LS.get("ai", {}));
function keyMode(){ return !(aiState === "ok" && sampler) && !!aiCfg.key; }
function aiReady(){ return (aiState === "ok" && !!sampler) || !!aiCfg.key; }
function errText(e){
  const c = e && e.code;
  if (c === "not_granted" || c === "sampling_disabled" || c === "not_declared" || c === "capability_disabled" || c === "capability_removed"){ aiState = "denied"; return t("err_denied"); }
  if (c === "no_key") return t("err_nokey");
  if (c === "bad_key") return t("err_key");
  if (c === "net") return t("err_net");
  if (c === "rate_limited") return t("err_rate");
  if (c === "session_expired") return t("err_session");
  if (c === "refused") return t("err_refused");
  if (c === "prompt_too_large") return t("err_big");
  if (c === "invalid_json") return t("err_json");
  if (c === "cancelled") return "";
  return t("err_generic") + (e && e.message && keyMode() ? " (" + String(e.message).slice(0, 120) + ")" : "");
}
function parseLoose(text){
  let x = String(text || "").trim();
  const fence = x.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) x = fence[1].trim();
  try { return JSON.parse(x); } catch(e){}
  const a = x.search(/[\[{]/), b = Math.max(x.lastIndexOf("}"), x.lastIndexOf("]"));
  if (a >= 0 && b > a){ try { return JSON.parse(x.slice(a, b + 1)); } catch(e){} }
  throw {code:"invalid_json", text};
}
function toTurns(input){
  const turns = typeof input === "string" ? [{role:"user", content:input}] : input.slice();
  const out = [];
  turns.forEach(m => { const role = m.role === "assistant" ? "assistant" : "user"; if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += "\n\n" + m.content; else out.push({role, content:String(m.content)}); });
  if (!out.length || out[0].role !== "user") out.unshift({role:"user", content:"(start)"});
  return out;
}
async function httpJSON(url, init){
  let r;
  try { r = await fetch(url, init); } catch(e){ if (e && e.name === "AbortError") throw {code:"cancelled"}; throw {code:"net", message:String(e && e.message || e)}; }
  let j = null; try { j = await r.json(); } catch(e){}
  if (!r.ok){
    const msg = (j && (j.error && (j.error.message || j.error.status) || j.message)) || ("HTTP " + r.status);
    if (r.status === 401 || r.status === 403 || (r.status === 400 && /api.?key|API_KEY/i.test(msg))) throw {code:"bad_key", message:msg};
    if (r.status === 429) throw {code:"rate_limited", message:msg};
    if (r.status === 404) throw {code:"no_model", message:msg};
    if (r.status === 413) throw {code:"prompt_too_large", message:msg};
    throw {code:"upstream_error", message:msg};
  }
  return j || {};
}
async function callKey(input, opt){
  const P = PROVIDERS[aiCfg.provider] || PROVIDERS.gemini, turns = toTurns(input);
  const jsonHint = opt.json ? "\n\n(Output: one valid JSON value only, no markdown fences, no commentary.)" : "";
  turns[turns.length - 1].content += jsonHint;
  const models = aiCfg.model ? [aiCfg.model].concat(P.models) : P.models;
  let lastErr = null;
  for (const model of [...new Set(models)]){
    try {
      let text = "";
      if (aiCfg.provider === "gemini" || !PROVIDERS[aiCfg.provider]){
        const body = {contents:turns.map(m => ({role:m.role === "assistant" ? "model" : "user", parts:[{text:m.content}]})), generationConfig:Object.assign({temperature:0.8, maxOutputTokens:32768}, opt.json ? {responseMimeType:"application/json"} : {})};
        const j = await httpJSON("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(aiCfg.key), {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body), signal:opt.signal});
        const cand = (j.candidates || [])[0];
        if (!cand){ if (j.promptFeedback && j.promptFeedback.blockReason) throw {code:"refused"}; throw {code:"upstream_error", message:"empty answer"}; }
        if (cand.finishReason === "SAFETY" || cand.finishReason === "PROHIBITED_CONTENT") throw {code:"refused"};
        text = ((cand.content && cand.content.parts) || []).filter(p => !p.thought).map(p => p.text || "").join("");
      } else if (aiCfg.provider === "claude"){
        const body = {model, max_tokens:16000, messages:turns};
        const headers = {"content-type":"application/json", "x-api-key":aiCfg.key, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true"};
        if (model === "claude-opus-5"){ body.fallbacks = "default"; headers["anthropic-beta"] = "server-side-fallback-2026-07-01"; }
        const j = await httpJSON("https://api.anthropic.com/v1/messages", {method:"POST", headers, body:JSON.stringify(body), signal:opt.signal});
        if (j.stop_reason === "refusal") throw {code:"refused"};
        text = (j.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      } else {
        const body = {model, messages:turns, temperature:0.8};
        if (opt.json && aiCfg.provider === "groq") body.response_format = {type:"json_object"};
        const j = await httpJSON(P.url, {method:"POST", headers:{"content-type":"application/json", "authorization":"Bearer " + aiCfg.key}, body:JSON.stringify(body), signal:opt.signal});
        text = (((j.choices || [])[0] || {}).message || {}).content || "";
      }
      text = String(text).trim();
      if (!text) throw {code:"upstream_error", message:"empty answer"};
      if (opt.onText) try { opt.onText({text, delta:text}); } catch(e){}
      if (opt.json) return parseLoose(text);
      return {text, truncated:false};
    } catch(e){ lastErr = e; if (!e || e.code !== "no_model") throw e; }
  }
  throw lastErr || {code:"upstream_error"};
}
async function ask(input, opt){
  opt = opt || {};
  if (!aiReady()) throw {code: aiState === "denied" ? "not_granted" : "no_key", message:"no ai"};
  setBusy(1);
  try {
    if (aiState === "ok" && sampler){
      const o = {}; if (opt.tier) o.modelTier = opt.tier; if (opt.onText) o.onText = opt.onText; if (opt.signal) o.signal = opt.signal; if (opt.cache !== undefined) o.cache = opt.cache;
      return opt.json ? await sampler.json(input, o) : await sampler(input, o);
    }
    return await callKey(input, opt);
  } finally { setBusy(-1); }
}
function aiSetupCard(onDone){
  const card = h("section", {class:"card setup"});
  const sel = h("select", {class:"field", id:"aiProv"}, Object.keys(PROVIDERS).map(k => h("option", {value:k, text:PROVIDERS[k].label + (PROVIDERS[k].free ? " · " + t("free") : " · " + t("paid")), selected:aiCfg.provider === k ? true : null})));
  const key = h("input", {class:"field", id:"aiKey", type:"password", autocomplete:"off", placeholder:t("ai_key_ph"), value:aiCfg.key ? "••••••" + aiCfg.key.slice(-4) : ""});
  const model = h("input", {class:"field", id:"aiModel", autocomplete:"off", placeholder:t("ai_model_ph"), value:aiCfg.model || ""});
  const getKey = h("a", {class:"btn sm", href:PROVIDERS[aiCfg.provider].keyUrl, target:"_blank", rel:"noopener"}, t("ai_get_key"));
  sel.addEventListener("change", () => { getKey.href = PROVIDERS[sel.value].keyUrl; });
  const out = h("p", {class:"muted small"});
  const btn = h("button", {class:"btn primary", type:"button", onclick:async () => {
    const k = key.value.trim();
    const next = {provider:sel.value, key:/^•/.test(k) ? aiCfg.key : k, model:model.value.trim()};
    if (!next.key){ out.textContent = t("err_nokey"); return; }
    const prev = aiCfg; aiCfg = next;
    btn.disabled = true; out.textContent = t("ai_testing");
    try { await ask("Reply with the single word OK.", {tier:"quick", cache:false}); LS.set("ai", aiCfg); out.textContent = "✓ " + t("ai_ok"); toast(t("ai_ok"), PROVIDERS[aiCfg.provider].label); if (onDone) setTimeout(onDone, 500); }
    catch(e){ aiCfg = prev; out.textContent = "✗ " + errText(e); }
    finally { btn.disabled = false; }
  }}, t("ai_connect"));
  card.append(h("div", {class:"card-k"}, icon("spark", 16), t("ai_title")), h("p", {text:t("ai_sub")}),
    h("ol", {class:"setup-steps"}, h("li", {text:t("ai_s1")}), h("li", {text:t("ai_s2")}), h("li", {text:t("ai_s3")})),
    getKey, key, btn, out,
    h("details", {class:"fold"}, h("summary", {text:t("ai_more")}), h("div", {class:"stack tight", style:"margin-top:8px"}, sel, model, h("p", {class:"muted small", text:t("ai_more_note")}))));
  return card;
}
const langLine = () => "Write every human-readable string in " + LANG_NAME[lang] + (lang === "ka" ? " (Georgian script, natural modern Georgian)" : "") + ". If the person clearly writes in another language, mirror their language.";

/* ---------- life context for prompts ---------- */
function domainLabelEn(d){ return I18N.en["d_" + d] || d; }
function factsText(max){
  const out = [];
  DOMAINS.forEach(d => { const fs = S.core.facts.filter(f => f.d === d).slice(-Math.ceil(max / 6)); if (fs.length) out.push(domainLabelEn(d).toUpperCase() + ":\n" + fs.map(f => "- " + f.t).join("\n")); });
  return out.join("\n") || "(nothing yet)";
}
function routineText(){
  const rs = S.core.routine.concat(S.core.fixed.filter(f => !S.core.routine.some(r => r.src === f.id)));
  return rs.length ? rs.map(r => "- " + r.text + " " + r.start + "-" + r.end + " on " + (r.dows || []).map(i => PL.DOW_SHORT[i]).join("/") + (r.kind === "fixed" ? " [fixed]" : "")).join("\n") : "(none)";
}
function profileText(level){
  const c = S.core, d = c.dossier, lines = [];
  lines.push("Name: " + (c.name || "unknown") + ". Today: " + T.date + " (" + PL.DOW_SHORT[dowOf(T.date)] + ") " + T.hm + ".");
  lines.push("Rhythm: wakes " + c.rhythm.wake + ", sleeps " + c.rhythm.sleep + ", peak focus " + c.rhythm.peak + ", rest day " + PL.DOW_SHORT[c.rhythm.restDay] + ".");
  lines.push("WEEKLY ROUTINE AND FIXED COMMITMENTS:\n" + routineText());
  if (d) lines.push("PORTRAIT: " + [d.archetype, d.truth, d.summary].filter(Boolean).join(" | ") + "\nStrengths: " + (d.strengths || []).join("; ") + "\nShadows: " + (d.shadows || []).join("; ") + "\nValues: " + (d.values || []).join("; ") + "\nEnergy: " + (d.energy || "") + "\nMotivators: " + (d.motivators || []).join("; ") + "\nTriggers: " + (d.triggers || []).join("; "));
  if (c.vision) lines.push("VISION: " + (c.vision.statement || "") + (c.vision.pillars ? "\nPillars: " + c.vision.pillars.map(p => p.name).join(", ") : ""));
  if (c.goals.length) lines.push("GOALS:\n" + c.goals.map(g => "- " + g.text + " (" + (g.progress || 0) + "/" + g.target + " " + (g.unit || "") + (g.due ? ", due " + g.due : "") + ")").join("\n"));
  if (c.habits.length) lines.push("HABITS:\n" + c.habits.map(x => "- " + x.text + (x.time ? " at " + x.time : "") + " (streak " + streak(x) + ")").join("\n"));
  if (c.programs.length) lines.push("PROGRAMS:\n" + c.programs.map(p => "- " + p.title + ": day " + programDay(p) + "/" + p.days + ", phase " + ((currentPhase(p) || {}).name || "-")).join("\n"));
  if (c.rules.length) lines.push("OPERATING RULES: " + c.rules.join(" | "));
  lines.push("WHAT HE HAS TOLD PULSE:\n" + factsText(level === "full" ? 240 : 120));
  let out = lines.join("\n\n");
  const cap = level === "full" ? 30000 : 16000;
  return out.length > cap ? out.slice(0, cap) + "\n…" : out;
}
function recentText(n){
  const out = [];
  for (let i = n; i >= 1; i--){ const d = addDays(T.date, -i), r = peekDay(d); if (!r) continue; const b = blocksFor(d).filter(x => x.kind !== "fixed"); const done = b.filter(x => r.done && r.done[x.id]).length;
    out.push(d + ": " + done + "/" + b.length + " done" + (r.mood ? ", mood " + r.mood : "") + (r.energy ? ", energy " + r.energy + "/5" : "") + (r.sleep ? ", slept " + r.sleep + "h" : "") + (r.rating ? ", day " + r.rating + "/5" : "") + (r.win ? ", win: " + r.win : "") + (r.block ? ", blocker: " + r.block : "") + (r.focus ? ", focus " + r.focus + "m" : "")); }
  return out.join("\n") || "(no history yet)";
}
function scheduleText(from, n){
  const out = [];
  for (let i = 0; i < n; i++){ const d = addDays(from, i); const b = blocksFor(d); const r = peekDay(d) || {done:{}};
    out.push(d + " " + PL.DOW_SHORT[dowOf(d)] + ":\n" + (b.length ? b.map(x => "  [" + x.id + "] " + (x.time || "--:--") + " " + x.dur + "m " + x.text + (x.kind === "fixed" ? " (fixed)" : x.kind === "routine" ? " (routine)" : x.kind === "habit" ? " (habit)" : "") + (r.done && r.done[x.id] ? " ✓" : "")).join("\n") : "  (empty)")); }
  return out.join("\n");
}

/* ---------- day model ---------- */
function blocksFor(date){
  const d = dowOf(date), out = [];
  const seen = new Set();
  S.core.routine.forEach(r => { if ((r.dows || []).includes(d) && r.start){ out.push({id:"r:" + r.id, time:r.start, dur:Math.max(5, toMin(r.end) - toMin(r.start)) || 30, text:r.text, area:r.area || "other", kind:r.kind === "fixed" ? "fixed" : "routine"}); if (r.src) seen.add(r.src); } });
  S.core.fixed.forEach(f => { if (!seen.has(f.id) && (f.dows || []).includes(d) && f.start) out.push({id:"f:" + f.id, time:f.start, dur:Math.max(5, toMin(f.end) - toMin(f.start)) || 30, text:f.text, area:f.area || "other", kind:"fixed"}); });
  S.core.habits.forEach(x => { if (x.time && (!x.dows || !x.dows.length || x.dows.includes(d))) out.push({id:"h:" + x.id, time:x.time, dur:x.dur || 15, text:x.text, area:x.area || "other", kind:"habit"}); });
  (S.months[date.slice(0,7)] || {items:[]}).items.filter(i => i.date === date).forEach(i => out.push({id:i.id, time:i.time || null, dur:i.dur || 30, text:i.text, area:i.area || "other", kind:i.kind || "task", star:i.star, prio:i.prio}));
  return out.sort((a, b) => String(a.time || "99").localeCompare(String(b.time || "99")));
}
function isDone(date, id){ const r = peekDay(date); return !!(r && r.done && r.done[id]); }
function setDone(date, id, v){
  const r = dayRec(date); if (v) r.done[id] = 1; else delete r.done[id];
  if (id.slice(0,2) === "h:"){ const x = S.core.habits.find(y => "h:" + y.id === id); if (x){ x.log = x.log || {}; if (v) x.log[date] = 1; else delete x.log[date]; save("core"); } }
  saveDay(date);
}
function currentBlock(){
  const list = blocksFor(T.date).filter(b => b.time);
  const cur = list.find(b => toMin(b.time) <= T.min && T.min < toMin(b.time) + b.dur && !isDone(T.date, b.id));
  const next = list.find(b => toMin(b.time) > T.min && !isDone(T.date, b.id));
  return {cur, next};
}
function dayScore(date){
  const r = peekDay(date), b = blocksFor(date).filter(x => x.kind !== "fixed");
  const parts = [];
  if (b.length && (r || date === T.date)) parts.push([b.filter(x => r && r.done[x.id]).length / b.length, .5]);
  const pa = programActionsFor(date); if (pa.length && r) parts.push([pa.filter(a => r.done[a.id]).length / pa.length, .2]);
  if (r && r.energy) parts.push([((r.energy || 3) + (r.moodScore || 3)) / 10, .15]);
  if (r && r.rating) parts.push([r.rating / 5, .15]);
  if (!parts.length || !r) return null;
  const w = parts.reduce((a, p) => a + p[1], 0);
  return Math.round(100 * parts.reduce((a, p) => a + p[0] * p[1], 0) / w);
}
function weekScore(){ const xs = []; for (let i = 0; i < 7; i++){ const v = dayScore(addDays(T.date, -i)); if (v != null) xs.push(v); } return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null; }
function streak(x){ const log = x.log || {}; let d = log[T.date] ? T.date : addDays(T.date, -1), n = 0; while (log[d]){ n++; d = addDays(d, -1); } return n; }
function programDay(p){ return clamp(daysBetween(p.start || T.date, T.date) + 1, 1, p.days || 30); }
function currentPhase(p){ let d = programDay(p), acc = 0; for (const ph of p.phases || []){ acc += ph.days || 7; if (d <= acc) return ph; } return (p.phases || [])[(p.phases || []).length - 1]; }
function programActionsFor(date){
  const out = [];
  S.core.programs.forEach(p => { if (p.paused || !p.start || date < p.start || daysBetween(p.start, date) >= (p.days || 30)) return; const ph = (function(){ let d = daysBetween(p.start, date) + 1, acc = 0; for (const x of p.phases || []){ acc += x.days || 7; if (d <= acc) return x; } return null; })(); if (!ph) return; (ph.actions || []).forEach((a, i) => out.push({id:"p:" + p.id + ":" + i, text:a, program:p.title, area:p.area || "mind"})); });
  return out;
}
function effectiveMood(){
  const r = peekDay(T.date);
  if (r && r.mood && MOODS[r.mood]) return r.mood;
  if (S.core.mood && S.core.mood.key && Date.now() - S.core.mood.at < 6 * 3600000) return S.core.mood.key;
  return T.h < 11 ? "dawn" : T.h < 17 ? "focused" : T.h < 21 ? "calm" : "low";
}
function applyMood(){
  const m = MOODS[effectiveMood()] || MOODS.dawn, r = document.documentElement.style;
  r.setProperty("--m1", m.m1); r.setProperty("--m2", m.m2); r.setProperty("--m3", m.m3);
  document.documentElement.dataset.mood = effectiveMood();
}

/* ---------- ui primitives ---------- */
let toastT = null;
function toast(title, body, ms){
  const el = $("toast"); el.innerHTML = ""; el.append(h("b", {text:title}), body ? h("span", {text:body}) : null); el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, ms || 4500);
}
function chips(values, cur, pick, labels, cls){
  return h("div", {class:"chips " + (cls || "")}, values.map((v, i) => h("button", {type:"button", class:"chip", "aria-pressed":String(cur === v), onclick:() => pick(v)}, labels ? labels[i] : String(v))));
}
function ring(pct, size, stroke, label, sub){
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const sv = s("svg", {viewBox:"0 0 " + size + " " + size, class:"ring-svg"}, [
    s("circle", {cx:size/2, cy:size/2, r, fill:"none", stroke:"var(--line2)", "stroke-width":stroke}),
    s("circle", {cx:size/2, cy:size/2, r, fill:"none", stroke:"url(#gradMood)", "stroke-width":stroke, "stroke-linecap":"round", "stroke-dasharray":c, "stroke-dashoffset":c * (1 - clamp(pct || 0, 0, 100) / 100), transform:"rotate(-90 " + size/2 + " " + size/2 + ")", class:"ring-arc"})
  ]);
  return h("div", {class:"ring", style:"width:" + size + "px;height:" + size + "px"}, sv, h("div", {class:"ring-c"}, h("b", {text:label}), sub ? h("small", {text:sub}) : null));
}
function orb(cls){ return h("div", {class:"orb " + (cls || ""), "aria-hidden":"true"}, h("i"), h("i"), h("i"), h("span")); }
function sectionTitle(txt, extra){ return h("div", {class:"sec"}, h("h2", {text:txt}), extra || null); }
function empty(txt){ return h("p", {class:"muted", text:txt}); }
function areaStyle(a){ return "--area:var(--ar-" + (AREAS.includes(a) ? a : "other") + ")"; }
function confirmInline(btn, label, fn){
  if (btn.dataset.armed){ fn(); return; }
  const old = btn.textContent; btn.dataset.armed = "1"; btn.textContent = label; btn.classList.add("danger");
  setTimeout(() => { if (btn.isConnected){ delete btn.dataset.armed; btn.textContent = old; btn.classList.remove("danger"); } }, 3500);
}

/* ---------- routing ---------- */
let view = LS.get("view", "today"), sub = null, subArg = null;
function go(v, s0, arg){ view = v; sub = s0 || null; subArg = arg || null; LS.set("view", v); route(); window.scrollTo(0, 0); }
function route(){
  T = now(); applyMood();
  const main = $("main"); if (!main) return;
  const needsGenesis = !S.core.interview.done;
  document.body.classList.toggle("genesis-mode", needsGenesis || view === "genesis" || view === "building");
  $("tabs").hidden = needsGenesis || view === "genesis" || view === "building";
  document.querySelectorAll("#tabs [data-v]").forEach(b => b.setAttribute("aria-current", b.dataset.v === view ? "page" : "false"));
  main.innerHTML = "";
  if (view === "building") return renderBuilding(main);
  if (needsGenesis || view === "genesis") return renderGenesis(main);
  renderHeader();
  if (sub === "page") return renderPage(main, subArg);
  if (view === "today") return renderToday(main);
  if (view === "plan") return renderPlan(main);
  if (view === "coach") return renderCoach(main);
  if (view === "growth") return renderGrowth(main);
  if (view === "you") return renderYou(main);
  view = "today"; renderToday(main);
}
function renderHeader(){
  const hd = $("hdr"); hd.innerHTML = "";
  const greet = T.h < 5 ? t("g_night") : T.h < 12 ? t("g_morning") : T.h < 18 ? t("g_day") : t("g_evening");
  const mood = effectiveMood();
  hd.append(
    h("button", {class:"hdr-orb", type:"button", "aria-label":t("tab_coach"), onclick:() => go("coach")}, orb("sm")),
    h("div", {class:"hdr-t"}, h("div", {class:"hdr-k", text:dayLabel(T.date)}), h("div", {class:"hdr-n", text:greet + (S.core.name ? ", " + S.core.name : "")})),
    h("button", {class:"mood-pill", type:"button", onclick:openMoodSheet}, h("i", {class:"mdot"}), t("mood_" + mood)),
    h("span", {id:"syncDot", class:"sync", "data-state":syncState, title:t("sync_" + syncState)})
  );
}

/* =====================================================================
   GENESIS: the get-to-know-you conversation
   ===================================================================== */
let genCtl = null;
function interviewRules(){
  const cov = S.core.interview.coverage || {};
  return [
    "You are Pulse, a deeply perceptive personal AI with one mission: to change this person's life for the better by truly knowing them. Right now you are in the GET-TO-KNOW-YOU conversation that comes before any planning.",
    "How you talk: warm, calm, curious, direct, never clinical, never judging. Each message: at most one short reflection of what you heard (specific, not flattering), then exactly ONE question. Under 80 words. Go deep: follow the thread they give you, ask for concrete examples, times, numbers, feelings and reasons. When a domain is well understood, move to the least covered one with a natural bridge. Do not give advice or plans yet; your job now is to understand.",
    "The ten domains: story (life story, origins, turning points), daily (a real weekday and weekend hour by hour, work hours, commute, fixed commitments such as training days and times), body (health, sleep, training, food, energy), work (job or business, projects, ambitions), money (income, spending, debts, savings, goals), people (family, partner, friends, loneliness), mind (emotions, stress, anxiety, what calms him), values (beliefs, worldview, ideology, faith, principles), shadows (flaws, bad habits, addictions, procrastination and self-sabotage patterns), dreams (vision, goals, what success means, who he wants to become).",
    langLine(),
    "WHAT YOU ALREADY KNOW:\n" + factsText(200),
    "Rhythm so far: wake " + S.core.rhythm.wake + ", sleep " + S.core.rhythm.sleep + ", peak " + S.core.rhythm.peak + ". Fixed commitments so far:\n" + (S.core.fixed.map(f => "- " + f.text + " " + f.start + "-" + f.end + " " + f.dows.map(i => PL.DOW_SHORT[i]).join("/")).join("\n") || "(none)"),
    "Coverage so far (0-100): " + DOMAINS.map(d => d + " " + (cov[d] || 0)).join(", ") + ". Questions asked: " + (S.core.interview.turns || 0) + ".",
    "After the conversation below, reply with ONLY one JSON object: {\"reply\": string, \"name\": string or null, \"facts\": [{\"d\": domain key, \"t\": string}], \"rhythm\": {\"wake\": \"HH:MM\" or null, \"sleep\": \"HH:MM\" or null, \"peak\": \"morning\"|\"afternoon\"|\"evening\"|null, \"restDay\": 0-6 or null}, \"fixed\": [{\"text\": string, \"dows\": [0-6, 0 = Sunday], \"start\": \"HH:MM\", \"end\": \"HH:MM\", \"area\": one of " + AREAS.join("|") + "}], \"coverage\": {each of the ten domain keys: 0-100}, \"ready\": boolean}.",
    "facts: only NEW information from his latest message, each a short self-contained sentence in his language (e.g. \"Trains at the gym Monday to Saturday, 07:00-08:30\"). fixed: recurring weekly commitments he stated with days and times; include each once, only when new. ready: true only when every domain is at least 60. The reply is what he sees."
  ].join("\n\n");
}
function genesisOpening(){ return t("gen_open"); }
function renderGenesis(main){
  const c = S.core, chat = S.chat.interview;
  if (!chat.length){ chat.push({r:"a", t:genesisOpening(), at:Date.now()}); save("chat"); }
  const cov = c.interview.coverage || {};
  const avg = Math.round(DOMAINS.reduce((a, d) => a + (cov[d] || 0), 0) / DOMAINS.length);
  const wrap = h("div", {class:"gen"});
  const top = h("div", {class:"gen-top"},
    h("div", {class:"gen-brand"}, orb("md"), h("div", null, h("div", {class:"eyebrow", text:t("gen_eyebrow")}), h("h1", {class:"gen-h", text:c.interview.done ? t("gen_more_title") : t("gen_title")}))),
    h("div", {class:"gen-map"}, DOMAINS.map(d => h("div", {class:"gm", style:"--p:" + (cov[d] || 0)}, h("i"), h("span", {text:t("d_" + d)})))),
    h("div", {class:"gen-bar"}, h("div", {class:"gen-bar-f", style:"width:" + avg + "%"}), h("span", {text:t("gen_known", {p:avg})}))
  );
  const log = h("div", {class:"gen-log", id:"genLog", "aria-live":"polite"});
  chat.slice(-60).forEach(m => log.append(bubble(m.r, m.t)));
  const ta = h("textarea", {id:"genIn", class:"gen-in", rows:"2", placeholder:t("gen_ph")});
  ta.value = LS.get("genDraft", "");
  ta.addEventListener("input", () => { LS.set("genDraft", ta.value); autoGrow(ta); });
  ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer:fine)").matches){ e.preventDefault(); send(); } });
  const sendBtn = h("button", {class:"send", type:"button", "aria-label":t("send"), onclick:() => send()}, icon("send"));
  const note = h("p", {class:"gen-note", id:"genNote"});
  const buildBtn = h("button", {class:"btn primary", type:"button", id:"buildBtn", onclick:startBuild}, icon("spark", 18), c.interview.done ? t("gen_rebuild") : t("gen_build"));
  const enough = (c.interview.turns || 0) >= 8 || avg >= 45;
  buildBtn.hidden = !enough;
  const doneBtn = c.interview.done ? h("button", {class:"btn ghost", type:"button", onclick:() => go("you")}, t("back_to_app")) : null;
  if (!aiReady() && aiState !== "wait"){
    wrap.append(top, aiSetupCard(() => route()), h("p", {class:"muted small center", text:t("ai_skip_note")}), h("button", {class:"btn ghost sm", type:"button", onclick:startBuild}, t("ai_skip")));
    main.append(wrap); return;
  }
  wrap.append(top, log, h("div", {class:"gen-dock"}, h("div", {class:"composer"}, ta, sendBtn), note, h("div", {class:"row gap"}, buildBtn, doneBtn)));
  main.append(wrap);
  requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; window.scrollTo(0, document.body.scrollHeight); autoGrow(ta); });
  async function send(){
    const txt = ta.value.trim(); if (!txt || busy) return;
    if (!aiReady()){ note.textContent = aiState === "wait" ? t("ai_wait") : t("err_nokey"); return; }
    chat.push({r:"u", t:txt, at:Date.now()}); save("chat");
    ta.value = ""; LS.set("genDraft", ""); autoGrow(ta);
    log.append(bubble("u", txt));
    const typing = bubble("a", ""); typing.classList.add("typing"); typing.querySelector(".bt").append(h("span", {class:"dots"}, h("i"), h("i"), h("i")));
    log.append(typing); log.scrollTop = log.scrollHeight; window.scrollTo(0, document.body.scrollHeight);
    sendBtn.disabled = true; note.textContent = "";
    const turns = [{role:"user", content:interviewRules()}].concat(chat.slice(-24).map(m => ({role:m.r === "u" ? "user" : "assistant", content:m.t})));
    genCtl = new AbortController();
    try {
      const j = await ask(turns, {json:true, tier:S.core.settings.depth === "deep" ? "default" : "quick", cache:false, signal:genCtl.signal});
      absorbInterview(j);
      const reply = (j && j.reply ? String(j.reply) : t("gen_fallback_q")).trim();
      chat.push({r:"a", t:reply, at:Date.now()}); save("chat"); save("core");
      route();
    } catch(e){
      typing.remove(); const msg = errText(e); if (msg) note.textContent = msg;
      ta.value = txt; LS.set("genDraft", txt); chat.pop(); save("chat");
      log.lastChild && log.lastChild.remove();
    } finally { sendBtn.disabled = false; }
  }
}
function bubble(r, text){ return h("div", {class:"b " + (r === "u" ? "me" : "ai")}, h("div", {class:"bt", text})); }
function autoGrow(ta){ ta.style.height = "auto"; ta.style.height = Math.min(220, ta.scrollHeight + 2) + "px"; }
function normTime(v){ const m = String(v || "").match(/^(\d{1,2}):(\d{2})/); if (!m) return null; const hh = +m[1], mm = +m[2]; return hh < 24 && mm < 60 ? pad(hh) + ":" + pad(mm) : null; }
function normDows(a){ return [...new Set((Array.isArray(a) ? a : []).map(Number).filter(n => n >= 0 && n <= 6))].sort(); }
function normArea(a){ return AREAS.includes(a) ? a : "other"; }
function absorbInterview(j){
  if (!j || typeof j !== "object") return;
  const c = S.core;
  if (j.name && !c.name) c.name = String(j.name).slice(0, 40);
  (Array.isArray(j.facts) ? j.facts : []).forEach(f => { if (!f || !f.t) return; const d = DOMAINS.includes(f.d) ? f.d : "story"; const tx = String(f.t).slice(0, 300); if (!c.facts.some(x => x.t === tx)) c.facts.push({id:uid(), d, t:tx, at:Date.now()}); });
  if (c.facts.length > 400) c.facts = c.facts.slice(-400);
  const r = j.rhythm || {};
  if (normTime(r.wake)) c.rhythm.wake = normTime(r.wake);
  if (normTime(r.sleep)) c.rhythm.sleep = normTime(r.sleep);
  if (["morning","afternoon","evening"].includes(r.peak)) c.rhythm.peak = r.peak;
  if (r.restDay != null && r.restDay >= 0 && r.restDay <= 6) c.rhythm.restDay = +r.restDay;
  (Array.isArray(j.fixed) ? j.fixed : []).forEach(f => {
    const st = normTime(f.start), en = normTime(f.end), dw = normDows(f.dows);
    if (!f.text || !st || !en || !dw.length || toMin(en) <= toMin(st)) return;
    const same = c.fixed.find(x => x.text.toLowerCase() === String(f.text).toLowerCase());
    if (same){ same.start = st; same.end = en; same.dows = dw; }
    else c.fixed.push({id:uid(), text:String(f.text).slice(0, 80), start:st, end:en, dows:dw, area:normArea(f.area), kind:"fixed"});
  });
  if (j.coverage && typeof j.coverage === "object") DOMAINS.forEach(d => { const v = Number(j.coverage[d]); if (!isNaN(v)) c.interview.coverage[d] = Math.max(c.interview.coverage[d] || 0, clamp(Math.round(v), 0, 100)); });
  c.interview.turns = (c.interview.turns || 0) + 1;
  if (j.ready) c.interview.ready = true;
}

/* =====================================================================
   BUILD: turn what Pulse knows into a whole life system
   ===================================================================== */
const BUILD_STEPS = ["portrait","system","month","pages"];
let buildState = null;
function startBuild(){ if (busy) return; buildState = {step:0, status:{}, errors:{}, local:!aiReady()}; go("building"); runBuild(); }
function renderBuilding(main){
  const bs = buildState || {step:0, status:{}, errors:{}};
  const wrap = h("div", {class:"build"});
  wrap.append(orb("xl"), h("div", {class:"eyebrow", text:t("build_eyebrow")}), h("h1", {class:"build-h", text:bs.done ? t("build_done") : t("build_title")}));
  const list = h("ol", {class:"build-steps"});
  BUILD_STEPS.forEach((k, i) => { const st = bs.status[k] || (i === bs.step && !bs.done ? "run" : "wait"); list.append(h("li", {class:"bs " + st}, h("i"), h("div", null, h("b", {text:t("build_" + k)}), h("small", {text:bs.errors[k] ? bs.errors[k] : t("build_" + k + "_d")})))); });
  wrap.append(list);
  if (bs.local) wrap.append(h("p", {class:"muted center", text:t("build_local")}));
  if (bs.done) wrap.append(h("button", {class:"btn primary big", type:"button", onclick:() => { S.core.interview.done = true; save("core"); go("today"); }}, t("build_enter")));
  else wrap.append(h("p", {class:"muted center", text:t("build_wait")}));
  if (bs.done && Object.keys(bs.errors).length) wrap.append(h("button", {class:"btn ghost", type:"button", onclick:() => { buildState = {step:0, status:{}, errors:{}, local:!aiReady()}; route(); runBuild(); }}, t("retry")));
  main.append(wrap);
}
async function runBuild(){
  const bs = buildState;
  for (let i = 0; i < BUILD_STEPS.length; i++){
    const k = BUILD_STEPS[i]; bs.step = i; bs.status[k] = "run"; route();
    try {
      if (bs.local) await localStep(k); else await aiStep(k);
      bs.status[k] = "ok";
    } catch(e){
      bs.status[k] = "err"; bs.errors[k] = errText(e) || t("err_generic");
      try { await localStep(k); bs.status[k] = "ok"; bs.errors[k] = t("build_fellback"); } catch(e2){}
    }
    save("core");
  }
  bs.done = true; S.core.genesis.at = Date.now(); save("core"); route();
}
const J = (o) => JSON.stringify(o);
async function aiStep(k){
  const base = "You are Pulse, the personal AI whose mission is to change this person's life by knowing him completely and organising everything around who he really is. Be specific to HIM: every line must come from what he told you, never generic self-help. " + langLine() + "\n\nEVERYTHING YOU KNOW ABOUT HIM:\n" + profileText("full");
  if (k === "portrait"){
    const j = await ask(base + "\n\nTASK: write his portrait and vision. Reply with ONLY JSON: " + J({archetype:"a 2-4 word name for who he is", truth:"one piercing sentence that names his core pattern", summary:"4-6 sentences: who he is, what drives him, what holds him back", strengths:["5 items"], shadows:["4-6 honest items: flaws, self-sabotage patterns"], values:["4-6"], worldview:"2-3 sentences", energy:"when and how his energy rises and crashes", motivators:["3-5"], triggers:["3-5 things that derail him"], vision:{statement:"his 12-month vision in 2 sentences, first person", pillars:[{name:"pillar", why:"one sentence"}]}, goals:[{text:"12-month goal", area:AREAS.join("|"), target:10, unit:"what is counted", due:"YYYY-MM-DD"}]}) + " Give 3-4 pillars and 3-5 measurable goals.", {json:true, tier:"complex"});
    applyPortrait(j);
  } else if (k === "system"){
    const j = await ask(base + "\n\nTASK: design his operating system: the ideal weekly routine, keystone habits, and habit-change programs that will actually change his behaviour.\nRules: the routine MUST keep every fixed commitment exactly (same days and times, mark kind \"fixed\") and build the rest of the week around them: wake and wind-down anchors, deep-work blocks in his peak window, training, meals if relevant, learning, people time, weekly planning (Monday morning) and weekly review (Sunday evening). Respect his rest day. Be realistic about energy. Habits: 3-6 small keystone habits tied to a cue and time. Programs: 2-4 programs of 21-66 days that replace specific shadows with new behaviour, each with 3-4 phases that get progressively harder and 2-4 concrete daily actions per phase, plus the effects he will feel.\nReply with ONLY JSON: " + J({routine:[{text:"", area:"", dows:[1,2,3,4,5,6], start:"07:00", end:"08:30", kind:"fixed|routine"}], habits:[{text:"", area:"", time:"HH:MM", dows:[0,1,2,3,4,5,6], cue:"after ...", why:""}], programs:[{title:"", goal:"", why:"", area:"", days:30, phases:[{name:"", days:7, focus:"", actions:[""]}], effects:[""], metric:""}], rules:["5-8 personal operating rules"]}), {json:true, tier:"complex"});
    applySystem(j);
  } else if (k === "month"){
    const first = T.h >= 20 ? addDays(T.date, 1) : T.date;
    const j = await ask(base + "\n\nTASK: plan the rest of this month (" + first + " to the end of " + T.ym + ") as one-off blocks that move his goals and programs forward. The weekly routine and habits already exist; do not repeat them. Place one-off blocks in free time around the routine, deep work in his peak window, front-load what matters, leave buffers, keep weak days light. Include concrete dates for anything he mentioned (deadlines, events, meetings).\nCurrent routine:\n" + routineText() + "\nReply with ONLY JSON: " + J({summary:"2-3 sentences", weeks:[{label:"Week 1 · dates", theme:"", focus:["3 outcomes"]}], rules:["3-6 boost rules for this month"], items:[{date:"YYYY-MM-DD", time:"HH:MM", dur:60, text:"", area:"", prio:2, kind:"deep|task|admin|event", star:false}]}) + " At most 3 starred items per day.", {json:true, tier:"complex"});
    applyMonth(T.ym, j, "ai", first);
  } else if (k === "pages"){
    const j = await ask(base + "\n\nTASK: create 5 personal pages for his Pulse app, each a surprising, genuinely useful deep-dive made only for him (for example: his morning protocol, a map of his money, how to beat his main shadow, a nutrition and training guide around his schedule, a relationships page, a reading list for his goals). Mix practical and inspiring. Reply with ONLY JSON: " + J({pages:[pageShape()]}), {json:true, tier:"complex"});
    (j.pages || []).forEach(p => addPage(p));
  }
}
function pageShape(){ return {title:"", kicker:"one line why this page exists", mood:MOOD_KEYS.join("|"), sections:[{type:"text|list|checklist|steps|quote|stats", heading:"", body:"for text/quote", items:["for list/checklist/steps; for stats use 'label: value'"]}]}; }
function applyPortrait(j){
  if (!j || typeof j !== "object") throw {code:"invalid_json"};
  const c = S.core;
  c.dossier = {archetype:String(j.archetype || ""), truth:String(j.truth || ""), summary:String(j.summary || ""), strengths:arr(j.strengths), shadows:arr(j.shadows), values:arr(j.values), worldview:String(j.worldview || ""), energy:String(j.energy || ""), motivators:arr(j.motivators), triggers:arr(j.triggers), at:Date.now()};
  if (j.vision) c.vision = {statement:String(j.vision.statement || ""), pillars:(Array.isArray(j.vision.pillars) ? j.vision.pillars : []).slice(0, 6).map(p => ({name:String(p.name || ""), why:String(p.why || "")}))};
  (Array.isArray(j.goals) ? j.goals : []).slice(0, 6).forEach(g => { if (!g.text || c.goals.some(x => x.text === g.text)) return; c.goals.push({id:uid(), text:String(g.text), area:normArea(g.area), target:Math.max(1, +g.target || 1), unit:String(g.unit || ""), progress:0, due:/^\d{4}-\d{2}-\d{2}$/.test(g.due || "") ? g.due : null, created:T.date}); });
}
function arr(a){ return (Array.isArray(a) ? a : []).map(x => String(x)).filter(Boolean).slice(0, 10); }
function applySystem(j){
  if (!j || typeof j !== "object") throw {code:"invalid_json"};
  const c = S.core;
  const routine = [];
  (Array.isArray(j.routine) ? j.routine : []).forEach(r => { const st = normTime(r.start), en = normTime(r.end), dw = normDows(r.dows); if (!r.text || !st || !en || !dw.length || toMin(en) <= toMin(st)) return; routine.push({id:uid(), text:String(r.text).slice(0, 90), start:st, end:en, dows:dw, area:normArea(r.area), kind:r.kind === "fixed" ? "fixed" : "routine"}); });
  /* fixed commitments are never lost, even if the model dropped one */
  c.fixed.forEach(f => { const hit = routine.find(r => r.kind === "fixed" && r.start === f.start && f.dows.every(d => r.dows.includes(d))); if (hit) hit.src = f.id; });
  if (routine.length) c.routine = routine;
  const habits = [];
  (Array.isArray(j.habits) ? j.habits : []).slice(0, 8).forEach(x => { if (!x.text) return; const old = c.habits.find(y => y.text === x.text); habits.push({id:old ? old.id : uid(), text:String(x.text).slice(0, 80), area:normArea(x.area), time:normTime(x.time), dows:normDows(x.dows).length ? normDows(x.dows) : [0,1,2,3,4,5,6], cue:String(x.cue || ""), why:String(x.why || ""), dur:10, log:old ? old.log : {}}); });
  if (habits.length) c.habits = habits;
  const progs = [];
  (Array.isArray(j.programs) ? j.programs : []).slice(0, 5).forEach(p => { if (!p.title) return; const phases = (Array.isArray(p.phases) ? p.phases : []).map(ph => ({name:String(ph.name || ""), days:clamp(+ph.days || 7, 1, 60), focus:String(ph.focus || ""), actions:arr(ph.actions).slice(0, 5)})).filter(ph => ph.actions.length); if (!phases.length) return; progs.push({id:uid(), title:String(p.title), goal:String(p.goal || ""), why:String(p.why || ""), area:normArea(p.area), days:clamp(+p.days || phases.reduce((a, x) => a + x.days, 0), 7, 120), phases, effects:arr(p.effects), metric:String(p.metric || ""), start:T.date}); });
  if (progs.length) c.programs = progs;
  if (Array.isArray(j.rules) && j.rules.length) c.rules = arr(j.rules);
}
function applyMonth(ym, j, source, first){
  if (!j || typeof j !== "object") throw {code:"invalid_json"};
  const m = month(ym);
  const items = (Array.isArray(j.items) ? j.items : []).filter(i => i && i.text && /^\d{4}-\d{2}-\d{2}$/.test(i.date || "") && i.date.slice(0,7) === ym && i.date >= (first || ym + "-01")).map(i => ({id:uid(), date:i.date, time:normTime(i.time), dur:clamp(+i.dur || 30, 5, 480), text:String(i.text).slice(0, 200), area:normArea(i.area), prio:clamp(+i.prio || 2, 1, 3), kind:["deep","task","admin","event","ritual","habit"].includes(i.kind) ? i.kind : "task", star:!!i.star, src:"plan"}));
  m.items = m.items.filter(i => i.date < (first || ym + "-01") || i.src !== "plan" || isDone(i.date, i.id)).concat(items);
  m.weeks = (Array.isArray(j.weeks) ? j.weeks : []).map(w => ({label:String(w.label || ""), theme:String(w.theme || ""), focus:arr(w.focus).slice(0, 4)}));
  m.rules = arr(j.rules); m.summary = String(j.summary || ""); m.source = source; m.builtAt = Date.now();
  saveMonth(ym);
}
function addPage(p){
  if (!p || !p.title) return null;
  const pg = {id:uid(), title:String(p.title).slice(0, 90), kicker:String(p.kicker || ""), mood:MOODS[p.mood] ? p.mood : MOOD_KEYS[S.pages.list.length % MOOD_KEYS.length], at:Date.now(), seen:false, checks:{},
    sections:(Array.isArray(p.sections) ? p.sections : []).slice(0, 12).map(x => ({type:["text","list","checklist","steps","quote","stats"].includes(x.type) ? x.type : "text", heading:String(x.heading || ""), body:String(x.body || ""), items:arr(x.items).slice(0, 14)}))};
  S.pages.list.unshift(pg); if (S.pages.list.length > 60) S.pages.list.length = 60; save("pages");
  return pg;
}
/* local fallbacks when Claude is not available */
async function localStep(k){
  const c = S.core;
  if (k === "portrait"){
    if (!c.dossier) c.dossier = {archetype:t("loc_arch"), truth:t("loc_truth"), summary:c.facts.slice(0, 6).map(f => f.t).join(" "), strengths:[], shadows:c.facts.filter(f => f.d === "shadows").map(f => f.t).slice(0, 5), values:c.facts.filter(f => f.d === "values").map(f => f.t).slice(0, 5), worldview:"", energy:"", motivators:[], triggers:[], at:Date.now()};
  } else if (k === "system"){
    if (!c.routine.length) c.routine = c.fixed.map(f => Object.assign({}, f, {id:uid(), src:f.id, kind:"fixed"}));
    const pk = PL.peakWindow(c.rhythm);
    if (!c.routine.some(r => r.kind === "routine")) c.routine.push({id:uid(), text:t("loc_deep"), start:fromMin(pk[0]), end:fromMin(Math.min(pk[0] + 90, pk[1])), dows:[1,2,3,4,5].filter(d => d !== c.rhythm.restDay), area:"business", kind:"routine"},
      {id:uid(), text:t("loc_weekplan"), start:fromMin(toMin(c.rhythm.wake) + 45), end:fromMin(toMin(c.rhythm.wake) + 65), dows:[1], area:"mind", kind:"routine"},
      {id:uid(), text:t("loc_review"), start:"19:00", end:"19:30", dows:[0], area:"mind", kind:"routine"});
    if (!c.habits.length) c.habits = [{id:uid(), text:t("loc_h1"), area:"health", time:null, dows:[0,1,2,3,4,5,6], log:{}}, {id:uid(), text:t("loc_h2"), area:"mind", time:null, dows:[0,1,2,3,4,5,6], log:{}}];
  } else if (k === "month"){
    const text = c.facts.filter(f => f.d === "dreams" || f.d === "work").map(f => f.t).join("\n");
    const r = PL.build({month:T.ym, text, profile:c.rhythm, fixed:c.routine.map(x => ({days:x.dows, start:x.start, end:x.end})), today:T.date});
    applyMonth(T.ym, {items:r.items.filter(i => i.kind !== "habit"), weeks:r.weeks, rules:r.rules, summary:r.summary}, "local", T.date);
  }
}

/* =====================================================================
   TODAY
   ===================================================================== */
function renderToday(main){
  const wrap = h("div", {class:"stack"});
  const {cur, next} = currentBlock();
  const blocks = blocksFor(T.date), real = blocks.filter(b => b.kind !== "fixed");
  const done = real.filter(b => isDone(T.date, b.id)).length;
  const ds = dayScore(T.date);
  /* hero */
  wrap.append(h("section", {class:"hero"},
    h("div", {class:"hero-l"}, h("div", {class:"eyebrow", text:t("today_eyebrow")}), h("h1", {class:"hero-h", text:cur ? cur.text : next ? t("next_at", {t:next.time}) : t("today_free")}),
      h("p", {class:"hero-s", text:cur ? t("now_left", {m:Math.max(0, Math.round(toMin(cur.time) + cur.dur - T.min))}) + (next ? " · " + t("then", {t:next.time, x:next.text}) : "") : next ? next.text : t("today_free_s")}),
      cur && cur.kind !== "fixed" ? h("div", {class:"row gap"}, h("button", {class:"btn primary sm", type:"button", onclick:() => { setDone(T.date, cur.id, true); route(); toast(t("done"), cur.text); }}, icon("check", 16), t("done")), h("button", {class:"btn ghost sm", type:"button", onclick:() => openFocus(cur.text, Math.max(5, Math.round(toMin(cur.time) + cur.dur - T.min)))}, icon("play", 16), t("focus"))) : null),
    ring(real.length ? Math.round(100 * done / real.length) : 0, 108, 9, done + "/" + real.length, ds == null ? t("today") : t("score") + " " + ds)
  ));
  /* banners */
  ritualBanner(wrap);
  slippedBanner(wrap);
  /* brief */
  wrap.append(briefCard());
  /* check-in */
  wrap.append(checkinCard());
  /* timeline */
  wrap.append(sectionTitle(t("timeline")), timeline(T.date, true));
  /* program actions */
  const pa = programActionsFor(T.date);
  if (pa.length){
    wrap.append(sectionTitle(t("today_program")));
    const box = h("div", {class:"card list"});
    pa.forEach(a => box.append(checkRow(T.date, a.id, a.text, a.program, a.area)));
    wrap.append(box);
  }
  /* habits */
  if (S.core.habits.length){
    wrap.append(sectionTitle(t("habits")));
    wrap.append(h("div", {class:"habit-strip"}, S.core.habits.map(x => { const on = !!(x.log || {})[T.date]; return h("button", {type:"button", class:"hb", style:areaStyle(x.area), "aria-pressed":String(on), onclick:() => { setDone(T.date, "h:" + x.id, !on); route(); if (!on) toast("🔥 " + (streak(x)), x.text, 2500); }}, h("i", {text:on ? "✓" : ""}), h("span", {text:x.text}), h("small", {text:"🔥 " + streak(x)})); })));
  }
  /* surprise */
  wrap.append(surpriseCard());
  main.append(wrap);
}
function checkRow(date, id, text, meta, area){
  const on = isDone(date, id);
  return h("label", {class:"crow" + (on ? " on" : ""), style:areaStyle(area)}, h("input", {type:"checkbox", checked:on ? true : null, onchange:e => { setDone(date, id, e.target.checked); route(); }}), h("span", {class:"ct"}, h("b", {text}), meta ? h("small", {text:meta}) : null));
}
function timeline(date, isToday){
  const box = h("div", {class:"tl"});
  const list = blocksFor(date);
  if (!list.length){ box.append(empty(t("tl_empty"))); return box; }
  let lined = !isToday;
  list.forEach(b => {
    const st = b.time ? toMin(b.time) : null, en = st != null ? st + b.dur : null, dn = isDone(date, b.id);
    if (!lined && st != null && st > T.min){ box.append(h("div", {class:"nowline"}, h("span", {text:T.hm}))); lined = true; }
    const cur = isToday && st != null && st <= T.min && T.min < en;
    const row = h("div", {class:"tlr" + (cur ? " cur" : "") + (dn ? " done" : "") + (b.kind === "fixed" ? " fixed" : "") + (isToday && en != null && en <= T.min && !dn && b.kind !== "fixed" ? " late" : ""), style:areaStyle(b.area)},
      h("div", {class:"tlt"}, h("b", {text:b.time || "—"}), b.time ? h("small", {text:fromMin(en)}) : null),
      h("div", {class:"tlb"}, h("div", {class:"tlx"}, b.star ? h("span", {class:"star", text:"★"}) : null, b.text), h("div", {class:"tlm", text:[t("a_" + b.area), b.dur + t("min_short"), b.kind !== "task" ? t("k_" + b.kind) : ""].filter(Boolean).join(" · ")})),
      b.kind === "fixed" ? h("span") : h("button", {class:"tick", type:"button", "aria-pressed":String(dn), "aria-label":t("done") + ": " + b.text, onclick:() => { setDone(date, b.id, !dn); route(); }}, dn ? icon("check", 16) : null));
    if (!["fixed","routine","habit"].includes(b.kind)){
      row.append(h("button", {class:"x", type:"button", "aria-label":t("delete"), onclick:e => confirmInline(e.currentTarget, "✕?", () => { const m = month(date.slice(0,7)); m.items = m.items.filter(i => i.id !== b.id); saveMonth(date.slice(0,7)); route(); })}, icon("x", 14)));
    }
    box.append(row);
  });
  if (!lined) box.append(h("div", {class:"nowline"}, h("span", {text:T.hm})));
  return box;
}
function briefCard(){
  const r = dayRec(T.date);
  const card = h("section", {class:"card brief"});
  card.append(h("div", {class:"card-k"}, icon("spark", 16), t("brief_title")));
  if (r.brief){
    const b = r.brief;
    card.append(h("h3", {class:"brief-h", text:b.headline || ""}), h("p", {class:"brief-p", text:b.message || ""}));
    if (b.focus && b.focus.length) card.append(h("ol", {class:"brief-f"}, b.focus.map(f => h("li", {text:f}))));
    if (b.challenge) card.append(h("div", {class:"challenge"}, h("small", {text:t("challenge")}), h("span", {text:b.challenge})));
    if (b.warning) card.append(h("p", {class:"warn-t", text:b.warning}));
    card.append(h("button", {class:"link", type:"button", onclick:() => { delete r.brief; saveDay(T.date); route(); makeBrief(true); }}, t("refresh")));
    return card;
  }
  if (!aiReady()){ card.append(h("p", {class:"muted", text:aiState === "wait" ? t("ai_wait") : t("brief_noai")})); return card; }
  card.append(h("p", {class:"muted", id:"briefMsg", text:t("brief_loading")}));
  if (!briefRunning) setTimeout(() => makeBrief(false), 50);
  return card;
}
let briefRunning = false;
async function makeBrief(force){
  const r = dayRec(T.date); if ((r.brief && !force) || briefRunning || !aiReady()) return;
  briefRunning = true;
  try {
    const j = await ask("You are Pulse, his personal AI coach who knows him deeply. Write his brief for today. Be concrete, personal and brief; use his schedule, his programs, his recent days and his shadows. " + langLine() + "\n\n" + profileText("short") + "\n\nRECENT DAYS:\n" + recentText(7) + "\n\nTODAY'S SCHEDULE:\n" + scheduleText(T.date, 1) + "\n\nReply with ONLY JSON: " + J({headline:"one strong line for today", message:"3-4 sentences of coaching for today, referencing real items", focus:["the 3 things that matter most today"], challenge:"one small bold micro-challenge", warning:"optional: a risk you see today, or empty"}), {json:true, tier:"default", cache:{gcTime:6 * 3600000}});
    if (j && typeof j === "object"){ r.brief = {headline:String(j.headline || ""), message:String(j.message || ""), focus:arr(j.focus).slice(0, 3), challenge:String(j.challenge || ""), warning:String(j.warning || ""), at:Date.now()}; saveDay(T.date); }
  } catch(e){ const el = $("briefMsg"); if (el) el.textContent = errText(e) || t("brief_noai"); }
  finally { briefRunning = false; if (view === "today" && !sub) route(); }
}
function checkinCard(){
  const r = dayRec(T.date);
  const card = h("section", {class:"card"});
  card.append(h("div", {class:"card-k"}, t("checkin")));
  if (!r.mood || !r.energy || r.sleep == null){
    card.append(h("p", {class:"q", text:t("ci_mood")}),
      h("div", {class:"moods"}, MOOD_KEYS.map(k => h("button", {type:"button", class:"md", "data-m":k, "aria-pressed":String(r.mood === k), onclick:() => { r.mood = k; r.moodScore = {joyful:5, energized:5, focused:4, calm:4, low:2, stressed:2}[k]; S.core.mood = {key:k, at:Date.now()}; saveDay(T.date); save("core"); route(); }}, h("i"), h("span", {text:t("mood_" + k)})))),
      h("p", {class:"q", text:t("ci_energy")}), chips([1,2,3,4,5], r.energy, v => { r.energy = v; saveDay(T.date); route(); }),
      h("p", {class:"q", text:t("ci_sleep")}), chips([5,6,7,8,9], r.sleep, v => { r.sleep = v; saveDay(T.date); route(); }, ["≤5","6","7","8","9+"]));
  } else if (T.h >= 17 && !r.rating){
    const win = h("input", {class:"field", placeholder:t("ci_win"), value:r.win || ""}), blk = h("input", {class:"field", placeholder:t("ci_block"), value:r.block || ""});
    card.append(h("p", {class:"q", text:t("ci_eve")}), win, blk, h("p", {class:"q", text:t("ci_rate")}), chips([1,2,3,4,5], r.rating, v => { r.rating = v; r.win = win.value.trim(); r.block = blk.value.trim(); saveDay(T.date); route(); toast(t("day_closed"), t("score") + " " + (dayScore(T.date) || 0)); }));
  } else {
    card.append(h("div", {class:"ci-done"}, h("span", {class:"mdot big", "data-m":r.mood}), h("div", null, h("b", {text:t("mood_" + r.mood)}), h("small", {text:t("energy") + " " + r.energy + "/5 · " + t("sleep") + " " + r.sleep + t("h_short") + (r.rating ? " · " + t("day") + " " + r.rating + "/5" : "")})), h("button", {class:"link", type:"button", onclick:() => { delete r.mood; delete r.energy; delete r.sleep; delete r.rating; saveDay(T.date); route(); }}, t("redo"))));
  }
  return card;
}
function ritualTarget(){
  if (PL.isLastDay(T.date) && T.h >= 18) return PL.nextMonth(T.ym);
  const m = S.months[T.ym];
  if (+T.date.slice(8) <= 5 && (!m || !m.builtAt || m.builtAt < Date.parse(T.ym + "-01T00:00:00"))) return T.ym;
  return null;
}
function ritualBanner(wrap){
  const tg = ritualTarget(); if (!tg) return;
  const m = S.months[tg]; if (m && m.ritualDone) return;
  wrap.append(h("section", {class:"banner"}, h("div", {class:"eyebrow", text:t("rit_eyebrow")}), h("h3", {text:tg === T.ym ? t("rit_missed", {m:monthLabel(tg)}) : t("rit_tonight", {m:monthLabel(tg)})}), h("p", {text:t("rit_body")}), h("button", {class:"btn primary sm", type:"button", onclick:() => openRitual(tg)}, t("rit_start"))));
}
function slippedBanner(wrap){
  const list = [];
  for (let i = 1; i <= 7; i++){ const d = addDays(T.date, -i); (S.months[d.slice(0,7)] || {items:[]}).items.filter(x => x.date === d && !isDone(d, x.id)).forEach(x => list.push(x)); }
  if (!list.length) return;
  wrap.append(h("section", {class:"banner warn"}, h("div", {class:"eyebrow", text:t("slip_eyebrow")}), h("h3", {text:t("slip_title", {n:list.length})}), h("p", {text:t("slip_body")}),
    h("div", {class:"row gap"}, h("button", {class:"btn primary sm", type:"button", onclick:() => { reslot(list); route(); toast(t("slip_done"), ""); }}, t("slip_move")), h("button", {class:"btn ghost sm", type:"button", onclick:() => { list.forEach(x => setDone(x.date, x.id, true)); route(); }}, t("slip_drop")))));
}
function reslot(list){
  const start = T.h >= 20 ? addDays(T.date, 1) : T.date;
  list.forEach(x => {
    let best = null, bl = Infinity;
    for (let i = 0; i < 7; i++){ const d = addDays(start, i); if (dowOf(d) === S.core.rhythm.restDay && x.prio < 3) continue; const l = blocksFor(d).reduce((a, b) => a + b.dur, 0) + i * 8; if (l < bl){ bl = l; best = d; } }
    if (!best) return;
    const fromM = month(x.date.slice(0,7)); fromM.items = fromM.items.filter(i => i.id !== x.id); saveMonth(x.date.slice(0,7));
    const toM = month(best.slice(0,7)); toM.items.push(Object.assign({}, x, {date:best, moved:(x.moved || 0) + 1})); saveMonth(best.slice(0,7));
  });
}
function surpriseCard(){
  const unseen = S.pages.list.find(p => !p.seen);
  const card = h("section", {class:"card surprise"});
  if (unseen){
    card.append(h("div", {class:"card-k"}, icon("spark", 16), t("sur_new")), h("h3", {text:unseen.title}), h("p", {class:"muted", text:unseen.kicker}), h("button", {class:"btn primary sm", type:"button", onclick:() => go("you", "page", unseen.id)}, t("open")));
  } else {
    card.append(h("div", {class:"card-k"}, icon("spark", 16), t("sur_title")), h("p", {class:"muted", text:t("sur_body")}), h("button", {class:"btn sm", type:"button", disabled:!aiReady() || null, onclick:e => surprise(e.currentTarget)}, t("sur_btn")));
  }
  return card;
}
async function surprise(btn, topic){
  if (btn){ btn.disabled = true; btn.textContent = t("thinking"); }
  try {
    const j = await ask("You are Pulse, his personal AI. Create ONE new page for his app that will genuinely surprise and help him" + (topic ? ", about: " + topic : ": pick an angle he would not expect but clearly needs, based on his shadows, goals and recent days") + ". Existing pages (do not repeat): " + S.pages.list.map(p => p.title).join("; ") + ". " + langLine() + "\n\n" + profileText("short") + "\n\nRECENT DAYS:\n" + recentText(10) + "\n\nReply with ONLY JSON: " + J(pageShape()), {json:true, tier:"default", cache:false});
    const pg = addPage(j.page || j);
    if (pg) go("you", "page", pg.id); else throw {code:"invalid_json"};
  } catch(e){ toast(t("oops"), errText(e)); if (btn){ btn.disabled = false; btn.textContent = t("sur_btn"); } }
}

/* mood sheet */
function openMoodSheet(){
  sheet(t("mood_title"), body => {
    body.append(h("p", {class:"muted", text:t("mood_sub")}), h("div", {class:"moods big"}, MOOD_KEYS.map(k => h("button", {type:"button", class:"md", "data-m":k, "aria-pressed":String(effectiveMood() === k), onclick:() => { const r = dayRec(T.date); r.mood = k; r.moodScore = {joyful:5, energized:5, focused:4, calm:4, low:2, stressed:2}[k]; S.core.mood = {key:k, at:Date.now()}; saveDay(T.date); save("core"); closeSheet(); route(); toast(t("mood_" + k), t("mood_tip_" + k), 5000); }}, h("i"), h("span", {text:t("mood_" + k)})))));
  });
}

/* generic sheet */
function sheet(title, build){
  const el = $("sheet"), body = h("div", {class:"sheet-b"});
  el.innerHTML = "";
  el.append(h("div", {class:"sheet-bg", onclick:closeSheet}), h("div", {class:"sheet-p", role:"dialog", "aria-modal":"true", "aria-label":title}, h("div", {class:"sheet-h"}, h("h2", {text:title}), h("button", {class:"icon-btn", type:"button", "aria-label":t("close"), onclick:closeSheet}, icon("x", 18))), body));
  el.hidden = false; document.body.classList.add("sheet-open");
  build(body);
}
function closeSheet(){ $("sheet").hidden = true; document.body.classList.remove("sheet-open"); }

/* =====================================================================
   PLAN
   ===================================================================== */
let planMonth = T.ym, planDay = T.date;
function renderPlan(main){
  const wrap = h("div", {class:"stack"});
  const m = S.months[planMonth];
  wrap.append(h("div", {class:"mnav"}, h("button", {class:"icon-btn", type:"button", "aria-label":"‹", onclick:() => { planMonth = prevMonth(planMonth); planDay = planMonth === T.ym ? T.date : planMonth + "-01"; route(); }}, icon("back", 18)), h("h1", {class:"mnav-h", text:monthLabel(planMonth)}), h("button", {class:"icon-btn flip", type:"button", "aria-label":"›", onclick:() => { planMonth = PL.nextMonth(planMonth); planDay = planMonth === T.ym ? T.date : planMonth + "-01"; route(); }}, icon("back", 18))));
  wrap.append(h("div", {class:"row gap wrap"}, h("button", {class:"btn primary sm", type:"button", onclick:() => openRitual(planMonth)}, icon("spark", 16), m && m.builtAt ? t("plan_rebuild") : t("plan_build")), h("button", {class:"btn sm", type:"button", onclick:openReplan}, t("plan_changed"))));
  if (m && (m.summary || (m.weeks || []).length)){
    const card = h("section", {class:"card"});
    card.append(h("div", {class:"card-k"}, t("strategy"), h("span", {class:"src", text:m.source === "ai" ? "Claude" : t("local_engine")})), h("p", {class:"lead", text:m.summary}));
    if ((m.weeks || []).length) card.append(h("div", {class:"weeks"}, m.weeks.map(w => h("div", {class:"wk"}, h("small", {text:w.label}), h("b", {text:w.theme}), w.focus && w.focus.length ? h("ul", null, w.focus.map(f => h("li", {text:f}))) : null))));
    if ((m.rules || []).length) card.append(h("ul", {class:"rules"}, m.rules.map(r => h("li", {text:r}))));
    wrap.append(card);
  }
  wrap.append(calendar());
  wrap.append(sectionTitle(dayLabel(planDay)), timeline(planDay, planDay === T.date));
  /* quick add */
  const txt = h("input", {class:"field", id:"qaText", placeholder:t("qa_ph")}), tm = h("input", {class:"field", type:"time", id:"qaTime"});
  wrap.append(h("form", {class:"qa card", onsubmit:e => { e.preventDefault(); const v = txt.value.trim(); if (!v) return; const it = PL.parseLine(v, planDay.slice(0,7)); const m2 = month(planDay.slice(0,7)); m2.items.push({id:uid(), date:planDay, time:tm.value || it.time || null, dur:it.dur || 45, text:it.text || v, area:it.area || "other", prio:it.prio || 2, kind:"task", src:"user"}); saveMonth(planDay.slice(0,7)); route(); toast(t("added"), v); }},
    h("div", {class:"card-k", text:t("qa_title")}), txt, h("div", {class:"row gap"}, tm, h("button", {class:"btn primary sm", type:"submit"}, icon("plus", 16), t("add")))));
  main.append(wrap);
}
function calendar(){
  const grid = h("div", {class:"cal"});
  DOW_ORDER.forEach(i => grid.append(h("div", {class:"cal-h", text:dowShort(i)})));
  const off = (dowOf(planMonth + "-01") + 6) % 7, dim = PL.daysInMonth(planMonth);
  for (let i = 0; i < off; i++) grid.append(h("span"));
  for (let d = 1; d <= dim; d++){
    const iso = planMonth + "-" + pad(d), b = blocksFor(iso), load = b.reduce((a, x) => a + x.dur, 0);
    const real = b.filter(x => x.kind !== "fixed"), dn = real.filter(x => isDone(iso, x.id)).length;
    const areas = []; b.filter(x => x.kind !== "routine" && x.kind !== "fixed").forEach(x => { if (!areas.includes(x.area)) areas.push(x.area); });
    grid.append(h("button", {type:"button", class:"cd" + (iso === T.date ? " today" : "") + (iso === planDay ? " sel" : "") + (iso < T.date ? " past" : ""), style:"--load:" + Math.min(1, load / 720).toFixed(2), "aria-label":dayLabel(iso), onclick:() => { planDay = iso; route(); }},
      h("b", {text:String(d)}), iso < T.date && real.length ? h("small", {text:Math.round(100 * dn / real.length) + "%"}) : null, h("span", {class:"cdots"}, areas.slice(0, 5).map(a => h("i", {style:areaStyle(a)})))));
  }
  return h("section", {class:"card cal-card"}, grid);
}
function openReplan(){
  sheet(t("replan_title"), body => {
    const ta = h("textarea", {class:"field", rows:"5", placeholder:t("replan_ph")});
    const out = h("p", {class:"muted"});
    const btn = h("button", {class:"btn primary", type:"button", disabled:!aiReady() || null, onclick:async () => {
      const txt = ta.value.trim(); if (!txt) return;
      btn.disabled = true; out.textContent = t("thinking");
      const first = T.h >= 20 ? addDays(T.date, 1) : T.date, ym = first.slice(0,7);
      try {
        const cur = month(ym).items.filter(i => i.date >= first).map(i => i.date + " " + (i.time || "--:--") + " " + i.dur + "m " + i.text).join("\n");
        const j = await ask("You are Pulse, his personal AI planner. Something changed; rebuild the remaining one-off blocks of this month (" + first + " to end of " + ym + ") so everything still fits his real life. Keep what still makes sense, move what clashes, drop what no longer matters, add what the change requires. Never overlap his routine or fixed commitments. " + langLine() + "\n\nWHAT CHANGED (his words): " + txt + "\n\n" + profileText("short") + "\n\nCURRENT ONE-OFF BLOCKS:\n" + (cur || "(none)") + "\n\nReply with ONLY JSON: " + J({summary:"2 sentences on what you changed and why", weeks:[{label:"", theme:"", focus:[""]}], rules:[""], items:[{date:"YYYY-MM-DD", time:"HH:MM", dur:60, text:"", area:"", prio:2, kind:"deep|task|admin|event", star:false}]}), {json:true, tier:"complex", cache:false});
        applyMonth(ym, j, "ai", first); closeSheet(); planMonth = ym; route(); toast(t("replanned"), String(j.summary || ""), 7000);
      } catch(e){ out.textContent = errText(e); btn.disabled = false; }
    }}, icon("spark", 16), t("replan_btn"));
    body.append(h("p", {class:"muted", text:t("replan_sub")}), ta, btn, out);
    if (!aiReady()) out.textContent = t("brief_noai");
  });
}

/* month ritual */
function openRitual(tg){
  const prev = prevMonth(tg), m = month(tg);
  const st = {win:"", slow:"", stop:"", text:m.text || "", top:(m.top || ["","",""]).slice()};
  sheet(t("rit_title", {m:monthLabel(tg)}), body => {
    const pm = S.months[prev];
    let done = 0, all = 0; if (pm) pm.items.forEach(i => { all++; if (isDone(i.date, i.id)) done++; });
    body.append(h("div", {class:"rit-stats"}, [[t("rit_done"), all ? done + "/" + all : "—"], [t("rit_rate"), all ? Math.round(100 * done / all) + "%" : "—"], [t("score"), weekScore() == null ? "—" : String(weekScore())]].map(([k, v]) => h("div", null, h("small", {text:k}), h("b", {text:v})))));
    const f = (key, lbl) => { const e = h("textarea", {class:"field", rows:"2", placeholder:lbl}); e.value = st[key]; e.addEventListener("input", () => st[key] = e.value); return e; };
    body.append(h("p", {class:"q", text:t("rit_reflect", {m:monthLabel(prev)})}), f("win", t("rit_win")), f("slow", t("rit_slow")), f("stop", t("rit_stop")));
    body.append(h("p", {class:"q", text:t("rit_top")}));
    st.top.forEach((v, i) => { const e = h("input", {class:"field", placeholder:t("rit_goal") + " " + (i + 1), value:v}); e.addEventListener("input", () => st.top[i] = e.value); body.append(e); });
    const ta = h("textarea", {class:"field big", rows:"9", placeholder:t("rit_ph")}); ta.value = st.text; ta.addEventListener("input", () => st.text = ta.value);
    const out = h("div", {class:"rit-out"});
    const btn = h("button", {class:"btn primary", type:"button", onclick:async () => {
      if (!st.text.trim() && !st.top.some(Boolean)) return;
      btn.disabled = true; out.innerHTML = ""; out.append(h("p", {class:"muted", text:t("rit_building")}));
      const first = tg === T.ym ? (T.h >= 20 ? addDays(T.date, 1) : T.date) : tg + "-01";
      m.text = st.text; m.top = st.top; m.review = {win:st.win, slow:st.slow, stop:st.stop};
      let ok = false;
      if (aiReady()){
        try {
          const j = await ask("You are Pulse, his personal AI planner who knows him deeply. Turn his month plan into the most effective realistic schedule for " + tg + " (plan dates " + first + " to month end) as one-off blocks. His weekly routine, fixed commitments (for example training days) and habits are already scheduled every week: plan AROUND them, never on top of them. Deep work in his peak window, strong days for hard work, weak days lighter, projects split into phases that finish before deadlines with a buffer, admin batched, top 3 outcomes first, rest protected, a month review on the last day at 21:00. Be honest if it is overloaded. " + langLine() + "\n\n" + profileText("short") + "\n\nLAST MONTH REVIEW: win: " + st.win + " | slowed by: " + st.slow + " | stop: " + st.stop + "\n\nTOP 3 FOR THE MONTH:\n" + st.top.filter(Boolean).join("\n") + "\n\nHIS PLAN IN HIS WORDS:\n" + st.text + "\n\nReply with ONLY JSON: " + J({summary:"2-3 sentences", weeks:[{label:"Week 1 · dates", theme:"", focus:["3"]}], rules:["4-7 boost rules specific to this month"], items:[{date:"YYYY-MM-DD", time:"HH:MM", dur:60, text:"", area:"", prio:2, kind:"deep|task|admin|event", star:false}]}), {json:true, tier:"complex", cache:false});
          applyMonth(tg, j, "ai", first); ok = true;
        } catch(e){ out.append(h("p", {class:"warn-t", text:errText(e) + " " + t("rit_local")})); }
      }
      if (!ok){
        const r = PL.build({month:tg, text:st.text, top3:st.top, profile:S.core.rhythm, fixed:S.core.routine.concat(S.core.fixed).map(x => ({days:x.dows, start:x.start, end:x.end})), today:first});
        applyMonth(tg, {items:r.items.filter(i => i.kind !== "habit"), weeks:r.weeks, rules:r.rules, summary:r.summary}, "local", first);
      }
      st.top.filter(x => x.trim()).forEach(x => { if (!S.core.goals.some(g => g.text === x.trim())) S.core.goals.push({id:uid(), text:x.trim(), area:PL.detectArea(x), target:1, unit:"", progress:0, due:tg + "-" + pad(PL.daysInMonth(tg)), created:T.date}); });
      m.ritualDone = true; saveMonth(tg); save("core");
      closeSheet(); planMonth = tg; planDay = tg === T.ym ? T.date : tg + "-01"; go("plan"); toast(t("rit_ready"), month(tg).summary, 7000);
    }}, icon("spark", 16), t("rit_btn"));
    body.append(h("p", {class:"q", text:t("rit_plan", {m:monthLabel(tg)})}), h("p", {class:"muted small", text:t("rit_hint")}), ta, btn, out);
  });
}

/* =====================================================================
   COACH
   ===================================================================== */
let coachCtl = null;
function coachTools(){
  const ymOf = d => d.slice(0,7);
  return [
    {name:"add_blocks", description:"Add one-off blocks to his calendar. Returns the created ids.", inputSchema:{type:"object", properties:{blocks:{type:"array", items:{type:"object", properties:{date:{type:"string", description:"YYYY-MM-DD"}, time:{type:"string", description:"HH:MM 24h or empty"}, dur:{type:"number"}, text:{type:"string"}, area:{type:"string", enum:AREAS}}, required:["date","text"]}}}, required:["blocks"]},
      execute:inp => { const ids = []; (inp.blocks || []).forEach(b => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) || !b.text) return; const m = month(ymOf(String(b.date))); const id = uid(); m.items.push({id, date:String(b.date), time:normTime(b.time), dur:clamp(+b.dur || 45, 5, 480), text:String(b.text).slice(0, 200), area:normArea(b.area), prio:2, kind:"task", src:"coach"}); saveMonth(ymOf(String(b.date))); ids.push(id); }); refreshSoon(); return {created:ids}; }},
    {name:"change_block", description:"Move, rename, complete or delete a one-off block by id (ids appear in square brackets in the schedule). Routine blocks (ids starting r:) can only be marked done.", inputSchema:{type:"object", properties:{id:{type:"string"}, date:{type:"string"}, new_date:{type:"string"}, time:{type:"string"}, dur:{type:"number"}, text:{type:"string"}, done:{type:"boolean"}, delete:{type:"boolean"}}, required:["id","date"]},
      execute:inp => { const id = String(inp.id), date = String(inp.date);
        if (inp.done != null){ setDone(date, id, !!inp.done); }
        const m = S.months[ymOf(date)]; const it = m && m.items.find(i => i.id === id);
        if (!it){ if (inp.done != null){ refreshSoon(); return "ok"; } throw new Error("No one-off block with id " + id + " on " + date); }
        if (inp.delete){ m.items = m.items.filter(i => i !== it); saveMonth(ymOf(date)); refreshSoon(); return "deleted"; }
        if (inp.text) it.text = String(inp.text).slice(0, 200); if (inp.time !== undefined) it.time = normTime(inp.time); if (inp.dur) it.dur = clamp(+inp.dur, 5, 480);
        if (inp.new_date && /^\d{4}-\d{2}-\d{2}$/.test(String(inp.new_date)) && inp.new_date !== date){ m.items = m.items.filter(i => i !== it); saveMonth(ymOf(date)); it.date = String(inp.new_date); month(ymOf(it.date)).items.push(it); saveMonth(ymOf(it.date)); } else saveMonth(ymOf(date));
        refreshSoon(); return "ok"; }},
    {name:"get_schedule", description:"Return his schedule for a date range (max 14 days) with block ids.", inputSchema:{type:"object", properties:{from:{type:"string"}, days:{type:"number"}}, required:["from"]},
      execute:inp => scheduleText(/^\d{4}-\d{2}-\d{2}$/.test(String(inp.from)) ? String(inp.from) : T.date, clamp(+inp.days || 1, 1, 14))},
    {name:"remember", description:"Save new facts about him to his permanent memory (things he reveals in conversation: preferences, events, feelings, changes).", inputSchema:{type:"object", properties:{facts:{type:"array", items:{type:"object", properties:{d:{type:"string", enum:DOMAINS}, t:{type:"string"}}, required:["d","t"]}}}, required:["facts"]},
      execute:inp => { let n = 0; (inp.facts || []).forEach(f => { if (!f || !f.t) return; S.core.facts.push({id:uid(), d:DOMAINS.includes(f.d) ? f.d : "story", t:String(f.t).slice(0, 300), at:Date.now()}); n++; }); save("core"); return {saved:n}; }},
    {name:"set_routine", description:"Add or remove a weekly routine or fixed block (for example a new gym schedule). dows: 0=Sunday..6=Saturday.", inputSchema:{type:"object", properties:{op:{type:"string", enum:["add","remove"]}, id:{type:"string"}, text:{type:"string"}, dows:{type:"array", items:{type:"number"}}, start:{type:"string"}, end:{type:"string"}, area:{type:"string", enum:AREAS}, fixed:{type:"boolean"}}, required:["op"]},
      execute:inp => { const c = S.core;
        if (inp.op === "remove"){ const id = String(inp.id || "").replace(/^r:/, ""); const n = c.routine.length; c.routine = c.routine.filter(r => r.id !== id); c.fixed = c.fixed.filter(f => f.id !== id.replace(/^f:/, "")); save("core"); refreshSoon(); return n !== c.routine.length ? "removed" : "not found"; }
        const st = normTime(inp.start), en = normTime(inp.end), dw = normDows(inp.dows); if (!inp.text || !st || !en || !dw.length) throw new Error("text, start, end and dows are required");
        const id = uid(); c.routine.push({id, text:String(inp.text).slice(0, 90), start:st, end:en, dows:dw, area:normArea(inp.area), kind:inp.fixed ? "fixed" : "routine"}); save("core"); refreshSoon(); return {id:"r:" + id}; }},
    {name:"create_page", description:"Create a new personal page in his app (a guide, protocol, plan or deep-dive made for him). Returns the page id.", inputSchema:{type:"object", properties:{title:{type:"string"}, kicker:{type:"string"}, mood:{type:"string", enum:MOOD_KEYS}, sections:{type:"array", items:{type:"object", properties:{type:{type:"string", enum:["text","list","checklist","steps","quote","stats"]}, heading:{type:"string"}, body:{type:"string"}, items:{type:"array", items:{type:"string"}}}}}}, required:["title","sections"]},
      execute:inp => { const p = addPage(inp); return p ? {id:p.id} : "invalid"; }},
    {name:"update_goal", description:"Change a goal's progress or add a new goal.", inputSchema:{type:"object", properties:{text:{type:"string"}, progress:{type:"number"}, target:{type:"number"}, due:{type:"string"}}, required:["text"]},
      execute:inp => { const c = S.core; let g = c.goals.find(x => x.text === inp.text); if (!g){ g = {id:uid(), text:String(inp.text), area:PL.detectArea(String(inp.text)), target:Math.max(1, +inp.target || 1), unit:"", progress:0, due:/^\d{4}-\d{2}-\d{2}$/.test(inp.due || "") ? inp.due : null, created:T.date}; c.goals.push(g); } if (inp.progress != null) g.progress = clamp(+inp.progress, 0, g.target); if (inp.target) g.target = Math.max(1, +inp.target); save("core"); refreshSoon(); return "ok"; }}
  ];
}
let refreshT = null;
function refreshSoon(){ clearTimeout(refreshT); refreshT = setTimeout(() => { if (view !== "coach") route(); }, 300); }
function coachPreamble(){
  return "You are Pulse, his personal AI: coach, planner and chief of staff in one. You know him deeply (below). Your mission is to change his life by helping him act on what matters, change his habits and grow, day after day. Talk like someone who truly knows him: warm, sharp, honest, concrete, brief (2-6 sentences unless he asks for more). Use the tools to act, not just talk: when he asks to plan, move, add, complete, or when he reveals something important, call the tools and then confirm what you did. When he shares new facts about himself, save them with remember. " + langLine() + "\n\n" + profileText("short") + "\n\nRECENT DAYS:\n" + recentText(7) + "\n\nSCHEDULE (today and next 6 days, ids in brackets):\n" + scheduleText(T.date, 7).slice(0, 9000) + "\n\nMood now: " + effectiveMood() + ".";
}
function renderCoach(main){
  const wrap = h("div", {class:"coach"});
  const log = h("div", {class:"clog", id:"clog", "aria-live":"polite"});
  const msgs = S.chat.coach;
  wrap.append(h("div", {class:"coach-top"}, orb("lg"), h("div", {class:"eyebrow center", text:t("coach_eyebrow")})));
  if (!msgs.length) log.append(bubble("a", t("coach_hello", {n:S.core.name ? ", " + S.core.name : ""})));
  msgs.slice(-50).forEach(m => log.append(bubble(m.r, m.t)));
  const ta = h("textarea", {class:"gen-in", id:"coachIn", rows:"1", placeholder:t("coach_ph")});
  ta.value = LS.get("coachDraft", ""); ta.addEventListener("input", () => { LS.set("coachDraft", ta.value); autoGrow(ta); });
  ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer:fine)").matches){ e.preventDefault(); send(); } });
  const sendBtn = h("button", {class:"send", type:"button", "aria-label":t("send"), onclick:() => send()}, icon("send"));
  const stopBtn = h("button", {class:"send stop", type:"button", hidden:true, "aria-label":t("stop"), onclick:() => coachCtl && coachCtl.abort()}, icon("stop"));
  const note = h("p", {class:"gen-note"});
  const quick = h("div", {class:"quick"}, ["q1","q2","q3","q4","q5"].map(k => h("button", {type:"button", class:"chip", onclick:() => { ta.value = t("coach_" + k); send(); }}, t("coach_" + k))));
  wrap.append(log, h("div", {class:"gen-dock"}, quick, h("div", {class:"composer"}, ta, sendBtn, stopBtn), note));
  main.append(wrap);
  requestAnimationFrame(() => { window.scrollTo(0, document.body.scrollHeight); autoGrow(ta); });
  if (!aiReady()) note.textContent = aiState === "wait" ? t("ai_wait") : t("coach_noai");
  async function send(){
    const txt = ta.value.trim(); if (!txt || busy) return;
    if (!aiReady()){ note.textContent = t("coach_noai"); return; }
    msgs.push({r:"u", t:txt, at:Date.now()}); if (msgs.length > 120) msgs.splice(0, msgs.length - 120); save("chat");
    ta.value = ""; LS.set("coachDraft", ""); autoGrow(ta); quick.hidden = true;
    log.append(bubble("u", txt));
    const b = bubble("a", ""); b.classList.add("typing"); const bt = b.querySelector(".bt"); bt.append(h("span", {class:"dots"}, h("i"), h("i"), h("i")));
    log.append(b); window.scrollTo(0, document.body.scrollHeight);
    sendBtn.hidden = true; stopBtn.hidden = false; note.textContent = "";
    coachCtl = new AbortController();
    const turns = [{role:"user", content:coachPreamble()}].concat(msgs.slice(-16).map(m => ({role:m.r === "u" ? "user" : "assistant", content:m.t})));
    const opts = {tier:S.core.settings.depth === "deep" ? "complex" : "default", signal:coachCtl.signal, onText:({text}) => { b.classList.remove("typing"); bt.textContent = text; window.scrollTo(0, document.body.scrollHeight); }};
    try {
      let text;
      if (sampler && aiState === "ok"){
        let useTools = true;
        try { const lim = await sampler.limits(); useTools = !!(lim && lim.tools); } catch(e){ useTools = false; }
        if (useTools) opts.tools = coachTools(); else opts.cache = false;
        text = (await ask(turns, opts)).text.trim();
      } else {
        /* key providers: the same tools, as a JSON action list the page executes */
        const tools = coachTools();
        turns[0].content += "\n\nYOUR ACTIONS. You can change his app with these actions:\n" + tools.map(x => "- " + x.name + ": " + x.description + " args: " + JSON.stringify(x.inputSchema.properties)).join("\n") + "\n\nAlways reply with ONLY one JSON object: {\"reply\": \"what he reads\", \"actions\": [{\"name\": action name, \"args\": {...}}]}. Use an empty actions list when nothing in the app should change.";
        const j = await ask(turns, {json:true, signal:coachCtl.signal});
        const done = [];
        for (const a of (Array.isArray(j.actions) ? j.actions : [])){ const tool = tools.find(x => x.name === (a && a.name)); if (!tool) continue; try { await tool.execute(a.args || {}, {signal:coachCtl.signal}); done.push(a.name); } catch(err){ console.warn("action failed", a, err); } }
        text = String(j.reply || "").trim() || t("coach_done");
        if (done.length) refreshSoon();
      }
      b.classList.remove("typing"); bt.textContent = text;
      msgs.push({r:"a", t:text, at:Date.now()}); save("chat");
    } catch(e){
      const keep = e && e.text && !(e.code === "invalid_json"); b.classList.remove("typing");
      if (keep){ bt.textContent = e.text; msgs.push({r:"a", t:e.text, at:Date.now()}); save("chat"); } else b.remove();
      const msg = errText(e); if (msg) note.textContent = msg;
    } finally { sendBtn.hidden = false; stopBtn.hidden = true; }
  }
}

/* =====================================================================
   GROWTH
   ===================================================================== */
function renderGrowth(main){
  const wrap = h("div", {class:"stack"});
  const ws = weekScore();
  let hd = 0, ha = 0; for (let i = 0; i < 7; i++){ const d = addDays(T.date, -i); S.core.habits.forEach(x => { ha++; if ((x.log || {})[d]) hd++; }); }
  const moods = []; for (let i = 0; i < 7; i++){ const r = peekDay(addDays(T.date, -i)); if (r && r.energy) moods.push(r.energy); }
  wrap.append(h("section", {class:"card score"}, ring(ws || 0, 132, 11, ws == null ? "—" : String(ws), t("life_score")),
    h("div", {class:"minis"}, [[t("habits"), ha ? Math.round(100 * hd / ha) + "%" : "—"], [t("energy"), moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : "—"], [t("programs"), String(S.core.programs.length)], [t("goals"), String(S.core.goals.length)]].map(([k, v]) => h("div", {class:"mini"}, h("small", {text:k}), h("b", {text:v}))))));
  /* weekly letter */
  wrap.append(letterCard());
  /* programs */
  wrap.append(sectionTitle(t("programs")));
  if (!S.core.programs.length) wrap.append(empty(t("prog_empty")));
  S.core.programs.forEach(p => {
    const d = programDay(p), ph = currentPhase(p) || {}, pct = Math.round(100 * d / (p.days || 30));
    const acts = programActionsFor(T.date).filter(a => a.id.indexOf("p:" + p.id + ":") === 0);
    const card = h("section", {class:"card prog", style:areaStyle(p.area)},
      h("div", {class:"prog-h"}, h("div", null, h("small", {text:t("prog_day", {d, n:p.days})}), h("h3", {text:p.title})), h("b", {class:"pct", text:pct + "%"})),
      h("div", {class:"bar"}, h("i", {style:"width:" + pct + "%"})),
      h("p", {class:"muted", text:p.goal}),
      h("div", {class:"phase"}, h("small", {text:t("phase")}), h("b", {text:ph.name || ""}), ph.focus ? h("span", {text:ph.focus}) : null),
      acts.length ? h("div", {class:"list"}, acts.map(a => checkRow(T.date, a.id, a.text, null, p.area))) : null,
      p.effects && p.effects.length ? h("details", {class:"fold"}, h("summary", {text:t("prog_effects")}), h("ul", null, p.effects.map(e => h("li", {text:e}))), p.why ? h("p", {class:"muted", text:p.why}) : null) : null,
      h("div", {class:"row gap"}, h("button", {class:"link", type:"button", onclick:e => confirmInline(e.currentTarget, t("confirm_restart"), () => { p.start = T.date; save("core"); route(); })}, t("prog_restart")), h("button", {class:"link", type:"button", onclick:e => confirmInline(e.currentTarget, t("confirm_delete"), () => { S.core.programs = S.core.programs.filter(x => x !== p); save("core"); route(); })}, t("delete"))));
    wrap.append(card);
  });
  if (aiReady()) wrap.append(h("button", {class:"btn sm", type:"button", onclick:e => newProgram(e.currentTarget)}, icon("plus", 16), t("prog_new")));
  /* habits */
  wrap.append(sectionTitle(t("habits")));
  const hl = h("div", {class:"stack tight"});
  S.core.habits.forEach(x => {
    const dots = []; for (let i = 13; i >= 0; i--){ const d = addDays(T.date, -i); dots.push(h("i", {class:(x.log || {})[d] ? "on" : "", title:d})); }
    const on = !!(x.log || {})[T.date];
    hl.append(h("div", {class:"habit", style:areaStyle(x.area)}, h("div", {class:"hbx"}, h("b", {text:x.text}), h("small", {text:[x.cue, x.time].filter(Boolean).join(" · ")}), h("div", {class:"hdots"}, dots)), h("div", {class:"hstreak"}, h("b", {text:String(streak(x))}), h("small", {text:t("streak")})), h("button", {class:"tick big", type:"button", "aria-pressed":String(on), "aria-label":x.text, onclick:() => { setDone(T.date, "h:" + x.id, !on); route(); }}, on ? icon("check", 18) : null)));
  });
  if (!S.core.habits.length) hl.append(empty(t("hab_empty")));
  const hin = h("input", {class:"field", placeholder:t("hab_ph")});
  hl.append(h("form", {class:"row gap", onsubmit:e => { e.preventDefault(); const v = hin.value.trim(); if (!v) return; S.core.habits.push({id:uid(), text:v, area:PL.detectArea(v), time:null, dows:[0,1,2,3,4,5,6], log:{}}); save("core"); route(); }}, hin, h("button", {class:"btn sm", type:"submit"}, t("add"))));
  wrap.append(hl);
  /* goals */
  wrap.append(sectionTitle(t("goals")));
  if (!S.core.goals.length) wrap.append(empty(t("goal_empty")));
  S.core.goals.forEach(g => {
    const pct = Math.round(100 * Math.min(1, (g.progress || 0) / Math.max(1, g.target)));
    const step = dv => { g.progress = clamp((g.progress || 0) + dv, 0, g.target); save("core"); route(); if (g.progress >= g.target && dv > 0) toast(t("goal_hit"), g.text); };
    wrap.append(h("section", {class:"card goal", style:areaStyle(g.area)}, h("div", {class:"goal-h"}, h("b", {text:g.text}), h("span", {class:"pct", text:(g.progress || 0) + "/" + g.target + (g.unit ? " " + g.unit : "")})), h("div", {class:"bar"}, h("i", {style:"width:" + pct + "%"})),
      h("div", {class:"row between"}, h("small", {class:"muted", text:g.due ? t("due", {d:fmt(g.due, {day:"numeric", month:"short"})}) : ""}), h("div", {class:"row gap"}, h("button", {class:"icon-btn sm", type:"button", "aria-label":"-1", onclick:() => step(-1)}, "−"), h("button", {class:"icon-btn sm", type:"button", "aria-label":"+1", onclick:() => step(1)}, "+"), h("button", {class:"icon-btn sm", type:"button", "aria-label":t("delete"), onclick:e => confirmInline(e.currentTarget, "✕?", () => { S.core.goals = S.core.goals.filter(x => x !== g); save("core"); route(); })}, icon("x", 14))))));
  });
  /* charts */
  wrap.append(sectionTitle(t("mood_chart")), moodChart(), sectionTitle(t("balance")), wheel(), sectionTitle(t("consistency")), heat());
  main.append(wrap);
}
function isoWeekKey(d){ return addDays(d, -((dowOf(d) + 6) % 7)); }
function letterCard(){
  const key = isoWeekKey(T.date), L = (S.core.letters || {})[key];
  const card = h("section", {class:"card letter"});
  card.append(h("div", {class:"card-k"}, icon("spark", 16), t("letter_title")));
  if (L){ card.append(h("div", {class:"letter-t", text:L.text})); return card; }
  card.append(h("p", {class:"muted", text:t("letter_sub")}));
  const btn = h("button", {class:"btn sm", type:"button", disabled:!aiReady() || null, onclick:async () => {
    btn.disabled = true; btn.textContent = t("thinking");
    const out = h("div", {class:"letter-t"}); card.append(out);
    try {
      const r = await ask("You are Pulse, his personal AI. Write him a short personal letter about his week (max 180 words): what you noticed in his data, what he did well, the one pattern holding him back, and the single focus for next week. Honest and warm, like a mentor who knows him. No headings. " + langLine() + "\n\n" + profileText("short") + "\n\nLAST 7 DAYS:\n" + recentText(7), {tier:"default", cache:false, onText:({text}) => out.textContent = text});
      S.core.letters = S.core.letters || {}; S.core.letters[key] = {text:r.text, at:Date.now()};
      const ks = Object.keys(S.core.letters).sort(); while (ks.length > 12) delete S.core.letters[ks.shift()];
      save("core"); route();
    } catch(e){ out.textContent = errText(e); btn.disabled = false; btn.textContent = t("letter_btn"); }
  }}, t("letter_btn"));
  card.append(btn);
  return card;
}
async function newProgram(btn){
  sheet(t("prog_new"), body => {
    const ta = h("textarea", {class:"field", rows:"3", placeholder:t("prog_ph")}), out = h("p", {class:"muted"});
    const b = h("button", {class:"btn primary", type:"button", onclick:async () => {
      b.disabled = true; out.textContent = t("thinking");
      try {
        const j = await ask("You are Pulse, his personal AI. Design ONE habit-change program for him" + (ta.value.trim() ? " about: " + ta.value.trim() : " that targets his most damaging shadow") + ". 21-66 days, 3-4 phases that get progressively harder, 2-4 concrete daily actions per phase that fit his schedule, the effects he will feel. " + langLine() + "\n\n" + profileText("short") + "\n\nReply with ONLY JSON: " + J({title:"", goal:"", why:"", area:"", days:30, phases:[{name:"", days:7, focus:"", actions:[""]}], effects:[""], metric:""}), {json:true, tier:"complex", cache:false});
        const before = S.core.programs.slice(); applySystem({programs:[j]}); S.core.programs = before.concat(S.core.programs.filter(p => !before.includes(p))); save("core"); closeSheet(); route(); toast(t("prog_added"), j.title || "");
      } catch(e){ out.textContent = errText(e); b.disabled = false; }
    }}, icon("spark", 16), t("prog_design"));
    body.append(h("p", {class:"muted", text:t("prog_sub")}), ta, b, out);
  });
}
function moodChart(){
  const W = 340, H = 150, P = 26, n = 30, pts = [], sl = [];
  for (let i = n - 1; i >= 0; i--){ const d = addDays(T.date, -i), r = peekDay(d); pts.push(r && r.energy ? r.energy : null); sl.push(r && r.sleep ? r.sleep : null); }
  const x = i => P + i * (W - P - 8) / (n - 1), y = v => H - 20 - (v - 1) / 4 * (H - 40);
  const kids = [];
  [1,3,5].forEach(v => { kids.push(s("line", {x1:P, x2:W - 8, y1:y(v), y2:y(v), stroke:"var(--line2)", "stroke-width":1})); const tx = s("text", {x:P - 8, y:y(v) + 4, "text-anchor":"end", fill:"var(--dim)", "font-size":10}); tx.textContent = v; kids.push(tx); });
  let d = "", area = "", started = false, lastI = -1;
  pts.forEach((v, i) => { if (v == null) return; d += (started ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " "; started = true; lastI = i; });
  const known = pts.map((v, i) => [v, i]).filter(p => p[0] != null);
  if (known.length > 1){ area = "M" + x(known[0][1]) + " " + (H - 20) + " " + known.map(p => "L" + x(p[1]).toFixed(1) + " " + y(p[0]).toFixed(1)).join(" ") + " L" + x(known[known.length - 1][1]) + " " + (H - 20) + " Z"; kids.push(s("path", {d:area, fill:"url(#gradFill)", stroke:"none"})); }
  if (d) kids.push(s("path", {d, fill:"none", stroke:"url(#gradMood)", "stroke-width":2.5, "stroke-linejoin":"round", "stroke-linecap":"round"}));
  known.forEach(p => kids.push(s("circle", {cx:x(p[1]), cy:y(p[0]), r:p[1] === lastI ? 4.5 : 2.2, fill:p[1] === lastI ? "var(--m2)" : "var(--m1)"})));
  const lab = s("text", {x:W - 8, y:H - 4, "text-anchor":"end", fill:"var(--dim)", "font-size":10}); lab.textContent = t("last30"); kids.push(lab);
  const box = h("section", {class:"card chart"});
  box.append(s("svg", {viewBox:"0 0 " + W + " " + H, class:"chart-svg", role:"img", "aria-label":t("mood_chart")}, kids));
  if (known.length < 3) box.append(h("p", {class:"muted small", text:t("chart_empty")}));
  return box;
}
function wheel(){
  const axes = AREAS.filter(a => a !== "other"), W = 340, H = 290, cx = W / 2, cy = 145, R = 100;
  const mins = {}; const from = addDays(T.date, -29);
  for (let i = 0; i < 30; i++){ const d = addDays(from, i); if (d > T.date) break; const r = peekDay(d); if (!r) continue; blocksFor(d).forEach(b => { if (r.done[b.id]) mins[b.area] = (mins[b.area] || 0) + b.dur; }); }
  const max = Math.max(60, ...axes.map(a => mins[a] || 0));
  const pt = (i, v) => { const ang = -Math.PI / 2 + i * 2 * Math.PI / axes.length; return [cx + Math.cos(ang) * R * v, cy + Math.sin(ang) * R * v]; };
  const kids = [];
  [.33, .66, 1].forEach(v => kids.push(s("polygon", {points:axes.map((a, i) => pt(i, v).join(",")).join(" "), fill:"none", stroke:"var(--line2)"})));
  axes.forEach((a, i) => { const [lx, ly] = pt(i, 1.22); const tx = s("text", {x:lx, y:ly + 4, "text-anchor":"middle", fill:"var(--dim)", "font-size":10.5}); tx.textContent = t("a_" + a); kids.push(tx); });
  kids.push(s("polygon", {points:axes.map((a, i) => pt(i, Math.max(.05, (mins[a] || 0) / max)).join(",")).join(" "), fill:"url(#gradFill)", stroke:"url(#gradMood)", "stroke-width":2}));
  axes.forEach((a, i) => { const [px, py] = pt(i, Math.max(.05, (mins[a] || 0) / max)); kids.push(s("circle", {cx:px, cy:py, r:3.5, fill:"var(--ar-" + a + ")"})); });
  const box = h("section", {class:"card chart"});
  box.append(s("svg", {viewBox:"0 0 " + W + " " + H, class:"chart-svg", role:"img", "aria-label":t("balance")}, kids));
  if (!Object.keys(mins).length) box.append(h("p", {class:"muted small", text:t("wheel_empty")}));
  return box;
}
function heat(){
  const grid = h("div", {class:"heat"});
  DOW_ORDER.forEach(i => grid.append(h("small", {text:dowShort(i)})));
  const monday = addDays(T.date, -((dowOf(T.date) + 6) % 7) - 28);
  for (let i = 0; i < 35; i++){ const d = addDays(monday, i), v = d <= T.date ? dayScore(d) : null; grid.append(h("i", {class:d === T.date ? "t" : "", style:v == null ? "" : "--v:" + (v / 100).toFixed(2), title:d + (v == null ? "" : ": " + v)})); }
  return h("section", {class:"card"}, grid);
}

/* =====================================================================
   YOU: portrait, pages, memory, settings
   ===================================================================== */
function renderYou(main){
  const wrap = h("div", {class:"stack"});
  const d = S.core.dossier;
  /* portrait */
  const pc = h("section", {class:"portrait"});
  pc.append(orb("md"), h("div", {class:"eyebrow", text:t("portrait")}), h("h1", {class:"p-arch", text:d && d.archetype ? d.archetype : (S.core.name || t("you"))}));
  if (d && d.truth) pc.append(h("p", {class:"p-truth", text:"“" + d.truth + "”"}));
  if (d && d.summary) pc.append(h("p", {class:"p-sum", text:d.summary}));
  wrap.append(pc);
  if (d){
    const grid = h("div", {class:"traits"});
    [["strengths", d.strengths], ["shadows", d.shadows], ["values", d.values], ["motivators", d.motivators], ["triggers", d.triggers]].forEach(([k, a]) => { if (a && a.length) grid.append(h("section", {class:"card trait " + k}, h("div", {class:"card-k", text:t(k)}), h("ul", null, a.map(x => h("li", {text:x}))))); });
    if (d.energy) grid.append(h("section", {class:"card trait"}, h("div", {class:"card-k", text:t("energy_pattern")}), h("p", {text:d.energy})));
    if (d.worldview) grid.append(h("section", {class:"card trait"}, h("div", {class:"card-k", text:t("worldview")}), h("p", {text:d.worldview})));
    wrap.append(grid);
  }
  if (S.core.vision && S.core.vision.statement){
    wrap.append(h("section", {class:"card vision"}, h("div", {class:"card-k", text:t("vision")}), h("p", {class:"lead", text:S.core.vision.statement}), (S.core.vision.pillars || []).length ? h("div", {class:"pillars"}, S.core.vision.pillars.map(p => h("div", {class:"pillar"}, h("b", {text:p.name}), h("small", {text:p.why})))) : null));
  }
  if (S.core.rules.length) wrap.append(h("section", {class:"card"}, h("div", {class:"card-k", text:t("rules")}), h("ul", {class:"rules"}, S.core.rules.map(r => h("li", {text:r})))));
  /* pages */
  wrap.append(sectionTitle(t("pages"), h("button", {class:"link", type:"button", disabled:!aiReady() || null, onclick:e => surprise(e.currentTarget)}, t("sur_btn"))));
  const pg = h("div", {class:"pages"});
  S.pages.list.forEach(p => pg.append(h("button", {type:"button", class:"pcard", "data-m":p.mood, onclick:() => go("you", "page", p.id)}, h("i", {class:"pglow"}), !p.seen ? h("span", {class:"new", text:t("new")}) : null, h("b", {text:p.title}), h("small", {text:p.kicker}))));
  if (!S.pages.list.length) pg.append(empty(t("pages_empty")));
  wrap.append(pg);
  const askIn = h("input", {class:"field", placeholder:t("page_ask_ph")});
  wrap.append(h("form", {class:"row gap", onsubmit:e => { e.preventDefault(); const v = askIn.value.trim(); if (!v || !aiReady()) return; surprise(e.target.querySelector("button"), v); }}, askIn, h("button", {class:"btn sm", type:"submit", disabled:!aiReady() || null}, t("page_ask"))));
  /* memory */
  wrap.append(sectionTitle(t("memory"), h("small", {class:"muted", text:String(S.core.facts.length)})));
  const mem = h("div", {class:"stack tight"});
  DOMAINS.forEach(dm => {
    const fs = S.core.facts.filter(f => f.d === dm); if (!fs.length) return;
    mem.append(h("details", {class:"fold card"}, h("summary", null, h("b", {text:t("d_" + dm)}), h("small", {text:String(fs.length)})), h("ul", {class:"facts"}, fs.map(f => h("li", null, h("span", {text:f.t}), h("button", {class:"x", type:"button", "aria-label":t("forget"), onclick:e => confirmInline(e.currentTarget, "✕?", () => { S.core.facts = S.core.facts.filter(x => x !== f); save("core"); route(); })}, icon("x", 12)))))));
  });
  wrap.append(mem, h("button", {class:"btn sm", type:"button", onclick:() => go("genesis")}, icon("spark", 16), t("talk_more")));
  /* rhythm & routine */
  wrap.append(sectionTitle(t("rhythm")));
  const r = S.core.rhythm;
  const wake = h("input", {class:"field", type:"time", value:r.wake, id:"rWake"}), slp = h("input", {class:"field", type:"time", value:r.sleep, id:"rSleep"});
  const peak = h("select", {class:"field", id:"rPeak"}, ["morning","afternoon","evening"].map(p => h("option", {value:p, text:t("peak_" + p), selected:r.peak === p ? true : null})));
  const rest = h("select", {class:"field", id:"rRest"}, DOW_ORDER.map(i => h("option", {value:String(i), text:dayName(addDays("2026-10-04", i), true), selected:r.restDay === i ? true : null})));
  wrap.append(h("section", {class:"card"}, h("div", {class:"grid2"}, lab(t("wake"), wake), lab(t("sleep_t"), slp), lab(t("peak"), peak), lab(t("rest_day"), rest)), h("button", {class:"btn sm", type:"button", onclick:() => { r.wake = wake.value || r.wake; r.sleep = slp.value || r.sleep; r.peak = peak.value; r.restDay = +rest.value; save("core"); toast(t("saved"), ""); }}, t("save"))));
  const rl = h("section", {class:"card"}, h("div", {class:"card-k", text:t("routine")}));
  const all = S.core.routine.concat(S.core.fixed.filter(f => !S.core.routine.some(x => x.src === f.id)));
  if (!all.length) rl.append(empty(t("routine_empty")));
  all.sort((a, b) => a.start.localeCompare(b.start)).forEach(x => rl.append(h("div", {class:"rt", style:areaStyle(x.area)}, h("b", {text:x.start + "–" + x.end}), h("span", null, x.text, h("small", {text:DOW_ORDER.filter(i => x.dows.includes(i)).map(dowShort).join(" ") + (x.kind === "fixed" ? " · " + t("k_fixed") : "")})), h("button", {class:"x", type:"button", "aria-label":t("delete"), onclick:e => confirmInline(e.currentTarget, "✕?", () => { S.core.routine = S.core.routine.filter(y => y !== x); S.core.fixed = S.core.fixed.filter(y => y !== x && y.id !== x.src); save("core"); route(); })}, icon("x", 12)))));
  wrap.append(rl);
  /* settings */
  if (!(sampler && aiState === "ok")) wrap.append(sectionTitle(t("ai_title")), aiSetupCard(() => route()));
  wrap.append(sectionTitle(t("settings")));
  wrap.append(h("section", {class:"card"},
    h("p", {class:"q", text:t("language")}), chips(["ka","en"], lang, v => { lang = v; LS.set("lang", v); document.documentElement.lang = v; route(); }, ["ქართული","English"]),
    h("p", {class:"q", text:t("depth")}), chips(["fast","deep"], S.core.settings.depth, v => { S.core.settings.depth = v; save("core"); route(); }, [t("depth_fast"), t("depth_deep")]),
    h("p", {class:"muted small", text:t("depth_note")}),
    h("p", {class:"q", text:t("data")}),
    h("p", {class:"muted small", text:t("sync_" + syncState) + ". " + t("data_note")}),
    h("div", {class:"row gap wrap"}, h("button", {class:"btn sm", type:"button", onclick:exportData}, t("export")), h("label", {class:"btn sm", for:"imp"}, t("import")), h("input", {type:"file", id:"imp", accept:"application/json,.json", class:"sr", onchange:importData}),
      h("button", {class:"btn sm ghost", type:"button", onclick:e => confirmInline(e.currentTarget, t("confirm_reset"), resetAll)}, t("reset")))));
  main.append(wrap);
}
function lab(text, el){ return h("label", {class:"lab"}, h("small", {text}), el); }
async function exportData(){
  const name = "pulse-life-" + T.date + ".json";
  const data = JSON.stringify({app:"pulse-life", v:3, at:new Date().toISOString(), core:S.core, chat:S.chat, pages:S.pages, months:S.months, days:S.days}, null, 1);
  try {
    const dl = window.claude && claude.use ? await claude.use("downloads") : null;
    if (dl){ await dl.save({filename:name, data}); toast(t("exported"), ""); return; }
    const file = new File([data], name, {type:"application/json"});
    if (navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], title:name}); toast(t("exported"), ""); return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); toast(t("exported"), "");
  } catch(e){ if (e && e.code !== "cancelled" && e.code !== "declined" && e.name !== "AbortError") toast(t("oops"), t("export_fail")); }
}
function importData(e){
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { try { const j = JSON.parse(rd.result); if (j.app !== "pulse-life") throw 0; S.core = Object.assign(freshCore(), j.core); S.chat = j.chat || S.chat; S.pages = j.pages || S.pages; S.months = j.months || {}; S.days = j.days || {}; ["core","chat","pages"].forEach(save); Object.keys(S.months).forEach(k => save("m-" + k)); Object.keys(S.days).forEach(k => save("d-" + k)); route(); toast(t("imported"), ""); } catch(err){ toast(t("oops"), t("import_fail")); } };
  rd.readAsText(f);
}
function resetAll(){
  S.core = freshCore(); S.chat = {interview:[], coach:[]}; S.pages = {list:[]};
  Object.keys(S.months).forEach(k => { S.months[k] = {items:[], weeks:[], rules:[], summary:""}; save("m-" + k); });
  Object.keys(S.days).forEach(k => { S.days[k] = {d:{}}; save("d-" + k); });
  ["core","chat","pages"].forEach(save); go("today");
}

/* AI page view */
function renderPage(main, id){
  const p = S.pages.list.find(x => x.id === id);
  if (!p){ go("you"); return; }
  if (!p.seen){ p.seen = true; save("pages"); }
  const prev = document.documentElement.dataset.mood;
  const m = MOODS[p.mood] || MOODS.dawn, r = document.documentElement.style;
  r.setProperty("--m1", m.m1); r.setProperty("--m2", m.m2); r.setProperty("--m3", m.m3);
  const wrap = h("article", {class:"page"});
  wrap.append(h("button", {class:"link back", type:"button", onclick:() => go(view)}, icon("back", 16), t("back")), h("div", {class:"eyebrow", text:t("page_by")}), h("h1", {class:"page-h", text:p.title}), p.kicker ? h("p", {class:"lead", text:p.kicker}) : null);
  p.sections.forEach((sec, si) => {
    const box = h("section", {class:"psec " + sec.type});
    if (sec.heading) box.append(h("h2", {text:sec.heading}));
    if (sec.type === "quote") box.append(h("blockquote", {text:sec.body || sec.items.join(" ")}));
    else if (sec.body) box.append(h("p", {text:sec.body}));
    if (sec.type === "list") box.append(h("ul", null, sec.items.map(x => h("li", {text:x}))));
    if (sec.type === "steps") box.append(h("ol", {class:"steps"}, sec.items.map(x => h("li", {text:x}))));
    if (sec.type === "stats") box.append(h("div", {class:"pstats"}, sec.items.map(x => { const i = x.indexOf(":"); return h("div", null, h("small", {text:i > 0 ? x.slice(0, i) : ""}), h("b", {text:i > 0 ? x.slice(i + 1).trim() : x})); })));
    if (sec.type === "checklist") box.append(h("div", {class:"list"}, sec.items.map((x, ii) => { const k = si + ":" + ii, on = !!(p.checks || {})[k]; return h("label", {class:"crow" + (on ? " on" : "")}, h("input", {type:"checkbox", checked:on ? true : null, onchange:e => { p.checks = p.checks || {}; if (e.target.checked) p.checks[k] = 1; else delete p.checks[k]; save("pages"); e.target.parentNode.classList.toggle("on", e.target.checked); }}), h("span", {class:"ct"}, h("b", {text:x}))); })));
    wrap.append(box);
  });
  wrap.append(h("div", {class:"row gap wrap"}, h("button", {class:"btn sm", type:"button", onclick:() => { go("coach"); setTimeout(() => { const ta = $("coachIn"); if (ta){ ta.value = t("page_discuss", {x:p.title}); ta.focus(); } }, 60); }}, t("page_talk")), h("button", {class:"btn sm ghost", type:"button", onclick:e => confirmInline(e.currentTarget, t("confirm_delete"), () => { S.pages.list = S.pages.list.filter(x => x !== p); save("pages"); go("you"); })}, t("delete"))));
  main.append(wrap);
  if (prev) document.documentElement.dataset.mood = prev;
}

/* =====================================================================
   focus timer
   ===================================================================== */
let F = null, wakeLock = null, focusTick = null;
function openFocus(text, mins){
  F = {text, mins:clamp(mins || 25, 5, 180), running:false};
  sheet(t("focus"), body => renderFocusBody(body));
}
function renderFocusBody(body){
  body.innerHTML = "";
  if (!F.running){
    body.append(h("p", {class:"lead", text:F.text}), chips([15,25,50,90], F.mins, v => { F.mins = v; renderFocusBody(body); }, ["15'","25'","50'","90'"]),
      h("p", {class:"muted small", text:t("focus_note")}), h("button", {class:"btn primary", type:"button", onclick:async () => { F.running = true; F.start = Date.now(); F.end = F.start + F.mins * 60000; try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request("screen"); } catch(e){} renderFocusBody(body); }}, icon("play", 16), t("focus_start")));
    return;
  }
  const holder = h("div", {class:"focus-ring"});
  body.append(holder, h("button", {class:"btn ghost", type:"button", onclick:() => endFocus(false)}, t("stop")));
  const draw = () => {
    if (!F || !F.running || !holder.isConnected){ clearInterval(focusTick); return; }
    const left = Math.max(0, F.end - Date.now()), pct = 100 * (1 - left / (F.mins * 60000));
    holder.innerHTML = ""; holder.append(ring(pct, 240, 12, pad(Math.floor(left / 60000)) + ":" + pad(Math.floor(left / 1000) % 60), F.text));
    if (left <= 0) endFocus(true);
  };
  clearInterval(focusTick); focusTick = setInterval(draw, 1000); draw();
}
function endFocus(full){
  if (!F) return;
  const mins = Math.round((Math.min(Date.now(), F.end) - F.start) / 60000);
  const r = dayRec(T.date); r.focus = (r.focus || 0) + Math.max(0, mins); saveDay(T.date);
  try { wakeLock && wakeLock.release(); } catch(e){} wakeLock = null; clearInterval(focusTick);
  F = null; closeSheet(); route(); toast(full ? t("focus_done") : t("focus_stopped"), t("focus_logged", {m:mins}));
}

/* =====================================================================
   boot
   ===================================================================== */
function buildShell(){
  document.documentElement.lang = lang;
  $("tabs").innerHTML = "";
  [["today","today"],["plan","plan"],["coach",null],["growth","growth"],["you","you"]].forEach(([v, ic]) => {
    $("tabs").append(h("button", {type:"button", class:"tab" + (v === "coach" ? " tab-orb" : ""), "data-v":v, "aria-label":t("tab_" + v), onclick:() => go(v)}, ic ? icon(ic) : orb("sm"), h("span", {text:t("tab_" + v)})));
  });
}
let lastMin = -1, lastDate = T.date;
const alerted = new Set();
setInterval(() => {
  const n = now(); const mm = Math.floor(n.min);
  if (mm === lastMin) return; lastMin = mm; T = n;
  if (n.date !== lastDate){ lastDate = n.date; planMonth = n.ym; planDay = n.date; route(); return; }
  if (S.core.interview.done) blocksFor(T.date).forEach(b => { if (!b.time || isDone(T.date, b.id)) return; const st = toMin(b.time), key = T.date + b.id; if (T.min >= st && T.min < st + 1.2 && !alerted.has(key)){ alerted.add(key); toast(t("starting", {t:b.time}), b.text, 9000); } });
  if (view === "today" && !sub && $("sheet").hidden && !busy && S.core.interview.done){ const a = document.activeElement; if (!a || !/INPUT|TEXTAREA/.test(a.tagName)) route(); }
}, 5000);
document.addEventListener("visibilitychange", () => { if (!document.hidden){ T = now(); if (!busy) route(); } });
buildShell();
route();
connectCloud();
})();
