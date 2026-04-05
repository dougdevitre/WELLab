import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";
import * as stepfunctions from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as logs from "aws-cdk-lib/aws-logs";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface MLStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly mainTable: dynamodb.Table;
  readonly rawDataBucket: s3.Bucket;
  readonly modelBucket: s3.Bucket;
  readonly removalPolicy: cdk.RemovalPolicy;
  readonly isProd: boolean;
}

// ---------------------------------------------------------------------------
// MLStack — SageMaker, Step Functions ML pipeline, fairness audits
// ---------------------------------------------------------------------------
export class MLStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MLStackProps) {
    super(scope, id, props);

    const { envName, mainTable, rawDataBucket, modelBucket, removalPolicy, isProd } = props;

    // -----------------------------------------------------------------------
    // SageMaker execution role
    // -----------------------------------------------------------------------
    const sagemakerRole = new iam.Role(this, "SageMakerExecutionRole", {
      roleName: `wellab-sagemaker-exec-${envName}`,
      assumedBy: new iam.ServicePrincipal("sagemaker.amazonaws.com"),
      description: "Execution role for WELLab SageMaker notebook and training jobs",
    });

    rawDataBucket.grantRead(sagemakerRole);
    modelBucket.grantReadWrite(sagemakerRole);
    mainTable.grantReadData(sagemakerRole);

    sagemakerRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "CloudWatchLogs",
        effect: iam.Effect.ALLOW,
        actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        resources: [
          `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/sagemaker/*`,
        ],
      }),
    );

    sagemakerRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "ECRPull",
        effect: iam.Effect.ALLOW,
        actions: [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
        ],
        resources: ["*"], // ECR auth token is account-wide
      }),
    );

    // -----------------------------------------------------------------------
    // SageMaker Notebook Instance (research)
    // -----------------------------------------------------------------------
    const notebook = new sagemaker.CfnNotebookInstance(this, "ResearchNotebook", {
      notebookInstanceName: `wellab-research-${envName}`,
      instanceType: isProd ? "ml.t3.xlarge" : "ml.t3.medium",
      roleArn: sagemakerRole.roleArn,
      directInternetAccess: "Enabled",
      volumeSizeInGb: 50,
      tags: [
        { key: "Project", value: "WELLab" },
        { key: "Environment", value: envName },
      ],
    });

    // -----------------------------------------------------------------------
    // SageMaker real-time inference endpoints
    // -----------------------------------------------------------------------
    const createEndpointConfig = (modelName: string, instanceType: string): sagemaker.CfnEndpointConfig => {
      return new sagemaker.CfnEndpointConfig(this, `${modelName}EndpointConfig`, {
        endpointConfigName: `wellab-${modelName}-config-${envName}`,
        productionVariants: [
          {
            variantName: "primary",
            modelName: `wellab-${modelName}-${envName}`,
            instanceType: instanceType,
            initialInstanceCount: 1,
            initialVariantWeight: 1,
          },
        ],
        tags: [
          { key: "Project", value: "WELLab" },
          { key: "Model", value: modelName },
        ],
      });
    };

    const emotionalDynamicsConfig = createEndpointConfig("emotional-dynamics", isProd ? "ml.m5.large" : "ml.t2.medium");
    const cognitiveRiskConfig = createEndpointConfig("cognitive-risk", isProd ? "ml.m5.large" : "ml.t2.medium");

    // -----------------------------------------------------------------------
    // Lambda functions for ML pipeline steps
    // -----------------------------------------------------------------------
    const mlLambdaRole = new iam.Role(this, "MLLambdaRole", {
      roleName: `wellab-ml-lambda-${envName}`,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
      ],
    });

    rawDataBucket.grantRead(mlLambdaRole);
    modelBucket.grantReadWrite(mlLambdaRole);
    mainTable.grantReadData(mlLambdaRole);

    mlLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "SageMakerJobs",
        effect: iam.Effect.ALLOW,
        actions: [
          "sagemaker:CreateTrainingJob",
          "sagemaker:DescribeTrainingJob",
          "sagemaker:CreateModel",
          "sagemaker:CreateEndpointConfig",
          "sagemaker:UpdateEndpoint",
          "sagemaker:DescribeEndpoint",
        ],
        resources: [
          `arn:aws:sagemaker:${this.region}:${this.account}:training-job/wellab-*`,
          `arn:aws:sagemaker:${this.region}:${this.account}:model/wellab-*`,
          `arn:aws:sagemaker:${this.region}:${this.account}:endpoint/wellab-*`,
          `arn:aws:sagemaker:${this.region}:${this.account}:endpoint-config/wellab-*`,
        ],
      }),
    );

    mlLambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "PassSageMakerRole",
        effect: iam.Effect.ALLOW,
        actions: ["iam:PassRole"],
        resources: [sagemakerRole.roleArn],
        conditions: {
          StringEquals: { "iam:PassedToService": "sagemaker.amazonaws.com" },
        },
      }),
    );

    const commonMlEnv: Record<string, string> = {
      TABLE_NAME: mainTable.tableName,
      RAW_DATA_BUCKET: rawDataBucket.bucketName,
      MODEL_BUCKET: modelBucket.bucketName,
      SAGEMAKER_ROLE_ARN: sagemakerRole.roleArn,
      ENVIRONMENT: envName,
    };

    const dataPrepFn = new lambda.Function(this, "DataPrepFn", {
      functionName: `wellab-ml-data-prep-${envName}`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.main",
      code: lambda.Code.fromAsset("../src/ml/data-prep"),
      role: mlLambdaRole,
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
      environment: commonMlEnv,
      tracing: lambda.Tracing.ACTIVE,
    });

    const trainFn = new lambda.Function(this, "TrainFn", {
      functionName: `wellab-ml-train-${envName}`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.main",
      code: lambda.Code.fromAsset("../src/ml/train"),
      role: mlLambdaRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 512,
      environment: commonMlEnv,
      tracing: lambda.Tracing.ACTIVE,
    });

    const evaluateFn = new lambda.Function(this, "EvaluateFn", {
      functionName: `wellab-ml-evaluate-${envName}`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.main",
      code: lambda.Code.fromAsset("../src/ml/evaluate"),
      role: mlLambdaRole,
      timeout: cdk.Duration.minutes(10),
      memorySize: 512,
      environment: commonMlEnv,
      tracing: lambda.Tracing.ACTIVE,
    });

    const deployModelFn = new lambda.Function(this, "DeployModelFn", {
      functionName: `wellab-ml-deploy-${envName}`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.main",
      code: lambda.Code.fromAsset("../src/ml/deploy"),
      role: mlLambdaRole,
      timeout: cdk.Duration.minutes(10),
      memorySize: 256,
      environment: commonMlEnv,
      tracing: lambda.Tracing.ACTIVE,
    });

    // -----------------------------------------------------------------------
    // Step Functions — ML pipeline orchestration
    // -----------------------------------------------------------------------
    const dataPrepTask = new tasks.LambdaInvoke(this, "DataPrepTask", {
      lambdaFunction: dataPrepFn,
      outputPath: "$.Payload",
      resultPath: "$.dataPrepResult",
    });

    const trainTask = new tasks.LambdaInvoke(this, "TrainTask", {
      lambdaFunction: trainFn,
      outputPath: "$.Payload",
      resultPath: "$.trainResult",
    });

    const evaluateTask = new tasks.LambdaInvoke(this, "EvaluateTask", {
      lambdaFunction: evaluateFn,
      outputPath: "$.Payload",
      resultPath: "$.evaluateResult",
    });

    const deployTask = new tasks.LambdaInvoke(this, "DeployTask", {
      lambdaFunction: deployModelFn,
      outputPath: "$.Payload",
      resultPath: "$.deployResult",
    });

    const evaluationCheck = new stepfunctions.Choice(this, "ModelMeetsThreshold")
      .when(
        stepfunctions.Condition.numberGreaterThanEquals("$.evaluateResult.accuracy", 0.80),
        deployTask,
      )
      .otherwise(
        new stepfunctions.Fail(this, "ModelBelowThreshold", {
          cause: "Model accuracy below 0.80 threshold",
          error: "MODEL_QUALITY_CHECK_FAILED",
        }),
      );

    const pipelineDefinition = dataPrepTask
      .next(trainTask)
      .next(evaluateTask)
      .next(evaluationCheck);

    const pipelineLogGroup = new logs.LogGroup(this, "PipelineLogGroup", {
      logGroupName: `/wellab/${envName}/ml-pipeline`,
      retention: isProd ? logs.RetentionDays.ONE_YEAR : logs.RetentionDays.THREE_MONTHS,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const mlPipeline = new stepfunctions.StateMachine(this, "MLPipeline", {
      stateMachineName: `wellab-ml-pipeline-${envName}`,
      definitionBody: stepfunctions.DefinitionBody.fromChainable(pipelineDefinition),
      timeout: cdk.Duration.hours(6),
      tracingEnabled: true,
      logs: {
        destination: pipelineLogGroup,
        level: stepfunctions.LogLevel.ALL,
      },
    });

    // -----------------------------------------------------------------------
    // Fairness audit Lambda — monthly cron
    // -----------------------------------------------------------------------
    const fairnessAuditFn = new lambda.Function(this, "FairnessAuditFn", {
      functionName: `wellab-fairness-audit-${envName}`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.main",
      code: lambda.Code.fromAsset("../src/ml/fairness-audit"),
      role: mlLambdaRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        ...commonMlEnv,
        AUDIT_TYPE: "fairness",
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    new events.Rule(this, "MonthlyFairnessAudit", {
      ruleName: `wellab-fairness-audit-monthly-${envName}`,
      description: "Trigger monthly fairness audit across all ML models",
      schedule: events.Schedule.cron({ minute: "0", hour: "3", day: "1", month: "*" }),
      targets: [new targets.LambdaFunction(fairnessAuditFn)],
    });

    // -----------------------------------------------------------------------
    // S3 trigger for batch processing
    // -----------------------------------------------------------------------
    const batchProcessFn = new lambda.Function(this, "BatchProcessFn", {
      functionName: `wellab-batch-process-${envName}`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "handler.main",
      code: lambda.Code.fromAsset("../src/ml/batch-process"),
      role: mlLambdaRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        ...commonMlEnv,
        STATE_MACHINE_ARN: mlPipeline.stateMachineArn,
      },
      tracing: lambda.Tracing.ACTIVE,
    });

    mlPipeline.grantStartExecution(batchProcessFn);

    rawDataBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new cdk.aws_s3_notifications.LambdaDestination(batchProcessFn),
      { prefix: "batch-uploads/", suffix: ".csv" },
    );

    // -----------------------------------------------------------------------
    // Outputs
    // -----------------------------------------------------------------------
    new cdk.CfnOutput(this, "NotebookName", {
      value: notebook.notebookInstanceName!,
      exportName: `${envName}-NotebookName`,
    });
    new cdk.CfnOutput(this, "MLPipelineArn", {
      value: mlPipeline.stateMachineArn,
      exportName: `${envName}-MLPipelineArn`,
    });
  }
}
