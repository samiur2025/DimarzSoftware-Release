import React, { useState, useEffect, useContext, useMemo } from "react";
import { AppContext } from "../../App";

interface Props {
  className: string;
}

const InvoicesPage: React.FC<Props> = ({ className }) => {
  const { refreshTrigger } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState<"invoices" | "receipts">("invoices");

  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<Map<number, string>>(new Map());
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    try {
      const projData = localStorage.getItem("dimrz_projects");
      if (projData && projData !== "null") setProjects(JSON.parse(projData) || []);

      const clientData = localStorage.getItem("dimrz_clients");
      if (clientData && clientData !== "null") {
        const parsedClients = JSON.parse(clientData) || [];
        const m = new Map<number, string>();
        if (Array.isArray(parsedClients)) {
          parsedClients.forEach((c: any) => m.set(c.id, c.name));
        }
        setClients(m);
      }

      const teamData = localStorage.getItem("dimrz_my_team");
      if (teamData && teamData !== "null") setTeamMembers(JSON.parse(teamData) || []);
    } catch (e) {
      console.error(e);
    }
  }, [refreshTrigger, className]);

  const formatTaka = (amount: number) => "৳" + (Number(amount) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const invoicedProjects = useMemo(() => (projects || []).filter(p => p && p.invoiced > 0), [projects]);

  const allReceipts = useMemo(() => {
    const receipts: any[] = [];
    (projects || []).forEach(p => {
      if (p && p.assignments && Array.isArray(p.assignments)) {
        p.assignments.forEach((a: any) => {
          const member = (teamMembers || []).find(m => String(m.id) === String(a.member_id));
          const memberName = member ? member.name : "Unknown Member";
          
          if (a.payments && a.payments.length > 0) {
            a.payments.forEach((pay: any, idx: number) => {
              receipts.push({
                receiptId: `PS-${p.id}-${pay.id}`,
                projectId: p.id,
                projectName: p.name + (a.payments.length > 1 ? ` (Part ${idx + 1})` : ""),
                memberName: memberName,
                date: pay.date,
                amount: pay.amount,
                slip: {
                  projectId: `${p.id}-${pay.id}`,
                  displayId: `${p.id}`,
                  projectName: p.name + (a.payments.length > 1 ? ` (Part ${idx + 1})` : ""),
                  projectType: p.project_type,
                  date: pay.date,
                  leads: a.leads,
                  rate: a.rate,
                  amount: pay.amount,
                  isPartial: true,
                  totalCost: p.project_type === "Lead Generation" ? (a.leads || 0) * (a.rate || 0) : (a.rate || 0),
                  paymentIndex: idx,
                  allPayments: a.payments,
                  isRevised: a.is_revised || false,
                  member: member
                }
              });
            });
          } else {
            const cost = p.project_type === "Lead Generation" ? (a.leads || 0) * (a.rate || 0) : (a.rate || 0);
            receipts.push({
              receiptId: `PS-${p.id}`,
              projectId: p.id,
              projectName: p.name,
              memberName: memberName,
              date: p.deadline || "N/A",
              amount: cost,
              slip: {
                projectId: `${p.id}`,
                displayId: `${p.id}`,
                projectName: p.name,
                projectType: p.project_type,
                date: p.deadline || new Date(p.id).toLocaleDateString() || "N/A",
                leads: a.leads,
                rate: a.rate,
                amount: cost,
                isPartial: false,
                totalCost: cost,
                isRevised: a.is_revised || false,
                member: member
              }
            });
          }
        });
      }
    });
    return receipts.sort((a, b) => b.projectId - a.projectId);
  }, [projects, teamMembers]);

  const handleOpenInvoice = (projectId: number) => {
    window.dispatchEvent(new CustomEvent("open-invoice-modal", { detail: { projectId } }));
  };

  const handleOpenPayslip = (slip: any) => {
    window.dispatchEvent(new CustomEvent("open-payslip-modal", { detail: { slip } }));
  };

  const statusMap: Record<string, string> = { active: "status-contacted", pending: "status-qualified", completed: "status-new", onhold: "status-lost", cancelled: "status-lost" };

  return (
    <div className={className} style={{ padding: 0, overflow: "hidden", flexDirection: "column", background: "var(--bg-primary)" }}>
      {/* Header */}
      <header className="content-header" style={{ flexShrink: 0, paddingBottom: 0 }}>
        <div style={{ padding: "0 32px 24px" }}>
          <h1 className="content-title">Invoices & Receipts</h1>
          <p className="content-subtitle">Manage all client billing and team payments centrally.</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 32, padding: "0 32px", borderBottom: "1px solid var(--border-color)", marginTop: 12 }}>
          <div 
            style={{ paddingBottom: 12, cursor: "pointer", fontWeight: 600, fontSize: 14, color: activeTab === "invoices" ? "var(--accent)" : "var(--text-muted)", borderBottom: activeTab === "invoices" ? "2px solid var(--accent)" : "2px solid transparent", transition: "all 0.2s" }}
            onClick={() => setActiveTab("invoices")}
          >
            Client Invoices
          </div>
          <div 
            style={{ paddingBottom: 12, cursor: "pointer", fontWeight: 600, fontSize: 14, color: activeTab === "receipts" ? "var(--accent)" : "var(--text-muted)", borderBottom: activeTab === "receipts" ? "2px solid var(--accent)" : "2px solid transparent", transition: "all 0.2s" }}
            onClick={() => setActiveTab("receipts")}
          >
            Team Payslips
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div className="panel" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, overflow: "auto" }}>
            <table className="data-table" style={{ fontSize: 13 }}>
              {activeTab === "invoices" ? (
                <>
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}><input type="checkbox" className="table-checkbox" /></th>
                      <th>Project ID</th>
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
                    {invoicedProjects.map(p => {
                      const due = p.invoiced - p.paid;
                      return (
                        <tr key={p.id}>
                          <td><input type="checkbox" className="table-checkbox" /></td>
                          <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>#{p.id}</td>
                          <td style={{ maxWidth: 280, whiteSpace: "normal", fontWeight: 500 }}>{p.name}</td>
                          <td>{clients.get(p.client_id || 0) || "Orphaned"}</td>
                          <td><span className="type-badge">{p.project_type}</span></td>
                          <td className="financial-cell">{formatTaka(p.value)}</td>
                          <td className="financial-cell">{formatTaka(p.invoiced)}</td>
                          <td className="financial-cell financial-paid">{formatTaka(p.paid)}</td>
                          <td className={`financial-cell ${due > 0 ? "financial-due" : ""}`}>{formatTaka(due)}</td>
                          <td><span className={`status-badge ${statusMap[p.status || ""] || "status-lost"}`}>{String(p.status || "").toUpperCase()}</span></td>
                          <td>{p.deadline || "—"}</td>
                          <td style={{ textAlign: "center" }}>
                            <button className="ops-btn view" title="View Invoice" onClick={() => handleOpenInvoice(p.id)}>📄</button>
                          </td>
                        </tr>
                      );
                    })}
                    {invoicedProjects.length === 0 && (
                      <tr>
                        <td colSpan={12} style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
                          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🧾</div>
                          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>No invoices generated</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </>
              ) : (
                <>
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}><input type="checkbox" className="table-checkbox" /></th>
                      <th>Receipt ID</th>
                      <th>Project Name</th>
                      <th>Team Member</th>
                      <th>Date</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                      <th style={{ width: 100, textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allReceipts.map(r => (
                      <tr key={r.receiptId}>
                        <td><input type="checkbox" className="table-checkbox" /></td>
                        <td style={{ fontWeight: 600, color: "var(--text-muted)" }}>{r.receiptId}</td>
                        <td style={{ maxWidth: 280, whiteSpace: "normal", fontWeight: 500 }}>{r.projectName}</td>
                        <td>{r.memberName}</td>
                        <td>{r.date}</td>
                        <td className="financial-cell financial-paid">{formatTaka(r.amount)}</td>
                        <td style={{ textAlign: "center" }}>
                          <button className="ops-btn view" title="View Payslip" onClick={() => handleOpenPayslip(r.slip)}>📄</button>
                        </td>
                      </tr>
                    ))}
                    {allReceipts.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
                          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>💵</div>
                          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>No team payslips found</div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </>
              )}
            </table>
          </div>
          <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Showing all records</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicesPage;
