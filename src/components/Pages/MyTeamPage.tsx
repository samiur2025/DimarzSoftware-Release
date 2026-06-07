import React, { useState, useEffect, useContext } from "react";
import { AppContext } from "../../App";
import { Project } from "./ProjectsPage";
import { open } from "@tauri-apps/plugin-shell";
import { writeFile } from "@tauri-apps/plugin-fs";
import { save } from "@tauri-apps/plugin-dialog";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

interface Props {
  className: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  linkedin: string;
  category: string;
  address: string;
  status: string;
  submitted_date: string;
  source: string;
}

const MY_TEAM_STORAGE_KEY = "dimrz_my_team";

const MyTeamPage: React.FC<Props> = ({ className }) => {
  const { showPage, showToast, triggerRefresh } = useContext(AppContext);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [projects] = useState<Project[]>(() => {
    const saved = localStorage.getItem("dimrz_projects");
    return saved ? JSON.parse(saved) : [];
  });
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<TeamMember | null>(null);

  // Manual Member State
  const [showManualForm, setShowManualForm] = useState(false);
  const [draftMember, setDraftMember] = useState<Partial<TeamMember>>({});
  
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const openModal = (m: TeamMember) => {
    setSelectedMember(m);
    setEditMode(false);
    setEditDraft(null);
  };

  const startEdit = () => {
    setEditDraft({ ...selectedMember! });
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditDraft(null);
  };

  const handleSaveEdit = () => {
    if (!editDraft) return;
    const updated = members.map(m => m.id === editDraft.id ? editDraft : m);
    persistMembers(updated);
    setSelectedMember(editDraft);
    setEditMode(false);
    setEditDraft(null);
    showToast("Member profile updated!", "success");
  };

  const deleteMember = (id: string) => {
    const isAssigned = projects.some(p => p.assignments?.some(a => String(a.member_id) === String(id)));
    if (isAssigned) {
      if (confirm("This team member is assigned to active projects and cannot be deleted. Would you like to Archive them instead so their calculations are saved?")) {
        const updated = members.map(m => m.id === id ? { ...m, status: "archived" } : m);
        persistMembers(updated);
        showToast("Member has been archived.", "success");
        setSelectedMember(null);
      }
      return;
    }

    if (!confirm("Are you sure you want to permanently delete this member?")) return;
    persistMembers(members.filter(m => m.id !== id));
    showToast("Member permanently removed.", "info");
    setSelectedMember(null);
  };

  const restoreMember = (id: string) => {
    if (!confirm("Are you sure you want to restore this member to the active team?")) return;
    const updated = members.map(m => m.id === id ? { ...m, status: "reviewed" } : m);
    persistMembers(updated);
    showToast("Member restored successfully.", "success");
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
      status: "reviewed",
      submitted_date: new Date().toLocaleDateString(),
      source: "Manual Entry"
    };
    persistMembers([...members, newMember]);
    setShowManualForm(false);
    setDraftMember({});
    showToast("Team member added successfully.", "success");
  };

  useEffect(() => { loadFromStorage(); }, [className]);

  useEffect(() => {
    const handleOpenProfile = (e: any) => {
      const memberId = e.detail?.memberId;
      if (memberId) {
        const member = members.find(m => String(m.id) === String(memberId));
        if (member) {
          openModal(member);
        }
      }
    };
    const handleOpenPayslip = (e: any) => {
      const slip = e.detail?.slip;
      if (slip && slip.member) {
        showPage("myTeam");
        setSelectedMember(slip.member);
        setTimeout(() => {
          setSelectedPayslip(slip);
        }, 100);
      }
    };
    window.addEventListener("open-member-profile", handleOpenProfile);
    window.addEventListener("open-payslip-modal", handleOpenPayslip);
    return () => {
      window.removeEventListener("open-member-profile", handleOpenProfile);
      window.removeEventListener("open-payslip-modal", handleOpenPayslip);
    };
  }, [members]);

  const loadFromStorage = () => {
    try {
      const stored = localStorage.getItem(MY_TEAM_STORAGE_KEY);
      if (stored) setMembers(JSON.parse(stored));
    } catch { /* ignore */ }
  };

  const handleOpenProject = (projectId: string) => {
    showPage("projects");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("open-project-view", { detail: { projectId } }));
    }, 100);
  };

  const persistMembers = (updated: TeamMember[]) => {
    localStorage.setItem(MY_TEAM_STORAGE_KEY, JSON.stringify(updated));
    setMembers(updated);
    triggerRefresh();
  };

  const filtered = members.filter(m => {
    const statusMatch = viewMode === "archived" ? m.status === "archived" : m.status !== "archived";
    const q = search.toLowerCase();
    return statusMatch && (!q ||
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q));
  });

  let totalPaid = 0;
  let totalDue = 0;

  filtered.forEach(m => {
    const teamProjects = projects.filter(p => p.assignments?.some(a => String(a.member_id) === String(m.id)));
    let mCost = 0;
    let mPaid = 0;
    teamProjects.forEach(p => {
      const assignment = p.assignments?.find(a => String(a.member_id) === String(m.id));
      if (assignment) {
        mCost += p.project_type === "Lead Generation" ? assignment.leads * assignment.rate : assignment.rate;
        if (assignment.payments) {
          assignment.payments.forEach(pay => {
            mPaid += pay.amount;
          });
        }
      }
    });
    totalPaid += mPaid;
    totalDue += Math.max(0, mCost - mPaid);
  });

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(m => String(m.id))));
    }
    setSelectAll(!selectAll);
  };

  const toggleMember = (id: string) => {
    const next = new Set(selected);
    const sid = String(id);
    if (next.has(sid)) next.delete(sid);
    else next.add(sid);
    setSelected(next);
  };

  const handleDeleteSelected = () => {
    if (selected.size === 0) return;
    const membersToDelete = members.filter(m => selected.has(String(m.id)));
    
    const hasAssignedProjects = membersToDelete.some(m => projects.some(p => p.assignments?.some(a => String(a.member_id) === String(m.id))));
    if (hasAssignedProjects) {
      if (confirm("⚠️ One or more selected members are assigned to active projects. Would you like to Archive them instead so their calculations are saved?")) {
        const updated = members.map(m => selected.has(String(m.id)) ? { ...m, status: "archived" } : m);
        persistMembers(updated);
        showToast("Selected members have been archived.", "success");
        setSelected(new Set());
        setSelectAll(false);
      }
      return;
    }

    if (confirm(`Are you sure you want to permanently delete ${selected.size} member(s)?`)) {
      persistMembers(members.filter(m => !selected.has(String(m.id))));
      if (selectedMember && selected.has(String(selectedMember.id))) {
        setSelectedMember(null);
      }
      setSelected(new Set());
      setSelectAll(false);
      showToast("Members permanently removed.", "info");
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      alert("No data to export");
      return;
    }
    
    const targetMembers = selected.size > 0 ? members.filter(m => selected.has(String(m.id))) : filtered;
    
    const headers = ["Name", "Email", "Phone", "WhatsApp", "LinkedIn", "Role", "Location", "Status", "Hired On"];
    const rows = targetMembers.map(m => [
      m.name, m.email, m.phone, m.whatsapp, m.linkedin, m.category, m.address, m.status, m.submitted_date
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(field => `"${String(field || "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "dimrz_team_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTaka = (n: number | string) => {
    const num = Number(n);
    if (isNaN(num)) return "৳0.00";
    return `৳${num.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className={className} id="myTeamPage" style={{ padding: 0, overflow: "hidden", flexDirection: "column" }}>
      <div style={{ padding: "24px 24px 0", flexShrink: 0 }}>

        {/* ── Stats Cards ── */}
        <div className="leads-stat-cards">
          <div className="leads-stat-card leads-stat-card--dark">
            <div className="lsc-number">{filtered.length.toLocaleString()}</div>
            <div className="lsc-label">TOTAL MEMBERS</div>
          </div>
          <div className="leads-stat-card leads-stat-card--blue">
            <div className="lsc-number">{formatTaka(totalPaid)}</div>
            <div className="lsc-label">TOTAL TEAM PAYMENT</div>
          </div>
          <div className="leads-stat-card leads-stat-card--orange">
            <div className="lsc-number">{formatTaka(totalDue)}</div>
            <div className="lsc-label">TOTAL TEAM DUE</div>
          </div>
        </div>

        {/* Header */}
        <div className="content-header">
          <div className="header-left">
            <h1 className="page-title">My Team</h1>
            <span className="total-count">Total: <strong>{filtered.length.toLocaleString()}</strong> members {selected.size > 0 && `| ${selected.size} selected`}</span>
          </div>
          <div className="header-actions" style={{ display: "flex", gap: 12 }}>
            <div style={{ display: "flex", background: "var(--bg-input)", borderRadius: 8, padding: "3px", border: "1px solid var(--border-color)", alignItems: "center" }}>
              <button onClick={() => setViewMode("active")} style={{ padding: "5px 14px", background: viewMode === "active" ? "var(--bg-panel)" : "transparent", color: viewMode === "active" ? "var(--text-primary)" : "var(--text-muted)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: viewMode === "active" ? "0 2px 4px rgba(0,0,0,0.1)" : "none", lineHeight: "1.5" }}>👥 Active</button>
              <button onClick={() => setViewMode("archived")} style={{ padding: "5px 14px", background: viewMode === "archived" ? "var(--bg-panel)" : "transparent", color: viewMode === "archived" ? "var(--text-primary)" : "var(--text-muted)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: viewMode === "archived" ? "0 2px 4px rgba(0,0,0,0.1)" : "none", lineHeight: "1.5" }}>🗄️ Archived</button>
            </div>

            <button className="btn btn-secondary" onClick={toggleSelectAll}>
              <span>{selected.size > 0 ? "✕" : "☐"}</span> {selected.size > 0 ? "Clear Selection" : "Select All"}
            </button>
            <button className="btn btn-danger" onClick={handleDeleteSelected} disabled={selected.size === 0}>
              <span>🗑</span> Delete
            </button>
            <button className="btn btn-secondary" onClick={handleExport} disabled={filtered.length === 0}>
              <span>📥</span> Export CSV
            </button>
            <button className="btn btn-primary" onClick={() => { setDraftMember({}); setShowManualForm(true); }} style={{ background: "linear-gradient(135deg, #3db87a, #2a8758)", borderColor: "rgba(61,184,122,0.3)" }}>
              <span>➕</span> Add Team Member
            </button>
          </div>
        </div>

      </div>

      {/* Card with Search, Table, and Pagination */}
      <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", borderLeft: "1px solid var(--border-color)", borderRight: "1px solid var(--border-color)", margin: "0 24px 24px" }}>
        
        {/* Search */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div className="search-box" style={{ position: "relative", width: 320 }}>
            <span className="search-icon" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 14 }}>🔍</span>
            <input
              type="text"
              placeholder="Search team members by name, email, or role..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "8px 12px 8px 36px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none" }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setSearch("")} style={{ fontSize: 12, padding: "6px 12px" }}><span>↺</span> Reset Search</button>
          </div>
        </div>

        <div className="table-wrap" style={{ overflow: "auto", flex: 1 }}>
          <table className="data-table" id="myTeamTable">
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr>
                <th style={{ width: 40 }}><input type="checkbox" className="table-checkbox" checked={selectAll && filtered.length > 0} onChange={toggleSelectAll} /></th>
                <th style={{ width: 40 }}>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>WhatsApp</th>
                <th>LinkedIn</th>
                <th>Role</th>
                <th>Location</th>
                <th>Hired On</th>
                <th style={{ width: 80, textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, idx) => {
                const isAssigned = projects.some(p => p.assignments?.some(a => String(a.member_id) === String(m.id)));
                const isSelected = selected.has(String(m.id));
                return (
                <tr key={m.id} style={{ background: isSelected ? "rgba(100, 200, 255, 0.05)" : "transparent" }}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="table-checkbox" checked={isSelected} onChange={() => toggleMember(String(m.id))} />
                  </td>
                  <td><span className="sl-number">{String(idx + 1).padStart(2, '0')}</span></td>
                    <td style={{ fontWeight: 600 }}>
                      {m.name}
                      {m.status === 'archived' && <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 6px", background: "rgba(239,68,68,0.1)", color: "var(--danger)", borderRadius: 4, textTransform: "uppercase" }}>Archived</span>}
                    </td>
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
                    <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.submitted_date || "—"}</td>
                    <td style={{ textAlign: "center" }}>
                      <button className="ops-btn view" title="View Profile" onClick={() => openModal(m)}>👁</button>
                      {viewMode === "archived" ? (
                        <button className="ops-btn" title="Restore" onClick={() => restoreMember(m.id)} style={{ color: "var(--success)" }}>↺</button>
                      ) : (
                        <button className="ops-btn delete" title={isAssigned ? "Send Archived?" : "Remove"} onClick={() => deleteMember(m.id)}>
                          {isAssigned ? "🗃️" : "✕"}
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
                      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>👥</div>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>Your team is empty</div>
                      <div style={{ fontSize: 13 }}>
                        {members.length === 0
                          ? <>Go to the <strong>Onboarding</strong> page and click <strong>Hire</strong> to add members.</>
                          : "No team members match your search."}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="pagination-bar">
            <div className="pagination-info">Showing <strong>1-{filtered.length}</strong> of <strong>{filtered.length.toLocaleString()}</strong> members</div>
          </div>
        </div>

      {/* Detail Modal */}
      {selectedMember && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)" }}
          onClick={() => { setSelectedMember(null); setEditMode(false); setEditDraft(null); }}
        >
          <div
            style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 16, width: "100%", maxWidth: 1024, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.8)" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header with Avatar */}
            <div style={{ padding: "32px 32px 24px", position: "relative", borderBottom: "1px solid var(--border-color)" }}>
              <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
                {!editMode && (
                  <button onClick={startEdit} style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "var(--info)", padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✏️ Edit</button>
                )}
                <button onClick={() => { setSelectedMember(null); setEditMode(false); setEditDraft(null); }} style={{ background: "var(--bg-hover)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>✕</button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ width: 80, height: 80, borderRadius: 40, background: "rgba(34,197,94,0.1)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700, flexShrink: 0 }}>
                  {(editMode && editDraft ? editDraft.name : selectedMember.name).charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {editMode && editDraft ? (
                    <>
                      <input value={editDraft.name} onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} style={{ width: "100%", fontSize: 20, fontWeight: 800, background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "6px 10px", color: "var(--text-primary)", outline: "none", marginBottom: 8 }} placeholder="Name" />
                      <input value={editDraft.category} onChange={e => setEditDraft({ ...editDraft, category: e.target.value })} style={{ width: "100%", fontSize: 13, background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "5px 10px", color: "var(--text-muted)", outline: "none" }} placeholder="Role / Category" />
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>{selectedMember.name}</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500, marginTop: 4 }}>{selectedMember.category || "No Role Specified"}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                        {selectedMember.linkedin && (
                          <a href={selectedMember.linkedin.startsWith("http") ? selectedMember.linkedin : `https://${selectedMember.linkedin}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "rgba(59,130,246,0.1)", color: "var(--info)", borderRadius: 6, textDecoration: "none", border: "1px solid rgba(59,130,246,0.2)" }}>🔗 LinkedIn</a>
                        )}
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "rgba(34,197,94,0.1)", color: "var(--success)", borderRadius: 6, border: "1px solid rgba(34,197,94,0.2)" }}>✅ Hired</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

                {/* Contact Card */}
                <div style={{ background: "var(--bg-secondary)", padding: 20, borderRadius: 12, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 14, minWidth: 0, overflow: "hidden" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>📞 Contact Info</div>
                  {([
                    ["Email", "email"],
                    ["Phone", "phone"],
                    ["WhatsApp", "whatsapp"],
                    ["LinkedIn", "linkedin"],
                  ] as [string, keyof TeamMember][]).map(([label, key]) => (
                    <div key={key} style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
                      {editMode && editDraft ? (
                        <input value={editDraft[key] as string} onChange={e => setEditDraft({ ...editDraft, [key]: e.target.value })} style={{ width: "100%", fontSize: 13, background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} placeholder={label} />
                      ) : (
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", wordBreak: "break-word", overflow: "hidden" }}>
                          {key === "email" && selectedMember.email
                            ? <a href={`mailto:${selectedMember.email}`} style={{ color: "var(--info)", textDecoration: "none" }}>{selectedMember.email}</a>
                            : key === "linkedin" && selectedMember.linkedin
                            ? <a href={selectedMember.linkedin.startsWith("http") ? selectedMember.linkedin : `https://${selectedMember.linkedin}`} target="_blank" rel="noreferrer" style={{ color: "var(--info)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={selectedMember.linkedin}>Visit Profile ↗</a>
                            : (selectedMember[key] as string) || <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Details Card */}
                <div style={{ background: "var(--bg-secondary)", padding: 20, borderRadius: 12, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 14, minWidth: 0, overflow: "hidden" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>📋 Member Details</div>
                  {([
                    ["Location", "address"],
                    ["Hired On", "submitted_date"],
                    ["Source", "source"],
                  ] as [string, keyof TeamMember][]).map(([label, key]) => (
                    <div key={key} style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
                      {editMode && editDraft ? (
                        <input value={editDraft[key] as string} onChange={e => setEditDraft({ ...editDraft, [key]: e.target.value })} style={{ width: "100%", fontSize: 13, background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} placeholder={label} />
                      ) : (
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", wordBreak: "break-word" }}>{(selectedMember[key] as string) || <span style={{ color: "var(--text-muted)" }}>—</span>}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Projects List Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {(() => {
                   const teamProjects = projects.filter(p => p.assignments?.some(a => String(a.member_id) === String(selectedMember.id)));
                   const totalValue = teamProjects.reduce((s, p) => s + p.value, 0);
                   const totalInvoiced = teamProjects.reduce((s, p) => s + p.invoiced, 0);
                   const totalPaid = teamProjects.reduce((s, p) => s + p.paid, 0);
                   const totalDue = totalInvoiced - totalPaid;
                   return (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 8 }}>
                        <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 12, border: "1px solid var(--border-color)", borderLeft: "4px solid var(--text-primary)" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Project Value</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{formatTaka(totalValue)}</div>
                        </div>
                        <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 12, border: "1px solid var(--border-color)", borderLeft: "4px solid var(--info)" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Invoiced</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--info)" }}>{formatTaka(totalInvoiced)}</div>
                        </div>
                        <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 12, border: "1px solid var(--border-color)", borderLeft: "4px solid var(--success)" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Paid</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--success)" }}>{formatTaka(totalPaid)}</div>
                        </div>
                        <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 12, border: "1px solid var(--border-color)", borderLeft: "4px solid var(--danger)" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Due</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--danger)" }}>{formatTaka(totalDue)}</div>
                        </div>
                      </div>
                   );
                })()}
                <div style={{ fontSize: 16, fontWeight: 700, borderBottom: "1px solid var(--border-color)", paddingBottom: 8 }}>Associated Projects</div>
                
                <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border-color)" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table" style={{ fontSize: 12, width: "100%", margin: 0 }}>
                      <thead style={{ background: "var(--bg-secondary)" }}>
                        <tr>
                          <th>Project ID</th>
                          <th>Name</th>
                          <th>Type</th>
                          <th style={{ textAlign: "right" }}>Value</th>
                          <th style={{ textAlign: "right" }}>Invoiced</th>
                          <th style={{ textAlign: "right" }}>Paid</th>
                          <th style={{ textAlign: "right" }}>Due</th>
                          <th>Status</th>
                          <th>Deadline</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.filter(p => p.assignments?.some(a => String(a.member_id) === String(selectedMember.id))).map(p => {
                          const due = p.invoiced - p.paid;
                          const statusMap: Record<string, string> = { active: "status-contacted", pending: "status-qualified", completed: "status-new", onhold: "status-lost", cancelled: "status-lost" };
                          return (
                            <tr key={p.id}>
                              <td>#{p.id}</td>
                              <td style={{ maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 500 }} title={p.name}>{p.name}</td>
                              <td><span className="type-badge" style={{ fontSize: 10 }}>{p.project_type}</span></td>
                              <td className="financial-cell">{formatTaka(p.value)}</td>
                              <td className="financial-cell">{formatTaka(p.invoiced)}</td>
                              <td className="financial-cell financial-paid">{formatTaka(p.paid)}</td>
                              <td className={`financial-cell ${due > 0 ? "financial-due" : ""}`}>{formatTaka(due)}</td>
                              <td><span className={`status-badge ${statusMap[p.status] || "status-lost"}`} style={{ fontSize: 10 }}>{p.status}</span></td>
                              <td>{p.deadline || "—"}</td>
                            </tr>
                          );
                        })}
                        {projects.filter(p => p.assignments?.some(a => String(a.member_id) === String(selectedMember.id))).length === 0 && (
                          <tr>
                            <td colSpan={9} style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>
                              No projects assigned to this member.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Payslip Ledger */}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px dashed var(--border-color)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-secondary)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>📄</span> Payslip Ledger
                </div>
                {(() => {
                  const memberPayslips = projects.flatMap(p => {
                    const assignment = p.assignments?.find(a => String(a.member_id) === String(selectedMember.id));
                    if (!assignment) return [];
                    
                    if (assignment.payments && assignment.payments.length > 0) {
                      return assignment.payments.map((pay, index) => ({
                        projectId: `${p.id}-${pay.id}`,
                        displayId: `${p.id}`,
                        projectName: p.name + (assignment.payments!.length > 1 ? ` (Part ${index + 1})` : ""),
                        projectType: p.project_type,
                        date: pay.date,
                        leads: assignment.leads,
                        rate: assignment.rate,
                        amount: pay.amount,
                        isPartial: true,
                        totalCost: p.project_type === "Lead Generation" ? assignment.leads * assignment.rate : assignment.rate,
                        paymentIndex: index,
                        allPayments: assignment.payments,
                        isRevised: assignment.is_revised || false
                      }));
                    }
                    
                    return [{
                      projectId: `${p.id}`,
                      displayId: `${p.id}`,
                      projectName: p.name,
                      projectType: p.project_type,
                      date: p.deadline || new Date(p.id).toLocaleDateString() || "N/A",
                      leads: assignment.leads,
                      rate: assignment.rate,
                      amount: p.project_type === "Lead Generation" ? assignment.leads * assignment.rate : assignment.rate,
                      isPartial: false,
                      totalCost: p.project_type === "Lead Generation" ? assignment.leads * assignment.rate : assignment.rate,
                      isRevised: assignment.is_revised || false
                    }];
                  }).sort((a, b) => {
                    const aId = Number(a.displayId);
                    const bId = Number(b.displayId);
                    return bId - aId;
                  });

                  if (memberPayslips.length === 0) {
                    return <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13, background: "var(--bg-input)", borderRadius: 8, border: "1px dashed var(--border-color)" }}>No payslips generated for this member yet.</div>;
                  }

                  return (
                    <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
                      {memberPayslips.map(slip => (
                        <div key={slip.projectId} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 12, alignItems: "center", background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 10, padding: "14px 16px" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {slip.projectName} {slip.isRevised && <span style={{ color: "#dc2626", fontSize: 10, verticalAlign: "middle", marginLeft: 4 }}>(REVISED)</span>}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--info)", marginTop: 4, cursor: "pointer", display: "inline-block" }} onClick={() => handleOpenProject(slip.displayId)} title="Click to view Project">
                              <span style={{ textDecoration: "underline" }}>Project #{slip.displayId}</span> ↗
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{slip.date}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-input)", padding: "6px 10px", borderRadius: 6, textAlign: "center", fontWeight: 600 }}>
                            {slip.isPartial ? "Partial Payment" : (slip.projectType === "Lead Generation" ? `${slip.leads} Leads @ ৳${slip.rate}` : "Flat Assignment")}
                          </div>
                          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--success)" }}>{formatTaka(slip.amount)}</div>
                            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedPayslip(slip); }} style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "var(--success)", fontSize: 10, cursor: "pointer", fontWeight: 700, padding: "4px 10px", borderRadius: 6, textTransform: "uppercase" }}>📄 View Slip</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Actions */}
              <div style={{ paddingTop: 20, borderTop: "1px solid var(--border-color)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {editMode ? (
                  <>
                    <button className="btn btn-primary" style={{ padding: "10px", fontSize: 13, gridColumn: "1 / -1" }} onClick={handleSaveEdit}>
                      💾 Save Changes
                    </button>
                    <button className="btn btn-secondary" style={{ padding: "10px", fontSize: 13, gridColumn: "1 / -1" }} onClick={cancelEdit}>
                      ✕ Cancel Edit
                    </button>
                  </>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", gridColumn: "1 / -1" }}>
                    {selectedMember.status === "archived" ? (
                      <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12, opacity: 0.9, background: "var(--success)", border: "none" }} onClick={() => { restoreMember(selectedMember.id); setSelectedMember(null); }}>↺ Restore Member</button>
                    ) : (
                      <button className="btn btn-danger" style={{ padding: "6px 12px", fontSize: 12, opacity: 0.8 }} onClick={() => deleteMember(selectedMember.id)}>
                        {projects.some(p => p.assignments?.some(a => String(a.member_id) === String(selectedMember.id))) ? "🗃️ Send Archived ?" : "🗑 Remove"}
                      </button>
                    )}
                    <button className="btn btn-secondary" style={{ padding: "8px 24px", fontSize: 13 }} onClick={() => setSelectedMember(null)}>✕ Close</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Member Modal */}
      {showManualForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, boxSizing: "border-box" }}>
          <div style={{ background: "var(--bg-secondary)", borderRadius: 16, width: "100%", maxWidth: 640, maxHeight: "90vh", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "0 32px 64px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-primary)", flexShrink: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(61,184,122,0.1)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>➕</div>
                Add New Team Member
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
              <button className="btn btn-primary" onClick={handleManualSubmit}>Add Member</button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Payslip Modal */}
      {selectedPayslip && selectedMember && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div id="payslip-modal-content" style={{ background: "#ffffff", color: "#0f172a", borderRadius: 12, width: "100%", maxWidth: 520, padding: 32, position: "relative", boxShadow: "0 20px 40px rgba(0,0,0,0.5)", border: "1px solid #e2e8f0", zIndex: 9999999 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #d4d4d8", paddingBottom: 16, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -1, textTransform: "uppercase", color: "#09090b" }}>
                  Payslip {selectedPayslip.isRevised ? <span style={{ color: "#dc2626", fontSize: 14, verticalAlign: "middle", marginLeft: 8 }}>(REVISED)</span> : ""}
                </div>
                <div 
                  style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600, marginTop: 4, cursor: "pointer", display: "inline-block" }}
                  onClick={() => {
                    handleOpenProject(selectedPayslip.displayId);
                    setSelectedPayslip(null);
                  }}
                  title="View Project"
                >
                  <span style={{ textDecoration: "underline" }}>ID: PS-{selectedPayslip.projectId}</span> ↗
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#09090b" }}>DIMARZ</div>
                <div style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase" }}>Lead Software</div>
                <div style={{ fontSize: 10, color: "#71717a", marginTop: 4 }}>{selectedPayslip.date}</div>
              </div>
            </div>

            {/* Recipient Details */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#71717a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Paid To</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#09090b" }}>{selectedMember.name}</div>
              <div style={{ fontSize: 12, color: "#3f3f46" }}>{selectedMember.category || "Team Member"}</div>
              <div style={{ fontSize: 12, color: "#3f3f46", marginTop: 2 }}>{selectedMember.email}</div>
            </div>

            {/* Project Details */}
            <div style={{ marginBottom: 24, padding: "16px", background: "#e4e4e7", borderLeft: "4px solid #3b82f6", borderRadius: "0 8px 8px 0" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#71717a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Project Reference</div>
              <div 
                style={{ fontSize: 14, fontWeight: 700, color: "#3b82f6", cursor: "pointer", display: "inline-block", textDecoration: "underline" }}
                onClick={() => {
                  handleOpenProject(selectedPayslip.displayId);
                  setSelectedPayslip(null);
                }}
                title="View Project"
              >
                {selectedPayslip.projectName} ↗
              </div>
            </div>

            {/* Calculation Breakdown */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #d4d4d8", paddingBottom: 8, marginBottom: 8, fontSize: 11, fontWeight: 700, color: "#71717a", textTransform: "uppercase", letterSpacing: 1 }}>
                <span>Description</span>
                <span>Amount</span>
              </div>
              
              {selectedPayslip.isPartial ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600, padding: "4px 0", color: "#18181b" }}>
                    <span>Total Project Cost {selectedPayslip.projectType === "Lead Generation" ? `(${selectedPayslip.leads} Leads @ ৳${selectedPayslip.rate})` : ""}</span>
                    <span>{formatTaka(selectedPayslip.totalCost)}</span>
                  </div>
                  {selectedPayslip.allPayments && selectedPayslip.allPayments.slice(0, selectedPayslip.paymentIndex).map((prevPay: any, idx: number) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 500, padding: "4px 0", color: "#71717a" }}>
                      <span>- Previous Payment (Part {idx + 1} on {prevPay.date})</span>
                      <span>-{formatTaka(prevPay.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, padding: "8px 0", color: "#16a34a", marginTop: 4, background: "rgba(34,197,94,0.1)", borderRadius: 6, paddingLeft: 8, paddingRight: 8 }}>
                    <span>Current Payment (Net Payout)</span>
                    <span>-{formatTaka(selectedPayslip.amount)}</span>
                  </div>
                  {(() => {
                    const prevPaid = selectedPayslip.allPayments?.slice(0, selectedPayslip.paymentIndex).reduce((s: number, p: any) => s + p.amount, 0) || 0;
                    const due = selectedPayslip.totalCost - prevPaid - selectedPayslip.amount;
                    return (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, padding: "8px 0", color: due > 0 ? "#dc2626" : "#71717a", borderTop: "1px dashed #d4d4d8", marginTop: 8 }}>
                        <span>Remaining Balance Due</span>
                        <span>{formatTaka(Math.max(0, due))}</span>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 500, padding: "8px 0", color: "#18181b" }}>
                  <span>{selectedPayslip.projectType === "Lead Generation" ? `${selectedPayslip.leads} Leads @ ৳${selectedPayslip.rate}` : "Assigned Amount"}</span>
                  <span>{formatTaka(selectedPayslip.amount)}</span>
                </div>
              )}
            </div>

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "2px solid #a1a1aa", paddingTop: 16, marginBottom: 32 }}>
              <div style={{ fontSize: 14, fontWeight: 800, textTransform: "uppercase", color: "#09090b" }}>Net Payout</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#16a34a" }}>{formatTaka(selectedPayslip.amount)}</div>
            </div>

            {/* Actions */}
            {(() => {
              let textBreakdown = '';
              let waBreakdown = '';

              if (selectedPayslip.isPartial) {
                const prevPaid = selectedPayslip.allPayments?.slice(0, selectedPayslip.paymentIndex).reduce((s: number, p: any) => s + p.amount, 0) || 0;
                const due = selectedPayslip.totalCost - prevPaid - selectedPayslip.amount;
                
                let prevText = '';
                let waPrevText = '';
                if (selectedPayslip.paymentIndex > 0) {
                  selectedPayslip.allPayments.slice(0, selectedPayslip.paymentIndex).forEach((prevPay: any, idx: number) => {
                    prevText += `\nPrevious (Part ${idx + 1}) : -${formatTaka(prevPay.amount)}`;
                    waPrevText += `\n• Previous (Part ${idx + 1}): -${formatTaka(prevPay.amount)}`;
                  });
                }

                textBreakdown = `Total Cost : ${formatTaka(selectedPayslip.totalCost)}${prevText}\nThis Payment: -${formatTaka(selectedPayslip.amount)}\n----------------------------------\nRemaining Due: ${formatTaka(Math.max(0, due))}`;
                waBreakdown = `• Total Cost: ${formatTaka(selectedPayslip.totalCost)}${waPrevText}\n• This Payment: -${formatTaka(selectedPayslip.amount)}\n\n*Remaining Due:* ${formatTaka(Math.max(0, due))}`;
              } else {
                if (selectedPayslip.projectType === "Lead Generation") {
                  textBreakdown = `Leads      : ${selectedPayslip.leads}\nRate       : ৳${selectedPayslip.rate}`;
                  waBreakdown = `• ${selectedPayslip.leads} Leads @ ৳${selectedPayslip.rate}`;
                } else {
                  textBreakdown = `Assignment Fee: ৳${selectedPayslip.amount}`;
                  waBreakdown = `• Assignment Fee: ৳${selectedPayslip.amount}`;
                }
              }

              const emailSubject = `Payslip: PS-${selectedPayslip.displayId} ${selectedPayslip.isRevised ? '(REVISED)' : ''} - Dimarz`;
              const emailBody = `Hello ${selectedMember.name},

Please find the details of your recent project payout below.

==================================
PAYSLIP SUMMARY ${selectedPayslip.isRevised ? '(REVISED)' : ''}
==================================
Reference  : PS-${selectedPayslip.displayId}
Project    : ${selectedPayslip.projectName}
Date       : ${selectedPayslip.date}

----------------------------------
BREAKDOWN
----------------------------------
${textBreakdown}

==================================
NET PAYOUT : ${formatTaka(selectedPayslip.amount)}
==================================

Please see the attached PDF for your official records.

Best regards,
Dimarz Team`;

              const waMessage = `*PAYSLIP: PS-${selectedPayslip.displayId}* 📄 ${selectedPayslip.isRevised ? '*(REVISED)*' : ''}
_Dimarz Lead Software_

Hello *${selectedMember.name}*, here is your recent payout summary:

*Project:* ${selectedPayslip.projectName}
*Date:* ${selectedPayslip.date}

*Breakdown:*
${waBreakdown}

💰 *NET PAYOUT:* ${formatTaka(selectedPayslip.amount)}

_Please see the attached PDF for official records._`;
              
              const handleEmail = async () => {
                if (!selectedMember.email) {
                  showToast("No email address provided for this member.", "error");
                  return;
                }
                await open(`mailto:${selectedMember.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`);
              };

              const handleWhatsApp = async () => {
                if (!selectedMember.whatsapp && !selectedMember.phone) {
                  showToast("No WhatsApp or Phone number provided for this member.", "error");
                  return;
                }
                const phone = selectedMember.whatsapp || selectedMember.phone;
                const cleanPhone = phone?.replace(/[^0-9]/g, "");
                await open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`);
              };

              const handleSavePDF = async () => {
                try {
                  const element = document.getElementById("payslip-modal-content");
                  if (!element) throw new Error("Payslip UI not found.");
                  
                  showToast("Generating PDF...", "info");
                  
                  const canvas = await html2canvas(element, { 
                    scale: 2, 
                    backgroundColor: "#f8fafc",
                    useCORS: true,
                    allowTaint: false
                  });
                  
                  const imgData = canvas.toDataURL("image/png");
                  
                  let PDFCtor = jsPDF;
                  if (typeof PDFCtor !== 'function' && typeof (PDFCtor as any).jsPDF === 'function') {
                    PDFCtor = (PDFCtor as any).jsPDF;
                  }

                  const pdf = new PDFCtor({
                    orientation: "portrait",
                    unit: "px",
                    format: [canvas.width, canvas.height]
                  });
                  
                  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
                  
                  const safeName = selectedMember.name.replace(/[^a-zA-Z0-9]/g, '_');
                  const defaultPath = `Payslip_PS-${selectedPayslip.projectId}_${safeName}${selectedPayslip.isRevised ? '_REVISED' : ''}.pdf`;
                  
                  try {
                    const pdfBuffer = pdf.output("arraybuffer");
                    const filePath = await save({
                      defaultPath,
                      filters: [{ name: "PDF", extensions: ["pdf"] }]
                    });

                    if (!filePath) {
                      showToast("Save cancelled.", "info");
                      return;
                    }

                    await writeFile(filePath, new Uint8Array(pdfBuffer));
                    showToast("Payslip successfully saved!", "success");
                  } catch (tauriError: any) {
                    console.warn("Tauri native save failed, falling back to browser download", tauriError);
                    pdf.save(defaultPath);
                    showToast("Payslip saved via browser download!", "success");
                  }
                } catch (error: any) {
                  console.error("PDF Save Error:", error);
                  showToast("Failed to save PDF: " + (error.message || "Unknown error"), "error");
                  alert("PDF Error: " + error.message);
                }
              };

              return (
                <div data-html2canvas-ignore="true" style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
                  <button onClick={() => setSelectedPayslip(null)} style={{ padding: "10px 16px", borderRadius: 8, background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", fontWeight: 600, fontSize: 13, cursor: "pointer", flex: 1, minWidth: 100 }}>Close</button>
                  <button onClick={handleSavePDF} style={{ padding: "10px 16px", borderRadius: 8, background: "#0f172a", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", flex: 1, minWidth: 100 }}>Save PDF</button>
                  <button onClick={handleEmail} style={{ padding: "10px 16px", borderRadius: 8, background: "#3b82f6", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", flex: 1, minWidth: 100 }}>Email</button>
                  <button onClick={handleWhatsApp} style={{ padding: "10px 16px", borderRadius: 8, background: "#22c55e", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", flex: 1, minWidth: 100 }}>WhatsApp</button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTeamPage;
