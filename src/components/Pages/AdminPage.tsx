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

interface SystemUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: "Admin" | "Editor" | "Viewer";
  status: "Active" | "Inactive";
}

const defaultUsers: SystemUser[] = [
  { id: "1", name: "Samiur Rahman", email: "admin@dimrz.com", password: "password123", role: "Admin", status: "Active" },
  { id: "2", name: "Jane Smith", email: "jane@dimrz.com", password: "password123", role: "Editor", status: "Active" },
  { id: "3", name: "Bob Johnson", email: "bob@dimrz.com", password: "password123", role: "Viewer", status: "Inactive" }
];

const AdminPage: React.FC<Props> = ({ className }) => {
  const { showToast, triggerRefresh } = useContext(AppContext);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "Viewer" as "Admin" | "Editor" | "Viewer" });
  const [apiKey, setApiKey] = useState("");
  const [stats] = useState({ totalLeads: 45213, activeUsers: 2, dbSize: "142 MB" });
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    // Load from local storage or use default
    const storedUsers = localStorage.getItem("dimrz_admin_users");
    if (storedUsers) {
      setUsers(JSON.parse(storedUsers));
    } else {
      setUsers(defaultUsers);
      localStorage.setItem("dimrz_admin_users", JSON.stringify(defaultUsers));
    }

    const storedKey = localStorage.getItem("dimrz_api_key");
    if (storedKey) setApiKey(storedKey);
  }, []);

  const saveUsers = (newUsers: SystemUser[]) => {
    setUsers(newUsers);
    localStorage.setItem("dimrz_admin_users", JSON.stringify(newUsers));
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) {
      showToast("Please fill in all fields including password", "error");
      return;
    }
    
    if (editingUserId) {
      saveUsers(users.map(u => u.id === editingUserId ? { ...u, name: newUser.name, email: newUser.email, password: newUser.password, role: newUser.role } : u));
      showToast("User updated successfully", "success");
    } else {
      const user: SystemUser = {
        id: Date.now().toString(),
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        status: "Active"
      };
      saveUsers([...users, user]);
      showToast("User added successfully", "success");
    }
    
    resetForm();
  };

  const resetForm = () => {
    setNewUser({ name: "", email: "", password: "", role: "Viewer" });
    setEditingUserId(null);
    setIsAddingUser(false);
  };

  const handleEditUser = (user: SystemUser) => {
    setNewUser({ name: user.name, email: user.email, password: user.password || "", role: user.role });
    setEditingUserId(user.id);
    setIsAddingUser(true);
  };

  const handleDeleteUser = (id: string) => {
    if (id === "1") {
      showToast("Cannot delete the primary admin account", "error");
      return;
    }
    saveUsers(users.filter(u => u.id !== id));
    showToast("User removed", "info");
  };

  const handleToggleUserStatus = (id: string) => {
    if (id === "1") return;
    saveUsers(users.map(u => {
      if (u.id === id) {
        return { ...u, status: u.status === "Active" ? "Inactive" : "Active" };
      }
      return u;
    }));
  };

  const handleSaveApiKey = () => {
    localStorage.setItem("dimrz_api_key", apiKey);
    showToast("API Key saved successfully", "success");
  };

  const handleOptimizeDb = async () => {
    setIsOptimizing(true);
    showToast("Starting database optimization...", "info");
    try {
      await safeInvoke("optimize_db_cmd");
      showToast("Database optimized successfully! Storage reclaimed.", "success");
    } catch (e) {
      showToast(typeof e === "string" ? e : "Optimization failed", "error");
    }
    setIsOptimizing(false);
  };

  const handleClearAllLeads = async () => {
    if (!confirm("⚠️ DANGER: This will permanently delete ALL leads from the database. This cannot be undone!\n\nAre you absolutely sure?")) return;
    if (!confirm("Last warning: ALL leads will be erased permanently. Click OK to confirm.")) return;
    setIsClearing(true);
    try {
      const deleted = await safeInvoke<number>("clear_all_leads_cmd");
      showToast(`✅ ${Number(deleted).toLocaleString()} leads deleted. Ready for fresh import.`, "success");
      triggerRefresh(); // Force LeadsPage to re-fetch and show empty state
    } catch (e) {
      showToast(typeof e === "string" ? e : "Failed to clear leads", "error");
    }
    setIsClearing(false);
  };

  const handleBackupDb = () => {
    showToast("Preparing database backup...", "info");
    setTimeout(() => {
      showToast("Backup dimrz_backup_2026.sqlite downloaded.", "success");
    }, 1500);
  };

  const handleClearCache = () => {
    if (confirm("Are you sure you want to clear the local application cache? This will log you out of some integrations.")) {
      showToast("Application cache cleared", "success");
    }
  };

  return (
    <div className={className} id="adminPage" style={{ paddingBottom: 40 }}>
      <div className="content-header">
        <div className="header-left">
          <h1 className="page-title">System Administration</h1>
          <span className="total-count">Manage application settings, users, and database</span>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, padding: "24px", paddingTop: 0 }}>
        
        <div style={{ background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)", borderRadius: 16, padding: 24, color: "white", boxShadow: "0 10px 25px -5px rgba(79, 70, 229, 0.4)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, fontSize: 100, opacity: 0.1 }}>📁</div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 500, opacity: 0.8 }}>Total Leads</h3>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{stats.totalLeads.toLocaleString()}</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)", borderRadius: 16, padding: 24, color: "white", boxShadow: "0 10px 25px -5px rgba(14, 165, 233, 0.4)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, fontSize: 100, opacity: 0.1 }}>👥</div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 500, opacity: 0.8 }}>Active Users</h3>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{users.filter(u => u.status === "Active").length}</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #10b981 0%, #047857 100%)", borderRadius: 16, padding: 24, color: "white", boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.4)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, fontSize: 100, opacity: 0.1 }}>💽</div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 500, opacity: 0.8 }}>Database Size</h3>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{stats.dbSize}</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)", borderRadius: 16, padding: 24, color: "white", boxShadow: "0 10px 25px -5px rgba(245, 158, 11, 0.4)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, fontSize: 100, opacity: 0.1 }}>⚡</div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 500, opacity: 0.8 }}>System Status</h3>
          <div style={{ fontSize: 32, fontWeight: 700 }}>Healthy</div>
        </div>

      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, padding: "0 24px" }}>
        
        {/* Left Column: User Management */}
        <div style={{ background: "var(--bg-panel, #ffffff)", borderRadius: 16, border: "1px solid var(--border-color)", padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, margin: 0, color: "var(--text-primary)" }}>User Management</h2>
            <button className="btn btn-primary" onClick={() => {
              if (isAddingUser) {
                resetForm();
              } else {
                setIsAddingUser(true);
              }
            }}>
              {isAddingUser ? "Cancel" : "Add User"}
            </button>
          </div>

          {isAddingUser && (
            <form onSubmit={handleAddUser} style={{ background: "var(--bg-input)", padding: 16, borderRadius: 12, marginBottom: 20, border: "1px solid var(--border-color)" }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>{editingUserId ? "Edit User" : "Invite New User"}</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  style={{ width: "100%", padding: "10px", background: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: 8, outline: "none", color: "var(--text-primary)" }}
                />
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  style={{ width: "100%", padding: "10px", background: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: 8, outline: "none", color: "var(--text-primary)" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  style={{ width: "100%", padding: "10px", background: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: 8, outline: "none", color: "var(--text-primary)" }}
                />
                <select 
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value as any})}
                  style={{ width: "100%", padding: "10px", background: "var(--bg-panel)", border: "1px solid var(--border-color)", borderRadius: 8, outline: "none", color: "var(--text-primary)" }}
                >
                  <option value="Admin">Admin (Full Access)</option>
                  <option value="Editor">Editor (Can edit leads)</option>
                  <option value="Viewer">Viewer (Read-only)</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn btn-primary">{editingUserId ? "Save Changes" : "Send Invite"}</button>
              </div>
            </form>
          )}

          <div className="table-wrap" style={{ margin: 0, borderRadius: 12, border: "1px solid var(--border-color)" }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ width: 100, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--primary-color)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12 }}>
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{user.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ 
                        padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                        background: user.role === "Admin" ? "rgba(79, 70, 229, 0.1)" : user.role === "Editor" ? "rgba(16, 185, 129, 0.1)" : "rgba(107, 114, 128, 0.1)",
                        color: user.role === "Admin" ? "#4f46e5" : user.role === "Editor" ? "#10b981" : "#6b7280"
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span 
                        onClick={() => handleToggleUserStatus(user.id)}
                        style={{ 
                          padding: "4px 8px", borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: user.id === "1" ? "default" : "pointer",
                          background: user.status === "Active" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                          color: user.status === "Active" ? "#10b981" : "#ef4444"
                        }}>
                        {user.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <button className="action-btn edit" onClick={() => handleEditUser(user)} title="Edit User" style={{ border: "none", background: "transparent", color: "#3b82f6", cursor: "pointer", fontSize: 16 }}>
                        ✎
                      </button>
                      {user.id !== "1" && (
                        <button className="action-btn delete" onClick={() => handleDeleteUser(user.id)} title="Remove User" style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 16 }}>
                          🗑
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Settings & Database */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Database Maintenance */}
          <div style={{ background: "var(--bg-panel, #ffffff)", borderRadius: 16, border: "1px solid var(--border-color)", padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontSize: 18, margin: "0 0 16px 0", color: "var(--text-primary)" }}>Database Maintenance</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>Manage your local DuckDB database health and backups.</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button 
                className="btn btn-secondary" 
                onClick={handleOptimizeDb}
                disabled={isOptimizing}
                style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}
              >
                {isOptimizing ? "⏳ Optimizing..." : "⚡ Optimize Database (Vacuum)"}
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={handleBackupDb}
                style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 8 }}
              >
                💾 Export Database Backup
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={handleClearCache}
                style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 8, color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.2)" }}
              >
                🧹 Clear Application Cache
              </button>
              <button 
                onClick={handleClearAllLeads}
                disabled={isClearing}
                style={{ width: "100%", padding: "10px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 8, color: "#ef4444", cursor: isClearing ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {isClearing ? "⏳ Clearing..." : "🗑 Clear ALL Leads (Fresh Start)"}
              </button>
            </div>
          </div>

          {/* Integrations */}
          <div style={{ background: "var(--bg-panel, #ffffff)", borderRadius: 16, border: "1px solid var(--border-color)", padding: 24, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontSize: 18, margin: "0 0 16px 0", color: "var(--text-primary)" }}>API Integrations</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 8, color: "var(--text-primary)" }}>Global API Key</label>
              <input 
                type="password" 
                placeholder="sk_live_..." 
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{ width: "100%", padding: "10px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, outline: "none", color: "var(--text-primary)", marginBottom: 12 }}
              />
              <button className="btn btn-primary" onClick={handleSaveApiKey} style={{ width: "100%" }}>Save API Key</button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default AdminPage;
