import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { logger } from '../utils/logger';

const isLocal = process.env.DYNAMODB_LOCAL === 'true';
const endpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';

const baseClient = new DynamoDBClient({
  ...(isLocal && { endpoint }),
  region: process.env.AWS_REGION ?? 'us-east-1',
});

export const docClient = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

export const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME ?? 'wellab-main';

logger.info('DynamoDB client initialized', {
  table: TABLE_NAME,
  local: isLocal,
  ...(isLocal && { endpoint }),
});
