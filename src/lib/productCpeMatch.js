// Auto-matches incoming threats/CVEs to the Product portfolio using
// CPE vendor+product, keywords, affiliated software, vendor name, and
// product name — replacing the manual "Matches on CPE/Keywords?" spreadsheet column.

function tokenizeList(str) {
  if (!str) return [];
  return str
    .split(/[,;|\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Matches a single threat to portfolio products.
 * Returns an array of { product, matchReasons, matchType, isEnrolled }.
 */
export function matchThreatToProducts(threat, products = []) {
  if (!products.length) return [];

  const threatText = (
    `${threat.affected_products || ""} ${threat.title || ""} ${threat.description || ""}`
  ).toLowerCase();
  const threatProducts = tokenizeList(threat.affected_products);
  const matches = [];

  for (const product of products) {
    if (product.status === "Retired") continue;
    const reasons = [];

    // 1. CPE vendor + product match
    const cpeVendor = (product.cpe_vendor || "").toLowerCase();
    const cpeProduct = (product.cpe_product || "").toLowerCase();
    if (cpeVendor && cpeProduct && threatText.includes(cpeVendor) && threatText.includes(cpeProduct)) {
      reasons.push({ type: "CPE", detail: `${cpeVendor}:${cpeProduct}` });
    }

    // 2. Product name match (exact or substring on affected_products)
    const productName = (product.name || "").toLowerCase();
    if (productName && threatProducts.some((tp) => tp.includes(productName) || productName.includes(tp))) {
      reasons.push({ type: "Name", detail: product.name });
    }

    // 3. Vendor name match
    const vendor = (product.vendor || "").toLowerCase();
    if (vendor && vendor.length > 2 && threatText.includes(vendor)) {
      reasons.push({ type: "Vendor", detail: product.vendor });
    }

    // 4. Keyword matches
    const keywords = tokenizeList(product.keywords);
    for (const kw of keywords) {
      if (kw.length > 2 && threatText.includes(kw)) {
        reasons.push({ type: "Keyword", detail: kw });
      }
    }

    // 5. Affiliated software matches
    const affiliated = tokenizeList(product.affiliated_software);
    for (const aff of affiliated) {
      if (aff.length > 2 && threatText.includes(aff)) {
        reasons.push({ type: "Affiliated", detail: aff });
      }
    }

    if (reasons.length > 0) {
      matches.push({
        product,
        matchReasons: reasons,
        matchType: reasons[0].type,
        isEnrolled: product.sbom_enrolled || false,
      });
    }
  }

  return matches;
}

/**
 * Batch-matches an array of threats to products.
 * Returns a Map of threat.id -> matches array.
 */
export function batchMatchThreats(threats = [], products = []) {
  const map = {};
  threats.forEach((t) => {
    map[t.id] = matchThreatToProducts(t, products);
  });
  return map;
}