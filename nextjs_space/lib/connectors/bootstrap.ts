import { CybellumSandboxConnector } from './cybellum/sandbox';
import {
  getAssetConnector,
  listAssetConnectors,
  registerAssetConnector,
} from './registry';

let bootstrapped = false;

export function bootstrapAssetConnectors(): void {
  if (bootstrapped) return;

  const existingIds = new Set(listAssetConnectors().map((connector) => connector.id));
  if (!existingIds.has('cybellum-sandbox')) {
    registerAssetConnector(new CybellumSandboxConnector());
  }

  bootstrapped = true;
}

export function resolveAssetConnector(id: string) {
  bootstrapAssetConnectors();
  return getAssetConnector(id);
}
