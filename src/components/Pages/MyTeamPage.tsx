import React, { useState, useEffect, useContext } from "react";
import { AppContext } from "../../App";

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
  const { showToast } = useContext(AppContext);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<TeamMember | null>(null);

  // Manual Member State
  const [showManualForm, setShowManualForm] = useState(false);
  const [draftMember, setDraftMember] = useState<Partial<TeamMember>>({});

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
    if (!confirm("Remove this member from your team?")) return;
    persistMembers(members.filter(m => m.id !== id));
    showToast("Member removed from My Team.", "info");
    setSelectedMember(null);
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

  const loadFromStorage = () => {
    try {
      const stored = localStorage.getItem(MY_TEAM_STORAGE_KEY);
      if (stored) setMembers(JSON.parse(stored));
    } catch { /* ignore */ }
  };

  const persistMembers = (updated: TeamMember[]) => {
    localStorage.setItem(MY_TEAM_STORAGE_KEY, JSON.stringify(updated));
    setMembers(updated);
  };

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    return !q ||
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q);
  });

  return (
    <div className={className} id="myTeamPage">
      <div style={{ width: "100%", padding: "0 24px", boxSizing: "border-box" }}>

        {/* Header */}
        <div className="content-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <div className="header-left">
            <div>
              <div className="page-title" style={{ fontSize: 22, fontStyle: "italic", fontWeight: 800, letterSpacing: "-0.5px" }}>MY TEAM</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Manage your hired and active team members.
              </div>
            </div>
          </div>
          <div className="header-actions" style={{ display: "flex", gap: 12 }}>
            <div style={{ padding: "8px 16px", background: "var(--bg-hover)", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", border: "1px solid var(--border-color)", display: "flex", alignItems: "center" }}>
              👥 {members.length} Members
            </div>
            <button className="btn btn-primary" onClick={() => { setDraftMember({}); setShowManualForm(true); }} style={{ background: "linear-gradient(135deg, #3db87a, #2a8758)", borderColor: "rgba(61,184,122,0.3)" }}>
              <span>➕</span> Add Team Member
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div className="search-box" style={{ position: "relative", flex: 1, maxWidth: 500 }}>
            <span className="search-icon" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 14 }}>🔍</span>
            <input
              type="text"
              placeholder="Search team members by name, email, or role..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 12px 10px 36px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: 14, outline: "none" }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
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
                {filtered.map((m, idx) => (
                  <tr key={m.id}>
                    <td>{idx + 1}</td>
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
                    <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.submitted_date || "—"}</td>
                    <td style={{ textAlign: "center" }}>
                      <button className="ops-btn view" title="View Profile" onClick={() => openModal(m)}>👁</button>
                      <button className="ops-btn delete" title="Remove" onClick={() => deleteMember(m.id)}>✕</button>
                    </td>
                  </tr>
                ))}
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
          <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Showing <strong>{filtered.length}</strong> members
            </div>
          </div>
        </div>

      </div>

      {/* Detail Modal */}
      {selectedMember && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)" }}
          onClick={() => { setSelectedMember(null); setEditMode(false); setEditDraft(null); }}
        >
          <div
            style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.8)" }}
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
                <div style={{ width: 72, height: 72, borderRadius: 36, background: "rgba(34,197,94,0.1)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, flexShrink: 0 }}>
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
                  <>
                    <button className="btn btn-danger" style={{ padding: "10px", fontSize: 13 }} onClick={() => deleteMember(selectedMember.id)}>🗑 Remove from Team</button>
                    <button className="btn btn-secondary" style={{ padding: "10px", fontSize: 13 }} onClick={() => setSelectedMember(null)}>✕ Close</button>
                  </>
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
    </div>
  );
};

export default MyTeamPage;
