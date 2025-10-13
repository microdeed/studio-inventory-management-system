const http = require('http');

const PORT = 5001;

function testEndpoint(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(body);
                    resolve({ status: res.statusCode, data: response });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function runTests() {
    console.log('Testing API endpoints...\n');

    try {
        // Test health
        console.log('1. Testing health endpoint...');
        const health = await testEndpoint('GET', '/api/health');
        console.log(`   Status: ${health.status}`);
        console.log(`   Response: ${JSON.stringify(health.data)}\n`);

        // Test equipment list
        console.log('2. Testing equipment list...');
        const equipment = await testEndpoint('GET', '/api/equipment?limit=2');
        console.log(`   Status: ${equipment.status}`);
        if (equipment.data.data && equipment.data.data.length > 0) {
            const item = equipment.data.data[0];
            console.log(`   First item: ${item.name}`);
            console.log(`   Has barcode: ${item.barcode ? 'YES (' + item.barcode + ')' : 'NO'}`);
            console.log(`   Has serial: ${item.serial_number ? 'YES' : 'NO'}`);
            console.log(`   Has category: ${item.category_name ? 'YES (' + item.category_name + ')' : 'NO'}\n`);

            // Test equipment update
            console.log('3. Testing equipment update...');
            const updateData = {
                notes: 'Test update from API test script - ' + new Date().toISOString()
            };
            const update = await testEndpoint('PUT', `/api/equipment/${item.id}`, updateData);
            console.log(`   Status: ${update.status}`);
            console.log(`   Response: ${update.status === 200 ? 'SUCCESS' : JSON.stringify(update.data)}\n`);
        } else {
            console.log(`   Error: ${JSON.stringify(equipment.data)}\n`);
        }

        // Test users list
        console.log('4. Testing users list...');
        const users = await testEndpoint('GET', '/api/users');
        console.log(`   Status: ${users.status}`);
        if (users.data.length > 0) {
            const user = users.data[0];
            console.log(`   First user: ${user.full_name}`);

            // Test user update
            console.log('\n5. Testing user update...');
            const userUpdateData = {
                phone: '555-TEST-' + Date.now().toString().slice(-4)
            };
            const userUpdate = await testEndpoint('PUT', `/api/users/${user.id}`, userUpdateData);
            console.log(`   Status: ${userUpdate.status}`);
            console.log(`   Response: ${userUpdate.status === 200 ? 'SUCCESS' : JSON.stringify(userUpdate.data)}`);
        } else {
            console.log(`   Error: ${JSON.stringify(users.data)}`);
        }

    } catch (error) {
        console.error('Test failed:', error.message);
        console.log('\nMake sure the backend server is running on port ' + PORT);
    }
}

runTests();
