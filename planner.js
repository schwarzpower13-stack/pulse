/* Pulse planner: turns a free-text month plan into a scheduled month.
   Pure functions, no DOM. Works in the browser (window.PulsePlanner) and in node (module.exports). */
(function(root){
"use strict";

const AREAS = ["business","health","finance","learning","relationships","mind","home","other"];
const AREA_LABEL = {business:"Business",health:"Health",finance:"Finance",learning:"Learning",relationships:"People",mind:"Mind",home:"Home",other:"Other"};
const AREA_WORDS = {
  business:/(work|client|sales|sell|launch|meeting|investor|pitch|market|brand|smart ?cup|startup|team|hire|lawyer|deck|product|prototype|partner|campaign|business|office|project|ბიზნეს|სამსახ|კლიენტ|შეხვედრ|გაყიდ|ინვესტ|მარკეტ|ბრენდ|გუნდ|პროექტ|კომპანი)/i,
  health:/(gym|run|running|workout|train|sport|doctor|dentist|sleep|diet|walk|swim|yoga|stretch|protein|health|weight|kg|steps|სპორტ|ვარჯიშ|დარბაზ|ექიმ|ძილ|დიეტ|სირბილ|ცურვ|ჯანმრთ|სეირნ)/i,
  finance:/(money|pay|invoice|budget|tax|bank|save|saving|invest|loan|rent|salary|expense|€|\$|ფულ|გადასახ|ბიუჯეტ|ბანკ|დაზოგ|ხარჯ|ხელფას|ქირა|გადავიხად)/i,
  learning:/(learn|read|book|course|study|lesson|english|portuguese|language|practice|skill|podcast|lecture|research|წავიკითხ|კითხვ|სწავლ|კურს|წიგნ|ენა|ინგლის|პორტუგ|გაკვეთ)/i,
  relationships:/(family|friend|date|mom|mother|dad|father|wife|husband|girlfriend|boyfriend|kids|son|daughter|birthday|dinner with|call mom|ოჯახ|მეგობ|დედ|მამ|ცოლ|ქმარ|შვილ|დაბადების|პაემან)/i,
  mind:/(meditat|rest|journal|reflect|review|trip|vacation|holiday|relax|therapy|nature|pray|დასვენ|მედიტ|დღიურ|მოგზაურ|შვებულ|ფიქრ)/i,
  home:/(clean|repair|apartment|flat|house|home|laundry|groceries|shopping|fix|move|furniture|ბინ|სახლ|დალაგ|რემონტ|საყიდ|სარეცხ)/i
};
const MONTHS = [
  /^(jan|january|იანვ)/i, /^(feb|february|თებერვ)/i, /^(mar|march|მარტ)/i, /^(apr|april|აპრილ)/i,
  /^(may|მაის)/i, /^(jun|june|ივნის)/i, /^(jul|july|ივლის)/i, /^(aug|august|აგვისტ)/i,
  /^(sep|sept|september|სექტემბ)/i, /^(oct|october|ოქტომბ)/i, /^(nov|november|ნოემბ)/i, /^(dec|december|დეკემბ)/i
];
const MONTH_RX = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|იანვ\\p{L}*|თებერვ\\p{L}*|მარტ\\p{L}*|აპრილ\\p{L}*|მაის\\p{L}*|ივნის\\p{L}*|ივლის\\p{L}*|აგვისტ\\p{L}*|სექტემბ\\p{L}*|ოქტომბ\\p{L}*|ნოემბ\\p{L}*|დეკემბ\\p{L}*)";
/* weekday patterns, index = JS getUTCDay (0 = Sunday). Georgian compound names are checked before plain შაბათ. */
const DOW_RX = [
  /(^|[^\p{L}])(sun(day)?s?|კვირას|კვირაობით)(?=$|[^\p{L}])/iu,
  /(^|[^\p{L}])(mon(day)?s?|ორშაბათ\p{L}*)(?=$|[^\p{L}])/iu,
  /(^|[^\p{L}])(tue(s|sday)?s?|სამშაბათ\p{L}*)(?=$|[^\p{L}])/iu,
  /(^|[^\p{L}])(wed(nesday)?s?|ოთხშაბათ\p{L}*)(?=$|[^\p{L}])/iu,
  /(^|[^\p{L}])(thu(r|rs|rsday)?s?|ხუთშაბათ\p{L}*)(?=$|[^\p{L}])/iu,
  /(^|[^\p{L}])(fri(day)?s?|პარასკ\p{L}*)(?=$|[^\p{L}])/iu,
  /(^|[^\p{L}])(sat(urday)?s?|შაბათ(ს|ობით|ი)?)(?=$|[^\p{L}])/iu
];
const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

/* ---------- small helpers ---------- */
function pad(n){ return String(n).padStart(2,"0"); }
function toMin(hm){ if (!hm) return null; const m = String(hm).match(/^(\d{1,2}):(\d{2})$/); return m ? (+m[1])*60 + (+m[2]) : null; }
function fromMin(m){ m = Math.max(0, Math.min(23*60+59, Math.round(m))); return pad(Math.floor(m/60)) + ":" + pad(m%60); }
function daysInMonth(ym){ const [y,m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
function dateOf(ym, d){ return ym + "-" + pad(d); }
function dow(iso){ return new Date(iso + "T12:00:00Z").getUTCDay(); }
function addDays(iso, n){ const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); }
function nextMonth(ym){ let [y,m] = ym.split("-").map(Number); m++; if (m > 12){ m = 1; y++; } return y + "-" + pad(m); }
function isLastDay(iso){ return addDays(iso, 1).slice(8) === "01"; }
function fmtShort(iso){ const d = new Date(iso + "T12:00:00Z"); return d.toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"}); }
function cap(s){ s = String(s || "").trim(); return /^[a-z]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function clean(s){ return s.replace(/\s{2,}/g," ").replace(/^[\s,;:\-–—·]+|[\s,;:\-–—·]+$/g,"").trim(); }

function detectArea(text){
  for (const a of AREAS){ if (AREA_WORDS[a] && AREA_WORDS[a].test(text)) return a; }
  return "other";
}

/* ---------- line parser ---------- */
function parseLine(raw, ym){
  let s = " " + String(raw).replace(/^\s*([-*•·–]|\d+[.)])\s+/, "").trim() + " ";
  const orig = s.trim();
  const it = {raw:orig, text:"", area:"other", prio:2, dur:null, time:null, date:null, deadline:null, rec:null, count:null, kind:"task"};
  if (!orig) return null;
  let m;

  /* priority */
  const bangs = (orig.match(/!/g) || []).length;
  if (bangs >= 1 || /(important|must|urgent|critical|top priority|asap|key|მნიშვნელოვან|აუცილებ|სასწრაფ|მთავარი)/i.test(orig)) it.prio = 3;
  if (/(maybe|if time|optional|nice to have|someday|შეიძლება|თუ მოვასწრ|სურვილისამებრ)/i.test(orig)) it.prio = 1;
  s = s.replace(/!+/g, " ");

  /* duration */
  if ((m = s.match(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hours?|სთ|საათი(?!ზე)|საათ(?!ზე))(?=$|[^\p{L}])/iu))){ it.dur = Math.round(parseFloat(m[1].replace(",", ".")) * 60); s = s.replace(m[0], " "); }
  else if ((m = s.match(/(\d+)\s*(m|min|mins|minutes?|წთ|წუთ\p{L}*)(?=$|[^\p{L}])/iu))){ it.dur = +m[1]; s = s.replace(m[0], " "); }

  /* time of day */
  if ((m = s.match(/(?:\bat|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?=$|[^\p{L}\d])/iu)) || (m = s.match(/(?:^|\s)(\d{1,2}):(\d{2})\s*(am|pm)?/i)) || (m = s.match(/(?:^|\s)(\d{1,2})\s*(am|pm)\b/i) && [m[0], m[1], null, m[2]]) || (m = s.match(/(\d{1,2})(?::(\d{2}))?\s*საათზე/u))){
    let h = +m[1], mi = m[2] ? +m[2] : 0; const ap = (m[3] || "").toLowerCase();
    if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
    if (!ap && h >= 1 && h <= 6) h += 12; /* "at 3" means 15:00 in a working day */
    if (h < 24 && mi < 60){ it.time = pad(h) + ":" + pad(mi); s = s.replace(m[0], " "); }
  }

  /* recurrence */
  if ((m = s.match(/(\d+)\s*(?:x|times?|ჯერ)\s*(?:a|per|in a|\/|every)?\s*(?:week|wk|კვირ\p{L}*)/iu)) || (m = s.match(/კვირაში\s*(\d+)(?:\s*ჯერ)?/u))){ it.rec = {type:"perWeek", n:Math.min(7, +m[1])}; s = s.replace(m[0], " "); }
  else if ((m = s.match(/\b(twice|two times)\s*(a|per)\s*week\b/i))){ it.rec = {type:"perWeek", n:2}; s = s.replace(m[0], " "); }
  else if ((m = s.match(/\b(once a week|weekly|every week)\b|ყოველ\s*კვირ\p{L}*/iu))){ it.rec = {type:"perWeek", n:1}; s = s.replace(m[0], " "); }
  else if ((m = s.match(/\b(every ?day|daily|each day|every morning|every evening|every night)\b|ყოველ\s*დღე|ყოველდღე\p{L}*/iu))){ it.rec = {type:"daily"}; if (/morning/i.test(m[0])) it.pref = "morning"; if (/(evening|night)/i.test(m[0])) it.pref = "evening"; s = s.replace(m[0], " "); }
  else if ((m = s.match(/\b(weekdays|every weekday|work ?days|mon(?:day)?\s*(?:-|to|–)\s*fri(?:day)?)\b|სამუშაო დღე\p{L}*/iu))){ it.rec = {type:"dows", dows:[1,2,3,4,5]}; s = s.replace(m[0], " "); }
  else if (/\b(every|each|on)\b|ობით/iu.test(s)){
    const dows = [];
    DOW_RX.forEach((rx, i) => { const mm = s.match(rx); if (mm){ dows.push(i); } });
    if (dows.length && (/\b(every|each)\b|ობით|s\b/iu.test(s))){ it.rec = {type:"dows", dows:dows.sort()}; DOW_RX.forEach(rx => { s = s.replace(rx, "$1 "); }); s = s.replace(/\b(every|each|on)\b/ig, " "); }
  }
  if (!it.rec && /\b(weekends?)\b|შაბათ-კვირ\p{L}*/iu.test(s) && /\b(every|each|on)\b|ობით/iu.test(s)){ it.rec = {type:"dows", dows:[0,6]}; s = s.replace(/\b(every|each|on)\b|\b(weekends?)\b|შაბათ-კვირ\p{L}*/igu, " "); }

  /* count ("read 4 books", "3 posts") */
  if ((m = s.match(/(\d+)\s+(books?|articles?|videos?|posts?|reels?|chapters?|lessons?|interviews?|meetings?|calls?|leads?|წიგნ\p{L}*|პოსტ\p{L}*|ვიდეო\p{L}*|გაკვეთ\p{L}*|შეხვედრ\p{L}*|ინტერვიუ\p{L}*)/iu))){ it.count = Math.min(31, +m[1]); }

  /* deadline marker */
  const dl = /(\bby\b|\buntil\b|\btill\b|\bbefore\b|\bdeadline\b|\bdue\b|მდე|ვადა)/iu.test(s);

  /* dates */
  const [Y, M] = ym.split("-").map(Number);
  let day = null, mon = M, year = Y;
  if ((m = s.match(/(\d{4})-(\d{2})-(\d{2})/))){ year = +m[1]; mon = +m[2]; day = +m[3]; s = s.replace(m[0], " "); }
  else if ((m = s.match(new RegExp("(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?" + MONTH_RX + "(?=$|[^\\p{L}])", "iu")))){ day = +m[1]; mon = monthIndex(m[2]) || M; s = s.replace(m[0], " "); }
  else if ((m = s.match(new RegExp(MONTH_RX + "\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)", "iu")))){ day = +m[2]; mon = monthIndex(m[1]) || M; s = s.replace(m[0], " "); }
  else if ((m = s.match(/(?:^|\s)(\d{1,2})[./](\d{1,2})(?![\d.,]|\s*(?:h|hr|hour|სთ))/i))){ day = +m[1]; mon = +m[2]; s = s.replace(m[0], " "); }
  else if ((m = s.match(/(?:^|\s)(\d{1,2})(st|nd|rd|th)(?=$|[^\p{L}])/iu))){ day = +m[1]; s = s.replace(m[0], " "); }
  else if ((m = s.match(/\b(?:on the|day)\s+(\d{1,2})\b/i))){ day = +m[1]; s = s.replace(m[0], " "); }
  else if ((m = s.match(/(\d{1,2})\s*(?:-?(?:ში|ს|მდე|ნ))?\s*რიცხვ\p{L}*/u)) || (m = s.match(/(?:^|\s)(\d{1,2})-(?:ში|ს|მდე|ნ)(?=$|[^\p{L}])/u))){ day = +m[1]; s = s.replace(m[0], " "); }
  if (day){
    if (M === 12 && mon === 1) year = Y + 1;
    const dim = daysInMonth(year + "-" + pad(mon));
    if (day >= 1 && day <= dim){
      const iso = year + "-" + pad(mon) + "-" + pad(day);
      if (dl) it.deadline = iso; else it.date = iso;
    }
  }
  s = s.replace(/(\bby\b|\buntil\b|\btill\b|\bbefore\b|\bdeadline\b|\bdue\b)\s*$/i, " ");

  /* text */
  s = s.replace(/(^|\s)(maybe|if time|optional|important|urgent|must)(?=\s)/ig, " ");
  it.text = cap(clean(s.replace(/\s+(on|at|the|by|until|before)\s*$/i, " "))) || orig;
  it.area = detectArea(orig);

  /* kind */
  const projectRx = /(launch|build|create|write|develop|design|finish|prepare|complete|project|website|landing|app\b|campaign|deck|brief|strategy|plan for|ააწყ|დავწერ|შევქმნ|შექმნ|დავასრულ|მოვამზად|პროექტ|გავუშვ|დავგეგმ)/i;
  const adminRx = /(^|\s)(call|email|e-mail|mail|message|reply|pay|order|buy|send|text|book a|schedule|sign|renew|დარეკ|მეილ|გადავიხად|ვიყიდ|გავგზავნ|მივწერ|დავურეკ)/i;
  if (it.rec) it.kind = "habit";
  else if (it.count && it.count > 1) it.kind = "series";
  else if (it.time && it.date) it.kind = "event";
  else if (projectRx.test(orig) && (!it.dur || it.dur >= 180) && !adminRx.test(orig.split(/\s+/).slice(0,2).join(" "))) it.kind = "project";
  else if (adminRx.test(orig)) it.kind = "admin";
  return it;
}
function monthIndex(word){ for (let i=0;i<12;i++){ if (MONTHS[i].test(word)) return i+1; } return null; }

function parsePlan(text, ym){
  return String(text || "").split(/\n|;/).map(l => l.trim()).filter(l => l && !/^#/.test(l) && !/^[A-Za-zა-ჰ ]{2,24}:$/.test(l)).map(l => parseLine(l, ym)).filter(Boolean);
}

/* ---------- the day model ---------- */
function peakWindow(profile){
  const wake = toMin(profile.wake) || 420, sleep = toMin(profile.sleep) || 1410;
  const w = profile.peak === "evening" ? [18*60, 21*60+30] : profile.peak === "afternoon" ? [13*60, 16*60+30] : [wake+60, wake+60+210];
  return [Math.max(w[0], wake+30), Math.min(w[1], sleep-45)];
}
function makeDay(iso, profile, fixed, existing, energyByDow){
  const wake = toMin(profile.wake) || 420, sleep = toMin(profile.sleep) || 1410;
  const d = dow(iso);
  const day = {date:iso, dow:d, start:wake+30, end:sleep-45, busy:[], load:0, deep:0, items:[], rest: d === (profile.restDay == null ? 0 : +profile.restDay)};
  (fixed || []).forEach(f => { if ((f.days || []).includes(d)){ const a = toMin(f.start), b = toMin(f.end); if (a != null && b != null && b > a) day.busy.push([a, b]); } });
  (existing || []).forEach(p => { if (p.date === iso && p.time){ const a = toMin(p.time); day.busy.push([a, a + (p.dur || 30)]); day.load += (p.dur || 30); } });
  const free = Math.max(60, day.end - day.start - day.busy.reduce((s, b) => s + (b[1]-b[0]), 0));
  let f = 0.62;
  const e = energyByDow && energyByDow[d];
  if (e) f *= 0.8 + (e - 3) * 0.1;
  if (day.rest) f *= 0.4;
  day.cap = Math.round(free * f);
  return day;
}
function fits(day, a, dur){
  if (a < day.start || a + dur > day.end) return false;
  for (const b of day.busy){ if (a < b[1] + 10 && a + dur + 10 > b[0]) return false; }
  return true;
}
function findSlot(day, dur, pref, profile){
  const pk = peakWindow(profile);
  const ranges = [];
  if (pref === "peak") ranges.push(pk);
  else if (pref === "morning") ranges.push([day.start, day.start + 180]);
  else if (pref === "evening") ranges.push([Math.max(day.start, 18*60), day.end]);
  else if (pref === "afternoon") ranges.push([13*60, 17*60+30]);
  else if (pref === "off"){ ranges.push([pk[1], day.end]); ranges.push([day.start, pk[0]]); }
  ranges.push([day.start, day.end]);
  for (const r of ranges){
    for (let a = Math.ceil(Math.max(r[0], day.start)/15)*15; a + dur <= Math.min(r[1] + dur, day.end); a += 15){
      if (a + dur > r[1] && r[1] !== day.end) break;
      if (fits(day, a, dur)) return a;
    }
  }
  return null;
}
function put(day, it, start){
  const dur = it.dur || 30;
  const out = {date:day.date, time:start == null ? null : fromMin(start), dur, text:it.text, area:it.area || "other", prio:it.prio || 2, kind:it.kind || "task"};
  if (start != null) day.busy.push([start, start + dur]);
  day.load += dur; if (out.kind === "deep") day.deep += dur;
  day.items.push(out);
  return out;
}

/* ---------- build ---------- */
function build(input){
  const ym = input.month;
  const profile = Object.assign({wake:"07:00", sleep:"23:30", peak:"morning", restDay:0}, input.profile || {});
  const fixed = input.fixed || [];
  const dim = daysInMonth(ym);
  const today = input.today || dateOf(ym, 1);
  const first = today > dateOf(ym, 1) ? today : dateOf(ym, 1);
  const days = [];
  for (let d = 1; d <= dim; d++){ const iso = dateOf(ym, d); if (iso >= first) days.push(makeDay(iso, profile, fixed, input.existing, input.energyByDow)); }
  if (!days.length) return {month:ym, items:[], weeks:[], rules:["This month is already over."], stats:{}, summary:"Nothing left to plan."};
  const byDate = {}; days.forEach(d => byDate[d.date] = d);
  const lines = parsePlan(input.text, ym);
  (input.top3 || []).filter(Boolean).forEach(t => { const it = parseLine(t, ym); if (it){ it.prio = 3; it.top = true; if (it.kind === "task") it.kind = "project"; lines.unshift(it); } });
  const out = [], warn = [];
  const idx = iso => days.findIndex(d => d.date === iso);
  const within = (from, to) => days.filter(d => d.date >= from && d.date <= to);
  const leastLoaded = (cands, dur, pref, allowRest) => {
    let best = null, bestScore = Infinity;
    cands.forEach((d, i) => {
      if (d.rest && !allowRest) return;
      if (d.load + dur > d.cap * 1.15) return;
      const slot = findSlot(d, dur, pref, profile); if (slot == null) return;
      const score = d.load / Math.max(1, d.cap) + i * 0.012;
      if (score < bestScore){ bestScore = score; best = {d, slot}; }
    });
    return best;
  };
  const place = (it, cands, pref, allowRest) => {
    const b = leastLoaded(cands, it.dur, pref, allowRest) || leastLoaded(cands, it.dur, "any", true);
    if (!b){ warn.push(it.text); return null; }
    const o = put(b.d, it, b.slot); out.push(o); return o;
  };
  const prefFor = it => it.pref || (it.kind === "deep" || it.kind === "project" ? "peak" : it.area === "health" ? (profile.peak === "morning" ? "evening" : "morning") : it.area === "learning" || it.area === "relationships" ? "evening" : it.kind === "admin" ? "afternoon" : "off");

  /* 1. rituals that keep the system alive */
  days.forEach((d, i) => {
    if (d.dow === 1 || i === 0) out.push(put(d, {text: i === 0 && d.date.slice(8) === "01" ? "Month kick-off: read the plan, set this week's top 3" : "Week planning: choose this week's top 3", dur:20, area:"mind", prio:2, kind:"ritual"}, findSlot(d, 20, "morning", profile)));
    if (d.dow === 0 && !isLastDay(d.date)) out.push(put(d, {text:"Weekly review: wins, misses, move what slipped", dur:30, area:"mind", prio:2, kind:"ritual"}, findSlot(d, 30, "evening", profile)));
    if (isLastDay(d.date)) out.push(put(d, {text:"Month review + write next month's plan in Pulse", dur:45, area:"mind", prio:3, kind:"ritual"}, fits(d, 21*60, 45) ? 21*60 : findSlot(d, 45, "evening", profile)));
  });

  /* 2. dated items */
  lines.filter(it => it.date && !it.rec && it.kind !== "series").forEach(it => {
    const d = byDate[it.date];
    if (!it.dur) it.dur = it.kind === "admin" ? 20 : it.kind === "project" ? 120 : 60;
    if (it.kind === "project") it.kind = "deep";
    if (!d){ if (it.date >= first) warn.push(it.text + " (outside this month)"); return; }
    const t = it.time ? toMin(it.time) : findSlot(d, it.dur, prefFor(it), profile);
    const o = put(d, it, t); out.push(o);
    if (it.time && !fits(Object.assign({}, d, {busy:d.busy.slice(0,-1)}), t, it.dur)) o.conflict = true;
  });

  /* 3. habits */
  lines.filter(it => it.rec).forEach(it => {
    if (!it.dur) it.dur = it.area === "health" ? 60 : it.area === "learning" ? 30 : it.area === "mind" ? 15 : 30;
    let targets = [];
    if (it.rec.type === "daily") targets = days;
    else if (it.rec.type === "dows") targets = days.filter(d => it.rec.dows.includes(d.dow));
    else {
      const weeks = {}; days.forEach(d => { const k = addDays(d.date, -((d.dow + 6) % 7)); (weeks[k] = weeks[k] || []).push(d); });
      Object.values(weeks).forEach(w => {
        const n = Math.max(1, Math.round(it.rec.n * w.length / 7));
        const pool = w.filter(d => !d.rest).length >= n ? w.filter(d => !d.rest) : w;
        for (let k = 0; k < n && k < pool.length; k++) targets.push(pool[Math.min(pool.length-1, Math.floor((k + 0.5) * pool.length / n))]);
      });
    }
    const pref = prefFor(it);
    targets.forEach(d => {
      const t = it.time ? toMin(it.time) : findSlot(d, it.dur, pref, profile);
      out.push(put(d, Object.assign({}, it, {kind:"habit"}), t));
    });
  });

  /* 4. projects, split into phases, finished before the deadline with a buffer */
  const endIdx = Math.max(0, days.length - 1);
  lines.filter(it => it.kind === "project" && !it.date).sort((a,b) => b.prio - a.prio).forEach(it => {
    let last = it.deadline && byDate[addDays(it.deadline, -1)] ? idx(addDays(it.deadline, -1)) : it.deadline && byDate[it.deadline] ? idx(it.deadline) : Math.round(endIdx * (it.prio >= 3 ? 0.72 : it.prio === 2 ? 0.85 : 1));
    last = Math.max(0, Math.min(endIdx, last));
    const sessions = Math.max(2, Math.min(16, it.dur ? Math.ceil(it.dur / 90) : it.prio >= 3 ? 8 : it.prio === 2 ? 5 : 3));
    const phases = [["Outline", 0.2], ["Build", 0.45], ["Finish", 0.25], ["Polish & ship", 0.1]];
    const plan = [];
    phases.forEach(([name, share], pi) => { const n = pi === phases.length-1 ? sessions - plan.length : Math.max(1, Math.round(sessions * share)); for (let j = 0; j < n && plan.length < sessions; j++) plan.push(name); });
    plan.forEach((phase, j) => {
      const target = Math.round((j + 1) * last / plan.length);
      const lo = Math.max(0, target - 2), hi = Math.min(last, target + 1);
      const o = place({text:phase + " · " + it.text + " (" + (j+1) + "/" + plan.length + ")", dur:90, area:it.area, prio:it.prio, kind:"deep"}, days.slice(lo, hi + 1), "peak", false);
      if (o && j === plan.length - 1) o.text = "Ship · " + it.text;
    });
    if (it.deadline && byDate[it.deadline]) out.push(put(byDate[it.deadline], {text:"Deadline · " + it.text, dur:15, area:it.area, prio:3, kind:"ritual"}, findSlot(byDate[it.deadline], 15, "morning", profile)));
  });

  /* 5. series ("read 4 books", "publish 8 posts") spread evenly */
  lines.filter(it => it.kind === "series" && !it.rec).forEach(it => {
    const n = it.count, dur = it.dur || (it.area === "learning" ? 60 : 45);
    const last = it.deadline && byDate[it.deadline] ? idx(it.deadline) : endIdx;
    for (let j = 0; j < n; j++){
      const target = Math.round((j + 0.6) * last / n);
      place({text:it.text + " (" + (j+1) + "/" + n + ")", dur, area:it.area, prio:it.prio, kind:"task"}, days.slice(Math.max(0, target - 2), Math.min(last, target + 2) + 1), prefFor(it), false);
    }
  });

  /* 6. admin items batched into two blocks a week */
  const admin = lines.filter(it => it.kind === "admin" && !it.date);
  if (admin.length){
    const slots = days.filter(d => (d.dow === 2 || d.dow === 4) && !d.rest);
    const byDeadline = admin.slice().sort((a,b) => (b.prio - a.prio) || String(a.deadline || "9").localeCompare(String(b.deadline || "9")));
    const groups = [];
    byDeadline.forEach(it => {
      const limit = it.deadline ? addDays(it.deadline, -1) : null;
      let g = groups.find(g => g.items.length < 5 && (!limit || g.day.date <= limit));
      if (!g){
        const d = slots.find(d => !groups.some(x => x.day === d) && (!limit || d.date <= limit)) || (limit ? within(first, limit).slice(-1)[0] : null) || slots[groups.length % Math.max(1, slots.length)] || days[0];
        g = {day:d, items:[]}; groups.push(g);
      }
      g.items.push(it);
    });
    groups.forEach(g => {
      const dur = Math.min(120, 10 + g.items.reduce((s, it) => s + (it.dur || 15), 0));
      const t = findSlot(g.day, dur, "afternoon", profile);
      out.push(put(g.day, {text:"Admin batch: " + g.items.map(x => x.text).join(" · "), dur, area:g.items[0].area, prio:Math.max.apply(null, g.items.map(x => x.prio)), kind:"admin"}, t));
    });
  }

  /* 7. everything else, front-loaded by priority */
  lines.filter(it => it.kind === "task" && !it.date && !it.rec).sort((a,b) => b.prio - a.prio).forEach(it => {
    it.dur = it.dur || 45;
    let lo = 0, hi = endIdx;
    if (it.deadline && byDate[it.deadline]) hi = Math.max(0, idx(it.deadline) - 1);
    else if (it.prio >= 3) hi = Math.min(endIdx, 9);
    else if (it.prio === 2) hi = Math.min(endIdx, Math.round(endIdx * 0.65));
    else lo = Math.min(endIdx, 7);
    place(it, days.slice(lo, hi + 1), prefFor(it), it.area === "relationships" || it.area === "mind");
  });

  /* stars: the top 3 per day */
  days.forEach(d => {
    d.items.filter(o => o.kind !== "ritual" && o.kind !== "habit").sort((a,b) => (b.prio - a.prio) || ((b.kind === "deep") - (a.kind === "deep"))).slice(0,3).forEach(o => o.star = true);
  });

  out.sort((a,b) => a.date === b.date ? String(a.time || "99").localeCompare(String(b.time || "99")) : a.date < b.date ? -1 : 1);

  /* weeks */
  const weeks = [];
  days.forEach(d => {
    const k = addDays(d.date, -((d.dow + 6) % 7));
    let w = weeks.find(x => x.key === k);
    if (!w){ w = {key:k, from:d.date, to:d.date, items:[]}; weeks.push(w); }
    w.to = d.date; w.items.push.apply(w.items, d.items);
  });
  const weeksOut = weeks.map((w, i) => {
    const core = w.items.filter(o => o.kind !== "ritual" && o.kind !== "habit");
    const count = {}; core.forEach(o => count[o.area] = (count[o.area] || 0) + o.dur * o.prio);
    const top = Object.keys(count).sort((a,b) => count[b] - count[a])[0];
    const deep = core.filter(o => o.kind === "deep");
    const theme = deep.length ? deep[0].text.replace(/ \(\d+\/\d+\)$/, "").replace(/^(Outline|Build|Finish|Polish & ship|Ship) · /, (m0, p) => p + ": ") : top ? AREA_LABEL[top] + " week" : "Light week";
    const focus = []; core.slice().sort((a,b) => (b.prio - a.prio) || (b.dur - a.dur)).forEach(o => { const t = o.text.replace(/ \(\d+\/\d+\)$/, ""); if (focus.length < 3 && !focus.includes(t)) focus.push(t); });
    return {label:"Week " + (i+1) + " · " + fmtShort(w.from) + (w.from !== w.to ? "–" + fmtShort(w.to) : ""), theme, focus, from:w.from, to:w.to};
  });

  /* stats + rules */
  const mins = out.reduce((s, o) => s + o.dur, 0);
  const capMins = days.reduce((s, d) => s + d.cap, 0);
  const deepMins = out.filter(o => o.kind === "deep").reduce((s, o) => s + o.dur, 0);
  const areas = {}; out.forEach(o => areas[o.area] = (areas[o.area] || 0) + o.dur);
  const half = days[Math.floor(days.length / 2)] ? days[Math.floor(days.length / 2)].date : ym;
  const important = out.filter(o => o.prio >= 3 && o.kind !== "ritual");
  const frontShare = important.length ? Math.round(100 * important.filter(o => o.date < half).length / important.length) : 0;
  const pk = peakWindow(profile);
  const rules = [];
  rules.push("Deep work sits in your peak window, " + fromMin(pk[0]) + "–" + fromMin(pk[1]) + ". Phone in another room, one task only.");
  rules.push("Every day has at most 3 starred items. Finish the stars before anything else.");
  if (admin.length) rules.push(admin.length + " calls, emails and payments are batched into admin blocks on Tuesdays and Thursdays instead of breaking your focus every day.");
  if (important.length) rules.push(frontShare + "% of your important work lands in the first half of the month, so there is a buffer when something slips.");
  if (input.energyByDow){ const lowD = input.energyByDow.map((e, i) => [e, i]).filter(x => x[0]).sort((a,b) => a[0] - b[0])[0]; if (lowD && lowD[0] < 3) rules.push("Your check-ins show lower energy on " + DOW_SHORT[lowD[1]] + ", so that day gets a lighter load."); }
  rules.push("Rest day (" + DOW_SHORT[profile.restDay == null ? 0 : +profile.restDay] + ") carries only light, personal items. Recovery is part of the plan.");
  const low = lines.filter(it => it.prio === 1).length;
  if (low) rules.push(low + " low-priority " + (low === 1 ? "item was" : "items were") + " pushed to the second half. If they are still open by day 20, delete or delegate them.");
  if (mins > capMins) rules.push("Warning: this plan needs " + Math.round(mins/60) + "h but you have about " + Math.round(capMins/60) + "h of real capacity. Cut or delegate before you start.");
  if (warn.length) rules.push("Could not fit: " + warn.slice(0,5).join("; ") + (warn.length > 5 ? " and " + (warn.length - 5) + " more" : "") + ".");

  const summary = lines.length + " goals and tasks turned into " + out.length + " scheduled blocks over " + days.length + " days: " + Math.round(mins/60) + "h planned, " + Math.round(deepMins/60) + "h of deep work, load " + Math.round(100 * mins / Math.max(1, capMins)) + "% of capacity.";
  return {month:ym, items:out, weeks:weeksOut, rules, summary, source:"local",
    stats:{lines:lines.length, blocks:out.length, hours:Math.round(mins/6)/10, deepHours:Math.round(deepMins/6)/10, capacityHours:Math.round(capMins/6)/10, load:Math.round(100 * mins / Math.max(1, capMins)), areas, frontShare, unplaced:warn.length}};
}

const API = {build, parseLine, parsePlan, detectArea, toMin, fromMin, daysInMonth, addDays, nextMonth, isLastDay, dow, peakWindow, AREAS, AREA_LABEL, DOW_SHORT};
if (typeof module !== "undefined" && module.exports) module.exports = API; else root.PulsePlanner = API;
})(typeof self !== "undefined" ? self : this);
