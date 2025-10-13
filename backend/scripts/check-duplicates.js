const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '../../data/Equipment Inventory (Incomplete).csv');

console.log('Checking for duplicate serial numbers in CSV...\n');

const fileContent = fs.readFileSync(csvPath, 'utf8');
const lines = fileContent.split('\n');
const dataLines = lines.slice(3);
const csvContent = dataLines.join('\n');

const { Readable } = require('stream');
const rows = [];
const serialCounts = {};
const duplicates = [];

Readable.from([csvContent])
    .pipe(csv())
    .on('data', (row) => {
        if (row['Name/Model'] && row['Name/Model'].trim() !== '') {
            rows.push(row);

            const serial = row.Serial?.trim();
            if (serial) {
                if (!serialCounts[serial]) {
                    serialCounts[serial] = [];
                }
                serialCounts[serial].push(row['Name/Model']);
            }
        }
    })
    .on('end', () => {
        console.log(`Total equipment in CSV: ${rows.length}\n`);

        // Find duplicates
        Object.entries(serialCounts).forEach(([serial, items]) => {
            if (items.length > 1) {
                duplicates.push({ serial, items });
            }
        });

        if (duplicates.length > 0) {
            console.log(`Found ${duplicates.length} duplicate serial numbers:\n`);
            duplicates.forEach(dup => {
                console.log(`Serial "${dup.serial}" used ${dup.items.length} times:`);
                dup.items.forEach(item => console.log(`  - ${item}`));
                console.log('');
            });
        } else {
            console.log('No duplicate serial numbers found.');
        }

        // Check for empty serials
        const emptySerials = rows.filter(r => !r.Serial || r.Serial.trim() === '');
        console.log(`\nEquipment without serial numbers: ${emptySerials.length}`);
        if (emptySerials.length > 0 && emptySerials.length <= 10) {
            emptySerials.forEach(r => console.log(`  - ${r['Name/Model']}`));
        }
    });
