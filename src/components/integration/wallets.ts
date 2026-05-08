/** Wallets that can be chosen for the main connect flow (excludes "Other wallets"). */
export type SelectableWallet = 'coinbase' | 'metamask' | 'phantom' | 'rainbow';

export const WALLET_LABELS: Record<SelectableWallet, string> = {
    coinbase: 'Coinbase',
    metamask: 'MetaMask',
    phantom: 'Phantom',
    rainbow: 'Rainbow',
};

export function getWalletLabel(wallet: SelectableWallet): string {
    return WALLET_LABELS[wallet];
}
