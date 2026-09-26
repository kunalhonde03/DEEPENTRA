/**
 * nodeClassifier.test.ts — TypeScript Unit Test Suite for Node Classification System
 */

import {
  classifyNode,
  getColorByRiskScore,
  NODE_KEYWORD_CONFIG,
  type NodeClassification,
} from "./nodeClassifier";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

console.log("🧪 Running TypeScript Node Classifier Unit Tests...");

// 1. All 16 keywords
const keys = Object.keys(NODE_KEYWORD_CONFIG);
assert(keys.length === 16, `Expected 16 keywords, found ${keys.length}`);
console.log("✅ 16 Archetype definitions present in config");

// 2. Determinism
const addr = "0x805AFB03032A4282a964F9b62608d31260C8e1E0";
const r1 = classifyNode({ address: addr, riskScore: 15 });
const r2 = classifyNode({ address: addr, riskScore: 15 });
assert(r1.keyword === r2.keyword, "Keywords must match for same address");
assert(r1.plainEnglishMeaning === r2.plainEnglishMeaning, "Meaning must match");
console.log("✅ Deterministic classification verified");

// 3. Color Legend Mapping
assert(getColorByRiskScore(92).colorHex === "#EF4444", "Red for >85%");
assert(getColorByRiskScore(75).colorHex === "#F97316", "Orange for 65-85%");
assert(getColorByRiskScore(45).colorHex === "#F59E0B", "Amber for 25-65%");
assert(getColorByRiskScore(18).colorHex === "#38BDF8", "Blue for <25%");
assert(getColorByRiskScore(5).colorHex === "#10B981", "Green for <10%");
console.log("✅ Color legend thresholds verified");

// 4. Test all 16 keywords coverage
const testCases: Array<{ name: string; input: Parameters<typeof classifyNode>[0]; expectedId: string }> = [
  // 🔴 Threat
  { name: "RAPID_EXFILTRATOR", input: { address: "0x1", riskScore: 95, behavioralFlags: ["rapid_drain"] }, expectedId: "RAPID_EXFILTRATOR" },
  { name: "TORNADO_MIXER_RELAY", input: { address: "0x2", riskScore: 90, behavioralFlags: ["mixer"] }, expectedId: "TORNADO_MIXER_RELAY" },
  { name: "CIRCULAR_WASHTRADER", input: { address: "0x3", riskScore: 85, behavioralFlags: ["cycle"] }, expectedId: "CIRCULAR_WASHTRADER" },
  { name: "WHALE_DUMP_LIQUIDATOR", input: { address: "0x4", riskScore: 88, balanceEth: 500, behavioralFlags: ["whale_dump"] }, expectedId: "WHALE_DUMP_LIQUIDATOR" },
  { name: "MEV_SANDWICH_BOT", input: { address: "0x5", riskScore: 82, behavioralFlags: ["sandwich"] }, expectedId: "MEV_SANDWICH_BOT" },
  { name: "SYBIL_AIRDROP_OPERATOR", input: { address: "0x6", riskScore: 78, behavioralFlags: ["sybil"] }, expectedId: "SYBIL_AIRDROP_OPERATOR" },
  { name: "TAINTED_GRAPH_RELAY", input: { address: "0x7", riskScore: 72, behavioralFlags: ["tainted_exposure"] }, expectedId: "TAINTED_GRAPH_RELAY" },

  // 🟡 Medium
  { name: "FLASH_LOAN_OPERATOR", input: { address: "0x8", riskScore: 45, behavioralFlags: ["flash_loan"] }, expectedId: "FLASH_LOAN_OPERATOR" },
  { name: "INSTITUTIONAL_GATEWAY", input: { address: "0x9", riskScore: 35, label: "exchange" }, expectedId: "INSTITUTIONAL_GATEWAY" },
  { name: "NFT_HIGH_VELOCITY_TRADER", input: { address: "0xa", riskScore: 50, behavioralFlags: ["nft"] }, expectedId: "NFT_HIGH_VELOCITY_TRADER" },

  // 🔵 Safe
  { name: "GRADUATED_SENTINEL_USER", input: { address: "0xb", riskScore: 5, trustStatus: "TRUSTED", daysActive: 50 }, expectedId: "GRADUATED_SENTINEL_USER" },
  { name: "NEW_ON_RAMP_WALLET", input: { address: "0xc", riskScore: 15, trustStatus: "NEW", txCount: 2 }, expectedId: "NEW_ON_RAMP_WALLET" },
  { name: "BLUE_CHIP_YIELD_FARMER", input: { address: "0xd", riskScore: 12, behavioralFlags: ["yield"] }, expectedId: "BLUE_CHIP_YIELD_FARMER" },
  { name: "CROSS_CHAIN_BRIDGE_RELAY", input: { address: "0xe", riskScore: 14, behavioralFlags: ["bridge"] }, expectedId: "CROSS_CHAIN_BRIDGE_RELAY" },
  { name: "COLD_STORAGE_WHALE_VAULT", input: { address: "0xf", riskScore: 10, balanceEth: 50 }, expectedId: "COLD_STORAGE_WHALE_VAULT" },
  { name: "DEFI_AMM_ARBITRAGEUR", input: { address: "0x10", riskScore: 18, behavioralFlags: ["arb"] }, expectedId: "DEFI_AMM_ARBITRAGEUR" },
];

for (const tc of testCases) {
  const result: NodeClassification = classifyNode(tc.input);
  assert(result.id === tc.expectedId, `Expected ${tc.expectedId}, got ${result.id}`);
  assert(Boolean(result.plainEnglishMeaning), `Meaning must not be empty for ${tc.name}`);
  assert(Boolean(result.icon), `Icon must not be empty for ${tc.name}`);
  console.log(`  ✓ ${tc.expectedId.padEnd(25)} -> ${result.icon} ${result.keyword} (${result.colorTier})`);
}

console.log("🎉 All 16 TypeScript Node Classifier Unit Tests Passed Successfully!");
