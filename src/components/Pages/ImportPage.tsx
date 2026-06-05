import React, { useState, useContext } from "react";
import { AppContext } from "../../App";

import { open } from "@tauri-apps/plugin-dialog";

// Safe wrapper for Tauri API calls to prevent crashes in regular browsers
const isTauri = () => typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI_IPC__' in window || '__TAURI__' in window);
import { invoke } from "@tauri-apps/api/core";
async function safeInvoke<T>(cmd: string, args?: any): Promise<T> {
  if (isTauri()) {
    return await invoke<T>(cmd, args);
  } else {
    console.warn(`Tauri is not available. Mocking command: ${cmd}`);
    return {} as T;
  }
}



interface Props {
  className: string;
}

type ImportStep = 'UPLOAD' | 'AUDIT' | 'COMMIT';

const ImportPage: React.FC<Props> = ({ className }) => {
  const { showToast, showPage, triggerRefresh } = useContext(AppContext);
  const [currentStep, setCurrentStep] = useState<ImportStep>('UPLOAD');
  const [selectedFile, setSelectedFile] = useState<{ path: string, name: string, size?: number, fileObj?: File } | null>(null);
  
  const [targetClient, setTargetClient] = useState("Dimarz Property");
  const [workspaceNode, setWorkspaceNode] = useState("Project 01");
  
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditData, setAuditData] = useState<{ rows: any[], stats: any, valid_row_numbers?: number[] } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [, setIsCommitting] = useState(false);
  

  const [auditPage, setAuditPage] = useState(1);
  const [auditFilter, setAuditFilter] = useState<'ALL'|'VALID'|'HARD_DUPLICATE'|'SOFT_WARNING'>('ALL');
  const [commitSuccess, setCommitSuccess] = useState(false);
  const [auditTime, setAuditTime] = useState(0);
  const [commitTime, setCommitTime] = useState(0);
  const isCommittingRef = React.useRef(false); // To help with effect dependencies

  React.useEffect(() => {
    let interval: any;
    if (isAuditing) {
      setAuditTime(0);
      interval = setInterval(() => {
        setAuditTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isAuditing]);

  // Hook for commit timing
  React.useEffect(() => {
    let interval: any;
    if (isCommittingRef.current) {
      setCommitTime(0);
      interval = setInterval(() => {
        setCommitTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  });

  const handleDownloadTemplate = (e: React.MouseEvent) => {
    e.preventDefault();
    const headers = ["Country", "Industry", "Niche", "Business Name", "Website", "Person Name", "Title", "Business Email", "Phone", "City", "State", "Revenue", "Size", "Status", "Generated"];
    const sampleRows = [
      ["USA", "Technology", "SaaS", "Mock Corp", "mock.com", "John Doe", "CEO", "john@mock.com", "555-1001", "San Francisco", "CA", "$1M", "1-10", "New", "Auto"],
    ];
    const csvContent = [headers.join(","), ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "dimrz_leads_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSelectFile = async () => {
    try {
      if (!isTauri()) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (file) {
            setSelectedFile({ path: "browser_mock_path", name: file.name, size: file.size, fileObj: file });
          }
        };
        input.click();
        return;
      }
      const path = await open({ filters: [{ name: "CSV", extensions: ["csv"] }], multiple: false });
      if (path && typeof path === "string") {
        const name = path.split(/[/\\]/).pop() || "unknown.csv";
        setSelectedFile({ path, name });
      }
    } catch (e) {
      showToast(`Failed to select file: ${e}`, "error");
    }
  };

  const handleUploadAndAudit = async () => {
    if (!selectedFile) return;
    setIsAuditing(true);
    showToast("Analyzing CSV for duplicates and errors...", "info");

    try {
      let res: any = null;
      if (!isTauri() && selectedFile.fileObj) {
        const text = await selectedFile.fileObj.text();
        const response = await fetch('http://127.0.0.1:4321/api/leads/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvData: text })
        });
        if (!response.ok) throw new Error('Network response was not ok');
        res = await response.json();
      } else if (isTauri() && selectedFile.path) {
        res = await safeInvoke("audit_csv_cmd", { csvPath: selectedFile.path });
      } else {
        throw new Error('No file selected');
      }

      if (res && res.rows) {
        setAuditData(res);
        
        if (res.valid_row_numbers && res.valid_row_numbers.length > 0) {
            setSelectedRows(new Set(res.valid_row_numbers));
        } else {
            setSelectedRows(new Set(res.rows.filter((r: any) => r.audit_status === 'VALID').map((r: any) => r.row_number)));
        }
        
        setCurrentStep('AUDIT');
        showToast("Audit complete!", "success");
      }
    } catch (e) {
      showToast(`Audit failed: ${e}`, "error");
    } finally {
      setIsAuditing(false);
    }
  };

  const toggleSelectAll = () => {
    if (!auditData) return;
    const selectable = auditData.valid_row_numbers || auditData.rows.filter((r: any) => r.audit_status !== 'HARD_DUPLICATE').map((r: any) => r.row_number);
    if (selectedRows.size === selectable.length && selectable.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(selectable));
    }
  };

  const toggleRow = (id: number) => {
    const newSet = new Set(selectedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedRows(newSet);
  };

  const handleCommit = async () => {
    if (!auditData || selectedRows.size === 0) return;
    setCurrentStep('COMMIT');
    setIsCommitting(true);
    isCommittingRef.current = true;

    try {
      const rowsToCommit = Array.from(selectedRows);
      if (!isTauri()) {
        const response = await fetch('http://127.0.0.1:4321/api/leads/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: rowsToCommit, clientProfile: targetClient, workspaceNode })
        });
        if (!response.ok) throw new Error('Commit failed');
        await response.json();
      } else {
        // Compute the tiny list of REJECTED rows (hard duplicates not selected)
        // instead of sending the huge approved list over IPC.
        const totalRows = auditData.stats.total;
        const rejectedRows: number[] = [];
        for (let i = 1; i <= totalRows; i++) {
          if (!selectedRows.has(i)) rejectedRows.push(i);
        }

        const res = await safeInvoke<any>("commit_csv_cmd", { 
          csvPath: selectedFile?.path || "",
          rejectedRows,   // Only ~2K numbers, not 817K
          clientProfile: targetClient, 
          workspaceNode 
        });
        if (res.failed > 0) {
          showToast(`Imported ${res.imported} rows (${res.failed} failed).`, "info");
        } else {
          showToast(`✅ ${res.imported} leads imported successfully!`, "success");
        }
        triggerRefresh(); // Force LeadsPage to reload immediately
      }
      setCommitSuccess(true);
    } catch (e) {
      showToast(`Commit failed: ${e}`, "error");
      setCurrentStep('AUDIT');
    } finally {
      setIsCommitting(false);
      isCommittingRef.current = false;
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setAuditData(null);
    setCommitSuccess(false);
    setCurrentStep('UPLOAD');
    triggerRefresh(); // Ensure LeadsPage is fresh when we navigate back
    showPage('leads');
  };

  return (
    <div className={className} id="importPage">
      <div className="import-card" style={{ maxWidth: 1200, margin: '0 auto', background: 'var(--bg-card)', padding: 32, borderRadius: 12 }}>
        
        {/* Stepper */}
        <div className="import-stepper">
          <div className={`step ${currentStep === 'UPLOAD' ? 'active' : ''} ${currentStep === 'AUDIT' || currentStep === 'COMMIT' ? 'completed' : ''}`}>
            <span className="step-circle">1</span> Upload
          </div>
          <div className="step-line"></div>
          <div className={`step ${currentStep === 'AUDIT' ? 'active' : ''} ${currentStep === 'COMMIT' ? 'completed' : ''}`}>
            <span className="step-circle">2</span> Audit Report
          </div>
          <div className="step-line"></div>
          <div className={`step ${currentStep === 'COMMIT' ? 'active' : ''}`}>
            <span className="step-circle">3</span> Commit
          </div>
        </div>

        {currentStep === 'UPLOAD' && (
          <div className="import-upload-step">
            <div className="import-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2>Bulk Lead Import</h2>
                <p style={{ color: 'var(--text-muted)' }}>Standardize format mappings by uploading itemized CSV sheets securely.</p>
              </div>
              <button className="btn btn-secondary" onClick={handleDownloadTemplate}>📋 Use Template</button>
            </div>

            <div className="import-config" style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 8 }}>TARGET CLIENT PROFILE</label>
                <select value={targetClient} onChange={e => setTargetClient(e.target.value)} className="import-select">
                  <option value="Dimarz Property">Dimarz Property</option>
                  <option value="Global Tech">Global Tech</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 8 }}>SCOPED WORKSPACE NODE</label>
                <select value={workspaceNode} onChange={e => setWorkspaceNode(e.target.value)} className="import-select">
                  <option value="Project 01">Project 01</option>
                  <option value="Project 02">Project 02</option>
                  <option value="Project 03">Project 03</option>
                </select>
              </div>
            </div>

            <div className="upload-zone" onClick={handleSelectFile} style={{ border: '1px dashed var(--border-color)', borderRadius: 12, padding: 48, textAlign: 'center', cursor: 'pointer', background: 'var(--bg-input)', marginBottom: 24 }}>
              <div className="upload-icon" style={{ fontSize: 32, marginBottom: 16 }}>☁️</div>
              {selectedFile ? (
                <>
                  <div style={{ color: 'var(--success)', fontWeight: 600, marginBottom: 8 }}>✓ {selectedFile.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Supports discrete flat structures accurately.</div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Drop CSV here / <span style={{ color: 'var(--primary)' }}>Browse file</span></div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Supports discrete flat structures accurately.</div>
                </>
              )}
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '16px', fontSize: 16, borderRadius: 8, opacity: selectedFile ? 1 : 0.5 }}
              onClick={handleUploadAndAudit}
              disabled={!selectedFile || isAuditing}
            >
              {isAuditing ? `Analyzing... (${auditTime}s)` : '↑ Upload & Audit'}
            </button>
          </div>
        )}

        {currentStep === 'AUDIT' && auditData && (
          <div className="import-audit-step">
            <div className="import-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', border: '4px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'var(--success)' }}>
                  100%
                </div>
                <div>
                  <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--success)' }}>✓</span> Validation Audit Report</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Records passed syntax verification and duplicate index benchmarks triggers correctly.</p>
                </div>
              </div>
              <button className="btn btn-secondary" onClick={() => setCurrentStep('UPLOAD')}>Abort</button>
            </div>

            <div className="audit-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              <div 
                className="stat-box" 
                onClick={() => setAuditFilter('ALL')}
                style={{ background: auditFilter === 'ALL' ? 'rgba(255,255,255,0.1)' : 'var(--bg-input)', padding: 16, borderRadius: 8, border: auditFilter === 'ALL' ? '2px solid var(--text-primary)' : '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ fontSize: 24, fontWeight: 'bold' }}>{auditData.stats.total}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL ROWS</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>Total records parsed from CSV</div>
              </div>
              <div 
                className="stat-box" 
                onClick={() => setAuditFilter('VALID')}
                style={{ background: auditFilter === 'VALID' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)', padding: 16, borderRadius: 8, border: auditFilter === 'VALID' ? '2px solid var(--success)' : '1px solid rgba(16, 185, 129, 0.2)', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--success)' }}>{auditData.stats.valid}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>VALID / SAFE</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>Clean data, ready to import</div>
              </div>
              <div 
                className="stat-box" 
                onClick={() => setAuditFilter('HARD_DUPLICATE')}
                style={{ background: auditFilter === 'HARD_DUPLICATE' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-input)', padding: 16, borderRadius: 8, border: auditFilter === 'HARD_DUPLICATE' ? '2px solid var(--danger)' : '1px solid rgba(239, 68, 68, 0.2)', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--danger)' }}>{auditData.stats.hard_duplicates}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>HARD DUPLICATES</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>Found in DB or duplicate within CSV</div>
              </div>
              <div 
                className="stat-box" 
                onClick={() => setAuditFilter('SOFT_WARNING')}
                style={{ background: auditFilter === 'SOFT_WARNING' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-input)', padding: 16, borderRadius: 8, border: auditFilter === 'SOFT_WARNING' ? '2px solid var(--warning)' : '1px solid rgba(245, 158, 11, 0.2)', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--warning)' }}>{auditData.stats.soft_warnings}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>SOFT WARNING</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>Low quality / website already inside</div>
              </div>
            </div>

            <div className="audit-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 600 }}>Validator Stream <span style={{ color: 'var(--primary)', fontSize: 12, marginLeft: 8 }}>Filter: {auditFilter.replace('_', ' ')}</span></div>
              <button 
                className="btn btn-primary" 
                onClick={handleCommit}
                disabled={selectedRows.size === 0}
              >
                Commit approved row ({selectedRows.size})
              </button>
            </div>

            <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}><input type="checkbox" checked={auditData.rows.filter((r: any) => r.audit_status !== 'HARD_DUPLICATE').length > 0 && selectedRows.size === (auditData.valid_row_numbers?.length || 0)} onChange={toggleSelectAll} /></th>
                    <th>ROW#</th>
                    <th>BUSINESS EMAIL</th>
                    <th>PHONE</th>
                    <th>BUSINESS NAME</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {auditData.rows
                    .filter((row: any) => auditFilter === 'ALL' || row.audit_status === auditFilter)
                    .slice((auditPage - 1) * 100, auditPage * 100)
                    .map((row: any) => (
                    <tr key={row.row_number}>
                      <td><input type="checkbox" disabled={row.audit_status === 'HARD_DUPLICATE'} checked={selectedRows.has(row.row_number)} onChange={() => toggleRow(row.row_number)} /></td>
                      <td>{row.row_number}</td>
                      <td>{row.business_email || '—'}</td>
                      <td>{row.phone || '—'}</td>
                      <td>{row.business_name || '—'}</td>
                      <td>
                        <span style={{ 
                          color: row.audit_status === 'VALID' ? 'var(--success)' : (row.audit_status === 'HARD_DUPLICATE' ? 'var(--danger)' : 'var(--warning)'),
                          fontWeight: 'bold', fontSize: 11 
                        }}>
                          {row.audit_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <button 
                className="btn btn-secondary" 
                disabled={auditPage === 1}
                onClick={() => setAuditPage(p => p - 1)}
              >
                Previous 100
              </button>
              <div style={{ color: 'var(--text-muted)' }}>
                Showing {(auditPage - 1) * 100 + 1}-{Math.min(auditPage * 100, auditData.rows.length)} of {auditData.stats.total} total rows (Preview limited)
              </div>
              <button 
                className="btn btn-secondary" 
                disabled={auditPage * 100 >= auditData.rows.length}
                onClick={() => setAuditPage(p => p + 1)}
              >
                Next 100
              </button>
            </div>
          </div>
        )}

        {currentStep === 'COMMIT' && (
          <div className="import-commit-step" style={{ textAlign: 'center', padding: '64px 0', position: 'relative' }}>
            {!commitSuccess ? (
              <div>
                <div className="spinner" style={{ margin: '0 auto 24px', width: 40, height: 40, border: '4px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <h3>Committing {selectedRows.size} approved leads indices... ({commitTime}s)</h3>
              </div>
            ) : (
              <div className="success-modal" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 32, maxWidth: 400, margin: '0 auto' }}>
                <h3 style={{ marginBottom: 16 }}>Import Complete! Successfully committed {selectedRows.size} leads.</h3>
                <button className="btn btn-secondary" onClick={handleClose} style={{ width: '100%' }}>Ok</button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default ImportPage;
