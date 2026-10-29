import type { Server } from "node:http";

export interface MockRequestRecord {
  path?: string;
  headers: { beta: string | null; credential: "present" | "absent" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

export function startMock(port?: number, onRequest?: (record: MockRequestRecord) => void): Server;
