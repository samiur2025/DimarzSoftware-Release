use duckdb::{Connection, Result};
fn main() -> Result<()> {
    let conn = Connection::open("/home/samiur/.local/share/com.dimrz.desktop/dimrz.duckdb")?;
    let mut stmt = conn.prepare("SELECT * FROM leads WHERE is_deleted = false ORDER BY sl LIMIT 1 OFFSET 0")?;
    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        println!("Row read successfully.");
        // Try reading 28 and 29
        let f: Option<String> = row.get(28)?;
        let i: Option<String> = row.get(29)?;
        println!("fb: {:?}, ig: {:?}", f, i);
    }
    Ok(())
}
