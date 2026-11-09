import { useState, useCallback } from 'react';

const PROJECT_ID = import.meta.env.VITE_SANITY_PROJECT_ID || 'q9izebed';
const DATASET = import.meta.env.VITE_SANITY_DATASET || 'production';
const API_VERSION = 'v2025-02-19';

// Write token for subscriber mutations only.
// In a production environment this should be a restricted token scoped to create-only on subscriber documents,
// or handled via a serverless function.  For this project scope this is acceptable.
const WRITE_TOKEN = 'skMyIgNHJ7k5cQvx91jYLIganIFdoO8aE0g9NMPPCwddLSoSk5z9PcfnrKE5oIcQNU0XPssMDtobOQtGb59JpmQ5SpOGMY0mRYZHLMHJDlewO2UwSna4HIe3E3ECtH6PcnlhtwknX2xlM70q9gJfEL7m7lwerf4SLaezWCoCcEsKOGciQCfy';

type SubscribeStatus = 'idle' | 'loading' | 'success' | 'error' | 'duplicate';

interface UseSubscribeReturn {
    status: SubscribeStatus;
    message: string;
    subscribe: (email: string, source?: string) => Promise<void>;
    reset: () => void;
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function useSubscribe(): UseSubscribeReturn {
    const [status, setStatus] = useState<SubscribeStatus>('idle');
    const [message, setMessage] = useState('');

    const reset = useCallback(() => {
        setStatus('idle');
        setMessage('');
    }, []);

    const subscribe = useCallback(async (email: string, source = 'other') => {
        const trimmed = email.trim().toLowerCase();

        if (!trimmed) {
            setStatus('error');
            setMessage('Please enter your email address.');
            return;
        }

        if (!isValidEmail(trimmed)) {
            setStatus('error');
            setMessage('Please enter a valid email address.');
            return;
        }

        setStatus('loading');
        setMessage('');

        try {
            // Check for existing subscriber first (use live API to avoid CDN cache latency)
            const checkUrl = `https://${PROJECT_ID}.api.sanity.io/${API_VERSION}/data/query/${DATASET}?query=${encodeURIComponent(
                `count(*[_type == "subscriber" && email == "${trimmed}"])`
            )}`;
            const checkRes = await fetch(checkUrl);
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                if (checkData.result > 0) {
                    setStatus('duplicate');
                    setMessage('You\'re already subscribed!');
                    return;
                }
            }

            // Create subscriber document via Sanity mutations API
            const docId = `subscriber-${trimmed.replace(/[^a-z0-9]/g, '-')}`;
            const mutationUrl = `https://${PROJECT_ID}.api.sanity.io/${API_VERSION}/data/mutate/${DATASET}`;

            const res = await fetch(mutationUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${WRITE_TOKEN}`,
                },
                body: JSON.stringify({
                    mutations: [
                        {
                            createOrReplace: {
                                _id: docId,
                                _type: 'subscriber',
                                email: trimmed,
                                subscribedAt: new Date().toISOString(),
                                source,
                            },
                        },
                    ],
                }),
            });

            if (!res.ok) {
                const errBody = await res.text();
                console.error('Sanity mutation error:', errBody);
                throw new Error(`Subscription failed (${res.status})`);
            }

            setStatus('success');
            setMessage('Welcome aboard! 🎉');
        } catch (err) {
            console.error('Subscribe error:', err);
            setStatus('error');
            setMessage('Something went wrong. Please try again.');
        }
    }, []);

    return { status, message, subscribe, reset };
}

