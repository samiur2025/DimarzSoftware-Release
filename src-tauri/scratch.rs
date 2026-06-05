use duckdb::{Connection, params};
fn test() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute("CREATE TABLE leads (id INTEGER)", []).unwrap();
    let mut app = conn.appender("leads").unwrap();
    app.append_row(params![1]).unwrap();
}
