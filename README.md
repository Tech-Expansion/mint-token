# mint-token — TEX Team

Mint Cardano native tokens/NFTs from a modern Next.js app. Built by the TEX team using MeshJS.

This app provides:
- Wallet connect (via Mesh React components)
- Network auto-detection (Mainnet/Preprod)
- One-click token/NFT mint with progress messages
- Robust error handling (timeouts, user-cancel signing, submission errors)

## Tech Stack
- Next.js 15 + React 18 + TypeScript
- Mesh SDK (`@meshsdk/core`, `@meshsdk/react`)
- Tailwind CSS

## Quick Start

1) Install dependencies

```bash
npm install
```

2) Run the app (development)

```bash
npm run dev
```

The app will be available at http://localhost:3000.

## Configuration

The app uses Blockfrost to build and submit transactions via Mesh's `BlockfrostProvider`.

Environment variables (recommended):

Create a `.env.local` file in the project root and add your keys:

```env
# Cardano network API keys
NEXT_PUBLIC_BLOCKFROST_API_KEY_MAINNET=your_mainnet_key
NEXT_PUBLIC_BLOCKFROST_API_KEY_PREPROD=your_preprod_key
```

Then update `src/pages/index.tsx` to read from `process.env.NEXT_PUBLIC_*` instead of hard-coded keys, for example:

```ts
const apiKey = network === 'mainnet'
	? process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY_MAINNET!
	: process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY_PREPROD!;
```

## Usage

1. Open the app and connect your Cardano wallet (e.g., Nami, Eternl).
2. Confirm the detected network (Mainnet or Preprod).
3. Fill in mint parameters:
	 - Quantity (for fungible token amount or "1" for single NFT)
	 - Token/NFT name
	 - Image IPFS URL
	 - Media type and description
4. Click "Mint NFT" to start.
5. Sign the transaction in your wallet and wait for submission.

## Features and Behavior

- Network auto-detection with timeout
- Parallel loading of wallet data (addresses, UTXOs, change address)
- Clear progress messages for each step
- Timeouts for wallet ops and full transaction
- Signing cancellation gracefully handled: the app stops and shows a friendly message

## Troubleshooting

- Wallet not detected or fails to connect
	- Ensure your Cardano wallet extension is installed and enabled for the site

- Network mismatch
	- Switch your wallet to the same network shown by the app (Mainnet or Preprod)

- "No UTXOs found"
	- Ensure you have sufficient ADA in the connected wallet to cover minting and fees

- User declined sign tx
	- If you cancel the signing prompt, the app aborts the mint and shows a clear message. Click Mint again when ready.

- TypeScript errors like "Cannot find module '@meshsdk/react'"
	- Ensure `npm install` completed successfully. Restart the TS server in your editor if needed.

## Build & Deploy

Build a production bundle:

```bash
npm run build
```

Start production server:

```bash
npm run start
```

## Security Notes

- Never commit real API keys to the repo. Use environment variables.
- Review transactions carefully before signing in your wallet.

## Credits

Built by the TEX team with ❤️ using MeshJS.
