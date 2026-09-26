import os
import sys
import json
import asyncio
import httpx
import re
from pathlib import Path
from eth_account import Account
import solcx
from dotenv import load_dotenv
from eth_abi import encode as abi_encode

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"
FRONTEND_ENV_PATH = ROOT_DIR / "frontend" / ".env"

load_dotenv(dotenv_path=ENV_PATH)


SOLC_VERSION = "0.8.24"
try:
    solcx.set_solc_version(SOLC_VERSION)
except solcx.exceptions.SolcNotInstalled:
    print(f"Installing solc version {SOLC_VERSION}...")
    solcx.install_solc(SOLC_VERSION)
    solcx.set_solc_version(SOLC_VERSION)


def update_env_variable(file_path: Path, key: str, value: str):
    """Safely updates or appends a key-value pair in a .env file."""
    if not file_path.exists():
        file_path.write_text(f"{key}={value}\n", encoding="utf-8")
        return

    content = file_path.read_text(encoding="utf-8")
    pattern = rf"^{key}=.*$"
    if re.search(pattern, content, flags=re.MULTILINE):
        new_content = re.sub(pattern, f"{key}={value}", content, flags=re.MULTILINE)
    else:
        new_content = content.rstrip() + f"\n{key}={value}\n"
    file_path.write_text(new_content, encoding="utf-8")


async def deploy():
    rpc_url = os.getenv("WEB3_RPC_URL", "https://sepolia.base.org")
    priv_key = os.getenv("OPERATOR_PRIVATE_KEY")
    
    if not priv_key or not priv_key.strip():
        print("\n==================================================================")
        print("❌ ERROR: OPERATOR_PRIVATE_KEY is missing in your .env file!")
        print("==================================================================")
        print("To deploy the ThirdEyeGuardian smart contract:")
        print("1. Open the `.env` file in the project root.")
        print("2. Add your wallet's private key:")
        print("   OPERATOR_PRIVATE_KEY=0xYourPrivateKeyHere")
        print("3. Ensure this wallet has testnet ETH on Base Sepolia.")
        print("   Get free Base Sepolia ETH from faucets:")
        print("   👉 https://www.alchemy.com/faucets/base-sepolia")
        print("   👉 https://faucets.chain.link/base-sepolia")
        print("   👉 https://faucet.quicknode.com/base/sepolia")
        print("4. Re-run: python backend/deploy_contract.py\n")
        return
        
    priv_key = priv_key.strip()
    if not priv_key.startswith("0x"):
        priv_key = "0x" + priv_key

    try:
        account = Account.from_key(priv_key)
    except Exception as e:
        print(f"\n❌ Error parsing OPERATOR_PRIVATE_KEY: {e}")
        return

    print(f"\n🚀 Starting Deployment to Base Sepolia ({rpc_url})")
    print(f"Deployer address: {account.address}")
    
    # 1. Compile the contract
    print("\n📦 Compiling ThirdEyeGuardian.sol...")
    contract_path = ROOT_DIR / "contracts" / "ThirdEyeGuardian.sol"
    node_modules = ROOT_DIR / "contracts" / "node_modules"
    
    import_remappings = [
        f"@openzeppelin/={node_modules.resolve()}/@openzeppelin/"
    ]
    
    try:
        compiled = solcx.compile_files(
            [contract_path],
            output_values=["abi", "bin"],
            solc_version=SOLC_VERSION,
            import_remappings=import_remappings
        )
    except Exception as e:
        print(f"❌ Solidity compilation failed: {e}")
        return
    
    contract_key = next((k for k in compiled.keys() if "ThirdEyeGuardian" in k and "ThirdEyeGuardian.sol" in k), None)
    if not contract_key:
        print("Available keys:", list(compiled.keys()))
        raise Exception("Could not find ThirdEyeGuardian in compiled output.")
        
    contract_interface = compiled[contract_key]
    bytecode = contract_interface["bin"]
    abi = contract_interface["abi"]
    
    # Save artifacts for frontend/backend usage
    contracts_artifacts_dir = ROOT_DIR / "contracts" / "artifacts"
    contracts_artifacts_dir.mkdir(parents=True, exist_ok=True)
    (contracts_artifacts_dir / "ThirdEyeGuardian.json").write_text(
        json.dumps({"abi": abi, "bytecode": bytecode}, indent=2), encoding="utf-8"
    )
    print("✅ Contract compiled successfully!")
    
    # 2. Build constructor deployment transaction
    constructor_args = abi_encode(["address"], [account.address])
    deployment_data = "0x" + bytecode + constructor_args.hex()
    
    async with httpx.AsyncClient(timeout=60) as client:
        async def rpc(method, params):
            r = await client.post(rpc_url, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
            res = r.json()
            if "error" in res:
                print(f"RPC Error [{method}]: {res['error']}")
                raise Exception(res['error'])
            return res["result"]

        # Check balance
        balance_hex = await rpc("eth_getBalance", [account.address, "latest"])
        balance_wei = int(balance_hex, 16)
        balance_eth = balance_wei / 1e18
        print(f"💰 Account balance: {balance_eth:.6f} ETH")

        if balance_wei == 0:
            print("\n❌ Error: Deployer account has 0 ETH on Base Sepolia.")
            print("Please fund your wallet with Base Sepolia testnet ETH from:")
            print("  👉 https://www.alchemy.com/faucets/base-sepolia")
            print("  👉 https://faucets.chain.link/base-sepolia\n")
            return

        # Get nonce, gas price, chain ID
        nonce = int(await rpc("eth_getTransactionCount", [account.address, "latest"]), 16)
        gas_price = int(await rpc("eth_gasPrice", []), 16)
        chain_id = int(await rpc("eth_chainId", []), 16)
        
        # Add a 20% gas price buffer for fast confirmation
        effective_gas_price = int(gas_price * 1.2)

        tx = {
            "nonce": nonce,
            "gasPrice": effective_gas_price,
            "gas": 3500000, # Deployment gas limit
            "value": 0,
            "data": deployment_data,
            "chainId": chain_id
        }
        
        # 3. Sign and Send
        print("\n✍️  Signing transaction...")
        signed = account.sign_transaction(tx)
        raw_tx_bytes = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction", None)
        raw_tx_hex = raw_tx_bytes.hex() if isinstance(raw_tx_bytes, bytes) else str(raw_tx_bytes)
        if not raw_tx_hex.startswith("0x"):
            raw_tx_hex = "0x" + raw_tx_hex
            
        print("📡 Broadcasting deployment transaction to Base Sepolia...")
        tx_hash = await rpc("eth_sendRawTransaction", [raw_tx_hex])
        print(f"🔗 Transaction Hash: {tx_hash}")
        print(f"🔍 Explorer: https://sepolia.basescan.org/tx/{tx_hash}")
        
        # 4. Wait for receipt
        print("\n⏳ Waiting for transaction confirmation on Base Sepolia...")
        for _ in range(45):
            await asyncio.sleep(2)
            res_receipt = await client.post(rpc_url, json={"jsonrpc": "2.0", "id": 1, "method": "eth_getTransactionReceipt", "params": [tx_hash]})
            receipt_json = res_receipt.json()
            receipt = receipt_json.get("result")
            if receipt:
                if receipt.get("status") == "0x1":
                    contract_address = receipt["contractAddress"]
                    print(f"\n🎉 ✅ ThirdEyeGuardian successfully deployed to: {contract_address}")
                    print(f"🔍 Contract on Basescan: https://sepolia.basescan.org/address/{contract_address}")
                    
                    # Update .env and frontend/.env
                    update_env_variable(ENV_PATH, "GUARDIAN_CONTRACT_ADDRESS", contract_address)
                    update_env_variable(ENV_PATH, "VITE_GUARDIAN_CONTRACT_ADDRESS", contract_address)
                    update_env_variable(FRONTEND_ENV_PATH, "VITE_GUARDIAN_CONTRACT_ADDRESS", contract_address)
                    
                    print("✅ Updated root `.env` and `frontend/.env` with new contract address.")
                    return contract_address
                else:
                    print(f"❌ Transaction failed/reverted. Receipt: {receipt}")
                    return None
        
        print("⚠️ Timeout waiting for transaction confirmation. Please check Basescan with your tx hash.")
        return None

if __name__ == "__main__":
    asyncio.run(deploy())

