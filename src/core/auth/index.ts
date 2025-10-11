/**
 * Universal Authentication Module
 * Handles Kinde OAuth integration for any MCP application
 */

import { createKindeServerClient, GrantType, SessionManager } from '@kinde-oss/kinde-typescript-sdk';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';

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

export class AuthManager {
  private kindeClient: any;
  private sql: any;
  private config: AuthConfig;

  constructor(config: AuthConfig, databaseUrl: string) {
    this.config = config;
    this.sql = neon(databaseUrl);
    
    this.kindeClient = createKindeServerClient(GrantType.AUTHORIZATION_CODE, {
      authDomain: config.issuerUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectURL: config.redirectUrl,
      logoutRedirectURL: config.logoutRedirectUrl,
    });
  }

  /**
   * Verify JWT token and extract user information
   */
  async verifyToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.decode(token) as any;
      
      if (!decoded || !decoded.sub) {
        return null;
      }

      if (decoded.iss !== this.config.issuerUrl) {
        return null;
      }

      // Get user from database
      const sql = `SELECT * FROM users WHERE user_id = $1`;
      const users = await this.sql(sql, [decoded.sub]);

      if (users.length === 0) {
        return null;
      }

      return {
        id: users[0].user_id,
        email: users[0].email,
        name: users[0].name,
        subscriptionStatus: users[0].subscription_status,
        plan: users[0].plan
      };
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Create or update user in database
   */
  async createOrUpdateUser(userData: {
    id: string;
    email: string;
    name: string;
  }): Promise<void> {
    try {
      const sql = `SELECT * FROM users WHERE user_id = $1`;
      const existingUser = await this.sql(sql, [userData.id]);

      if (existingUser.length === 0) {
        // Create new user
        const insertSql = `INSERT INTO users (user_id, name, email, subscription_status, plan, free_todos_used) VALUES ($1, $2, $3, 'free', 'free', 0)`;
        await this.sql(insertSql, [userData.id, userData.name, userData.email]);
      } else {
        // Update existing user
        const updateSql = `UPDATE users SET name = $1, email = $2 WHERE user_id = $3`;
        await this.sql(updateSql, [userData.name, userData.email, userData.id]);
      }
    } catch (error) {
      console.error('Failed to create/update user:', error);
      throw error;
    }
  }

  /**
   * Get user's billing status
   */
  async getUserBillingStatus(userId: string): Promise<{
    plan: string;
    canCreate: boolean;
    reason?: string;
    upgradeUrl?: string;
  }> {
    try {
      const sql = `SELECT * FROM users WHERE user_id = $1`;
      const user = await this.sql(sql, [userId]);

      if (user.length === 0) {
        return {
          plan: 'free',
          canCreate: false,
          reason: 'User not found'
        };
      }

      const freeTodosUsed = user[0].free_todos_used || 0;
      const maxFree = 1; // Configurable per app

      if (freeTodosUsed < maxFree) {
        return {
          plan: 'free',
          canCreate: true,
          reason: `Free tier - ${maxFree - freeTodosUsed} remaining`
        };
      }

      return {
        plan: 'free',
        canCreate: false,
        reason: 'Free tier limit reached',
        upgradeUrl: `${this.config.issuerUrl}/portal`
      };
    } catch (error) {
      console.error('Failed to get billing status:', error);
      return {
        plan: 'free',
        canCreate: false,
        reason: 'Error checking billing status'
      };
    }
  }

  /**
   * Increment user's usage counter
   */
  async incrementUsage(userId: string): Promise<void> {
    try {
      const sql = `UPDATE users SET free_todos_used = free_todos_used + 1 WHERE user_id = $1`;
      await this.sql(sql, [userId]);
    } catch (error) {
      console.error('Failed to increment usage:', error);
      throw error;
    }
  }

  /**
   * Get Kinde client for OAuth flows
   */
  getKindeClient() {
    return this.kindeClient;
  }
}
