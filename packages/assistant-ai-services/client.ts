import { memoize } from 'lodash';
import { chatgptConstants } from '@assistant/constants';
import type { ChatGPTAPI, SendMessageOptions } from 'chatgpt';

type ClientInfo = {
  client: ChatGPTAPI;
  status: 'running' | 'invalid';
  errorCount: number;
};

const CLIENTS = new Set<ClientInfo>();

export async function trySendMessage(question: string, options: SendMessageOptions, tryCount = 2) {
  for (let i = 0; i < tryCount; i++) {
    const res = await sendMessage(question, options).catch(err => {
      console.error(err);

      return null;
    });

    if (res) {
      return res;
    }
  }

  throw new Error('Try send message error');
}

export async function sendMessage(question: string, options: SendMessageOptions) {
  const client = await getAvailableClient();

  if (!client) {
    throw new Error('No available clients');
  }

  try {
    const res = await client.client.sendMessage(question, options);
    return res;
  } catch (err) {
    client.errorCount++;

    if (client.errorCount > chatgptConstants.maxContinuousCount) {
      client.status = 'invalid';
    }

    throw err;
  }
}

const initClient = memoize(async () => {
  const { ChatGPTAPI } = await import('chatgpt');

  chatgptConstants.apiKeys.forEach(key => {
    const client = new ChatGPTAPI({
      apiKey: key,
      debug: true,
    });

    CLIENTS.add({
      status: 'running',
      errorCount: 0,
      client,
    });
  });
});

let index = 0;

export const getAvailableClient = async function () {
  await initClient();

  const clients = getClientsInfo().filter(info => info.status === 'running');

  if (clients.length === 0) return null;

  const client = clients[index % clients.length];

  index++;

  return client;
};

function getClientsInfo() {
  return Array.from(CLIENTS.values());
}
