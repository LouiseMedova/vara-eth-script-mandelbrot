// create-program.ts
import 'dotenv/config';

import { createPublicClient, createWalletClient, http, hexToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'node:fs/promises';

import { Sails } from 'sails-js';
import { SailsIdlParser } from 'sails-js-parser';
import { Buffer } from 'node:buffer';

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
const MAN_CODE_ID = process.env.MAN_CODE_ID as `0x${string}`;

const IDL_PATH = new URL('../idl/manager.idl', import.meta.url);

async function initSails(programId: `0x${string}`) {
  const parser = await SailsIdlParser.new();
  const sails = new Sails(parser);

  const idl = await readFile(IDL_PATH, 'utf8');

  sails.parseIdl(idl);

  sails.setProgramId(programId);

  return sails;
}

const CHECKER_PROGRAMS: `0x${string}`[] = [
  '0xe65038b0128b2d41e3ba39ed8b0edceabea9c508',
  '0x0b54a4d6b01af43ecdecb6614f0414a75048db0d',
  '0xa9064389e4c8cf9371fddb80fc3a30779af65879',
  '0xd52d1779ac35518435ce892a7a64b5008e6e5511',
  '0x5da19597ea962fe371fc7170f922c34b0de78853'
]

async function waitForProgramOnVara(
  api: VaraEthApi,
  programId: `0x${string}`,
  {
    maxAttempts = 60,
    delayMs = 3_000,
  }: { maxAttempts?: number; delayMs?: number } = {},
): Promise<void> {
  const target = programId.toLowerCase();

  for (let i = 0; i < maxAttempts; i++) {
    const ids = await api.query.program.getIds();
    const hasProgram = ids.map((x) => x.toLowerCase()).includes(target);

    if (hasProgram) {
      console.log(`Program ${programId} appeared on Vara.Eth (attempt ${i + 1}).`);
      return;
    }

    console.log(
      `Program not yet visible on Vara.Eth, attempt ${i + 1}/${maxAttempts}...`,
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`Program ${programId} did not appear on Vara.Eth in time`);
}


function addressToU16x32(addr: `0x${string}`): number[] {
  const bytes = hexToBytes(addr); 

  if (bytes.length !== 20) {
    throw new Error(`Unexpected address length: ${bytes.length}, expected 20`);
  }

  const full32 = new Uint8Array(32);
  full32.set(bytes, 12);

  const arrU16 = Array.from(full32, (b) => b as number);
  if (arrU16.length !== 32) {
    throw new Error('Logic error: arrU16 must be length 32');
  }

  return arrU16;
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
    console.log('Manager CodeId:', MAN_CODE_ID);

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
    const wvara = getWrappedVaraClient(await router.wrappedVara(), ethereumClient);

    const topUpAmount = BigInt(10 * 1e12);

    const tx = await router.createProgram(MAN_CODE_ID);
    await tx.sendAndWaitForReceipt();

    const programId = await tx.getProgramId();
    console.log('Manager programId:', programId);

    await waitForProgramOnVara(api, programId);

    const mirror = getMirrorClient(programId, ethereumClient);

    const approveTx = await wvara.approve(programId, topUpAmount);
    await approveTx.sendAndWaitForReceipt();

    const topUpTx = await mirror.executableBalanceTopUp(topUpAmount);
    const { status } = await topUpTx.sendAndWaitForReceipt();
    console.log("Executable balance result:", status)
  
    const initMsgTx = await mirror.sendMessage('0x0c4e6577', 0n);
    await initMsgTx.send();
    const { waitForReply: initReply } = await initMsgTx.setupReplyListener();
    const reply = await initReply();
    console.log(reply)

    // const programId = '0x8ab286b80e1d1ce7e8f466715b8dd41b00cc542d';
    // const mirror = getMirrorClient(programId, ethereumClient);
    const stateHash = await mirror.stateHash();

    // Read the full program state from Vara.Eth
    const state = await api.query.program.readState(stateHash);
    const balance = await wvara.balanceOf(programId);

    console.log('Program status:', state.program);
    console.log('Executable balance:', state.balance);
    console.log('Balance:', balance);

    const sails = await initSails(programId);

    // GenerateAndStorePoints
    const genPointsPayloadBytes = sails.services.Manager.functions.GenerateAndStorePoints.encodePayload(100, 100, -2, 0, 1, 0, -15, 2, 15, 1, 30000, false, false, 0, 0);
    await sendManagerMessage(mirror, genPointsPayloadBytes, 0n);
    await getPointsLen(sails, api, ethereumClient, programId);

    // Add checkers
    const checkerInput: number[][] = CHECKER_PROGRAMS.map(addressToU16x32);
    const checkersPayloadBytes = sails.services.Manager.functions.AddCheckers.encodePayload(checkerInput);
    await sendManagerMessage(mirror, checkersPayloadBytes, 0n);

    // Check Points
    const checkPayloadBytes = sails.services.Manager.functions.CheckPointsSet.encodePayload(1000, 5, true);
    await sendManagerMessage(mirror, checkPayloadBytes, 0n);
    await getCheckedCount(sails, api, ethereumClient, programId);
}


async function sendManagerMessage(
  mirror: ReturnType<typeof getMirrorClient>,
  payload: string,
  value: bigint = 0n,
): Promise<void> {
  const msgTx = await mirror.sendMessage(payload, value);
  await msgTx.send();

  const { waitForReply } = await msgTx.setupReplyListener();
  const reply = await waitForReply();

  console.log('Reply:', reply.payload, reply.replyCode, reply.value);

}

async function getPointsLen(
  sails: Sails,
  api: VaraEthApi,
  ethereumClient: EthereumClient,
  programId: `0x${string}`,
): Promise<number> {
  const queryPayload = sails.services.Manager.queries.GetPointsLen.encodePayload();

  const queryReply = await api.call.program.calculateReplyForHandle(
    ethereumClient.accountAddress,
    programId,
    queryPayload,
  );

  const decoded = sails.services.Manager.queries.GetPointsLen.decodeResult(
    queryReply.payload,
  );

  console.log('Amount of points:', decoded);
  return decoded;
}

async function getCheckedCount(
  sails: Sails,
  api: VaraEthApi,
  ethereumClient: EthereumClient,
  programId: `0x${string}`,
): Promise<number> {
  const queryPayload = sails.services.Manager.queries.GetCheckedCount.encodePayload();

  const queryReply = await api.call.program.calculateReplyForHandle(
    ethereumClient.accountAddress,
    programId,
    queryPayload,
  );

  const decoded = sails.services.Manager.queries.GetCheckedCount.decodeResult(
    queryReply.payload,
  );

  console.log('Amount of checked points:', decoded);
  return decoded;
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
