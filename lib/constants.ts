export const CHAIN = {
  symbol: process.env.CHAIN_SYMBOL || "ZTC",
  name: process.env.CHAIN_NAME || "Zenchian Testnet"
};

export const ENDPOINTS = {
  explorerBase: process.env.EXPLORER_BASE || "https://zentrace.io",
  explorerCompatApi: (process.env.EXPLORER_BASE || "https://zentrace.io") + "/api",
  explorerRestV2: (process.env.EXPLORER_BASE || "https://zentrace.io") + "/api/v2",
  explorerEthRpc: (process.env.EXPLORER_BASE || "https://zentrace.io") + "/api/eth-rpc",
  rpc: process.env.RPC_URL || "https://zenchain-testnet.api.onfinality.io/public"
};

// Contracts
export const STAKING_CONTRACT = "0x0000000000000000000000000000000000000800".toLowerCase();

export const GM_CONTRACTS = [
  "0xf617d89a811a39f06f5271f89db346a0ae297f71",
  "0x1290b4f2a419a316467b580a088453a233e9adcc",
  "0x72bf210e0a01838367ef47f5b6087d22d53c93d6",
  "0x59c27c39a126a9b5ecaddd460c230c857e1deb35"
].map(a => a.toLowerCase());

export const CCO_DEPLOY_FACTORY = "0x2f96d7dd813b8e17071188791b78ea3fab5c109c".toLowerCase();

// Time presets (ms)
export const PRESETS = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000
};

// Method IDs
export const METHOD_IDS = {
  approve: "0x095ea7b3",
  // Uniswap V2
  swapExactTokensForTokens: "0x38ed1739",
  swapExactETHForTokens: "0x7ff36ab5",
  swapExactTokensForETH: "0x18cbafe5",
  addLiquidity: "0xe8e33700",
  addLiquidityETH: "0xf305d719",
  removeLiquidity: "0xbaa2abde",
  removeLiquidityETH: "0x02751cec",
  // Uniswap V3 / common routers
  exactInputSingle: "0x414bf389",
  exactInput: "0xb858183f",
  exactOutputSingle: "0x5023b4df",
  exactOutput: "0x09b81346",
  multicall: "0x5ae401dc"
};

// Event topics
export const TOPICS = {
  ERC20_Transfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  ERC721_Transfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", // same as ERC20
  ERC1155_TransferSingle: "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62",
  ERC1155_TransferBatch: "0x4a39dc06d4c0dbc64b70b3b8baf0b14b7f5e6e3bcc6fdddaf0a2fdd1d9f5dff4",
  UniswapV2_Swap: "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822",
  UniswapV2_Mint: "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9",
  UniswapV2_Burn: "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822" // swap topic reused by some forks; we'll rely on method IDs primarily
};

export const CATEGORY_ORDER = [
  "stake",
  "native_send",
  "nft_mint",
  "domain_mint",
  "cc_deploy",
  "cco_deploy",
  "gm",
  "swap",
  "add_liquidity",
  "remove_liquidity",
  "approve",
  "fail",
  "other"
] as const;

export type Category = typeof CATEGORY_ORDER[number];