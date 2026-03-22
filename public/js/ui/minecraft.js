import { TikTokIOConnection } from '../socket.js';

let socket = null;

export function initMinecraftUI(ioConnection) {
    socket = ioConnection.socket;

    // UI Elements
    const hostInput = $('#minecraftHost');
    const portInput = $('#minecraftPort');
    const connectBtn = $('#mcConnectBtn');
    const statusDot = $('#mcStatusDot');
    const statusText = $('#mcStatusText');

    // Socket Events
    socket.on('minecraftStatus', (data) => {
        updateStatus(data.isConnected, data.config);
    });

    socket.on('minecraftError', (err) => {
        alert('Minecraft Error: ' + err);
        statusText.text('Error: ' + err).css('color', 'var(--danger)');
        statusDot.css('background', 'var(--danger)');
    });

    // Button Click
    connectBtn.click(() => {
        if (connectBtn.text() === 'Connect') {
            const host = hostInput.val() || 'localhost';
            const port = parseInt(portInput.val()) || 25575;
            const password = $('#minecraftPassword').val() || '';
            socket.emit('minecraftConnect', { host, port, password });
            connectBtn.text('Connecting...').prop('disabled', true);
        } else {
            socket.emit('minecraftDisconnect');
        }
    });
}

function updateStatus(isConnected, config) {
    const hostInput = $('#minecraftHost');
    const portInput = $('#minecraftPort');
    const passwordInput = $('#minecraftPassword');
    const connectBtn = $('#mcConnectBtn');
    const statusDot = $('#mcStatusDot');
    const statusText = $('#mcStatusText');

    if (config) {
        hostInput.val(config.host);
        portInput.val(config.port);
        if (config.password) {
            passwordInput.val(config.password);
        }
    }

    if (isConnected) {
        statusText.text('Connected').css('color', 'var(--success)');
        statusDot.css('background', 'var(--success)');
        connectBtn.text('Disconnect').prop('disabled', false).removeClass('btn-primary').addClass('btn-danger');
        hostInput.prop('disabled', true);
        portInput.prop('disabled', true);
        passwordInput.prop('disabled', true);
    } else {
        statusText.text('Disconnected').css('color', 'var(--danger)');
        statusDot.css('background', 'var(--danger)');
        connectBtn.text('Connect').prop('disabled', false).removeClass('btn-danger').addClass('btn-primary');
        hostInput.prop('disabled', false);
        portInput.prop('disabled', false);
        passwordInput.prop('disabled', false);
    }
}
