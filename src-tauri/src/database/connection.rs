use crate::models::*;
use duckdb::{params, Connection};

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(path: &str) -> Result<Self, String> {
        let conn = Connection::open(path).map_err(|e| e.to_string())?;
        
        conn.execute_batch("
            PRAGMA memory_limit = '4GB';
            PRAGMA threads = 8;
            PRAGMA enable_progress_bar = false;
        ").map_err(|e| format!("Failed to set pragmas: {}", e))?;

        let db = Self { conn };
        db.init_tables()?;
        Ok(db)
    }

    pub fn try_clone(&self) -> Result<Self, String> {
        let conn = self.conn.try_clone().map_err(|e| e.to_string())?;
        Ok(Self { conn })
    }

    fn init_tables(&self) -> Result<(), String> {
        if let Err(e) = self.conn.execute_batch(
            "
            CREATE SEQUENCE IF NOT EXISTS leads_seq;
            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY DEFAULT nextval('leads_seq'),
                sl INTEGER UNIQUE,
                country TEXT,
                industry TEXT,
                niche TEXT,
                business_name TEXT,
                person_name TEXT,
                title TEXT,
                business_email TEXT,
                phone TEXT,
                address TEXT,
                city TEXT,
                state TEXT,
                website TEXT,
                person_linkedin TEXT,
                company_linkedin TEXT,
                personal_email TEXT,
                revenue TEXT,
                size TEXT,
                additional_info TEXT,
                generated_person TEXT DEFAULT 'Auto',
                status TEXT DEFAULT 'New',
                priority TEXT DEFAULT 'Medium',
                source TEXT,
                last_contact TEXT,
                assigned_to TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_deleted BOOLEAN DEFAULT false,
                facebook_url TEXT,
                instagram_url TEXT
            );
            CREATE SEQUENCE IF NOT EXISTS clients_seq;
            CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY DEFAULT nextval('clients_seq'),
                name TEXT NOT NULL,
                email TEXT,
                website TEXT,
                linkedin TEXT,
                country TEXT,
                source TEXT,
                industry TEXT,
                retainer REAL DEFAULT 0,
                status TEXT DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE SEQUENCE IF NOT EXISTS projects_seq;
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY DEFAULT nextval('projects_seq'),
                name TEXT NOT NULL,
description TEXT,
client_id INTEGER,
type TEXT,
source TEXT,
ops_sheet TEXT,
delivery_url TEXT,
deadline TEXT,
value REAL DEFAULT 0,
invoiced REAL DEFAULT 0,
paid REAL DEFAULT 0,
target INTEGER DEFAULT 0,
status TEXT DEFAULT 'pending',
progress INTEGER DEFAULT 0,
notes TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
            CREATE SEQUENCE IF NOT EXISTS team_members_seq;
            CREATE TABLE IF NOT EXISTS team_members (
                id INTEGER PRIMARY KEY DEFAULT nextval('team_members_seq'),
                name TEXT NOT NULL,
email TEXT,
phone TEXT,
whatsapp TEXT,
linkedin TEXT,
category TEXT,
address TEXT,
status TEXT DEFAULT 'new',
submitted_date TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
",
        ) {
            log::warn!("Failed to initialize batch tables: {}", e);
        }

        // Check if is_deleted column exists. If not, add it.
        let mut col_exists = false;
        if let Ok(mut stmt) = self.conn.prepare("SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'is_deleted'") {
            col_exists = stmt.exists([]).unwrap_or(false);
        }

        if !col_exists {
            if let Err(e) = self.conn.execute(
                "ALTER TABLE leads ADD COLUMN is_deleted BOOLEAN DEFAULT false",
                [],
            ) {
                log::warn!("Failed to add is_deleted column: {}", e);
            }
            if let Err(e) = self.conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_leads_is_deleted_sl ON leads(is_deleted, sl)",
                [],
            ) {
                log::warn!("Failed to create composite is_deleted_sl index: {}", e);
            }
        }

        // Check if facebook_url column exists. If not, add facebook_url and instagram_url.
        let mut fb_col_exists = false;
        if let Ok(mut stmt) = self.conn.prepare("SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'facebook_url'") {
            fb_col_exists = stmt.exists([]).unwrap_or(false);
        }

        if !fb_col_exists {
            if let Err(e) = self.conn.execute(
                "ALTER TABLE leads ADD COLUMN facebook_url TEXT",
                [],
            ) {
                log::warn!("Failed to add facebook_url column: {}", e);
            }
            if let Err(e) = self.conn.execute(
                "ALTER TABLE leads ADD COLUMN instagram_url TEXT",
                [],
            ) {
                log::warn!("Failed to add instagram_url column: {}", e);
            }
        }

        // Create indexes to optimize filtering and searching across millions of rows
        let indexes = [
            "CREATE INDEX IF NOT EXISTS idx_leads_country ON leads(country)",
            "CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry)",
            "CREATE INDEX IF NOT EXISTS idx_leads_niche ON leads(niche)",
            "CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)",
            "CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority)",
            "CREATE INDEX IF NOT EXISTS idx_leads_size ON leads(size)",
            "CREATE INDEX IF NOT EXISTS idx_leads_title ON leads(title)",
            "CREATE INDEX IF NOT EXISTS idx_leads_state ON leads(state)",
            "CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city)",
            "CREATE INDEX IF NOT EXISTS idx_leads_generated_person ON leads(generated_person)",
        ];
        
        for idx_query in indexes {
            if let Err(e) = self.conn.execute(idx_query, []) {
                log::warn!("Failed to create index: {}", e);
            }
        }

        if let Err(e) = self.conn.execute(
            "CREATE SEQUENCE IF NOT EXISTS transactions_seq;
             CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY DEFAULT nextval('transactions_seq'),
                date TEXT NOT NULL,
                tx_type TEXT NOT NULL,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                reference TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );",
            [],
        ) {
            log::warn!("Failed to create transactions table: {}", e);
        }

        Ok(())
    }

    pub fn get_transactions(&self) -> Result<Vec<Transaction>, String> {
        let mut stmt = self.conn.prepare("SELECT id, date, tx_type, category, amount, reference, notes, created_at FROM transactions ORDER BY date DESC, id DESC").map_err(|e| e.to_string())?;
        let tx_iter = stmt.query_map([], |row| {
            Ok(Transaction {
                id: row.get(0)?,
                date: row.get(1)?,
                tx_type: row.get(2)?,
                category: row.get(3)?,
                amount: row.get(4)?,
                reference: row.get(5)?,
                notes: row.get(6)?,
                created_at: row.get(7)?,
            })
        }).map_err(|e| e.to_string())?;

        let mut transactions = Vec::new();
        for tx in tx_iter {
            if let Ok(t) = tx {
                transactions.push(t);
            }
        }
        Ok(transactions)
    }

    pub fn add_transaction(&self, tx: Transaction) -> Result<(), String> {
        self.conn.execute(
            "INSERT INTO transactions (date, tx_type, category, amount, reference, notes) VALUES (?, ?, ?, ?, ?, ?)",
            params![tx.date, tx.tx_type, tx.category, tx.amount, tx.reference, tx.notes]
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_transaction(&self, id: i64) -> Result<(), String> {
        self.conn.execute("DELETE FROM transactions WHERE id = ?", params![id]).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_transaction_summary(&self) -> Result<TransactionSummary, String> {
        let mut total_income: f64 = 0.0;
        let mut total_expenses: f64 = 0.0;

        self.conn.query_row("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE tx_type = 'INCOME'", [], |r| {
            total_income = r.get(0)?;
            Ok(())
        }).ok();

        self.conn.query_row("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE tx_type = 'EXPENSE'", [], |r| {
            total_expenses = r.get(0)?;
            Ok(())
        }).ok();

        let mut outstanding_receivables: f64 = 0.0;
        self.conn.query_row("SELECT COALESCE(SUM(value - paid), 0) FROM projects WHERE value > paid", [], |r| {
            outstanding_receivables = r.get(0)?;
            Ok(())
        }).ok();

        Ok(TransactionSummary {
            total_income,
            total_expenses,
            net_profit: total_income - total_expenses,
            outstanding_receivables,
        })
    }

    pub fn import_leads_csv(
        &self,
        file_path: &str,
    ) -> Result<crate::models::ImportResult, String> {
        let count_before: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM leads", [], |r| r.get(0))
            .unwrap_or(0);

        let mut rdr = csv::ReaderBuilder::new()
            .from_path(file_path)
            .map_err(|e| e.to_string())?;
        let headers = rdr.headers().map_err(|e| e.to_string())?.clone();

        let standard_fields = [
            "country",
            "industry",
            "niche",
            "business_name",
            "person_name",
            "title",
            "business_email",
            "phone",
            "address",
            "city",
            "state",
            "website",
            "person_linkedin",
            "company_linkedin",
            "personal_email",
            "revenue",
            "size",
            "additional_info",
            "assigned_to",
            "source",
            "facebook_url",
            "instagram_url",
        ];

        let mut select_cols = Vec::new();
        let mut insert_cols = Vec::new();

        for field in standard_fields.iter() {
            if let Some(h) = headers
                .iter()
                .find(|h| h.trim().to_lowercase().replace(['\'', '"'], "") == *field)
            {
                select_cols.push(format!(
                    "TRY_CAST(\"{}\" AS VARCHAR)",
                    h.replace("\"", "\"\"")
                ));
                insert_cols.push(field.to_string());
            }
        }

        let get_mapped = |key: &str, default_val: &str| -> (String, String) {
            if let Some(h) = headers
                .iter()
                .find(|h| h.trim().to_lowercase().replace(['\'', '"'], "") == key)
            {
                (
                    format!(
                        "COALESCE(TRY_CAST(\"{}\" AS VARCHAR), '{}')",
                        h.replace("\"", "\"\""),
                        default_val
                    ),
                    key.to_string(),
                )
            } else {
                (format!("'{}'", default_val), key.to_string())
            }
        };

        let (s_gen, i_gen) = get_mapped("generated_person", "Auto");
        select_cols.push(s_gen);
        insert_cols.push(i_gen);

        let (s_stat, i_stat) = get_mapped("status", "New");
        select_cols.push(s_stat);
        insert_cols.push(i_stat);

        let (s_pri, i_pri) = get_mapped("priority", "Medium");
        select_cols.push(s_pri);
        insert_cols.push(i_pri);

        select_cols
            .push("(SELECT COALESCE(MAX(sl), 0) FROM leads) + row_number() OVER ()".to_string());
        insert_cols.push("sl".to_string());

        let query = format!(
        "INSERT INTO leads ({}) SELECT {} FROM read_csv_auto('{}', header=True, ignore_errors=True)",
        insert_cols.join(", "),
        select_cols.join(", "),
        file_path.replace("'", "''")
    );

        if let Err(e) = self.conn.execute(&query, []) {
            log::error!("DuckDB bulk import failed: {}", e);
            return Err(format!("Failed to import CSV: {}", e));
        }

        let count_after: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM leads", [], |r| r.get(0))
            .unwrap_or(0);
        let imported = (count_after - count_before).max(0) as i64;

        Ok(crate::models::ImportResult {
            imported,
            failed: 0,
            errors: vec![],
        })
    }

    pub fn backup_leads(&self, file_path: &str) -> Result<(), String> {
        let query = format!(
            "COPY (SELECT * FROM leads WHERE is_deleted=false) TO '{}' (FORMAT PARQUET)",
            file_path.replace("'", "''")
        );
        self.conn.execute(&query, []).map_err(|e| format!("Failed to backup database to Parquet: {}", e))?;
        Ok(())
    }

    pub fn restore_leads(&self, file_path: &str, replace: bool) -> Result<i64, String> {
        let count_before: i64 = self.conn.query_row("SELECT COUNT(*) FROM leads", [], |r| r.get(0)).unwrap_or(0);

        if replace {
            // Wipe the existing leads table
            self.conn.execute("DELETE FROM leads", []).map_err(|e| e.to_string())?;
            
            // Insert everything exactly as it was
            let query = format!(
                "INSERT INTO leads SELECT * FROM read_parquet('{}')",
                file_path.replace("'", "''")
            );
            self.conn.execute(&query, []).map_err(|e| format!("Failed to restore from Parquet: {}", e))?;
        } else {
            // Merge logic: Map explicit columns and assign new SL/IDs
            let standard_cols = "country, industry, niche, business_name, person_name, title, business_email, phone, address, city, state, website, person_linkedin, company_linkedin, personal_email, revenue, size, additional_info, generated_person, status, priority, source, last_contact, assigned_to, facebook_url, instagram_url";
            
            let query = format!(
                "INSERT INTO leads ({}, sl) SELECT {}, (SELECT COALESCE(MAX(sl), 0) FROM leads) + row_number() OVER () FROM read_parquet('{}')",
                standard_cols, standard_cols, file_path.replace("'", "''")
            );
            self.conn.execute(&query, []).map_err(|e| format!("Failed to merge from Parquet: {}", e))?;
        }

        let count_after: i64 = self.conn.query_row("SELECT COUNT(*) FROM leads", [], |r| r.get(0)).unwrap_or(0);
        let imported = (count_after - count_before).max(0) as i64;

        Ok(imported)
    }

    pub fn export_leads_csv(&self, file_path: &str, payload: ExportPayload) -> Result<(), String> {
        let mut conditions = vec!["is_deleted = false".to_string()];
        let mut params_vec: Vec<String> = vec![];
        
        // Handle explicit IDs (checked leads)
        let has_ids = payload.ids.as_ref().map_or(false, |v| !v.is_empty());
        if let Some(ids) = &payload.ids {
            if !ids.is_empty() {
                let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                conditions.push(format!("id IN ({})", placeholders));
                for id in ids {
                    params_vec.push(id.to_string());
                }
            }
        }
        
        // Handle filter fields (only if IDs are not provided or empty)
        if !has_ids {
            let mut add_filter = |col: &str, val: &Option<String>| {
                if let Some(v) = val {
                    if !v.is_empty() && !v.starts_with("All ") && !v.starts_with("e.g.") {
                        let parts: Vec<&str> = v.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
                        if !parts.is_empty() {
                            let or_conds = parts.iter().map(|_| format!("{} ILIKE ?", col)).collect::<Vec<_>>().join(" OR ");
                            conditions.push(format!("({})", or_conds));
                            for p in parts {
                                params_vec.push(format!("%{}%", p));
                            }
                        }
                    }
                }
            };
            
            add_filter("client", &payload.client);
            add_filter("additional_info", &payload.additional_info);
            add_filter("generated_person", &payload.generated_person);
            add_filter("country", &payload.country);
            add_filter("state", &payload.state);
            add_filter("city", &payload.city);
            add_filter("industry", &payload.industry);
            add_filter("title", &payload.title);
            add_filter("status", &payload.status);
            
            // Sidebar Array Filters (same logic as get_leads)
            if let Some(search) = &payload.filter_search {
                if !search.is_empty() {
                    conditions.push("(business_name ILIKE ? OR person_name ILIKE ? OR business_email ILIKE ? OR industry ILIKE ? OR country ILIKE ?)".to_string());
                    let pattern = format!("%{}%", search);
                    for _ in 0..5 {
                        params_vec.push(pattern.clone());
                    }
                }
            }
            let mut add_in_clause = |col: &str, vals: &Option<Vec<String>>| {
                if let Some(v) = vals {
                    if !v.is_empty() {
                        let placeholders = v.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                        conditions.push(format!("{} IN ({})", col, placeholders));
                        for val in v {
                            params_vec.push(val.clone());
                        }
                    }
                }
            };
            add_in_clause("country", &payload.filter_countries);
            add_in_clause("industry", &payload.filter_industries);
            add_in_clause("niche", &payload.filter_niches);
            add_in_clause("status", &payload.filter_statuses);
            add_in_clause("priority", &payload.filter_priorities);
            add_in_clause("size", &payload.filter_sizes);
            add_in_clause("title", &payload.filter_titles);
            add_in_clause("city", &payload.filter_cities);
            add_in_clause("state", &payload.filter_states);
            add_in_clause("generated_person", &payload.filter_generated);
        }
        
        let where_clause = conditions.join(" AND ");
        
        let mut select_cols = vec!["id".to_string()]; // Default to ID if none selected
        if !payload.columns.is_empty() {
            select_cols = payload.columns.clone();
        }
        
        let format_header = |s: &str| -> String {
            s.split('_')
                .map(|word| {
                    let mut c = word.chars();
                    match c.next() {
                        None => String::new(),
                        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                    }
                })
                .collect::<Vec<_>>()
                .join(" ")
        };

        // Cast all selected columns to VARCHAR to ensure consistent export formatting and add a formatted Title Case alias
        let select_clause = select_cols.iter().map(|c| format!("CAST({} AS VARCHAR) AS \"{}\"", c, format_header(c))).collect::<Vec<_>>().join(", ");
        let mut sql = format!("SELECT {} FROM leads WHERE {}", select_clause, where_clause);
        
        // Handle limit
        if !has_ids {
            if let Some(limit_str) = &payload.limit {
                if let Ok(limit) = limit_str.parse::<i64>() {
                    sql.push_str(&format!(" LIMIT {}", limit));
                }
            }
        }

        // Write directly to file using DuckDB COPY
        let copy_sql = format!(
            "COPY ({}) TO '{}' (HEADER, DELIMITER ',')",
            sql,
            file_path.replace("'", "''").replace("\\", "\\\\")
        );

        let mut stmt = self.conn.prepare(&copy_sql).map_err(|e| e.to_string())?;
        
        let mut bind_params: Vec<Box<dyn duckdb::ToSql>> = vec![];
        for p in &params_vec {
            bind_params.push(Box::new(p.clone()));
        }
        
        stmt.execute(duckdb::params_from_iter(bind_params.iter())).map_err(|e| e.to_string())?;
        
        Ok(())
    }

    pub fn get_leads(&self, filter: LeadFilter) -> Result<PaginatedLeads, String> {
        let mut conditions = vec!["is_deleted = false".to_string()];
        let mut params_vec: Vec<String> = vec![];
        if let Some(search) = &filter.search {
            if !search.is_empty() {
                conditions.push("(business_name ILIKE ? OR person_name ILIKE ? OR business_email ILIKE ? OR industry ILIKE ? OR country ILIKE ?)".to_string());
                let pattern = format!("%{}%", search);
                for _ in 0..5 {
                    params_vec.push(pattern.clone());
                }
            }
        }
        let mut add_in_clause = |col: &str, vals: &Option<Vec<String>>| {
            if let Some(v) = vals {
                if !v.is_empty() {
                    let placeholders = v.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                    conditions.push(format!("{} IN ({})", col, placeholders));
                    for val in v {
                        params_vec.push(val.clone());
                    }
                }
            }
        };
        add_in_clause("country", &filter.country);
        add_in_clause("industry", &filter.industry);
        add_in_clause("niche", &filter.niche);
        add_in_clause("status", &filter.status);
        add_in_clause("priority", &filter.priority);
        add_in_clause("size", &filter.size);
        add_in_clause("title", &filter.title);
        add_in_clause("city", &filter.city);
        add_in_clause("state", &filter.state);
        add_in_clause("generated_person", &filter.generated_person);

        let where_clause = conditions.join(" AND ");
        let count_sql = format!("SELECT COUNT(*) FROM leads WHERE {}", where_clause);
        let mut count_stmt = self.conn.prepare(&count_sql).map_err(|e| e.to_string())?;
        let total: i64 = count_stmt
            .query_row(duckdb::params_from_iter(params_vec.iter()), |row| {
                row.get(0)
            })
            .map_err(|e| e.to_string())?;
        drop(count_stmt);
        let offset = (filter.page - 1) * filter.page_size;
        let sql = format!(
            "SELECT * FROM leads WHERE {} ORDER BY sl LIMIT ? OFFSET ?",
            where_clause
        );
        let mut stmt = self.conn.prepare(&sql).map_err(|e| e.to_string())?;
        let mut bind_params: Vec<Box<dyn duckdb::ToSql>> = vec![];
        for p in &params_vec {
            bind_params.push(Box::new(p.clone()));
        }
        bind_params.push(Box::new(filter.page_size));
        bind_params.push(Box::new(offset));
        let lead_iter = stmt
            .query_map(duckdb::params_from_iter(bind_params.iter()), |row| {
                Ok(Lead {
                    id: row.get(0)?,
                    sl: row.get::<_, Option<i64>>(1)?.unwrap_or(0),
                    country: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    industry: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                    niche: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                    business_name: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                    person_name: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
                    title: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
                    business_email: row.get::<_, Option<String>>(8)?.unwrap_or_default(),
                    phone: row.get::<_, Option<String>>(9)?.unwrap_or_default(),
                    address: row.get::<_, Option<String>>(10)?.unwrap_or_default(),
                    city: row.get::<_, Option<String>>(11)?.unwrap_or_default(),
                    state: row.get::<_, Option<String>>(12)?.unwrap_or_default(),
                    website: row.get::<_, Option<String>>(13)?.unwrap_or_default(),
                    person_linkedin: row.get::<_, Option<String>>(14)?.unwrap_or_default(),
                    company_linkedin: row.get::<_, Option<String>>(15)?.unwrap_or_default(),
                    personal_email: row.get::<_, Option<String>>(16)?.unwrap_or_default(),
                    revenue: row.get::<_, Option<String>>(17)?.unwrap_or_default(),
                    size: row.get::<_, Option<String>>(18)?.unwrap_or_default(),
                    additional_info: row.get::<_, Option<String>>(19)?.unwrap_or_default(),
                    generated_person: row.get::<_, Option<String>>(20)?.unwrap_or_default(),
                    status: row.get::<_, Option<String>>(21)?.unwrap_or_default(),
                    priority: row.get::<_, Option<String>>(22)?.unwrap_or_default(),
                    source: row.get::<_, Option<String>>(23)?.unwrap_or_default(),
                    last_contact: row.get::<_, Option<String>>(24)?.unwrap_or_default(),
                    assigned_to: row.get::<_, Option<String>>(25)?.unwrap_or_default(),
                    facebook_url: row.get::<_, Option<String>>(28)?.unwrap_or_default(),
                    instagram_url: row.get::<_, Option<String>>(29)?.unwrap_or_default(),
                })
            })
            .map_err(|e| e.to_string())?;
        let mut leads = Vec::new();
        for lead in lead_iter {
            leads.push(lead.map_err(|e| e.to_string())?);
        }
        let total_pages = (total as f64 / filter.page_size as f64).ceil() as i64;
        let db_total: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(*) FROM leads WHERE is_deleted = false",
                [],
                |row| row.get(0),
            )
            .unwrap_or(total);
        Ok(PaginatedLeads {
            leads,
            total,
            db_total,
            page: filter.page,
            page_size: filter.page_size,
            total_pages,
        })
    }

    pub fn get_filter_counts(&self, filter: LeadFilter) -> Result<FilterCounts, String> {
        let mut conditions = vec!["is_deleted = false".to_string()];
        let mut params: Vec<String> = vec![];

        if let Some(search) = &filter.search {
            if !search.is_empty() {
                conditions.push("(business_name ILIKE ? OR person_name ILIKE ? OR business_email ILIKE ? OR industry ILIKE ? OR country ILIKE ?)".to_string());
                let s = format!("%{}%", search);
                for _ in 0..5 {
                    params.push(s.clone());
                }
            }
        }

        let mut add_in = |col: &str, vals: &Option<Vec<String>>| {
            if let Some(v) = vals {
                if !v.is_empty() {
                    let placeholders = v.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                    conditions.push(format!("{} IN ({})", col, placeholders));
                    for val in v {
                        params.push(val.clone());
                    }
                }
            }
        };

        add_in("country", &filter.country);
        add_in("industry", &filter.industry);
        add_in("niche", &filter.niche);
        add_in("status", &filter.status);
        add_in("priority", &filter.priority);
        add_in("size", &filter.size);
        add_in("title", &filter.title);
        add_in("city", &filter.city);
        add_in("state", &filter.state);
        add_in("generated_person", &filter.generated_person);

        let where_clause = conditions.join(" AND ");

        // Total count
        let total_sql = format!("SELECT COUNT(*) FROM leads WHERE {}", where_clause);
        let mut total_stmt = self.conn.prepare(&total_sql).map_err(|e| e.to_string())?;
        
        let mut bind_params: Vec<Box<dyn duckdb::ToSql>> = vec![];
        for p in &params {
            bind_params.push(Box::new(p.clone()));
        }
        
        let total_leads: i64 = total_stmt
            .query_row(duckdb::params_from_iter(bind_params.iter()), |row| row.get(0))
            .unwrap_or(0);

        let get_counts = |col: &str| -> Result<Vec<FilterOptionCount>, String> {
            let sql = format!(
                "SELECT CAST({} AS VARCHAR), COUNT(*) FROM leads WHERE {} AND {} IS NOT NULL AND {} != '' GROUP BY {} ORDER BY COUNT(*) DESC LIMIT 300",
                col, where_clause, col, col, col
            );
            let mut stmt = self.conn.prepare(&sql).map_err(|e| e.to_string())?;
            let iter = stmt
                .query_map(duckdb::params_from_iter(bind_params.iter()), |row| {
                    Ok(FilterOptionCount {
                        value: row.get::<_, Option<String>>(0)?.unwrap_or_default(),
                        count: row.get(1)?,
                    })
                })
                .map_err(|e| e.to_string())?;
            let mut res = Vec::new();
            for item in iter {
                res.push(item.map_err(|e| e.to_string())?);
            }
            Ok(res)
        };

        Ok(FilterCounts {
            total_leads,
            country: get_counts("country")?,
            industry: get_counts("industry")?,
            niche: get_counts("niche")?,
            size: get_counts("size")?,
            generated: get_counts("generated_person")?,
            title: get_counts("title")?,
            city: get_counts("city")?,
            state: get_counts("state")?,
        })
    }

    pub fn get_clients(&self) -> Result<Vec<Client>, String> {
        let mut stmt = self.conn.prepare("SELECT id, name, email, website, linkedin, country, source, industry, retainer, status FROM clients ORDER BY id").map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map([], |row| {
                Ok(Client {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    email: row.get(2)?,
                    website: row.get(3)?,
                    linkedin: row.get(4)?,
                    country: row.get(5)?,
                    source: row.get(6)?,
                    industry: row.get(7)?,
                    retainer: row.get(8)?,
                    status: row.get(9)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for c in iter {
            out.push(c.map_err(|e| e.to_string())?);
        }
        Ok(out)
    }
    pub fn get_client_stats(&self, client_id: i64) -> Result<ClientStats, String> {
        let active: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(*) FROM projects WHERE client_id = ? AND status = 'active'",
                [client_id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        let completed: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(*) FROM projects WHERE client_id = ? AND status = 'completed'",
                [client_id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        let invoiced: f64 = self
            .conn
            .query_row(
                "SELECT COALESCE(SUM(invoiced), 0) FROM projects WHERE client_id = ?",
                [client_id],
                |row| row.get(0),
            )
            .unwrap_or(0.0);
        let paid: f64 = self
            .conn
            .query_row(
                "SELECT COALESCE(SUM(paid), 0) FROM projects WHERE client_id = ?",
                [client_id],
                |row| row.get(0),
            )
            .unwrap_or(0.0);
        Ok(ClientStats {
            active_projects: active,
            completed_projects: completed,
            total_invoiced: invoiced,
            total_paid: paid,
            total_due: invoiced - paid,
        })
    }
    pub fn create_client(&self, client: Client) -> Result<i64, String> {
        let mut stmt = self.conn.prepare("INSERT INTO clients (name, email, website, linkedin, country, source, industry, retainer, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) RETURNING id").map_err(|e| e.to_string())?;
        let id: i32 = stmt
            .query_row(
                params![
                    client.name,
                    client.email,
                    client.website,
                    client.linkedin,
                    client.country,
                    client.source,
                    client.industry,
                    client.retainer,
                    client.status
                ],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        Ok(id as i64)
    }
    pub fn update_client(&self, id: i64, client: Client) -> Result<(), String> {
        self.conn.execute(
"UPDATE clients SET name=?1, email=?2, website=?3, linkedin=?4, country=?5, source=?6, industry=?7, retainer=?8, status=?9 WHERE id=?10",
params![client.name, client.email, client.website, client.linkedin, client.country, client.source, client.industry, client.retainer, client.status, id]
).map(|_| ()).map_err(|e| e.to_string())
    }
    pub fn delete_client(&self, id: i64) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM clients WHERE id = ?", [id])
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    pub fn get_projects(&self) -> Result<Vec<Project>, String> {
        let mut stmt = self.conn.prepare("SELECT id, name, description, client_id, type, source, ops_sheet, delivery_url, deadline, value, invoiced, paid, target, status, progress, notes FROM projects ORDER BY id").map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map([], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    client_id: row.get(3)?,
                    project_type: row.get(4)?,
                    source: row.get(5)?,
                    ops_sheet: row.get(6)?,
                    delivery_url: row.get(7)?,
                    deadline: row.get(8)?,
                    value: row.get(9)?,
                    invoiced: row.get(10)?,
                    paid: row.get(11)?,
                    target: row.get(12)?,
                    status: row.get(13)?,
                    progress: row.get(14)?,
                    notes: row.get(15)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for p in iter {
            out.push(p.map_err(|e| e.to_string())?);
        }
        Ok(out)
    }
    pub fn create_project(&self, project: Project) -> Result<i64, String> {
        let mut stmt = self.conn.prepare("INSERT INTO projects (name, description, client_id, type, source, ops_sheet, delivery_url, deadline, value, invoiced, paid, target, status, progress, notes) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15) RETURNING id").map_err(|e| e.to_string())?;
        let id: i32 = stmt
            .query_row(
                params![
                    project.name,
                    project.description,
                    project.client_id,
                    project.project_type,
                    project.source,
                    project.ops_sheet,
                    project.delivery_url,
                    project.deadline,
                    project.value,
                    project.invoiced,
                    project.paid,
                    project.target,
                    project.status,
                    project.progress,
                    project.notes
                ],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        Ok(id as i64)
    }
    pub fn update_project(&self, id: i64, project: Project) -> Result<(), String> {
        self.conn.execute(
"UPDATE projects SET name=?1, description=?2, client_id=?3, type=?4, source=?5, ops_sheet=?6, delivery_url=?7, deadline=?8, value=?9, invoiced=?10, paid=?11, target=?12, status=?13, progress=?14, notes=?15 WHERE id=?16",
params![project.name, project.description, project.client_id, project.project_type, project.source, project.ops_sheet, project.delivery_url, project.deadline, project.value, project.invoiced, project.paid, project.target, project.status, project.progress, project.notes, id]
).map(|_| ()).map_err(|e| e.to_string())
    }
    pub fn delete_project(&self, id: i64) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM projects WHERE id = ?", [id])
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    pub fn get_team_members(&self) -> Result<Vec<TeamMember>, String> {
        let mut stmt = self.conn.prepare("SELECT id, name, email, phone, whatsapp, linkedin, category, address, status, submitted_date FROM team_members ORDER BY id").map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map([], |row| {
                Ok(TeamMember {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    email: row.get(2)?,
                    phone: row.get(3)?,
                    whatsapp: row.get(4)?,
                    linkedin: row.get(5)?,
                    category: row.get(6)?,
                    address: row.get(7)?,
                    status: row.get(8)?,
                    submitted_date: row.get(9)?,
                })
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for m in iter {
            out.push(m.map_err(|e| e.to_string())?);
        }
        Ok(out)
    }
    pub fn create_team_member(&self, member: TeamMember) -> Result<i64, String> {
        let mut stmt = self.conn.prepare("INSERT INTO team_members (name, email, phone, whatsapp, linkedin, category, address, status, submitted_date) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) RETURNING id").map_err(|e| e.to_string())?;
        let id: i32 = stmt
            .query_row(
                params![
                    member.name,
                    member.email,
                    member.phone,
                    member.whatsapp,
                    member.linkedin,
                    member.category,
                    member.address,
                    member.status,
                    member.submitted_date
                ],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        Ok(id as i64)
    }
    pub fn update_team_member(&self, id: i64, member: TeamMember) -> Result<(), String> {
        self.conn.execute(
"UPDATE team_members SET name=?1, email=?2, phone=?3, whatsapp=?4, linkedin=?5, category=?6, address=?7, status=?8, submitted_date=?9 WHERE id=?10",
params![member.name, member.email, member.phone, member.whatsapp, member.linkedin, member.category, member.address, member.status, member.submitted_date, id]
).map(|_| ()).map_err(|e| e.to_string())
    }
    pub fn delete_team_member(&self, id: i64) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM team_members WHERE id = ?", [id])
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    pub fn audit_csv(&self, csv_path: String) -> Result<AuditResult, String> {
        println!("Starting audit_csv for path: {}", csv_path);
        let mut rdr = csv::ReaderBuilder::new()
            .from_path(&csv_path)
            .map_err(|e| {
                println!("Failed to parse CSV from path: {}", e);
                e.to_string()
            })?;
        let headers = rdr
            .headers()
            .map_err(|e| {
                println!("Failed to read headers: {}", e);
                e.to_string()
            })?
            .clone();
        println!("CSV headers loaded: {:?}", headers);

        let get_idx = |key: &str| -> Option<usize> {
            headers.iter().position(|h| {
                h.trim()
                    .to_lowercase()
                    .replace(['\'', '"'], "")
                    .replace(' ', "_")
                    == key
            })
        };

        let idx_business_email = get_idx("business_email");
        let idx_personal_email = get_idx("personal_email");
        let idx_phone = get_idx("phone");
        let idx_person_linkedin = get_idx("person_linkedin");
        let idx_website = get_idx("website");
        let idx_company_linkedin = get_idx("company_linkedin");
        let idx_business_name = get_idx("business_name");

        let idx_country = get_idx("country");
        let idx_industry = get_idx("industry");
        let idx_niche = get_idx("niche");
        let idx_person_name = get_idx("person_name");
        let idx_title = get_idx("title");
        let idx_address = get_idx("address");
        let idx_city = get_idx("city");
        let idx_state = get_idx("state");
        let idx_revenue = get_idx("revenue");
        let idx_size = get_idx("size");
        let idx_additional_info = get_idx("additional_info");
        let idx_generated_person = get_idx("generated_person");
        let idx_status = get_idx("status");
        let idx_priority = get_idx("priority");
        let _idx_source = get_idx("source");
        let idx_facebook_url = get_idx("facebook");
        let idx_instagram_url = get_idx("instagram");

        let _check_hard = self.conn.prepare("SELECT 1 FROM leads WHERE is_deleted = false AND ((business_email = ? AND business_email != '') OR (personal_email = ? AND personal_email != '') OR (phone = ? AND phone != '') OR (person_linkedin = ? AND person_linkedin != '')) LIMIT 1").map_err(|e| e.to_string())?;

        // Load existing keys into memory for lightning-fast lookups (no DB queries per row)
        let mut hard_keys = std::collections::HashSet::new();
        let mut soft_keys = std::collections::HashSet::new();

        let mut stmt = self.conn.prepare("SELECT business_email, personal_email, phone, person_linkedin, website, company_linkedin, business_name FROM leads WHERE is_deleted = false").map_err(|e| e.to_string())?;

        let mut rows_iter = stmt.query([]).map_err(|e| e.to_string())?;
        while let Some(row) = rows_iter.next().unwrap_or(None) {
            let be: Option<String> = row.get(0).ok();
            let pe: Option<String> = row.get(1).ok();
            let ph: Option<String> = row.get(2).ok();
            let pl: Option<String> = row.get(3).ok();
            let ws: Option<String> = row.get(4).ok();
            let cl: Option<String> = row.get(5).ok();
            let bn: Option<String> = row.get(6).ok();

            if let Some(v) = be {
                if !v.is_empty() {
                    hard_keys.insert(v);
                }
            }
            if let Some(v) = pe {
                if !v.is_empty() {
                    hard_keys.insert(v);
                }
            }
            if let Some(v) = ph {
                if !v.is_empty() {
                    hard_keys.insert(v);
                }
            }
            if let Some(v) = pl {
                if !v.is_empty() {
                    hard_keys.insert(v);
                }
            }

            if let Some(v) = ws {
                if !v.is_empty() {
                    soft_keys.insert(v);
                }
            }
            if let Some(v) = cl {
                if !v.is_empty() {
                    soft_keys.insert(v);
                }
            }
            if let Some(v) = bn {
                if !v.is_empty() {
                    soft_keys.insert(v);
                }
            }
        }

        let mut total = 0;
        let mut valid = 0;
        let mut hard_duplicates = 0;
        let mut soft_warnings = 0;
        let mut rows = Vec::new();
        let mut valid_row_numbers = Vec::new();

        for result in rdr.records() {
            let record = result.map_err(|e| e.to_string())?;

            let get_val = |idx_opt: Option<usize>| -> String {
                if let Some(idx) = idx_opt {
                    if let Some(val) = record.get(idx) {
                        return val.trim().to_string();
                    }
                }
                String::new()
            };

            let business_email = get_val(idx_business_email);
            let personal_email = get_val(idx_personal_email);
            let phone = get_val(idx_phone);
            let person_linkedin = get_val(idx_person_linkedin);
            let website = get_val(idx_website);
            let company_linkedin = get_val(idx_company_linkedin);
            let business_name = get_val(idx_business_name);

            let mut is_hard = false;
            if !business_email.is_empty() && hard_keys.contains(&business_email) {
                is_hard = true;
            }
            if !personal_email.is_empty() && hard_keys.contains(&personal_email) {
                is_hard = true;
            }
            if !phone.is_empty() && hard_keys.contains(&phone) {
                is_hard = true;
            }
            if !person_linkedin.is_empty() && hard_keys.contains(&person_linkedin) {
                is_hard = true;
            }

            let mut status = "VALID".to_string();

            if is_hard {
                status = "HARD_DUPLICATE".to_string();
                hard_duplicates += 1;
            } else {
                let mut is_soft = false;
                if !website.is_empty() && soft_keys.contains(&website) {
                    is_soft = true;
                }
                if !company_linkedin.is_empty() && soft_keys.contains(&company_linkedin) {
                    is_soft = true;
                }
                if !business_name.is_empty() && soft_keys.contains(&business_name) {
                    is_soft = true;
                }

                if is_soft {
                    status = "SOFT_WARNING".to_string();
                    soft_warnings += 1;
                } else {
                    valid += 1;
                }

                // Add to keys so subsequent rows in this CSV are marked as duplicates
                if !business_email.is_empty() {
                    hard_keys.insert(business_email.clone());
                }
                if !personal_email.is_empty() {
                    hard_keys.insert(personal_email.clone());
                }
                if !phone.is_empty() {
                    hard_keys.insert(phone.clone());
                }
                if !person_linkedin.is_empty() {
                    hard_keys.insert(person_linkedin.clone());
                }

                if !website.is_empty() {
                    soft_keys.insert(website.clone());
                }
                if !company_linkedin.is_empty() {
                    soft_keys.insert(company_linkedin.clone());
                }
                if !business_name.is_empty() {
                    soft_keys.insert(business_name.clone());
                }
            }

            total += 1;

            let mut gen_person = get_val(idx_generated_person);
            if gen_person.is_empty() {
                gen_person = "Auto".to_string();
            }

            let mut status_field = get_val(idx_status);
            if status_field.is_empty() {
                status_field = "New".to_string();
            }

            let mut priority = get_val(idx_priority);
            if priority.is_empty() {
                priority = "Medium".to_string();
            }

            if status != "HARD_DUPLICATE" {
                valid_row_numbers.push(total);
            }

            if rows.len() < 500 {
                rows.push(AuditRow {
                    row_number: total,
                    business_email,
                    phone,
                    business_name,
                    country: get_val(idx_country),
                    industry: get_val(idx_industry),
                    niche: get_val(idx_niche),
                    person_name: get_val(idx_person_name),
                    title: get_val(idx_title),
                    address: get_val(idx_address),
                    city: get_val(idx_city),
                    state: get_val(idx_state),
                    website,
                    person_linkedin,
                    company_linkedin,
                    personal_email,
                    revenue: get_val(idx_revenue),
                    size: get_val(idx_size),
                    additional_info: get_val(idx_additional_info),
                    generated_person: gen_person,
                    status_field,
                    priority,
                    facebook_url: get_val(idx_facebook_url),
                    instagram_url: get_val(idx_instagram_url),
                    audit_status: status,
                });
            }

            if total % 100000 == 0 {
                println!("Audited {} rows...", total);
            }
        }

        println!(
            "Audit complete. Total: {}, Valid: {}, Hard Dumps: {}",
            total, valid, hard_duplicates
        );
        Ok(AuditResult {
            rows,
            stats: AuditStats {
                total,
                valid,
                hard_duplicates,
                soft_warnings,
            },
            valid_row_numbers,
        })
    }

    pub fn commit_csv(
        &self,
        csv_path: String,
        approved_rows: Vec<usize>,
        client_profile: String,
        workspace_node: String,
    ) -> Result<ImportResult, String> {
        let mut imported = 0;
        let mut failed = 0;

        let mut rdr = csv::ReaderBuilder::new()
            .from_path(&csv_path)
            .map_err(|e| e.to_string())?;
        let headers = rdr.headers().map_err(|e| e.to_string())?.clone();

        let get_idx = |key: &str| -> Option<usize> {
            headers.iter().position(|h| {
                h.trim()
                    .to_lowercase()
                    .replace(['\'', '"'], "")
                    .replace(' ', "_")
                    == key
            })
        };

        let idx_business_email = get_idx("business_email");
        let idx_personal_email = get_idx("personal_email");
        let idx_phone = get_idx("phone");
        let idx_person_linkedin = get_idx("person_linkedin");
        let idx_website = get_idx("website");
        let idx_company_linkedin = get_idx("company_linkedin");
        let idx_business_name = get_idx("business_name");

        let idx_country = get_idx("country");
        let idx_industry = get_idx("industry");
        let idx_niche = get_idx("niche");
        let idx_person_name = get_idx("person_name");
        let idx_title = get_idx("title");
        let idx_address = get_idx("address");
        let idx_city = get_idx("city");
        let idx_state = get_idx("state");
        let idx_revenue = get_idx("revenue");
        let idx_size = get_idx("size");
        let idx_additional_info = get_idx("additional_info");
        let idx_generated_person = get_idx("generated_person");
        let idx_status = get_idx("status");
        let idx_priority = get_idx("priority");
        let _idx_source = get_idx("source");

        let approved_set: std::collections::HashSet<usize> = approved_rows.into_iter().collect();

        self.conn
            .execute("BEGIN TRANSACTION", [])
            .map_err(|e| e.to_string())?;

        {
            let max_sl_sql = "SELECT COALESCE(MAX(sl), 0) FROM leads";
            let mut max_sl: i64 = self
                .conn
                .query_row(max_sl_sql, [], |row| row.get(0))
                .unwrap_or(0);

            let mut stmt = self.conn.prepare("INSERT INTO leads (
                sl, country, industry, niche, business_name, person_name, title, business_email, phone, address, city, state, website, person_linkedin, company_linkedin, personal_email, revenue, size, additional_info, generated_person, status, priority, assigned_to, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .map_err(|e| e.to_string())?;

            let mut row_idx = 1;
            for result in rdr.records() {
                if approved_set.contains(&row_idx) {
                    if let Ok(record) = result {
                        let get_val = |idx_opt: Option<usize>| -> String {
                            if let Some(idx) = idx_opt {
                                if let Some(val) = record.get(idx) {
                                    return val.trim().to_string();
                                }
                            }
                            String::new()
                        };

                        let mut gen_person = get_val(idx_generated_person);
                        if gen_person.is_empty() {
                            gen_person = "Auto".to_string();
                        }

                        let mut status_field = get_val(idx_status);
                        if status_field.is_empty() {
                            status_field = "New".to_string();
                        }

                        let mut priority = get_val(idx_priority);
                        if priority.is_empty() {
                            priority = "Medium".to_string();
                        }

                        max_sl += 1;

                        match stmt.execute(duckdb::params![
                            max_sl,
                            get_val(idx_country),
                            get_val(idx_industry),
                            get_val(idx_niche),
                            get_val(idx_business_name),
                            get_val(idx_person_name),
                            get_val(idx_title),
                            get_val(idx_business_email),
                            get_val(idx_phone),
                            get_val(idx_address),
                            get_val(idx_city),
                            get_val(idx_state),
                            get_val(idx_website),
                            get_val(idx_person_linkedin),
                            get_val(idx_company_linkedin),
                            get_val(idx_personal_email),
                            get_val(idx_revenue),
                            get_val(idx_size),
                            get_val(idx_additional_info),
                            gen_person,
                            status_field,
                            priority,
                            &client_profile,
                            &workspace_node
                        ]) {
                            Ok(_) => imported += 1,
                            Err(e) => {
                                log::error!("Insert failed: {}", e);
                                failed += 1;
                            }
                        }
                    }
                }
                row_idx += 1;
            }
        }

        self.conn.execute("COMMIT", []).map_err(|e| e.to_string())?;

        Ok(ImportResult {
            imported,
            failed,
            errors: vec![],
        })
    }

    /// Lightning-fast bulk import using DuckDB's native read_csv_auto engine.
    /// Instead of 800K individual INSERT statements, the entire CSV is processed
    /// in a single SQL statement. Only the tiny rejected list (hard duplicates) is
    /// passed over IPC to keep the Tauri bridge payload minimal.
    pub fn commit_csv_fast(
        &self,
        csv_path: String,
        rejected_rows: Vec<i64>,
        client_profile: String,
        workspace_node: String,
    ) -> Result<ImportResult, String> {
        // Get current max sl so new rows continue the sequence
        let max_sl: i64 = self
            .conn
            .query_row(
                "SELECT COALESCE(MAX(sl), 0) FROM leads WHERE is_deleted = false",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        // Store the tiny rejected list in a temp table for exclusion
        self.conn
            .execute("DROP TABLE IF EXISTS _rej", [])
            .ok();
        self.conn
            .execute("CREATE TEMP TABLE _rej (n BIGINT)", [])
            .map_err(|e| e.to_string())?;

        if !rejected_rows.is_empty() {
            // Batch insert rejected rows 500 at a time
            for chunk in rejected_rows.chunks(500) {
                let vals = chunk
                    .iter()
                    .map(|n| format!("({})", n))
                    .collect::<Vec<_>>()
                    .join(",");
                self.conn
                    .execute(&format!("INSERT INTO _rej VALUES {}", vals), [])
                    .map_err(|e| e.to_string())?;
            }
        }

        // Read CSV headers to see which columns actually exist in the file
        let mut rdr = csv::ReaderBuilder::new()
            .from_path(&csv_path)
            .map_err(|e| e.to_string())?;
        let headers = rdr.headers().map_err(|e| e.to_string())?.clone();
        
        let mut available_cols = std::collections::HashSet::new();
        for h in headers.iter() {
            available_cols.insert(
                h.trim()
                    .to_lowercase()
                    .replace(['\'', '"'], "")
                    .replace(' ', "_")
                    .replace('-', "_")
            );
        }

        let get_col = |col: &str, default: &str| -> String {
            if available_cols.contains(col) {
                format!("COALESCE(NULLIF(TRIM({}), ''), {})", col, default)
            } else {
                default.to_string()
            }
        };

        // Escape single quotes in paths for SQL safety
        let safe_path = csv_path.replace('\'', "''");
        let safe_client = client_profile.replace('\'', "''");
        let safe_workspace = workspace_node.replace('\'', "''");

        // One-shot bulk INSERT using DuckDB's vectorised CSV engine.
        // normalize_names=true converts "Business Email" → "business_email".
        // ROW_NUMBER() assigns sequential sl values continuing from max_sl.
        let sql = format!(
            r#"
            INSERT INTO leads (
                sl, country, industry, niche, business_name, person_name, title,
                business_email, phone, address, city, state, website,
                person_linkedin, company_linkedin, personal_email,
                revenue, size, additional_info, generated_person,
                status, priority, assigned_to, source, facebook_url, instagram_url
            )
            WITH csv_raw AS (
                SELECT ROW_NUMBER() OVER () AS _rn, *
                FROM read_csv_auto('{path}', header=true, normalize_names=true, null_padding=true, all_varchar=true)
            ),
            filtered AS (
                SELECT * FROM csv_raw
                WHERE _rn NOT IN (SELECT n FROM _rej)
            ),
            numbered AS (
                SELECT ROW_NUMBER() OVER () + {max_sl} AS new_sl, * FROM filtered
            )
            SELECT
                new_sl,
                {col_country},
                {col_industry},
                {col_niche},
                {col_business_name},
                {col_person_name},
                {col_title},
                {col_business_email},
                {col_phone},
                {col_address},
                {col_city},
                {col_state},
                {col_website},
                {col_person_linkedin},
                {col_company_linkedin},
                {col_personal_email},
                {col_revenue},
                {col_size},
                {col_additional_info},
                {col_generated_person},
                {col_status},
                {col_priority},
                '{client}',
                '{workspace}',
                {col_facebook_url},
                {col_instagram_url}
            FROM numbered
            "#,
            path = safe_path,
            max_sl = max_sl,
            client = safe_client,
            workspace = safe_workspace,
            col_country = get_col("country", "NULL"),
            col_industry = get_col("industry", "NULL"),
            col_niche = get_col("niche", "NULL"),
            col_business_name = get_col("business_name", "NULL"),
            col_person_name = get_col("person_name", "NULL"),
            col_title = get_col("title", "NULL"),
            col_business_email = get_col("business_email", "NULL"),
            col_phone = get_col("phone", "NULL"),
            col_address = get_col("address", "NULL"),
            col_city = get_col("city", "NULL"),
            col_state = get_col("state", "NULL"),
            col_website = get_col("website", "NULL"),
            col_person_linkedin = get_col("person_linkedin", "NULL"),
            col_company_linkedin = get_col("company_linkedin", "NULL"),
            col_personal_email = get_col("personal_email", "NULL"),
            col_revenue = get_col("revenue", "NULL"),
            col_size = get_col("size", "NULL"),
            col_additional_info = get_col("additional_info", "NULL"),
            col_generated_person = get_col("generated_person", "'Auto'"),
            col_status = get_col("status", "'New'"),
            col_priority = get_col("priority", "'Medium'"),
            col_facebook_url = get_col("facebook", "NULL"),
            col_instagram_url = get_col("instagram", "NULL"),
        );

        self.conn.execute(&sql, []).map_err(|e| e.to_string())?;

        // Count how many rows were actually inserted
        let imported: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(*) FROM leads WHERE sl > ? AND is_deleted = false",
                params![max_sl],
                |r| r.get(0),
            )
            .unwrap_or(0);

        self.conn.execute("DROP TABLE IF EXISTS _rej", []).ok();
        
        // Checkpoint the database to flush WAL to disk and free up the enormous temporary disk space
        self.conn.execute("CHECKPOINT", []).ok();

        Ok(ImportResult {
            imported,
            failed: 0,
            errors: vec![],
        })
    }

    /// Renumber all active leads: sl = 1, 2, 3... ordered by (sl, id).
    /// Uses a persistent temp table approach with separate DuckDB execute calls.
    fn renumber_sl(&self) -> Result<(), String> {
        self.conn.execute("BEGIN TRANSACTION", []).ok();

        // Step 1: Always clean up from any previous failed run
        let _ = self.conn.execute("DROP TABLE IF EXISTS _sl_renum", []);

        // Step 2: Compute new serial numbers via ROW_NUMBER window function
        if let Err(e) = self.conn.execute(
            "CREATE TEMP TABLE _sl_renum AS
         SELECT id, CAST(ROW_NUMBER() OVER (ORDER BY sl NULLS LAST, id) AS BIGINT) AS new_sl
         FROM leads WHERE is_deleted = false",
            [],
        ) {
            self.conn.execute("ROLLBACK", []).ok();
            return Err(format!("renumber create temp: {}", e));
        }

        // Prevent unique constraint violations by clearing all SL values first.
        // This also retroactively cleans up legacy trashed items that still had SL values.
        if let Err(e) = self.conn.execute("UPDATE leads SET sl = NULL", []) {
            self.conn.execute("ROLLBACK", []).ok();
            return Err(format!("renumber clear: {}", e));
        }

        // Step 3: Apply new serial numbers to the main table
        if let Err(e) = self.conn.execute(
            "UPDATE leads SET sl = _sl_renum.new_sl
         FROM _sl_renum WHERE leads.id = _sl_renum.id",
            [],
        ) {
            self.conn.execute("ROLLBACK", []).ok();
            return Err(format!("renumber update: {}", e));
        }

        // Step 4: Drop temp table
        let _ = self.conn.execute("DROP TABLE IF EXISTS _sl_renum", []);

        self.conn.execute("COMMIT", []).ok();
        Ok(())
    }

    pub fn delete_forever(&self, ids: Vec<i64>) -> Result<(), String> {
        if ids.is_empty() {
            return Ok(());
        }
        let id_list = ids
            .iter()
            .map(|id| id.to_string())
            .collect::<Vec<_>>()
            .join(",");
        self.conn
            .execute(&format!("DELETE FROM leads WHERE id IN ({})", id_list), [])
            .map_err(|e| e.to_string())?;
        self.renumber_sl()
    }

    pub fn optimize_db(&self) -> Result<(), String> {
        self.conn.execute("VACUUM", []).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn clear_all_leads(&self) -> Result<i64, String> {
        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM leads", [], |r| r.get(0))
            .unwrap_or(0);
        self.conn
            .execute("DELETE FROM leads", [])
            .map_err(|e| e.to_string())?;
        // Reset sequence so next import starts sl from 1
        self.conn
            .execute("DROP SEQUENCE IF EXISTS leads_seq", [])
            .map_err(|e| e.to_string())?;
        self.conn
            .execute("CREATE SEQUENCE IF NOT EXISTS leads_seq START 1", [])
            .map_err(|e| e.to_string())?;
        self.conn.execute("VACUUM", []).ok();
        Ok(count)
    }
}
