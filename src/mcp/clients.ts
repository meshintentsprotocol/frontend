/**
 * How each MCP client is pointed at the server. Checked against each client's
 * own documentation on 2026-10-07; their settings screens move, so re-check
 * when editing.
 */

export const MCP_SERVER_NAME = 'bch-intents';
export const MCP_NPM_PACKAGE = '@bch-intents/mcp';

export interface Snippet {
    /** File name or context shown above the code. */
    label?: string;
    lang: 'bash' | 'json' | 'text';
    code: string;
}

export interface ClientSetup {
    id: string;
    label: string;
    /** The client's own servers make the connection, so only a public HTTPS endpoint works. */
    remoteOnly?: boolean;
    steps: string[];
    snippets: Snippet[];
    note?: string;
}

const json = (o: unknown) => JSON.stringify(o, null, 2);

/**
 * @param url     the MCP endpoint (…/mcp)
 * @param meshUrl a Mesh Server URL, for clients that run the server locally
 */
export function clientSetups(url: string, meshUrl: string): ClientSetup[] {
    return [
        {
            id: 'claude',
            label: 'Claude',
            remoteOnly: true,
            steps: [
                'Open Customize → Connectors.',
                'Click “+ Add”, then “Add custom connector”.',
                'Name it BCH Intents and paste this URL.',
                'Click Add. There is nothing to sign in to.',
            ],
            snippets: [{ lang: 'text', code: url }],
            note: 'Works in Claude on the web and in Claude Desktop.',
        },
        {
            id: 'claude-code',
            label: 'Claude Code',
            steps: ['Run this once in a terminal.'],
            snippets: [{ lang: 'bash', code: `claude mcp add --transport http ${MCP_SERVER_NAME} ${url}` }],
            note: 'Add --scope user to have it in every project.',
        },
        {
            id: 'cursor',
            label: 'Cursor',
            steps: ['Add this to .cursor/mcp.json in a project, or to ~/.cursor/mcp.json for every project.'],
            snippets: [{ label: 'mcp.json', lang: 'json', code: json({ mcpServers: { [MCP_SERVER_NAME]: { url } } }) }],
        },
        {
            id: 'vscode',
            label: 'VS Code',
            steps: ['Add this to .vscode/mcp.json in your workspace.'],
            snippets: [{ label: '.vscode/mcp.json', lang: 'json', code: json({ servers: { [MCP_SERVER_NAME]: { type: 'http', url } } }) }],
        },
        {
            id: 'windsurf',
            label: 'Windsurf',
            steps: ['Add this to ~/.config/devin/mcp_config.json (on Windows, %APPDATA%\\devin\\mcp_config.json).'],
            snippets: [{ label: 'mcp_config.json', lang: 'json', code: json({ mcpServers: { [MCP_SERVER_NAME]: { serverUrl: url } } }) }],
            note: 'Older Windsurf builds read ~/.codeium/windsurf/mcp_config.json.',
        },
        {
            id: 'chatgpt',
            label: 'ChatGPT',
            remoteOnly: true,
            steps: [
                'Open Settings → Apps & Connectors and turn on Developer mode (under Advanced).',
                'Click Create, name it BCH Intents and paste this URL.',
                'Set authentication to “None” and save.',
            ],
            snippets: [{ lang: 'text', code: url }],
            note: 'Developer mode is on paid plans; in a workspace an admin may have to allow custom connectors.',
        },
        {
            id: 'stdio',
            label: 'Local (stdio)',
            steps: ['Clients that start MCP servers as a local process can run the npm package. It needs the URL of a Mesh Server.'],
            snippets: [
                {
                    label: 'client config',
                    lang: 'json',
                    code: json({ mcpServers: { [MCP_SERVER_NAME]: { command: 'npx', args: ['-y', MCP_NPM_PACKAGE], env: { MESH_URL: meshUrl, NETWORK: 'chipnet' } } } }),
                },
                {
                    label: 'Claude Code',
                    lang: 'bash',
                    code: `claude mcp add --env MESH_URL=${meshUrl} --env NETWORK=chipnet --transport stdio ${MCP_SERVER_NAME} -- npx -y ${MCP_NPM_PACKAGE}`,
                },
            ],
        },
    ];
}

/** Things to ask once connected. Addresses are placeholders the user replaces with their own. */
export const EXAMPLE_PROMPTS: Array<{ group: 'Trade' | 'Liquidity' | 'Look up'; text: string }> = [
    { group: 'Trade', text: 'What would I get right now for 0.5 BCH in PUSD, and by which route?' },
    { group: 'Trade', text: 'Prepare a market order selling 0.1 BCH for PUSD. My address is bchtest:q…' },
    { group: 'Trade', text: 'Set a limit order: sell 100 PUSD for at least 0.3 BCH, open for 24 hours.' },
    { group: 'Trade', text: 'Sell 2 BCH for PUSD as a TWAP: 8 slices, one every 15 minutes.' },
    { group: 'Liquidity', text: 'Which Mesh pools quote PUSD, and how deep is each side?' },
    { group: 'Liquidity', text: 'Suggest a grid strategy for PUSD with 0.5 BCH and show me every pool it would open.' },
    { group: 'Liquidity', text: 'Is any of my liquidity sitting idle? My LP address is bchtest:q…' },
    { group: 'Look up', text: 'What happened to order intent_…? If it expired, when is the refund due?' },
];
