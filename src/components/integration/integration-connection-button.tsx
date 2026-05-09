import { AnimatePresence, motion, type Transition } from 'motion/react';
import styles from './integration.module.css';
import RefreshIcon from '../../assets/custom/refresh.svg?react';

export type ConnectionButtonState = 'idle' | 'connecting' | 'connected' | 'retry';

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

type IntegrationConnectionButtonProps = {
    state: ConnectionButtonState;
    onClick: () => void;
    disabled: boolean;
};

export default function IntegrationConnectionButton({ state, onClick, disabled }: IntegrationConnectionButtonProps) {
    return (
        <div className={styles.connectionButtonWrapper}>
            {/* <div className={styles.connectionButtonOverlay} /> */}
            <motion.button
                className={`${styles.connectionButton} ${state === 'connecting' ? styles.connectionButtonConnecting : ''} ${state === 'connected' ? styles.connectionButtonConnected : ''} ${state === 'retry' ? styles.connectionButtonRetry : ''}`}
                type="button"
                onClick={onClick}
                disabled={disabled}
                transition={SPRING}
                style={{ position: 'relative', overflow: 'hidden' }}
            >
                {(state === 'connecting' || state === 'connected' || state === 'retry') && <div className={styles.connectionButtonShine} />}
                <AnimatePresence mode="popLayout" initial={false}>
                    {state === 'idle' && (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={SPRING}
                            className={styles.connectionButtonText}
                        >
                            <AnimatedText text="Connect" />
                        </motion.div>
                    )}
                    {state === 'connecting' && (
                        <motion.div
                            key="connecting"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={SPRING}
                            className={styles.connectionButtonText}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, position: 'relative', zIndex: 1 }}
                        >
                            <Spinner />
                            <AnimatedText text="Connecting" />
                        </motion.div>
                    )}
                    {state === 'connected' && (
                        <motion.div
                            key="connected"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={SPRING}
                            className={styles.connectionButtonText}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                            <Checkmark />
                            <AnimatedText text="Connected" />
                        </motion.div>
                    )}
                    {state === 'retry' && (
                        <motion.div
                            key="retry"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={SPRING}
                            className={styles.connectionButtonText}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                            <RefreshIcon style={{ width: 14, height: 14 }} />
                            <AnimatedText text="Try again" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>
        </div>
    );
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

function Checkmark() {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <motion.path
                d="M3 7.5L5.5 10L11 4"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, ease: [0.65, 0, 0.35, 1], delay: 0.1 }}
            />
        </svg>
    );
}
