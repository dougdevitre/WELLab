/**
 * Script to create the DynamoDB Local table with GSIs for development.
 *
 * Usage:
 *   DYNAMODB_LOCAL=true npx ts-node src/db/local-setup.ts
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  type CreateTableCommandInput,
} from '@aws-sdk/client-dynamodb';

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME ?? 'wellab-main';
const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const REGION = process.env.AWS_REGION ?? 'us-east-1';

const client = new DynamoDBClient({ endpoint: ENDPOINT, region: REGION });

const tableDefinition: CreateTableCommandInput = {
  TableName: TABLE_NAME,
  KeySchema: [
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' },
  ],
  AttributeDefinitions: [
    { AttributeName: 'PK', AttributeType: 'S' },
    { AttributeName: 'SK', AttributeType: 'S' },
    { AttributeName: 'GSI1PK', AttributeType: 'S' },
    { AttributeName: 'GSI1SK', AttributeType: 'S' },
    { AttributeName: 'GSI2PK', AttributeType: 'S' },
    { AttributeName: 'GSI2SK', AttributeType: 'S' },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'GSI1',
      KeySchema: [
        { AttributeName: 'GSI1PK', KeyType: 'HASH' },
        { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    },
    {
      IndexName: 'GSI2',
      KeySchema: [
        { AttributeName: 'GSI2PK', KeyType: 'HASH' },
        { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    },
  ],
  ProvisionedThroughput: { ReadCapacityUnits: 10, WriteCapacityUnits: 10 },
};

async function tableExists(): Promise<boolean> {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    return true;
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name: string }).name === 'ResourceNotFoundException'
    ) {
      return false;
    }
    throw err;
  }
}

async function main(): Promise<void> {
  console.log(`Checking for table "${TABLE_NAME}" at ${ENDPOINT}...`);

  if (await tableExists()) {
    console.log(`Table "${TABLE_NAME}" already exists. Skipping creation.`);
    return;
  }

  console.log(`Creating table "${TABLE_NAME}" with GSI1 (status) and GSI2 (cohort)...`);
  await client.send(new CreateTableCommand(tableDefinition));
  console.log(`Table "${TABLE_NAME}" created successfully.`);
  console.log('Key schema:');
  console.log('  PK (HASH) / SK (RANGE)');
  console.log('  GSI1: GSI1PK (HASH) / GSI1SK (RANGE) — status queries');
  console.log('  GSI2: GSI2PK (HASH) / GSI2SK (RANGE) — cohort queries');
}

main().catch((err) => {
  console.error('Failed to set up local DynamoDB table:', err);
  process.exit(1);
});
