/**
 * Universal Authentication Module
 * Handles Kinde OAuth integration for any MCP application
 */
export interface AuthConfig {
    issuerUrl: string;
    clientId: string;
    clientSecret: string;
    redirectUrl: string;
    logoutRedirectUrl: string;
    jwtSecret: string;
}
export interface User {
    id: string;
    email: string;
    name: string;
    subscriptionStatus: 'free' | 'active' | 'cancelled';
    plan: string;
}
export declare class AuthManager {
    private kindeClient;
    private sql;
    private config;
    constructor(config: AuthConfig, databaseUrl: string);
    /**
     * Verify JWT token and extract user information
     */
    verifyToken(token: string): Promise<User | null>;
    /**
     * Create or update user in database
     */
    createOrUpdateUser(userData: {
        id: string;
        email: string;
        name: string;
    }): Promise<void>;
    /**
     * Get user's billing status
     */
    getUserBillingStatus(userId: string): Promise<{
        plan: string;
        canCreate: boolean;
        reason?: string;
        upgradeUrl?: string;
    }>;
    /**
     * Increment user's usage counter
     */
    incrementUsage(userId: string): Promise<void>;
    /**
     * Get Kinde client for OAuth flows
     */
    getKindeClient(): any;
}
//# sourceMappingURL=index.d.ts.map