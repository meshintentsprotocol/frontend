import { existsSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { clientSetups, EXAMPLE_PROMPTS, MCP_NPM_PACKAGE } from '../clients';
import { flatten, LOCAL_NAV } from '../../docs/nav';
import { MANIFEST } from '../manifest';
import { McpToolCatalog } from '../McpToolCatalog';

const ENDPOINT = 'https://mcp.example/mcp';
const MESH = 'https://mesh.example';
const count = (kind: string) => MANIFEST.tools.filter(t => t.kind === kind).length;

describe('bundled manifest', () => {
    it('every tool belongs to a listed group and has a known kind', () => {
        const groups = new Set(MANIFEST.groups.map(g => g.id));
        expect(MANIFEST.tools.length).toBeGreaterThan(0);
        for (const t of MANIFEST.tools) {
            expect(groups.has(t.group), t.name).toBe(true);
            expect(['read', 'prepare', 'write'], t.name).toContain(t.kind);
            expect(t.description, t.name).not.toBe('');
        }
        expect(new Set(MANIFEST.tools.map(t => t.name)).size).toBe(MANIFEST.tools.length);
    });
});

describe('McpToolCatalog', () => {
    const html = renderToStaticMarkup(createElement(McpToolCatalog));

    it('lists every tool under its group', () => {
        for (const g of MANIFEST.groups) expect(html).toContain(`>${g.id}</h3>`);
        for (const t of MANIFEST.tools) expect(html, t.name).toContain(`>${t.name}</code>`);
    });

    it('labels each tool with what it can touch', () => {
        expect(html.split('>Read-only<').length - 1).toBe(count('read') + 1);   // + the legend
        expect(html.split('>You sign<').length - 1).toBe(count('prepare') + 1);
        expect(html.split('>Server action<').length - 1).toBe(count('write') + 1);
    });
});

describe('client setups', () => {
    const setups = clientSetups(ENDPOINT, MESH);

    it('every client gets the endpoint, or the npm package with a Mesh URL', () => {
        for (const s of setups) {
            expect(s.steps.length, s.id).toBeGreaterThan(0);
            const code = s.snippets.map(x => x.code).join('\n');
            if (s.id === 'stdio') {
                expect(code).toContain(MCP_NPM_PACKAGE);
                expect(code).toContain(MESH);
            } else {
                expect(code, s.id).toContain(ENDPOINT);
            }
        }
    });

    it('JSON snippets are valid JSON in the shape each client reads', () => {
        const cfg = (id: string) => JSON.parse(setups.find(s => s.id === id)!.snippets.find(x => x.lang === 'json')!.code);
        expect(cfg('cursor')).toEqual({ mcpServers: { 'bch-intents': { url: ENDPOINT } } });
        expect(cfg('vscode')).toEqual({ servers: { 'bch-intents': { type: 'http', url: ENDPOINT } } });
        expect(cfg('windsurf')).toEqual({ mcpServers: { 'bch-intents': { serverUrl: ENDPOINT } } });
        expect(cfg('stdio')).toEqual({ mcpServers: { 'bch-intents': { command: 'npx', args: ['-y', MCP_NPM_PACKAGE], env: { MESH_URL: MESH, NETWORK: 'chipnet' } } } });
    });

    it('the Claude Code commands are the documented form', () => {
        expect(setups.find(s => s.id === 'claude-code')!.snippets[0]!.code).toBe(`claude mcp add --transport http bch-intents ${ENDPOINT}`);
        expect(setups.find(s => s.id === 'stdio')!.snippets[1]!.code)
            .toBe(`claude mcp add --env MESH_URL=${MESH} --env NETWORK=chipnet --transport stdio bch-intents -- npx -y ${MCP_NPM_PACKAGE}`);
    });

    it('only the clients that connect from their own servers are marked remote-only', () => {
        expect(setups.filter(s => s.remoteOnly).map(s => s.id)).toEqual(['claude', 'chatgpt']);
    });

    it('example prompts carry no real address', () => {
        for (const p of EXAMPLE_PROMPTS) expect(p.text).not.toMatch(/(bchtest|bitcoincash):[qpzr][a-z0-9]{20,}/);
    });
});

describe('docs agree with the manifest', () => {
    const doc = (name: string) => readFileSync(new URL(`../../docs/content/api/mcp/${name}.md`, import.meta.url), 'utf8');

    it('the overview counts tools as the manifest does', () => {
        const overview = doc('overview');
        expect(overview).toContain(`| Read-only | ${count('read')} |`);
        expect(overview).toContain(`| You sign | ${count('prepare')} |`);
        expect(overview).toContain(`| Server action | ${count('write')} |`);
        expect(overview).toContain(`All ${MANIFEST.tools.length} tools`);
    });

    it('the overview names every tool', () => {
        const overview = doc('overview');
        for (const t of MANIFEST.tools) expect(overview, t.name).toContain(`\`${t.name}\``);
    });

    it('the tools page names every resource and prompt', () => {
        const tools = doc('tools');
        for (const r of MANIFEST.resources) expect(tools).toContain(r.uri);
        for (const p of MANIFEST.prompts) expect(tools).toContain(`\`${p.name}\``);
    });
});

describe('MCP docs pages', () => {
    const PAGES = ['overview', 'connect', 'tools', 'funding', 'self-host'];
    const slugs = new Set(flatten(LOCAL_NAV).map(p => p.slug));
    const read = (name: string) => readFileSync(new URL(`../../docs/content/api/mcp/${name}.md`, import.meta.url), 'utf8');
    const embeds = readFileSync(new URL('../../docs/embeds.tsx', import.meta.url), 'utf8');

    it('every page is in the sidebar and has its frontmatter', () => {
        for (const name of PAGES) {
            expect(slugs.has(`api/mcp/${name}`), name).toBe(true);
            const head = read(name).split('---')[1]!;
            for (const field of ['title', 'description', 'status', 'updated', 'sources']) expect(head, `${name}: ${field}`).toMatch(new RegExp(`^${field}: [^\\s]`, 'm'));
        }
    });

    it('links between docs pages point at pages that exist', () => {
        for (const name of PAGES) {
            const links = [...read(name).matchAll(/\]\(([^)\s]+)\)/g)].map(m => m[1]!);
            for (const href of links) {
                if (/^(https?:|\/|#)/.test(href)) continue;
                expect(slugs.has(href.split('#')[0]!), `${name}: ${href}`).toBe(true);
            }
        }
    });

    it('cards blocks are valid and link to pages that exist', () => {
        for (const name of PAGES) {
            for (const block of read(name).matchAll(/```cards[^\n]*\n([\s\S]*?)```/g)) {
                const cards = JSON.parse(block[1]!) as Array<{ title: string; href: string }>;
                for (const c of cards) expect(slugs.has(c.href), `${name}: ${c.href}`).toBe(true);
            }
        }
    });

    it('embeds named in the pages are registered', () => {
        for (const name of PAGES) {
            for (const m of read(name).matchAll(/```diagram ([\w-]+)/g)) expect(embeds, `${name}: ${m[1]}`).toContain(`'${m[1]}':`);
        }
        expect(read('tools')).toContain('```diagram mcp-tools');
    });

    // The frontend is its own repository; the files a page was written from live beside it.
    const root = new URL('../../../../', import.meta.url);
    it.skipIf(!existsSync(new URL('bch-intents-mcp/package.json', root)))('the files each page was written from exist', () => {
        for (const name of PAGES) {
            const sources = read(name).match(/^sources: (.+)$/m)![1]!.split(',').map(s => s.trim());
            for (const s of sources) expect(existsSync(new URL(s, root)), `${name}: ${s}`).toBe(true);
        }
    });
});
