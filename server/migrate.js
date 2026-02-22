import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

async function migrateData() {
    const localDbUrl = 'postgresql://postgres:Lukaskukas@localhost:5432/terratales';
    const remoteDbUrl = process.env.DATABASE_URL;

    console.log('Connecting to local DB...');
    const localClient = new Client({ connectionString: localDbUrl });
    await localClient.connect();

    console.log('Connecting to remote Supabase DB...');
    const remoteClient = new Client({ connectionString: remoteDbUrl });
    await remoteClient.connect();

    const tables = [
        'users',
        'verification_tokens',
        'trips',
        'locations'
    ];

    try {
        for (const table of tables) {
            console.log(`\n--- Migrating table: ${table} ---`);

            const localResult = await localClient.query(`SELECT * FROM ${table}`);
            const rows = localResult.rows;
            console.log(`Found ${rows.length} rows in local DB.`);

            if (rows.length === 0) {
                console.log(`Skipping empty table ${table}.`);
                continue;
            }

            // We need to insert these rows into the remote DB.
            // Easiest is to generate an INSERT query with all columns.
            // Let's get the columns from the first row.
            const columns = Object.keys(rows[0]);

            let insertedCount = 0;
            for (const row of rows) {
                const values = columns.map(col => {
                    let val = row[col];
                    if (val !== null && typeof val === 'object' && !(val instanceof Date) && !Array.isArray(val)) {
                        return JSON.stringify(val);
                    }
                    if (val !== null && Array.isArray(val) && (col === 'external_links' || col === 'day_comments')) {
                        // for json fields holding arrays like external_links
                        return JSON.stringify(val);
                    }
                    return val;
                });
                const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
                const queryText = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;

                try {
                    await remoteClient.query(queryText, values);
                    insertedCount++;
                } catch (insertErr) {
                    console.error(`Error inserting row into ${table}:`, insertErr.message);
                }
            }

            console.log(`Successfully migrated ${insertedCount} rows for table ${table}.`);
        }

        console.log('\nMigration completed successfully!');

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await localClient.end();
        await remoteClient.end();
    }
}

migrateData();
