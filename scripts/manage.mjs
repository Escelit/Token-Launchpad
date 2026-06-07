#!/usr/bin/env node
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const WASM = join(__dirname, "..", "contracts", "token_launchpad", "target", "wasm32-unknown-unknown", "release", "token_launchpad.wasm");
const NETWORK = process.env.STELLAR_NETWORK || "testnet";
const RPC_URL = process.env.RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";
const ID_PATH = join(__dirname, "..", ".contract-id");

function cmd(s: string) {
  console.log(`$ ${s}`);
  return execSync(s, { encoding: "utf-8", stdio: "pipe" }).trim();
}

function getContractId(): string {
  if (existsSync(ID_PATH)) return readFileSync(ID_PATH, "utf-8").trim();
  return "";
}

function saveContractId(id: string) {
  writeFileSync(ID_PATH, id);
  console.log(`Contract ID saved to ${ID_PATH}`);
}

function installWasmHash(): string {
  if (!existsSync(WASM)) {
    console.error("WASM not found. Run: cargo build --target wasm32-unknown-unknown --release");
    process.exit(1);
  }
  const hash = cmd(`stellar contract install \\
    --wasm ${WASM} \\
    --source ${process.env.SOURCE || "default"} \\
    --network ${NETWORK} \\
    --rpc-url ${RPC_URL} \\
    --network-passphrase "${NETWORK_PASSPHRASE}"`);
  console.log(`Wasm hash: ${hash}`);
  return hash;
}

function deployContract(wasmHash: string): string {
  const id = cmd(`stellar contract deploy \\
    --wasm-hash ${wasmHash} \\
    --source ${process.env.SOURCE || "default"} \\
    --network ${NETWORK} \\
    --rpc-url ${RPC_URL} \\
    --network-passphrase "${NETWORK_PASSPHRASE}"`);
  console.log(`Contract ID: ${id}`);
  return id;
}

function invoke(method: string, ...args: string[]) {
  const id = getContractId();
  if (!id) { console.error("No contract ID found. Deploy first."); process.exit(1); }
  const base = `stellar contract invoke \\
    --id ${id} \\
    --source ${process.env.SOURCE || "default"} \\
    --network ${NETWORK} \\
    --rpc-url ${RPC_URL} \\
    --network-passphrase "${NETWORK_PASSPHRASE}" \\
    -- ${method}`;
  const full = args.length ? base + " \\\n  " + args.join(" \\\n  ") : base;
  console.log(`$ stellar contract invoke ... -- ${method}`);
  return execSync(full.replace(/\n/g, " "), { encoding: "utf-8", stdio: "inherit" });
}

const [command, ...rest] = process.argv.slice(2);

switch (command) {
  case "deploy": {
    const hash = installWasmHash();
    const id = deployContract(hash);
    saveContractId(id);
    break;
  }
  case "install": {
    const hash = installWasmHash();
    console.log(hash);
    break;
  }
  case "initialize": {
    invoke("initialize",
      `--admin ${rest[0]}`,
      `--token ${rest[1]}`,
      `--deposit_token ${rest[2]}`,
      `--price ${rest[3]}`,
      `--cap ${rest[4]}`,
      `--soft_cap ${rest[5]}`,
      `--start ${rest[6]}`,
      `--end ${rest[7]}`,
      `--cliff ${rest[8] || "0"}`,
      `--vesting_duration ${rest[9] || "0"}`);
    break;
  }
  case "contribute": {
    invoke("contribute", `--caller ${rest[0]}`, `--amount ${rest[1]}`);
    break;
  }
  case "claim": {
    invoke("claim", `--caller ${rest[0]}`);
    break;
  }
  case "refund": {
    invoke("refund", `--caller ${rest[0]}`);
    break;
  }
  case "fund": {
    invoke("fund", `--admin ${rest[0]}`, `--amount ${rest[1]}`);
    break;
  }
  case "withdraw": {
    invoke("withdraw_deposits", `--admin ${rest[0]}`);
    break;
  }
  case "cancel": {
    invoke("cancel", `--admin ${rest[0]}`);
    break;
  }
  case "info": {
    invoke("get_launchpad_info");
    break;
  }
  case "contributor": {
    invoke("get_contributor_info", `--address ${rest[0]}`);
    break;
  }
  case "claimable": {
    invoke("get_claimable", `--address ${rest[0]}`);
    break;
  }
  case "id": {
    console.log(getContractId());
    break;
  }
  default:
    console.log(`
Usage: node scripts/manage.sh <command> [args...]

Commands:
  deploy                         Install WASM + deploy contract
  install                        Only install WASM (get hash)
  initialize <admin> <token> <deposit_token> <price> <cap> <soft_cap> <start> <end> [cliff=0] [vesting_duration=0]
  contribute <caller> <amount>
  claim <caller>
  refund <caller>
  fund <admin> <amount>
  withdraw <admin>
  cancel <admin>
  info                           Get launchpad info
  contributor <address>
  claimable <address>
  id                             Print saved contract ID

Environment variables:
  SOURCE      Stellar account secret key or name (default: "default")
  STELLAR_NETWORK  (default: "testnet")
  RPC_URL          (default: "https://soroban-testnet.stellar.org")
  NETWORK_PASSPHRASE  (default: "Test SDF Network ; September 2015")
`);
}
