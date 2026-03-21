import psycopg2
conn = psycopg2.connect('postgresql://root:cly1xryo40000yq1f467vbx4t@146.190.155.109:5432/outmate')
cur = conn.cursor()
cur.execute("SELECT entity_name, source_url FROM event_cache WHERE entity_type='prospect' LIMIT 5;")
for row in cur.fetchall():
    print(row)
