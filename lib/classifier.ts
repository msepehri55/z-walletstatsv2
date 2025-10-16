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
  return s.includes("domain") || s.includes("name") || s.includes(".zen") || s.includes("zns") || s.includes("ens") || s.includes("dns");
}

async function detectMintsFromLogs(
  subject: string,
  logs: TxLog[],
  tokenInfoProvider?: (addr: string) => Promise<{ name?: string; symbol?: string; type?: string }>
) {
  const mints: { tokenAddress: string; tokenId?: string; standard: "ERC-721" | "ERC-1155" | "Unknown"; isDomain?: boolean }[] = [];
  for (const l of logs) {
    const addr = l.address?.toLowerCase();
    const topic0 = l.topics?.[0]?.toLowerCase();
    if (!addr || !topic0) continue;

    // ERC721 or ERC20 Transfer
    if (topic0 === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef") {
      const from = "0x" + (l.topics?.[1]?.slice(26) || "").toLowerCase();
      const to = "0x" + (l.topics?.[2]?.slice(26) || "").toLowerCase();
      if (from === ZERO && to === subject.toLowerCase()) {
        const info = tokenInfoProvider ? await tokenInfoProvider(addr) : await explorerTokenInfo(addr);
        const t = (info.type || "").toUpperCase();
        if (t.includes("721")) {
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

    if (topic0 === "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62") {
      const from = "0x" + (l.topics?.[2]?.slice(26) || "").toLowerCase();
      const to = "0x" + (l.topics?.[3]?.slice(26) || "").toLowerCase();
      if (from === ZERO && to === subject.toLowerCase()) {
        const info = tokenInfoProvider ? await tokenInfoProvider(addr) : await explorerTokenInfo(addr);
        mints.push({
          tokenAddress: addr,
          standard: "ERC-1155",
          isDomain: looksLikeDomainToken(info.name, info.symbol)
        });
      }
    }
  }
  return mints;
}

export async function classifyTransaction(
  tx: TxBasic,
  subject: string,
  opts?: { fetchLogsIfNeeded?: boolean; providedLogs?: TxLog[]; tokenInfoProvider?: (addr: string) => Promise<{ name?: string; symbol?: string; type?: string }> }
): Promise<TxEnriched> {
  const direction = dirOf(tx, subject) as "out" | "in" | "self";
  const methodId = (tx.methodId || (tx.input || "").slice(0, 10)).toLowerCase();
  const to = (tx.to || "").toLowerCase();

  let category: Category | null = null;
  let nftMints: any[] | undefined;
  let logsChecked = false;

  if (tx.status === 0) {
    category = "fail";
  }

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
      "0x18cbafe5","0x7ff36ab5","0x38ed1739","0xb858183f","0x414bf389","0x09b81346","0x5023b4df","0x5ae401dc"
    ])) {
      category = "swap";
    } else if (direction === "out" && startsWithAny(methodId, ["0xe8e33700","0xf305d719"])) {
      category = "add_liquidity";
    } else if (direction === "out" && startsWithAny(methodId, ["0xbaa2abde","0x02751cec"])) {
      category = "remove_liquidity";
    } else if (direction === "out" && isHexZero(tx.input) && tx.valueWei !== "0") {
      category = "native_send";
    }
  }

  // Logs path (explorer or provided by RPC receipt)
  if (!category) {
    let logs: TxLog[] | undefined = opts?.providedLogs;
    if (!logs && opts?.fetchLogsIfNeeded !== false) {
      const exLogs = await explorerTxLogs(tx.hash);
      logs = (exLogs as any[])?.map((l: any) => ({
        address: String(l.address || "").toLowerCase(),
        topics: (l.topics || []).map((t: string) => String(t).toLowerCase()),
        data: String(l.data || "0x")
      }));
    }
    if (logs && logs.length) {
      logsChecked = true;
      const mints = await detectMintsFromLogs(subject, logs, opts?.tokenInfoProvider);
      if (mints.length > 0 && direction === "out") {
        const anyDomain = mints.some(m => m.isDomain);
        category = anyDomain ? "domain_mint" : "nft_mint";
        nftMints = mints;
      }
      if (!category) {
        const hasSwapTopic = logs.some(l => l.topics?.[0] === "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822");
        if (hasSwapTopic && direction === "out") category = "swap";
      }
    }
  }

  if (!category) category = "other";

  return {
    ...tx,
    direction,
    category,
    amountNative: weiToEther(tx.valueWei),
    logsChecked,
    nftMints
  };
}

export function buildCategoryCountsOut(txs: TxEnriched[]) {
  const counts: Record<string, number> = {};
  for (const t of txs) {
    if (t.direction !== "out") continue;
    counts[t.category] = (counts[t.category] || 0) + 1;
  }
  return counts;
}