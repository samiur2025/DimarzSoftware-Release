import React, { useState, useEffect, useContext } from "react";
import { AppContext } from "../../App";
import { getSavedScripts, SavedScript, toCsvUrl, parseCsv } from "./GoogleFormScriptPage";

interface Props {
  className: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  linkedin: string;
  category: string;
  address: string;
  status: "new" | "reviewed" | "rejected";
  submitted_date: string;
  source: string; // which script/sheet it came from
}

const TEAM_STORAGE_KEY = "dimrz_team_members";

const TeamPage: React.FC<Props> = ({ className }) => {
  const { showPage, showToast } = useContext(AppContext);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Manual Onboarding State
  const [showManualForm, setShowManualForm] = useState(false);
  const [draftMember, setDraftMember] = useState<Partial<TeamMember>>({});

  useEffect(() => {
    loadFromStorage();
  }, []);

  const loadFromStorage = () => {
    try {
      const stored = localStorage.getItem(TEAM_STORAGE_KEY);
      if (stored) setMembers(JSON.parse(stored));
    } catch { /* ignore */ }
  };

  const persistMembers = (updated: TeamMember[]) => {
    localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(updated));
    setMembers(updated);
  };

  // Map Google Sheet row fields → TeamMember fields
  // Flexible: tries common column name patterns
  const mapRowToMember = (row: Record<string, string>, scriptName: string, idx: number): TeamMember => {
    const get = (...keys: string[]) => {
      for (const k of keys) {
        const found = Object.keys(row).find(rk => rk.toLowerCase().replace(/\s+/g, "") === k.toLowerCase().replace(/\s+/g, ""));
        if (found && row[found]) return String(row[found]).trim();
      }
      return "";
    };

    return {
      id: `${Date.now()}-${idx}`,
      name: get("name", "fullname", "full name", "your name", "applicant name") || `Applicant ${idx + 1}`,
      email: get("email", "email address", "your email", "e-mail"),
      phone: get("phone", "phone number", "mobile", "contact number"),
      whatsapp: get("whatsapp", "whatsapp number", "whatsapp no"),
      linkedin: get("linkedin", "linkedin profile", "linkedin url"),
      category: get("category", "role", "position", "job category", "applying for", "department"),
      address: get("address", "location", "city", "country", "your location"),
      status: "new",
      submitted_date: get("timestamp", "date", "submitted", "submission date", "submission time") || new Date().toLocaleDateString(),
      source: scriptName,
    };
  };

  const handleSyncNow = async () => {
    const scripts: SavedScript[] = getSavedScripts();
    if (scripts.length === 0) {
      showToast("No sheet links saved. Go to Google Form Script page to add one.", "error");
      return;
    }

    setSyncing(true);
    let totalNew = 0;
    const existing = [...members];
    const existingIds = new Set(existing.map(m => `${m.source}-${m.name}-${m.email}`));

    for (const script of scripts) {
      const csvUrl = toCsvUrl(script.shareUrl);
      if (!csvUrl) { showToast(`Invalid URL for "${script.name}"`, "error"); continue; }
      try {
        const res = await fetch(csvUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status} — make sure the sheet is shared as "Anyone with the link can view".`);
        const text = await res.text();
        const rows = parseCsv(text);

        // cache for offline use
        localStorage.setItem(`dimrz_sheet_data_${script.id}`, JSON.stringify(rows));

        rows.forEach((row, idx) => {
          const member = mapRowToMember(row, script.name, idx);
          const uniqueKey = `${member.source}-${member.name}-${member.email}`;
          if (!existingIds.has(uniqueKey)) {
            existing.push(member);
            existingIds.add(uniqueKey);
            totalNew++;
          }
        });

        // update last synced
        const allScripts = getSavedScripts().map(s =>
          s.id === script.id ? { ...s, lastSynced: new Date().toLocaleString() } : s
        );
        localStorage.setItem("dimrz_gform_scripts", JSON.stringify(allScripts));
      } catch (e) {
        showToast(`Failed to sync "${script.name}": ${(e as Error).message}`, "error");
      }
    }

    persistMembers(existing);
    setSyncing(false);
    if (totalNew > 0) {
      showToast(`✅ Synced ${totalNew} new application(s) from Google Sheets!`, "success");
    } else {
      showToast("Sync complete — no new applications found.", "info");
    }
  };

  // Also load from cached localStorage sheet data (offline mode)
  const handleLoadCached = () => {
    const scripts = getSavedScripts();
    if (scripts.length === 0) {
      showToast("No scripts saved yet.", "error");
      return;
    }
    const existing = [...members];
    const existingIds = new Set(existing.map(m => `${m.source}-${m.name}-${m.email}`));
    let totalNew = 0;

    scripts.forEach(script => {
      try {
        const cached = localStorage.getItem(`dimrz_sheet_data_${script.id}`);
        if (!cached) return;
        const rows = JSON.parse(cached) as Record<string, string>[];
        rows.forEach((row, idx) => {
          const member = mapRowToMember(row, script.name, idx);
          const uniqueKey = `${member.source}-${member.name}-${member.email}`;
          if (!existingIds.has(uniqueKey)) {
            existing.push(member);
            existingIds.add(uniqueKey);
            totalNew++;
          }
        });
      } catch { /* ignore */ }
    });

    persistMembers(existing);
    if (totalNew > 0) {
      showToast(`Loaded ${totalNew} cached application(s).`, "success");
    } else {
      showToast("No cached data found.", "info");
    }
  };

  const handleManualSubmit = () => {
    if (!draftMember.name || !draftMember.email) {
      showToast("Name and Email are required.", "error");
      return;
    }
    const newMember: TeamMember = {
      id: `manual-${Date.now()}`,
      name: draftMember.name,
      email: draftMember.email,
      phone: draftMember.phone || "",
      whatsapp: draftMember.whatsapp || "",
      linkedin: draftMember.linkedin || "",
      category: draftMember.category || "",
      address: draftMember.address || "",
      status: "new",
      submitted_date: new Date().toLocaleDateString(),
      source: "Manual Entry"
    };
    persistMembers([newMember, ...members]);
    setShowManualForm(false);
    setDraftMember({});
    showToast("Application created successfully.", "success");
  };

  const updateStatus = (id: string, status: "reviewed" | "rejected") => {
    const updated = members.map(m => m.id === id ? { ...m, status } : m);
    persistMembers(updated);
    setSelectedMember(null);
    showToast(`Status updated to ${status}.`, "success");
  };

  const deleteMember = (id: string) => {
    persistMembers(members.filter(m => m.id !== id));
    showToast("Application removed.", "info");
  };

  const handleHire = (member: TeamMember) => {
    try {
      const myTeamKey = "dimrz_my_team";
      const stored = localStorage.getItem(myTeamKey);
      const myTeam = stored ? JSON.parse(stored) : [];
      
      // Check if already in My Team
      if (myTeam.some((m: TeamMember) => m.id === member.id)) {
        showToast(`${member.name} is already in your team!`, "info");
      } else {
        myTeam.push(member);
        localStorage.setItem(myTeamKey, JSON.stringify(myTeam));
        showToast(`${member.name} hired! Added to My Team.`, "success");
      }
      
      // Mark as reviewed in onboarding list
      updateStatus(member.id, "reviewed");
      
      // Redirect to My Team page
      showPage("myTeam");
    } catch (e) {
      showToast(`Failed to hire member: ${(e as Error).message}`, "error");
    }
  };

  const handleBulkHire = () => {
    if (selectedIds.size === 0) return;
    try {
      const myTeamKey = "dimrz_my_team";
      const stored = localStorage.getItem(myTeamKey);
      const myTeam = stored ? JSON.parse(stored) : [];
      let newHires = 0;

      const membersToHire = members.filter(m => selectedIds.has(m.id));
      const existingIds = new Set(myTeam.map((m: TeamMember) => m.id));

      membersToHire.forEach(member => {
        if (!existingIds.has(member.id)) {
          myTeam.push(member);
          existingIds.add(member.id);
          newHires++;
        }
      });

      localStorage.setItem(myTeamKey, JSON.stringify(myTeam));

      // Mark as reviewed in onboarding list
      const updatedMembers = members.map(m => selectedIds.has(m.id) ? { ...m, status: "reviewed" as const } : m);
      persistMembers(updatedMembers);

      if (newHires > 0) {
        showToast(`Hired ${newHires} member(s)! Added to My Team.`, "success");
      } else {
        showToast("Selected members are already in your team.", "info");
      }

      setSelectedIds(new Set());
      showPage("myTeam");
    } catch (e) {
      showToast(`Bulk hire failed: ${(e as Error).message}`, "error");
    }
  };

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.source.toLowerCase().includes(q);
    const matchesStatus = !statusFilter || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: members.length,
    newCount: members.filter(m => m.status === "new").length,
    reviewed: members.filter(m => m.status === "reviewed").length,
  };

  const statusClass = (s: string) =>
    s === "new" ? "status-qualified" : s === "reviewed" ? "status-new" : "status-lost";
  const statusLabel = (s: string) =>
    s === "new" ? "NEW" : s === "reviewed" ? "Reviewed" : "Rejected";

  return (
    <div className={className} id="teamPage" style={{ padding: 0, overflow: "hidden", flexDirection: "column" }}>
      <div style={{ padding: "24px 24px 0", flexShrink: 0 }}>

        {/* Header */}
        <div className="content-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="header-left">
            <div>
              <div className="page-title" style={{ fontSize: 22, fontStyle: "italic", fontWeight: 800, letterSpacing: "-0.5px" }}>ONBOARDING</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Manage and review incoming team applications from Google Forms.
              </div>
            </div>
          </div>
          <div className="header-actions">
            {selectedIds.size > 0 && (
              <button className="btn btn-success" onClick={handleBulkHire}>
                <span>👥</span> Hire Selected ({selectedIds.size})
              </button>
            )}
            <button className="btn btn-primary" onClick={() => { setDraftMember({}); setShowManualForm(true); }} style={{ background: "linear-gradient(135deg, #4a90d4, #2b5c8f)", borderColor: "rgba(74,144,212,0.3)" }}>
              <span>📝</span> Add Onboarding
            </button>
            <button className="btn btn-secondary" onClick={() => showPage("gformScript")}>
              <span>📜</span> Send Form
            </button>
            <button className="btn btn-secondary" onClick={handleLoadCached} title="Load from last cached sync">
              <span>📦</span> Load Cached
            </button>
            <button className="btn btn-primary" onClick={handleSyncNow} disabled={syncing}>
              <span>{syncing ? "⏳" : "🔄"}</span> {syncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        </div>

        {/* Stat cards - compact style */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Total Submissions", value: stats.total, icon: "👥", color: "var(--info)", bg: "rgba(74,144,212,0.1)", sub: "From Google Form" },
            { label: "New Applications", value: stats.newCount, icon: "🆕", color: "var(--warning)", bg: "rgba(245,158,11,0.1)", sub: "Awaiting review" },
            { label: "Reviewed", value: stats.reviewed, icon: "✅", color: "var(--success)", bg: "rgba(61,184,122,0.1)", sub: "Processed" },
          ].map(s => (
            <div className="card" key={s.label} style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div className="search-box" style={{ position: "relative", flex: 1, maxWidth: 500 }}>
            <span className="search-icon" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 14 }}>🔍</span>
            <input
              type="text"
              placeholder="Search by name, email, or category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 12px 10px 36px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: 14, outline: "none" }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: "10px 12px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: 14, outline: "none", cursor: "pointer" }}
          >
            <option value="">All Statuses</option>
            <option value="new">🟡 NEW</option>
            <option value="reviewed">🟢 Reviewed</option>
            <option value="rejected">🔴 Rejected</option>
          </select>
        </div>

      </div>
      
      {/* Scrollable Table Area */}
      <div style={{ padding: "0 24px 24px", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "auto" }}>
            <table className="data-table" id="teamTable" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ width: 30 }}>
                    <input 
                      type="checkbox" className="table-checkbox" 
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={e => {
                        if (e.target.checked) setSelectedIds(new Set(filtered.map(m => m.id)));
                        else setSelectedIds(new Set());
                      }}
                    />
                  </th>
                  <th style={{ width: 40 }}>#</th>
                  <th>Submitted</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>WhatsApp</th>
                  <th>LinkedIn</th>
                  <th>Category</th>
                  <th>Address</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th style={{ width: 120, textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, idx) => (
                  <tr key={m.id}>
                    <td>
                      <input 
                        type="checkbox" className="table-checkbox" 
                        checked={selectedIds.has(m.id)}
                        onChange={e => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) next.add(m.id);
                          else next.delete(m.id);
                          setSelectedIds(next);
                        }}
                      />
                    </td>
                    <td>{idx + 1}</td>
                    <td>{m.submitted_date || "—"}</td>
                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                    <td>
                      {m.email
                        ? <a href={`mailto:${m.email}`} className="email-link">{m.email}</a>
                        : "—"}
                    </td>
                    <td>
                      {m.whatsapp
                        ? <span style={{ color: "var(--success)" }}>📱 {m.whatsapp}</span>
                        : "—"}
                    </td>
                    <td>
                      {m.linkedin
                        ? <a href={m.linkedin.startsWith("http") ? m.linkedin : `https://${m.linkedin}`} target="_blank" rel="noreferrer" className="linkedin-link">Visit ↗</a>
                        : "—"}
                    </td>
                    <td><span className="niche-tag">{m.category || "—"}</span></td>
                    <td style={{ maxWidth: 160, whiteSpace: "normal", fontSize: 11 }}>{m.address || "—"}</td>
                    <td style={{ fontSize: 10, color: "var(--text-muted)" }}>{m.source}</td>
                    <td><span className={`status-badge ${statusClass(m.status)}`}>{statusLabel(m.status)}</span></td>
                    <td style={{ textAlign: "center" }}>
                      <button className="ops-btn view" title="Hire (Add to My Team)" onClick={() => handleHire(m)} style={{ background: "rgba(34, 197, 94, 0.1)", color: "var(--success)" }}>➕</button>
                      <button className="ops-btn view" title="View" onClick={() => setSelectedMember(m)}>👁</button>
                      <button className="ops-btn edit" title="Mark Reviewed" onClick={() => updateStatus(m.id, "reviewed")}>✓</button>
                      <button className="ops-btn delete" title="Reject" onClick={() => updateStatus(m.id, "rejected")}>✕</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={12} style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
                      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📋</div>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>No applications</div>
                      <div style={{ fontSize: 13 }}>
                        {members.length === 0
                          ? <>Add a Google Sheet script URL in <strong>Google Form Script</strong>, then click <strong>Sync Now</strong>.</>
                          : "No results match your search."}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Showing <strong>1-{filtered.length}</strong> of <strong>{filtered.length}</strong> applications
            </div>
            {members.length > 0 && (
              <button
                className="btn btn-danger"
                style={{ fontSize: 11, padding: "5px 10px" }}
                onClick={() => { if (confirm("Clear all applications?")) persistMembers([]); }}
              >
                🗑 Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedMember && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)" }}
          onClick={() => setSelectedMember(null)}
        >
          <div
            style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.8)" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header Cover Area */}
            <div style={{ padding: "32px 32px 24px", position: "relative", borderBottom: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 16 }}>
              <button onClick={() => setSelectedMember(null)} style={{ position: "absolute", top: 16, right: 16, background: "var(--bg-hover)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>✕</button>
              
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                {/* Avatar */}
                <div style={{ width: 72, height: 72, borderRadius: 36, background: "rgba(59,130,246,0.1)", color: "var(--info)", border: "1px solid rgba(59,130,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700 }}>
                  {selectedMember.name.charAt(0).toUpperCase()}
                </div>
                
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>{selectedMember.name}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500, marginTop: 4 }}>{selectedMember.category || "No Role Specified"}</div>
                  
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {selectedMember.linkedin && (
                      <a href={selectedMember.linkedin.startsWith("http") ? selectedMember.linkedin : `https://${selectedMember.linkedin}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "rgba(59,130,246,0.1)", color: "var(--info)", borderRadius: 6, textDecoration: "none", border: "1px solid rgba(59,130,246,0.2)" }}>
                        🔗 LinkedIn Profile
                      </a>
                    )}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "var(--bg-hover)", color: "var(--text-secondary)", borderRadius: 6, border: "1px solid var(--border-color)" }}>
                      🕒 {selectedMember.submitted_date || "Unknown Date"}
                    </span>
                    <span className={`status-badge ${statusClass(selectedMember.status)}`}>{statusLabel(selectedMember.status)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Contact Card */}
                <div style={{ background: "var(--bg-secondary)", padding: 20, borderRadius: 12, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Contact Info</div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Email Address</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{selectedMember.email ? <a href={`mailto:${selectedMember.email}`} style={{ color: "var(--text-primary)", textDecoration: "none" }}>{selectedMember.email}</a> : "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Phone Number</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{selectedMember.phone || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>WhatsApp</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--success)" }}>{selectedMember.whatsapp || "—"}</div>
                  </div>
                </div>

                {/* Details Card */}
                <div style={{ background: "var(--bg-secondary)", padding: 20, borderRadius: 12, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Application Details</div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Location</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{selectedMember.address || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Source Form</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{selectedMember.source || "—"}</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ paddingTop: 24, borderTop: "1px solid var(--border-color)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <button className="btn btn-primary" style={{ padding: "10px", fontSize: 13, gridColumn: "1 / -1" }} onClick={() => handleHire(selectedMember)}>
                  <span>➕</span> Hire (Add to Team)
                </button>
                <button className="btn btn-success" style={{ padding: "10px", fontSize: 13 }} onClick={() => updateStatus(selectedMember.id, "reviewed")}>
                  ✓ Mark Reviewed
                </button>
                <button className="btn btn-danger" style={{ padding: "10px", fontSize: 13 }} onClick={() => updateStatus(selectedMember.id, "rejected")}>
                  ✕ Reject
                </button>
                <button className="btn btn-secondary" style={{ padding: "10px", fontSize: 13, gridColumn: "1 / -1" }} onClick={() => { deleteMember(selectedMember.id); setSelectedMember(null); }}>
                  🗑 Delete Application
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Onboarding Modal */}
      {showManualForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, boxSizing: "border-box" }}>
          <div style={{ background: "var(--bg-secondary)", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "90vh", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "0 32px 64px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-primary)", flexShrink: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(74,144,212,0.1)", color: "var(--info)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📝</div>
                Manual Onboarding
              </div>
              <button onClick={() => setShowManualForm(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✕</button>
            </div>
            
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label required">Name</label>
                  <input type="text" className="form-input" placeholder="John Doe" value={draftMember.name || ""} onChange={e => setDraftMember({ ...draftMember, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label required">Email</label>
                  <input type="email" className="form-input" placeholder="john@example.com" value={draftMember.email || ""} onChange={e => setDraftMember({ ...draftMember, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input type="text" className="form-input" placeholder="+1 234 567 890" value={draftMember.phone || ""} onChange={e => setDraftMember({ ...draftMember, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">WhatsApp</label>
                  <input type="text" className="form-input" placeholder="+1 234 567 890" value={draftMember.whatsapp || ""} onChange={e => setDraftMember({ ...draftMember, whatsapp: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">LinkedIn (URL)</label>
                  <input type="url" className="form-input" placeholder="https://linkedin.com/in/..." value={draftMember.linkedin || ""} onChange={e => setDraftMember({ ...draftMember, linkedin: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category / Role</label>
                  <input type="text" className="form-input" placeholder="e.g. Lead Generator" value={draftMember.category || ""} onChange={e => setDraftMember({ ...draftMember, category: e.target.value })} />
                </div>
                <div className="form-group" style={{ gridColumn: "1/-1" }}>
                  <label className="form-label">Address</label>
                  <input type="text" className="form-input" placeholder="City, Country" value={draftMember.address || ""} onChange={e => setDraftMember({ ...draftMember, address: e.target.value })} />
                </div>
              </div>
            </div>
            
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-color)", display: "flex", gap: 12, justifyContent: "flex-end", background: "var(--bg-primary)" }}>
              <button className="btn btn-secondary" onClick={() => setShowManualForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleManualSubmit}>Submit Application</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeamPage;
