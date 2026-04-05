import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53targets from "aws-cdk-lib/aws-route53-targets";
import * as acm from "aws-cdk-lib/aws-certificatemanager";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface FrontendStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly domainName: string;
  readonly apiEndpoint: string;
  readonly removalPolicy: cdk.RemovalPolicy;
}

// ---------------------------------------------------------------------------
// FrontendStack — S3 + CloudFront for React SPA hosting
// ---------------------------------------------------------------------------
export class FrontendStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { envName, domainName, apiEndpoint, removalPolicy } = props;
    const isProd = envName === "prod";

    // -----------------------------------------------------------------------
    // S3 — static website hosting bucket
    // -----------------------------------------------------------------------
    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: `wellab-frontend-${envName}-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy,
      autoDeleteObjects: !isProd,
      versioned: isProd,
    });

    // -----------------------------------------------------------------------
    // CloudFront Origin Access Identity
    // -----------------------------------------------------------------------
    const oai = new cloudfront.OriginAccessIdentity(this, "OAI", {
      comment: `WELLab frontend OAI (${envName})`,
    });
    siteBucket.grantRead(oai);

    // -----------------------------------------------------------------------
    // ACM Certificate (must be in us-east-1 for CloudFront)
    // Look up the hosted zone; if it does not exist, the distribution is
    // created without a custom domain (useful for initial bootstrapping).
    // -----------------------------------------------------------------------
    let certificate: acm.ICertificate | undefined;
    let hostedZone: route53.IHostedZone | undefined;

    try {
      hostedZone = route53.HostedZone.fromLookup(this, "Zone", {
        domainName: "wellab.wustl.edu",
      });

      certificate = new acm.DnsValidatedCertificate(this, "SiteCertificate", {
        domainName: domainName,
        hostedZone,
        region: "us-east-1", // CloudFront requirement
      });
    } catch {
      // Hosted zone not found — skip custom domain setup
    }

    // -----------------------------------------------------------------------
    // CloudFront Distribution
    // -----------------------------------------------------------------------
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, "SecurityHeaders", {
      responseHeadersPolicyName: `wellab-security-headers-${envName}`,
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: {
          frameOption: cloudfront.HeadersFrameOption.DENY,
          override: true,
        },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.days(365),
          includeSubdomains: true,
          preload: true,
          override: true,
        },
        xssProtection: {
          protection: true,
          modeBlock: true,
          override: true,
        },
      },
    });

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `WELLab SPA distribution (${envName})`,
      defaultBehavior: {
        origin: new origins.S3Origin(siteBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy,
        compress: true,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
      ],
      ...(certificate && {
        domainNames: [domainName],
        certificate,
      }),
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: isProd ? cloudfront.PriceClass.PRICE_CLASS_ALL : cloudfront.PriceClass.PRICE_CLASS_100,
      enabled: true,
    });

    // -----------------------------------------------------------------------
    // Route53 alias record
    // -----------------------------------------------------------------------
    if (hostedZone) {
      new route53.ARecord(this, "SiteAliasRecord", {
        zone: hostedZone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(
          new route53targets.CloudFrontTarget(this.distribution),
        ),
      });
    }

    // -----------------------------------------------------------------------
    // Outputs
    // -----------------------------------------------------------------------
    new cdk.CfnOutput(this, "SiteBucketName", {
      value: siteBucket.bucketName,
      exportName: `${envName}-SiteBucketName`,
    });
    new cdk.CfnOutput(this, "DistributionId", {
      value: this.distribution.distributionId,
      exportName: `${envName}-DistributionId`,
    });
    new cdk.CfnOutput(this, "DistributionDomainName", {
      value: this.distribution.distributionDomainName,
      exportName: `${envName}-DistributionDomainName`,
    });
  }
}
