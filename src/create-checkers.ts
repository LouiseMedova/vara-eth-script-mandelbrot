// create-program.ts
import 'dotenv/config';

import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

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
const PROGRAM_COUNT = 5;

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

  const wvara = getWrappedVaraClient(WVARA_ADDRESS, ethereumClient);

  const topUpAmount = BigInt(10 * 1e12);

  const balance = await wvara.balanceOf(ethereumClient.accountAddress);
  console.log("sender balance", balance);
  const programIds: `0x${string}`[] = [];

  for (let i = 0; i < PROGRAM_COUNT; i++) {
    console.log(`\n[${i + 1}/${PROGRAM_COUNT}] Creating program from codeId...`);

    const tx = await router.createProgram(CODE_ID);
    const receipt = await tx.sendAndWaitForReceipt();
    console.log('  Tx sent. Hash:', receipt.transactionHash);

    const programId = await tx.getProgramId();
    console.log('  New programId:', programId);

    programIds.push(programId);

    const mirror = getMirrorClient(programId, ethereumClient);

    await waitForProgramOnVara(api, programId);

    const approveTx = await wvara.approve(programId, topUpAmount);
    await approveTx.sendAndWaitForReceipt();

    const topUpTx = await mirror.executableBalanceTopUp(topUpAmount);
    await topUpTx.sendAndWaitForReceipt();

    const msgTx = await mirror.sendMessage('0x0c4e6577', 0n);
    await msgTx.send();
    const { waitForReply } = await msgTx.setupReplyListener();
    await waitForReply();
    const stateHash = await mirror.stateHash();

    // Read the full program state from Vara.Eth
    const state = await api.query.program.readState(stateHash);

    console.log('Program status:', state.program);
    console.log('Executable balance:', state.balance);
  }

  console.log('\nAll deployed programIds:');
  console.log(programIds)

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
