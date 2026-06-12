import React, { useState, useEffect, useContext } from "react";
import { AppContext } from "../../App";
import { invoke } from "@tauri-apps/api/core";

async function safeInvoke<T>(cmd: string, args?: any): Promise<T> {
  if ((window as any).__TAURI_INTERNALS__) {
    return invoke<T>(cmd, args);
  }
  console.log(`Mock invoked: ${cmd}`, args);
  return {} as T;
}

interface Props {
  className?: string;
}

interface Transaction {
  id: number;
  date: string;
  tx_type: "INCOME" | "EXPENSE";
  category: string;
  amount: number;
  reference?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

interface TransactionSummary {
  total_income: number;
  total_expenses: number;
  net_profit: number;
  outstanding_receivables: number;
}

const FinancePage: React.FC<Props> = ({ className }) => {
  const { showToast, showPage } = useContext(AppContext);

  // Read project data from localStorage
  const getProjectData = () => {
    try {
      const raw = localStorage.getItem("dimrz_projects");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };
  const [projects, setProjects] = useState<any[]>([]);
  useEffect(() => { setProjects(getProjectData()); }, [className]);

  const projectIncome = projects.reduce((s: number, p: any) => s + (p.paid || 0), 0);
  const clientDue = projects.reduce((s: number, p: any) => s + ((p.invoiced || 0) - (p.paid || 0)), 0);
  const staffDue = projects.reduce((s: number, p: any) => {
    return s + (p.assignments || []).reduce((sa: number, a: any) => {
      const cost = (a.leads || 1) * (a.rate || 0);
      return sa + (cost - (a.paid || 0));
    }, 0);
  }, 0);
  const staffPaid = projects.reduce((s: number, p: any) => {
    return s + (p.assignments || []).reduce((sa: number, a: any) => sa + (a.paid || 0), 0);
  }, 0);

  // Client dues rows (invoiced but not fully paid)
  const clientRows = projects
    .filter((p: any) => (p.invoiced || 0) - (p.paid || 0) > 0)
    .map((p: any) => ({ id: p.id, name: p.name, invoiced: p.invoiced || 0, paid: p.paid || 0, due: (p.invoiced || 0) - (p.paid || 0) }));

  // Staff dues rows
  const staffRows: { id: number; member: string; project: string; cost: number; paid: number; due: number }[] = [];
  projects.forEach((p: any) => {
    (p.assignments || []).forEach((a: any) => {
      const cost = (a.leads || 1) * (a.rate || 0);
      const due = cost - (a.paid || 0);
      if (due > 0) staffRows.push({ id: a.id, member: a.member_name, project: p.name, cost, paid: a.paid || 0, due });
    });
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary>({
    total_income: 0,
    total_expenses: 0,
    net_profit: 0,
    outstanding_receivables: 0,
  });
  
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newTx, setNewTx] = useState({
    date: new Date().toISOString().split("T")[0],
    tx_type: "INCOME" as "INCOME" | "EXPENSE",
    category: "",
    amount: "",
    reference: "",
    notes: ""
  });

  const fetchData = async () => {
    try {
      const summaryData = await safeInvoke<TransactionSummary>("get_transaction_summary_cmd");
      const txData = await safeInvoke<Transaction[]>("get_transactions_cmd");
      setSummary(summaryData);
      setTransactions(txData);
    } catch (e) {
      console.error(e);
      showToast("Failed to load financial data.", "error");
    }
  };

  useEffect(() => {
    fetchData();
  }, [className]); // Re-fetch when page becomes active

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTx.date || !newTx.category || !newTx.amount) {
      showToast("Please fill all required fields.", "error");
      return;
    }
    const amountNum = parseFloat(newTx.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast("Amount must be a valid positive number.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const tx = {
        id: 0, // Assigned by DB
        date: newTx.date,
        tx_type: newTx.tx_type,
        category: newTx.category,
        amount: amountNum,
        reference: newTx.reference || null,
        notes: newTx.notes || null,
      };
      await safeInvoke("add_transaction_cmd", { tx });
      showToast("Transaction added successfully!", "success");
      setIsAdding(false);
      setNewTx({ ...newTx, category: "", amount: "", reference: "", notes: "" });
      fetchData();
    } catch (e) {
      showToast(typeof e === "string" ? e : "Error saving transaction", "error");
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this transaction? This will affect your Net Profit.")) return;
    try {
      await safeInvoke("delete_transaction_cmd", { id });
      showToast("Transaction removed.", "success");
      fetchData();
    } catch (e) {
      showToast("Error deleting transaction.", "error");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  // Define some default categories based on type
  const incomeCategories = ["Client Payment", "Software Sale", "Consulting", "Affiliate", "Other Income"];
  const expenseCategories = ["Software Subscription", "Marketing/Ads", "Hosting", "Salary/Freelancer", "Office Supplies", "Other Expense"];
  const categories = newTx.tx_type === "INCOME" ? incomeCategories : expenseCategories;

  // Calculate dynamic cashflow visual
  const totalFlow = summary.total_income + summary.total_expenses;
  const incomePct = totalFlow > 0 ? (summary.total_income / totalFlow) * 100 : 50;
  const expensePct = totalFlow > 0 ? (summary.total_expenses / totalFlow) * 100 : 50;

  return (
    <div className={className} style={{ paddingBottom: 40, background: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="content-header">
        <div className="header-left">
          <h1 className="page-title">My Finance</h1>
          <span className="total-count">Track your personal ledger, profitability, and cashflow</span>
        </div>
        <div className="header-right">
          <button className="btn btn-primary" onClick={() => setIsAdding(true)} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}>
            <span style={{ fontSize: 18 }}>+</span> Add Transaction
          </button>
        </div>
      </div>

      {/* Stats Cards — Row 1: Ledger */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, padding: "16px 24px 0" }}>
        {[
          { label: "Ledger Income", value: formatCurrency(summary.total_income), color: "var(--success)", border: "rgba(61,184,122,0.3)", bg: "var(--bg-secondary) 0%, rgba(61,184,122,0.05) 100%", icon: "💰", iconBg: "rgba(61,184,122,0.15)" },
          { label: "Ledger Expenses", value: formatCurrency(summary.total_expenses), color: "var(--danger)", border: "rgba(192,68,94,0.3)", bg: "var(--bg-secondary) 0%, rgba(192,68,94,0.05) 100%", icon: "📉", iconBg: "rgba(192,68,94,0.15)" },
          { label: "Net Profit", value: formatCurrency(summary.net_profit), color: "var(--info)", border: "rgba(74,144,212,0.3)", bg: "var(--bg-secondary) 0%, rgba(74,144,212,0.05) 100%", icon: "💎", iconBg: "rgba(74,144,212,0.15)" },
          { label: "Receivables (Ledger)", value: formatCurrency(summary.outstanding_receivables), color: "var(--warning)", border: "rgba(212,146,74,0.3)", bg: "var(--bg-secondary) 0%, rgba(212,146,74,0.05) 100%", icon: "🕰️", iconBg: "rgba(212,146,74,0.15)" },
        ].map(s => (
          <div className="card" key={s.label} style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, background: `linear-gradient(135deg, ${s.bg})`, borderColor: s.border }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{s.icon}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats Cards — Row 2: Project-linked */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, padding: "12px 24px 16px" }}>
        {[
          { label: "Project Income (Paid)", value: formatCurrency(projectIncome), color: "var(--success)", border: "rgba(61,184,122,0.25)", bg: "var(--bg-secondary) 0%, rgba(61,184,122,0.04) 100%", icon: "📦", iconBg: "rgba(61,184,122,0.12)", action: () => showPage("projects") },
          { label: "Client Due", value: formatCurrency(clientDue), color: "var(--danger)", border: "rgba(192,68,94,0.25)", bg: "var(--bg-secondary) 0%, rgba(192,68,94,0.04) 100%", icon: "🏢", iconBg: "rgba(192,68,94,0.12)", action: () => showPage("projects") },
          { label: "Staff Paid (Total)", value: formatCurrency(staffPaid), color: "var(--info)", border: "rgba(74,144,212,0.25)", bg: "var(--bg-secondary) 0%, rgba(74,144,212,0.04) 100%", icon: "👥", iconBg: "rgba(74,144,212,0.12)", action: () => showPage("myTeam") },
          { label: "Staff Due (Payroll)", value: formatCurrency(staffDue), color: "var(--warning)", border: "rgba(212,146,74,0.25)", bg: "var(--bg-secondary) 0%, rgba(212,146,74,0.04) 100%", icon: "💸", iconBg: "rgba(212,146,74,0.12)", action: () => showPage("myTeam") },
        ].map(s => (
          <div className="card" key={s.label} onClick={s.action} title="Click to navigate" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, background: `linear-gradient(135deg, ${s.bg})`, borderColor: s.border, cursor: "pointer", transition: "all 0.2s" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{s.icon}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Cashflow Bar */}
      <div style={{ padding: "0 24px 24px" }}>
        <div style={{ background: "var(--bg-panel)", borderRadius: 12, border: "1px solid var(--border-color)", padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Cashflow Visualizer</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11, color: "var(--text-muted)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "rgba(61,184,122,0.7)" }} />
                Income {incomePct.toFixed(1)}%
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "rgba(192,68,94,0.7)" }} />
                Expense {expensePct.toFixed(1)}%
              </span>
            </div>
          </div>
          {/* Segmented bar — slim & muted */}
          <div style={{ height: 8, borderRadius: 6, display: "flex", overflow: "hidden", background: "var(--bg-input)", gap: 1 }}>
            <div style={{ width: `${incomePct}%`, background: "rgba(61,184,122,0.55)", borderRadius: "6px 0 0 6px", transition: "width 1s ease-in-out" }} title={`Income: ${incomePct.toFixed(1)}%`} />
            <div style={{ width: `${expensePct}%`, background: "rgba(192,68,94,0.45)", borderRadius: "0 6px 6px 0", transition: "width 1s ease-in-out" }} title={`Expense: ${expensePct.toFixed(1)}%`} />
          </div>
        </div>
      </div>

      {/* Client Dues Table */}
      <div style={{ padding: "0 24px 16px" }}>
        <div style={{ background: "var(--bg-panel)", borderRadius: 12, border: "1px solid var(--border-color)", overflow: "hidden" }}>
          <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: "var(--danger)" }}>🏢</span> Client Dues — Awaiting Payment</div>
            <button onClick={() => showPage("projects")} style={{ fontSize: 11, color: "var(--info)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>View Projects →</button>
          </div>
          <table className="data-table" style={{ margin: 0 }}>
            <thead><tr><th>Project</th><th style={{ textAlign: "right" }}>Invoiced</th><th style={{ textAlign: "right" }}>Paid</th><th style={{ textAlign: "right" }}>Due</th><th style={{ textAlign: "center", width: 80 }}>Action</th></tr></thead>
            <tbody>
              {clientRows.length > 0 ? clientRows.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500, maxWidth: 220 }}>{r.name}</td>
                  <td style={{ textAlign: "right", color: "var(--info)" }}>{formatCurrency(r.invoiced)}</td>
                  <td style={{ textAlign: "right", color: "var(--success)" }}>{formatCurrency(r.paid)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--danger)" }}>{formatCurrency(r.due)}</td>
                  <td style={{ textAlign: "center" }}><button onClick={() => showPage("projects")} className="ops-btn view" title="Go to Project">👁</button></td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: 13 }}>✅ No outstanding client dues</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Payroll Dues Table */}
      <div style={{ padding: "0 24px 16px" }}>
        <div style={{ background: "var(--bg-panel)", borderRadius: 12, border: "1px solid var(--border-color)", overflow: "hidden" }}>
          <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: "var(--warning)" }}>👥</span> Staff Payroll — Outstanding Dues</div>
            <button onClick={() => showPage("myTeam")} style={{ fontSize: 11, color: "var(--info)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>View Team →</button>
          </div>
          <table className="data-table" style={{ margin: 0 }}>
            <thead><tr><th>Staff Member</th><th>Project</th><th style={{ textAlign: "right" }}>Total Cost</th><th style={{ textAlign: "right" }}>Paid</th><th style={{ textAlign: "right" }}>Due</th><th style={{ textAlign: "center", width: 80 }}>Action</th></tr></thead>
            <tbody>
              {staffRows.length > 0 ? staffRows.map((r, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{r.member}</td>
                  <td style={{ color: "var(--text-muted)", maxWidth: 180 }}>{r.project}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(r.cost)}</td>
                  <td style={{ textAlign: "right", color: "var(--success)" }}>{formatCurrency(r.paid)}</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--warning)" }}>{formatCurrency(r.due)}</td>
                  <td style={{ textAlign: "center" }}><button onClick={() => showPage("projects")} className="ops-btn view" title="Go to Project">👁</button></td>
                </tr>
              )) : (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: 13 }}>✅ All staff fully paid</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Ledger Area */}
      <div style={{ padding: "0 24px" }}>
        <div style={{ background: "var(--bg-panel)", borderRadius: 16, border: "1px solid var(--border-color)", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 18, margin: 0, fontWeight: 600 }}>Transaction Ledger</h2>
          </div>
          
          <div className="table-wrap" style={{ margin: 0, border: "none" }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Date</th>
                  <th style={{ width: 100 }}>Type</th>
                  <th>Category</th>
                  <th>Reference</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ width: 60, textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length > 0 ? transactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontWeight: 500, color: "var(--text-muted)" }}>{tx.date}</td>
                    <td>
                      <span style={{
                        padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: tx.tx_type === "INCOME" ? "rgba(16, 185, 129, 0.1)" : "rgba(244, 63, 94, 0.1)",
                        color: tx.tx_type === "INCOME" ? "#10b981" : "#f43f5e"
                      }}>
                        {tx.tx_type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{tx.category}</td>
                    <td style={{ color: "var(--text-muted)" }}>{tx.reference || "—"}</td>
                    <td style={{ 
                      textAlign: "right", 
                      fontWeight: 700, 
                      color: tx.tx_type === "INCOME" ? "#10b981" : "var(--text-primary)" 
                    }}>
                      {tx.tx_type === "INCOME" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button 
                        onClick={() => handleDelete(tx.id)}
                        className="action-btn delete" 
                        title="Delete Transaction"
                        style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>💰</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>No transactions found</div>
                      <div style={{ fontSize: 13, marginTop: 8 }}>Click "Add Transaction" to log your first income or expense.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {isAdding && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="modal-content" style={{ background: "var(--bg-panel)", width: "100%", maxWidth: 500, borderRadius: 16, overflow: "hidden", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: "1px solid var(--border-color)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>New Transaction</h2>
              <button onClick={() => setIsAdding(false)} style={{ background: "transparent", border: "none", fontSize: 24, color: "var(--text-muted)", cursor: "pointer" }}>×</button>
            </div>
            
            <form onSubmit={handleAddTransaction} style={{ padding: 24 }}>
              
              <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>TRANSACTION TYPE</label>
                  <div style={{ display: "flex", background: "var(--bg-input)", borderRadius: 8, padding: 4 }}>
                    <button 
                      type="button"
                      onClick={() => setNewTx({ ...newTx, tx_type: "INCOME", category: "" })}
                      style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s", background: newTx.tx_type === "INCOME" ? "#10b981" : "transparent", color: newTx.tx_type === "INCOME" ? "white" : "var(--text-muted)" }}
                    >INCOME</button>
                    <button 
                      type="button"
                      onClick={() => setNewTx({ ...newTx, tx_type: "EXPENSE", category: "" })}
                      style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s", background: newTx.tx_type === "EXPENSE" ? "#f43f5e" : "transparent", color: newTx.tx_type === "EXPENSE" ? "white" : "var(--text-muted)" }}
                    >EXPENSE</button>
                  </div>
                </div>
                
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>DATE</label>
                  <input 
                    type="date" 
                    value={newTx.date}
                    onChange={(e) => { setNewTx({ ...newTx, date: e.target.value }); e.target.blur(); }}
                    required
                    style={{ width: "100%", padding: "9px 12px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", outline: "none", fontSize: 14 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>CATEGORY</label>
                <div style={{ position: "relative" }}>
                  <input 
                    type="text" 
                    list="category-options"
                    value={newTx.category}
                    onChange={(e) => setNewTx({ ...newTx, category: e.target.value })}
                    placeholder="e.g. Software Subscription"
                    required
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", outline: "none", fontSize: 14 }}
                  />
                  <datalist id="category-options">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>AMOUNT (USD)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.01"
                    value={newTx.amount}
                    onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                    placeholder="0.00"
                    required
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", outline: "none", fontSize: 14, fontWeight: 600 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>REFERENCE (Opt)</label>
                  <input 
                    type="text" 
                    value={newTx.reference}
                    onChange={(e) => setNewTx({ ...newTx, reference: e.target.value })}
                    placeholder="Invoice # or Client"
                    style={{ width: "100%", padding: "10px 12px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", outline: "none", fontSize: 14 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>NOTES</label>
                <textarea 
                  value={newTx.notes}
                  onChange={(e) => setNewTx({ ...newTx, notes: e.target.value })}
                  placeholder="Additional details..."
                  rows={2}
                  style={{ width: "100%", padding: "10px 12px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", outline: "none", fontSize: 14, resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button type="button" onClick={() => setIsAdding(false)} className="btn btn-secondary" style={{ background: "transparent" }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default FinancePage;
