/**
 * Type definitions for comparison agent
 */

export interface ComparisonRubric {
  // Core Performance & Technical
  speedPerf: { [toolName: string]: string };
  reliabilityStability: { [toolName: string]: string };
  languageSupport: { [toolName: string]: string };
  debugging: { [toolName: string]: string };
  
  // Features & Capabilities
  extensionsPlugins: { [toolName: string]: string };
  aiFeatures: { [toolName: string]: string };
  codeEditing: { [toolName: string]: string }; // autocomplete, refactoring, etc.
  remoteDevContainers: { [toolName: string]: string };
  collaboration: { [toolName: string]: string }; // pair programming, sharing, etc.
  
  // Integration & Ecosystem
  integrations: { [toolName: string]: string }; // Git, CI/CD, cloud services, APIs
  customization: { [toolName: string]: string }; // theming, config, workflows
  
  // Platform & Deployment
  platformSupport: { [toolName: string]: string }; // OS, mobile, web compatibility
  deployment: { [toolName: string]: string }; // cloud, local, hybrid options
  
  // Business & Support
  pricingLicensing: { [toolName: string]: string };
  updateFrequency: { [toolName: string]: string }; // release cadence, update patterns
  communitySupport: { [toolName: string]: string }; // community size, documentation, resources
  
  // User Experience
  userInterface: { [toolName: string]: string }; // UI/UX, accessibility, ease of use
  learningCurve: { [toolName: string]: string }; // onboarding, documentation quality
  
  // Use Case & Personas
  bestFitPersonas: { [toolName: string]: string[] }; // beginner, enterprise, polyglot, etc.
  useCases: { [toolName: string]: string }; // specific scenarios where tool excels
}

export interface ComparisonData {
  tools: string[];
  rubric: ComparisonRubric;
  decisionRules: string;
}

export interface ComparisonResult {
  id: number;
  toolNames: string[];
  comparisonData: ComparisonData;
  decisionRules: string;
  createdAt: Date;
  updatedAt: Date;
}

