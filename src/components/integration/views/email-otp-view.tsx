import { OTPInput, type SlotProps } from 'input-otp'
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react';
import confetti from 'canvas-confetti';
import NumberFlow from '@number-flow/react';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import GoodCheckIcon from '../../../assets/checks/good.svg?react';
import BadCheckIcon from '../../../assets/checks/bad.svg?react';
import { useIntegrationContext } from '../integration-context';
import styles from '../integration.module.css';
import Header from './header';
import otpStyles from './email-otp-view.module.css'

type OtpButtonState = 'idle' | 'checking' | 'error' | 'success';
const CORRECT_OTP = '123456';
const OTP_SUCCESS_HOLD_MS = 5000;
const OTP_SUCCESS_COUNTDOWN_START = 5;
const CONFETTI_SETTINGS = {
    particleCount: 130,
    spread: 60,
    startVelocity: 60,
    gravity: 0.6,
    ticks: 150,
    scalar: 1,
    angle: 90,
    drift: -0.2,
} as const;
const EMPTY_OTP_TOOLTIP_MESSAGES = [
    'Enter OTP first.',
    'Still empty.',
    'No code yet.',
    'Add 6 digits.',
    'Come on :)',
] as const;

const SPRING: Transition = {
    type: 'spring',
    duration: 0.35,
    bounce: 0,
};

const LETTER_SPRING: Transition = {
    type: 'spring',
    damping: 25,
    mass: 0.2,
    stiffness: 400,
};

export default function EmailOTPView() {
    const { setView, email, hideAndResetToDefault } = useIntegrationContext();
    const [otp, setOtp] = useState('');
    const [buttonState, setButtonState] = useState<OtpButtonState>('idle');
    const [successCountdown, setSuccessCountdown] = useState(OTP_SUCCESS_COUNTDOWN_START);
    const [isOtpError, setIsOtpError] = useState(false);
    const [isOtpEmptyError, setIsOtpEmptyError] = useState(false);
    const [emptyOtpClicks, setEmptyOtpClicks] = useState(0);
    const [showEmptyTooltip, setShowEmptyTooltip] = useState(false);
    const shakeRef = useRef<HTMLDivElement>(null);
    const tooltipShakeRef = useRef<HTMLDivElement>(null);
    const actionTimerRef = useRef<number | null>(null);
    const tooltipHideTimerRef = useRef<number | null>(null);
    const reducedMotion = useReducedMotion();
    const tooltipStage = Math.min(Math.floor(emptyOtpClicks / 4), EMPTY_OTP_TOOLTIP_MESSAGES.length - 1);
    const tooltipMessage = EMPTY_OTP_TOOLTIP_MESSAGES[tooltipStage];
    const tooltipAnnoyed = emptyOtpClicks >= 4;

    const clearActionTimer = () => {
        if (actionTimerRef.current) {
            window.clearTimeout(actionTimerRef.current);
            actionTimerRef.current = null;
        }
    };

    const clearTooltipHideTimer = () => {
        if (tooltipHideTimerRef.current) {
            window.clearTimeout(tooltipHideTimerRef.current);
            tooltipHideTimerRef.current = null;
        }
    };

    const scheduleTooltipHide = () => {
        clearTooltipHideTimer();
        tooltipHideTimerRef.current = window.setTimeout(() => setShowEmptyTooltip(false), 2200);
    };

    const resetEmptyOtpTooltip = () => {
        clearTooltipHideTimer();
        setShowEmptyTooltip(false);
        setEmptyOtpClicks(0);
    };

    const handleButtonAreaPointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== 'mouse') return;
        resetEmptyOtpTooltip();
    };

    useEffect(
        () => () => {
            clearActionTimer();
            clearTooltipHideTimer();
        },
        [],
    );

    useEffect(() => {
        if (buttonState !== 'success') {
            setSuccessCountdown(OTP_SUCCESS_COUNTDOWN_START);
            return;
        }
        setSuccessCountdown(OTP_SUCCESS_COUNTDOWN_START);
        const timer = window.setInterval(() => {
            setSuccessCountdown((current) => Math.max(0, current - 1));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [buttonState]);

    const triggerOtpShake = (kind: 'error' | 'empty') => {
        const el = shakeRef.current;
        if (!el) return;
        el.classList.remove(otpStyles.otpErrorShake);
        el.classList.remove(otpStyles.otpEmptyShake);
        void el.offsetHeight;
        el.classList.add(kind === 'error' ? otpStyles.otpErrorShake : otpStyles.otpEmptyShake);
    };

    const triggerTooltipShake = (clickCount: number) => {
        if (reducedMotion) return;
        const el = tooltipShakeRef.current;
        if (!el) return;
        const tier = Math.floor(clickCount / 4);
        const amp = Math.min(2.5 + clickCount * 0.3 + tier * 0.8, 9);
        const dur = Math.min(0.24 + clickCount * 0.006, 0.44);
        el.style.setProperty('--otp-tooltip-shake-amp', `${amp}px`);
        el.style.setProperty('--otp-tooltip-shake-dur', `${dur}s`);
        el.classList.remove(otpStyles.otpTooltipShaking);
        void el.offsetWidth;
        el.classList.add(otpStyles.otpTooltipShaking);
    };

    const fireConfetti = useCallback(() => {
        const el = shakeRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;
        confetti({
            particleCount: CONFETTI_SETTINGS.particleCount,
            spread: CONFETTI_SETTINGS.spread,
            startVelocity: CONFETTI_SETTINGS.startVelocity,
            gravity: CONFETTI_SETTINGS.gravity,
            ticks: CONFETTI_SETTINGS.ticks,
            scalar: CONFETTI_SETTINGS.scalar,
            angle: CONFETTI_SETTINGS.angle,
            drift: CONFETTI_SETTINGS.drift,
            colors: ['#8C4DFF', '#35DF8D', '#FFD700', '#FF6B6B', '#4DAFFF'],
            shapes: ['circle', 'square'],
            disableForReducedMotion: true,
            origin: { x, y },
        });
    }, []);

    const handleVerify = () => {
        if (buttonState === 'checking' || buttonState === 'success') return;
        if (otp.trim().length === 0) {
            const nextClicks = emptyOtpClicks + 1;
            const shouldShowTooltip = nextClicks % 4 === 0;
            setEmptyOtpClicks(nextClicks);
            setIsOtpError(false);
            setIsOtpEmptyError(true);
            triggerOtpShake('empty');
            clearActionTimer();
            actionTimerRef.current = window.setTimeout(() => {
                setIsOtpEmptyError(false);
            }, 520);
            if (shouldShowTooltip) {
                setShowEmptyTooltip(true);
                triggerTooltipShake(nextClicks);
                scheduleTooltipHide();
            }
            return;
        }

        clearActionTimer();
        setShowEmptyTooltip(false);
        setIsOtpError(false);
        setIsOtpEmptyError(false);
        setButtonState('checking');

        actionTimerRef.current = window.setTimeout(() => {
            if (otp === CORRECT_OTP) {
                setIsOtpError(false);
                setButtonState('success');
                fireConfetti();
                actionTimerRef.current = window.setTimeout(() => {
                    hideAndResetToDefault(1000);
                }, OTP_SUCCESS_HOLD_MS);
                return;
            }

            setIsOtpError(true);
            setIsOtpEmptyError(false);
            triggerOtpShake('error');
            setButtonState('error');
            if (showEmptyTooltip) setShowEmptyTooltip(false);
            actionTimerRef.current = window.setTimeout(() => {
                setButtonState('idle');
            }, 900);
            actionTimerRef.current = window.setTimeout(() => {
                setIsOtpError(false);
            }, 1000);
        }, 650);
    };


    return (
        <>
            <Header onBack={() => setView('default')} onClose={() => setView('default')} title='Confirm email' />

            <div className={otpStyles.wrapper}>

                <p className={`${otpStyles.otpText} ${buttonState === 'success' ? styles.successSubtitleLocked : ''}`}>
                    {buttonState === 'success' ? (
                        <>
                            You’re in. This dialog will close on its own in{' '}
                            <span className={styles.connectionCountdown}>
                                <NumberFlow
                                    value={successCountdown}
                                    format={{ minimumIntegerDigits: 1, maximumFractionDigits: 0 }}
                                />
                            </span>{' '}
                            seconds.
                        </>
                    ) : (
                        <>
                            Please enter the verification code sent to{' '}
                            <strong>{email || 'email@email.com'}</strong>
                        </>
                    )}
                </p>

                <div
                    ref={shakeRef}
                    className={`${otpStyles.otpInputWrap} ${isOtpError ? otpStyles.slotsError : ''}`}
                >
                    <OTPInput
                        value={otp}
                        onChange={(next) => {
                            setOtp(next);
                            if (isOtpError) setIsOtpError(false);
                            if (isOtpEmptyError) setIsOtpEmptyError(false);
                            if (showEmptyTooltip) setShowEmptyTooltip(false);
                            if (buttonState === 'error') setButtonState('idle');
                        }}
                        maxLength={6}
                        containerClassName={otpStyles.container}
                        render={({ slots }) => (
                            <>
                                <div className={otpStyles.slotGroup}>
                                    {slots.slice(0, 3).map((slot, idx) => (
                                        <Slot key={idx} {...slot} isOtpError={isOtpError} />
                                    ))}
                                </div>

                                <div className={otpStyles.slotGroup}>
                                    {slots.slice(3).map((slot, idx) => (
                                        <Slot key={idx} {...slot} isOtpError={isOtpError} />
                                    ))}
                                </div>
                            </>
                        )}
                    />
                </div>
            </div>


            <div className={styles.bottom}>
                <div className={otpStyles.otpButtonArea}>
                    <AnimatePresence initial={false}>
                        {showEmptyTooltip && (
                            <motion.div
                                className={otpStyles.otpEmptyTooltipWrap}
                                initial={reducedMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                                transition={reducedMotion ? { duration: 0.01 } : SPRING}
                            >
                                <div
                                    ref={tooltipShakeRef}
                                    className={`${otpStyles.otpEmptyTooltip} ${tooltipAnnoyed ? otpStyles.otpEmptyTooltipAnnoyed : ''}`}
                                >
                                    <AnimatedText text={tooltipMessage} />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <motion.div
                        className={styles.connectionButtonWrapper}
                        onPointerLeave={handleButtonAreaPointerLeave}
                        animate={buttonState === 'success' ? { y: [0, 3, -1, 0] } : { y: 0 }}
                        transition={buttonState === 'success' ? { duration: 0.4, ease: [0.16, 1, 0.3, 1], times: [0, 0.2, 0.5, 1] } : SPRING}
                    >
                        <motion.button
                            type="button"
                            className={`${styles.connectionButton} ${buttonState === 'checking' || buttonState === 'error' ? styles.connectionButtonConnecting : ''} ${buttonState === 'success' ? styles.connectionButtonConnected : ''}`}
                            onClick={handleVerify}
                            disabled={buttonState === 'checking' || buttonState === 'success'}
                            whileTap={{ scale: 0.99 }}
                            transition={SPRING}
                            style={{ position: 'relative', overflow: 'hidden' }}
                        >
                            {(buttonState === 'checking' || buttonState === 'error' || buttonState === 'success') && <div className={styles.connectionButtonShine} />}
                            <AnimatePresence mode="popLayout" initial={false}>
                                {buttonState === 'idle' && (
                                    <motion.div
                                        key="idle"
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={SPRING}
                                        className={styles.connectionButtonText}
                                    >
                                        <AnimatedText text="Verify email" />
                                    </motion.div>
                                )}
                                {buttonState === 'checking' && (
                                    <motion.div
                                        key="checking"
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={SPRING}
                                        className={styles.connectionButtonText}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, position: 'relative', zIndex: 1 }}
                                    >
                                        <Spinner />
                                        <AnimatedText text="Verifying" />
                                    </motion.div>
                                )}
                                {buttonState === 'error' && (
                                    <motion.div
                                        key="error"
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={SPRING}
                                        className={styles.connectionButtonText}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, position: 'relative', zIndex: 1 }}
                                    >
                                        <BadCheckIcon className={styles.connectionStateIcon} />
                                        <AnimatedText text="Wrong OTP" />
                                    </motion.div>
                                )}
                                {buttonState === 'success' && (
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={SPRING}
                                        className={styles.connectionButtonText}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                    >
                                        <GoodCheckIcon className={styles.connectionStateIcon} />
                                        <AnimatedText text="Confirmed" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.button>
                    </motion.div>
                </div>
            </div>
        </>
    );
}


function Slot(props: SlotProps & { isOtpError: boolean }) {
    return (
        <div
            className={`${otpStyles.slot} ${props.isActive ? otpStyles.slotActive : ''} ${props.isOtpError ? otpStyles.slotError : ''}`}
            data-filled={props.char !== null ? 'true' : 'false'}
        >
            {props.char !== null && <div>{props.char}</div>}
            {props.hasFakeCaret && <FakeCaret />}
        </div>
    )
}


function FakeCaret() {
    return (
        <div className={otpStyles.caretFrame}>
            <div className={otpStyles.caret} />
        </div>
    )
}

function AnimatedText({ text }: { text: string }) {
    const words = text.split(' ');
    let charOffset = 0;
    return (
        <span style={{ display: 'inline-flex', gap: 4 }}>
            {words.map((word, wordIndex) => {
                const startOffset = charOffset;
                charOffset += word.length;
                return (
                    <span key={`${word}-${wordIndex}`} style={{ display: 'inline-flex' }}>
                        {word.split('').map((char, charIndex) => (
                            <motion.span
                                key={`${char}-${startOffset + charIndex}`}
                                initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                transition={{
                                    ...LETTER_SPRING,
                                    delay: (startOffset + charIndex) * 0.008,
                                } as Transition}
                                style={{ display: 'inline-block' }}
                            >
                                {char}
                            </motion.span>
                        ))}
                    </span>
                );
            })}
        </span>
    );
}

function Spinner() {
    return (
        <motion.svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        >
            <circle
                cx="7"
                cy="7"
                r="5.5"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1.5"
                fill="none"
            />
            <path
                d="M12.5 7a5.5 5.5 0 0 0-5.5-5.5"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
            />
        </motion.svg>
    );
}
