import { SubstrateProject } from '@subql/types';
import fs from 'fs';

const endpointEnv =
  process.env.SUBQUERY_ENDPOINT ?? process.env.ENDPOINT ?? 'ws://127.0.0.1:9944';
const chainIdEnv =
  process.env.SUBQUERY_CHAIN_ID ??
  process.env.CHAIN_ID ??
  '0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3';
const moduleName = process.env.SUBQUERY_MODULE_NAME ?? 'remitchain';
const eventRemittanceSent = process.env.SUBQUERY_EVENT_REMITTANCE_SENT ?? 'RemittanceSent';
const eventCashOutRequested = process.env.SUBQUERY_EVENT_CASHOUT_REQUESTED ?? 'CashOutRequested';
const eventCashOutCompleted = process.env.SUBQUERY_EVENT_CASHOUT_COMPLETED ?? 'CashOutCompleted';
const eventDisputeOpened = process.env.SUBQUERY_EVENT_DISPUTE_OPENED ?? 'DisputeOpened';
const startBlock = Number(process.env.SUBQUERY_START_BLOCK ?? 1);
const typesPath = process.env.SUBQUERY_TYPES_PATH ?? process.env.CHAIN_TYPES_PATH;
let customTypes: Record<string, unknown> | undefined;
if (typesPath && fs.existsSync(typesPath)) {
  try {
    customTypes = JSON.parse(fs.readFileSync(typesPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid JSON in types file: ${typesPath}`);
  }
}

const project: SubstrateProject = {
  name: 'remitchain-indexer',
  version: '0.1.0',
  specVersion: '1.0.0',
  runner: {
    node: {
      name: '@subql/node',
      version: '*',
    },
    query: {
      name: '@subql/query',
      version: '*',
    },
  },
  schema: {
    file: './schema.graphql',
  },
  network: {
    chainId: chainIdEnv,
    endpoint: endpointEnv.split(',').map((value) => value.trim()),
    dictionary: 'https://api.subquery.network/sq/subquery/polkadot-dictionary',
    types: customTypes,
  },
  dataSources: [
    {
      kind: 'substrate/Runtime',
      startBlock,
      mapping: {
        file: './dist/index.js',
        handlers: [
          {
            handler: 'handleRemittanceSent',
            kind: 'substrate/EventHandler',
            filter: {
              module: moduleName,
              method: eventRemittanceSent,
            },
          },
          {
            handler: 'handleCashOutRequested',
            kind: 'substrate/EventHandler',
            filter: {
              module: moduleName,
              method: eventCashOutRequested,
            },
          },
          {
            handler: 'handleCashOutCompleted',
            kind: 'substrate/EventHandler',
            filter: {
              module: moduleName,
              method: eventCashOutCompleted,
            },
          },
          {
            handler: 'handleDisputeOpened',
            kind: 'substrate/EventHandler',
            filter: {
              module: moduleName,
              method: eventDisputeOpened,
            },
          },
        ],
      },
    },
  ],
};

export default project;
