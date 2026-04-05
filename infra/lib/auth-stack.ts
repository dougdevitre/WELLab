import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface AuthStackProps extends cdk.StackProps {
  readonly envName: string;
  readonly removalPolicy: cdk.RemovalPolicy;
}

// ---------------------------------------------------------------------------
// AuthStack — Cognito User Pools for researchers and participants
// ---------------------------------------------------------------------------
export class AuthStack extends cdk.Stack {
  public readonly researcherUserPool: cognito.UserPool;
  public readonly participantUserPool: cognito.UserPool;
  public readonly researcherClient: cognito.UserPoolClient;
  public readonly participantClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { envName, removalPolicy } = props;

    // -----------------------------------------------------------------------
    // Researcher User Pool
    // -----------------------------------------------------------------------
    this.researcherUserPool = new cognito.UserPool(this, "ResearcherPool", {
      userPoolName: `wellab-researchers-${envName}`,
      selfSignUpEnabled: false, // admin-created accounts only
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      customAttributes: {
        role: new cognito.StringAttribute({ mutable: true, minLen: 1, maxLen: 64 }),
        institution: new cognito.StringAttribute({ mutable: true, minLen: 1, maxLen: 256 }),
        department: new cognito.StringAttribute({ mutable: true, minLen: 1, maxLen: 256 }),
      },
      removalPolicy,
    });

    this.researcherClient = this.researcherUserPool.addClient("ResearcherWebClient", {
      userPoolClientName: `wellab-researcher-web-${envName}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [`https://${envName === "prod" ? "" : envName + "."}wellab.wustl.edu/callback`],
        logoutUrls: [`https://${envName === "prod" ? "" : envName + "."}wellab.wustl.edu/logout`],
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // -----------------------------------------------------------------------
    // Participant User Pool
    // -----------------------------------------------------------------------
    this.participantUserPool = new cognito.UserPool(this, "ParticipantPool", {
      userPoolName: `wellab-participants-${envName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true, phone: true },
      autoVerify: { email: true, phone: true },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: true, otp: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_AND_PHONE_WITHOUT_MFA,
      customAttributes: {
        participant_id: new cognito.StringAttribute({ mutable: false, minLen: 1, maxLen: 128 }),
        consent_flags: new cognito.StringAttribute({ mutable: true, minLen: 0, maxLen: 1024 }),
        enrollment_date: new cognito.StringAttribute({ mutable: false, minLen: 10, maxLen: 10 }),
        culture_group: new cognito.StringAttribute({ mutable: true, minLen: 1, maxLen: 64 }),
      },
      removalPolicy,
    });

    this.participantClient = this.participantUserPool.addClient("ParticipantWebClient", {
      userPoolClientName: `wellab-participant-web-${envName}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [`https://${envName === "prod" ? "" : envName + "."}wellab.wustl.edu/callback`],
        logoutUrls: [`https://${envName === "prod" ? "" : envName + "."}wellab.wustl.edu/logout`],
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(90),
    });

    // -----------------------------------------------------------------------
    // Identity Pool (federated identities for fine-grained IAM)
    // -----------------------------------------------------------------------
    this.identityPool = new cognito.CfnIdentityPool(this, "IdentityPool", {
      identityPoolName: `wellab_identity_${envName}`,
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.researcherClient.userPoolClientId,
          providerName: this.researcherUserPool.userPoolProviderName,
        },
        {
          clientId: this.participantClient.userPoolClientId,
          providerName: this.participantUserPool.userPoolProviderName,
        },
      ],
    });

    // -----------------------------------------------------------------------
    // Outputs
    // -----------------------------------------------------------------------
    new cdk.CfnOutput(this, "ResearcherUserPoolId", {
      value: this.researcherUserPool.userPoolId,
      exportName: `${envName}-ResearcherUserPoolId`,
    });
    new cdk.CfnOutput(this, "ResearcherClientId", {
      value: this.researcherClient.userPoolClientId,
      exportName: `${envName}-ResearcherClientId`,
    });
    new cdk.CfnOutput(this, "ParticipantUserPoolId", {
      value: this.participantUserPool.userPoolId,
      exportName: `${envName}-ParticipantUserPoolId`,
    });
    new cdk.CfnOutput(this, "ParticipantClientId", {
      value: this.participantClient.userPoolClientId,
      exportName: `${envName}-ParticipantClientId`,
    });
    new cdk.CfnOutput(this, "IdentityPoolId", {
      value: this.identityPool.ref,
      exportName: `${envName}-IdentityPoolId`,
    });
  }
}
