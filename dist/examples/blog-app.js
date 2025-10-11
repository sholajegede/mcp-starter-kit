/**
 * Example: Blog Application Configuration
 * Demonstrates how to create a blog app with posts and comments
 */
import dotenv from 'dotenv';
// Load environment variables first
dotenv.config();
// Validate required environment variables
const requiredEnvVars = [
    'DATABASE_URL',
    'KINDE_ISSUER_URL',
    'KINDE_CLIENT_ID',
    'KINDE_CLIENT_SECRET',
    'JWT_SECRET'
];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}
// Define the blog entities
const postsEntity = {
    name: 'posts',
    fields: [
        { name: 'title', type: 'string', required: true },
        { name: 'content', type: 'text', required: true },
        { name: 'author', type: 'string', required: true },
        { name: 'published', type: 'boolean', defaultValue: false },
        { name: 'tags', type: 'string' }
    ],
    indexes: [
        'CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published)',
        'CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author)'
    ]
};
const commentsEntity = {
    name: 'comments',
    fields: [
        { name: 'post_id', type: 'number', required: true },
        { name: 'content', type: 'text', required: true },
        { name: 'author', type: 'string', required: true },
        { name: 'approved', type: 'boolean', defaultValue: false }
    ],
    indexes: [
        'CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id)',
        'CREATE INDEX IF NOT EXISTS idx_comments_approved ON comments(approved)'
    ]
};
// Blog app configuration
export const blogAppConfig = {
    name: 'blog-mcp-server',
    version: '1.0.0',
    description: 'Blog management system with posts and comments',
    entities: [postsEntity, commentsEntity],
    auth: {
        issuerUrl: process.env.KINDE_ISSUER_URL,
        clientId: process.env.KINDE_CLIENT_ID,
        clientSecret: process.env.KINDE_CLIENT_SECRET,
        redirectUrl: 'http://localhost:3000/callback',
        logoutRedirectUrl: 'http://localhost:3000',
        jwtSecret: process.env.JWT_SECRET
    },
    database: {
        url: process.env.DATABASE_URL
    },
    billing: {
        freeLimit: 5,
        entityName: 'posts'
    }
};
// Available tools for this app:
// - create_post(title, content, author, published, tags)
// - list_posts(limit, offset)
// - get_post(id)
// - update_post(id, title, content, author, published, tags)
// - delete_post(id)
// - create_comment(post_id, content, author, approved)
// - list_comments(limit, offset)
// - get_comment(id)
// - update_comment(id, post_id, content, author, approved)
// - delete_comment(id)
// - login, save_token, logout, refresh_billing_status
//# sourceMappingURL=blog-app.js.map