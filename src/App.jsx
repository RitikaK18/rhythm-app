import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
} from "recharts";
import {
  Dumbbell, Cookie, Moon, Battery, Smile, Droplet, ChevronLeft,
  ChevronRight, CalendarDays, Activity, NotebookPen, Check, Coffee, Wine,
  Settings, Download,
} from "lucide-react";

/* ----------------------------- date helpers ----------------------------- */
const ymd = (d) => d.toLocaleDateString("en-CA");
const fromYmd = (s) => { const [y, m, dd] = s.split("-").map(Number); return new Date(y, m - 1, dd); };
const addDays = (s, n) => { const d = fromYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const diffDays = (a, b) => Math.round((fromYmd(a) - fromYmd(b)) / 86400000);
const niceDate = (s) => fromYmd(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const TODAY = ymd(new Date());

/* ------------------------------- constants ------------------------------- */
const PHASE = {
  menstrual:  { label: "Menstrual",  color: "#C0524A" },
  follicular: { label: "Follicular", color: "#E0A458" },
  ovulation:  { label: "Ovulation",  color: "#6FA37A" },
  luteal:     { label: "Luteal",     color: "#A6789E" },
};
const PHASE_ORDER = ["menstrual", "follicular", "ovulation", "luteal"];
const BLEED = ["light", "medium", "heavy"];
const FLOWS = [
  { id: "none", label: "None", color: "#D8CFC0" },
  { id: "spotting", label: "Spotting", color: "#E0A9A0" },
  { id: "light", label: "Light", color: "#D17B6E" },
  { id: "medium", label: "Medium", color: "#C0524A" },
  { id: "heavy", label: "Heavy", color: "#8F362F" },
];
const ENERGY_LABELS = ["", "Drained", "Low", "Okay", "Good", "Peak"];
const MOOD_LABELS = ["", "Rough", "Low", "Neutral", "Good", "Great"];
const CLASS_CARDIO = ["Cycling", "Dance", "Other"];
const CLASS_STRENGTH = ["Stronger", "Upper body", "Lower body"];
const SELF_TYPES = ["Strength training", "Steady-state cardio"];
const CRAVINGS = ["Sugar", "Salt", "Carbs", "Chocolate"];
const SYMPTOMS = ["Cramps", "Bloating", "Headache", "Fatigue", "Tender breasts", "Backache", "Nausea", "Acne", "Low mood", "Anxiety", "Poor sleep"];

/* ------------------------------ cycle logic ------------------------------ */
function getPeriodStarts(entries) {
  const dates = Object.keys(entries).sort();
  const starts = [];
  for (const d of dates) {
    const e = entries[d];
    if (e && BLEED.includes(e.flow)) {
      const prev = entries[addDays(d, -1)];
      if (!prev || !BLEED.includes(prev.flow)) starts.push(d);
    }
  }
  return starts;
}
function avgCycle(starts) {
  if (starts.length < 2) return 28;
  const diffs = [];
  for (let i = 1; i < starts.length; i++) diffs.push(diffDays(starts[i], starts[i - 1]));
  const recent = diffs.slice(-6).filter((x) => x >= 18 && x <= 45);
  if (!recent.length) return 28;
  return Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
}
function avgPeriodLen(entries, starts) {
  if (!starts.length) return 5;
  const lens = [];
  for (const s of starts) {
    let len = 0, d = s;
    while (entries[d] && BLEED.includes(entries[d].flow)) { len++; d = addDays(d, 1); }
    if (len > 0) lens.push(len);
  }
  if (!lens.length) return 5;
  return Math.max(2, Math.round(lens.reduce((a, b) => a + b, 0) / lens.length));
}
function phaseFor(day, cycleLen, periodLen) {
  if (day < 1) return null;
  const ov = Math.max(periodLen + 3, cycleLen - 14);
  if (day <= periodLen) return "menstrual";
  if (day < ov - 1) return "follicular";
  if (day <= ov + 1) return "ovulation";
  return "luteal";
}
function entryPhase(date, starts, cycleLen, periodLen) {
  let s = null;
  for (const st of starts) { if (st <= date) s = st; else break; }
  if (!s) return null;
  const day = diffDays(date, s) + 1;
  if (day > cycleLen + 12) return null;
  return phaseFor(day, cycleLen, periodLen);
}

/* --------------------------- storage + sync ----------------------------- */
const LS_KEY = "rhythm-data-v1";
const URL_KEY = "rhythm-sheet-url";
const TOKEN_KEY = "rhythm-sheet-token";
const COLUMNS = ["Date", "Flow", "Energy", "Mood", "Sleep", "Worked out", "Mode", "Class", "Self types", "Duration", "New high", "Treat", "Cravings", "Caffeine", "Caffeine servings", "Alcohol", "Drinks", "Symptoms", "Cycle day", "Phase", "Notes"];

function loadLocal() {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : { entries: {} }; }
  catch { return { entries: {} }; }
}
function saveLocal(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* quota / private mode */ }
}

function cycleDayFor(date, entries) {
  const starts = getPeriodStarts(entries);
  const cycleLen = avgCycle(starts);
  const periodLen = avgPeriodLen(entries, starts);
  let s = null;
  for (const st of starts) { if (st <= date) s = st; else break; }
  if (!s) return { cycleDay: null, phase: null };
  const day = diffDays(date, s) + 1;
  if (day > cycleLen + 12) return { cycleDay: null, phase: null };
  return { cycleDay: day, phase: phaseFor(day, cycleLen, periodLen) };
}

function entryToRow(date, e, cycleDay, phase) {
  return {
    "Date": date,
    "Flow": e.flow || "",
    "Energy": e.energy || "",
    "Mood": e.mood || "",
    "Sleep": e.sleep || "",
    "Worked out": e.didWorkout ? "Yes" : "",
    "Mode": e.workoutMode || "",
    "Class": e.workoutClass || "",
    "Self types": (e.workoutSelf || []).join("; "),
    "Duration": e.workoutDuration || "",
    "New high": e.prNote || "",
    "Treat": e.treat ? "Yes" : "",
    "Cravings": (e.cravings || []).join("; "),
    "Caffeine": e.caffeine ? "Yes" : "",
    "Caffeine servings": e.caffeineAmt || "",
    "Alcohol": e.alcohol ? "Yes" : "",
    "Drinks": e.alcoholAmt || "",
    "Symptoms": (e.symptoms || []).join("; "),
    "Cycle day": cycleDay || "",
    "Phase": phase ? PHASE[phase].label : "",
    "Notes": e.notes || "",
  };
}

const numv = (v) => { const n = Number(v); return (v === "" || v == null || isNaN(n)) ? undefined : n; };
const listv = (v) => (v ? String(v).split(/;\s*/).map((x) => x.trim()).filter(Boolean) : undefined);
const yesv = (v) => (String(v).toLowerCase() === "yes" || v === true) ? true : undefined;

function rowToEntry(row) {
  const date = String(row["Date"] || "").trim();
  if (!date) return null;
  const e = { date };
  if (row["Flow"]) e.flow = String(row["Flow"]).trim();
  if (numv(row["Energy"])) e.energy = numv(row["Energy"]);
  if (numv(row["Mood"])) e.mood = numv(row["Mood"]);
  if (numv(row["Sleep"])) e.sleep = numv(row["Sleep"]);
  if (yesv(row["Worked out"])) e.didWorkout = true;
  if (row["Mode"]) e.workoutMode = String(row["Mode"]).trim();
  if (row["Class"]) e.workoutClass = String(row["Class"]).trim();
  if (listv(row["Self types"])) e.workoutSelf = listv(row["Self types"]);
  if (numv(row["Duration"])) e.workoutDuration = numv(row["Duration"]);
  if (row["New high"]) e.prNote = String(row["New high"]);
  if (yesv(row["Treat"])) e.treat = true;
  if (listv(row["Cravings"])) e.cravings = listv(row["Cravings"]);
  if (yesv(row["Caffeine"])) e.caffeine = true;
  if (numv(row["Caffeine servings"])) e.caffeineAmt = numv(row["Caffeine servings"]);
  if (yesv(row["Alcohol"])) e.alcohol = true;
  if (numv(row["Drinks"])) e.alcoholAmt = numv(row["Drinks"]);
  if (listv(row["Symptoms"])) e.symptoms = listv(row["Symptoms"]);
  if (row["Notes"]) e.notes = String(row["Notes"]);
  return e;
}

async function pullSheet(url, token) {
  const u = url + (url.includes("?") ? "&" : "?") + "action=read" + (token ? "&token=" + encodeURIComponent(token) : "");
  const res = await fetch(u, { method: "GET" });
  const json = await res.json();
  const entries = {};
  (json.rows || []).forEach((row) => { const e = rowToEntry(row); if (e) entries[e.date] = e; });
  return entries;
}
async function pushRow(url, token, row) {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // simple request -> no CORS preflight
    body: JSON.stringify({ token: token || "", row }),
  });
}

/* ----------------------------- small UI bits ----------------------------- */
function Chip({ active, onClick, children, color }) {
  return (
    <button onClick={onClick} className="chip" data-active={active ? "1" : "0"}
      style={active && color ? { background: color, borderColor: color, color: "#fff" } : undefined}>
      {children}
    </button>
  );
}
function Scale({ value, onChange, labels, accent }) {
  return (
    <div>
      <div className="scale-row">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => onChange(value === n ? null : n)}
            className="scale-dot" data-active={value === n ? "1" : "0"}
            style={value === n ? { background: accent, borderColor: accent, color: "#fff" } : undefined}>
            {n}
          </button>
        ))}
      </div>
      <div className="scale-label">{value ? labels[value] : "Not set"}</div>
    </div>
  );
}

/* ------------------------------- cycle ring ------------------------------ */
function PhaseRing({ cycleDay, phase, cycleLen, periodLen, next }) {
  const r = 78, cx = 100, cy = 100, C = 2 * Math.PI * r;
  const ov = Math.max(periodLen + 3, cycleLen - 14);
  const segs = [
    { phase: "menstrual", days: periodLen },
    { phase: "follicular", days: Math.max(1, ov - 2 - periodLen) },
    { phase: "ovulation", days: 3 },
    { phase: "luteal", days: Math.max(1, cycleLen - (ov + 1)) },
  ];
  const total = segs.reduce((a, s) => a + s.days, 0);
  let off = 0;
  const progress = cycleDay ? Math.min(1, (cycleDay - 0.5) / total) : null;
  const ang = progress != null ? -90 + 360 * progress : null;
  const mx = ang != null ? cx + r * Math.cos((ang * Math.PI) / 180) : 0;
  const my = ang != null ? cy + r * Math.sin((ang * Math.PI) / 180) : 0;
  return (
    <div className="ring-wrap">
      <svg viewBox="0 0 200 200" className="ring-svg">
        <g transform="rotate(-90 100 100)">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EAE2D4" strokeWidth="14" />
          {segs.map((s, i) => {
            const len = (s.days / total) * C;
            const el = (
              <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                stroke={PHASE[s.phase].color} strokeWidth="14"
                strokeDasharray={`${len - 2.5} ${C - len + 2.5}`}
                strokeDashoffset={-off} opacity={phase === s.phase ? 1 : 0.42}
                strokeLinecap="round" />
            );
            off += len;
            return el;
          })}
        </g>
        {ang != null && (
          <circle cx={mx} cy={my} r="7" fill="#FBF8F2" stroke="#2E2A26" strokeWidth="2.5" />
        )}
        <text x="100" y="92" textAnchor="middle" className="ring-day">
          {cycleDay ? `Day ${cycleDay}` : "Day —"}
        </text>
        <text x="100" y="118" textAnchor="middle" className="ring-phase"
          fill={phase ? PHASE[phase].color : "#8A7F72"}>
          {phase ? PHASE[phase].label : "Log a period"}
        </text>
      </svg>
      <div className="ring-next">
        {next ? `Next period ~ ${niceDate(next)}` : "Mark period days to see predictions"}
      </div>
    </div>
  );
}

/* ------------------------------ today panel ------------------------------ */
function TodayPanel({ date, setDate, entry, update, toggleArr }) {
  const e = entry || {};
  return (
    <div className="panel">
      <div className="datebar">
        <button className="iconbtn" onClick={() => setDate(addDays(date, -1))}><ChevronLeft size={20} /></button>
        <div className="datebar-mid">
          <div className="datebar-day">{date === TODAY ? "Today" : niceDate(date)}</div>
          {date !== TODAY && <button className="textbtn" onClick={() => setDate(TODAY)}>jump to today</button>}
        </div>
        <button className="iconbtn" onClick={() => date < TODAY && setDate(addDays(date, 1))}
          style={{ opacity: date < TODAY ? 1 : 0.3 }}><ChevronRight size={20} /></button>
      </div>

      <Section icon={<Droplet size={17} />} title="Period flow">
        <div className="chips">
          {FLOWS.map((f) => (
            <Chip key={f.id} active={e.flow === f.id} color={f.color}
              onClick={() => update(date, { flow: e.flow === f.id ? undefined : f.id })}>
              <span className="dot" style={{ background: f.color }} />{f.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section icon={<Battery size={17} />} title="Energy">
        <Scale value={e.energy} onChange={(v) => update(date, { energy: v })} labels={ENERGY_LABELS} accent="#6FA37A" />
      </Section>

      <Section icon={<Smile size={17} />} title="Mood">
        <Scale value={e.mood} onChange={(v) => update(date, { mood: v })} labels={MOOD_LABELS} accent="#C0613F" />
      </Section>

      <Section icon={<Moon size={17} />} title="Sleep">
        <div className="sleep-row">
          {[4, 5, 6, 7, 8, 9, 10].map((h) => (
            <button key={h} className="sleep-pill" data-active={e.sleep === h ? "1" : "0"}
              onClick={() => update(date, { sleep: e.sleep === h ? undefined : h })}>
              {h}{h === 10 ? "+" : ""}
            </button>
          ))}
          <span className="unit">hrs</span>
        </div>
      </Section>

      <Section icon={<Dumbbell size={17} />} title="Movement">
        <button className="toggle" data-active={e.didWorkout ? "1" : "0"}
          onClick={() => update(date, e.didWorkout
            ? { didWorkout: undefined, workoutMode: undefined, workoutClass: undefined, workoutSelf: undefined, prNote: undefined }
            : { didWorkout: true })}>
          {e.didWorkout ? <Check size={16} /> : null}
          {e.didWorkout ? "Worked out" : "Rest day — tap if you trained"}
        </button>
        {e.didWorkout && (
          <>
            <div className="seg mt">
              <button data-active={e.workoutMode === "self" ? "1" : "0"}
                onClick={() => update(date, { workoutMode: "self", workoutClass: undefined })}>Self-training</button>
              <button data-active={e.workoutMode === "class" ? "1" : "0"}
                onClick={() => update(date, { workoutMode: "class", workoutSelf: undefined, prNote: undefined })}>Class</button>
            </div>

            {e.workoutMode === "class" && (
              <>
                <div className="craving-label">Cardio class</div>
                <div className="chips">
                  {CLASS_CARDIO.map((c) => (
                    <Chip key={c} active={e.workoutClass === c} color="#6FA37A"
                      onClick={() => update(date, { workoutClass: e.workoutClass === c ? undefined : c })}>{c}</Chip>
                  ))}
                </div>
                <div className="craving-label">Strength class</div>
                <div className="chips">
                  {CLASS_STRENGTH.map((c) => (
                    <Chip key={c} active={e.workoutClass === c} color="#C0613F"
                      onClick={() => update(date, { workoutClass: e.workoutClass === c ? undefined : c })}>{c}</Chip>
                  ))}
                </div>
              </>
            )}

            {e.workoutMode === "self" && (
              <>
                <div className="chips mt">
                  {SELF_TYPES.map((s) => (
                    <Chip key={s} active={(e.workoutSelf || []).includes(s)} color="#C0613F"
                      onClick={() => toggleArr(date, "workoutSelf", s)}>{s}</Chip>
                  ))}
                </div>
                <input className="pr-input" placeholder="New high? e.g. squat PR, 5k time, top speed…"
                  value={e.prNote || ""} onChange={(ev) => update(date, { prNote: ev.target.value })} />
              </>
            )}

            {e.workoutMode && (
              <div className="sleep-row mt">
                <span className="unit" style={{ marginLeft: 0, marginRight: 6 }}>Duration</span>
                {[15, 30, 45, 60, 75, 90].map((m) => (
                  <button key={m} className="sleep-pill" data-active={e.workoutDuration === m ? "1" : "0"}
                    onClick={() => update(date, { workoutDuration: e.workoutDuration === m ? undefined : m })}>{m}</button>
                ))}
                <span className="unit">min</span>
              </div>
            )}
          </>
        )}
      </Section>

      <Section icon={<Cookie size={17} />} title="Treats & cravings">
        <button className="toggle" data-active={e.treat ? "1" : "0"}
          onClick={() => update(date, { treat: !e.treat })}>
          {e.treat ? <Check size={16} /> : null}
          {e.treat ? "Had a treat / cheat meal" : "No treats today"}
        </button>
        <div className="craving-label">Cravings (even if you didn't give in):</div>
        <div className="chips">
          {CRAVINGS.map((c) => (
            <Chip key={c} active={(e.cravings || []).includes(c)} color="#D9A441"
              onClick={() => toggleArr(date, "cravings", c)}>{c}</Chip>
          ))}
        </div>
      </Section>

      <Section icon={<Coffee size={17} />} title="Caffeine">
        <button className="toggle" data-active={e.caffeine ? "1" : "0"}
          onClick={() => update(date, e.caffeine ? { caffeine: undefined, caffeineAmt: undefined } : { caffeine: true })}>
          {e.caffeine ? <Check size={16} /> : null}
          {e.caffeine ? "Had caffeine" : "No caffeine today"}
        </button>
        {e.caffeine && (
          <div className="sleep-row mt">
            <span className="unit" style={{ marginLeft: 0, marginRight: 6 }}>Servings</span>
            {[1, 2, 3, 4].map((n) => (
              <button key={n} className="sleep-pill" data-active={e.caffeineAmt === n ? "1" : "0"}
                style={e.caffeineAmt === n ? { background: "#8A6240", borderColor: "#8A6240", color: "#fff" } : undefined}
                onClick={() => update(date, { caffeineAmt: e.caffeineAmt === n ? undefined : n })}>{n}{n === 4 ? "+" : ""}</button>
            ))}
          </div>
        )}
      </Section>

      <Section icon={<Wine size={17} />} title="Alcohol">
        <button className="toggle" data-active={e.alcohol ? "1" : "0"}
          onClick={() => update(date, e.alcohol ? { alcohol: undefined, alcoholAmt: undefined } : { alcohol: true })}>
          {e.alcohol ? <Check size={16} /> : null}
          {e.alcohol ? "Had a drink" : "No alcohol today"}
        </button>
        {e.alcohol && (
          <div className="sleep-row mt">
            <span className="unit" style={{ marginLeft: 0, marginRight: 6 }}>Drinks</span>
            {[1, 2, 3, 4].map((n) => (
              <button key={n} className="sleep-pill" data-active={e.alcoholAmt === n ? "1" : "0"}
                style={e.alcoholAmt === n ? { background: "#9B5A6A", borderColor: "#9B5A6A", color: "#fff" } : undefined}
                onClick={() => update(date, { alcoholAmt: e.alcoholAmt === n ? undefined : n })}>{n}{n === 4 ? "+" : ""}</button>
            ))}
          </div>
        )}
      </Section>

      <Section icon={<Activity size={17} />} title="Symptoms">
        <div className="chips">
          {SYMPTOMS.map((s) => (
            <Chip key={s} active={(e.symptoms || []).includes(s)} color="#A6789E"
              onClick={() => toggleArr(date, "symptoms", s)}>{s}</Chip>
          ))}
        </div>
      </Section>

      <Section icon={<NotebookPen size={17} />} title="Notes">
        <textarea className="notes" placeholder="Anything else worth remembering…"
          value={e.notes || ""} onChange={(ev) => update(date, { notes: ev.target.value })} />
      </Section>
    </div>
  );
}
function Section({ icon, title, children }) {
  return (
    <div className="card">
      <div className="card-head">{icon}<span>{title}</span></div>
      {children}
    </div>
  );
}

/* ----------------------------- history panel ----------------------------- */
function HistoryPanel({ entries, starts, cycleLen, periodLen, onPick }) {
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const cells = useMemo(() => {
    const first = new Date(y, m, 1);
    const startDow = first.getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const arr = [];
    for (let i = 0; i < startDow; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(ymd(new Date(y, m, d)));
    return arr;
  }, [y, m]);
  const monthName = new Date(y, m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const shift = (n) => { let nm = m + n, ny = y; if (nm < 0) { nm = 11; ny--; } if (nm > 11) { nm = 0; ny++; } setM(nm); setY(ny); };
  return (
    <div className="panel">
      <div className="card">
        <div className="datebar">
          <button className="iconbtn" onClick={() => shift(-1)}><ChevronLeft size={20} /></button>
          <div className="datebar-day">{monthName}</div>
          <button className="iconbtn" onClick={() => shift(1)}><ChevronRight size={20} /></button>
        </div>
        <div className="dow">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="cal">
          {cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const e = entries[c];
            const ph = entryPhase(c, starts, cycleLen, periodLen);
            const flowColor = e && e.flow && e.flow !== "none"
              ? FLOWS.find((f) => f.id === e.flow)?.color : null;
            return (
              <button key={i} className="day" onClick={() => onPick(c)}
                style={{ outline: c === TODAY ? "2px solid #2E2A26" : "none" }}>
                <span className="day-n">{Number(c.split("-")[2])}</span>
                <span className="day-bar" style={{ background: flowColor || (ph ? PHASE[ph].color : "transparent"), opacity: flowColor ? 1 : 0.32 }} />
                <span className="day-marks">
                  {e?.didWorkout && <i className="mk" style={{ background: "#C0613F" }} />}
                  {e?.treat && <i className="mk" style={{ background: "#D9A441" }} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="legend">
          <span><i className="mk" style={{ background: "#C0613F" }} /> workout</span>
          <span><i className="mk" style={{ background: "#D9A441" }} /> treat</span>
          <span><i className="day-bar legend-bar" style={{ background: "#C0524A" }} /> flow</span>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- insights panel ---------------------------- */
function InsightsPanel({ entries, starts, cycleLen, periodLen }) {
  const dates = Object.keys(entries).sort();
  const stats = useMemo(() => {
    const acc = {};
    PHASE_ORDER.forEach((p) => (acc[p] = { energy: [], workout: 0, treat: 0, n: 0 }));
    for (const d of dates) {
      const ph = entryPhase(d, starts, cycleLen, periodLen);
      if (!ph) continue;
      const e = entries[d];
      acc[ph].n++;
      if (e.energy) acc[ph].energy.push(e.energy);
      if (e.didWorkout) acc[ph].workout++;
      if (e.treat) acc[ph].treat++;
    }
    return acc;
  }, [entries, starts, cycleLen, periodLen, dates.join(",")]);

  const energyData = PHASE_ORDER.map((p) => ({
    name: PHASE[p].label, color: PHASE[p].color,
    val: stats[p].energy.length ? +(stats[p].energy.reduce((a, b) => a + b, 0) / stats[p].energy.length).toFixed(1) : 0,
  }));
  const workoutData = PHASE_ORDER.map((p) => ({
    name: PHASE[p].label, color: PHASE[p].color,
    val: stats[p].n ? Math.round((stats[p].workout / stats[p].n) * 100) : 0,
  }));
  const treatData = PHASE_ORDER.map((p) => ({
    name: PHASE[p].label, color: PHASE[p].color,
    val: stats[p].n ? Math.round((stats[p].treat / stats[p].n) * 100) : 0,
  }));

  const trend = dates.slice(-30).filter((d) => entries[d]?.energy)
    .map((d) => ({ d: niceDate(d).replace(/^[A-Za-z]+, /, ""), energy: entries[d].energy, sleep: entries[d].sleep || null }));

  const symFreq = useMemo(() => {
    const c = {};
    for (const d of dates) for (const s of entries[d].symptoms || []) c[s] = (c[s] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [entries, dates.join(",")]);

  const next = starts.length ? addDays(starts[starts.length - 1], cycleLen) : null;
  const logged = dates.length;
  const hasPhaseData = PHASE_ORDER.some((p) => stats[p].n > 0);

  return (
    <div className="panel">
      <div className="card stat-grid">
        <Stat label="Days logged" value={logged} />
        <Stat label="Avg cycle" value={starts.length >= 2 ? `${cycleLen}d` : "—"} />
        <Stat label="Avg period" value={starts.length ? `${periodLen}d` : "—"} />
        <Stat label="Next period" value={next ? niceDate(next).replace(/^[A-Za-z]+, /, "") : "—"} />
      </div>

      {!hasPhaseData ? (
        <div className="card empty">
          Log a few days across your cycle — including period days — and your phase-by-phase patterns will appear here.
        </div>
      ) : (
        <>
          <Chart title="Average energy by cycle phase" sub="Higher is better">
            <BarChart data={energyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAE2D4" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8A7F72" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: "#8A7F72" }} axisLine={false} tickLine={false} width={24} />
              <Tooltip cursor={{ fill: "#00000008" }} />
              <Bar dataKey="val" radius={[6, 6, 0, 0]}>
                {energyData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </Chart>

          <Chart title="Workout days by phase" sub="% of logged days you trained">
            <BarChart data={workoutData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAE2D4" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8A7F72" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#8A7F72" }} axisLine={false} tickLine={false} width={28} unit="%" />
              <Tooltip cursor={{ fill: "#00000008" }} formatter={(v) => `${v}%`} />
              <Bar dataKey="val" radius={[6, 6, 0, 0]}>
                {workoutData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </Chart>

          <Chart title="Treat days by phase" sub="% of logged days with a treat / cheat meal">
            <BarChart data={treatData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAE2D4" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8A7F72" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#8A7F72" }} axisLine={false} tickLine={false} width={28} unit="%" />
              <Tooltip cursor={{ fill: "#00000008" }} formatter={(v) => `${v}%`} />
              <Bar dataKey="val" radius={[6, 6, 0, 0]}>
                {treatData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </Chart>
        </>
      )}

      {trend.length > 1 && (
        <Chart title="Energy & sleep — last 30 logged days" sub="">
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EAE2D4" vertical={false} />
            <XAxis dataKey="d" tick={{ fontSize: 9, fill: "#8A7F72" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#8A7F72" }} axisLine={false} tickLine={false} width={24} />
            <Tooltip />
            <Line type="monotone" dataKey="energy" stroke="#6FA37A" strokeWidth={2.5} dot={false} name="Energy" />
            <Line type="monotone" dataKey="sleep" stroke="#A6789E" strokeWidth={2} dot={false} name="Sleep (hrs)" connectNulls />
          </LineChart>
        </Chart>
      )}

      {symFreq.length > 0 && (
        <div className="card">
          <div className="card-head"><Activity size={17} /><span>Most frequent symptoms</span></div>
          {symFreq.map(([s, n]) => (
            <div key={s} className="sym-row">
              <span>{s}</span>
              <div className="sym-bar"><div style={{ width: `${(n / symFreq[0][1]) * 100}%` }} /></div>
              <span className="sym-n">{n}</span>
            </div>
          ))}
        </div>
      )}

      <div className="disclaimer">
        Phase and prediction estimates are based on the days you log and assume a roughly typical cycle. They're for spotting your own patterns — not medical advice, and not a contraception method.
      </div>
    </div>
  );
}
function Stat({ label, value }) {
  return <div className="stat"><div className="stat-v">{value}</div><div className="stat-l">{label}</div></div>;
}
function Chart({ title, sub, children }) {
  return (
    <div className="card">
      <div className="chart-title">{title}</div>
      {sub && <div className="chart-sub">{sub}</div>}
      <div style={{ width: "100%", height: 190 }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------------------------- sync + settings --------------------------- */
function SyncDot({ sync }) {
  const map = {
    ok: ["#6FA37A", "Synced"],
    syncing: ["#E0A458", "Syncing…"],
    error: ["#C0524A", "Sync error"],
    local: ["#A89C8A", "Local only"],
    idle: ["#A89C8A", ""],
  };
  const [color, label] = map[sync] || map.idle;
  return <span className="sync-dot"><i style={{ background: color }} />{label}</span>;
}

function SettingsPanel({ sheetUrl, sheetToken, onSave, sync, onSyncNow, onExport }) {
  const [url, setUrl] = useState(sheetUrl);
  const [token, setToken] = useState(sheetToken);
  return (
    <div className="panel">
      <div className="card">
        <div className="card-head"><Settings size={17} /><span>Google Sheet sync</span></div>
        <p className="settings-help">
          Paste the Web App URL from your Apps Script deployment (steps in SETUP.md). Leave blank to keep data on this device only.
        </p>
        <input className="pr-input" style={{ marginTop: 0 }} placeholder="https://script.google.com/macros/s/…/exec"
          value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className="pr-input" placeholder="Secret token (optional — must match the script)"
          value={token} onChange={(e) => setToken(e.target.value)} />
        <div className="settings-actions">
          <button className="btn-primary" onClick={() => onSave(url.trim(), token.trim())}>Save &amp; sync</button>
          <button className="btn-ghost" onClick={() => onSyncNow(sheetUrl, sheetToken)}>Sync now</button>
        </div>
        <div className="settings-status"><SyncDot sync={sync} /></div>
      </div>
      <div className="card">
        <div className="card-head"><Download size={17} /><span>Export</span></div>
        <p className="settings-help">Download everything logged as a CSV — opens in Sheets or Excel.</p>
        <button className="btn-ghost" onClick={onExport}>Download CSV</button>
      </div>
      <div className="disclaimer">
        Anyone with your Web App URL can read or write the sheet, so treat it like a password. Setting a secret token in the script (and here) adds a layer of protection.
      </div>
    </div>
  );
}

/* --------------------------------- app ---------------------------------- */
export default function App() {
  const [data, setData] = useState({ entries: {} });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("today");
  const [date, setDate] = useState(TODAY);
  const [sheetUrl, setSheetUrl] = useState(() => { try { return localStorage.getItem(URL_KEY) || ""; } catch { return ""; } });
  const [sheetToken, setSheetToken] = useState(() => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } });
  const [sync, setSync] = useState("idle");
  const saveTimer = useRef();
  const lastDate = useRef(null);

  // Initial load: show local cache instantly, then refresh from the Sheet.
  useEffect(() => {
    setData(loadLocal());
    (async () => {
      if (sheetUrl) {
        try {
          setSync("syncing");
          const entries = await pullSheet(sheetUrl, sheetToken);
          const merged = { entries };
          setData(merged);
          saveLocal(merged);
          setSync("ok");
        } catch (e) { setSync("error"); }
      } else {
        setSync("local");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist locally on every change, and push the edited day to the Sheet (debounced).
  useEffect(() => {
    if (loading) return;
    saveLocal(data);
    if (!sheetUrl || !lastDate.current) return;
    const d = lastDate.current;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSync("syncing");
        const cd = cycleDayFor(d, data.entries);
        await pushRow(sheetUrl, sheetToken, entryToRow(d, data.entries[d] || {}, cd.cycleDay, cd.phase));
        setSync("ok");
      } catch (e) { setSync("error"); }
    }, 900);
  }, [data, loading, sheetUrl, sheetToken]);

  // Pull from the Sheet and merge (local edits win for overlapping days, then seed new days up).
  const syncNow = async (url = sheetUrl, token = sheetToken) => {
    if (!url) { setSync("local"); return; }
    try {
      setSync("syncing");
      const sheetEntries = await pullSheet(url, token);
      const localEntries = (data && data.entries) || {};
      const merged = { ...sheetEntries, ...localEntries };
      setData({ entries: merged });
      saveLocal({ entries: merged });
      const toPush = Object.keys(localEntries).filter((d) => !(d in sheetEntries));
      for (const d of toPush) {
        const cd = cycleDayFor(d, merged);
        await pushRow(url, token, entryToRow(d, merged[d], cd.cycleDay, cd.phase));
      }
      setSync("ok");
    } catch (e) { setSync("error"); }
  };

  const saveSettings = (url, token) => {
    try { localStorage.setItem(URL_KEY, url); localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
    setSheetUrl(url);
    setSheetToken(token);
    syncNow(url, token);
  };

  const exportCsv = () => {
    const esc = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = Object.keys(data.entries).sort().map((d) => {
      const cd = cycleDayFor(d, data.entries);
      return entryToRow(d, data.entries[d], cd.cycleDay, cd.phase);
    });
    const csv = [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => esc(r[c])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rhythm-export.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const update = (d, patch) => { lastDate.current = d; setData((cur) => {
    const entries = { ...cur.entries };
    const e = { ...(entries[d] || { date: d }), ...patch };
    Object.keys(e).forEach((k) => (e[k] === undefined) && delete e[k]);
    entries[d] = e;
    return { ...cur, entries };
  }); };
  const toggleArr = (d, field, val) => { lastDate.current = d; setData((cur) => {
    const entries = { ...cur.entries };
    const e = { ...(entries[d] || { date: d }) };
    const set = new Set(e[field] || []);
    set.has(val) ? set.delete(val) : set.add(val);
    e[field] = [...set];
    entries[d] = e;
    return { ...cur, entries };
  }); };

  const starts = useMemo(() => getPeriodStarts(data.entries), [data.entries]);
  const cycleLen = useMemo(() => avgCycle(starts), [starts]);
  const periodLen = useMemo(() => avgPeriodLen(data.entries, starts), [data.entries, starts]);
  const lastStart = starts[starts.length - 1];
  let cycleDay = lastStart ? diffDays(TODAY, lastStart) + 1 : null;
  if (cycleDay && cycleDay > cycleLen + 12) cycleDay = null;
  const phase = cycleDay ? phaseFor(cycleDay, cycleLen, periodLen) : null;
  const next = lastStart ? addDays(lastStart, cycleLen) : null;

  if (loading) return <div className="root"><div className="loading">Loading your log…</div><style>{css}</style></div>;

  return (
    <div className="root">
      <style>{css}</style>
      <header className="topbar">
        <div>
          <div className="brand">Rhythm</div>
          <div className="brand-sub">your body, day by day</div>
        </div>
        <button className="gear" title="Sheet sync & settings"
          onClick={() => setView(view === "settings" ? "today" : "settings")}>
          <SyncDot sync={sync} />
          <Settings size={18} />
        </button>
      </header>

      <PhaseRing cycleDay={cycleDay} phase={phase} cycleLen={cycleLen} periodLen={periodLen} next={next} />

      <nav className="tabs">
        {[["today", "Today", <CalendarDays size={16} />], ["history", "Calendar", <Droplet size={16} />], ["insights", "Insights", <Activity size={16} />]].map(([id, label, icon]) => (
          <button key={id} className="tab" data-active={view === id ? "1" : "0"} onClick={() => setView(id)}>
            {icon}<span>{label}</span>
          </button>
        ))}
      </nav>

      {view === "today" && (
        <TodayPanel date={date} setDate={setDate} entry={data.entries[date]} update={update} toggleArr={toggleArr} />
      )}
      {view === "history" && (
        <HistoryPanel entries={data.entries} starts={starts} cycleLen={cycleLen} periodLen={periodLen}
          onPick={(d) => { setDate(d); setView("today"); }} />
      )}
      {view === "insights" && (
        <InsightsPanel entries={data.entries} starts={starts} cycleLen={cycleLen} periodLen={periodLen} />
      )}
      {view === "settings" && (
        <SettingsPanel sheetUrl={sheetUrl} sheetToken={sheetToken} onSave={saveSettings}
          sync={sync} onSyncNow={syncNow} onExport={exportCsv} />
      )}
      <div className="footnote">
        {sheetUrl ? "Synced to your Google Sheet · cached on this device" : "Saved on this device · connect a Sheet in settings"}
      </div>
    </div>
  );
}

/* --------------------------------- css ---------------------------------- */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
* { box-sizing: border-box; }
.root { font-family: 'Hanken Grotesk', sans-serif; background: #F4EFE6; color: #2E2A26; min-height: 100vh; max-width: 540px; margin: 0 auto; padding: 0 16px 40px; }
.loading { padding: 80px 0; text-align: center; color: #8A7F72; }
.topbar { padding: 26px 0 10px; display: flex; justify-content: space-between; align-items: flex-start; }
.gear { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; border: none; background: none; cursor: pointer; color: #4A4138; padding: 4px; }
.sync-dot { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: #8A7F72; white-space: nowrap; }
.sync-dot i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.settings-help { font-size: 13px; color: #8A7F72; line-height: 1.5; margin: 0 0 12px; }
.settings-actions { display: flex; gap: 8px; margin-top: 12px; }
.settings-status { margin-top: 12px; }
.btn-primary { flex: 1; border: none; background: #C0613F; color: #fff; padding: 12px; border-radius: 11px; font-family: inherit; font-weight: 600; font-size: 14px; cursor: pointer; }
.btn-ghost { border: 1px solid #DCD2C2; background: #FFFDF9; color: #4A4138; padding: 12px 16px; border-radius: 11px; font-family: inherit; font-weight: 600; font-size: 14px; cursor: pointer; }
.brand { font-family: 'Fraunces', serif; font-size: 34px; font-weight: 600; letter-spacing: -0.5px; line-height: 1; }
.brand-sub { font-style: italic; color: #8A7F72; font-family: 'Fraunces', serif; font-size: 15px; margin-top: 2px; }

.ring-wrap { display: flex; flex-direction: column; align-items: center; padding: 8px 0 4px; }
.ring-svg { width: 220px; height: 220px; }
.ring-day { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 600; fill: #2E2A26; }
.ring-phase { font-family: 'Hanken Grotesk'; font-size: 14px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
.ring-next { color: #8A7F72; font-size: 13px; margin-top: 2px; }

.tabs { display: flex; gap: 6px; background: #EAE2D4; padding: 4px; border-radius: 14px; margin: 16px 0; }
.tab { flex: 1; border: none; background: transparent; padding: 9px 4px; border-radius: 10px; font-family: inherit; font-size: 13px; font-weight: 600; color: #8A7F72; display: flex; align-items: center; justify-content: center; gap: 5px; cursor: pointer; transition: all .15s; }
.tab[data-active="1"] { background: #FBF8F2; color: #2E2A26; box-shadow: 0 1px 3px #00000012; }

.panel { display: flex; flex-direction: column; gap: 12px; }
.card { background: #FBF8F2; border: 1px solid #ECE3D5; border-radius: 16px; padding: 16px; }
.card-head { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; margin-bottom: 12px; color: #4A4138; }
.card-head svg { color: #C0613F; }

.datebar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.datebar-mid { text-align: center; }
.datebar-day { font-family: 'Fraunces', serif; font-size: 19px; font-weight: 600; }
.iconbtn { border: 1px solid #ECE3D5; background: #FBF8F2; width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #4A4138; }
.textbtn { border: none; background: none; color: #C0613F; font-family: inherit; font-size: 12px; cursor: pointer; text-decoration: underline; }

.chips { display: flex; flex-wrap: wrap; gap: 7px; }
.chips.mt { margin-top: 10px; }
.chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #DCD2C2; background: #FFFDF9; color: #4A4138; padding: 7px 12px; border-radius: 999px; font-family: inherit; font-size: 13px; font-weight: 500; cursor: pointer; transition: all .12s; }
.chip[data-active="1"] { font-weight: 600; }
.dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }

.scale-row { display: flex; gap: 8px; }
.scale-dot { flex: 1; height: 44px; border: 1px solid #DCD2C2; background: #FFFDF9; border-radius: 12px; font-family: inherit; font-size: 15px; font-weight: 600; color: #8A7F72; cursor: pointer; transition: all .12s; }
.scale-label { margin-top: 8px; font-size: 13px; color: #8A7F72; font-style: italic; font-family: 'Fraunces', serif; }

.sleep-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.sleep-pill { min-width: 38px; height: 38px; padding: 0 6px; border: 1px solid #DCD2C2; background: #FFFDF9; border-radius: 10px; font-family: inherit; font-weight: 600; font-size: 14px; color: #4A4138; cursor: pointer; }
.sleep-pill[data-active="1"] { background: #A6789E; border-color: #A6789E; color: #fff; }
.unit { color: #8A7F72; font-size: 13px; margin-left: 4px; }

.toggle { width: 100%; border: 1px dashed #C9BDA9; background: #FFFDF9; padding: 13px; border-radius: 12px; font-family: inherit; font-size: 14px; font-weight: 600; color: #8A7F72; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px; }
.toggle[data-active="1"] { background: #EFE6D6; border-style: solid; border-color: #C0613F; color: #8A4A2E; }
.craving-label { font-size: 12.5px; color: #8A7F72; margin: 13px 0 8px; }
.seg { display: flex; gap: 6px; }
.seg button { flex: 1; padding: 11px; border: 1px solid #DCD2C2; background: #FFFDF9; border-radius: 11px; font-family: inherit; font-size: 13.5px; font-weight: 600; color: #8A7F72; cursor: pointer; transition: all .12s; }
.seg button[data-active="1"] { background: #2E2A26; border-color: #2E2A26; color: #FBF8F2; }
.pr-input { width: 100%; margin-top: 10px; border: 1px solid #DCD2C2; background: #FFFDF9; border-radius: 11px; padding: 11px; font-family: inherit; font-size: 13.5px; color: #2E2A26; }
.pr-input:focus { outline: none; border-color: #C0613F; }

.notes { width: 100%; min-height: 70px; border: 1px solid #DCD2C2; background: #FFFDF9; border-radius: 12px; padding: 11px; font-family: inherit; font-size: 14px; color: #2E2A26; resize: vertical; }
.notes:focus { outline: none; border-color: #C0613F; }

.dow { display: grid; grid-template-columns: repeat(7,1fr); margin: 10px 0 4px; }
.dow span { text-align: center; font-size: 11px; color: #B0A492; font-weight: 600; }
.cal { display: grid; grid-template-columns: repeat(7,1fr); gap: 4px; }
.day { aspect-ratio: 1; border: none; background: #FFFDF9; border-radius: 9px; cursor: pointer; padding: 4px 0; display: flex; flex-direction: column; align-items: center; justify-content: space-between; position: relative; }
.day-n { font-size: 12px; font-weight: 600; color: #4A4138; }
.day-bar { width: 60%; height: 5px; border-radius: 3px; }
.day-marks { display: flex; gap: 3px; height: 6px; }
.mk { width: 5px; height: 5px; border-radius: 50%; display: inline-block; }
.legend { display: flex; gap: 14px; margin-top: 12px; font-size: 11.5px; color: #8A7F72; align-items: center; }
.legend span { display: flex; align-items: center; gap: 4px; }
.legend-bar { width: 14px; height: 5px; }

.stat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
.stat { text-align: center; }
.stat-v { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 600; }
.stat-l { font-size: 10.5px; color: #8A7F72; margin-top: 2px; letter-spacing: 0.2px; }
.chart-title { font-weight: 600; font-size: 14.5px; margin-bottom: 2px; }
.chart-sub { font-size: 12px; color: #8A7F72; margin-bottom: 10px; }
.empty { color: #8A7F72; font-size: 14px; line-height: 1.5; text-align: center; padding: 24px 16px; }

.sym-row { display: flex; align-items: center; gap: 10px; margin: 7px 0; font-size: 13px; }
.sym-row > span:first-child { width: 110px; flex-shrink: 0; }
.sym-bar { flex: 1; background: #EAE2D4; height: 8px; border-radius: 4px; overflow: hidden; }
.sym-bar > div { height: 100%; background: #A6789E; border-radius: 4px; }
.sym-n { color: #8A7F72; width: 18px; text-align: right; }

.disclaimer { font-size: 11.5px; color: #A89C8A; line-height: 1.5; padding: 4px 6px; }
.footnote { text-align: center; color: #B0A492; font-size: 12px; margin-top: 18px; font-style: italic; font-family: 'Fraunces', serif; }
`;
