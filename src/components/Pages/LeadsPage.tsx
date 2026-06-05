import React, { useState, useEffect, useContext } from "react";
import { AppContext } from "../../App";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";


// Safe wrapper for Tauri API calls to prevent crashes in regular browsers
const isTauri = () => typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI_IPC__' in window || '__TAURI__' in window);

async function safeInvoke<T>(cmd: string, args?: any): Promise<T> {
  if (isTauri()) {
    return await invoke<T>(cmd, args);
  } else {
    console.warn(`Tauri is not available. Mocking command: ${cmd}`);
    if (cmd === "get_leads") {
      return {
        leads: [
          { id: 1, sl: 1, country: "🇺🇸 USA", industry: "Technology", niche: "SaaS", business_name: "Mock Corp", person_name: "John Doe", title: "CEO", business_email: "test@test.com", phone: "555-0000", city: "SF", state: "CA", status: "New", priority: "High", website: "test.com", revenue: "$1M", size: "1-10", generated_person: "Auto" }
        ],
        total: 1,
        page: 1,
        page_size: 50,
        total_pages: 1
      } as unknown as T;
    }
    if (cmd === "import_leads_csv") {
      return { imported: 1, failed: 0 } as unknown as T;
    }
    return null as unknown as T;
  }
};

interface Props {
  className: string;
}

interface Lead {
  id: number;
  sl: number;
  country: string;
  industry: string;
  niche: string;
  business_name: string;
  person_name: string;
  title: string;
  business_email: string;
  phone: string;
  address?: string;
  city: string;
  state: string;
  person_linkedin?: string;
  company_linkedin?: string;
  personal_email?: string;
  status: string;
  priority: string;
  website: string;
  revenue: string;
  size: string;
  additional_info?: string;
  generated_person: string;
}

// Backend pagination structure
interface PaginatedLeads {
  leads: Lead[];
  total: number;
  db_total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const exportAllColumns = [
  { id: 'country', label: 'COUNTRY' },
  { id: 'industry', label: 'INDUSTRY' },
  { id: 'niche', label: 'NICHE' },
  { id: 'business_name', label: 'BUSINESS NAME' },
  { id: 'website', label: 'WEBSITE' },
  { id: 'person_name', label: 'PERSON NAME' },
  { id: 'title', label: 'TITLE' },
  { id: 'business_email', label: 'BUSINESS EMAIL' },
  { id: 'phone', label: 'PHONE' },
  { id: 'address', label: 'ADDRESS/LOCATION' },
  { id: 'city', label: 'CITY' },
  { id: 'state', label: 'STATE' },
  { id: 'person_linkedin', label: 'PERSON LINKEDIN' },
  { id: 'company_linkedin', label: 'LINKEDIN COMPANY' },
  { id: 'personal_email', label: 'PERSONAL EMAIL' },
  { id: 'revenue', label: 'REVENUE' },
  { id: 'size', label: 'EMPLOYEE SIZE' },
  { id: 'additional_info', label: 'ADDITIONAL INFO' },
  { id: 'generated_person', label: 'GENERATED PERSON' }
];

const LeadsPage: React.FC<Props> = ({ className }) => {
  const { showToast, showPage, leadsFilters, refreshTrigger, triggerRefresh } = useContext(AppContext);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [dbTotal, setDbTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    client: 'All Clients', additionalInfo: '', generatedPerson: '', country: '',
    stateRegion: '', city: '', industry: '', role: '', status: 'All Statuses', quantity: ''
  });
  const [exportColumns, setExportColumns] = useState<Set<string>>(new Set(exportAllColumns.map(c => c.id)));

  const handleOpenExportModal = () => {
    setExportFilters(prev => ({
      ...prev,
      country: leadsFilters.countries?.join(', ') || '',
      stateRegion: leadsFilters.states?.join(', ') || '',
      city: leadsFilters.cities?.join(', ') || '',
      industry: leadsFilters.industries?.join(', ') || '',
      role: leadsFilters.titles?.join(', ') || '',
      status: leadsFilters.statuses?.length ? leadsFilters.statuses.join(', ') : 'All Statuses',
      generatedPerson: leadsFilters.generated?.join(', ') || '',
    }));
    setShowExportModal(true);
  };

  useEffect(() => {
    fetchLeads();
  }, [page, pageSize, leadsFilters, refreshTrigger]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      if (!isTauri()) {
        const queryParams = new URLSearchParams({
          page: page.toString(),
          page_size: pageSize.toString(),
          filters: JSON.stringify(leadsFilters)
        });

        const response = await fetch(`http://127.0.0.1:4321/api/leads?${queryParams.toString()}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const res = await response.json();
        setLeads(res.leads);
        setTotalLeads(res.total);
        setTotalPages(res.total_pages);
      } else {
        const res = await safeInvoke<PaginatedLeads>("get_leads", {
          filter: {
            ...leadsFilters,
            page,
            page_size: pageSize
          }
        });
        if (res) {
          setLeads(res.leads);
          setTotalLeads(res.total);
          setDbTotal(res.db_total ?? res.total);
          setTotalPages(res.total_pages);
        }
      }
    } catch (e) {
      showToast(`Error loading leads: ${e}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const start = totalLeads > 0 ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, totalLeads);
  const visibleLeads = leads;

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleLeads.map(l => l.id)));
    }
    setSelectAll(!selectAll);
  };

  const toggleLead = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selected.size} lead(s)? This cannot be undone.`)) return;
    try {
      await safeInvoke("delete_forever_cmd", { ids: Array.from(selected) });
      showToast(`${selected.size} lead(s) deleted permanently`, "success");
      setSelected(new Set());
      setSelectAll(false);
      triggerRefresh();
    } catch (e) {
      console.error(e);
      showToast(`Failed to delete leads: ${e}`, "error");
    }
  };

  const handleExport = async () => {
    try {
      const payload = {
        ids: selected.size > 0 ? Array.from(selected) : null,
        client: exportFilters.client,
        additional_info: exportFilters.additionalInfo,
        generated_person: exportFilters.generatedPerson,
        country: exportFilters.country,
        state: exportFilters.stateRegion,
        city: exportFilters.city,
        industry: exportFilters.industry,
        title: exportFilters.role,
        status: exportFilters.status,
        limit: exportFilters.quantity,

        filter_search: leadsFilters.search,
        filter_countries: leadsFilters.countries,
        filter_industries: leadsFilters.industries,
        filter_niches: leadsFilters.niches,
        filter_statuses: leadsFilters.statuses,
        filter_priorities: leadsFilters.priorities,
        filter_sizes: leadsFilters.sizes,
        filter_titles: leadsFilters.titles,
        filter_cities: leadsFilters.cities,
        filter_states: leadsFilters.states,
        filter_generated: leadsFilters.generated,

        columns: Array.from(exportColumns)
      };

      if (!isTauri()) {
        showToast("Exporting leads from development server...", "info");
        try {
          const response = await fetch('http://127.0.0.1:4321/api/leads/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error('Network response was not ok');
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'dimrz_leads_export.csv';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          showToast("Leads exported successfully!", "success");
          setShowExportModal(false);
        } catch (err) {
          showToast(`Export failed: ${err}`, "error");
        }
        return;
      }
      const path = await save({
        filters: [{ name: "CSV", extensions: ["csv"] }],
        defaultPath: "dimrz_leads_export.csv"
      });
      if (path) {
        showToast("Exporting leads to CSV...", "info");
        await safeInvoke("export_leads_csv", {
          filePath: path,
          filter: payload
        });
        showToast("Leads exported successfully!", "success");
        setShowExportModal(false);
      }
    } catch (e) {
      showToast(`Export failed: ${e}`, "error");
    }
  };

  const handleImport = () => {
    showPage("import");
  };



  return (
    <div className={className} id="leadsPage">

      {/* ── Stats Cards ── */}
      <div className="leads-stat-cards">
        <div className="leads-stat-card leads-stat-card--dark">
          <div className="lsc-number">{dbTotal.toLocaleString()}</div>
          <div className="lsc-label">DATABASE TOTAL</div>
        </div>
        <div className="leads-stat-card leads-stat-card--blue">
          <div className="lsc-number">{totalLeads.toLocaleString()} <span className="lsc-sub">Leads</span></div>
          <div className="lsc-label">MATCHED SEARCH</div>
        </div>
        <div className="leads-stat-card leads-stat-card--orange">
          <div className="lsc-number">{totalPages.toLocaleString()}</div>
          <div className="lsc-label">TOTAL PAGES</div>
        </div>
      </div>

      <div className="content-header">
        <div className="header-left">
          <h1 className="page-title">All Prospects</h1>
          <span className="total-count">Total: <strong>{totalLeads.toLocaleString()}</strong> leads {selected.size > 0 && `| ${selected.size} selected`}</span>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => triggerRefresh()} title="Force Refresh Data">
            🔄 Refresh
          </button>
          <button className="btn btn-secondary" onClick={() => {
            if (selected.size === visibleLeads.length && visibleLeads.length > 0) {
              setSelected(new Set());
              setSelectAll(false);
            } else {
              setSelected(new Set(visibleLeads.map(l => l.id)));
              setSelectAll(true);
            }
          }}>
            <span>{selected.size > 0 ? "✕" : "☐"}</span> {selected.size > 0 ? "Clear Selection" : "Select All"}
          </button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={selected.size === 0}>
            <span>🗑</span> Delete
          </button>
          <button className="btn btn-secondary" onClick={handleOpenExportModal}>
            <span>📤</span> Export CSV
          </button>
          <button className="btn btn-primary" onClick={handleImport}>
            <span>📥</span> Import Leads
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table" id="leadsTable">
          <thead>
            <tr>
              <th style={{ width: 40 }}><input type="checkbox" className="table-checkbox" checked={selectAll} onChange={toggleSelectAll} /></th>
              <th style={{ width: 40 }}>#</th>
              <th style={{ width: 100 }}>Country</th>
              <th>Industry</th>
              <th>Niche</th>
              <th>Business Name</th>
              <th>Website</th>
              <th>Person Name</th>
              <th>Title</th>
              <th>Business Email</th>
              <th>Phone</th>
              <th>Address</th>
              <th>City</th>
              <th>State</th>
              <th>Person LinkedIn</th>
              <th>Company LinkedIn</th>
              <th>Personal Email</th>
              <th>Revenue</th>
              <th>Size</th>
              <th>Additional Info</th>
              <th>Generated Person</th>
              <th style={{ width: 80 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleLeads.map((lead, idx) => (
              <tr key={lead.id}>
                <td><input type="checkbox" className="table-checkbox" checked={selected.has(lead.id)} onChange={() => toggleLead(lead.id)} /></td>
                <td><span className="sl-number">{((page - 1) * pageSize + idx + 1).toString().padStart(2, "0")}</span></td>
                <td>{lead.country}</td>
                <td><span className="industry-badge">{lead.industry}</span></td>
                <td><span className="niche-tag">{lead.niche}</span></td>
                <td>{lead.business_name}</td>
                <td>{lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer" className="website-link">{lead.website.replace("https://www.", "")}</a>}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="assigned-avatar">{lead.person_name ? lead.person_name.charAt(0) : "?"}</div>
                    {lead.person_name}
                  </div>
                </td>
                <td style={{ fontStyle: "italic", color: "var(--text-muted)" }}>{lead.title}</td>
                <td><a href={`mailto:${lead.business_email}`} className="email-link">{lead.business_email}</a></td>
                <td className="phone-cell">{lead.phone}</td>
                <td>{lead.address || "-"}</td>
                <td>{lead.city}</td>
                <td>{lead.state}</td>
                <td>{lead.person_linkedin ? <a href={lead.person_linkedin} target="_blank" rel="noopener noreferrer" className="linkedin-link">LinkedIn</a> : "-"}</td>
                <td>{lead.company_linkedin ? <a href={lead.company_linkedin} target="_blank" rel="noopener noreferrer" className="linkedin-link">LinkedIn</a> : "-"}</td>
                <td>{lead.personal_email ? <a href={`mailto:${lead.personal_email}`} className="email-link">{lead.personal_email}</a> : "-"}</td>
                <td><span className="revenue">{lead.revenue}</span></td>
                <td><span className="size-badge">{lead.size}</span></td>
                <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }} title={lead.additional_info}>{lead.additional_info || "-"}</td>
                <td><span className={`generated-badge ${lead.generated_person === "Manual" ? "manual" : ""}`}>{lead.generated_person}</span></td>
                <td>
                  <div className="action-btns">
                    <button className="action-btn edit" title="Edit" onClick={() => showToast("Edit lead: " + lead.business_name, "info")}>✎</button>
                    <button className="action-btn delete" title="Delete" onClick={() => { setSelected(new Set([lead.id])); handleDelete(); }}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <div className="pagination-info">Showing <strong>{start}-{end}</strong> of <strong>{totalLeads.toLocaleString()}</strong></div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <select className="page-size-select" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
            <option value={15}>15</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <div className="pagination-controls">
            <button className="page-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
            <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            {(() => {
              const pages: number[] = [];
              let start = Math.max(1, page - 2);
              const end = Math.min(start + 4, totalPages);
              start = Math.max(1, end - 4);
              for (let p = start; p <= end; p++) pages.push(p);
              return pages.map(p => (
                <button key={p} className={`page-btn ${p === page ? "active" : ""}`} onClick={() => setPage(p)}>{p}</button>
              ));
            })()}
            <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>›</button>
            <button className="page-btn" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>»</button>
          </div>
        </div>
      </div>

      {showExportModal && (() => {
        const renderCountBadge = (val: string, ignoreVal?: string) => {
          if (!val) return null;
          if (ignoreVal && val === ignoreVal) return null;
          const count = val.split(',').filter(s => s.trim().length > 0).length;
          if (count > 0) return <span className="export-filter-count">{count}</span>;
          return null;
        };

        return (
          <div className="modal-overlay active" style={{ zIndex: 10000 }}>
          <div className="export-modal-card">
            <div className="export-modal-header">
              <h2 className="export-modal-title">Create Filter and Export</h2>
              <span className="export-modal-close" onClick={() => setShowExportModal(false)}>✕</span>
            </div>
            <div className="export-modal-body">
              <div className="export-filter-section">
                <div className="export-section-title">Filter Set</div>
                <div className="export-filter-list">
                  <div className="export-filter-item">
                    <label>Client {renderCountBadge(exportFilters.client, 'All Clients')}</label>
                    <select value={exportFilters.client} onChange={e => setExportFilters({...exportFilters, client: e.target.value})}>
                      <option>All Clients</option>
                      <option>Client A</option>
                      <option>Client B</option>
                    </select>
                  </div>
                  <div className="export-filter-item">
                    <label>Additional Info {renderCountBadge(exportFilters.additionalInfo)}</label>
                    <input type="text" placeholder="e.g. Special Request" value={exportFilters.additionalInfo} onChange={e => setExportFilters({...exportFilters, additionalInfo: e.target.value})} />
                  </div>
                  <div className="export-filter-item">
                    <label>Generated Person {renderCountBadge(exportFilters.generatedPerson)}</label>
                    <input type="text" placeholder="e.g. Freelancer Name" value={exportFilters.generatedPerson} onChange={e => setExportFilters({...exportFilters, generatedPerson: e.target.value})} />
                  </div>
                  <div className="export-filter-item">
                    <label>Country {renderCountBadge(exportFilters.country)}</label>
                    <input type="text" placeholder="e.g. United States" value={exportFilters.country} onChange={e => setExportFilters({...exportFilters, country: e.target.value})} />
                  </div>
                  <div className="export-filter-item">
                    <label>State / Region {renderCountBadge(exportFilters.stateRegion)}</label>
                    <input type="text" placeholder="e.g. New York" value={exportFilters.stateRegion} onChange={e => setExportFilters({...exportFilters, stateRegion: e.target.value})} />
                  </div>
                  <div className="export-filter-item">
                    <label>City {renderCountBadge(exportFilters.city)}</label>
                    <input type="text" placeholder="e.g. Austin" value={exportFilters.city} onChange={e => setExportFilters({...exportFilters, city: e.target.value})} />
                  </div>
                  <div className="export-filter-item">
                    <label>Industry {renderCountBadge(exportFilters.industry)}</label>
                    <input type="text" placeholder="e.g. Technology" value={exportFilters.industry} onChange={e => setExportFilters({...exportFilters, industry: e.target.value})} />
                  </div>
                  <div className="export-filter-item">
                    <label>Role (Title) {renderCountBadge(exportFilters.role)}</label>
                    <input type="text" placeholder="e.g. CEO" value={exportFilters.role} onChange={e => setExportFilters({...exportFilters, role: e.target.value})} />
                  </div>
                  <div className="export-filter-item">
                    <label>Total Filtered Leads</label>
                    <input type="text" value={selected.size > 0 ? selected.size.toLocaleString() : totalLeads.toLocaleString()} readOnly style={{ color: 'var(--success)', fontWeight: 'bold', backgroundColor: 'rgba(34, 197, 94, 0.05)' }} />
                  </div>
                  <div className="export-filter-item">
                    <label>Quantity of Leads {exportFilters.quantity ? <span className="export-filter-count">1</span> : null}</label>
                    <input type="number" className="export-quantity-input" min="1" placeholder="e.g. 500" value={exportFilters.quantity} onChange={e => setExportFilters({...exportFilters, quantity: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="export-data-section">
                <div className="export-section-title">Data Set</div>
                <div className="export-data-list">
                  {exportAllColumns.map(col => (
                    <div className="export-data-item" key={col.id} onClick={() => {
                      const next = new Set(exportColumns);
                      if (next.has(col.id)) next.delete(col.id);
                      else next.add(col.id);
                      setExportColumns(next);
                    }}>
                      <label>{col.label}</label>
                      <input type="checkbox" checked={exportColumns.has(col.id)} readOnly />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="export-modal-footer">
              <button className="btn-export" onClick={handleExport}>Set and Export</button>
            </div>
          </div>
          </div>
        );
      })()}
    </div>
  );
};

export default LeadsPage;
