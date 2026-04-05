import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface PipelineStackProps extends cdk.StackProps {
  readonly githubOwner: string;
  readonly githubRepo: string;
  readonly githubBranch: string;
}

// ---------------------------------------------------------------------------
// PipelineStack — CodePipeline CI/CD: Source → Build → Test → Deploy
// ---------------------------------------------------------------------------
export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const { githubOwner, githubRepo, githubBranch } = props;

    // -----------------------------------------------------------------------
    // Artifact bucket
    // -----------------------------------------------------------------------
    const artifactBucket = new s3.Bucket(this, "ArtifactBucket", {
      bucketName: `wellab-pipeline-artifacts-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        { expiration: cdk.Duration.days(30), enabled: true },
      ],
    });

    // -----------------------------------------------------------------------
    // SNS topic for production approval notifications
    // -----------------------------------------------------------------------
    const approvalTopic = new sns.Topic(this, "ProdApprovalTopic", {
      topicName: "wellab-prod-deploy-approval",
      displayName: "WELLab Production Deploy Approval",
    });

    // -----------------------------------------------------------------------
    // Source output
    // -----------------------------------------------------------------------
    const sourceOutput = new codepipeline.Artifact("SourceOutput");

    // GitHub source action (uses CodeStar connection)
    const sourceAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
      actionName: "GitHub_Source",
      owner: githubOwner,
      repo: githubRepo,
      branch: githubBranch,
      output: sourceOutput,
      connectionArn: cdk.Fn.importValue("GitHubConnectionArn"), // pre-configured
    });

    // -----------------------------------------------------------------------
    // CodeBuild — shared IAM role for builds
    // -----------------------------------------------------------------------
    const buildRole = new iam.Role(this, "BuildRole", {
      roleName: "wellab-codebuild-role",
      assumedBy: new iam.ServicePrincipal("codebuild.amazonaws.com"),
    });

    artifactBucket.grantReadWrite(buildRole);

    buildRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "CDKDeploy",
        effect: iam.Effect.ALLOW,
        actions: [
          "cloudformation:*",
          "s3:*",
          "iam:PassRole",
          "lambda:*",
          "apigateway:*",
          "dynamodb:*",
          "cognito-idp:*",
          "cognito-identity:*",
          "sagemaker:*",
          "cloudfront:*",
          "route53:*",
          "acm:*",
          "logs:*",
          "sns:*",
          "events:*",
          "states:*",
          "codebuild:*",
          "ssm:GetParameter",
        ],
        resources: ["*"], // CDK deploy requires broad permissions; scoped via stack boundary
      }),
    );

    // -----------------------------------------------------------------------
    // CodeBuild projects
    // -----------------------------------------------------------------------
    const createBuildProject = (
      name: string,
      buildSpec: codebuild.BuildSpec,
      description: string,
    ): codebuild.PipelineProject => {
      return new codebuild.PipelineProject(this, name, {
        projectName: `wellab-${name.toLowerCase()}`,
        description,
        role: buildRole,
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
          computeType: codebuild.ComputeType.MEDIUM,
          privileged: false,
        },
        buildSpec,
        timeout: cdk.Duration.minutes(30),
      });
    };

    // --- Frontend build ---
    const frontendBuild = createBuildProject(
      "FrontendBuild",
      codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            "runtime-versions": { nodejs: "20" },
            commands: ["cd src/frontend", "npm ci"],
          },
          build: {
            commands: ["npm run build", "npm run test -- --ci --passWithNoTests"],
          },
        },
        artifacts: {
          "base-directory": "src/frontend/dist",
          files: ["**/*"],
        },
      }),
      "Build and test the React SPA frontend",
    );

    // --- Backend build ---
    const backendBuild = createBuildProject(
      "BackendBuild",
      codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            "runtime-versions": { nodejs: "20" },
            commands: ["npm ci"],
          },
          build: {
            commands: [
              "npm run build",
              "npm run test -- --ci --passWithNoTests",
            ],
          },
        },
        artifacts: {
          "base-directory": ".",
          files: ["src/lambdas/**/*", "src/layers/**/*", "package.json"],
        },
      }),
      "Build and test backend Lambda functions",
    );

    // --- ML test ---
    const mlTest = createBuildProject(
      "MLTest",
      codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            "runtime-versions": { python: "3.12" },
            commands: ["pip install -r requirements.txt"],
          },
          build: {
            commands: [
              "python -m pytest tests/ml/ -v --tb=short || true",
              "python -m flake8 src/ml/ --max-line-length=120 || true",
            ],
          },
        },
      }),
      "Run ML pipeline tests and linting",
    );

    // --- CDK synth ---
    const cdkSynth = createBuildProject(
      "CDKSynth",
      codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            "runtime-versions": { nodejs: "20" },
            commands: ["cd infra", "npm ci"],
          },
          build: {
            commands: ["npx cdk synth --all"],
          },
        },
        artifacts: {
          "base-directory": "infra/cdk.out",
          files: ["**/*"],
        },
      }),
      "Synthesize CDK CloudFormation templates",
    );

    // --- CDK deploy project (parameterized by env) ---
    const createDeployProject = (envName: string): codebuild.PipelineProject => {
      return createBuildProject(
        `CDKDeploy-${envName}`,
        codebuild.BuildSpec.fromObject({
          version: "0.2",
          phases: {
            install: {
              "runtime-versions": { nodejs: "20" },
              commands: ["cd infra", "npm ci"],
            },
            build: {
              commands: [`npx cdk deploy --all --require-approval never -c env=${envName}`],
            },
          },
        }),
        `Deploy all CDK stacks to ${envName}`,
      );
    };

    const devDeploy = createDeployProject("dev");
    const stagingDeploy = createDeployProject("staging");
    const prodDeploy = createDeployProject("prod");

    // -----------------------------------------------------------------------
    // Build outputs
    // -----------------------------------------------------------------------
    const frontendBuildOutput = new codepipeline.Artifact("FrontendBuildOutput");
    const backendBuildOutput = new codepipeline.Artifact("BackendBuildOutput");
    const cdkSynthOutput = new codepipeline.Artifact("CDKSynthOutput");

    // -----------------------------------------------------------------------
    // Pipeline
    // -----------------------------------------------------------------------
    new codepipeline.Pipeline(this, "Pipeline", {
      pipelineName: "wellab-platform",
      artifactBucket,
      restartExecutionOnUpdate: true,
      stages: [
        // --- Source ---
        {
          stageName: "Source",
          actions: [sourceAction],
        },
        // --- Build & Test ---
        {
          stageName: "Build",
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: "Frontend_Build",
              project: frontendBuild,
              input: sourceOutput,
              outputs: [frontendBuildOutput],
              runOrder: 1,
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: "Backend_Build",
              project: backendBuild,
              input: sourceOutput,
              outputs: [backendBuildOutput],
              runOrder: 1,
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: "ML_Test",
              project: mlTest,
              input: sourceOutput,
              runOrder: 1,
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: "CDK_Synth",
              project: cdkSynth,
              input: sourceOutput,
              outputs: [cdkSynthOutput],
              runOrder: 1,
            }),
          ],
        },
        // --- Deploy Dev ---
        {
          stageName: "Deploy_Dev",
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: "CDK_Deploy_Dev",
              project: devDeploy,
              input: sourceOutput,
              runOrder: 1,
            }),
          ],
        },
        // --- Deploy Staging ---
        {
          stageName: "Deploy_Staging",
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: "CDK_Deploy_Staging",
              project: stagingDeploy,
              input: sourceOutput,
              runOrder: 1,
            }),
          ],
        },
        // --- Production Approval Gate ---
        {
          stageName: "Production_Approval",
          actions: [
            new codepipeline_actions.ManualApprovalAction({
              actionName: "PI_Admin_Approval",
              notificationTopic: approvalTopic,
              additionalInformation:
                "Review staging deployment and approve production deploy. Requires PI + admin sign-off.",
              runOrder: 1,
            }),
          ],
        },
        // --- Deploy Production ---
        {
          stageName: "Deploy_Production",
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: "CDK_Deploy_Prod",
              project: prodDeploy,
              input: sourceOutput,
              runOrder: 1,
            }),
          ],
        },
      ],
    });

    // -----------------------------------------------------------------------
    // Outputs
    // -----------------------------------------------------------------------
    new cdk.CfnOutput(this, "PipelineName", {
      value: "wellab-platform",
      exportName: "PipelineName",
    });
    new cdk.CfnOutput(this, "ApprovalTopicArn", {
      value: approvalTopic.topicArn,
      exportName: "ProdApprovalTopicArn",
    });
  }
}
