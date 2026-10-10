'use strict';

/**
 * Environment-backed OTP delivery adapters.
 * Resend: RESEND_API_KEY + OTP_EMAIL_FROM
 * Twilio: TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM_NUMBER
 * Credentials must be configured as deployment secrets; never log OTP or recipient payloads.
 */
function createEnvironmentOtpTransport(env = process.env, fetchImpl = globalThis.fetch) {
    return async function sendOtp({ channel, identifier, code, purpose = 'registration' }) {
        if (typeof fetchImpl !== 'function') throw new Error('OTP provider requires Node.js fetch support.');
        const purposeText = purpose === 'registration' ? 'đăng ký tài khoản' : 'xác minh tài khoản';
        const message = `Mã xác minh Hành Trình Mới của bạn là ${code}. Mã có hiệu lực trong 10 phút. Dùng cho ${purposeText}. Không chia sẻ mã này với bất kỳ ai.`;
        let response;
        if (channel === 'email') {
            const apiKey = String(env.RESEND_API_KEY || '').trim();
            const from = String(env.OTP_EMAIL_FROM || '').trim();
            if (!apiKey || !from) throw new Error('OTP email provider is not configured. Set RESEND_API_KEY and OTP_EMAIL_FROM.');
            response = await fetchImpl('https://api.resend.com/emails', {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ from, to: [identifier], subject: 'Mã xác minh Hành Trình Mới', text: message })
            });
        } else if (channel === 'phone') {
            const sid = String(env.TWILIO_ACCOUNT_SID || '').trim();
            const token = String(env.TWILIO_AUTH_TOKEN || '').trim();
            const from = String(env.TWILIO_FROM_NUMBER || '').trim();
            if (!sid || !token || !from) throw new Error('OTP SMS provider is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER.');
            const form = new URLSearchParams({ To: identifier, From: from, Body: message });
            response = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: form.toString()
            });
        } else {
            throw new Error('Unsupported OTP channel.');
        }
        if (!response || !response.ok) {
            // Do not surface provider response bodies; they can contain recipient or account details.
            throw new Error(`OTP provider request failed (${response?.status || 'no response'}).`);
        }
    };
}

module.exports = { createEnvironmentOtpTransport };
