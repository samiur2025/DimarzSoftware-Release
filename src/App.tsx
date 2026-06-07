import React, { useState, useEffect, useCallback } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import TopNav from "./components/Layout/TopNav";
import SidebarNav from "./components/Layout/SidebarNav";
import SidebarFilter from "./components/Layout/SidebarFilter";
import LoadingOverlay from "./components/Common/LoadingOverlay";
import ToastContainer from "./components/Common/ToastContainer";
import ActivationScreen from "./components/License/ActivationScreen";
import LoginPage from "./components/Pages/LoginPage";

import LeadsPage from "./components/Pages/LeadsPage";

import ClientsPage from "./components/Pages/ClientsPage";
import ProjectsPage from "./components/Pages/ProjectsPage";
import TeamPage from "./components/Pages/TeamPage";
import MyTeamPage from "./components/Pages/MyTeamPage";
import ImportPage from "./components/Pages/ImportPage";
import ValidatorPage from "./components/Pages/ValidatorPage";
import GoogleFormScriptPage from "./components/Pages/GoogleFormScriptPage";
import SettingsPage from "./components/Pages/SettingsPage";
import AdminPage from "./components/Pages/AdminPage";
import PlaceholderPage from "./components/Pages/PlaceholderPage";
import BackupPage from "./components/Pages/BackupPage";
import InvoicesPage from "./components/Pages/InvoicesPage";

export type PageId =
  | "leads" | "clients" | "projects" | "invoices"
  | "team" | "myTeam" | "import" | "validator" | "leadSummary" | "mailServer"
  | "admin" | "gformScript" | "settings" | "backup";

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export interface AgencyInfo {
  name: string;
  location: string;
  email: string;
  website: string;
}

export interface LeadsFilters {
  search: string;
  countries: string[];
  industries: string[];
  niches: string[];
  sizes: string[];
  generated: string[];
  statuses: string[];
  priorities: string[];
  titles: string[];
  cities: string[];
  states: string[];
}

export const defaultLeadsFilters: LeadsFilters = {
  search: "",
  countries: [],
  industries: [],
  niches: [],
  sizes: [],
  generated: [],
  statuses: [],
  priorities: [],
  titles: [],
  cities: [],
  states: []
};

export const AppContext = React.createContext<{
  currentPage: PageId;
  showPage: (page: PageId) => void;
  toasts: Toast[];
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  agency: AgencyInfo;
  setAgency: (agency: AgencyInfo) => void;
  leadsFilters: LeadsFilters;
  setLeadsFilters: React.Dispatch<React.SetStateAction<LeadsFilters>>;
  refreshTrigger: number;
  triggerRefresh: () => void;
  logout: () => void;
}>({
  currentPage: "leads",
  showPage: () => {},
  toasts: [],
  showToast: () => {},
  loading: false,
  setLoading: () => {},
  agency: { name: "Dimrz - Digital Marketing Zone", location: "Dhaka, Bangladesh", email: "contact@dimrz.com", website: "https://dimrz.com" },
  setAgency: () => {},
  leadsFilters: defaultLeadsFilters,
  setLeadsFilters: () => {},
  refreshTrigger: 0,
  triggerRefresh: () => {},
  logout: () => {},
});

const App: React.FC = () => {
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<PageId>("leads");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [agency, setAgency] = useState<AgencyInfo>({ name: "Dimrz - Digital Marketing Zone", location: "Dhaka, Bangladesh", email: "contact@dimrz.com", website: "https://dimrz.com" });
  const [leadsFilters, setLeadsFilters] = useState<LeadsFilters>(defaultLeadsFilters);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [initProgress, setInitProgress] = useState("Initializing system...");

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);



  useEffect(() => {
    let unlistenProgress: UnlistenFn | null = null;
    listen<string>("init-progress", (event) => {
      setInitProgress(event.payload);
    }).then(un => unlistenProgress = un);

    invoke("initialize_app")
      .then(() => {
        setIsActivated(true);
        setTimeout(() => invoke("close_splashscreen"), 500); // 500ms delay for smooth transition
      })
      .catch((e) => {
        console.error("App init error:", e);
        if (e === "INVALID_LICENSE") {
          setIsActivated(false);
          invoke("close_splashscreen");
        } else if (import.meta.env.DEV) {
          // Dev mode fallback
          setIsActivated(true);
          invoke("close_splashscreen");
        }
      });

    const storedAgency = localStorage.getItem("dimrz_settings_agency");
    if (storedAgency) {
      setAgency(JSON.parse(storedAgency));
    }
    
    // Check if app lock is enabled
    const hasAppLock = localStorage.getItem("dimrz_app_lock_password");
    if (!hasAppLock) {
      setIsAuthenticated(true);
    }

    return () => {
      if (unlistenProgress) unlistenProgress();
    };
  }, []);

  const showPage = useCallback((page: PageId) => {
    setCurrentPage(page);
    setMobileSidebarOpen(false);
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const logout = useCallback(() => {
    const hasAppLock = localStorage.getItem("dimrz_app_lock_password");
    if (hasAppLock) {
      setIsAuthenticated(false);
    } else {
      showToast("No lock password is set. Go to Settings to set one.", "info");
    }
  }, [showToast]);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<any>("leads-auto-imported", (event) => {
      const imported = event.payload?.imported || 0;
      const failed = event.payload?.failed || 0;
      
      if (imported > 0) {
        showToast(`Successfully auto-imported ${imported} leads from background.`, "success");
        if (failed > 0) {
          showToast(`${failed} rows were invalid and skipped.`, "error");
        }
        triggerRefresh();
      } else if (failed > 0) {
        showToast(`Failed to import CSV. All ${failed} rows were invalid. File moved to failed folder.`, "error");
      }
    }).then(un => unlisten = un);

    return () => {
      if (unlisten) unlisten();
    };
  }, [showToast, triggerRefresh]);

  const handleActivated = () => {
    setIsActivated(null);
    setInitProgress("Initializing database...");
    
    invoke("initialize_app")
      .then(() => {
        setIsActivated(true);
        showToast("License activated successfully", "success");
      })
      .catch((e) => {
        console.error("App init error after activation:", e);
        setIsActivated(false);
        showToast("Failed to initialize system after activation.", "error");
      });
  };

  if (isActivated === null) {
    return (
      <div className="activation-screen" style={{ flexDirection: "column", gap: "1rem" }}>
        <div className="spinner" />
        <p style={{ color: "#a1a1aa", fontSize: "0.9rem", marginTop: 10 }}>{initProgress}</p>
      </div>
    );
  }

  if (!isActivated) {
    return <ActivationScreen onActivated={handleActivated} />;
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  const isFilterPage = currentPage === "leads";

  return (
    <AppContext.Provider value={{ currentPage, showPage, toasts, showToast, loading, setLoading, agency, setAgency, leadsFilters, setLeadsFilters, refreshTrigger, triggerRefresh, logout }}>
      <LoadingOverlay active={loading} />
      <ToastContainer toasts={toasts} />

      <TopNav
        currentPage={currentPage}
        showPage={showPage}
        onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />

      <div className="main-container">
        <SidebarNav
          currentPage={currentPage}
          showPage={showPage}
          visible={!isFilterPage}
          mobileOpen={mobileSidebarOpen}
        />
        <SidebarFilter
          visible={isFilterPage}
          mobileOpen={mobileSidebarOpen}
        />

        <div className="content-area">

          <LeadsPage className={currentPage === "leads" ? "page-block active" : "page-block"} />

          <ClientsPage className={currentPage === "clients" ? "page-block active" : "page-block"} />
          <ProjectsPage className={currentPage === "projects" ? "page-block active" : "page-block"} />
          <InvoicesPage className={currentPage === "invoices" ? "page-block active" : "page-block"} />
          <TeamPage className={currentPage === "team" ? "page-block active" : "page-block"} />
          <MyTeamPage className={currentPage === "myTeam" ? "page-block active" : "page-block"} />
          <ImportPage className={currentPage === "import" ? "page-block active" : "page-block"} />
          <ValidatorPage className={currentPage === "validator" ? "page-block active" : "page-block"} />
          <PlaceholderPage id="leadSummaryPage" className={currentPage === "leadSummary" ? "page-block active" : "page-block"} icon="📈" title="Summary" subtitle="Advanced analytics module coming soon." />
          <PlaceholderPage id="mailServerPage" className={currentPage === "mailServer" ? "page-block active" : "page-block"} icon="📧" title="Mail" subtitle="SMTP configuration module coming soon." />
          <AdminPage className={currentPage === "admin" ? "page-block active" : "page-block"} />

          <GoogleFormScriptPage className={currentPage === "gformScript" ? "page-block active" : "page-block"} />
          <SettingsPage className={currentPage === "settings" ? "page-block active" : "page-block"} />
          <BackupPage className={currentPage === "backup" ? "page-block active" : "page-block"} />
        </div>
      </div>
    </AppContext.Provider>
  );
};

export default App;
