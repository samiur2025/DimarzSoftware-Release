import React, { useState, useEffect } from "react";
import { Project } from "./ProjectsPage";
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
const SAMPLE_CLIENTS: Client[] = [
  { id: 1, name: "TechVision Inc", email: "contact@techvision.io", website: "techvision.io", linkedin: "linkedin.com/company/techvision", country: "USA", source: "Upwork", address: "123 Tech St, Silicon Valley, CA 94025", status: "Active" },
  { id: 2, name: "FinEdge Partners", email: "hello@finedge.co", website: "finedge.co", linkedin: null, country: "UK", source: "Direct Contact", address: "45 Financial District, London, EC2N 1AR", status: "Active" },
  { id: 3, name: "MediFlow Health", email: "bd@mediflow.com", website: "mediflow.com", linkedin: null, country: "Canada", source: "LinkedIn", address: "789 Health Pkwy, Toronto, ON M5V 2H1", status: "Active" },
  { id: 4, name: "GrowthLab Marketing", email: "team@growthlab.io", website: "growthlab.io", linkedin: null, country: "Australia", source: "Referral", address: "101 Marketing Ave, Sydney, NSW 2000", status: "Active" },
  { id: 5, name: "EduSphere Online", email: "ops@edusphere.edu", website: "edusphere.edu", linkedin: null, country: "Singapore", source: "Fiverr", address: "50 Education Hub, Singapore 018983", status: "Inactive" },
];

const SAMPLE_STATS: Map<number, ClientStats> = new Map([
  [1, { active_projects: 3, completed_projects: 7, total_invoiced: 1200000, total_paid: 1050000, total_due: 150000 }],
  [2, { active_projects: 2, completed_projects: 4, total_invoiced: 890000, total_paid: 890000, total_due: 0 }],
  [3, { active_projects: 1, completed_projects: 5, total_invoiced: 640000, total_paid: 520000, total_due: 120000 }],
  [4, { active_projects: 4, completed_projects: 2, total_invoiced: 430000, total_paid: 380000, total_due: 50000 }],
  [5, { active_projects: 0, completed_projects: 3, total_invoiced: 280000, total_paid: 280000, total_due: 0 }],
]);

const ClientsPage: React.FC<Props> = ({ className }) => {

const [clients, setClients] = useState<Client[]>(() => {
  const saved = localStorage.getItem("dimrz_clients");
  return saved ? JSON.parse(saved) : SAMPLE_CLIENTS;
});
useEffect(() => {
  localStorage.setItem("dimrz_clients", JSON.stringify(clients));
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
  if (confirm("Are you sure you want to delete this project?")) {
    setProjects(projects.filter(p => p.id !== projectId));
  }
};

const filtered = clients.filter(c =>
c.name.toLowerCase().includes(search.toLowerCase()) ||
(c.email?.toLowerCase() || "").includes(search.toLowerCase())
);
const formatTaka = (n: number) => `৳${n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
return (
<div className={className} id="clientsPage">
<div style={{ width: "100%", padding: "0 24px", boxSizing: "border-box" }}>
<div className="content-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
<div className="header-left">
<div>
<div className="page-title" style={{ fontSize: 22, fontStyle: "italic", fontWeight: 800, letterSpacing: "-0.5px" }}>CLIENT PORTFOLIO</div>
<div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Manage client accounts and their lead sources.</div>
</div>
</div>
<div className="header-actions">
<button className="btn btn-primary" onClick={handleOpenCreateForm}><span>➕</span> Register Client</button>
</div>
</div>
<div className="card" style={{ padding: 0, overflow: "hidden" }}>
<div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
<div className="search-box" style={{ position: "relative", width: 320 }}>
<span className="search-icon" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 14 }}>🔍</span>
<input type="text" placeholder="Search by name, email, or source..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "8px 12px 8px 36px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", fontSize: 13, outline: "none" }} />
</div>
<div style={{ display: "flex", gap: 8 }}>
<button className="btn btn-secondary" onClick={() => setSearch("")} style={{ fontSize: 12, padding: "6px 12px" }}><span>↺</span> Reset</button>
<button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }}><span>📥</span> Download</button>
</div>
</div>
<div style={{ overflowX: "auto" }}>
<table className="data-table" id="clientsTable" style={{ fontSize: 13 }}>
<thead>
<tr>
<th style={{ width: 30 }}><input type="checkbox" className="table-checkbox" /></th>
<th>Client Identity</th>
<th>Lead Source</th>
<th>Status</th>
<th style={{ textAlign: "center" }}>Active</th>
<th style={{ textAlign: "center" }}>Completed</th>
<th style={{ textAlign: "right" }}>Invoiced</th>
<th style={{ textAlign: "right" }}>Paid</th>
<th style={{ textAlign: "right" }}>Due</th>
<th style={{ width: 120, textAlign: "center" }}>Operations</th>
</tr>
</thead>
<tbody>
{filtered.map(c => {
const stats = statsMap.get(c.id);
const initials = c.name.split(" ").map(x => x[0]).join("").substring(0, 2).toUpperCase();
return (
<tr key={c.id}>
<td><input type="checkbox" className="table-checkbox" /></td>
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
<button className="ops-btn edit" title="Edit">✎</button>
<button className="ops-btn delete" title="Delete">🗑</button>
</td>
</tr>
);
})}
{filtered.length === 0 && (
<tr>
<td colSpan={10} style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
<div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📂</div>
<div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>No clients found</div>
<div style={{ fontSize: 13 }}>Register your first client to get started.</div>
</td>
</tr>
)}
</tbody>
</table>
</div>
<div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
<div style={{ fontSize: 12, color: "var(--text-muted)" }}>Showing <strong>1-{Math.min(filtered.length, 10)}</strong> of <strong>{filtered.length}</strong> clients</div>
<div style={{ display: "flex", gap: 4 }}></div>
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

</div>

{/* Client Profile Modal */}
{selectedClient && (
  <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" }} onClick={() => setSelectedClient(null)}>
    <div style={{ background: "var(--bg-panel)", borderRadius: 20, width: "100%", maxWidth: 960, maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--border-color)", boxShadow: "0 24px 48px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
      
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
