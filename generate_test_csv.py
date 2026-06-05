import os
import sys

target_size = 550 * 1024 * 1024 # 550MB
file_name = "test_leads_550mb.csv"

header = "country,industry,niche,business_name,person_name,title,business_email,phone,address,city,state,website,person_linkedin,company_linkedin,personal_email,revenue,size,additional_info,assigned_to,source\n"
row = "USA,Technology,Software,Acme Corp,John Doe,CEO,john@acme.com,555-0100,123 Main St,San Francisco,CA,acme.com,linkedin.com/in/john,linkedin.com/company/acme,john.doe@gmail.com,10M,50-100,Notes go here,Admin,TestImport\n"

with open(file_name, "w") as f:
    f.write(header)
    written = len(header)
    row_bytes = len(row.encode('utf-8'))
    
    chunk_size = 100000
    chunk = row * chunk_size
    chunk_bytes = len(chunk.encode('utf-8'))
    
    while written < target_size:
        f.write(chunk)
        written += chunk_bytes
        
print(f"Generated {file_name} ({written / (1024*1024):.2f} MB)")
