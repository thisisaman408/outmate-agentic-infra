const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const migrate = async () => {
    try {
        // Use absolute path to the artifact
        const schemaPath = 'C:\\Users\\Hp\\.gemini\\antigravity\\brain\\c463b31d-0576-4e72-ae71-626c7e6a6d06\\schema.sql';

        // Read schema file
        if (!fs.existsSync(schemaPath)) {
            console.error('Schema file not found at:', schemaPath);
            process.exit(1);
        }

        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Running migration...');
        await db.query(schemaSql);
        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
