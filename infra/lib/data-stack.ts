import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface DataStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly removalPolicy: cdk.RemovalPolicy;
  readonly isProd: boolean;
}

// ---------------------------------------------------------------------------
// DataStack — DynamoDB single-table + S3 buckets
// ---------------------------------------------------------------------------
export class DataStack extends cdk.Stack {
  public readonly mainTable: dynamodb.Table;
  public readonly rawDataBucket: s3.Bucket;
  public readonly modelBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { envName, removalPolicy, isProd } = props;

    // -----------------------------------------------------------------------
    // DynamoDB — wellab-main (single-table design)
    // -----------------------------------------------------------------------
    this.mainTable = new dynamodb.Table(this, "MainTable", {
      tableName: `wellab-main-${envName}`,
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy,
    });

    // GSI1 — query by status (e.g. participant enrollment status)
    this.mainTable.addGlobalSecondaryIndex({
      indexName: "GSI1-status",
      partitionKey: { name: "GSI1PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI1SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2 — query by culture group
    this.mainTable.addGlobalSecondaryIndex({
      indexName: "GSI2-culture-group",
      partitionKey: { name: "GSI2PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "GSI2SK", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // -----------------------------------------------------------------------
    // S3 — raw research data
    // -----------------------------------------------------------------------
    this.rawDataBucket = new s3.Bucket(this, "RawDataBucket", {
      bucketName: `wellab-raw-data-${envName}-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: !isProd,
      lifecycleRules: [
        {
          id: "ArchiveToGlacier",
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(730),
            },
          ],
        },
        {
          id: "CleanupIncompleteUploads",
          enabled: true,
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
    });

    // -----------------------------------------------------------------------
    // S3 — ML model artifacts
    // -----------------------------------------------------------------------
    this.modelBucket = new s3.Bucket(this, "ModelBucket", {
      bucketName: `wellab-models-${envName}-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: !isProd,
    });

    // -----------------------------------------------------------------------
    // Outputs
    // -----------------------------------------------------------------------
    new cdk.CfnOutput(this, "MainTableName", {
      value: this.mainTable.tableName,
      exportName: `${envName}-MainTableName`,
    });
    new cdk.CfnOutput(this, "MainTableStreamArn", {
      value: this.mainTable.tableStreamArn!,
      exportName: `${envName}-MainTableStreamArn`,
    });
    new cdk.CfnOutput(this, "RawDataBucketName", {
      value: this.rawDataBucket.bucketName,
      exportName: `${envName}-RawDataBucketName`,
    });
    new cdk.CfnOutput(this, "ModelBucketName", {
      value: this.modelBucket.bucketName,
      exportName: `${envName}-ModelBucketName`,
    });
  }
}
