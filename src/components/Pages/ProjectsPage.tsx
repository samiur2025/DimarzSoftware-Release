import React, { useState, useEffect, useContext } from "react";
import { AppContext } from "../../App";
interface Props {
className: string;
}
export interface Assignment {
  id: number;
  member_id: string;
  member_name: string;
  deadline: string;
  leads: number;
  rate: number;
}
export interface Project {
id: number;
name: string;
description: string | null;
client_id: number | null;
project_type: string;
value: number;
invoiced: number;
paid: number;
status: string;
deadline: string | null;
progress: number;
working_sheet?: string;
shared_sheet?: string;
target_leads?: number;
assignments?: Assignment[];
}
const SAMPLE_PROJECTS: Project[] = [
  { id: 1, name: "Lead Generation - USA Tech Startups (Batch 1)", description: "Generate 50K leads for US tech startups", client_id: 1, project_type: "Lead Generation", value: 300000, invoiced: 250000, paid: 250000, status: "completed", deadline: "2026-03-31", progress: 100 },
  { id: 2, name: "Email Outreach Campaign - UK Finance Q1", description: "Cold email campaign targeting UK finance sector", client_id: 2, project_type: "Email Marketing", value: 180000, invoiced: 180000, paid: 180000, status: "completed", deadline: "2026-02-28", progress: 100 },
  { id: 3, name: "Healthcare Database Build - Canada 2026", description: "Targeted healthcare professional database", client_id: 3, project_type: "Lead Generation", value: 250000, invoiced: 120000, paid: 120000, status: "active", deadline: "2026-07-30", progress: 48 },
  { id: 4, name: "SaaS Startup Prospecting - APAC Region", description: "Find and qualify SaaS leads in APAC", client_id: 1, project_type: "Lead Generation", value: 400000, invoiced: 200000, paid: 150000, status: "active", deadline: "2026-08-15", progress: 35 },
  { id: 5, name: "Digital Marketing Leads - Australia", description: null, client_id: 4, project_type: "Data Research", value: 150000, invoiced: 75000, paid: 50000, status: "pending", deadline: "2026-09-01", progress: 20 },
];

const SAMPLE_CLIENT_MAP: Map<number, string> = new Map([
  [1, "TechVision Inc"],
  [2, "FinEdge Partners"],
  [3, "MediFlow Health"],
  [4, "GrowthLab Marketing"],
  [5, "EduSphere Online"],
]);

const ProjectsPage: React.FC<Props> = ({ className }) => {
const { agency } = useContext(AppContext);
const shortName = agency.name.split(' - ')[0] || agency.name;

const [projects, setProjects] = useState<Project[]>(() => {
  const saved = localStorage.getItem("dimrz_projects");
  return saved ? JSON.parse(saved) : SAMPLE_PROJECTS;
});

useEffect(() => {
  localStorage.setItem("dimrz_projects", JSON.stringify(projects));
}, [projects]);

const [clients] = useState<Map<number, string>>(() => {
  const saved = localStorage.getItem("dimrz_clients");
  if (saved) {
    const parsed = JSON.parse(saved);
    const map = new Map<number, string>();
    parsed.forEach((c: any) => map.set(c.id, c.name));
    return map;
  }
  return SAMPLE_CLIENT_MAP;
});

const [teamMembers] = useState<{id: string; name: string}[]>(() => {
  const saved = localStorage.getItem("dimrz_my_team");
  if (saved) {
    const parsed = JSON.parse(saved);
    return parsed.map((m: any) => ({ id: String(m.id), name: m.name }));
  }
  return [{id: "1", name: "Admin"}, {id: "2", name: "Team Member"}];
});

const [search, setSearch] = useState("");
const [selectedProject, setSelectedProject] = useState<Project | null>(null);
const [showForm, setShowForm] = useState(false);
const [editDraft, setEditDraft] = useState<Project | null>(null);
const [assignments, setAssignments] = useState<Assignment[]>([]);

const emptyProject: Project = { id: Date.now(), name: "", description: "", client_id: null, project_type: "Lead Generation", value: 0, invoiced: 0, paid: 0, status: "pending", deadline: "", progress: 0, working_sheet: "", shared_sheet: "", target_leads: 0, assignments: [] };

const handleNewProject = () => {
  setEditDraft({ ...emptyProject, id: Date.now() });
  setAssignments([]);
  setShowForm(true);
};

const handleEditProject = (p: Project) => {
  setEditDraft({ ...p });
  setAssignments(p.assignments || []);
  setShowForm(true);
};

const handleAddAssignment = () => {
  const first = teamMembers[0];
  setAssignments([...assignments, { id: Date.now(), member_id: first?.id || "", member_name: first?.name || "", deadline: "", leads: 0, rate: 0 }]);
};

const handleRemoveAssignment = (id: number) => {
  setAssignments(assignments.filter(a => a.id !== id));
};

const handleAssignmentChange = (id: number, field: keyof Assignment, value: any) => {
  setAssignments(assignments.map(a => {
    if (a.id !== id) return a;
    if (field === "member_id") {
      const member = teamMembers.find(m => m.id === value);
      return { ...a, member_id: value, member_name: member?.name || value };
    }
    return { ...a, [field]: field === "leads" || field === "rate" ? Number(value) : value };
  }));
};

const handleSaveForm = () => {
  if (!editDraft) return;
  const finalProject = { ...editDraft, assignments };
  const exists = projects.find(p => p.id === editDraft.id);
  if (exists) {
    setProjects(projects.map(p => p.id === finalProject.id ? finalProject : p));
    if (selectedProject?.id === finalProject.id) setSelectedProject(finalProject);
  } else {
    setProjects([finalProject, ...projects]);
  }
  setShowForm(false);
  setEditDraft(null);
};

const handleIssueInvoice = () => {
  if (!selectedProject) return;
  const amount = parseFloat(prompt("Enter amount to invoice:") || "0");
  if (!isNaN(amount) && amount > 0) {
    const updated = { ...selectedProject, invoiced: selectedProject.invoiced + amount };
    setProjects(projects.map(p => p.id === updated.id ? updated : p));
    setSelectedProject(updated);
  }
};

const handleRecordPayment = () => {
  if (!selectedProject) return;
  const amount = parseFloat(prompt("Enter payment received:") || "0");
  if (!isNaN(amount) && amount > 0) {
    const updated = { ...selectedProject, paid: selectedProject.paid + amount };
    setProjects(projects.map(p => p.id === updated.id ? updated : p));
    setSelectedProject(updated);
  }
};

const handleDelete = (id: number) => {
  if (confirm("Are you sure you want to delete this project?")) {
    setProjects(projects.filter(p => p.id !== id));
    if (selectedProject?.id === id) setSelectedProject(null);
  }
};
const filtered = projects.filter(p =>
p.name.toLowerCase().includes(search.toLowerCase()) ||
(clients.get(p.client_id || 0) || "").toLowerCase().includes(search.toLowerCase())
);
const stats = {
active: projects.filter(p => p.status === "active").length,
completed: projects.filter(p => p.status === "completed").length,
pending: projects.filter(p => p.status === "pending").length,
onhold: projects.filter(p => p.status === "onhold").length,
totalValue: projects.reduce((s, p) => s + p.value, 0),
totalInvoiced: projects.reduce((s, p) => s + p.invoiced, 0),
totalPaid: projects.reduce((s, p) => s + p.paid, 0),
totalDue: projects.reduce((s, p) => s + p.invoiced, 0) - projects.reduce((s, p) => s + p.paid, 0),
};
const formatTaka = (n: number) => `৳${n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
return (
<div className={className} id="projectsPage">
<div style={{ width: "100%", padding: "8px 24px 0", boxSizing: "border-box" }}>
<div className="content-header" style={{ paddingLeft: 0, paddingRight: 0 }}>
<div className="header-left">
<div>
<div className="page-title" style={{ fontSize: 22, fontStyle: "italic", fontWeight: 800, letterSpacing: "-0.5px" }}>ACTIVE PROJECTS</div>
<div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{shortName} Tactical Operations Dashboard</div>
</div>
</div>
<div className="header-actions">
<button className="btn btn-primary" onClick={handleNewProject}><span>➕</span> New Project</button>
</div>
</div>
{/* Project Form Modal will go at bottom of file */}
<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
{[
{ label: "Active", value: stats.active, icon: "▶️", color: "var(--info)", bg: "rgba(59,130,246,0.1)" },
{ label: "Completed", value: stats.completed, icon: "✅", color: "var(--success)", bg: "rgba(34,197,94,0.1)" },
{ label: "Pending", value: stats.pending, icon: "⏳", color: "var(--warning)", bg: "rgba(245,158,11,0.1)" },
{ label: "On Hold", value: stats.onhold, icon: "⏸️", color: "var(--text-muted)", bg: "rgba(102,102,102,0.1)" },
].map(s => (
<div className="card" key={s.label} style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
<div style={{ width: 28, height: 28, borderRadius: 8, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{s.icon}</div>
<div>
<div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>{s.label}</div>
<div style={{ fontSize: 20, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
</div>
</div>
))}
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
{[
{ label: "Total Value", value: formatTaka(stats.totalValue), color: "var(--accent-red)", border: "rgba(230,57,70,0.3)", bg: "var(--bg-secondary) 0%, rgba(230,57,70,0.05) 100%" },
{ label: "Invoiced", value: formatTaka(stats.totalInvoiced), color: "var(--info)", border: "rgba(59,130,246,0.3)", bg: "var(--bg-secondary) 0%, rgba(59,130,246,0.05) 100%" },
{ label: "Paid", value: formatTaka(stats.totalPaid), color: "var(--success)", border: "rgba(34,197,94,0.3)", bg: "var(--bg-secondary) 0%, rgba(34,197,94,0.05) 100%" },
{ label: "Due", value: formatTaka(stats.totalDue), color: "var(--danger)", border: "rgba(239,68,68,0.3)", bg: "var(--bg-secondary) 0%, rgba(239,68,68,0.05) 100%" },
].map(s => (
<div className="card" key={s.label} style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, background: `linear-gradient(135deg, ${s.bg})`, borderColor: s.border }}>
<div style={{ width: 28, height: 28, borderRadius: 8, background: s.color.replace(")", ",0.15)").replace("rgb", "rgba"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, color: s.color }}>💰</div>
<div style={{ minWidth: 0 }}>
<div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>{s.label}</div>
<div style={{ fontSize: 18, fontWeight: 700, color: s.color, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.value}</div>
</div>
</div>
))}
</div>
<div className="card" style={{ padding: 0, overflow: "hidden" }}>
<div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
<div style={{ fontSize: 14, fontWeight: 600 }}>Active Projects</div>
<div className="search-box" style={{ position: "relative", width: 260 }}>
<span className="search-icon" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 14 }}>🔍</span>
<input type="text" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "6px 10px 6px 32px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 6, color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
</div>
</div>
<div style={{ overflowX: "auto" }}>
<table className="data-table" id="projectsTable" style={{ fontSize: 13 }}>
<thead>
<tr>
<th style={{ width: 30 }}><input type="checkbox" className="table-checkbox" /></th>
<th>Project Name</th>
<th>Client</th>
<th>Type</th>
<th style={{ textAlign: "right" }}>Value</th>
<th style={{ textAlign: "right" }}>Invoiced</th>
<th style={{ textAlign: "right" }}>Paid</th>
<th style={{ textAlign: "right" }}>Due</th>
<th>Status</th>
<th>Deadline</th>
<th style={{ width: 100, textAlign: "center" }}>Action</th>
</tr>
</thead>
<tbody>
{filtered.map(p => {
const due = p.invoiced - p.paid;
const statusMap: Record<string, string> = { active: "status-contacted", pending: "status-qualified", completed: "status-new", onhold: "status-lost", cancelled: "status-lost" };
return (
<tr key={p.id}>
<td><input type="checkbox" className="table-checkbox" /></td>
<td style={{ maxWidth: 280, whiteSpace: "normal", fontWeight: 500 }}>{p.name}</td>
<td>{clients.get(p.client_id || 0) || "Orphaned"}</td>
<td><span className="type-badge">{p.project_type}</span></td>
<td className="financial-cell">{formatTaka(p.value)}</td>
<td className="financial-cell">{formatTaka(p.invoiced)}</td>
<td className="financial-cell financial-paid">{formatTaka(p.paid)}</td>
<td className={`financial-cell ${due > 0 ? "financial-due" : ""}`}>{formatTaka(due)}</td>
<td><span className={`status-badge ${statusMap[p.status] || "status-lost"}`}>{p.status}</span></td>
<td>{p.deadline || "—"}</td>
<td style={{ textAlign: "center" }}>
<button className="ops-btn view" title="View" onClick={() => setSelectedProject(p)}>👁</button>
<button className="ops-btn edit" title="Edit" onClick={() => handleEditProject(p)}>✎</button>
<button className="ops-btn delete" title="Delete" onClick={() => handleDelete(p.id)}>🗑</button>
</td>
</tr>
);
})}
{filtered.length === 0 && (
<tr>
<td colSpan={11} style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
<div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📁</div>
<div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>No projects found</div>
<div style={{ fontSize: 13 }}>Create your first tactical operation.</div>
</td>
</tr>
)}
</tbody>
</table>
</div>
<div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
<div style={{ fontSize: 12, color: "var(--text-muted)" }}>Showing <strong>1-{Math.min(filtered.length, 10)}</strong> of <strong>{filtered.length}</strong> projects</div>
<div style={{ display: "flex", gap: 4 }}></div>
</div>
</div>
</div>

{/* Project View Modal */}
{selectedProject && !showForm && (
  <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box" }} onClick={() => setSelectedProject(null)}>
    <div style={{ background: "var(--bg-panel)", borderRadius: 20, width: "100%", maxWidth: 800, maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--border-color)", boxShadow: "0 24px 48px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
      
      <div style={{ padding: 32, borderBottom: "1px solid var(--border-color)", display: "flex", gap: 24, alignItems: "flex-start", position: "relative", background: "var(--bg-secondary)" }}>
        <button onClick={() => setSelectedProject(null)} style={{ position: "absolute", top: 20, right: 20, width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        <button onClick={() => handleEditProject(selectedProject)} style={{ position: "absolute", top: 20, right: 60, padding: "6px 12px", borderRadius: 8, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", color: "var(--info)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>✏️ Edit</button>
        
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Project #{selectedProject.id}</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 12, color: "var(--text-primary)" }}>{selectedProject.name}</div>
          
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span className={`status-badge ${selectedProject.status === 'active' ? 'status-contacted' : selectedProject.status === 'pending' ? 'status-qualified' : selectedProject.status === 'completed' ? 'status-new' : 'status-lost'}`} style={{ textTransform: "capitalize" }}>{selectedProject.status}</span>
            <span className="type-badge">{selectedProject.project_type}</span>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
              <span>🏢</span> {clients.get(selectedProject.client_id || 0) || "Orphaned"}
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 32 }}>
        {(selectedProject.description || selectedProject.working_sheet || selectedProject.shared_sheet) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {selectedProject.description && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Description</div>
                <div style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.5 }}>{selectedProject.description}</div>
              </div>
            )}
            
            {(selectedProject.working_sheet || selectedProject.shared_sheet) && (
              <div style={{ display: "flex", gap: 16 }}>
                {selectedProject.working_sheet && (
                  <a href={selectedProject.working_sheet} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", fontSize: 13, textDecoration: "none" }}>
                    <span>📊</span> Working Sheet
                  </a>
                )}
                {selectedProject.shared_sheet && (
                  <a href={selectedProject.shared_sheet} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", fontSize: 13, textDecoration: "none" }}>
                    <span>🔗</span> Shared with Client
                  </a>
                )}
              </div>
            )}
          </div>
        )}
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Strategic Info */}
          <div style={{ background: "var(--bg-secondary)", padding: 20, borderRadius: 12, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>📅 Timeline & Progress</div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Deadline</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{selectedProject.deadline || "—"}</div>
            </div>
          </div>
          
          {/* Financials & Operations */}
          <div style={{ background: "var(--bg-secondary)", padding: 20, borderRadius: 12, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>💰 Financials</span>
              <span style={{ color: "var(--text-primary)", fontSize: 14 }}>Total: {formatTaka(selectedProject.value)}</span>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ padding: 12, background: "var(--bg-panel)", borderRadius: 8, border: "1px solid rgba(59,130,246,0.2)" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Invoiced</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--info)" }}>{formatTaka(selectedProject.invoiced)}</div>
                <button onClick={handleIssueInvoice} style={{ marginTop: 8, width: "100%", padding: "4px 0", fontSize: 11, background: "var(--info)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>Issue Invoice</button>
              </div>
              
              <div style={{ padding: 12, background: "var(--bg-panel)", borderRadius: 8, border: "1px solid rgba(34,197,94,0.2)" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Paid</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--success)" }}>{formatTaka(selectedProject.paid)}</div>
                <button onClick={handleRecordPayment} style={{ marginTop: 8, width: "100%", padding: "4px 0", fontSize: 11, background: "var(--success)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>Record Payment</button>
              </div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(239,68,68,0.05)", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
              <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>Balance Due</span>
              <span style={{ fontSize: 14, color: "var(--danger)", fontWeight: 700 }}>{formatTaka(selectedProject.invoiced - selectedProject.paid)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)}

{/* Project Form Modal */}
{showForm && editDraft && (
  <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, boxSizing: "border-box" }}>
    <div style={{ background: "var(--bg-secondary)", borderRadius: 16, width: "100%", maxWidth: 760, maxHeight: "92vh", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "0 32px 64px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-primary)", flexShrink: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-red-dim)", color: "var(--accent-red)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🎯</div>
          {projects.find(p => p.id === editDraft.id) ? "Edit Project" : "Create New Project"}
        </div>
        <button onClick={() => setShowForm(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✕</button>
      </div>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 24px 24px" }}>
        <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: 24, paddingTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--accent-red)", display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--accent-red-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🎯</span> Project Details
          </div>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: "1/-1" }}>
              <label className="form-label required">Project Name</label>
              <input type="text" className="form-input" placeholder="e.g. Lead Generation Job Instructions (Batch 2 onwards) USA" value={editDraft.name} onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label required">Client</label>
              <select className="form-input" value={editDraft.client_id || ""} onChange={e => setEditDraft({ ...editDraft, client_id: Number(e.target.value) })}>
                <option value="">Select Client...</option>
                {Array.from(clients.entries()).map(([id, name]) => (<option key={id} value={id}>{name}</option>))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Project Type</label>
              <select className="form-input" value={editDraft.project_type} onChange={e => setEditDraft({ ...editDraft, project_type: e.target.value })}>
                <option>Lead Generation</option><option>Email Marketing</option><option>Data Research</option><option>Web Development</option><option>Design</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: 24, paddingTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--info)", display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(74,144,212,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>📋</span> Links & Deadlines
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Working Sheet (URL)</label>
              <input type="url" className="form-input" placeholder="https://docs.google.com/spreadsheets/d/..." value={editDraft.working_sheet || ""} onChange={e => setEditDraft({ ...editDraft, working_sheet: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Shared with Client (URL)</label>
              <input type="url" className="form-input" placeholder="https://docs.google.com/spreadsheets/d/..." value={editDraft.shared_sheet || ""} onChange={e => setEditDraft({ ...editDraft, shared_sheet: e.target.value })} />
            </div>
            <div className="form-group" style={{ gridColumn: "1/-1" }}>
              <label className="form-label">Deadline</label>
              <input type="date" className="form-input" value={editDraft.deadline || ""} onChange={e => setEditDraft({ ...editDraft, deadline: e.target.value })} />
            </div>
          </div>
        </div>
        <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: 24, paddingTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--success)", display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(61,184,122,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>📊</span> Financial Details
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label required">Project Value (৳)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 13 }}>৳</span>
                <input type="number" className="form-input" style={{ paddingLeft: 28 }} value={editDraft.value || ""} onChange={e => setEditDraft({ ...editDraft, value: Number(e.target.value) })} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Target Leads</label>
              <input type="number" className="form-input" placeholder="e.g. 50000" value={editDraft.target_leads || ""} onChange={e => setEditDraft({ ...editDraft, target_leads: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={editDraft.status} onChange={e => setEditDraft({ ...editDraft, status: e.target.value })}>
                <option value="pending">Pending</option><option value="active">Active</option><option value="onhold">On Hold</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="form-group" style={{ display: "flex", alignItems: "flex-end" }}>
              <div style={{ width: "100%", padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5, background: editDraft.status === "completed" ? "rgba(61,184,122,0.1)" : editDraft.status === "active" ? "rgba(74,144,212,0.1)" : "rgba(90,90,114,0.1)", color: editDraft.status === "completed" ? "var(--success)" : editDraft.status === "active" ? "var(--info)" : "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                {editDraft.status === "completed" ? "✅ Completed" : editDraft.status === "active" ? "▶ Active" : editDraft.status === "onhold" ? "⏸ On Hold" : editDraft.status === "cancelled" ? "✕ Cancelled" : "⏳ Pending"}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label className="form-label">Progress</label>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--info)" }}>{editDraft.progress || 0}%</span>
            </div>
            <input type="range" min="0" max="100" value={editDraft.progress || 0} onChange={e => setEditDraft({ ...editDraft, progress: Number(e.target.value) })} style={{ width: "100%", accentColor: "var(--info)" }} />
          </div>
        </div>
        <div style={{ paddingTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--warning)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(212,146,74,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>👥</span> Team Assignment
            </div>
            <button onClick={handleAddAssignment} style={{ padding: "6px 14px", background: "var(--info)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>＋ Assign Team Member</button>
          </div>
          {assignments.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 1fr 32px", gap: 8, marginBottom: 8, padding: "0 4px" }}>
              {["TEAM MEMBER", "DEADLINE", "LEADS", "RATE (৳)", "COST (৳)", ""].map(h => (<div key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)" }}>{h}</div>))}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {assignments.map(a => {
              const cost = a.leads * a.rate;
              return (
                <div key={a.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 1fr 32px", gap: 8, alignItems: "center", background: "var(--bg-primary)", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-color)" }}>
                  <select value={a.member_id} onChange={e => handleAssignmentChange(a.id, "member_id", e.target.value)} style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: 6, padding: "6px 8px", fontSize: 13, outline: "none" }}>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <input type="date" value={a.deadline} onChange={e => handleAssignmentChange(a.id, "deadline", e.target.value)} style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: 6, padding: "6px 8px", fontSize: 12, outline: "none", width: "100%" }} />
                  <input type="number" value={a.leads || ""} placeholder="0" onChange={e => handleAssignmentChange(a.id, "leads", e.target.value)} style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: 6, padding: "6px 8px", fontSize: 13, outline: "none", width: "100%" }} />
                  <input type="number" value={a.rate || ""} placeholder="0" onChange={e => handleAssignmentChange(a.id, "rate", e.target.value)} style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: 6, padding: "6px 8px", fontSize: 13, outline: "none", width: "100%" }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--info)", textAlign: "right" }}>{formatTaka(cost)}</div>
                  <button onClick={() => handleRemoveAssignment(a.id)} style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(192,68,94,0.1)", border: "1px solid rgba(192,68,94,0.3)", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✕</button>
                </div>
              );
            })}
          </div>
          {assignments.length === 0 && (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: 13, background: "var(--bg-primary)", borderRadius: 10, border: "1px dashed var(--border-color)" }}>
              No team members assigned — click "Assign Team Member" to add someone.
            </div>
          )}
          {assignments.length > 0 && (() => {
            const totalLeads = assignments.reduce((s, a) => s + a.leads, 0);
            const totalCost = assignments.reduce((s, a) => s + (a.leads * a.rate), 0);
            return (
              <div style={{ marginTop: 16, padding: "14px 18px", background: "var(--bg-primary)", borderRadius: 10, border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Assignment Summary</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Total Assigned: <span style={{ color: "var(--info)" }}>{assignments.length}</span></div>
                </div>
                <div style={{ display: "flex", gap: 32, textAlign: "right" }}>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Leads</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--success)" }}>{totalLeads.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Deployment Cost</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--info)" }}>{formatTaka(totalCost)}</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-color)", display: "flex", gap: 12, justifyContent: "flex-end", background: "var(--bg-primary)", flexShrink: 0 }}>
        <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
        <button className="btn btn-primary" style={{ minWidth: 200 }} onClick={handleSaveForm}><span>💾</span> Save Project</button>
      </div>
    </div>
  </div>
)}

</div>
);
};
export default ProjectsPage;
