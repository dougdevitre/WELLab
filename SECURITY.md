# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | Yes                |
| < 1.0   | No                 |

## Reporting a Vulnerability

If you discover a security vulnerability in WELLab, please report it responsibly.

**Do not open a public issue.**

Instead, send an email to **security@wellab.org** with the following information:

- A description of the vulnerability and its potential impact.
- Steps to reproduce the issue.
- Any relevant logs, screenshots, or proof-of-concept code.

You can expect an initial response within 48 hours and a resolution timeline within 5 business days.

## Security Contact

- Email: security@wellab.org

## Vulnerability Disclosure Process

1. Report the vulnerability via the email above.
2. The security team will acknowledge receipt within 48 hours.
3. We will investigate and determine severity and impact.
4. A fix will be developed, tested, and deployed.
5. After the fix is released, we will coordinate public disclosure with the reporter.

## HIPAA-Adjacent Compliance Notes

WELLab processes health and wellness research data. While WELLab may not be a HIPAA-covered entity in all deployments, we follow HIPAA-adjacent best practices:

- **Data Encryption**: All data is encrypted in transit (TLS 1.2+) and at rest (AES-256 via AWS DynamoDB encryption).
- **Access Controls**: Authentication is handled via AWS Cognito with role-based access control.
- **Audit Logging**: All API access and data modifications are logged with timestamps and user identifiers.
- **Minimum Necessary**: The platform is designed to collect and expose only the minimum data necessary for each operation.
- **No PHI in Logs**: Application logs are configured to exclude personally identifiable health information.
- **Dependency Scanning**: Automated `pip-audit` and `npm audit` scans run on every CI build to detect known vulnerabilities in dependencies.
- **Secret Management**: API keys and secrets are never committed to version control. Environment variables are used for all sensitive configuration.

Deployments that handle Protected Health Information (PHI) must undergo a formal HIPAA compliance review and implement additional safeguards including a Business Associate Agreement (BAA) with AWS.
