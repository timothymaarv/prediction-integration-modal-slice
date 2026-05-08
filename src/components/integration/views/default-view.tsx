// EMAIL CARET COULD BE BRAND PRIMARY COLOR
// EMAIL TAKES US TO OTP VIEW NOT SELECT


import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import AcmeLogo from '../../../assets/custom/acme.svg?react';
import { useIntegrationContext } from '../integration-context';
import styles from '../integration.module.css';
import defaultViewStyles from './default-view.module.css'
import ArrowRightIcon from '../../../assets/custom/arrow-right.svg?react'
import PolymarketIcon from '../../../assets/custom/polymarket.svg?react'
import GoogleIcon from '../../../assets/custom/google.svg?react'
import XIcon from '../../../assets/custom/x.svg?react'


import PhantomWalletIcon from '../../../assets/custom/phantom.svg?react'
import MetamaskIcon from '../../../assets/custom/metamask.svg?react'
import WalletConnectIcon from '../../../assets/custom/wallet-connect.svg?react'



const GRID_COLS = 5;
const LEFT_BULB_GLOW_PEAK = -1;
const BULB_GLOW_SIGMA = 1;
const BULB_GLOW_TWO_SIGMA_SQ = 2 * BULB_GLOW_SIGMA * BULB_GLOW_SIGMA;
const BULB_GLOW_BASELINE = 0.3;
const SWEEP_DURATION_MS = 1700;
const SWEEP_OVERSHOOT = 3;

function clamp01(value: number) {
    return Math.min(Math.max(value, 0), 1);
}

export default function DefaultView() {
    const { setView } = useIntegrationContext();
    const [headPosition, setHeadPosition] = useState(-SWEEP_OVERSHOOT);
    const [emailArrowPressed, setEmailArrowPressed] = useState(false);
    const [emailArrowIntensity, setEmailArrowIntensity] = useState(0.5);
    const tunablesRef = useRef({ durationMs: SWEEP_DURATION_MS, overshoot: SWEEP_OVERSHOOT });
    const emailPressStartRef = useRef<number | null>(null);

    useEffect(() => {
        let frameId = 0;
        const startTime = performance.now();

        const tick = (now: number) => {
            const { durationMs, overshoot } = tunablesRef.current;
            const cycle = Math.max(durationMs, 1);
            const t = ((now - startTime) % cycle) / cycle;
            const eased = (1 - Math.cos(t * Math.PI)) / 2;
            const span = GRID_COLS - 1 + overshoot * 2;
            const start = -overshoot;
            setHeadPosition(start + eased * span);
            frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, []);

    const leftBulbGlow = Math.exp(-Math.pow(headPosition - LEFT_BULB_GLOW_PEAK, 2) / BULB_GLOW_TWO_SIGMA_SQ);
    const leftBulbOpacity = BULB_GLOW_BASELINE + leftBulbGlow * (1 - BULB_GLOW_BASELINE);
    const emailArrowStyle = {
        '--email-arrow-stretch': (1.16 + emailArrowIntensity * 0.15).toFixed(3),
        '--email-arrow-head-shift': `${(2.0 + emailArrowIntensity * 1.8).toFixed(2)}px`,
        '--email-arrow-release-ms': `${Math.round(340 + emailArrowIntensity * 220)}ms`,
        '--email-arrow-overshoot': (1.4 + emailArrowIntensity * 1).toFixed(3),
    } as CSSProperties;

    const handleEmailPointerDown = () => {
        emailPressStartRef.current = performance.now();
        setEmailArrowPressed(true);
    };

    const handleEmailPointerEnd = (event?: ReactPointerEvent<HTMLButtonElement>) => {
        const startedAt = emailPressStartRef.current ?? performance.now();
        const elapsed = performance.now() - startedAt;
        // Calibrate so a regular click sits around half extension.
        const speedBias = Math.max(Math.min((140 - elapsed) / 220, 1), -1);
        const pressure = event?.pressure ?? 0;
        const pressureBoost = pressure > 0 ? clamp01((pressure - 0.5) / 0.5) : 0;
        const combinedIntensity = clamp01(0.5 + speedBias * 0.35 + pressureBoost * 0.15);
        setEmailArrowIntensity(combinedIntensity);
        setEmailArrowPressed(false);
        emailPressStartRef.current = null;
    };

    return (
        <>
            <div className={styles.top}>

                <div className={styles.bulbs} data-phase='idle' data-connecting="idle">

                    <div className={styles.bulbsRow}>
                        <div className={styles.bulb} bulb-type="purple" style={{ '--bulb-glow-opacity': leftBulbOpacity } as CSSProperties} >
                            <AcmeLogo className={styles.bulbIcon} />
                        </div>
                    </div>

                </div>

                <div className={styles.titles}>
                    <span className={styles.title}>Sign in to Acme</span>
                    <p className={styles.subtitle}>Choose how you’d like to continue.</p>
                </div>
            </div>


            <div className={defaultViewStyles.options}>

                {/* email layer */}
                <div className={defaultViewStyles.emailLayer}>
                    <div className={defaultViewStyles.emailInput}>
                        <input
                            className={defaultViewStyles.emailInputText}
                            type="email"
                            defaultValue="email@email.com"
                            aria-label="Email address"
                        />

                        <button
                            type="button"
                            className={`${defaultViewStyles.emailInputButton} ${defaultViewStyles.pressableButton} ${emailArrowPressed ? defaultViewStyles.emailInputButtonPressed : ''}`}
                            style={emailArrowStyle}
                            onPointerDown={handleEmailPointerDown}
                            onPointerUp={handleEmailPointerEnd}
                            onPointerCancel={handleEmailPointerEnd}
                            onPointerLeave={() => setEmailArrowPressed(false)}
                            onClick={() => setView("select")}
                        >
                            <ArrowRightIcon className={defaultViewStyles.emailInputButtonIcon} />
                        </button>
                    </div>
                </div>

                {/* or */}
                <div className={defaultViewStyles.or}>
                    <hr />
                    <p>or</p>
                    <hr />
                </div>

                {/* socials & wallet layer */}

                <div className={defaultViewStyles.socialsAndWalletLayer}>

                    <div className={defaultViewStyles.socialsLayer}>
                        <button type="button" className={`${defaultViewStyles.socialsButton} ${defaultViewStyles.pressableButton}`}>
                            <PolymarketIcon className={defaultViewStyles.socialsButtonIcon} />
                        </button>
                        <button type="button" className={`${defaultViewStyles.socialsButton} ${defaultViewStyles.pressableButton}`}>
                            <GoogleIcon className={defaultViewStyles.socialsButtonIcon} />
                        </button>
                        <button type="button" className={`${defaultViewStyles.socialsButton} ${defaultViewStyles.pressableButton}`}>
                            <XIcon className={defaultViewStyles.socialsButtonIcon} />
                        </button>
                    </div>


                    <button type="button" className={`${defaultViewStyles.walletButton} ${defaultViewStyles.pressableButton}`} onClick={() => setView("select")}>
                        <div className={defaultViewStyles.walletButtonIcons}>
                            <div className={defaultViewStyles.walletButtonIcon} style={{ '--delay': '0ms' } as CSSProperties}>
                                <WalletConnectIcon className={defaultViewStyles.walletButtonIconSvg} />
                            </div>
                            <div className={defaultViewStyles.walletButtonIcon} style={{ '--delay': '40ms' } as CSSProperties}>
                                <MetamaskIcon className={defaultViewStyles.walletButtonIconSvg} />
                            </div>
                            <div className={defaultViewStyles.walletButtonIcon} style={{ '--delay': '60ms' } as CSSProperties}>
                                <PhantomWalletIcon className={`${defaultViewStyles.walletButtonIconSvg} ${defaultViewStyles.phantomIcon}`} />
                            </div>
                        </div>

                        <p className={defaultViewStyles.walletButtonText}>Connect Wallet</p>
                    </button>

                </div>

            </div>


            {/* <div className={styles.bottom}> */}
            {/* <button type="button" className={styles.viewActionButton} onClick={() => setView('select')}>
                    Go to select
                </button> */}



            {/* </div> */}

            <p className={styles.disclaimer}>
                By connecting your wallet you agree to the Terms of Service and Privacy Policy
            </p>
        </>
    );
}
