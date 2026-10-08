/**
 * The MCP server's tool catalog, bundled for the /mcp page and the docs.
 *
 * manifest.json is generated from the server's own tool declarations:
 *   cd bch-intents-mcp && npm run manifest
 * A test in that package fails when this copy is stale. Do not edit it by hand.
 */
import raw from './manifest.json';

export type ToolKind = 'read' | 'prepare' | 'write';

export interface ManifestParam {
    name: string;
    type: string;
    required: boolean;
    description: string;
    options?: string[];
}

export interface ManifestTool {
    name: string;
    group: string;
    title: string;
    description: string;
    kind: ToolKind;
    params: ManifestParam[];
}

export interface Manifest {
    name: string;
    title: string;
    version: string;
    groups: Array<{ id: string; blurb: string }>;
    tools: ManifestTool[];
    prompts: Array<{ name: string; title: string; description: string }>;
    resources: Array<{ uri: string; title: string; description: string }>;
}

export const MANIFEST = raw as Manifest;
