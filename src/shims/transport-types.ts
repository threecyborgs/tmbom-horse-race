/**
 * Shim for @tmbom/transport/types — the types needed by game clients.
 * These mirror the interfaces from the TMBOM platform transport package.
 */

export type JsonObject = Record<string, unknown>;

export interface IPlayerChannel {
  on(handler: (msg: JsonObject) => void): () => void;
  send(msg: JsonObject): void;
}
