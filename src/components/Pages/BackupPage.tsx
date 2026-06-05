import React, { useState, useContext } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { AppContext } from "../../App";

interface Props {
  className?: string;
}

const BackupPage: React.FC<Props> = ({ className }) => {
  const { showToast, setLoading, triggerRefresh } = useContext(AppContext);
  const [backupMode, setBackupMode] = useState<"merge" | "replace">("merge");

  const handleBackup = async () => {
    try {
      const filePath = await save({
        filters: [{ name: "Dimrz Backup", extensions: ["dzbak"] }],
        defaultPath: "dimrz_leads_backup.dzbak"
      });

      if (!filePath) return;

      setLoading(true);
      await invoke("backup_database", { filePath });
      showToast("Backup exported successfully to " + filePath, "success");
    } catch (e: any) {
      console.error(e);
      showToast("Failed to backup: " + e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Dimrz Backup", extensions: ["dzbak", "parquet"] }]
      });

      if (!selected) return;
      
      let filePath = "";
      const firstSelection = Array.isArray(selected) ? selected[0] : selected;
      if (typeof firstSelection === "string") {
        filePath = firstSelection;
      } else if (typeof firstSelection === "object" && (firstSelection as any).path) {
        filePath = (firstSelection as any).path;
      } else {
        filePath = String(firstSelection);
      }

      const confirmed = await confirm(
        backupMode === "replace"
          ? "WARNING: You are about to WIPES all existing leads and replace them with this backup. This cannot be undone. Are you sure?"
          : "You are about to MERGE this backup into your existing database. Do you wish to continue?"
      );

      if (!confirmed) return;

      setLoading(true);
      const imported = await invoke<number>("restore_database", { 
        filePath, 
        replace: backupMode === "replace" 
      });
      
      showToast(`Successfully restored ${imported} leads!`, "success");
      triggerRefresh();
    } catch (e: any) {
      console.error(e);
      showToast("Failed to restore backup: " + e.toString(), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className} id="backupPage" style={{ paddingBottom: 40 }}>
      <div className="content-header">
        <div className="header-left">
          <h1 className="page-title">Data Backup & Restore</h1>
          <span className="total-count">Securely export and import massive datasets (1GB - 30GB+)</span>
        </div>
      </div>

      <div style={{ padding: "0 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", maxWidth: "1000px" }}>
        
        {/* BACKUP CARD */}
        <div style={{ background: "var(--bg-panel, #ffffff)", borderRadius: 16, border: "1px solid var(--border-color)", padding: 32, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>💾</div>
          <h2 style={{ fontSize: 18, margin: "0 0 8px 0", color: "var(--text-primary)" }}>Export Full Backup</h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24, flex: 1 }}>
            Download your entire leads database into a single, highly-compressed file. This utilizes Apache Parquet format to safely compress up to 30GB+ of data into a fraction of the size.
          </p>
          <button className="btn btn-primary" style={{ padding: "12px 24px", width: "100%", justifyContent: "center", display: "flex", gap: 8 }} onClick={handleBackup}>
            <span>⬇️</span> Download Database (.dzbak)
          </button>
        </div>

        {/* RESTORE CARD */}
        <div style={{ background: "var(--bg-panel, #ffffff)", borderRadius: 16, border: "1px solid var(--border-color)", padding: 32, boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🚀</div>
          <h2 style={{ fontSize: 18, margin: "0 0 8px 0", color: "var(--text-primary)" }}>Restore from Backup</h2>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
            Upload a `.dzbak` file to restore your leads. This is separate from the standard CSV uploader and processes instantly.
          </p>
          
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>Restore Mode</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: backupMode === "merge" ? "var(--text-primary)" : "var(--text-muted)" }}>
                <input type="radio" name="restoreMode" checked={backupMode === "merge"} onChange={() => setBackupMode("merge")} />
                <div>
                  <strong>Merge Leads</strong>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>Appends the backup to your existing database.</div>
                </div>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, color: backupMode === "replace" ? "var(--accent-red)" : "var(--text-muted)" }}>
                <input type="radio" name="restoreMode" checked={backupMode === "replace"} onChange={() => setBackupMode("replace")} />
                <div>
                  <strong>Replace Database</strong>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>WIPES current leads and perfectly mirrors the backup.</div>
                </div>
              </label>
            </div>
          </div>

          <button className="btn" style={{ padding: "12px 24px", width: "100%", justifyContent: "center", display: "flex", gap: 8, background: backupMode === "replace" ? "var(--accent-red)" : "var(--bg-surface-elevated)", color: "white", border: "none" }} onClick={handleRestore}>
            <span>⬆️</span> Upload Backup File
          </button>
        </div>

      </div>
    </div>
  );
};

export default BackupPage;
