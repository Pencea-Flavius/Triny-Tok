import { TikTokIOConnection } from '../socket.js';
import { showToast } from './dialog.js';

let socket = null;
let mcIsConnected = false;

export function initMinecraftUI(ioConnection) {
    socket = ioConnection.socket;

    // grab html elements
    const hostInput = $('#minecraftHost');
    const portInput = $('#minecraftPort');
    const connectBtn = $('#mcConnectBtn');
    const statusDot = $('#mcStatusDot');
    const statusText = $('#mcStatusText');
    const targetPlayersInput = $('#targetPlayersInput');
    const autoConnectCheckbox = $('#autoConnectRcon');
    const rconLog = $('#rconLog');
    const rconCmdInput = $('#rconCmdInput');
    const rconSendBtn = $('#rconSendBtn');
    const saveSettingsBtn = $('#mcSaveSettingsBtn');

    function logRcon(text, color, subtext = '') {
        if (!rconLog.length) return;
        const line = $('<div style="margin-bottom: 4px;"></div>');
        const ts = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        line.html(`
            <span style="color:var(--dim); font-size: 11px;">[${ts}]</span> 
            <span style="color:${color || 'var(--muted)'};">${text}</span>
            ${subtext ? `<br><span style="color:var(--dim); font-size: 11px; margin-left: 65px;">└ ${subtext}</span>` : ''}
        `);
        rconLog.append(line);
        rconLog.scrollTop(rconLog[0].scrollHeight);
    }

    // load previously saved target players
    fetch('/api/config')
        .then(res => res.json())
        .then(data => {
            if (data.success && data.config && data.config.targetPlayers) {
                targetPlayersInput.val(data.config.targetPlayers.join('\n'));
            }
        })
        .catch(console.error);

    // save target players when you click away
    targetPlayersInput.on('blur', () => {
        const lines = targetPlayersInput.val().split('\n').map(p => p.trim()).filter(p => p.length > 0);
        fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetPlayers: lines })
        }).catch(console.error);
    });

    // socket listeners
    socket.on('minecraftStatus', (data) => {
        updateStatus(data.isConnected, data.config);
    });

    socket.on('minecraftError', (err) => {
        showToast('Minecraft Error: ' + err, 'error', 6000);
        statusText.text('Error: ' + err).css('color', 'var(--danger)');
        statusDot.css('background', 'var(--danger)');
        logRcon('Connection Error: ' + err, 'var(--danger)');
    });

    socket.on('rconLog', (data) => {
        let color = 'var(--text)';
        let prefix = '> ';
        if (data.type === 'gift') {
            color = 'var(--accent)';
            prefix = `[Gift: ${data.giftName}] `;
        } else if (data.type === 'test') {
            color = 'var(--warning)';
            prefix = '[Test] ';
        } else if (data.type === 'error') {
            color = 'var(--danger)';
        }

        logRcon(`${prefix}${data.command}`, color, data.response);
    });

    socket.on('gift', (data) => {
        // server emits rconLog for gifts so ignore this
    });

    // handle connect/disconnect click
    connectBtn.click(() => {
        if (!mcIsConnected) {
            const host = hostInput.val() || 'localhost';
            const port = parseInt(portInput.val()) || 25575;
            const password = $('#minecraftPassword').val() || '';
            const autoConnect = autoConnectCheckbox.is(':checked');
            socket.emit('minecraftConnect', { host, port, password, autoConnect });
            connectBtn.text('Connecting...').prop('disabled', true);
            logRcon(`Connecting to ${host}:${port}...`, 'var(--warning)');
        } else {
            socket.emit('minecraftDisconnect');
            logRcon('Disconnecting...', 'var(--warning)');
        }
    });

    // save settings without connecting
    saveSettingsBtn.click(async () => {
        const host = hostInput.val() || 'localhost';
        const port = parseInt(portInput.val()) || 25575;
        const password = $('#minecraftPassword').val() || '';
        const autoConnect = autoConnectCheckbox.is(':checked');
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ minecraft: { host, port, password, autoConnect, enabled: mcIsConnected } })
            });
            showToast('RCON settings saved!', 'success');
        } catch (e) {
            showToast('Failed to save settings', 'error');
        }
    });

    // send manual command
    rconSendBtn.click(() => {
        const cmd = rconCmdInput.val().trim();
        if (cmd) {
            socket.emit('rconCommand', cmd);
            rconCmdInput.val('');
        }
    });

    rconCmdInput.on('keyup', (e) => {
        if (e.key === 'Enter') rconSendBtn.click();
    });
}

function updateStatus(isConnected, config) {
    mcIsConnected = !!isConnected;
    const hostInput = $('#minecraftHost');
    const portInput = $('#minecraftPort');
    const passwordInput = $('#minecraftPassword');
    const connectBtn = $('#mcConnectBtn');
    const statusDot = $('#mcStatusDot');
    const statusText = $('#mcStatusText');
    const autoConnectCheckbox = $('#autoConnectRcon');
    const railDotMC = $('#railDotMinecraft');
    const sidebarDot = $('#mcStatusSidebarDot');

    if (config) {
        hostInput.val(config.host);
        portInput.val(config.port);
        if (config.password) {
            passwordInput.val(config.password);
        }
        if (config.autoConnect !== undefined) {
            autoConnectCheckbox.prop('checked', config.autoConnect);
        }
    }

    if (isConnected) {
        statusText.text('Connected').css('color', 'var(--success)');
        statusDot.css({ background: 'var(--success)', boxShadow: '0 0 10px var(--success)' });
        sidebarDot.css({ background: '#27ae60', boxShadow: '0 0 4px #27ae60', display: 'block' });
        connectBtn.text('Disconnect').prop('disabled', false).removeClass('btn-primary btn-danger').addClass('btn-secondary');
        hostInput.prop('disabled', true);
        portInput.prop('disabled', true);
        passwordInput.prop('disabled', true);
    } else {
        statusText.text('Disconnected').css('color', 'var(--danger)');
        statusDot.css('background', 'var(--danger)');
        sidebarDot.css({ background: 'transparent', boxShadow: 'none', display: 'none' });
        connectBtn.text('Connect').prop('disabled', false).removeClass('btn-danger').addClass('btn-primary');
        hostInput.prop('disabled', false);
        portInput.prop('disabled', false);
        passwordInput.prop('disabled', false);
    }
}
