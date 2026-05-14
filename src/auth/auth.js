const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../database/db_manager');

const SALT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function getTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

async function sendVerificationEmail(email, token, baseUrl) {
    const link = `${baseUrl}/verify-email/${token}`;
    const transporter = getTransporter();
    await transporter.sendMail({
        from: `"TrinyTok" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Confirm your TrinyTok account',
        html: `<p>Click the link below to verify your email address. The link expires in 24 hours.</p>
               <p><a href="${link}">${link}</a></p>`,
    });
}

async function sendPasswordResetEmail(email, token, baseUrl) {
    const link = `${baseUrl}/password-reset/${token}`;
    const transporter = getTransporter();
    await transporter.sendMail({
        from: `"TrinyTok" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Reset your TrinyTok password',
        html: `<p>Click the link below to reset your password. The link expires in 1 hour.</p>
               <p><a href="${link}">${link}</a></p>
               <p>If you didn't request this, you can ignore this email.</p>`,
    });
}

async function register({ username, email, firstName, lastName, password, birthDate }) {
    const globalDb = await db.connectGlobal();

    const existing = await globalDb.get(
        'SELECT id FROM app_accounts WHERE email = ? OR username = ?',
        [email, username]
    );
    if (existing) {
        const conflict = await globalDb.get(
            'SELECT email, username FROM app_accounts WHERE id = ?',
            [existing.id]
        );
        if (conflict.email === email) throw Object.assign(new Error('Email already in use'), { field: 'email' });
        throw Object.assign(new Error('Username already taken'), { field: 'username' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    await globalDb.run(
        `INSERT INTO app_accounts (username, email, first_name, last_name, password_hash, birth_date, verification_token)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [username, email, firstName, lastName, passwordHash, birthDate, verificationToken]
    );

    return verificationToken;
}

async function verifyEmail(token) {
    const globalDb = await db.connectGlobal();
    const account = await globalDb.get(
        'SELECT id FROM app_accounts WHERE verification_token = ? AND email_verified = 0',
        [token]
    );
    if (!account) throw new Error('Invalid or already used verification link');

    await globalDb.run(
        'UPDATE app_accounts SET email_verified = 1, verification_token = NULL WHERE id = ?',
        [account.id]
    );
}

async function login(email, password) {
    const globalDb = await db.connectGlobal();
    const account = await globalDb.get(
        'SELECT * FROM app_accounts WHERE email = ?',
        [email]
    );
    if (!account) throw Object.assign(new Error('Invalid email or password'), { field: 'email' });

    const match = await bcrypt.compare(password, account.password_hash);
    if (!match) throw Object.assign(new Error('Invalid email or password'), { field: 'password' });

    if (!account.email_verified) throw Object.assign(new Error('Please verify your email before signing in'), { field: 'email', code: 'unverified' });

    return {
        id: account.id,
        username: account.username,
        email: account.email,
        firstName: account.first_name,
        lastName: account.last_name,
        isAdmin: account.is_admin === 1,
    };
}

async function requestPasswordReset(email) {
    const globalDb = await db.connectGlobal();
    const account = await globalDb.get('SELECT id FROM app_accounts WHERE email = ?', [email]);
    if (!account) return; // silently do nothing — don't leak whether email exists

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

    await globalDb.run(
        'UPDATE app_accounts SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        [token, expires, account.id]
    );

    return token;
}

async function resetPassword(token, newPassword) {
    const globalDb = await db.connectGlobal();
    const account = await globalDb.get(
        `SELECT id FROM app_accounts WHERE reset_token = ? AND reset_token_expires > datetime('now')`,
        [token]
    );
    if (!account) throw new Error('Reset link is invalid or has expired');

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await globalDb.run(
        'UPDATE app_accounts SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
        [passwordHash, account.id]
    );
}

function requireAuth(req, res, next) {
    if (req.session && req.session.user) return next();
    res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.isAdmin) return next();
    const wantsJson = req.accepts('json') && !req.accepts('html');
    if (wantsJson) return res.status(403).json({ success: false, error: 'Forbidden' });
    res.redirect('/');
}

module.exports = { register, verifyEmail, login, requestPasswordReset, resetPassword, sendVerificationEmail, sendPasswordResetEmail, requireAuth, requireAdmin };
