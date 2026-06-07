import React, { useState, useEffect, useContext } from "react";
import { Project } from "./ProjectsPage";
import { AppContext } from "../../App";
interface Props {
className: string;
}
interface Client {
id: number;
name: string;
email: string | null;
website: string | null;
linkedin: string | null;
country: string | null;
source: string;
address: string | null;
status: string;
}
interface ClientStats {
active_projects: number;
completed_projects: number;
total_invoiced: number;
total_paid: number;
total_due: number;
}
const SAMPLE_CLIENTS: Client[] = [];

const SAMPLE_STATS: Map<number, ClientStats> = new Map();

const ClientsPage: React.FC<Props> = ({ className }) => {
const { triggerRefresh } = useContext(AppContext);

const [clients, setClients] = useState<Client[]>(() => {
  const saved = localStorage.getItem("dimrz_clients");
  return saved ? JSON.parse(saved) : SAMPLE_CLIENTS;
});
useEffect(() => {
  localStorage.setItem("dimrz_clients", JSON.stringify(clients));
  triggerRefresh();
}, [clients]);

const [projects, setProjects] = useState<Project[]>(() => {
  const saved = localStorage.getItem("dimrz_projects");
  // Don't have a fallback SAMPLE_PROJECTS here because we don't want to redefine it, 
  // but if projects page was opened, it's saved. If not, it'll be empty or we just use [] fallback.
  // Actually, we can fetch it if not null, otherwise [].
  // But wait, what if they never opened ProjectsPage? Then dimrz_projects is null.
  return saved ? JSON.parse(saved) : [];
});

useEffect(() => {
  // We only read projects to show in the modal. If we delete a project from the modal, we need to save it back.
  if (projects.length > 0) {
    localStorage.setItem("dimrz_projects", JSON.stringify(projects));
  }
}, [projects]);

const [statsMap] = useState<Map<number, ClientStats>>(SAMPLE_STATS);
const [showForm, setShowForm] = useState(false);
const [search, setSearch] = useState("");

const [selected, setSelected] = useState<Set<number>>(new Set());
const [selectAll, setSelectAll] = useState(false);

const [selectedClient, setSelectedClient] = useState<Client | null>(null);
const [editMode, setEditMode] = useState(false);
const [editDraft, setEditDraft] = useState<Client | null>(null);

const emptyClient: Client = { id: Date.now(), name: "", email: "", website: "", linkedin: "", country: "", source: "Direct Contact", address: "", status: "Active" };
const [newClientDraft, setNewClientDraft] = useState<Client>(emptyClient);

const handleOpenCreateForm = () => {
  setNewClientDraft({ ...emptyClient, id: Date.now() });
  setShowForm(true);
};

const handleCreateClient = () => {
  if (!newClientDraft.name.trim()) return;
  setClients([newClientDraft, ...clients]);
  setShowForm(false);
};

const handleEditClick = () => {
  if (selectedClient) {
    setEditDraft({ ...selectedClient });
    setEditMode(true);
  }
};

const handleSaveEdit = () => {
  if (editDraft) {
    setClients(clients.map(c => c.id === editDraft.id ? editDraft : c));
    setSelectedClient(editDraft);
    setEditMode(false);
  }
};

const cancelEdit = () => {
  setEditDraft(null);
  setEditMode(false);
};

const deleteProject = (projectId: number) => {
  const proj = projects.find(p => p.id === projectId);
  if (proj) {
    if (proj.invoiced > 0 || proj.paid > 0 || (proj.assignments && proj.assignments.length > 0)) {
      alert("⚠️ Action Blocked: This project contains financial data or team assignments. Deleting it will break team performance metrics. Please update the status to 'Cancelled' or 'On Hold' instead.");
      return;
    }
  }
  if (confirm("Are you sure you want to permanently delete this project?")) {
    setProjects(projects.filter(p => p.id !== projectId));
  }
};

const deleteClient = (clientId: number) => {
  const hasProjects = projects.some(p => p.client_id === clientId);
  if (hasProjects) {
    alert("⚠️ Action Blocked: This client has historical projects. Deleting them will corrupt financial records. Please edit the client and change their status to 'Inactive' instead.");
    return;
  }
  if (confirm("Are you sure you want to permanently delete this client?")) {
    setClients(clients.filter(c => c.id !== clientId));
    if (selectedClient?.id === clientId) {
      setSelectedClient(null);
    }
  }
};

const filtered = clients.filter(c =>
c.name.toLowerCase().includes(search.toLowerCase()) ||
(c.email?.toLowerCase() || "").includes(search.toLowerCase())
);

let totalReceived = 0;
let totalDue = 0;
filtered.forEach(c => {
  const stats = statsMap.get(c.id);
  if (stats) {
    totalReceived += stats.total_paid;
    totalDue += stats.total_due;
  }
});
const totalClients = filtered.length;

const toggleSelectAll = () => {
  if (selectAll) {
    setSelected(new Set());
  } else {
    setSelected(new Set(filtered.map(c => c.id)));
  }
  setSelectAll(!selectAll);
};

const toggleClient = (id: number) => {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  setSelected(next);
};

const handleDeleteSelected = () => {
  if (selected.size === 0) return;
  const clientsToDelete = clients.filter(c => selected.has(c.id));
  
  const hasProjects = clientsToDelete.some(c => projects.some(p => p.client_id === c.id));
  if (hasProjects) {
    alert("⚠️ Action Blocked: One or more selected clients have historical projects. Please deselect them or change their status to 'Inactive'.");
    return;
  }

  if (confirm(`Are you sure you want to permanently delete ${selected.size} client(s)?`)) {
    setClients(clients.filter(c => !selected.has(c.id)));
    if (selectedClient && selected.has(selectedClient.id)) {
      setSelectedClient(null);
    }
    setSelected(new Set());
    setSelectAll(false);
  }
};

const handleExport = () => {
  if (filtered.length === 0) {
    alert("No data to export");
    return;
  }
  
  const targetClients = selected.size > 0 ? clients.filter(c => selected.has(c.id)) : filtered;
  
  const headers = ["ID", "Name", "Email", "Website", "LinkedIn", "Country", "Source", "Address", "Status"];
  const rows = targetClients.map(c => [
    c.id, c.name, c.email || "", c.website || "", c.linkedin || "", c.country || "", c.source, c.address || "", c.status
  ]);
  
  const csvContent = [
    headers.join(","),
    ...rows.map(e => e.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "dimrz_clients_export.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const formatTaka = (n: number) => `৳${n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const openEditModal = (c: Client) => {
  setSelectedClient(c);
  setEditDraft({ ...c });
  setEditMode(true);
};

return (
<div className={className} id="clientsPage">

  {/* ── Stats Cards ── */}
  <div className="leads-stat-cards">
    <div className="leads-stat-card leads-stat-card--dark">
      <div className="lsc-number">{totalClients.toLocaleString()}</div>
      <div className="lsc-label">TOTAL CLIENTS</div>
    </div>
    <div className="leads-stat-card leads-stat-card--blue">
      <div className="lsc-number">{formatTaka(totalReceived)}</div>
      <div className="lsc-label">TOTAL PAYMENT RECEIVED</div>
    </div>
    <div className="leads-stat-card leads-stat-card--orange">
      <div className="lsc-number">{formatTaka(totalDue)}</div>
      <div className="lsc-label">TOTAL DUE</div>
    </div>
  </div>

  <div className="content-header">
    <div className="header-left">
      <h1 className="page-title">All Clients</h1>
      <span className="total-count">Total: <strong>{totalClients.toLocaleString()}</strong> clients {selected.size > 0 && `| ${selected.size} selected`}</span>
    </div>
    <div className="header-actions">
      <button className="btn btn-secondary" onClick={() => triggerRefresh()} title="Force Refresh Data">
        🔄 Refresh
      </button>
      <button className="btn btn-secondary" onClick={toggleSelectAll}>
        <span>{selected.size > 0 ? "✕" : "☐"}</span> {selected.size > 0 ? "Clear Selection" : "Select All"}
      </button>
      <button className="btn btn-danger" onClick={handleDeleteSelected} disabled={selected.size === 0}>
        <span>🗑</span> Delete
      </button>
      <button className="btn btn-secondary" onClick={handleExport}>
        <span>📤</span> Export CSV
      </button>
      <button className="btn btn-import" onClick={handleOpenCreateForm}>
        <span>➕</span> Register Client
      </button>
    </div>
  </div>

  <div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", borderLeft: "1px solid var(--border-color)", borderRight: "1px solid var(--border-color)" }}>
    <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      <div className="search-box" style={{ position: "relative", width: 320 }}>
        <span className="search-icon" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 14 }}>🔍</span>
        <input type="text" placeholder="Search by name, email, or source..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "8px 12px 8px 36px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
      </div>
    </div>
<div style={{ overflowX: "auto", flex: 1 }}>
<table className="data-table" id="clientsTable" style={{ fontSize: 13 }}>
<thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
<tr>
<th style={{ width: 40 }}><input type="checkbox" className="table-checkbox" checked={selectAll} onChange={toggleSelectAll} /></th>
<th style={{ width: 40 }}>#</th>
<th>Client Identity</th>
<th>Lead Source</th>
<th>Status</th>
<th style={{ textAlign: "center" }}>Active</th>
<th style={{ textAlign: "center" }}>Completed</th>
<th style={{ textAlign: "right" }}>Invoiced</th>
<th style={{ textAlign: "right" }}>Paid</th>
<th style={{ textAlign: "right" }}>Due</th>
<th style={{ width: 120, textAlign: "center" }}>Action</th>
</tr>
</thead>
<tbody>
{filtered.map((c, index) => {
const stats = statsMap.get(c.id);
const initials = c.name.split(" ").map(x => x[0]).join("").substring(0, 2).toUpperCase();
return (
<tr key={c.id}>
<td><input type="checkbox" className="table-checkbox" checked={selected.has(c.id)} onChange={() => toggleClient(c.id)} /></td>
<td><span className="sl-number">{(index + 1).toString().padStart(2, "0")}</span></td>
<td>
<div className="client-identity">
<div className="client-avatar">{initials}</div>
<div className="client-info">
<span className="client-name">{c.name}</span>
<span className="client-email">{c.email || "No email"}</span>
</div>
</div>
</td>
<td><span className="source-badge">{c.source}</span></td>
<td><span className={`status-badge ${c.status === "Active" ? "status-new" : "status-lost"}`}>{c.status}</span></td>
<td style={{ textAlign: "center", fontWeight: 600 }}>{stats?.active_projects || 0}</td>
<td style={{ textAlign: "center", fontWeight: 600 }}>{stats?.completed_projects || 0}</td>
<td className="financial-cell">{formatTaka(stats?.total_invoiced || 0)}</td>
<td className="financial-cell financial-paid">{formatTaka(stats?.total_paid || 0)}</td>
<td className={`financial-cell ${stats && stats.total_due > 0 ? "financial-due" : ""}`}>{formatTaka(stats?.total_due || 0)}</td>
<td style={{ textAlign: "center" }}>
<button className="ops-btn view" title="View" onClick={() => setSelectedClient(c)}>👁</button>
<button className="ops-btn edit" title="Edit" onClick={() => openEditModal(c)}>✎</button>
<button className="ops-btn delete" title="Delete" onClick={() => deleteClient(c.id)}>🗑</button>
</td>
</tr>
);
})}
{filtered.length === 0 && (
<tr>
<td colSpan={11} style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
<div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📂</div>
<div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>No clients found</div>
<div style={{ fontSize: 13 }}>Register your first client to get started.</div>
</td>
</tr>
)}
</tbody>
</table>
</div>
<div className="pagination-bar">
  <div className="pagination-info">Showing <strong>1-{Math.min(filtered.length, 10)}</strong> of <strong>{filtered.length}</strong></div>
</div>
</div>

{/* Create Client Modal */}
{showForm && (
  <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" }}>
    <div style={{ background: "var(--bg-panel)", borderRadius: 16, width: "100%", maxWidth: 560, overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "0 24px 48px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-secondary)" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Create New Client</div>
        <button className="btn btn-icon" onClick={() => setShowForm(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", cursor: "pointer" }}>✕</button>
      </div>
      
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxHeight: "70vh", overflowY: "auto" }}>
        <div className="form-group">
          <label className="form-label required">Client Name</label>
          <input type="text" className="form-input" placeholder="e.g. Acme Corp" value={newClientDraft.name} onChange={e => setNewClientDraft({...newClientDraft, name: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input type="email" className="form-input" placeholder="client@example.com" value={newClientDraft.email || ""} onChange={e => setNewClientDraft({...newClientDraft, email: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Website</label>
          <input type="text" className="form-input" placeholder="www.example.com" value={newClientDraft.website || ""} onChange={e => setNewClientDraft({...newClientDraft, website: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">LinkedIn</label>
          <input type="text" className="form-input" placeholder="linkedin.com/company/acme" value={newClientDraft.linkedin || ""} onChange={e => setNewClientDraft({...newClientDraft, linkedin: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Country</label>
          <input type="text" className="form-input" placeholder="e.g. United States" value={newClientDraft.country || ""} onChange={e => setNewClientDraft({...newClientDraft, country: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Source</label>
          <select className="form-input" value={newClientDraft.source} onChange={e => setNewClientDraft({...newClientDraft, source: e.target.value})}>
            <option>Upwork</option><option>Fiverr</option><option>Direct Contact</option><option>Referral</option><option>LinkedIn</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <input type="text" className="form-input" placeholder="e.g. 123 Tech St, Silicon Valley, CA 94025" value={newClientDraft.address || ""} onChange={e => setNewClientDraft({...newClientDraft, address: e.target.value})} />
        </div>
      </div>
      
      <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", background: "var(--bg-secondary)" }}>
        <button className="btn btn-primary" style={{ minWidth: 160 }} onClick={handleCreateClient}><span>✓</span> Create Client</button>
      </div>
    </div>
  </div>
)}

{/* Client Profile Modal */}
{selectedClient && (
  <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" }} onClick={() => setSelectedClient(null)}>
    <div style={{ background: "var(--bg-panel)", borderRadius: 20, width: "100%", maxWidth: 1024, maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--border-color)", boxShadow: "0 24px 48px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
      
      {/* Header */}
      <div style={{ padding: 32, borderBottom: "1px solid var(--border-color)", display: "flex", gap: 24, alignItems: "flex-start", position: "relative" }}>
        <button onClick={() => setSelectedClient(null)} style={{ position: "absolute", top: 20, right: 20, width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        {editMode ? null : (
          <button onClick={handleEditClick} style={{ position: "absolute", top: 20, right: 60, padding: "6px 12px", borderRadius: 8, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", color: "var(--info)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>✏️ Edit</button>
        )}
        
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700, color: "var(--text-primary)", flexShrink: 0 }}>
          {selectedClient.name.split(" ").map(x => x[0]).join("").substring(0, 2).toUpperCase()}
        </div>
        
        <div style={{ flex: 1 }}>
          {editMode && editDraft ? (
            <input value={editDraft.name} onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} style={{ fontSize: 24, fontWeight: 800, background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "4px 12px", color: "var(--text-primary)", width: "100%", marginBottom: 8 }} />
          ) : (
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 8, color: "var(--text-primary)" }}>{selectedClient.name}</div>
          )}
          
          <div style={{ fontSize: 14, color: "var(--text-secondary)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {editMode && editDraft ? (
              <select value={editDraft.status} onChange={e => setEditDraft({ ...editDraft, status: e.target.value })} style={{ fontSize: 13, background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "4px 8px", color: "var(--text-primary)" }}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            ) : (
              <span className={`status-badge ${selectedClient.status === "Active" ? "status-new" : "status-lost"}`}>{selectedClient.status}</span>
            )}
            
            {editMode && editDraft ? (
              <select value={editDraft.source} onChange={e => setEditDraft({ ...editDraft, source: e.target.value })} style={{ fontSize: 13, background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "4px 8px", color: "var(--text-primary)" }}>
                <option>Upwork</option>
                <option>Fiverr</option>
                <option>Direct Contact</option>
                <option>Referral</option>
                <option>LinkedIn</option>
              </select>
            ) : (
              <span className="source-badge">{selectedClient.source}</span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 32 }}>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Contact Info */}
          <div style={{ background: "var(--bg-secondary)", padding: 20, borderRadius: 12, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 14, minWidth: 0, overflow: "hidden" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>📞 Contact Info</div>
            {([
              ["Email", "email"],
              ["Website", "website"],
              ["LinkedIn", "linkedin"],
              ["Country", "country"],
            ] as [string, keyof Client][]).map(([label, key]) => (
              <div key={key} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
                {editMode && editDraft ? (
                  <input value={(editDraft[key] as string) || ""} onChange={e => setEditDraft({ ...editDraft, [key]: e.target.value })} style={{ width: "100%", fontSize: 13, background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} placeholder={label} />
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", wordBreak: "break-word", overflow: "hidden" }}>
                    {key === "email" && selectedClient.email
                      ? <a href={`mailto:${selectedClient.email}`} style={{ color: "var(--info)", textDecoration: "none" }}>{selectedClient.email}</a>
                      : key === "website" && selectedClient.website
                      ? <a href={selectedClient.website.startsWith("http") ? selectedClient.website : `https://${selectedClient.website}`} target="_blank" rel="noreferrer" style={{ color: "var(--info)", textDecoration: "none" }}>{selectedClient.website}</a>
                      : key === "linkedin" && selectedClient.linkedin
                      ? <a href={selectedClient.linkedin.startsWith("http") ? selectedClient.linkedin : `https://${selectedClient.linkedin}`} target="_blank" rel="noreferrer" style={{ color: "var(--info)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={selectedClient.linkedin}>Visit Profile ↗</a>
                      : (selectedClient[key] as string) || <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Business Details */}
          <div style={{ background: "var(--bg-secondary)", padding: 20, borderRadius: 12, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 14, minWidth: 0, overflow: "hidden" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>💼 Business Details</div>
            {([
              ["Address", "address"],
            ] as [string, keyof Client][]).map(([label, key]) => (
              <div key={key} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>
                {editMode && editDraft ? (
                  <input type="text" value={(editDraft[key] as string) || ""} onChange={e => setEditDraft({ ...editDraft, [key]: e.target.value })} style={{ width: "100%", fontSize: 13, background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} placeholder={label} />
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", wordBreak: "break-word" }}>
                    {(selectedClient[key] as string) || <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </div>
                )}
              </div>
            ))}
            
            {editMode ? (
              <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 16 }}>
                <button className="btn btn-secondary" style={{ padding: "8px", fontSize: 13 }} onClick={cancelEdit}>✕ Cancel</button>
                <button className="btn btn-primary" style={{ padding: "8px", fontSize: 13 }} onClick={handleSaveEdit}>💾 Save</button>
              </div>
            ) : null}
          </div>
        </div>

        {/* Projects List Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {(() => {
             const clientProjects = projects.filter(p => p.client_id === selectedClient.id);
             const totalValue = clientProjects.reduce((s, p) => s + p.value, 0);
             const totalInvoiced = clientProjects.reduce((s, p) => s + p.invoiced, 0);
             const totalPaid = clientProjects.reduce((s, p) => s + p.paid, 0);
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
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.filter(p => p.client_id === selectedClient.id).map(p => {
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
                        <td style={{ textAlign: "center" }}>
                          <button className="ops-btn delete" title="Delete Project" onClick={() => deleteProject(p.id)}>🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                  {projects.filter(p => p.client_id === selectedClient.id).length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>
                        No projects found for this client.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
)}

</div>
);
};
export default ClientsPage;
