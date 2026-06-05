use serde::{Deserialize, Serialize};
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Lead {
    pub id: i64,
    pub sl: i64,
    pub country: String,
    pub industry: String,
    pub niche: String,
    pub business_name: String,
    pub person_name: String,
    pub title: String,
    pub business_email: String,
    pub phone: String,
    pub address: String,
    pub city: String,
    pub state: String,
    pub website: String,
    pub person_linkedin: String,
    pub company_linkedin: String,
    pub personal_email: String,
    pub revenue: String,
    pub size: String,
    pub additional_info: String,
    pub generated_person: String,
    pub status: String,
    pub priority: String,
    pub source: String,
    pub last_contact: String,
    pub assigned_to: String,
}
#[derive(Serialize, Deserialize)]
pub struct LeadFilter {
    pub search: Option<String>,
    #[serde(rename = "countries")]
    pub country: Option<Vec<String>>,
    #[serde(rename = "industries")]
    pub industry: Option<Vec<String>>,
    #[serde(rename = "niches")]
    pub niche: Option<Vec<String>>,
    #[serde(rename = "statuses")]
    pub status: Option<Vec<String>>,
    #[serde(rename = "priorities")]
    pub priority: Option<Vec<String>>,
    #[serde(rename = "sizes")]
    pub size: Option<Vec<String>>,
    #[serde(rename = "titles")]
    pub title: Option<Vec<String>>,
    #[serde(rename = "cities")]
    pub city: Option<Vec<String>>,
    #[serde(rename = "states")]
    pub state: Option<Vec<String>>,
    #[serde(rename = "generated")]
    pub generated_person: Option<Vec<String>>,
    pub page: i64,
    pub page_size: i64,
}
#[derive(Serialize, Deserialize)]
pub struct PaginatedLeads {
    pub leads: Vec<Lead>,
    pub total: i64,
    pub db_total: i64,
    pub page: i64,
    pub page_size: i64,
    pub total_pages: i64,
}

#[derive(Serialize, Deserialize)]
pub struct FilterOptionCount {
    pub value: String,
    pub count: i64,
}

#[derive(Serialize, Deserialize)]
pub struct FilterCounts {
    pub total_leads: i64,
    pub country: Vec<FilterOptionCount>,
    pub industry: Vec<FilterOptionCount>,
    pub niche: Vec<FilterOptionCount>,
    pub size: Vec<FilterOptionCount>,
    pub generated: Vec<FilterOptionCount>,
    pub title: Vec<FilterOptionCount>,
    pub city: Vec<FilterOptionCount>,
    pub state: Vec<FilterOptionCount>,
}
#[derive(Serialize, Deserialize, Clone)]
pub struct ImportResult {
    pub imported: i64,
    pub failed: i64,
    pub errors: Vec<String>,
}
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AuditStats {
    pub total: i64,
    pub valid: i64,
    pub hard_duplicates: i64,
    pub soft_warnings: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AuditRow {
    pub row_number: i64,
    pub business_email: String,
    pub phone: String,
    pub business_name: String,
    pub country: String,
    pub industry: String,
    pub niche: String,
    pub person_name: String,
    pub title: String,
    pub address: String,
    pub city: String,
    pub state: String,
    pub website: String,
    pub person_linkedin: String,
    pub company_linkedin: String,
    pub personal_email: String,
    pub revenue: String,
    pub size: String,
    pub additional_info: String,
    pub generated_person: String,
    pub status_field: String,
    pub priority: String,
    pub audit_status: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AuditResult {
    pub rows: Vec<AuditRow>,
    pub stats: AuditStats,
    pub valid_row_numbers: Vec<i64>,
}

#[derive(Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_leads: i64,
    pub new_this_week: i64,
    pub conversion_rate: f64,
    pub revenue_potential: String,
    pub top_industries: Vec<IndustryStat>,
    pub recent_activity: Vec<Activity>,
}
#[derive(Serialize, Deserialize)]
pub struct IndustryStat {
    pub name: String,
    pub count: i64,
    pub percentage: f64,
}
#[derive(Serialize, Deserialize)]
pub struct Activity {
    pub action: String,
    pub details: String,
    pub timestamp: String,
}
#[derive(Serialize, Deserialize)]
pub struct DatabaseStats {
    pub total_leads: i64,
    pub total_countries: i64,
    pub total_industries: i64,
    pub total_niches: i64,
    pub database_size_mb: f64,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Client {
    pub id: i64,
    pub name: String,
    pub email: Option<String>,
    pub website: Option<String>,
    pub linkedin: Option<String>,
    pub country: Option<String>,
    pub source: String,
    pub industry: String,
    pub retainer: f64,
    pub status: String,
}
#[derive(Serialize, Deserialize)]
pub struct ClientStats {
    pub active_projects: i64,
    pub completed_projects: i64,
    pub total_invoiced: f64,
    pub total_paid: f64,
    pub total_due: f64,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub client_id: Option<i64>,
    pub project_type: String,
    pub source: String,
    pub ops_sheet: Option<String>,
    pub delivery_url: Option<String>,
    pub deadline: Option<String>,
    pub value: f64,
    pub invoiced: f64,
    pub paid: f64,
    pub target: i64,
    pub status: String,
    pub progress: i64,
    pub notes: Option<String>,
}
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TeamMember {
    pub id: i64,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub whatsapp: Option<String>,
    pub linkedin: Option<String>,
    pub category: String,
    pub address: Option<String>,
    pub status: String,
    pub submitted_date: Option<String>,
}
#[derive(Serialize, Deserialize)]
pub struct ActivationRequest {
    pub license_key: String,
    pub device_code: String,
}
#[derive(Serialize, Deserialize)]
pub struct ActivationResponse {
    pub status: String,
    pub token: Option<String>,
    pub message: Option<String>,
}
#[derive(Serialize, Deserialize)]
pub struct StoredLicense {
    pub license_key: String,
    pub hardware_id_hash: String,
    pub activation_token: String,
    pub activated_at: String,
    pub expires_at: Option<String>,
}
