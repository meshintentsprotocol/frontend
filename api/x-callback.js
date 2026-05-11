function parseCookies(cookieHeader) {
    const cookies = {};
    if (cookieHeader) {
        cookieHeader.split(';').forEach((cookie) => {
            const [name, ...rest] = cookie.trim().split('=');
            if (name) cookies[name] = rest.join('=');
        });
    }
    return cookies;
}

export default async function handler(req, res) {
    const { code, state, error: authError } = req.query;

    // User denied access
    if (authError) {
        return res.redirect('/?waitlist=error&msg=access_denied');
    }

    if (!code || !state) {
        return res.redirect('/?waitlist=error&msg=missing_params');
    }

    const cookies = parseCookies(req.headers.cookie);

    // Verify state to prevent CSRF
    if (state !== cookies.x_st) {
        return res.redirect('/?waitlist=error&msg=invalid_state');
    }

    const codeVerifier = cookies.x_cv;
    if (!codeVerifier) {
        return res.redirect('/?waitlist=error&msg=missing_verifier');
    }

    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${proto}://${host}/api/x-callback`;

    try {
        // ── Step 1: Exchange code for access token ──
        const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            },
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                client_id: clientId,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier,
            }),
        });

        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
            console.error('Token exchange failed:', tokenData);
            return res.redirect('/?waitlist=error&msg=token_failed');
        }

        // ── Step 2: Fetch user profile ──
        const userRes = await fetch('https://api.twitter.com/2/users/me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const userData = await userRes.json();
        const handle = userData.data?.username;

        if (!handle) {
            console.error('User fetch failed:', userData);
            return res.redirect('/?waitlist=error&msg=no_handle');
        }

        // ── Step 3: Store in Supabase waitlist ──
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

        const insertRes = await fetch(`${supabaseUrl}/rest/v1/waitlist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
                Prefer: 'return=minimal',
            },
            body: JSON.stringify({ twitter_handle: `@${handle}` }),
        });

        // 409 = duplicate, that's fine
        if (!insertRes.ok && insertRes.status !== 409) {
            console.error('Supabase insert failed:', insertRes.status, await insertRes.text());
        }

        // ── Step 4: Clean up cookies and redirect with success ──
        res.setHeader('Set-Cookie', [
            'x_cv=; HttpOnly; Path=/; Max-Age=0',
            'x_st=; HttpOnly; Path=/; Max-Age=0',
        ]);

        res.redirect(`/?waitlist=success&handle=${encodeURIComponent(`@${handle}`)}`);
    } catch (err) {
        console.error('X OAuth callback error:', err);
        res.redirect('/?waitlist=error&msg=server_error');
    }
}
