/**
 * CLI Tool for Creating New MCP Applications
 * Generates complete, working MCP projects
 */
export interface AppTemplate {
    name: string;
    description: string;
    entities: string[];
    features: string[];
}
export declare const APP_TEMPLATES: Record<string, AppTemplate>;
export declare class AppGenerator {
    private projectPath;
    private appName;
    constructor(projectPath: string, appName: string);
    /**
     * Generate a complete MCP application
     */
    generateApp(template: string): Promise<void>;
    private generateProjectStructure;
    private generatePackageJson;
    private generateTsConfig;
    private generateEnvTemplate;
    private generateReadme;
    private generateCoreFiles;
    private copyDirectory;
    private generateAuthModule;
    private generateDatabaseModule;
    private generateServerModule;
    private generateToolsModule;
    private generateKindeAuthServer;
    private generateAppFiles;
    private generateSetupScript;
    private updateUniversalServer;
    private generateAppConfig;
    private generateToolsList;
}
export declare function createApp(appName: string, template: string, outputDir: string): Promise<void>;
//# sourceMappingURL=create-app.d.ts.map