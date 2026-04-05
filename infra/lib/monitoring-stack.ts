import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cw_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as sns from "aws-cdk-lib/aws-sns";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as logs from "aws-cdk-lib/aws-logs";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface MonitoringStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly api: apigateway.RestApi;
  readonly lambdaFunctions: lambda.Function[];
  readonly mainTable: dynamodb.Table;
  readonly logRetentionDays: number;
  readonly isProd: boolean;
}

// ---------------------------------------------------------------------------
// MonitoringStack — CloudWatch dashboards, alarms, SNS, X-Ray
// ---------------------------------------------------------------------------
export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    const { envName, api, lambdaFunctions, mainTable, logRetentionDays, isProd } = props;

    // -----------------------------------------------------------------------
    // SNS topic for alarm notifications
    // -----------------------------------------------------------------------
    this.alarmTopic = new sns.Topic(this, "AlarmTopic", {
      topicName: `wellab-alarms-${envName}`,
      displayName: `WELLab Alarms (${envName})`,
    });

    const alarmAction = new cw_actions.SnsAction(this.alarmTopic);

    // -----------------------------------------------------------------------
    // CloudWatch Log Groups with retention
    // -----------------------------------------------------------------------
    const retentionDays =
      logRetentionDays === 365
        ? logs.RetentionDays.ONE_YEAR
        : logRetentionDays === 180
          ? logs.RetentionDays.SIX_MONTHS
          : logs.RetentionDays.THREE_MONTHS;

    new logs.LogGroup(this, "ApiLogGroup", {
      logGroupName: `/wellab/${envName}/api`,
      retention: retentionDays,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    new logs.LogGroup(this, "MLLogGroup", {
      logGroupName: `/wellab/${envName}/ml`,
      retention: retentionDays,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    new logs.LogGroup(this, "AuditLogGroup", {
      logGroupName: `/wellab/${envName}/audit`,
      retention: logs.RetentionDays.ONE_YEAR, // always keep audit logs for 1 year
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // -----------------------------------------------------------------------
    // API Gateway metrics
    // -----------------------------------------------------------------------
    const api5xxMetric = api.metricServerError({
      period: cdk.Duration.minutes(5),
      statistic: "Sum",
    });

    const api4xxMetric = api.metricClientError({
      period: cdk.Duration.minutes(5),
      statistic: "Sum",
    });

    const apiCountMetric = api.metricCount({
      period: cdk.Duration.minutes(5),
      statistic: "Sum",
    });

    const apiLatencyP99 = api.metricLatency({
      period: cdk.Duration.minutes(5),
      statistic: "p99",
    });

    const apiLatencyP95 = api.metricLatency({
      period: cdk.Duration.minutes(5),
      statistic: "p95",
    });

    const apiLatencyP50 = api.metricLatency({
      period: cdk.Duration.minutes(5),
      statistic: "p50",
    });

    // 5xx error rate > 1%
    const errorRateAlarm = new cloudwatch.MathExpression({
      expression: "IF(requestCount > 0, (errors / requestCount) * 100, 0)",
      usingMetrics: {
        errors: api5xxMetric,
        requestCount: apiCountMetric,
      },
      period: cdk.Duration.minutes(5),
      label: "5xx Error Rate (%)",
    }).createAlarm(this, "Api5xxRateAlarm", {
      alarmName: `wellab-${envName}-api-5xx-rate`,
      alarmDescription: "API 5xx error rate exceeds 1% over 5 minutes",
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    errorRateAlarm.addAlarmAction(alarmAction);
    errorRateAlarm.addOkAction(alarmAction);

    // Latency p99 > 3s
    const latencyAlarm = apiLatencyP99.createAlarm(this, "ApiLatencyP99Alarm", {
      alarmName: `wellab-${envName}-api-latency-p99`,
      alarmDescription: "API p99 latency exceeds 3 seconds for 10 minutes",
      threshold: 3000, // milliseconds
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    latencyAlarm.addAlarmAction(alarmAction);
    latencyAlarm.addOkAction(alarmAction);

    // -----------------------------------------------------------------------
    // DynamoDB metrics & alarms
    // -----------------------------------------------------------------------
    const readThrottleMetric = mainTable.metricThrottledRequestsForOperations({
      operations: [dynamodb.Operation.GET_ITEM, dynamodb.Operation.QUERY, dynamodb.Operation.SCAN],
      period: cdk.Duration.minutes(1),
      statistic: "Sum",
    });

    const writeThrottleMetric = mainTable.metricThrottledRequestsForOperations({
      operations: [dynamodb.Operation.PUT_ITEM, dynamodb.Operation.UPDATE_ITEM, dynamodb.Operation.DELETE_ITEM],
      period: cdk.Duration.minutes(1),
      statistic: "Sum",
    });

    const dynamoThrottleAlarm = new cloudwatch.MathExpression({
      expression: "readThrottle + writeThrottle",
      usingMetrics: {
        readThrottle: readThrottleMetric,
        writeThrottle: writeThrottleMetric,
      },
      period: cdk.Duration.minutes(1),
      label: "DynamoDB Throttled Requests",
    }).createAlarm(this, "DynamoThrottleAlarm", {
      alarmName: `wellab-${envName}-dynamo-throttle`,
      alarmDescription: "DynamoDB throttling detected",
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dynamoThrottleAlarm.addAlarmAction(alarmAction);

    // -----------------------------------------------------------------------
    // Lambda error alarms (aggregate across all functions)
    // -----------------------------------------------------------------------
    const lambdaErrorMetrics: cloudwatch.IMetric[] = lambdaFunctions.map((fn, i) =>
      fn.metricErrors({ period: cdk.Duration.minutes(5), statistic: "Sum" }),
    );

    // Create individual alarms per function
    lambdaFunctions.forEach((fn) => {
      const errorAlarm = fn.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: "Sum",
      }).createAlarm(this, `LambdaErrors-${fn.node.id}`, {
        alarmName: `wellab-${envName}-lambda-errors-${fn.functionName}`,
        alarmDescription: `Lambda errors for ${fn.functionName}`,
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      errorAlarm.addAlarmAction(alarmAction);
    });

    // -----------------------------------------------------------------------
    // CloudWatch Dashboard
    // -----------------------------------------------------------------------
    const dashboard = new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName: `WELLab-${envName}`,
    });

    // Row 1 — API overview
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "API Request Count",
        left: [apiCountMetric],
        width: 6,
        period: cdk.Duration.minutes(5),
      }),
      new cloudwatch.GraphWidget({
        title: "API Latency (p50 / p95 / p99)",
        left: [apiLatencyP50, apiLatencyP95, apiLatencyP99],
        width: 6,
        period: cdk.Duration.minutes(5),
      }),
      new cloudwatch.GraphWidget({
        title: "API Errors (4xx / 5xx)",
        left: [api4xxMetric, api5xxMetric],
        width: 6,
        period: cdk.Duration.minutes(5),
      }),
      new cloudwatch.SingleValueWidget({
        title: "Active Alarms",
        metrics: [api5xxMetric],
        width: 6,
      }),
    );

    // Row 2 — DynamoDB
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "DynamoDB Read/Write Capacity",
        left: [
          mainTable.metricConsumedReadCapacityUnits({ period: cdk.Duration.minutes(5) }),
          mainTable.metricConsumedWriteCapacityUnits({ period: cdk.Duration.minutes(5) }),
        ],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: "DynamoDB Throttled Requests",
        left: [readThrottleMetric, writeThrottleMetric],
        width: 8,
      }),
      new cloudwatch.GraphWidget({
        title: "DynamoDB Latency",
        left: [
          mainTable.metricSuccessfulRequestLatency({
            dimensionsMap: { TableName: mainTable.tableName, Operation: "GetItem" },
            period: cdk.Duration.minutes(5),
          }),
          mainTable.metricSuccessfulRequestLatency({
            dimensionsMap: { TableName: mainTable.tableName, Operation: "Query" },
            period: cdk.Duration.minutes(5),
          }),
        ],
        width: 8,
      }),
    );

    // Row 3 — Lambda functions
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "Lambda Duration (all functions)",
        left: lambdaFunctions.map((fn) =>
          fn.metricDuration({ period: cdk.Duration.minutes(5), statistic: "p95" }),
        ),
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: "Lambda Errors (all functions)",
        left: lambdaFunctions.map((fn) =>
          fn.metricErrors({ period: cdk.Duration.minutes(5), statistic: "Sum" }),
        ),
        width: 12,
      }),
    );

    // -----------------------------------------------------------------------
    // Outputs
    // -----------------------------------------------------------------------
    new cdk.CfnOutput(this, "AlarmTopicArn", {
      value: this.alarmTopic.topicArn,
      exportName: `${envName}-AlarmTopicArn`,
    });
    new cdk.CfnOutput(this, "DashboardName", {
      value: dashboard.dashboardName,
      exportName: `${envName}-DashboardName`,
    });
  }
}
