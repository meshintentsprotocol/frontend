import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { markdownSchema } from 'sanity-plugin-markdown';
import 'easymde/dist/easymde.min.css';
import { schemaTypes } from './schemaTypes';
import { structure, SINGLETONS } from './structure';

export default defineConfig({
    name: 'default',
    title: 'BCH Intents Content',
    projectId: process.env.SANITY_STUDIO_PROJECT_ID!,
    dataset: process.env.SANITY_STUDIO_DATASET || 'production',
    plugins: [structureTool({ structure }), visionTool(), markdownSchema()],
    schema: {
        types: schemaTypes,
        // Singletons are opened from the structure, never created from "New document".
        templates: templates => templates.filter(t => !SINGLETONS.includes(t.schemaType)),
    },
    document: {
        actions: (actions, { schemaType }) =>
            SINGLETONS.includes(schemaType) ? actions.filter(a => a.action !== 'duplicate' && a.action !== 'delete') : actions,
    },
});
