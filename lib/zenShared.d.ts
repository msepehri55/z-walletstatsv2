declare module "@/lib/zenShared" {
  export function buildActivityFast(params: { address: string; start: number; end: number }): Promise<any[]>;
  export function buildStatsFromActivity(activity: any[]): {
    stakeActions: number;
    nativeSends: number;
    nftMints: number;
    domainMints: number;
    gmCount: number;
    ccCount: number;
    swapCount: number;
    addLiquidityCount: number;
    removeLiquidityCount: number;
    approveCount: number;
    totalExternalOut: number;
  };
}