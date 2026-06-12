import React, { useState, useEffect, useContext } from "react";
import { AppContext } from "../../App";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { formatDate } from "../../utils";
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
  paid?: number;
  payments?: {
    id: number;
    date: string;
    amount: number;
  }[];
  is_revised?: boolean;
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
const SAMPLE_PROJECTS: Project[] = [];

const SAMPLE_CLIENT_MAP: Map<number, string> = new Map();

const ProjectsPage: React.FC<Props> = ({ className }) => {
const { agency, showToast, showPage, refreshTrigger } = useContext(AppContext);
const shortName = agency.name.split(' - ')[0] || agency.name;

const [projects, setProjects] = useState<Project[]>(() => {
  const saved = localStorage.getItem("dimrz_projects");
  return saved ? JSON.parse(saved) : SAMPLE_PROJECTS;
});

useEffect(() => {
  localStorage.setItem("dimrz_projects", JSON.stringify(projects));
  
  const handleOpenProject = (e: any) => {
    const projectId = e.detail?.projectId;
    if (projectId) {
      const proj = projects.find(p => String(p.id) === String(projectId));
      if (proj) {
        setSelectedProject(proj);
      }
    }
  };
  const handleOpenInvoice = (e: any) => {
    const projectId = e.detail?.projectId;
    if (projectId) {
      const proj = projects.find(p => String(p.id) === String(projectId));
      if (proj) {
        showPage("projects");
        setPreviewInvoice(proj);
      }
    }
  };
  window.addEventListener("open-project-view", handleOpenProject);
  window.addEventListener("open-invoice-modal", handleOpenInvoice);
  return () => {
    window.removeEventListener("open-project-view", handleOpenProject);
    window.removeEventListener("open-invoice-modal", handleOpenInvoice);
  };
}, [projects]);

const [clients, setClients] = useState<Map<number, string>>(new Map());
const [teamMembers, setTeamMembers] = useState<{id: string; name: string}[]>([]);

useEffect(() => {
  const savedClients = localStorage.getItem("dimrz_clients");
  if (savedClients) {
    const parsed = JSON.parse(savedClients);
    const map = new Map<number, string>();
    parsed.forEach((c: any) => map.set(c.id, c.name));
    setClients(map);
  } else {
    setClients(SAMPLE_CLIENT_MAP);
  }

  const savedTeam = localStorage.getItem("dimrz_my_team");
  if (savedTeam) {
    const parsed = JSON.parse(savedTeam);
    setTeamMembers(parsed.map((m: any) => ({ id: String(m.id), name: m.name })));
  } else {
    setTeamMembers([]);
  }
}, [refreshTrigger]);

const [search, setSearch] = useState("");
const [selectedProject, setSelectedProject] = useState<Project | null>(null);
const [showForm, setShowForm] = useState(false);
const [editDraft, setEditDraft] = useState<Project | null>(null);
const [assignments, setAssignments] = useState<Assignment[]>([]);

const [showFinancialModal, setShowFinancialModal] = useState(false);
const [previewInvoice, setPreviewInvoice] = useState<Project | null>(null);
const [finMode, setFinMode] = useState<"invoice" | "payment">("invoice");
const [invoiceAmount, setInvoiceAmount] = useState<number | "">("");
const [paymentAmount, setPaymentAmount] = useState<number | "">("");
const [paymentMethod, setPaymentMethod] = useState("Bank Transfer");

const [payMemberAssignment, setPayMemberAssignment] = useState<Assignment | null>(null);
const [teamPaymentAmount, setTeamPaymentAmount] = useState<number | "">("");

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
    
    const newValue = field === "leads" || field === "rate" ? Number(value) : value;
    const isEditingFinancials = field === "leads" || field === "rate";
    const becameRevised = isEditingFinancials && (a.paid || 0) > 0 && a[field] !== newValue;

    return { 
      ...a, 
      [field]: newValue,
      is_revised: a.is_revised || becameRevised 
    };
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

const openFinancialModal = (mode: "invoice" | "payment") => {
  if (!selectedProject) return;
  setFinMode(mode);
  if (mode === "invoice") {
    const uninvoiced = selectedProject.value - selectedProject.invoiced;
    setInvoiceAmount(uninvoiced > 0 ? uninvoiced : 0);
    setPaymentAmount("");
  } else {
    setInvoiceAmount(0);
    const due = selectedProject.invoiced - selectedProject.paid;
    setPaymentAmount(due > 0 ? due : 0);
  }
  setPaymentMethod("Bank Transfer");
  setShowFinancialModal(true);
};

const handleConfirmFinancial = () => {
  if (!selectedProject) return;
  const invAmt = Number(invoiceAmount) || 0;
  const payAmt = Number(paymentAmount) || 0;
  
  if (finMode === "invoice" && invAmt <= 0 && payAmt <= 0) {
    if (showToast) showToast("Please enter a valid amount.", "error");
    return;
  }
  if (finMode === "payment" && payAmt <= 0) {
    if (showToast) showToast("Please enter a payment amount.", "error");
    return;
  }

  const updated = { 
    ...selectedProject, 
    invoiced: finMode === "invoice" ? selectedProject.invoiced + invAmt : selectedProject.invoiced,
    paid: selectedProject.paid + payAmt 
  };

  setProjects(projects.map(p => p.id === updated.id ? updated : p));
  setSelectedProject(updated);
  setShowFinancialModal(false);
  if (showToast) {
    if (finMode === "invoice") {
      showToast(`Invoice generated ${payAmt > 0 ? 'and payment recorded' : ''} successfully.`, "success");
    } else {
      showToast("Payment recorded successfully.", "success");
    }
  }
};


const handleConfirmTeamPayment = () => {
  if (!selectedProject || !payMemberAssignment) return;
  const amt = Number(teamPaymentAmount);
  if (!amt || amt <= 0) {
    if (showToast) showToast("Please enter a valid payment amount.", "error");
    return;
  }

  const updatedProjects = projects.map(p => {
    if (p.id !== selectedProject.id) return p;
    const updatedAssignments = p.assignments?.map(a => {
      if (a.id !== payMemberAssignment.id) return a;
      
      const newPayment = {
        id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        amount: amt
      };
      
      return {
        ...a,
        paid: (a.paid || 0) + amt,
        payments: [...(a.payments || []), newPayment]
      };
    });
    return { ...p, assignments: updatedAssignments };
  });

  setProjects(updatedProjects);
  const updatedSelected = updatedProjects.find(p => p.id === selectedProject.id) || null;
  setSelectedProject(updatedSelected);
  setPayMemberAssignment(null);
  setTeamPaymentAmount("");
  if (showToast) showToast("Team payment recorded and Payslip ledger updated!", "success");
};

const handleDelete = (id: number) => {
  const proj = projects.find(p => p.id === id);
  if (proj) {
    if (proj.invoiced > 0 || proj.paid > 0 || (proj.assignments && proj.assignments.length > 0)) {
      alert("⚠️ Action Blocked: This project contains financial data or team assignments. Deleting it will break team performance metrics. Please update the status to 'Cancelled' or 'On Hold' instead.");
      return;
    }
  }
  if (confirm("Are you sure you want to permanently delete this project?")) {
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
<div className={className} id="projectsPage" style={{ padding: 0, overflow: "hidden", flexDirection: "column" }}>
<div style={{ padding: "8px 24px 0", flexShrink: 0 }}>
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
</div>
<div style={{ padding: "0 24px 24px", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
<div className="card" style={{ padding: 0, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
<div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
<div style={{ fontSize: 14, fontWeight: 600 }}>Active Projects</div>
<div className="search-box" style={{ position: "relative", width: 260 }}>
<span className="search-icon" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 14 }}>🔍</span>
<input type="text" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", padding: "6px 10px 6px 32px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 6, color: "var(--text-primary)", fontSize: 12, outline: "none" }} />
</div>
</div>
<div style={{ flex: 1, overflow: "auto" }}>
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
    <div style={{ background: "var(--bg-panel)", borderRadius: 20, width: "100%", maxWidth: 1024, maxHeight: "90vh", overflowY: "auto", border: "1px solid var(--border-color)", boxShadow: "0 24px 48px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
      
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
        
        {/* Top Information Row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Strategic Info */}
          <div style={{ background: "var(--bg-secondary)", padding: 20, borderRadius: 12, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>📅 Strategic Details</div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Deadline</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{selectedProject.deadline || "Not Set"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Target Leads</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{selectedProject.target_leads?.toLocaleString() || "Not Set"}</div>
              </div>
            </div>

            {selectedProject.description && (
              <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid var(--border-color)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Description</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{selectedProject.description}</div>
              </div>
            )}
            
            {(selectedProject.working_sheet || selectedProject.shared_sheet) && (
              <div style={{ display: "flex", gap: 12, marginTop: "auto", paddingTop: 16 }}>
                {selectedProject.working_sheet && (
                  <a href={selectedProject.working_sheet} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "8px", fontSize: 12, textDecoration: "none" }}>
                    <span>📊</span> Working Sheet
                  </a>
                )}
                {selectedProject.shared_sheet && (
                  <a href={selectedProject.shared_sheet} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "8px", fontSize: 12, textDecoration: "none" }}>
                    <span>🔗</span> Client Sheet
                  </a>
                )}
              </div>
            )}
          </div>
          
          {/* Client Financials Hub */}
          <div style={{ background: "var(--bg-secondary)", padding: 20, borderRadius: 12, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Header */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>💼 Client Financials Hub</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>Contract value breakdown</span>
            </div>

            {/* 4-metric grid */}
            {(() => {
              const uninvoiced = selectedProject.value - selectedProject.invoiced;
              const balanceDue = selectedProject.invoiced - selectedProject.paid;
              const collectionPct = selectedProject.value > 0 ? Math.min((selectedProject.paid / selectedProject.value) * 100, 100) : 0;
              const invoicedPct = selectedProject.value > 0 ? Math.min((selectedProject.invoiced / selectedProject.value) * 100, 100) : 0;
              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {/* Contract Value */}
                    <div style={{ padding: "12px 14px", background: "var(--bg-panel)", borderRadius: 8, border: "1px solid var(--border-color)" }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4, letterSpacing: 0.5 }}>📋 Contract Value</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}>{formatTaka(selectedProject.value)}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Total agreed amount</div>
                    </div>
                    {/* Total Invoiced */}
                    <div style={{ padding: "12px 14px", background: "var(--bg-panel)", borderRadius: 8, border: "1px solid rgba(74,144,212,0.25)" }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4, letterSpacing: 0.5 }}>🧾 Total Invoiced</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "var(--info)" }}>{formatTaka(selectedProject.invoiced)}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{invoicedPct.toFixed(0)}% of contract billed</div>
                    </div>
                    {/* Total Collected */}
                    <div style={{ padding: "12px 14px", background: "var(--bg-panel)", borderRadius: 8, border: "1px solid rgba(61,184,122,0.25)" }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4, letterSpacing: 0.5 }}>✅ Total Collected</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "var(--success)" }}>{formatTaka(selectedProject.paid)}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{collectionPct.toFixed(0)}% of contract received</div>
                    </div>
                    {/* Uninvoiced Remaining */}
                    <div style={{ padding: "12px 14px", background: "var(--bg-panel)", borderRadius: 8, border: uninvoiced > 0 ? "1px solid rgba(212,146,74,0.3)" : "1px solid rgba(61,184,122,0.2)" }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4, letterSpacing: 0.5 }}>🕐 Uninvoiced Left</div>
                      <div style={{ fontSize: 17, fontWeight: 800, color: uninvoiced > 0 ? "var(--warning)" : "var(--success)" }}>{formatTaka(Math.max(uninvoiced, 0))}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{uninvoiced > 0 ? "Yet to be billed" : "Fully invoiced ✓"}</div>
                    </div>
                  </div>

                  {/* Collection Rate Progress */}
                  <div style={{ padding: "10px 14px", background: "var(--bg-panel)", borderRadius: 8, border: "1px solid var(--border-color)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Collection Progress</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>{formatTaka(selectedProject.paid)} / {formatTaka(selectedProject.value)}</span>
                    </div>
                    <div style={{ height: 6, background: "var(--bg-input)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                      {/* Invoiced band */}
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${invoicedPct}%`, background: "rgba(74,144,212,0.35)", borderRadius: 4, transition: "width 0.6s" }} title={`Invoiced: ${invoicedPct.toFixed(0)}%`} />
                      {/* Paid band (on top) */}
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${collectionPct}%`, background: "rgba(61,184,122,0.7)", borderRadius: 4, transition: "width 0.6s" }} title={`Collected: ${collectionPct.toFixed(0)}%`} />
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "rgba(74,144,212,0.5)", display: "inline-block" }} /> Invoiced {invoicedPct.toFixed(0)}%</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "rgba(61,184,122,0.7)", display: "inline-block" }} /> Collected {collectionPct.toFixed(0)}%</span>
                    </div>
                  </div>

                  {/* Balance Due alert */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: balanceDue > 0 ? "rgba(192,68,94,0.07)" : "rgba(61,184,122,0.07)", borderRadius: 8, border: balanceDue > 0 ? "1px solid rgba(192,68,94,0.25)" : "1px solid rgba(61,184,122,0.2)" }}>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>Balance Due (Invoiced − Paid)</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>Amount client owes from issued invoices</div>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 800, color: balanceDue > 0 ? "var(--danger)" : "var(--success)" }}>{formatTaka(balanceDue)}</span>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button onClick={() => openFinancialModal("invoice")} style={{ padding: "9px 0", fontSize: 12, fontWeight: 600, background: "var(--info)", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", transition: "0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>🧾 Issue Invoice</button>
                    <button onClick={() => openFinancialModal("payment")} disabled={selectedProject.invoiced === 0} style={{ padding: "9px 0", fontSize: 12, fontWeight: 600, background: selectedProject.invoiced === 0 ? "rgba(61,184,122,0.3)" : "var(--success)", color: "#fff", border: "none", borderRadius: 8, cursor: selectedProject.invoiced === 0 ? "not-allowed" : "pointer", transition: "0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} title={selectedProject.invoiced === 0 ? "Issue an invoice first" : ""}>💵 Record Payment</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Team Deployment & Payroll Station */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, borderBottom: "1px solid var(--border-color)", paddingBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Team Deployment & Payroll Station</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
              Total Deployment Cost: <strong style={{ color: "var(--text-primary)" }}>{formatTaka(selectedProject.assignments?.reduce((sum, a) => sum + (a.leads * a.rate), 0) || 0)}</strong>
            </span>
          </div>
          
          <div className="card" style={{ padding: 0, overflow: "hidden", border: "1px solid var(--border-color)" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ fontSize: 12, width: "100%", margin: 0 }}>
                <thead style={{ background: "var(--bg-secondary)" }}>
                  <tr>
                    <th>Assigned Member</th>
                    <th style={{ textAlign: "right" }}>Target Leads</th>
                    <th style={{ textAlign: "right" }}>Rate / Lead</th>
                    <th style={{ textAlign: "right" }}>Total Cost</th>
                    <th style={{ textAlign: "right" }}>Paid</th>
                    <th style={{ textAlign: "right" }}>Due</th>
                    <th style={{ textAlign: "center", width: 140 }}>Payroll Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProject.assignments && selectedProject.assignments.length > 0 ? selectedProject.assignments.map(a => {
                    const cost = a.leads * a.rate;
                    const paid = a.paid || 0;
                    const due = cost - paid;
                    return (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600 }}>
                          <span 
                            onClick={() => {
                              showPage("myTeam");
                              setTimeout(() => {
                                window.dispatchEvent(new CustomEvent("open-member-profile", { detail: { memberId: a.member_id } }));
                              }, 100);
                            }}
                            style={{ color: "var(--info)", cursor: "pointer", textDecoration: "underline" }}
                            title="View Member Profile"
                          >
                            {a.member_name}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>{a.leads.toLocaleString()}</td>
                        <td style={{ textAlign: "right" }}>{formatTaka(a.rate)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--text-primary)" }}>{formatTaka(cost)}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: "var(--success)" }}>{formatTaka(paid)}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: due > 0 ? "var(--danger)" : "var(--text-muted)" }}>{formatTaka(due)}</td>
                        <td style={{ textAlign: "center" }}>
                          <button onClick={() => { setPayMemberAssignment(a); setTeamPaymentAmount(due > 0 ? due : 0); }} disabled={due <= 0} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, background: due <= 0 ? "rgba(34,197,94,0.4)" : "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, color: due <= 0 ? "#fff" : "var(--success)", cursor: due <= 0 ? "not-allowed" : "pointer", transition: "0.2s", width: "100%" }} title={due <= 0 ? "Fully Paid" : "Pay Member"}>
                            {due <= 0 ? "✅ Fully Paid" : "💸 Pay Member"}
                          </button>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                        <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>👥</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>No team members assigned</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>Click Edit to assign staff to this project.</div>
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
              <input type="date" className="form-input" value={editDraft.deadline || ""} onChange={e => { setEditDraft({ ...editDraft, deadline: e.target.value }); e.target.blur(); }} />
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
          {assignments.length > 0 && (() => {
            const isLeadGen = editDraft.project_type === "Lead Generation";
            return (
              <div style={{ display: "grid", gridTemplateColumns: isLeadGen ? "2fr 1.2fr 0.8fr 0.8fr 1fr 32px" : "2fr 1.2fr 1.5fr 32px", gap: 8, marginBottom: 8, padding: "0 4px" }}>
                {(isLeadGen ? ["TEAM MEMBER", "DEADLINE", "LEADS", "RATE (৳)", "COST (৳)", ""] : ["TEAM MEMBER", "DEADLINE", "AMOUNT (৳)", ""]).map(h => (<div key={h} style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)" }}>{h}</div>))}
              </div>
            );
          })()}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {assignments.map(a => {
              const isLeadGen = editDraft.project_type === "Lead Generation";
              const cost = isLeadGen ? (a.leads || 0) * (a.rate || 0) : (a.rate || 0);

              const handleAmountChange = (val: string) => {
                 setAssignments(assignments.map(assign => assign.id === a.id ? { ...assign, rate: val === "" ? ("" as any) : Number(val), leads: 1 } : assign));
              };

              return (
                <div key={a.id} style={{ display: "grid", gridTemplateColumns: isLeadGen ? "2fr 1.2fr 0.8fr 0.8fr 1fr 32px" : "2fr 1.2fr 1.5fr 32px", gap: 8, alignItems: "center", background: "var(--bg-primary)", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border-color)" }}>
                  <select value={a.member_id} onChange={e => handleAssignmentChange(a.id, "member_id", e.target.value)} style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: 6, padding: "6px 8px", fontSize: 13, outline: "none" }}>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <input type="date" value={a.deadline} onChange={e => { handleAssignmentChange(a.id, "deadline", e.target.value); e.target.blur(); }} style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: 6, padding: "6px 8px", fontSize: 12, outline: "none", width: "100%" }} />
                  {isLeadGen && <input type="number" value={a.leads || ""} placeholder="0" onChange={e => handleAssignmentChange(a.id, "leads", e.target.value)} style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: 6, padding: "6px 8px", fontSize: 13, outline: "none", width: "100%" }} />}
                  {isLeadGen ? (
                    <input type="number" value={a.rate || ""} placeholder="0" onChange={e => handleAssignmentChange(a.id, "rate", e.target.value)} style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: 6, padding: "6px 8px", fontSize: 13, outline: "none", width: "100%" }} />
                  ) : (
                    <input type="number" value={a.rate || ""} placeholder="0" onChange={e => handleAmountChange(e.target.value)} style={{ background: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)", borderRadius: 6, padding: "6px 8px", fontSize: 13, outline: "none", width: "100%" }} />
                  )}
                  {isLeadGen && <div style={{ fontSize: 13, fontWeight: 700, color: "var(--info)", textAlign: "right" }}>{formatTaka(cost)}</div>}
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
            const isLeadGen = editDraft.project_type === "Lead Generation";
            const totalLeads = assignments.reduce((s, a) => s + (a.leads || 0), 0);
            const totalCost = assignments.reduce((s, a) => s + (isLeadGen ? (a.leads || 0) * (a.rate || 0) : (a.rate || 0)), 0);
            return (
              <div style={{ marginTop: 16, padding: "14px 18px", background: "var(--bg-primary)", borderRadius: 10, border: "1px solid var(--border-color)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Assignment Summary</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Total Assigned: <span style={{ color: "var(--info)" }}>{assignments.length}</span></div>
                </div>
                <div style={{ display: "flex", gap: 32, textAlign: "right" }}>
                  {isLeadGen && (
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Total Leads</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--success)" }}>{totalLeads.toLocaleString()}</div>
                    </div>
                  )}
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

{/* Financial Modal Overlay */}
{showFinancialModal && selectedProject && (
  <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, boxSizing: "border-box" }}>
    <div style={{ background: "var(--bg-secondary)", borderRadius: 16, width: "100%", maxWidth: 600, overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "0 32px 64px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column" }}>
      
      {/* Header */}
      <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-primary)" }}>
        <div style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: finMode === "invoice" ? "rgba(59,130,246,0.1)" : "rgba(34,197,94,0.1)", color: finMode === "invoice" ? "var(--info)" : "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
            {finMode === "invoice" ? "🧾" : "💵"}
          </div>
          {finMode === "invoice" ? "Issue Invoice & Payment" : "Record Payment"}
        </div>
        <button onClick={() => setShowFinancialModal(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✕</button>
      </div>

      <div style={{ padding: 24 }}>
        {/* Dynamic Client Context */}
        <div style={{ background: "var(--bg-panel)", padding: 16, borderRadius: 10, border: "1px solid var(--border-color)", marginBottom: 24, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Bill To</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{clients.get(selectedProject.client_id || 0) || "Unknown Company"}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Project: {selectedProject.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {finMode === "invoice" && (
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>Invoice Amount (৳)</label>
              <input type="number" value={invoiceAmount} onChange={e => setInvoiceAmount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0.00" style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 16, outline: "none", fontWeight: 600 }} autoFocus />
            </div>
          )}

          <div>
            <label style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
              <span>{finMode === "invoice" ? "Immediate Payment (Optional ৳)" : "Payment Amount (৳)"}</span>
              {finMode === "payment" && <span style={{ color: "var(--danger)" }}>Due: {formatTaka(selectedProject.invoiced - selectedProject.paid)}</span>}
            </label>
            <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0.00" style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 16, outline: "none", fontWeight: 600 }} />
            
            {/* Quick Selectors */}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => setPaymentAmount(finMode === "invoice" ? (Number(invoiceAmount) || 0) : (selectedProject.invoiced - selectedProject.paid))} style={{ flex: 1, padding: "6px", fontSize: 11, fontWeight: 600, background: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: 6, color: "var(--text-secondary)", cursor: "pointer", transition: "0.2s" }}>Full Amount</button>
              <button onClick={() => setPaymentAmount((finMode === "invoice" ? (Number(invoiceAmount) || 0) : (selectedProject.invoiced - selectedProject.paid)) / 2)} style={{ flex: 1, padding: "6px", fontSize: 11, fontWeight: 600, background: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: 6, color: "var(--text-secondary)", cursor: "pointer", transition: "0.2s" }}>50% Partial</button>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>Payment Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none" }}>
              <option>Bank Transfer</option>
              <option>PayPal</option>
              <option>Payoneer</option>
              <option>Wise</option>
              <option>Crypto (USDT/BTC)</option>
              <option>Cash</option>
            </select>
          </div>
        </div>
      </div>

      {/* Footer Calculation */}
      <div style={{ padding: "20px 24px", background: "var(--bg-primary)", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>New Balance Due</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--danger)" }}>
            {formatTaka(
              (selectedProject.invoiced + (finMode === "invoice" ? (Number(invoiceAmount) || 0) : 0)) -
              (selectedProject.paid + (Number(paymentAmount) || 0))
            )}
          </div>
        </div>
        <button onClick={handleConfirmFinancial} className="btn btn-primary" style={{ padding: "10px 24px", fontSize: 14, fontWeight: 600 }}>
          {finMode === "invoice" ? "✓ Generate Invoice" : "✓ Record Payment"}
        </button>
      </div>

    </div>
  </div>
)}

{/* Team Payroll Modal */}
{payMemberAssignment && selectedProject && (() => {
  const cost = payMemberAssignment.leads * payMemberAssignment.rate;
  const paid = payMemberAssignment.paid || 0;
  const due = cost - paid;
  
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, boxSizing: "border-box" }}>
      <div style={{ background: "var(--bg-secondary)", borderRadius: 16, width: "100%", maxWidth: 600, overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "0 32px 64px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column" }}>
        
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-primary)" }}>
          <div style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(34,197,94,0.1)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
              💸
            </div>
            Team Payroll Station
          </div>
          <button onClick={() => setPayMemberAssignment(null)} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Context */}
          <div style={{ background: "var(--bg-panel)", padding: 16, borderRadius: 10, border: "1px solid var(--border-color)", marginBottom: 24, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>Paying Member</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{payMemberAssignment.member_name}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Project: {selectedProject.name}</div>
            
            <div style={{ display: "flex", gap: 24, marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border-color)" }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>Total Cost</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{formatTaka(cost)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>Already Paid</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--success)" }}>{formatTaka(paid)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 2 }}>Current Due</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--danger)" }}>{formatTaka(due)}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
                <span>Payment Amount (৳)</span>
              </label>
              <input type="number" value={teamPaymentAmount} onChange={e => setTeamPaymentAmount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0.00" style={{ width: "100%", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 16, outline: "none", fontWeight: 600 }} autoFocus />
              
              {/* Quick Selectors */}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => setTeamPaymentAmount(due)} style={{ flex: 1, padding: "6px", fontSize: 11, fontWeight: 600, background: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: 6, color: "var(--text-secondary)", cursor: "pointer", transition: "0.2s" }}>Full Amount</button>
                <button onClick={() => setTeamPaymentAmount(due / 2)} style={{ flex: 1, padding: "6px", fontSize: 11, fontWeight: 600, background: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: 6, color: "var(--text-secondary)", cursor: "pointer", transition: "0.2s" }}>50% Partial</button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Calculation */}
        <div style={{ padding: "20px 24px", background: "var(--bg-primary)", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Remaining Due</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--danger)" }}>
              {formatTaka(Math.max(0, due - (Number(teamPaymentAmount) || 0)))}
            </div>
          </div>
          <button onClick={handleConfirmTeamPayment} className="btn btn-primary" style={{ padding: "10px 24px", fontSize: 14, fontWeight: 600 }}>
            ✓ Record Payment & Generate Slip
          </button>
        </div>

      </div>
    </div>
  );
})()}

{/* Professional Invoice Preview Modal */}
{previewInvoice && (() => {
  const due = previewInvoice.invoiced - previewInvoice.paid;
  const clientName = clients.get(previewInvoice.client_id || 0) || "Unknown Client";
  
  const textBreakdown = `Project Name: ${previewInvoice.name}\nTotal Value: ${formatTaka(previewInvoice.value)}\n----------------------------------\nTotal Invoiced: ${formatTaka(previewInvoice.invoiced)}\nTotal Paid: -${formatTaka(previewInvoice.paid)}\n----------------------------------\nRemaining Balance Due: ${formatTaka(Math.max(0, due))}`;
  const waBreakdown = `*Project:* ${previewInvoice.name}\n*Total Value:* ${formatTaka(previewInvoice.value)}\n\n• *Total Invoiced:* ${formatTaka(previewInvoice.invoiced)}\n• *Total Paid:* -${formatTaka(previewInvoice.paid)}\n\n💰 *Remaining Due:* ${formatTaka(Math.max(0, due))}`;
  
  const emailSubject = `Invoice Statement: PRJ-${previewInvoice.id} - Dimarz`;
  const emailBody = `Hello ${clientName},\n\nPlease find the details of your project invoice statement below.\n\n==================================\nINVOICE STATEMENT\n==================================\nReference  : PRJ-${previewInvoice.id}\nDate       : ${formatDate(new Date())}\n\n----------------------------------\nBREAKDOWN\n----------------------------------\n${textBreakdown}\n\nPlease see the attached PDF for your official records.\n\nBest regards,\nDimarz Team`;
  const waMessage = `*INVOICE STATEMENT: PRJ-${previewInvoice.id}* 🧾\n_Dimarz Lead Software_\n\nHello *${clientName}*, here is your project billing summary:\n\n${waBreakdown}\n\n_Please let us know if you have any questions!_`;

  const handleSavePDF = async () => {
    try {
      const element = document.getElementById("invoice-modal-content");
      if (!element) throw new Error("Invoice UI not found.");
      showToast("Generating PDF...", "info");
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: "#f8fafc", useCORS: true, allowTaint: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width / 2, canvas.height / 2] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`Invoice_PRJ-${previewInvoice.id}.pdf`);
      showToast("PDF saved successfully!", "success");
    } catch (err: any) {
      showToast("Failed to generate PDF: " + err.message, "error");
    }
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div id="invoice-modal-content" style={{ background: "#ffffff", color: "#0f172a", borderRadius: 12, width: "100%", maxWidth: 520, padding: 32, position: "relative", boxShadow: "0 20px 40px rgba(0,0,0,0.5)", border: "1px solid #e2e8f0", zIndex: 9999999 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #cbd5e1", paddingBottom: 16, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, textTransform: "uppercase", color: "#0f172a" }}>INVOICE</div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginTop: 4 }}>ID: PRJ-{previewInvoice.id}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>DIMARZ</div>
            <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>Lead Software</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>Date: {formatDate(new Date())}</div>
          </div>
        </div>

        {/* Client Details */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Bill To</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{clientName}</div>
          <div style={{ fontSize: 13, color: "#334155", marginTop: 4, fontWeight: 600 }}>Project: {previewInvoice.name}</div>
        </div>

        {/* Calculation Breakdown */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #cbd5e1", paddingBottom: 8, marginBottom: 12, fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
            <span>Description</span>
            <span>Amount</span>
          </div>
          
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 600, padding: "6px 0", color: "#0f172a" }}>
            <span>Total Project Value</span>
            <span>{formatTaka(previewInvoice.value)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 500, padding: "6px 0", color: "#334155" }}>
            <span>Total Amount Invoiced</span>
            <span>{formatTaka(previewInvoice.invoiced)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 500, padding: "6px 0", color: "#334155" }}>
            <span>Total Amount Paid</span>
            <span>-{formatTaka(previewInvoice.paid)}</span>
          </div>
        </div>

        {/* Total */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "2px solid #94a3b8", paddingTop: 16, marginBottom: 32 }}>
          <div style={{ fontSize: 15, fontWeight: 800, textTransform: "uppercase", color: "#0f172a" }}>Balance Due</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: due > 0 ? "#dc2626" : "#16a34a" }}>{formatTaka(Math.max(0, due))}</div>
        </div>

        {/* Actions (Hidden in PDF) */}
        <div data-html2canvas-ignore="true" style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
          <button onClick={() => setPreviewInvoice(null)} style={{ padding: "10px 16px", borderRadius: 8, background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", fontWeight: 600, fontSize: 13, cursor: "pointer", flex: 1, minWidth: 100 }}>Close</button>
          <button onClick={handleSavePDF} style={{ padding: "10px 16px", borderRadius: 8, background: "#0f172a", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", flex: 1, minWidth: 100 }}>Save PDF</button>
          <button onClick={() => window.open(`mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`)} style={{ padding: "10px 16px", borderRadius: 8, background: "#3b82f6", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", flex: 1, minWidth: 100 }}>Email</button>
          <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(waMessage)}`)} style={{ padding: "10px 16px", borderRadius: 8, background: "#22c55e", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", flex: 1, minWidth: 100 }}>WhatsApp</button>
        </div>
      </div>
    </div>
  );
})()}

</div>
);
};
export default ProjectsPage;
