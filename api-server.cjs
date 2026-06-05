// Local API server - reads from the Dimarz SQLite database and serves it to the browser
const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const os = require('os');

const DB_PATH = path.join(os.homedir(), '.local/share/com.dimrz.desktop/dimrz.db');
const PORT = 4321;

console.log(`Opening database: ${DB_PATH}`);
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sl INTEGER,
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
    generated_person TEXT,
    status TEXT,
    priority TEXT,
    source TEXT,
    last_contact TEXT,
    assigned_to TEXT
  )
`);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// GET /api/leads?search=&status=&page=1&page_size=50
app.get('/api/leads', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 50;
    const offset = (page - 1) * pageSize;

    let filters = {};
    if (req.query.filters) {
      try {
        filters = JSON.parse(req.query.filters);
      } catch (e) {}
    }

    let conditions = ['1=1'];
    let params = [];

    if (filters.search) {
      conditions.push('(business_name LIKE ? OR person_name LIKE ? OR business_email LIKE ? OR industry LIKE ? OR country LIKE ?)');
      const pattern = `%${filters.search}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }
    if (filters.countries && filters.countries.length > 0) {
      conditions.push(`country IN (${filters.countries.map(() => '?').join(',')})`);
      params.push(...filters.countries);
    }
    if (filters.industries && filters.industries.length > 0) {
      conditions.push(`industry IN (${filters.industries.map(() => '?').join(',')})`);
      params.push(...filters.industries);
    }
    if (filters.niches && filters.niches.length > 0) {
      conditions.push(`niche IN (${filters.niches.map(() => '?').join(',')})`);
      params.push(...filters.niches);
    }
    if (filters.sizes && filters.sizes.length > 0) {
      conditions.push(`size IN (${filters.sizes.map(() => '?').join(',')})`);
      params.push(...filters.sizes);
    }
    if (filters.generated && filters.generated.length > 0) {
      conditions.push(`generated_person IN (${filters.generated.map(() => '?').join(',')})`);
      params.push(...filters.generated);
    }
    if (filters.statuses && filters.statuses.length > 0) {
      conditions.push(`status IN (${filters.statuses.map(() => '?').join(',')})`);
      params.push(...filters.statuses);
    }
    if (filters.priorities && filters.priorities.length > 0) {
      conditions.push(`priority IN (${filters.priorities.map(() => '?').join(',')})`);
      params.push(...filters.priorities);
    }

    const where = conditions.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) as c FROM leads WHERE ${where}`).get(...params).c;
    const leads = db.prepare(`SELECT * FROM leads WHERE ${where} ORDER BY sl, id LIMIT ? OFFSET ?`).all(...params, pageSize, offset);

    res.json({
      leads,
      total,
      page,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/export - returns CSV as download
app.post('/api/leads/export', (req, res) => {
  try {
    const { 
      search = '', status = '', client = '', additional_info = '', generated_person = '',
      country = '', state = '', city = '', industry = '', title = '', limit = null, columns = null
    } = req.body;
    
    let conditions = ['1=1'];
    let params = [];

    if (search) {
      conditions.push('(business_name LIKE ? OR person_name LIKE ? OR business_email LIKE ?)');
      const p = `%${search}%`;
      params.push(p, p, p);
    }
    if (status && status !== 'All Statuses') {
      conditions.push('status = ?');
      params.push(status);
    }
    if (country) { conditions.push('country LIKE ?'); params.push(`%${country}%`); }
    if (state) { conditions.push('state LIKE ?'); params.push(`%${state}%`); }
    if (city) { conditions.push('city LIKE ?'); params.push(`%${city}%`); }
    if (industry) { conditions.push('industry LIKE ?'); params.push(`%${industry}%`); }
    if (title) { conditions.push('title LIKE ?'); params.push(`%${title}%`); }
    if (additional_info) { conditions.push('additional_info LIKE ?'); params.push(`%${additional_info}%`); }
    if (generated_person) { conditions.push('generated_person LIKE ?'); params.push(`%${generated_person}%`); }
    if (client && client !== 'All Clients') { conditions.push('(assigned_to LIKE ? OR source LIKE ?)'); params.push(`%${client}%`, `%${client}%`); }

    const where = conditions.join(' AND ');
    
    let query = `SELECT * FROM leads WHERE ${where} ORDER BY sl, id`;
    if (limit && !isNaN(parseInt(limit))) {
      query += ` LIMIT ?`;
      params.push(parseInt(limit));
    }

    const leads = db.prepare(query).all(...params);

    const allHeaders = ['sl','country','industry','niche','business_name','person_name','title','business_email','phone','address','city','state','website','person_linkedin','company_linkedin','personal_email','revenue','size','additional_info','generated_person','status','priority','source','last_contact','assigned_to'];
    
    const exportHeaders = Array.isArray(columns) && columns.length > 0 ? columns : allHeaders;
    
    const csvLines = [exportHeaders.join(',')];
    for (const l of leads) {
      csvLines.push(exportHeaders.map(h => `"${(l[h] || '').toString().replace(/"/g, '""')}"`).join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="dimrz_leads_export.csv"');
    res.send(csvLines.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/audit - parse CSV and check duplicates
app.post('/api/leads/audit', (req, res) => {
  try {
    const { csvData } = req.body;
    if (!csvData) {
      return res.status(400).json({ error: "No csvData provided" });
    }

    const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      return res.status(400).json({ error: "CSV does not contain any data rows" });
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    
    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current);
      return result.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    };

    let total = 0, valid = 0, hard_duplicates = 0, soft_warnings = 0;
    const rows = [];

    // Prepared statements for duplicate checks
    const checkHard = db.prepare(`SELECT 1 FROM leads WHERE (business_email = ? AND business_email != '') OR (personal_email = ? AND personal_email != '') OR (phone = ? AND phone != '') OR (person_linkedin = ? AND person_linkedin != '') LIMIT 1`);
    const checkSoft = db.prepare(`SELECT 1 FROM leads WHERE (website = ? AND website != '') OR (company_linkedin = ? AND company_linkedin != '') OR (business_name = ? AND business_name != '') LIMIT 1`);

    db.transaction(() => {
      for (let i = 1; i < lines.length; i++) {
        const parsedRow = parseLine(lines[i]);
        if (parsedRow.length === 0) continue;
        
        const getValue = (key) => {
          const idx = headers.indexOf(key);
          return idx !== -1 ? parsedRow[idx] : '';
        };

        const business_email = getValue('business_email');
        const personal_email = getValue('personal_email');
        const phone = getValue('phone');
        const person_linkedin = getValue('person_linkedin');
        
        const website = getValue('website');
        const company_linkedin = getValue('company_linkedin');
        const business_name = getValue('business_name');

        const isHard = checkHard.get(business_email, personal_email, phone, person_linkedin);
        let status = 'VALID';
        
        if (isHard) {
          status = 'HARD_DUPLICATE';
          hard_duplicates++;
        } else {
          const isSoft = checkSoft.get(website, company_linkedin, business_name);
          if (isSoft) {
            status = 'SOFT_WARNING';
            soft_warnings++;
          } else {
            valid++;
          }
        }
        
        total++;
        rows.push({
          row_number: total,
          business_email,
          phone,
          business_name,
          country: getValue('country'),
          industry: getValue('industry'),
          niche: getValue('niche'),
          person_name: getValue('person_name'),
          title: getValue('title'),
          address: getValue('address'),
          city: getValue('city'),
          state: getValue('state'),
          website,
          person_linkedin,
          company_linkedin,
          personal_email,
          revenue: getValue('revenue'),
          size: getValue('size'),
          additional_info: getValue('additional_info'),
          generated_person: getValue('generated_person') || 'Auto',
          status_field: getValue('status') || 'New',
          priority: getValue('priority') || 'Medium',
          audit_status: status
        });
      }
    })();

    res.json({ rows, stats: { total, valid, hard_duplicates, soft_warnings } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leads/import - commit validated rows
app.post('/api/leads/import', (req, res) => {
  try {
    const { rows, clientProfile, workspaceNode } = req.body;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: "No rows array provided" });
    }

    const stmt = db.prepare(`
      INSERT INTO leads (
        country, industry, niche, business_name, person_name, title, business_email, phone, address, city, state, website,
        person_linkedin, company_linkedin, personal_email, revenue, size, additional_info, generated_person, status, priority, sl,
        assigned_to, source
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sl), 0) + 1 FROM leads), ?, ?
      )
    `);

    let imported = 0;
    let failed = 0;

    db.transaction(() => {
      for (const row of rows) {
        try {
          stmt.run(
            row.country, row.industry, row.niche, row.business_name,
            row.person_name, row.title, row.business_email, row.phone,
            row.address, row.city, row.state, row.website,
            row.person_linkedin, row.company_linkedin, row.personal_email,
            row.revenue, row.size, row.additional_info, row.generated_person,
            row.status_field, row.priority, clientProfile, workspaceNode
          );
          imported++;
        } catch (e) {
          failed++;
          console.error("Failed to insert row:", e);
        }
      }
    })();

    res.json({ imported, failed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Dimarz API server running at http://127.0.0.1:${PORT}`);
  console.log(`   Serving leads from: ${DB_PATH}`);
});
