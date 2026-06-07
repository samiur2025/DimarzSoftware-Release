import React, { useContext, useState, useEffect } from "react";
import { AppContext, type LeadsFilters } from "../../App";
import { invoke } from "@tauri-apps/api/core";
import { useDebouncedCallback } from "use-debounce";

const isTauri = () => typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI_IPC__' in window || '__TAURI__' in window);

async function safeInvoke<T>(cmd: string, args?: any): Promise<T> {
  if (isTauri()) {
    return await invoke<T>(cmd, args);
  } else {
    console.warn(`Tauri is not available. Mocking command: ${cmd}`);
    return {} as T;
  }
}

interface Props { visible: boolean; mobileOpen: boolean; }

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

function formatCount(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

const Icon = ({ path }: { path: React.ReactNode }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{path}</svg>
);

const icons = {
  globe: <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
  city: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></>,
  map: <><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></>,
  factory: <><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></>,
  target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
  bot: <><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></>
};

const SidebarFilter: React.FC<Props> = ({ visible, mobileOpen }) => {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const { leadsFilters, setLeadsFilters, refreshTrigger } = useContext(AppContext);
  const [isFetching, setIsFetching] = useState(false);
  const [filterCounts, setFilterCounts] = useState<FilterCounts>({
    total_leads: 0, country: [], industry: [], niche: [], size: [], generated: [], title: [], city: [], state: []
  });
  
  const fetchFilterCounts = useDebouncedCallback(async (currentFilters: LeadsFilters) => {
    setIsFetching(true);
    try {
      const res = await safeInvoke<FilterCounts>("get_filter_counts", {
        filter: { ...currentFilters, page: 1, page_size: 50 }
      });
      if (res && res.country) setFilterCounts(res);
    } catch (e) {
      console.error("Failed to fetch filter counts", e);
    } finally {
      setIsFetching(false);
    }
  }, 800);

  useEffect(() => {
    fetchFilterCounts(leadsFilters);
  }, [
    leadsFilters.search,
    leadsFilters.countries,
    leadsFilters.industries,
    leadsFilters.niches,
    leadsFilters.sizes,
    leadsFilters.titles,
    leadsFilters.cities,
    leadsFilters.states,
    leadsFilters.generated,
    refreshTrigger
  ]);

  if (!visible) return null;

  const mapToOptions = (items: FilterOptionCount[], prefix: string) =>
    items.map((item, idx) => ({
      id: `${prefix}-${idx}`,
      value: item.value,
      label: item.value,
      count: formatCount(item.count)
    }));

  const hasActiveFilters = Boolean(
    (leadsFilters.search && leadsFilters.search !== "") || 
    (leadsFilters.countries && leadsFilters.countries.length > 0) ||
    (leadsFilters.industries && leadsFilters.industries.length > 0) ||
    (leadsFilters.niches && leadsFilters.niches.length > 0) ||
    (leadsFilters.sizes && leadsFilters.sizes.length > 0) ||
    (leadsFilters.titles && leadsFilters.titles.length > 0) ||
    (leadsFilters.cities && leadsFilters.cities.length > 0) ||
    (leadsFilters.states && leadsFilters.states.length > 0) ||
    (leadsFilters.generated && leadsFilters.generated.length > 0)
  );

  const clearAllFilters = () => {
    setLeadsFilters(prev => ({
      ...prev,
      search: "",
      countries: [],
      industries: [],
      niches: [],
      sizes: [],
      titles: [],
      cities: [],
      states: [],
      generated: []
    }));
    setOpenGroup(null);
  };

  return (
    <aside className={`sidebar-filter ${mobileOpen ? "open" : ""}`} id="sidebarFilter" style={{ display: "flex", width: 260 }}>
      <div className="sidebar-filter-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 2px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filters & Search</span>
          <button 
            onClick={clearAllFilters}
            disabled={!hasActiveFilters}
            style={{ 
              background: hasActiveFilters ? 'linear-gradient(135deg, #2D9596 0%, #1E6667 100%)' : 'var(--bg-secondary)', 
              color: hasActiveFilters ? 'white' : 'var(--text-muted)', 
              border: hasActiveFilters ? '1px solid rgba(45, 149, 150, 0.3)' : 'none', 
              padding: '4px 10px', 
              borderRadius: '6px', 
              fontSize: '11px', 
              fontWeight: 600, 
              cursor: hasActiveFilters ? 'pointer' : 'default',
              opacity: hasActiveFilters ? 1 : 0.6,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Clear all active filters"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
            Reset All
          </button>
        </div>
        <div className="search-box">
          <span className="search-icon">{isFetching ? <div className="spinner" style={{width: 14, height: 14, borderWidth: 2, marginRight: 6}} /> : "🔍"}</span>
          <input type="text" placeholder="Search leads, companies, persons..." id="sidebarSearch"
            value={leadsFilters.search}
            onChange={e => setLeadsFilters(prev => ({ ...prev, search: e.target.value }))} />
        </div>
      </div>

      <div className="filters-section">
        <FilterDropdown title={<><Icon path={icons.globe} /> Country</>}   count={filterCounts.country.length}   options={mapToOptions(filterCounts.country,   'country')}  group="country"   filterKey="countries"  filters={leadsFilters} setFilters={setLeadsFilters} openGroup={openGroup} setOpenGroup={setOpenGroup} />
        <FilterDropdown title={<><Icon path={icons.city} /> City</>}        count={filterCounts.city.length}      options={mapToOptions(filterCounts.city,      'city')}     group="city"      filterKey="cities"     filters={leadsFilters} setFilters={setLeadsFilters} openGroup={openGroup} setOpenGroup={setOpenGroup} />
        <FilterDropdown title={<><Icon path={icons.map} /> State / Region</>} count={filterCounts.state.length}   options={mapToOptions(filterCounts.state,     'state')}    group="state"     filterKey="states"     filters={leadsFilters} setFilters={setLeadsFilters} openGroup={openGroup} setOpenGroup={setOpenGroup} />
        <FilterDropdown title={<><Icon path={icons.factory} /> Industry</>} count={filterCounts.industry.length} options={mapToOptions(filterCounts.industry,  'industry')} group="industry"  filterKey="industries" filters={leadsFilters} setFilters={setLeadsFilters} openGroup={openGroup} setOpenGroup={setOpenGroup} />
        <FilterDropdown title={<><Icon path={icons.target} /> Niche</>}     count={filterCounts.niche.length}    options={mapToOptions(filterCounts.niche,     'niche')}    group="niche"     filterKey="niches"     filters={leadsFilters} setFilters={setLeadsFilters} openGroup={openGroup} setOpenGroup={setOpenGroup} />
        <FilterDropdown title={<><Icon path={icons.users} /> Company Size</>} count={filterCounts.size.length}   options={mapToOptions(filterCounts.size,      'size')}     group="size"      filterKey="sizes"      filters={leadsFilters} setFilters={setLeadsFilters} openGroup={openGroup} setOpenGroup={setOpenGroup} />
        <FilterDropdown title={<><Icon path={icons.briefcase} /> Title</>}  count={filterCounts.title.length}    options={mapToOptions(filterCounts.title,     'title')}    group="title"     filterKey="titles"     filters={leadsFilters} setFilters={setLeadsFilters} openGroup={openGroup} setOpenGroup={setOpenGroup} />
        <FilterDropdown title={<><Icon path={icons.bot} /> Generated Person</>} count={filterCounts.generated.length} options={mapToOptions(filterCounts.generated, 'gen')} group="generated" filterKey="generated" filters={leadsFilters} setFilters={setLeadsFilters} openGroup={openGroup} setOpenGroup={setOpenGroup} />
      </div>

      <div className="sidebar-footer">
        <div className="stats-card">
          <div className="stats-title">Database Overview</div>
          <div className="stats-grid">
            <div className="stat-item"><div className="stat-value">{formatCount(filterCounts.total_leads)}</div><div className="stat-label">Total Leads</div></div>
            <div className="stat-item"><div className="stat-value">{formatCount(filterCounts.country.length)}</div><div className="stat-label">Countries</div></div>
            <div className="stat-item"><div className="stat-value">{formatCount(filterCounts.industry.length)}</div><div className="stat-label">Industries</div></div>
            <div className="stat-item"><div className="stat-value">{formatCount(filterCounts.niche.length)}</div><div className="stat-label">Niches</div></div>
          </div>
        </div>
      </div>
    </aside>
  );
};

const FilterDropdown: React.FC<{
  title: React.ReactNode; count: number;
  options: Array<{ id: string; value: string; label: string; count: string }>;
  group: string; filterKey: keyof LeadsFilters;
  filters: LeadsFilters; setFilters: React.Dispatch<React.SetStateAction<LeadsFilters>>;
  openGroup: string | null; setOpenGroup: (g: string | null) => void;
}> = ({ title, count, options, group, filterKey, filters, setFilters, openGroup, setOpenGroup }) => {
  const [searchText, setSearchText] = React.useState("");
  const open = openGroup === group;
  const activeValues = (filters[filterKey] as string[]) ?? [];
  const hasActive = activeValues.length > 0;
  const filteredOptions = options.filter(opt => opt.label.toLowerCase().includes(searchText.toLowerCase()));

  return (
    <div className="filter-dropdown">
      <div
        className={`filter-dropdown-header ${open ? "active" : ""} ${hasActive ? "has-selection" : ""}`}
        onClick={() => setOpenGroup(open ? null : group)}
      >
        <div className="filter-dropdown-title">
          {title}
          {hasActive && <span className="active-badge">{activeValues.length}</span>}
          <span className="count">{count}</span>
        </div>
        <span className="filter-dropdown-arrow">▼</span>
      </div>
      <div className={`filter-dropdown-body ${open ? "active" : ""}`}>
        <input
          type="text" className="filter-dropdown-search"
          placeholder={`Search ${group}...`}
          value={searchText} onChange={e => setSearchText(e.target.value)}
        />
        <div className="filter-dropdown-options" data-group={group}>
          {filteredOptions.map(opt => (
            <div className="filter-dropdown-option" key={opt.id}>
              <input type="checkbox" id={opt.id} value={opt.value}
                checked={activeValues.includes(opt.value)}
                onChange={e => {
                  setFilters(prev => ({
                    ...prev,
                    [filterKey]: e.target.checked
                      ? [...(prev[filterKey] as string[]), opt.value]
                      : (prev[filterKey] as string[]).filter(x => x !== opt.value)
                  }));
                }} />
              <label htmlFor={opt.id}>{opt.label}</label>
              <span className="count">{opt.count}</span>
            </div>
          ))}
          {filteredOptions.length === 0 && (
            <div style={{ padding: '8px', color: 'var(--text-muted)', fontSize: 11 }}>
              No options match current filters
            </div>
          )}
        </div>
        <div className="filter-dropdown-actions">
          <button onClick={() => setFilters(prev => ({ ...prev, [filterKey]: options.map(o => o.value) }))}>Select All</button>
          <button onClick={() => setFilters(prev => ({ ...prev, [filterKey]: [] }))}>Clear</button>
        </div>
      </div>
    </div>
  );
};

export default SidebarFilter;
