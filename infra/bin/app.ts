#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { DataStack } from "../lib/data-stack";
import { AuthStack } from "../lib/auth-stack";
import { ApiStack } from "../lib/api-stack";
import { MLStack } from "../lib/ml-stack";
import { FrontendStack } from "../lib/frontend-stack";
import { MonitoringStack } from "../lib/monitoring-stack";
import { PipelineStack } from "../lib/pipeline-stack";

const app = new cdk.App();

// ---------------------------------------------------------------------------
// Environment configuration
// ---------------------------------------------------------------------------
interface EnvConfig {
  readonly envName: string;
  readonly account: string;
  readonly region: string;
  readonly domainName: string;
  readonly logRetentionDays: number;
  readonly removalPolicy: cdk.RemovalPolicy;
  readonly isProd: boolean;
}

const account = app.node.tryGetContext("account") || process.env.CDK_DEFAULT_ACCOUNT;
const region = app.node.tryGetContext("region") || "us-east-1";

const environments: EnvConfig[] = [
  {
    envName: "dev",
    account,
    region,
    domainName: "dev.wellab.wustl.edu",
    logRetentionDays: 90,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    isProd: false,
  },
  {
    envName: "staging",
    account,
    region,
    domainName: "staging.wellab.wustl.edu",
    logRetentionDays: 180,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
    isProd: false,
  },
  {
    envName: "prod",
    account,
    region,
    domainName: "wellab.wustl.edu",
    logRetentionDays: 365,
    removalPolicy: cdk.RemovalPolicy.RETAIN,
    isProd: true,
  },
];

// ---------------------------------------------------------------------------
// Instantiate stacks per environment
// ---------------------------------------------------------------------------
const targetEnv = app.node.tryGetContext("env") || "dev";
const envConfig = environments.find((e) => e.envName === targetEnv);
if (!envConfig) {
  throw new Error(`Unknown environment: ${targetEnv}. Valid: dev, staging, prod`);
}

const cdkEnv: cdk.Environment = { account: envConfig.account, region: envConfig.region };
const prefix = `WELLab-${envConfig.envName}`;

const commonTags: Record<string, string> = {
  Project: "WELLab",
  Environment: envConfig.envName,
  ManagedBy: "CDK",
  Organization: "WashU-PsychBrain",
};

function applyTags(stack: cdk.Stack): void {
  Object.entries(commonTags).forEach(([key, value]) => {
    cdk.Tags.of(stack).add(key, value);
  });
}

// --- Data ---
const dataStack = new DataStack(app, `${prefix}-Data`, {
  env: cdkEnv,
  envName: envConfig.envName,
  removalPolicy: envConfig.removalPolicy,
  isProd: envConfig.isProd,
});
applyTags(dataStack);

// --- Auth ---
const authStack = new AuthStack(app, `${prefix}-Auth`, {
  env: cdkEnv,
  envName: envConfig.envName,
  removalPolicy: envConfig.removalPolicy,
});
applyTags(authStack);

// --- API ---
const apiStack = new ApiStack(app, `${prefix}-Api`, {
  env: cdkEnv,
  envName: envConfig.envName,
  mainTable: dataStack.mainTable,
  rawDataBucket: dataStack.rawDataBucket,
  modelBucket: dataStack.modelBucket,
  researcherUserPool: authStack.researcherUserPool,
  participantUserPool: authStack.participantUserPool,
  domainName: envConfig.domainName,
  isProd: envConfig.isProd,
});
applyTags(apiStack);

// --- ML ---
const mlStack = new MLStack(app, `${prefix}-ML`, {
  env: cdkEnv,
  envName: envConfig.envName,
  mainTable: dataStack.mainTable,
  rawDataBucket: dataStack.rawDataBucket,
  modelBucket: dataStack.modelBucket,
  removalPolicy: envConfig.removalPolicy,
  isProd: envConfig.isProd,
});
applyTags(mlStack);

// --- Frontend ---
const frontendStack = new FrontendStack(app, `${prefix}-Frontend`, {
  env: cdkEnv,
  envName: envConfig.envName,
  domainName: envConfig.domainName,
  apiEndpoint: apiStack.apiEndpoint,
  removalPolicy: envConfig.removalPolicy,
});
applyTags(frontendStack);

// --- Monitoring ---
const monitoringStack = new MonitoringStack(app, `${prefix}-Monitoring`, {
  env: cdkEnv,
  envName: envConfig.envName,
  api: apiStack.api,
  lambdaFunctions: apiStack.lambdaFunctions,
  mainTable: dataStack.mainTable,
  logRetentionDays: envConfig.logRetentionDays,
  isProd: envConfig.isProd,
});
applyTags(monitoringStack);

// --- CI/CD Pipeline (only in the tooling / dev account) ---
if (envConfig.envName === "dev") {
  const pipelineStack = new PipelineStack(app, `WELLab-Pipeline`, {
    env: cdkEnv,
    githubOwner: app.node.tryGetContext("githubOwner") || "WELLab-WashU",
    githubRepo: app.node.tryGetContext("githubRepo") || "wellab-platform",
    githubBranch: "main",
  });
  applyTags(pipelineStack);
}

app.synth();
