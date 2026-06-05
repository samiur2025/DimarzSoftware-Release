import duckdb from 'duckdb';
const db = new duckdb.Database(':memory:');
db.all(`
CREATE SEQUENCE leads_seq;
CREATE TABLE leads (id INTEGER PRIMARY KEY DEFAULT nextval('leads_seq'), sl INTEGER UNIQUE, is_deleted BOOLEAN DEFAULT false);
INSERT INTO leads (sl, is_deleted) VALUES (1, false), (2, false), (3, false);
`, (err) => {
    if (err) console.error(err);
    db.all("UPDATE leads SET is_deleted = true, sl = NULL WHERE id IN (2);", (err) => {
        if (err) console.error("Move to trash error:", err);
        db.all("CREATE TEMP TABLE _sl_renum AS SELECT id, CAST(ROW_NUMBER() OVER (ORDER BY sl NULLS LAST, id) AS BIGINT) AS new_sl FROM leads WHERE is_deleted = false", (err) => {
             if (err) console.error("Temp table error:", err);
             db.all("UPDATE leads SET sl = NULL", (err) => {
                  if (err) console.error("Clear error:", err);
                  db.all("UPDATE leads SET sl = _sl_renum.new_sl FROM _sl_renum WHERE leads.id = _sl_renum.id", (err) => {
                       if (err) console.error("Update error:", err);
                       db.all("SELECT * FROM leads", (err, rows) => {
                           console.log(rows);
                       });
                  });
             });
        });
    });
});
