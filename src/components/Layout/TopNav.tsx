import React, { useContext } from "react";
import { AppContext, type PageId } from "../../App";
interface Props {
currentPage: PageId;
showPage: (page: PageId) => void;
onMenuToggle: () => void;
}
const TopNav: React.FC<Props> = ({ currentPage, showPage, onMenuToggle }) => {
const { agency, triggerRefresh } = useContext(AppContext);
const shortName = agency.name.split(' - ')[0] || agency.name;
const initials = shortName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || 'DZ';

const Icon = ({ path }: { path: React.ReactNode }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {path}
  </svg>
);

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
  list: <><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>
};
const navItems: { id: PageId; label: string; icon: React.ReactNode }[] = [

{ id: "leads", label: "Leads", icon: <Icon path={icons.leads} /> },
{ id: "clients", label: "Clients", icon: <Icon path={icons.clients} /> },
{ id: "projects", label: "Projects", icon: <Icon path={icons.projects} /> },
{ id: "team", label: "Onboarding", icon: <Icon path={icons.team} /> },
{ id: "myTeam", label: "My Team", icon: <Icon path={icons.myTeam} /> },
];
const dropdownItems: { id: PageId; label: string; icon: React.ReactNode }[] = [
{ id: "validator", label: "Lead Validator", icon: <Icon path={icons.validator} /> },

{ id: "admin", label: "Admin Panel", icon: <Icon path={icons.admin} /> },
{ id: "import", label: "Import CSV", icon: <Icon path={icons.import} /> },

{ id: "gformScript", label: "Google Form Script", icon: <Icon path={icons.script} /> },
{ id: "settings", label: "Settings", icon: <Icon path={icons.settings} /> },
];
return (
<nav className="top-nav">
<div style={{ display: "flex", alignItems: "center" }}>
<button className="menu-toggle" onClick={onMenuToggle}>☰</button>
<div className="logo-section">
<div className="logo-icon">{initials}</div>
<div className="logo-text" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "120px" }}>{shortName}</div>
</div>
</div>
<div className="nav-menu">
{navItems.map(item => (
<div
key={item.id}
className={`nav-item ${currentPage === item.id ? "active" : ""}`}
onClick={() => showPage(item.id)}
data-page={item.id}
>
<span>{item.icon}</span> {item.label}
</div>
))}
<div className="nav-dropdown">
<div className="nav-item"><span><Icon path={icons.list} /></span> ▾</div>
<div className="nav-dropdown-menu">
{dropdownItems.map(item => (
<div
key={item.id}
className="nav-dropdown-item"
onClick={() => showPage(item.id)}
>
<span>{item.icon}</span> {item.label}
</div>
))}
</div>
</div>
</div>
<div className="nav-right">
<button className="notification-btn" onClick={() => triggerRefresh()} title="Force Refresh Data" style={{ marginRight: 8 }}>
<span>🔄</span>
</button>
<button className="notification-btn">
<span>🔔</span>
<span className="badge">3</span>
</button>
<div className="user-profile">
<div className="user-avatar">AD</div>
<div className="user-info">
<span className="user-name">Admin {shortName}</span>
<span className="user-role">{agency.location}</span>
</div>
</div>
</div>
</nav>
);
};
export default TopNav;
