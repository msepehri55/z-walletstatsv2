import { ENDPOINTS } from "./constants";

type Json = Record<string, any>;

let id = 1;

export async function ethRpc(method: string, params: any[] = []): Promise<any> {
  const body = JSON.stringify({
    id: id++,
    jsonrpc: "2.0",
    method,
    params
  });
  const res = await fetch(ENDPOINTS.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store"
  });
  const json = (await res.json()) as Json;
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result;
}