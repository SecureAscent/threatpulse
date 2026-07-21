import type { AssetConnector } from "./types";

const assetConnectors = new Map<string, AssetConnector>();

export function registerAssetConnector(connector: AssetConnector): void {
  if (assetConnectors.has(connector.id)) {
    throw new Error(`Asset connector already registered: ${connector.id}`);
  }

  assetConnectors.set(connector.id, connector);
}

export function getAssetConnector(id: string): AssetConnector {
  const connector = assetConnectors.get(id);

  if (!connector) {
    throw new Error(`Unknown asset connector: ${id}`);
  }

  return connector;
}

export function listAssetConnectors(): AssetConnector[] {
  return Array.from(assetConnectors.values());
}

export function clearConnectorRegistryForTests(): void {
  assetConnectors.clear();
}
