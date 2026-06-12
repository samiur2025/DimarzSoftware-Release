import React, { useContext, useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppContext, type PageId } from "../../App";
interface Props {
currentPage: PageId;
showPage: (page: PageId) => void;
visible: boolean;
mobileOpen: boolean;
}
const Icon = ({ path }: { path: React.ReactNode }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {path}
  </svg>
);

const isTauri = () => typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI_IPC__' in window || '__TAURI__' in window);

async function safeInvoke<T>(cmd: string, args?: any): Promise<T> {
  if (isTauri()) {
    return await invoke<T>(cmd, args);
  } else {
    return {} as T;
  }
}

interface FilterOptionCount { value: string; count: number; }
interface FilterCounts {
  total_leads: number;
  country: FilterOptionCount[];
  industry: FilterOptionCount[];
  niche: FilterOptionCount[];
  size: FilterOptionCount[];
  generated: FilterOptionCount[];
  title: FilterOptionCount[];
  city: FilterOptionCount[];
  state: FilterOptionCount[];
}

const formatCount = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
};

const icons = {
  dashboard: <><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></>,
  leads: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></>,
  clients: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>,
  projects: <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></>,
  team: <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></>,
  myTeam: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></>,
  validator: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>,
  summary: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
  import: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  analytics: <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>,
  mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
  script: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>,
  admin: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  settings: <><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></>,
  backup: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></>,
  invoices: <><path d="M4 2v20l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2V2L18 4l-2-2-2 2-2-2-2 2-2-2-2 2Z"></path><line x1="16" y1="8" x2="8" y2="8"></line><line x1="16" y1="12" x2="8" y2="12"></line><line x1="10" y1="16" x2="8" y2="16"></line></>,
  finance: <><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></>
};

const SidebarNav: React.FC<Props> = ({ currentPage, showPage, visible, mobileOpen }) => {
  const { agency, leadsFilters } = useContext(AppContext);
  const [stats, setStats] = useState({ total: 0, countries: 0, industries: 0, niches: 0 });

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await safeInvoke<FilterCounts>("get_filter_counts", { filter: {} });
        if (res && res.country) {
          setStats({
            total: res.total_leads || 0,
            countries: res.country.length || 0,
            industries: res.industry.length || 0,
            niches: res.niche.length || 0
          });
        }
      } catch (e) {
        console.error("Failed to fetch overview stats", e);
      }
    };
    fetchOverview();
  }, [leadsFilters]);

const shortName = agency.name.split(' - ')[0] || agency.name;

if (!visible) return null;
const groups = [
{
title: "Main",
items: [

{ id: "leads" as PageId, icon: <Icon path={icons.leads} />, label: "Leads" },
],
},
{
title: "Management",
items: [
{ id: "clients" as PageId, icon: <Icon path={icons.clients} />, label: "Clients" },
{ id: "projects" as PageId, icon: <Icon path={icons.projects} />, label: "Projects" },
{ id: "finance" as PageId, icon: <Icon path={icons.finance} />, label: "My Finance" },
{ id: "invoices" as PageId, icon: <Icon path={icons.invoices} />, label: "Invoice & Receipt" },
{ id: "myTeam" as PageId, icon: <Icon path={icons.myTeam} />, label: "My Team" },
{ id: "team" as PageId, icon: <Icon path={icons.team} />, label: "Onboarding" },
],
},
{
title: "Tools",
items: [
{ id: "validator" as PageId, icon: <Icon path={icons.validator} />, label: "Lead Validator" },

{ id: "import" as PageId, icon: <Icon path={icons.import} />, label: "Import CSV" },

],
},
{
title: "System",
items: [

{ id: "gformScript" as PageId, icon: <Icon path={icons.script} />, label: "Google Form Script" },
{ id: "admin" as PageId, icon: <Icon path={icons.admin} />, label: "Admin Panel" },
{ id: "backup" as PageId, icon: <Icon path={icons.backup} />, label: "Data Backup" },
{ id: "settings" as PageId, icon: <Icon path={icons.settings} />, label: "Settings" },
],
},
];
return (
<aside className={`sidebar-nav ${mobileOpen ? "open" : ""}`} id="sidebarNav" style={{ display: "flex", width: 260 }}>
<div className="sidebar-nav-header">
<div className="sidebar-nav-title">Navigation</div>
<div className="sidebar-nav-subtitle" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortName} Control Center</div>
</div>
<div className="sidebar-nav-menu">
{groups.map(group => (
<div className="sidebar-nav-group" key={group.title}>
<div className="sidebar-nav-group-title">{group.title}</div>
{group.items.map(item => (
<div
key={item.id}
className={`sidebar-nav-item ${currentPage === item.id ? "active" : ""}`}
data-page={item.id}
onClick={() => showPage(item.id)}
>
<span className="sidebar-nav-icon">{item.icon}</span>
{item.label}
</div>
))}
</div>
))}
</div>
<div className="sidebar-nav-footer">
<div className="stats-card">
<div className="stats-title">Database Overview</div>
<div className="stats-grid">
<div className="stat-item"><div className="stat-value">{formatCount(stats.total)}</div><div className="stat-label">Total Leads</div></div>
<div className="stat-item"><div className="stat-value">{formatCount(stats.countries)}</div><div className="stat-label">Countries</div></div>
<div className="stat-item"><div className="stat-value">{formatCount(stats.industries)}</div><div className="stat-label">Industries</div></div>
<div className="stat-item"><div className="stat-value">{formatCount(stats.niches)}</div><div className="stat-label">Niches</div></div>
</div>
</div>
</div>
</aside>
);
};
export default SidebarNav;
