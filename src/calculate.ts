// create-program.ts
import 'dotenv/config';

import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'node:fs/promises';

import { Sails } from 'sails-js';
import { SailsIdlParser } from 'sails-js-parser';

import {
  VaraEthApi,
  HttpVaraEthProvider,
  EthereumClient,
  getRouterClient,
  getWrappedVaraClient, 
  getMirrorClient
} from '@vara-eth/api';


const ETH_RPC = process.env.ETH_RPC!;
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS as `0x${string}`;
const WVARA_ADDRESS = process.env.WVARA_ADDRESS as `0x${string}`;
const VARA_HTTP = (
  process.env.VARA_HTTP ?? 'http://vara-eth-validator-1.gear-tech.io:9944'
) as `http://${string}` | `https://${string}`;

const CODE_ID = process.env.CODE_ID as `0x${string}`;
const IDL_PATH = new URL('../idl/mandelbrot_checker.idl', import.meta.url);


async function initSails(programId: `0x${string}`) {
  const parser = await SailsIdlParser.new();
  const sails = new Sails(parser);

  const idl = await readFile(IDL_PATH, 'utf8');

  sails.parseIdl(idl);

  sails.setProgramId(programId);

  return sails;
}

async function main() {
  if (!ETH_RPC) throw new Error('ETH_RPC is not set');
  if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY is not set');
  if (!ROUTER_ADDRESS) throw new Error('ROUTER_ADDRESS is not set');
  if (!CODE_ID) throw new Error('CODE_ID is not set');

  console.log('Using ETH RPC:', ETH_RPC);
  console.log('Router:', ROUTER_ADDRESS);
  console.log('Vara HTTP:', VARA_HTTP);
  console.log('CodeId:', CODE_ID);

  const publicClient = createPublicClient({
    transport: http(ETH_RPC),
  });

  const account = privateKeyToAccount(PRIVATE_KEY);

  const walletClient = createWalletClient({
    account,
    transport: http(ETH_RPC),
  });

  const ethereumClient = new EthereumClient(publicClient, walletClient);

  const api = new VaraEthApi(
    new HttpVaraEthProvider(VARA_HTTP),
    ethereumClient,
    ROUTER_ADDRESS
  );

  const router = getRouterClient(ROUTER_ADDRESS, ethereumClient);

  const programId = '0x5386a5ac2d70a33b58dec5b8b6700b261fb16f01';

  const mirror = getMirrorClient(programId, ethereumClient);

  const sails = await initSails(programId);

  const points: number[] = [104, 0, 0, 0, 0, 25, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 121, 255, 255, 255, 255, 255, 255, 255, 3, 0, 0, 0, 1, 0, 0, 0, 25, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 54, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 99, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 135, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 121, 255, 255, 255, 255, 255, 255, 255, 3, 0, 0, 0, 27, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, 135, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 9, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 5, 0, 0, 0, 9, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 248, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 6, 0, 0, 0, 39, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 7, 0, 0, 0, 31, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 135, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 8, 0, 0, 0, 25, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 121, 255, 255, 255, 255, 255, 255, 255, 3, 0, 0, 0, 9, 0, 0, 0, 25, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 54, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 10, 0, 0, 0, 99, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 135, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 11, 0, 0, 0, 99, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 27, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 12, 0, 0, 0, 135, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 9, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 13, 0, 0, 0, 9, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 248, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 14, 0, 0, 0, 39, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 15, 0, 0, 0, 31, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 135, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 16, 0, 0, 0, 25, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 121, 255, 255, 255, 255, 255, 255, 255, 3, 0, 0, 0, 17, 0, 0, 0, 25, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 54, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 18, 0, 0, 0, 99, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 135, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 19, 0, 0, 0, 99, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 27, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 20, 0, 0, 0, 135, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 9, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 21, 0, 0, 0, 9, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 248, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 22, 0, 0, 0, 39, 1, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 23, 0, 0, 0, 31, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 135, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 24, 0, 0, 0, 25, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 121, 255, 255, 255, 255, 255, 255, 255, 3, 0, 0, 0, 25, 0, 0, 0, 25, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 54, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0]; // твои u16-координаты
  const maxIter = 10;                     

  const checkPayload = sails.services.MandelbrotChecker.functions.CheckMandelbrotPoints.encodePayload();
  const tx = await mirror.sendMessage(checkPayload, 0n);
  await tx.sendAndWaitForReceipt();
  const { waitForReply } = await tx.setupReplyListener();
  const { payload: replyPayload  } = await waitForReply;
  console.log('Result:', replyPayload);


  const result = sails.services.MandelbrotChecker.functions.CheckMandelbrotPoints.decodeResult(replyPayload);
  console.log('Result:', result);

}

main()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
