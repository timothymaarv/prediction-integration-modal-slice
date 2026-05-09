import { Tooltip } from '@base-ui/react/tooltip';
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react';
import styles from '../integration.module.css';
import { useIntegrationContext, type SelectableWallet } from '../integration-context';
import Header from './header';
import ArrowRightIcon from '../../../assets/custom/arrow-right.svg?react'
import selectViewStyles from './select-view.module.css'
import AcmeLogo from '../../../assets/custom/acme.svg?react';
import { WALLET_LABELS } from '../wallets';
import { WalletIcon } from '../wallet-icon';
import { useEffect, useRef, useState, type ComponentPropsWithRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

type WalletOptionId = SelectableWallet | 'other'

const LEFT_BULB_GLOW_PEAK = -1;
const BULB_GLOW_SIGMA = 1;
const BULB_GLOW_TWO_SIGMA_SQ = 2 * BULB_GLOW_SIGMA * BULB_GLOW_SIGMA;
const BULB_GLOW_BASELINE = 0.3;
const SWEEP_OVERSHOOT = 3;

/** Faster than `IntegrationConnectionButton` — tooltip only, no shine. */
const TOOLTIP_ENTER_SPRING: Transition = { type: 'spring', duration: 0.22, bounce: 0 };
const TOOLTIP_TEXT_BLOCK_SPRING: Transition = { type: 'spring', duration: 0.2, bounce: 0 };
const TOOLTIP_LETTER_SPRING: Transition = { type: 'spring', damping: 32, mass: 0.12, stiffness: 580 };
const TOOLTIP_CHAR_STAGGER_S = 0.003;

const OTHER_WALLET_TOOLTIP_MESSAGES = [
    'Coming soon',
    'Stop.',
    'Seriously?',
    'Still nothing.',
    'Try again. Still no.',
    'Okay. Enough.',
    'I mean it.',
    'Wow.',
] as const;

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
                <WalletOptionButton id="coinbase" label={WALLET_LABELS.coinbase} />
                <WalletOptionButton id="metamask" label={WALLET_LABELS.metamask} />
                <WalletOptionButton id="phantom" label={WALLET_LABELS.phantom} />
                <WalletOptionButton id="rainbow" label={WALLET_LABELS.rainbow} />
                <OtherWalletsOption label="Other Wallets" />
            </div>

            <p className={styles.disclaimer}>
                By connecting your wallet you agree to the Terms of Service and Privacy Policy
            </p>
        </>
    );
}

function WalletOptionButton({ id, label }: { id: Exclude<WalletOptionId, 'other'>, label: string }) {
    const { setView, setSelectedWallet } = useIntegrationContext();
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

    const handleClick = () => {
        setSelectedWallet(id);
        setView('connecting');
    };

    const optionInner = (
        <>
            <div className={selectViewStyles.optionButtonLeft}>
                {getIconForWallet(id)}
                <span className={selectViewStyles.optionButtonLeftText}>{label}</span>
            </div>
            <ArrowRightIcon className={selectViewStyles.optionButtonIcon} />
        </>
    );

    return (
        <button
            type="button"
            className={`${selectViewStyles.optionButton} ${pressed ? selectViewStyles.optionButtonPressed : ''}`}
            style={iconStyle}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onPointerLeave={() => setPressed(false)}
            onClick={handleClick}
        >
            {optionInner}
        </button>
    );
}

function OtherWalletsOption({ label }: { label: string }) {
    const [pressed, setPressed] = useState(false);
    const [intensity, setIntensity] = useState(0.5);
    const pressStartRef = useRef<number | null>(null);
    const [otherClickCount, setOtherClickCount] = useState(0);
    const [isTooltipOpen, setIsTooltipOpen] = useState(false);
    const shakeRef = useRef<HTMLDivElement>(null);
    const tooltipCloseTimerRef = useRef<number | null>(null);
    const reducedMotion = useReducedMotion();

    const stageIndex = Math.min(
        Math.floor(otherClickCount / 4),
        OTHER_WALLET_TOOLTIP_MESSAGES.length - 1,
    );
    const tooltipMessage = OTHER_WALLET_TOOLTIP_MESSAGES[stageIndex];
    const annoyed = otherClickCount >= 4;

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

    useEffect(() => {
        const el = shakeRef.current;
        if (!el || reducedMotion) return;
        if (otherClickCount === 0) {
            el.classList.remove(selectViewStyles.comingSoonTooltipShaking);
            return;
        }
        const tier = Math.floor((otherClickCount - 1) / 4);
        /** Horizontal only: tight cap so copy stays readable */
        const amp = Math.min(2.5 + otherClickCount * 0.38 + tier * 1.1, 11);
        const dur = Math.min(0.24 + tier * 0.028 + Math.min(otherClickCount, 16) * 0.008, 0.48);
        el.style.setProperty('--shake-amp', `${amp}px`);
        el.style.setProperty('--shake-dur', `${dur}s`);
        el.classList.remove(selectViewStyles.comingSoonTooltipShaking);
        void el.offsetWidth;
        el.classList.add(selectViewStyles.comingSoonTooltipShaking);
    }, [otherClickCount, reducedMotion]);

    const clearTooltipCloseTimer = () => {
        if (tooltipCloseTimerRef.current) {
            window.clearTimeout(tooltipCloseTimerRef.current);
            tooltipCloseTimerRef.current = null;
        }
    };

    const scheduleTooltipClose = () => {
        clearTooltipCloseTimer();
        tooltipCloseTimerRef.current = window.setTimeout(() => {
            setIsTooltipOpen(false);
        }, 2200);
    };

    useEffect(() => () => clearTooltipCloseTimer(), []);

    const optionInner = (
        <>
            <div className={selectViewStyles.optionButtonLeft}>
                {getIconForWallet('other')}
                <span className={selectViewStyles.optionButtonLeftText}>{label}</span>
            </div>
            <ArrowRightIcon className={selectViewStyles.optionButtonIcon} />
        </>
    );

    return (
        <Tooltip.Root
            open={isTooltipOpen}
            onOpenChange={(open) => {
                setIsTooltipOpen(open);
                if (!open) {
                    clearTooltipCloseTimer();
                    setOtherClickCount(0);
                }
            }}
        >
            <Tooltip.Trigger
                delay={450}
                closeOnClick={false}
                aria-label={`${label}. ${tooltipMessage}`}
                render={(props: ComponentPropsWithRef<'button'>) => (
                    <button
                        {...props}
                        type="button"
                        className={[props.className, selectViewStyles.optionButton, pressed ? selectViewStyles.optionButtonPressed : ''].filter(Boolean).join(' ')}
                        style={{
                            ...(props.style && typeof props.style === 'object' && !Array.isArray(props.style) ? props.style : {}),
                            ...iconStyle,
                        }}
                        onPointerDown={(e) => {
                            props.onPointerDown?.(e);
                            handlePointerDown();
                        }}
                        onPointerUp={(e) => {
                            props.onPointerUp?.(e);
                            handlePointerEnd(e);
                        }}
                        onPointerCancel={(e) => {
                            props.onPointerCancel?.(e);
                            handlePointerEnd(e);
                        }}
                        onPointerLeave={(e) => {
                            props.onPointerLeave?.(e);
                            setPressed(false);
                        }}
                        onClick={(e) => {
                            props.onClick?.(e);
                            setOtherClickCount((c) => c + 1);
                            setIsTooltipOpen(true);
                            scheduleTooltipClose();
                        }}
                    >
                        {optionInner}
                    </button>
                )}
            />
            <Tooltip.Portal>
                <Tooltip.Positioner side="top" sideOffset={8}>
                    <Tooltip.Popup
                        className={selectViewStyles.comingSoonTooltipPopup}
                    >
                        <motion.div
                            className={selectViewStyles.comingSoonTooltipEnter}
                            initial={reducedMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={reducedMotion ? { duration: 0.01 } : TOOLTIP_ENTER_SPRING}
                        >
                            <div
                                ref={shakeRef}
                                className={[
                                    selectViewStyles.comingSoonTooltip,
                                    annoyed ? selectViewStyles.comingSoonTooltipAnnoyed : '',
                                ].filter(Boolean).join(' ')}
                            >
                                <AnimatePresence mode="wait" initial={false}>
                                    <motion.div
                                        key={stageIndex}
                                        className={selectViewStyles.comingSoonTooltipTextWrap}
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        transition={reducedMotion ? { duration: 0.01 } : TOOLTIP_TEXT_BLOCK_SPRING}
                                    >
                                        <OtherWalletTooltipAnimatedText text={tooltipMessage} reducedMotion={!!reducedMotion} />
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </Tooltip.Popup>
                </Tooltip.Positioner>
            </Tooltip.Portal>
        </Tooltip.Root>
    );
}

function OtherWalletTooltipAnimatedText({ text, reducedMotion }: { text: string; reducedMotion: boolean }) {
    const words = text.split(' ');
    let charOffset = 0;
    const letterTransition = reducedMotion ? { duration: 0.01 } : { ...TOOLTIP_LETTER_SPRING };

    return (
        <span className={selectViewStyles.comingSoonTooltipWords}>
            {words.map((word, wordIndex) => {
                const startOffset = charOffset;
                charOffset += word.length;
                return (
                    <span key={`${word}-${wordIndex}-${text}`} className={selectViewStyles.comingSoonTooltipWord}>
                        <span className={selectViewStyles.comingSoonTooltipWord}>
                            {word.split('').map((char, charIndex) => (
                                <motion.span
                                    key={`${char}-${startOffset + charIndex}-${text}`}
                                    initial={reducedMotion ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 5, filter: 'blur(3px)' }}
                                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                    transition={{
                                        ...letterTransition,
                                        delay: reducedMotion ? 0 : (startOffset + charIndex) * TOOLTIP_CHAR_STAGGER_S,
                                    } as Transition}
                                    style={{ display: 'inline-block' }}
                                >
                                    {char}
                                </motion.span>
                            ))}
                        </span>
                        {wordIndex < words.length - 1 ? <span className={selectViewStyles.comingSoonTooltipSpace}>{' '}</span> : null}
                    </span>
                );
            })}
        </span>
    );
}

function getIconForWallet(id: WalletOptionId) {
    const iconClass = selectViewStyles.optionButtonWalletIcon;
    if (id === 'other') {
        return <OtherWalletsIconCluster />;
    }
    return <WalletIcon wallet={id} className={iconClass} />;
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
