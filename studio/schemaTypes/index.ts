import { seo } from './seo';
import { author, siteSettings, subscriber, tag } from './shared';
import { kbArticle, kbCategory } from './kb';
import { docsPage, docsSection, navGroup } from './docs';

export const schemaTypes = [kbArticle, kbCategory, docsPage, docsSection, navGroup, tag, author, siteSettings, seo, subscriber];
