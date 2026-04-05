import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ApiStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly mainTable: dynamodb.Table;
  readonly rawDataBucket: s3.Bucket;
  readonly modelBucket: s3.Bucket;
  readonly researcherUserPool: cognito.UserPool;
  readonly participantUserPool: cognito.UserPool;
  readonly domainName: string;
  readonly isProd: boolean;
}

// ---------------------------------------------------------------------------
// ApiStack — API Gateway REST API + Lambda functions
// ---------------------------------------------------------------------------
export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly lambdaFunctions: lambda.Function[];
  public readonly apiEndpoint: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const {
      envName,
      mainTable,
      rawDataBucket,
      modelBucket,
      researcherUserPool,
      participantUserPool,
      domainName,
      isProd,
    } = props;

    this.lambdaFunctions = [];

    // -----------------------------------------------------------------------
    // Shared Lambda layer
    // -----------------------------------------------------------------------
    const sharedLayer = new lambda.LayerVersion(this, "SharedLayer", {
      layerVersionName: `wellab-shared-${envName}`,
      code: lambda.Code.fromAsset("../src/layers/shared"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "Shared utilities, validation, and DynamoDB helpers",
    });

    // -----------------------------------------------------------------------
    // API Gateway
    // -----------------------------------------------------------------------
    const accessLogGroup = new logs.LogGroup(this, "ApiAccessLogs", {
      logGroupName: `/wellab/${envName}/api-gateway/access`,
      retention: isProd ? logs.RetentionDays.ONE_YEAR : logs.RetentionDays.THREE_MONTHS,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.api = new apigateway.RestApi(this, "WELLabApi", {
      restApiName: `wellab-api-${envName}`,
      description: `WELLab Platform REST API (${envName})`,
      deployOptions: {
        stageName: envName,
        tracingEnabled: true, // X-Ray
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: !isProd, // request/response logging only in non-prod
        metricsEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(accessLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 200,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: isProd
          ? [`https://${domainName}`]
          : apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "Authorization",
          "X-Amz-Date",
          "X-Api-Key",
          "X-Amz-Security-Token",
        ],
        maxAge: cdk.Duration.hours(1),
      },
      endpointTypes: [apigateway.EndpointType.REGIONAL],
    });

    this.apiEndpoint = this.api.url;

    // -----------------------------------------------------------------------
    // Cognito authorizer (multi-pool)
    // -----------------------------------------------------------------------
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, "CognitoAuth", {
      cognitoUserPools: [researcherUserPool, participantUserPool],
      authorizerName: `wellab-cognito-${envName}`,
      identitySource: "method.request.header.Authorization",
    });

    const authorizedMethodOptions: apigateway.MethodOptions = {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // -----------------------------------------------------------------------
    // Request validators
    // -----------------------------------------------------------------------
    const bodyValidator = new apigateway.RequestValidator(this, "BodyValidator", {
      restApi: this.api,
      requestValidatorName: "validate-body",
      validateRequestBody: true,
      validateRequestParameters: false,
    });

    const paramsValidator = new apigateway.RequestValidator(this, "ParamsValidator", {
      restApi: this.api,
      requestValidatorName: "validate-params",
      validateRequestBody: false,
      validateRequestParameters: true,
    });

    // -----------------------------------------------------------------------
    // Usage plans + API keys for external access
    // -----------------------------------------------------------------------
    const externalKey = this.api.addApiKey("ExternalApiKey", {
      apiKeyName: `wellab-external-${envName}`,
      description: "API key for external / system integrations",
    });

    const usagePlan = this.api.addUsagePlan("ExternalUsagePlan", {
      name: `wellab-external-plan-${envName}`,
      description: "Rate-limited plan for external API consumers",
      throttle: { rateLimit: 100, burstLimit: 50 },
      quota: { limit: 10000, period: apigateway.Period.DAY },
    });
    usagePlan.addApiKey(externalKey);
    usagePlan.addApiStage({ stage: this.api.deploymentStage });

    // -----------------------------------------------------------------------
    // Common environment variables for all Lambdas
    // -----------------------------------------------------------------------
    const commonEnv: Record<string, string> = {
      TABLE_NAME: mainTable.tableName,
      RAW_DATA_BUCKET: rawDataBucket.bucketName,
      MODEL_BUCKET: modelBucket.bucketName,
      ENVIRONMENT: envName,
      POWERTOOLS_SERVICE_NAME: "wellab-api",
      LOG_LEVEL: isProd ? "WARN" : "DEBUG",
    };

    // -----------------------------------------------------------------------
    // Helper: create a Lambda function with least-privilege role
    // -----------------------------------------------------------------------
    const createLambda = (
      name: string,
      handler: string,
      codePath: string,
      options?: {
        readOnly?: boolean;
        needsS3Read?: boolean;
        needsS3Write?: boolean;
        timeout?: cdk.Duration;
        memorySize?: number;
        extraEnv?: Record<string, string>;
      },
    ): lambda.Function => {
      const opts = options || {};
      const fn = new lambda.Function(this, name, {
        functionName: `wellab-${name.toLowerCase()}-${envName}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        handler,
        code: lambda.Code.fromAsset(codePath),
        layers: [sharedLayer],
        environment: { ...commonEnv, ...opts.extraEnv },
        timeout: opts.timeout || cdk.Duration.seconds(30),
        memorySize: opts.memorySize || 256,
        tracing: lambda.Tracing.ACTIVE,
        logRetention: isProd ? logs.RetentionDays.ONE_YEAR : logs.RetentionDays.THREE_MONTHS,
      });

      // DynamoDB permissions — read-only or read-write
      if (opts.readOnly) {
        mainTable.grantReadData(fn);
      } else {
        mainTable.grantReadWriteData(fn);
      }

      // S3 permissions
      if (opts.needsS3Read) {
        rawDataBucket.grantRead(fn);
      }
      if (opts.needsS3Write) {
        rawDataBucket.grantReadWrite(fn);
      }

      this.lambdaFunctions.push(fn);
      return fn;
    };

    // -----------------------------------------------------------------------
    // Lambda functions per route group
    // -----------------------------------------------------------------------
    const participantsFn = createLambda(
      "Participants",
      "index.handler",
      "../src/lambdas/participants",
      { readOnly: false },
    );

    const observationsFn = createLambda(
      "Observations",
      "index.handler",
      "../src/lambdas/observations",
      { readOnly: false, needsS3Write: true },
    );

    const emotionalDynamicsFn = createLambda(
      "EmotionalDynamics",
      "index.handler",
      "../src/lambdas/emotional-dynamics",
      { readOnly: true, timeout: cdk.Duration.seconds(60), memorySize: 512 },
    );

    const healthFn = createLambda(
      "Health",
      "index.handler",
      "../src/lambdas/health",
      { readOnly: true, needsS3Read: true },
    );

    const lifespanFn = createLambda(
      "Lifespan",
      "index.handler",
      "../src/lambdas/lifespan",
      { readOnly: true, timeout: cdk.Duration.seconds(60), memorySize: 512 },
    );

    const cognitiveFn = createLambda(
      "Cognitive",
      "index.handler",
      "../src/lambdas/cognitive",
      { readOnly: true, timeout: cdk.Duration.seconds(60), memorySize: 512 },
    );

    const interventionsFn = createLambda(
      "Interventions",
      "index.handler",
      "../src/lambdas/interventions",
      { readOnly: false },
    );

    // DynamoDB Stream handler for derived metrics
    const streamHandlerFn = createLambda(
      "StreamHandler",
      "index.handler",
      "../src/lambdas/stream-handler",
      { readOnly: false, timeout: cdk.Duration.seconds(60), memorySize: 512 },
    );

    // Grant stream read to the stream handler
    mainTable.grantStreamRead(streamHandlerFn);
    streamHandlerFn.addEventSourceMapping("DynamoDBStream", {
      eventSourceArn: mainTable.tableStreamArn!,
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
      batchSize: 25,
      maxBatchingWindow: cdk.Duration.seconds(5),
      retryAttempts: 3,
      bisectBatchOnError: true,
    });

    // -----------------------------------------------------------------------
    // API routes
    // -----------------------------------------------------------------------
    const apiRoot = this.api.root.addResource("api");

    // Health check (public)
    const healthCheck = apiRoot.addResource("health-check");
    healthCheck.addMethod("GET", new apigateway.LambdaIntegration(participantsFn));

    // /participants
    const participants = apiRoot.addResource("participants");
    participants.addMethod("GET", new apigateway.LambdaIntegration(participantsFn), authorizedMethodOptions);
    participants.addMethod("POST", new apigateway.LambdaIntegration(participantsFn), {
      ...authorizedMethodOptions,
      requestValidator: bodyValidator,
    });

    const participantById = participants.addResource("{id}");
    participantById.addMethod("GET", new apigateway.LambdaIntegration(participantsFn), authorizedMethodOptions);
    participantById.addMethod("PUT", new apigateway.LambdaIntegration(participantsFn), {
      ...authorizedMethodOptions,
      requestValidator: bodyValidator,
    });

    // /participants/:id/observations
    const observations = participantById.addResource("observations");
    observations.addMethod("GET", new apigateway.LambdaIntegration(observationsFn), authorizedMethodOptions);
    observations.addMethod("POST", new apigateway.LambdaIntegration(observationsFn), {
      ...authorizedMethodOptions,
      requestValidator: bodyValidator,
    });

    // /participants/:id/emotional-dynamics
    const emotionalDyn = participantById.addResource("emotional-dynamics");
    emotionalDyn.addMethod("GET", new apigateway.LambdaIntegration(emotionalDynamicsFn), authorizedMethodOptions);

    // /participants/:id/health-records
    const healthRecords = participantById.addResource("health-records");
    healthRecords.addMethod("GET", new apigateway.LambdaIntegration(healthFn), authorizedMethodOptions);

    // /participants/:id/trajectory
    const trajectory = participantById.addResource("trajectory");
    trajectory.addMethod("GET", new apigateway.LambdaIntegration(lifespanFn), authorizedMethodOptions);

    // /participants/:id/cognitive
    const cognitiveRoute = participantById.addResource("cognitive");
    cognitiveRoute.addMethod("GET", new apigateway.LambdaIntegration(cognitiveFn), authorizedMethodOptions);

    // /participants/:id/interventions
    const interventionsRoute = participantById.addResource("interventions");
    interventionsRoute.addMethod("GET", new apigateway.LambdaIntegration(interventionsFn), authorizedMethodOptions);

    // /emotional-dynamics/analyze
    const edAnalyze = apiRoot.addResource("emotional-dynamics").addResource("analyze");
    edAnalyze.addMethod("POST", new apigateway.LambdaIntegration(emotionalDynamicsFn), {
      ...authorizedMethodOptions,
      requestValidator: bodyValidator,
    });

    // /health/causal-analysis
    const healthCausal = apiRoot.addResource("health").addResource("causal-analysis");
    healthCausal.addMethod("POST", new apigateway.LambdaIntegration(healthFn), {
      ...authorizedMethodOptions,
      requestValidator: bodyValidator,
    });

    // /lifespan/cluster-analysis
    const lifespanCluster = apiRoot.addResource("lifespan").addResource("cluster-analysis");
    lifespanCluster.addMethod("POST", new apigateway.LambdaIntegration(lifespanFn), {
      ...authorizedMethodOptions,
      requestValidator: bodyValidator,
    });

    // /cognitive/risk-assessment
    const cognitiveRisk = apiRoot.addResource("cognitive").addResource("risk-assessment");
    cognitiveRisk.addMethod("POST", new apigateway.LambdaIntegration(cognitiveFn), {
      ...authorizedMethodOptions,
      requestValidator: bodyValidator,
    });

    // /interventions
    const interventionsRoot = apiRoot.addResource("interventions");
    interventionsRoot.addMethod("POST", new apigateway.LambdaIntegration(interventionsFn), {
      ...authorizedMethodOptions,
      requestValidator: bodyValidator,
    });

    // -----------------------------------------------------------------------
    // Outputs
    // -----------------------------------------------------------------------
    new cdk.CfnOutput(this, "ApiUrl", {
      value: this.api.url,
      exportName: `${envName}-ApiUrl`,
    });
    new cdk.CfnOutput(this, "ApiId", {
      value: this.api.restApiId,
      exportName: `${envName}-ApiId`,
    });
  }
}
