export type Address = `0x${string}`;

export type Direction = "out" | "in" | "self";

export interface TxBasic {
  hash: string;
  blockNumber: number;
  timeStamp: number; // ms
  from: string;
  to: string | null;
  valueWei: string; // decimal string
  input: string;
  status: 0 | 1;
  gasUsed?: string;
  gasPrice?: string;
  feeWei?: string;
  methodId?: string;
  contractAddress?: string | null; // for creations (rest v2)
}

export interface TxLog {
  address: string; // contract emitting
  topics: string[];
  data: string;
}

export interface TokenInfo {
  address: string;
  name?: string;
  symbol?: string;
  type?: "ERC-20" | "ERC-721" | "ERC-1155" | string;
}

export interface NftMintInfo {
  tokenAddress: string;
  tokenId?: string;
  tokenStandard: "ERC-721" | "ERC-1155" | "Unknown";
  isDomain?: boolean;
}

export interface TxEnriched extends TxBasic {
  direction: Direction;
  category: import("./constants").Category;
  amountNative: string; // formatted
  logsChecked: boolean;
  nftMints?: NftMintInfo[];
}

export interface AddressStats {
  address: string;
  from: number; // ms
  to: number; // ms
  totals: {
    txAll: number;
    txOut: number;
    txIn: number;
    txFailed: number;
  };
  countsByCategoryOut: Record<string, number>;
  transactions: TxEnriched[];
  source: "compat" | "restv2" | "mixed";
  debug?: {
    compatTried: boolean;
    restTried: boolean;
    pagesFetched?: number;
    warnings?: string[];
  };
}

export interface Thresholds {
  minTotalExternalOut?: number;
  minStake?: number;
  minNative?: number;
  minNftMint?: number;
  minDomainMint?: number;
  minGM?: number;
  minCC?: number; // cc_deploy + cco_deploy
  minSwap?: number;
  minAddLiq?: number;
  minRemoveLiq?: number;
}

export interface ParticipantInput {
  discord?: string;
  wallet: string;
}