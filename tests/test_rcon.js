const { Rcon } = require('rcon-client');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config/config.json');

async function testRconConnection() {
    console.log('--- Triny-Tok Automated RCON Test ---');
    
    // 1. Read config
    let config;
    try {
        if (!fs.existsSync(configPath)) {
            throw new Error(`Config file not found at ${configPath}`);
        }
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
        console.error('❌ Failed to read config:', err.message);
        process.exit(1);
    }

    const mcConfig = config.minecraft;
    if (!mcConfig) {
        console.error('❌ Minecraft config section missing in config.json.');
        process.exit(1);
    }

    const host = mcConfig.host || 'localhost';
    const port = mcConfig.port || 25575;
    const password = mcConfig.password || '';

    console.log(`\n⏳ Attempting to connect to RCON at ${host}:${port}...`);
    
    // 2. Perform connection test
    let rconClient = null;
    let success = false;
    try {
        rconClient = await Rcon.connect({
            host: host,
            port: port,
            password: password,
            timeout: 5000 // 5 seconds timeout for faster test
        });
        
        console.log('✅ Connection Successful! The RCON port is reachable and the password is correct.');
        
        // 3. Test sending a basic command
        console.log('⏳ Testing command execution (list)...');
        const response = await rconClient.send('list');
        console.log(`✅ Command execution successful. Server response: "${response}"`);
        
        success = true;
    } catch (err) {
        console.error('\n❌ RCON Connection Test Failed!');
        let errMsg = err.message || err.toString() || 'Unknown Error';
        if (err.errors && Array.isArray(err.errors)) {
            errMsg += ' (' + err.errors.map(e => e.message || e.toString()).join('; ') + ')';
        }
        console.error(`Error details: ${errMsg}`);
        
        // Output debugging hints based on the error
        console.log('\n--- Debugging Hints ---');
        if (errMsg.includes('ECONNREFUSED')) {
            console.log('Hint: The port is completely closed or the MC server is stopped. Make sure the port is actually an RCON port, not the Minecraft game port.');
        } else if (errMsg.includes('Timeout')) {
            console.log('Hint: The port accepted the connection but dropped the RCON handshake. You are likely putting the Minecraft SERVER/JOIN port instead of the RCON port, OR the host has a DDoS proxy blocking RCON.');
        } else if (errMsg.includes('Auth failed')) {
            console.log('Hint: The connection succeeded, but the password provided in config.json is completely wrong.');
        }
        success = false;
    } finally {
        if (rconClient) {
            await rconClient.end();
        }
    }

    // Exit with appropriate status code for CI/CD integrations
    if (success) {
        console.log('\n🎉 All automated tests passed!');
        process.exit(0);
    } else {
        process.exit(1);
    }
}

testRconConnection();
