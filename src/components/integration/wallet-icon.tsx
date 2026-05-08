import type { SelectableWallet } from './wallets';
import MetamaskIcon from '../../assets/custom/metamask.svg?react';
import PhantomWalletIcon from '../../assets/custom/phantom.svg?react';
import styles from './wallet-icon.module.css';

type WalletIconProps = {
    wallet: SelectableWallet;
    className?: string;
};

function joinClasses(...parts: Array<string | undefined>): string | undefined {
    const s = parts.filter(Boolean).join(' ');
    return s || undefined;
}

/** Shared wallet mark for select row, connecting bulb, etc. */
export function WalletIcon({ wallet, className }: WalletIconProps) {
    const merged = joinClasses(className, wallet === 'phantom' ? styles.phantomEyes : undefined);

    switch (wallet) {
        case 'metamask':
            return <MetamaskIcon className={merged} aria-hidden />;
        case 'phantom':
            return <PhantomWalletIcon className={merged} aria-hidden />;
        case 'coinbase':
            return <img src="/wallets/coinbase.png" className={merged} alt="" aria-hidden />;
        case 'rainbow':
            return <img src="/wallets/rainbow.png" className={merged} alt="" aria-hidden />;
        default: {
            const exhaustive: never = wallet;
            return exhaustive;
        }
    }
}
