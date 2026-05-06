import { invoke } from "@tauri-apps/api/core";

export type GenericAsyncSubmitReq = {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  taskIdPointer: string;
};

export type GenericAsyncSubmitResp = {
  taskId: string;
  raw: unknown;
};

export type GenericAsyncPollReq = {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  statusPointer: string;
  doneValue?: string;
  resultUrlPointer?: string;
  errorPointer?: string;
};

export type GenericAsyncPollResp = {
  status: string;
  done: boolean;
  resultUrl?: string | null;
  error?: string | null;
  raw: unknown;
};

export async function genericAsyncApiSubmit(req: GenericAsyncSubmitReq): Promise<GenericAsyncSubmitResp> {
  return invoke<GenericAsyncSubmitResp>("generic_async_api_submit", { req });
}

export async function genericAsyncApiPoll(req: GenericAsyncPollReq): Promise<GenericAsyncPollResp> {
  return invoke<GenericAsyncPollResp>("generic_async_api_poll", { req });
}
