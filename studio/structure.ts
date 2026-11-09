import type { StructureResolver } from 'sanity/structure';

export const SINGLETONS = ['siteSettings'];

export const structure: StructureResolver = S =>
    S.list()
        .title('Content')
        .items([
            S.listItem()
                .title('Knowledge Base')
                .child(
                    S.list()
                        .title('Knowledge Base')
                        .items([
                            S.documentTypeListItem('kbArticle').title('Articles'),
                            S.documentTypeListItem('kbCategory').title('Categories'),
                        ]),
                ),
            S.listItem()
                .title('Developer Docs')
                .child(
                    S.list()
                        .title('Developer Docs')
                        .items([
                            S.documentTypeListItem('docsSection').title('Sections & sidebar'),
                            S.documentTypeListItem('docsPage').title('All pages'),
                            S.divider(),
                            ...(['ready', 'draft', 'planned'] as const).map(status =>
                                S.listItem()
                                    .title(`Pages: ${status}`)
                                    .child(
                                        S.documentList()
                                            .title(`Pages: ${status}`)
                                            .filter('_type == "docsPage" && status == $status')
                                            .params({ status }),
                                    ),
                            ),
                        ]),
                ),
            S.divider(),
            S.documentTypeListItem('tag').title('Tags'),
            S.documentTypeListItem('author').title('Authors'),
            S.divider(),
            S.documentTypeListItem('subscriber').title('Newsletter Subscribers'),
            S.divider(),
            S.listItem()
                .title('Site settings')
                .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
        ]);
