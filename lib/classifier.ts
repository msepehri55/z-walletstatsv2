import { Category, CCO_DEPLOY_FACTORY, GM_CONTRACTS, METHOD_IDS, STAKING_CONTRACT } from "./constants";
import { TxBasic, TxEnriched, TxLog } from "./types";
import { weiToEther } from "./format";
import { explorerTxLogs, explorerTokenInfo } from "./explorer";

const ZERO = "0x0000000000000000000000000000000000000000";

function dirOf(tx: TxBasic, subject: string) {
  const from = (tx.from || "").toLowerCase();
  const to = (tx.to || "").toLowerCase();
  if (from === subject && to === subject) return "self";
  if (from === subject) return "out";
  return "in";
}

function isContractCreation(tx: TxBasic) {
  return !tx.to || tx.to === "" || tx.to === "0x" || tx.to === ZERO;
}

function isHexZero(data?: string) {
  return !data || data === "0x" || data === "0x0";
}

function startsWithAny(x: string | undefined, arr: string[]) {
  if (!x) return false;
  return arr.some(s => x.toLowerCase().startsWith(s.toLowerCase()));
}

function looksLikeDomainToken(name?: string, symbol?: string) {
  const s = `${name || ""} ${symbol || ""}`.toLowerCase();
  return (
    s.includes("domain") ||
    s.includes("name") ||
    s.includes(".zen") ||
    s.includes("zns") ||
    s.includes("ens") ||
    s.includes("dns")
  );
}

async function detectMintsFromLogs(subject: string, logs: TxLog[]) {
  // Find ERC721 or ERC1155 mints to subject (from address zero)
  const mints: { tokenAddress: string; tokenId?: string; standard: "ERC-721" | "ERC-1155" | "Unknown"; isDomain?: boolean }[] = [];
  for (const l of logs) {
    const addr = l.address?.toLowerCase();
    const topic0 = l.topics?.[0]?.toLowerCase();
    if (!addr || !topic0) continue;

    // ERC721 Transfer(address,address,uint256) topic is ERC20 Transfer too; we need to check 'from == 0x0'
    if (topic0 === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
      const from = "0x" + (l.topics?.[1]?.slice(26) || "").toLowerCase();
      const to = "0x" + (l.topics?.[2]?.slice(26) || "").toLowerCase();
      if (from === ZERO && to === subject.toLowerCase()) {
        // Need token info to disambiguate ERC20 vs ERC721
        const info = await explorerTokenInfo(addr);
        if ((info.type || "").toUpperCase().includes("721")) {
          const tokenId = l.topics?.[3];
          mints.push({
            tokenAddress: addr,
            tokenId,
            standard: "ERC-721",
            isDomain: looksLikeDomainToken(info.name, info.symbol)
          });
        }
      }
    }

    // ERC1155 TransferSingle(address,address,address,uint256,uint256)
    if (topic0 === "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62") {
      // topics[2] = from, topics[3] = to
      const from = "0x" + (l.topics?.[2]?.slice(26) || "").toLowerCase();
      const to = "0x" + (l.topics?.[3]?.slice(26) || "").toLowerCase();
      if (from === ZERO && to === subject.toLowerCase()) {
        const info = await explorerTokenInfo(addr);
        mints.push({
          tokenAddress: addr,
          standard: "ERC-1155",
          isDomain: looksLikeDomainToken(info.name, info.symbol)
        });
      }
    }
    // ERC1155 batch similarly could be added if needed
  }
  return mints;
}

export async function classifyTransaction(
  tx: TxBasic,
  subject: string,
  opts?: { fetchLogsIfNeeded?: boolean }
): Promise<TxEnriched> {
  const direction = dirOf(tx, subject) as "out" | "in" | "self";
  const methodId = (tx.methodId || (tx.input || "").slice(0, 10)).toLowerCase();
  const to = (tx.to || "").toLowerCase();
  const from = (tx.from || "").toLowerCase();

  let category: Category | null = null;
  let nftMints: any[] | undefined;
  let logsChecked = false;

  if (tx.status === 0) {
    category = "fail";
  }

  // Special/fast-path rules
  if (!category) {
    if (isContractCreation(tx) && direction === "out") {
      category = "cc_deploy";
    } else if (to && to === CCO_DEPLOY_FACTORY && direction === "out") {
      category = "cco_deploy";
    } else if (to && GM_CONTRACTS.includes(to) && direction === "out") {
      category = "gm";
    } else if (to && to === STAKING_CONTRACT && direction === "out") {
      category = "stake";
    } else if (direction === "out" && methodId === "0x095ea7b3") {
      category = "approve";
    } else if (direction === "out" && startsWithAny(methodId, [
      METHOD_IDS.swapExactTokensForETH,
      METHOD_IDS.swapExactETHForTokens,
      METHOD_IDS.swapExactTokensForTokens,
      METHOD_IDS.exactInput,
      METHOD_IDS.exactInputSingle,
      METHOD_IDS.exactOutput,
      METHOD_IDS.exactOutputSingle,
      METHOD_IDS.multicall
    ])) {
      category = "swap";
    } else if (direction === "out" && startsWithAny(methodId, [METHOD_IDS.addLiquidity, METHOD_IDS.addLiquidityETH])) {
      category = "add_liquidity";
    } else if (direction === "out" && startsWithAny(methodId, [METHOD_IDS.removeLiquidity, METHOD_IDS.removeLiquidityETH])) {
      category = "remove_liquidity";
    } else if (direction === "out" && isHexZero(tx.input) && tx.valueWei !== "0") {
      category = "native_send";
    }
  }

  // If still unknown, optionally fetch logs to detect NFT/domain mint or swaps
  if (!category && opts?.fetchLogsIfNeeded !== false) {
    const logs = await explorerTxLogs(tx.hash);
    logsChecked = true;

    // Detect NFT/domain mint to subject
    const mints = await detectMintsFromLogs(subject, logs as TxLog[]);
    if (mints.length > 0 && direction === "out") {
      const anyDomain = mints.some(m => m.isDomain);
      category = anyDomain ? "domain_mint" : "nft_mint";
      nftMints = mints;
    }

    // Detect dApp swaps by Swap event from AMM pools
    if (!category) {
      const hasSwapTopic = (logs as TxLog[]).some(l =>
        l.topics?.[0]?.toLowerCase() === "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822"
      );
      if (hasSwapTopic && direction === "out") category = "swap";
    }

    // Detect approvals (backup)
    if (!category) {
      const maybeApprove = (logs as TxLog[]).some(l => l.topics?.[0]?.toLowerCase() === "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925");
      if (maybeApprove && direction === "out") category = "approve";
    }
  }

  if (!category) category = "other";

  const enriched: TxEnriched = {
    ...tx,
    direction,
    category,
    amountNative: weiToEther(tx.valueWei),
    logsChecked,
    nftMints
  };
  return enriched;
}

export function buildCategoryCountsOut(txs: TxEnriched[]) {
  const counts: Record<string, number> = {};
  for (const t of txs) {
    if (t.direction !== "out") continue;
    counts[t.category] = (counts[t.category] || 0) + 1;
  }
  return counts;
}