import crypto from 'crypto';

export default function handler(req, res) {
    const clientId = process.env.X_CLIENT_ID;

    if (!clientId) {
        return res.status(500).json({ error: 'X_CLIENT_ID not configured' });
    }

    // Determine the correct base URL
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${proto}://${host}/api/x-callback`;

    // Generate PKCE values
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
    const state = crypto.randomBytes(16).toString('hex');

    // Store verifier + state in httpOnly cookies (expire in 10 min)
    res.setHeader('Set-Cookie', [
        `x_cv=${codeVerifier}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax; Secure`,
        `x_st=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax; Secure`,
    ]);

    // Redirect to Twitter OAuth 2.0 authorize
    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'tweet.read users.read');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    res.redirect(307, authUrl.toString());
}
