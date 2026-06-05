use duckdb::Connection;
use std::collections::HashSet;

fn main() {
    let conn = Connection::open("/home/samiur/.local/share/com.dimrz.desktop/dimrz.duckdb").unwrap();
    let mut stmt = conn.prepare("SELECT business_email, personal_email, phone, person_linkedin, website, company_linkedin, business_name FROM leads WHERE is_deleted = false").unwrap();
    
    let mut rows_iter = stmt.query([]).unwrap();
    let mut count = 0;
    while let Some(row) = rows_iter.next().unwrap_or(None) {
        count += 1;
    }
    println!("Rows fetched: {}", count);
}
