import styles from '../integration.module.css';
import { useIntegrationContext } from '../integration-context';
import Header from './header';
import ArrowRightIcon from '../../../assets/custom/arrow-right.svg?react'
import selectViewStyles from './select-view.module.css'
import AcmeLogo from '../../../assets/custom/acme.svg?react';

import MetamaskIcon from '../../../assets/custom/metamask.svg?react';
import PhantomWalletIcon from '../../../assets/custom/phantom.svg?react';
import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';


type Wallet = "coinbase" | "metamask" | "phantom" | "rainbow" | "other"


const LEFT_BULB_GLOW_PEAK = -1;
const BULB_GLOW_SIGMA = 1;
const BULB_GLOW_TWO_SIGMA_SQ = 2 * BULB_GLOW_SIGMA * BULB_GLOW_SIGMA;
const BULB_GLOW_BASELINE = 0.3;
const SWEEP_OVERSHOOT = 3;

function clamp01(value: number) {
    return Math.min(Math.max(value, 0), 1);
}

export default function SelectView() {
    const { setView } = useIntegrationContext();
    const headPosition = -SWEEP_OVERSHOOT;

    const leftBulbGlow = Math.exp(-Math.pow(headPosition - LEFT_BULB_GLOW_PEAK, 2) / BULB_GLOW_TWO_SIGMA_SQ);
    const leftBulbOpacity = BULB_GLOW_BASELINE + leftBulbGlow * (1 - BULB_GLOW_BASELINE);

    return (
        <>
            <Header onBack={() => setView('default')} onClose={() => setView('default')} />
            <div className={styles.top}>

                <div className={styles.bulbs} data-phase='idle' data-connecting="idle">

                    <div className={styles.bulbsRow}>
                        <div className={styles.bulb} bulb-type="purple" style={{ '--bulb-glow-opacity': leftBulbOpacity } as CSSProperties} >
                            <AcmeLogo className={styles.bulbIcon} />
                        </div>
                    </div>

                </div>

                <div className={styles.titles}>
                    <span className={styles.title}>Choose your wallet</span>
                    <p className={styles.subtitle}>Select your network and your wallet below</p>
                </div>
            </div>

            <div className={selectViewStyles.options}>
                <WalletOptionButton id="coinbase" label="Coinbase Wallet" />
                <WalletOptionButton id="metamask" label="MetaMask" />
                <WalletOptionButton id="phantom" label="Phantom" />
                <WalletOptionButton id="rainbow" label="Rainbow Wallet" />
                <WalletOptionButton id="other" label="Other Wallets" />
            </div>

            {/* <div className={styles.bottom}>
                <button type="button" className={styles.viewActionButton} onClick={() => setView('connecting')}>
                    Go to connecting
                </button>
                <button type="button" className={styles.viewSecondaryButton} onClick={() => setView('wallet-connect')}>
                    Open wallet-connect
                </button>
            </div> */}

            <p className={styles.disclaimer}>
                By connecting your wallet you agree to the Terms of Service and Privacy Policy
            </p>
        </>
    );
}

function WalletOptionButton({ id, label }: { id: Wallet, label: string }) {
    const [pressed, setPressed] = useState(false);
    const [intensity, setIntensity] = useState(0.5);
    const pressStartRef = useRef<number | null>(null);

    const iconStyle = {
        '--option-arrow-stretch': (1.16 + intensity * 0.15).toFixed(3),
        '--option-arrow-head-shift': `${(2.0 + intensity * 1.8).toFixed(2)}px`,
        '--option-arrow-release-ms': `${Math.round(340 + intensity * 220)}ms`,
        '--option-arrow-overshoot': (1.4 + intensity * 1).toFixed(3),
    } as CSSProperties;

    const handlePointerDown = () => {
        pressStartRef.current = performance.now();
        setPressed(true);
    };

    const handlePointerEnd = (event?: ReactPointerEvent<HTMLButtonElement>) => {
        const startedAt = pressStartRef.current ?? performance.now();
        const elapsed = performance.now() - startedAt;
        const speedBias = Math.max(Math.min((140 - elapsed) / 220, 1), -1);
        const pressure = event?.pressure ?? 0;
        const pressureBoost = pressure > 0 ? clamp01((pressure - 0.5) / 0.5) : 0;
        const combinedIntensity = clamp01(0.5 + speedBias * 0.35 + pressureBoost * 0.15);
        setIntensity(combinedIntensity);
        setPressed(false);
        pressStartRef.current = null;
    };

    return (
        <button
            type="button"
            className={`${selectViewStyles.optionButton} ${pressed ? selectViewStyles.optionButtonPressed : ''}`}
            style={iconStyle}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onPointerLeave={() => setPressed(false)}
        // onClick={() => setView('connecting')}
        >
            <div className={selectViewStyles.optionButtonLeft}>
                {getIconForWallet(id)}
                <span className={selectViewStyles.optionButtonLeftText}>{label}</span>
            </div>

            <ArrowRightIcon className={selectViewStyles.optionButtonIcon} />
        </button>
    );
}


function getIconForWallet(id: Wallet) {
    const iconClass = selectViewStyles.optionButtonWalletIcon;
    switch (id) {
        case 'metamask':
            return <MetamaskIcon className={iconClass} aria-hidden />;
        case 'phantom':
            return <PhantomWalletIcon className={`${iconClass} ${selectViewStyles.optionButtonPhantomIcon}`} aria-hidden />;
        case 'coinbase':
            return <img src="/wallets/coinbase.png" className={iconClass} alt="" aria-hidden />;
        case 'rainbow':
            return <img src="/wallets/rainbow.png" className={iconClass} alt="" aria-hidden />;
        case 'other':
            return <OtherWalletsIconCluster />;
        default: {
            const exhaustive: never = id;
            return exhaustive;
        }
    }
}

/** Triple-stack: imToken, Reach, WalletConnect — same shape as default-view Connect Wallet icons. */
function OtherWalletsIconCluster() {
    return (
        <div className={selectViewStyles.optionOtherWalletIcons} aria-hidden>
            <div className={selectViewStyles.optionOtherWalletIcon} style={{ '--delay': '0ms' } as CSSProperties}>
                <img src="/wallets/imtoken.png" className={selectViewStyles.optionOtherWalletIconImg} alt="" aria-hidden />
            </div>
            <div className={selectViewStyles.optionOtherWalletIcon} style={{ '--delay': '40ms' } as CSSProperties}>
                <img src="/wallets/reach.png" className={selectViewStyles.optionOtherWalletIconImg} alt="" aria-hidden />
            </div>
            <div className={selectViewStyles.optionOtherWalletIcon} style={{ '--delay': '60ms' } as CSSProperties}>
                <img src="/wallets/wallet-connect.png" className={selectViewStyles.optionOtherWalletIconImg} alt="" aria-hidden />
            </div>
        </div>
    );
}