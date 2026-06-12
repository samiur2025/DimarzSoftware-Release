import React, { useState, useEffect } from "react";
import { formatDateTime } from "../../utils";

interface Props {
  className: string;
}

export interface SavedScript {
  id: string;
  name: string;
  account: string;
  shareUrl: string; // Google Sheet sharing URL
  formUrl?: string; // Google Form URL
  savedAt: string;
  lastSynced: string | null;
}

const STORAGE_KEY = "dimrz_gform_scripts";

export function getSavedScripts(): SavedScript[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

// Converts any Google Sheets URL to a CSV export URL
export function toCsvUrl(url: string): string | null {
  try {
    // Handle "Publish to the web" URL format
    if (url.includes("/spreadsheets/d/e/")) {
      const parts = url.split("?");
      let base = parts[0];
      base = base.replace(/\/pubhtml$/, "/pub");
      const searchParams = new URLSearchParams(parts[1] || "");
      searchParams.set("output", "csv");
      return `${base}?${searchParams.toString()}`;
    }

    // Extract the sheet ID from standard Google Sheets URL formats
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return null;
    const sheetId = match[1];
    // Extract gid (tab/sheet index) if present
    const gidMatch = url.match(/[#&?]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : "0";
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  } catch {
    return null;
  }
}

// Parse CSV text into array of objects using first row as headers
export function parseCsv(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas inside
    const values: string[] = [];
    let inQuotes = false;
    let current = "";
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes; continue; }
      if (line[i] === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
      current += line[i];
    }
    values.push(current.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  }).filter(row => Object.values(row).some(v => v.trim()));
}

const GoogleFormScriptPage: React.FC<Props> = ({ className }) => {
  const [showForm, setShowForm] = useState(false);
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string; preview?: string[] } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setScripts(getSavedScripts());
  }, []);

  const persist = (updated: SavedScript[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setScripts(updated);
  };

  const resetForm = () => {
    setName(""); setAccount(""); setShareUrl(""); setFormUrl("");
    setTestResult(null); setShowForm(false);
  };

  const handleTestFetch = async () => {
    const url = shareUrl.trim();
    if (!url) { setTestResult({ ok: false, msg: "Paste a Google Sheet sharing link first." }); return; }
    const csvUrl = toCsvUrl(url);
    if (!csvUrl) {
      setTestResult({ ok: false, msg: "❌ This doesn't look like a valid Google Sheets URL. It should contain /spreadsheets/d/..." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status} — Make sure the sheet is shared as "Anyone with the link can view".`);
      const text = await res.text();
      const rows = parseCsv(text);
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      setTestResult({
        ok: true,
        msg: `✅ Connected! Found ${rows.length} row(s) with ${headers.length} column(s).`,
        preview: headers
      });
    } catch (e) {
      setTestResult({ ok: false, msg: `❌ ${(e as Error).message}` });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    if (!name.trim() || !shareUrl.trim()) return;
    if (!toCsvUrl(shareUrl.trim())) {
      setTestResult({ ok: false, msg: "Invalid Google Sheets URL." });
      return;
    }
    setSaving(true);
    const entry: SavedScript = {
      id: Date.now().toString(),
      name: name.trim(),
      account: account.trim(),
      shareUrl: shareUrl.trim(),
      formUrl: formUrl.trim(),
      savedAt: formatDateTime(new Date()),
      lastSynced: null,
    };
    persist([entry, ...scripts]);
    resetForm();
    setSaving(false);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this link?")) return;
    persist(scripts.filter(s => s.id !== id));
  };

  const handleSyncOne = async (script: SavedScript) => {
    const csvUrl = toCsvUrl(script.shareUrl);
    if (!csvUrl) { alert("Invalid URL saved."); return; }
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const rows = parseCsv(text);
      localStorage.setItem(`dimrz_sheet_data_${script.id}`, JSON.stringify(rows));
      const updated = scripts.map(s =>
        s.id === script.id ? { ...s, lastSynced: formatDateTime(new Date()) } : s
      );
      persist(updated);
      alert(`Synced ${rows.length} row(s) from "${script.name}". Go to Onboarding page and click Sync Now.`);
    } catch (e) {
      alert(`Sync failed: ${(e as Error).message}`);
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    } catch (err) {
      alert("Failed to copy text");
    }
  };

  const handleShareEmail = (url: string, name: string) => {
    const subject = encodeURIComponent(`Google Sheet: ${name}`);
    const body = encodeURIComponent(`Here is the link to the Google Sheet:\n\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className={className} id="gformScriptPage">
      <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div className="content-header">
          <div className="header-left">
            <div>
              <div className="page-title" style={{ fontSize: 22, fontStyle: "italic", fontWeight: 800, letterSpacing: "-0.5px" }}>GOOGLE FORM SCRIPTS</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Add your Google Sheet sharing link — onboarding form submissions will sync automatically.
              </div>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setTestResult(null); }}>
              <span>➕</span> Add Link
            </button>
          </div>
        </div>

        {/* How it works */}
        <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "14px 20px", marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 20 }}>💡</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--info)", marginBottom: 4 }}>How it works — 2 simple steps</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.9 }}>
              <strong>Step 1:</strong> Open your Google Sheet (where your Google Form responses are saved) →
              click <strong>Share</strong> → set access to <strong>"Anyone with the link — Viewer"</strong> → copy the link.<br />
              <strong>Step 2:</strong> Paste that link here and click <strong>Save</strong>.
              Dimrz will fetch all rows and auto-populate <strong>Onboarding</strong>.
            </div>
          </div>
        </div>

        {/* Add Form */}
        {showForm && (
          <div className="form-card" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Add New Sheet Link</div>
              <button
                onClick={resetForm}
                style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-hover)", border: "1px solid var(--border-color)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}
              >✕</button>
            </div>

            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: "1/-1" }}>
                <label className="form-label required">Link Name</label>
                <input
                  type="text" className="form-input"
                  placeholder="e.g. Freelancer Onboarding — June 2025"
                  value={name} onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Google Account (optional)</label>
                <input
                  type="text" className="form-input"
                  placeholder="e.g. admin@dimrz.com"
                  value={account} onChange={e => setAccount(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Google Form URL (optional)</label>
                <input
                  type="url" className="form-input"
                  placeholder="https://docs.google.com/forms/d/..."
                  value={formUrl} onChange={e => setFormUrl(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label className="form-label required">Google Sheet Sharing Link</label>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                Paste the link from <strong>Share → Copy link</strong> (e.g. https://docs.google.com/spreadsheets/d/…/edit?usp=sharing)
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  type="url" className="form-input"
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                  value={shareUrl} onChange={e => { setShareUrl(e.target.value); setTestResult(null); }}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={handleTestFetch}
                  disabled={testing || !shareUrl.trim()}
                  style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  {testing ? "⏳ Testing..." : "🔌 Test Link"}
                </button>
              </div>

              {testResult && (
                <div style={{
                  marginTop: 8, padding: "10px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                  background: testResult.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                  border: `1px solid ${testResult.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                  color: testResult.ok ? "var(--success)" : "var(--danger)"
                }}>
                  {testResult.msg}
                  {testResult.preview && testResult.preview.length > 0 && (
                    <div style={{ marginTop: 6, color: "var(--text-secondary)" }}>
                      <span style={{ fontWeight: 700 }}>Columns detected:</span>{" "}
                      {testResult.preview.join(" · ")}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={resetForm}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !name.trim() || !shareUrl.trim()}
              >
                <span>💾</span> {saving ? "Saving..." : "Save Link"}
              </button>
            </div>
          </div>
        )}

        {/* Saved Links */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Saved Sheet Links</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}><strong>{scripts.length}</strong> links</div>
          </div>

          {scripts.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🔗</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}>No sheet links saved</div>
              <div style={{ fontSize: 13 }}>Add your first Google Sheet sharing link to get started.</div>
            </div>
          ) : (
            scripts.map((s, idx) => (
              <div
                key={s.id}
                style={{
                  borderBottom: idx < scripts.length - 1 ? "1px solid var(--border-color)" : "none",
                  padding: "16px 24px",
                  background: expandedId === s.id ? "var(--bg-hover)" : "transparent",
                  transition: "background 0.2s"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🔗</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                        {s.account && <span style={{ marginRight: 12 }}>📧 {s.account}</span>}
                        Saved: {s.savedAt}
                        {s.lastSynced && <span style={{ marginLeft: 12, color: "var(--success)" }}>✅ Synced: {s.lastSynced}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--info)", marginTop: 2, fontFamily: "monospace", opacity: 0.8 }}>
                        {s.shareUrl.length > 70 ? s.shareUrl.substring(0, 70) + "…" : s.shareUrl}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                      {expandedId === s.id ? "▲ Hide" : "▼ Details"}
                    </button>
                    <button className="btn btn-success" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => handleSyncOne(s)}>
                      🔄 Sync
                    </button>
                    <button className="btn btn-danger" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => handleDelete(s.id)}>
                      🗑
                    </button>
                  </div>
                </div>

                {expandedId === s.id && (
                  <div style={{ marginTop: 14, padding: 14, background: "var(--bg-input)", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                      <div>
                        <div style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Google Sheet URL</div>
                        <div style={{ fontFamily: "monospace", color: "var(--info)", wordBreak: "break-all", lineHeight: 1.6, marginBottom: 10 }}>
                          <a href={s.shareUrl} target="_blank" rel="noreferrer" style={{ color: "var(--info)" }}>{s.shareUrl}</a>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => handleCopyLink(s.shareUrl)}>
                            📋 Copy Sheet Link
                          </button>
                          <button className="btn btn-primary" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => handleShareEmail(s.shareUrl, s.name)}>
                            📧 Share via Email
                          </button>
                        </div>
                      </div>
                      
                      {s.formUrl && (
                        <div>
                          <div style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Google Form URL</div>
                          <div style={{ fontFamily: "monospace", color: "var(--success)", wordBreak: "break-all", lineHeight: 1.6, marginBottom: 10 }}>
                            <a href={s.formUrl} target="_blank" rel="noreferrer" style={{ color: "var(--success)" }}>{s.formUrl}</a>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="btn btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => handleCopyLink(s.formUrl!)}>
                              📋 Copy Form Link
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleFormScriptPage;
