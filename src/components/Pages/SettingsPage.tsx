import React, { useState, useEffect, useContext } from "react";
import { AppContext } from "../../App";

interface Props {
  className?: string;
}

interface Preferences {
  theme: "Light" | "Dark" | "System";
  exportFormat: "CSV" | "Excel";
}

const defaultPrefs: Preferences = {
  theme: "System",
  exportFormat: "CSV"
};

const SettingsPage: React.FC<Props> = ({ className }) => {
  const { showToast, agency, setAgency } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState<"agency" | "preferences">("agency");

  // States
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs);

  useEffect(() => {
    // Load Prefs
    const storedPrefs = localStorage.getItem("dimrz_settings_prefs");
    if (storedPrefs) setPrefs(JSON.parse(storedPrefs));
    else localStorage.setItem("dimrz_settings_prefs", JSON.stringify(defaultPrefs));
  }, []);

  const handleSaveAgency = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("dimrz_settings_agency", JSON.stringify(agency));
    showToast("Agency information saved successfully", "success");
  };

  const handleSavePrefs = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("dimrz_settings_prefs", JSON.stringify(prefs));
    showToast("Preferences saved successfully", "success");
    // In a real app, theme change logic would be triggered here
  };

  const tabStyle = (isActive: boolean) => ({
    padding: "12px 24px",
    cursor: "pointer",
    fontWeight: 500,
    fontSize: 14,
    borderBottom: isActive ? "2px solid var(--primary-color, #4f46e5)" : "2px solid transparent",
    color: isActive ? "var(--primary-color, #4f46e5)" : "var(--text-muted)",
    transition: "all 0.2s"
  });

  return (
    <div className={className} id="settingsPage" style={{ paddingBottom: 40 }}>
      <div className="content-header">
        <div className="header-left">
          <h1 className="page-title">Settings</h1>
          <span className="total-count">Configure agency profile and application preferences</span>
        </div>
      </div>

      <div style={{ padding: "0 24px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", marginBottom: 24 }}>
          <div style={tabStyle(activeTab === "agency")} onClick={() => setActiveTab("agency")}>🏢 Agency Profile</div>
          <div style={tabStyle(activeTab === "preferences")} onClick={() => setActiveTab("preferences")}>⚙️ Preferences</div>
        </div>

        {/* Tab Content */}
        <div style={{ maxWidth: 800 }}>
          
          {/* AGENCY TAB */}
          {activeTab === "agency" && (
            <div style={{ background: "var(--bg-panel, #ffffff)", borderRadius: 16, border: "1px solid var(--border-color)", padding: 32, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
              <h2 style={{ fontSize: 18, margin: "0 0 24px 0", color: "var(--text-primary)" }}>Agency Details</h2>
              <form onSubmit={handleSaveAgency} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 8, color: "var(--text-muted)" }}>Agency Name</label>
                    <input 
                      type="text" 
                      value={agency.name}
                      onChange={e => setAgency({...agency, name: e.target.value})}
                      style={{ width: "100%", padding: "12px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, outline: "none", color: "var(--text-primary)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 8, color: "var(--text-muted)" }}>Location</label>
                    <input 
                      type="text" 
                      value={agency.location}
                      onChange={e => setAgency({...agency, location: e.target.value})}
                      style={{ width: "100%", padding: "12px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, outline: "none", color: "var(--text-primary)" }}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 8, color: "var(--text-muted)" }}>Support Email</label>
                    <input 
                      type="email" 
                      value={agency.email}
                      onChange={e => setAgency({...agency, email: e.target.value})}
                      style={{ width: "100%", padding: "12px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, outline: "none", color: "var(--text-primary)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 8, color: "var(--text-muted)" }}>Website URL</label>
                    <input 
                      type="url" 
                      value={agency.website}
                      onChange={e => setAgency({...agency, website: e.target.value})}
                      style={{ width: "100%", padding: "12px", background: "var(--bg-input)", border: "1px solid var(--border-color)", borderRadius: 8, outline: "none", color: "var(--text-primary)" }}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: "10px 24px" }}>Save Changes</button>
                </div>
              </form>
            </div>
          )}

          {/* PREFERENCES TAB */}
          {activeTab === "preferences" && (
            <div style={{ background: "var(--bg-panel, #ffffff)", borderRadius: 16, border: "1px solid var(--border-color)", padding: 32, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
              <h2 style={{ fontSize: 18, margin: "0 0 24px 0", color: "var(--text-primary)" }}>Application Preferences</h2>
              <form onSubmit={handleSavePrefs} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                
                <div>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 12, color: "var(--text-primary)" }}>Appearance Theme</label>
                  <div style={{ display: "flex", gap: 16 }}>
                    {["Light", "Dark", "System"].map(t => (
                      <label key={t} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", background: prefs.theme === t ? "rgba(79, 70, 229, 0.1)" : "var(--bg-input)", border: prefs.theme === t ? "1px solid #4f46e5" : "1px solid var(--border-color)", borderRadius: 8, cursor: "pointer", color: prefs.theme === t ? "#4f46e5" : "var(--text-primary)", fontWeight: 500 }}>
                        <input 
                          type="radio" 
                          name="theme" 
                          value={t} 
                          checked={prefs.theme === t}
                          onChange={() => setPrefs({...prefs, theme: t as any})}
                          style={{ display: "none" }}
                        />
                        {t === "Light" ? "☀️" : t === "Dark" ? "🌙" : "💻"} {t}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 12, color: "var(--text-primary)" }}>Default Export Format</label>
                  <div style={{ display: "flex", gap: 16 }}>
                    {["CSV", "Excel"].map(f => (
                      <label key={f} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", background: prefs.exportFormat === f ? "rgba(16, 185, 129, 0.1)" : "var(--bg-input)", border: prefs.exportFormat === f ? "1px solid #10b981" : "1px solid var(--border-color)", borderRadius: 8, cursor: "pointer", color: prefs.exportFormat === f ? "#10b981" : "var(--text-primary)", fontWeight: 500 }}>
                        <input 
                          type="radio" 
                          name="export" 
                          value={f} 
                          checked={prefs.exportFormat === f}
                          onChange={() => setPrefs({...prefs, exportFormat: f as any})}
                          style={{ display: "none" }}
                        />
                        {f === "CSV" ? "📄" : "📊"} {f === "CSV" ? "CSV (.csv)" : "Excel (.xlsx)"}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12, borderTop: "1px solid var(--border-color)", paddingTop: 24 }}>
                  <button type="submit" className="btn btn-primary" style={{ padding: "10px 24px" }}>Save Preferences</button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
