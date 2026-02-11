import React, { useMemo, useState } from "react";

type Child = {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  guardian: string;
  allergies?: string;
};

type Attendance = {
  status: "PRESENT" | "ABSENT";
  checkInMs?: number;
  checkOutMs?: number;
  totalMinutes?: number;
  checkInNote?: string;
  checkOutNote?: string;
};

type Tab = "TODAY" | "CHILDREN" | "REPORTS";

function todayKey(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtTime(ms?: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtDuration(mins?: number) {
  if (mins === undefined) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function minutesBetween(startMs?: number, endMs?: number) {
  if (!startMs || !endMs) return undefined;
  const diff = endMs - startMs;
  if (diff < 0) return undefined;
  return Math.round(diff / 60000);
}

function pillStyle(active: boolean) {
  return {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #2a2a2a",
    background: active ? "#ffffff" : "#141414",
    color: active ? "#111" : "#fff",
    fontWeight: 700 as const,
    cursor: "pointer"
  };
}

function buttonStyle(kind: "primary" | "outline" | "danger" = "primary") {
  const base = {
    padding: "10px 12px",
    borderRadius: 12,
    fontWeight: 700 as const,
    cursor: "pointer",
    border: "1px solid #2a2a2a"
  };
  if (kind === "primary") return { ...base, background: "#fff", color: "#111" };
  if (kind === "danger") return { ...base, background: "#ff3b30", color: "#fff", border: "1px solid #ff3b30" };
  return { ...base, background: "transparent", color: "#fff" };
}

function cardStyle() {
  return {
    border: "1px solid #2a2a2a",
    borderRadius: 16,
    background: "#101010",
    padding: 14
  };
}

function rowStyle() {
  return {
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
    border: "1px solid #2a2a2a",
    borderRadius: 14,
    padding: 12,
    background: "#0b0b0b"
  };
}

function badge(active: boolean) {
  return {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #2a2a2a",
    background: active ? "#fff" : "#1e1e1e",
    color: active ? "#111" : "#fff",
    fontWeight: 800 as const
  };
}

function modalOverlay() {
  return {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999
  };
}

function modalCard() {
  return {
    width: "min(680px, 100%)",
    borderRadius: 16,
    background: "#0f0f0f",
    border: "1px solid #2a2a2a",
    padding: 16
  };
}

function inputStyle() {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #2a2a2a",
    background: "#0b0b0b",
    color: "#fff",
    outline: "none"
  };
}

function smallMuted() {
  return { fontSize: 12, color: "#a7a7a7" };
}

const STORAGE_KEY = "mt_demo_state_v1";

function loadState(): { kids: Child[]; attendance: Record<string, Record<string, Attendance>> } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(kids: Child[], attendance: Record<string, Record<string, Attendance>>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ kids, attendance }));
}

const QUICK_IN = ["Dropped off by Mom", "Dropped off by Dad", "Grandma drop-off", "Late arrival", "Runny nose", "Needs diapers", "Needs wipes"];
const QUICK_OUT = ["Picked up by Mom", "Picked up by Dad", "Grandma pickup", "Early pickup", "Late pickup", "No nap", "Ate well", "Didn’t eat much"];

function appendNote(current: string, add: string) {
  const c = (current ?? "").trim();
  const a = (add ?? "").trim();
  if (!a) return c;
  if (!c) return a;
  const lc = c.toLowerCase();
  const la = a.toLowerCase();
  if (lc.includes(la)) return c;
  return `${c} • ${a}`;
}

export default function App() {
  const dateKey = useMemo(() => todayKey(), []);
  const seeded = useMemo(() => loadState(), []);

  const [tab, setTab] = useState<Tab>("TODAY");
  const [kids, setKids] = useState<Child[]>(
    seeded?.kids ?? [
      { id: "k1", firstName: "Hannah", lastName: "C.", isActive: true, guardian: "Andrea", allergies: "" },
      { id: "k2", firstName: "Morgan", lastName: "C.", isActive: true, guardian: "Andrea", allergies: "Peanuts" }
    ]
  );

  // attendance[dateKey][childId] = Attendance
  const [attendance, setAttendance] = useState<Record<string, Record<string, Attendance>>>(
    seeded?.attendance ?? { [dateKey]: {} }
  );

  // Notes modal
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [pending, setPending] = useState<{ childId: string; type: "CHECK_IN" | "CHECK_OUT" } | null>(null);

  // Children modal
  const [childOpen, setChildOpen] = useState(false);
  const [childMode, setChildMode] = useState<"ADD" | "EDIT">("ADD");
  const [editId, setEditId] = useState<string | null>(null);
  const [childForm, setChildForm] = useState<{ firstName: string; lastName: string; guardian: string; allergies: string; isActive: boolean }>({
    firstName: "",
    lastName: "",
    guardian: "",
    allergies: "",
    isActive: true
  });

  const dayMap = attendance[dateKey] ?? {};
  const activeKids = kids.filter((k) => k.isActive);

  function commit(nextKids = kids, nextAttendance = attendance) {
    setKids(nextKids);
    setAttendance(nextAttendance);
    saveState(nextKids, nextAttendance);
  }

  function openNote(childId: string, type: "CHECK_IN" | "CHECK_OUT") {
    setPending({ childId, type });
    setNoteText("");
    setNoteOpen(true);
  }

  function doCheckIn(childId: string, note: string) {
    const now = Date.now();
    const next = { ...attendance };
    const d = { ...(next[dateKey] ?? {}) };
    d[childId] = {
      status: "PRESENT",
      checkInMs: now,
      checkOutMs: undefined,
      totalMinutes: undefined,
      checkInNote: note || "",
      checkOutNote: ""
    };
    next[dateKey] = d;
    commit(kids, next);
  }

  function doCheckOut(childId: string, note: string) {
    const now = Date.now();
    const existing = dayMap[childId];
    const totalMinutes = minutesBetween(existing?.checkInMs, now);
    const next = { ...attendance };
    const d = { ...(next[dateKey] ?? {}) };
    d[childId] = {
      status: "ABSENT",
      checkInMs: existing?.checkInMs,
      checkOutMs: now,
      totalMinutes: totalMinutes ?? 0,
      checkInNote: existing?.checkInNote || "",
      checkOutNote: note || ""
    };
    next[dateKey] = d;
    commit(kids, next);
  }

  function confirmNote() {
    if (!pending) return;
    const { childId, type } = pending;
    if (type === "CHECK_IN") doCheckIn(childId, noteText);
    else doCheckOut(childId, noteText);
    setNoteOpen(false);
    setPending(null);
  }

  function openAddChild() {
    setChildMode("ADD");
    setEditId(null);
    setChildForm({ firstName: "", lastName: "", guardian: "", allergies: "", isActive: true });
    setChildOpen(true);
  }

  function openEditChild(k: Child) {
    setChildMode("EDIT");
    setEditId(k.id);
    setChildForm({
      firstName: k.firstName,
      lastName: k.lastName,
      guardian: k.guardian,
      allergies: k.allergies ?? "",
      isActive: k.isActive
    });
    setChildOpen(true);
  }

  function saveChild() {
    const f = childForm.firstName.trim();
    const l = childForm.lastName.trim();
    const g = childForm.guardian.trim();
    if (!f || !l || !g) return;

    if (childMode === "ADD") {
      const id = `k_${Math.random().toString(16).slice(2)}`;
      const nextKids = [...kids, { id, firstName: f, lastName: l, guardian: g, allergies: childForm.allergies.trim(), isActive: childForm.isActive }];
      commit(nextKids, attendance);
    } else if (childMode === "EDIT" && editId) {
      const nextKids = kids.map((k) =>
        k.id === editId
          ? { ...k, firstName: f, lastName: l, guardian: g, allergies: childForm.allergies.trim(), isActive: childForm.isActive }
          : k
      );
      commit(nextKids, attendance);
    }

    setChildOpen(false);
  }

  const reportRows = useMemo(() => {
    // Aggregate over all stored days (local demo)
    const totals = new Map<string, { days: number; minutes: number }>();
    const allDays = Object.keys(attendance).sort();

    for (const dKey of allDays) {
      const dm = attendance[dKey] ?? {};
      for (const childId of Object.keys(dm)) {
        const a = dm[childId];
        const mins = typeof a.totalMinutes === "number" ? a.totalMinutes : 0;
        const present = a.status === "PRESENT" || !!a.checkInMs || mins > 0;

        const cur = totals.get(childId) ?? { days: 0, minutes: 0 };
        cur.minutes += mins;
        if (present) cur.days += 1;
        totals.set(childId, cur);
      }
    }

    return kids
      .map((k) => {
        const t = totals.get(k.id) ?? { days: 0, minutes: 0 };
        return { id: k.id, name: `${k.firstName} ${k.lastName}`, days: t.days, minutes: t.minutes, active: k.isActive };
      })
      .sort((a, b) => b.minutes - a.minutes);
  }, [attendance, kids]);

  return (
    <div style={{ minHeight: "100vh", background: "#070707", color: "#fff", padding: 16 }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Top */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900 }}>Mother’s Touch</div>
            <div style={smallMuted()}>{tab === "TODAY" ? `Today • ${dateKey}` : tab === "CHILDREN" ? "Children roster" : "Reports (local demo)"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button style={pillStyle(tab === "TODAY")} onClick={() => setTab("TODAY")}>Today</button>
            <button style={pillStyle(tab === "CHILDREN")} onClick={() => setTab("CHILDREN")}>Children</button>
            <button style={pillStyle(tab === "REPORTS")} onClick={() => setTab("REPORTS")}>Reports</button>
          </div>
        </div>

        {/* Content */}
        {tab === "TODAY" && (
          <div style={cardStyle()}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Attendance</div>
            {activeKids.length === 0 ? (
              <div style={smallMuted()}>No active kids. Add them on the Children tab.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activeKids.map((k) => {
                  const a = dayMap[k.id];
                  const present = a?.status === "PRESENT";
                  return (
                    <div key={k.id} style={rowStyle()}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {k.firstName} {k.lastName}
                        </div>
                        <div style={{ ...smallMuted(), marginTop: 4 }}>
                          In: {fmtTime(a?.checkInMs)} • Out: {fmtTime(a?.checkOutMs)} • Total: {fmtDuration(a?.totalMinutes)}
                        </div>
                        {(a?.checkInNote || a?.checkOutNote) && (
                          <div style={{ ...smallMuted(), marginTop: 4 }}>
                            Notes: {[
                              a?.checkInNote ? `In: ${a.checkInNote}` : "",
                              a?.checkOutNote ? `Out: ${a.checkOutNote}` : ""
                            ].filter(Boolean).join(" | ")}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={badge(present)}>{present ? "PRESENT" : "ABSENT"}</div>
                        {!present ? (
                          <button style={buttonStyle("primary")} onClick={() => openNote(k.id, "CHECK_IN")}>Check in</button>
                        ) : (
                          <button style={buttonStyle("outline")} onClick={() => openNote(k.id, "CHECK_OUT")}>Check out</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "CHILDREN" && (
          <div style={cardStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 900 }}>Roster</div>
                <div style={smallMuted()}>{kids.filter(k => k.isActive).length} active</div>
              </div>
              <button style={buttonStyle("primary")} onClick={openAddChild}>Add child</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {kids
                .slice()
                .sort((a, b) => {
                  const aa = a.isActive ? 0 : 1;
                  const bb = b.isActive ? 0 : 1;
                  if (aa !== bb) return aa - bb;
                  return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
                })
                .map((k) => (
                  <div key={k.id} style={rowStyle()}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>{k.firstName} {k.lastName}</div>
                      <div style={smallMuted()}>
                        Guardian: {k.guardian}{k.allergies ? ` • Allergies: ${k.allergies}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <div style={badge(k.isActive)}>{k.isActive ? "ACTIVE" : "ARCHIVED"}</div>
                      <button style={buttonStyle("outline")} onClick={() => openEditChild(k)}>Edit</button>
                      <button
                        style={buttonStyle(k.isActive ? "danger" : "primary")}
                        onClick={() => {
                          const nextKids = kids.map((x) => (x.id === k.id ? { ...x, isActive: !x.isActive } : x));
                          commit(nextKids, attendance);
                        }}
                      >
                        {k.isActive ? "Archive" : "Restore"}
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            <div style={{ marginTop: 12, ...smallMuted() }}>
              This is a local demo. Next we’ll connect Firebase so this works across devices and accounts.
            </div>
          </div>
        )}

        {tab === "REPORTS" && (
          <div style={cardStyle()}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Totals (local demo)</div>
            <div style={{ ...smallMuted(), marginBottom: 10 }}>
              This aggregates what you’ve done on this device (stored in localStorage).
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px 110px", gap: 8, fontSize: 12, color: "#a7a7a7", paddingBottom: 8, borderBottom: "1px solid #2a2a2a" }}>
              <div>Child</div>
              <div style={{ textAlign: "right" }}>Days</div>
              <div style={{ textAlign: "right" }}>Minutes</div>
              <div style={{ textAlign: "right" }}>Total</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {reportRows.map((r) => (
                <div key={r.id} style={{ ...rowStyle(), padding: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>{r.name}</div>
                    <div style={smallMuted()}>{r.active ? "Active" : "Archived"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                    <div style={{ width: 80, textAlign: "right" }}>{r.days}</div>
                    <div style={{ width: 100, textAlign: "right" }}>{r.minutes}</div>
                    <div style={{ width: 100, textAlign: "right", fontWeight: 800 }}>{fmtDuration(r.minutes)}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button
                style={buttonStyle("outline")}
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY);
                  window.location.reload();
                }}
              >
                Reset demo data
              </button>
            </div>
          </div>
        )}

        {/* Notes Modal */}
        {noteOpen && pending && (
          <div style={modalOverlay()} onClick={() => { setNoteOpen(false); setPending(null); }}>
            <div style={modalCard()} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>
                {pending.type === "CHECK_IN" ? "Check in note" : "Check out note"}
              </div>
              <div style={{ ...smallMuted(), marginTop: 4 }}>
                Optional note shows on daily sheets and PDFs later.
              </div>

              <div style={{ marginTop: 12 }}>
                <input
                  style={inputStyle()}
                  placeholder="Tap a quick note or type your own…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ ...smallMuted(), marginBottom: 8 }}>Quick notes</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(pending.type === "CHECK_IN" ? QUICK_IN : QUICK_OUT).map((q) => (
                    <button
                      key={q}
                      style={buttonStyle("outline")}
                      onClick={() => setNoteText((n) => appendNote(n, q))}
                    >
                      + {q}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button style={buttonStyle("outline")} onClick={() => setNoteText("")}>Clear</button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={buttonStyle("outline")} onClick={() => { setNoteOpen(false); setPending(null); }}>Cancel</button>
                  <button style={buttonStyle("primary")} onClick={confirmNote}>
                    {pending.type === "CHECK_IN" ? "Save & Check in" : "Save & Check out"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Child Modal */}
        {childOpen && (
          <div style={modalOverlay()} onClick={() => setChildOpen(false)}>
            <div style={modalCard()} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>{childMode === "ADD" ? "Add child" : "Edit child"}</div>
              <div style={{ ...smallMuted(), marginTop: 4 }}>For now, this stores locally. Firebase comes next.</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                <div>
                  <div style={smallMuted()}>First name</div>
                  <input style={inputStyle()} value={childForm.firstName} onChange={(e) => setChildForm({ ...childForm, firstName: e.target.value })} />
                </div>
                <div>
                  <div style={smallMuted()}>Last name</div>
                  <input style={inputStyle()} value={childForm.lastName} onChange={(e) => setChildForm({ ...childForm, lastName: e.target.value })} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={smallMuted()}>Guardian (required)</div>
                  <input style={inputStyle()} value={childForm.guardian} onChange={(e) => setChildForm({ ...childForm, guardian: e.target.value })} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={smallMuted()}>Allergies (optional)</div>
                  <input style={inputStyle()} value={childForm.allergies} onChange={(e) => setChildForm({ ...childForm, allergies: e.target.value })} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                <input
                  type="checkbox"
                  checked={childForm.isActive}
                  onChange={(e) => setChildForm({ ...childForm, isActive: e.target.checked })}
                />
                <div style={{ fontWeight: 700 }}>Active</div>
                <div style={smallMuted()}>(uncheck to archive)</div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                <button style={buttonStyle("outline")} onClick={() => setChildOpen(false)}>Cancel</button>
                <button style={buttonStyle("primary")} onClick={saveChild}>
                  {childMode === "ADD" ? "Create" : "Save"}
                </button>
              </div>

              <div style={{ marginTop: 10, ...smallMuted() }}>
                Tip: Add a child, then go to Today and try Check in/out with notes.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

