import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import useMeasure from 'react-use-measure';
import styles from './integration.module.css';
import { IntegrationContext, type IntegrationView } from './integration-context';
import type { SelectableWallet } from './wallets';
import DefaultView from './views/default-view';
import SelectView from './views/select-view';
import WalletConnectView from './views/wallet-connect-view';
import ConnectingView from './views/connecting-view';
import EmailOTPView from './views/email-otp-view';

export type IntegrationConnectionOutcome = 'success' | 'failed';

type IntegrationProps = {
    connectionOutcome: IntegrationConnectionOutcome;
    onViewChange?: (view: IntegrationView) => void;
};

export default function Integration({ connectionOutcome, onViewChange }: IntegrationProps) {
    const [view, setView] = useState<IntegrationView>('default');
    const [email, setEmail] = useState('email@email.com');
    const [selectedWallet, setSelectedWallet] = useState<SelectableWallet | null>(null);
    const [isTemporarilyHidden, setIsTemporarilyHidden] = useState(false);
    const [measureRef, bounds] = useMeasure();

    const hideAndResetToDefault = (delayMs = 1000) => {
        setIsTemporarilyHidden(true);
        window.setTimeout(() => {
            setView('default');
            setSelectedWallet(null);
            setIsTemporarilyHidden(false);
        }, delayMs);
    };

    useEffect(() => {
        onViewChange?.(view);
    }, [onViewChange, view]);

    return (
        <IntegrationContext.Provider value={{ view, setView, email, setEmail, selectedWallet, setSelectedWallet, hideAndResetToDefault }}>
            <motion.div
                className={styles.integrationContainer}
                initial={false}
                animate={{ height: bounds.height || 'auto' }}
                transition={{
                    type: 'tween',
                    duration: 0.20,
                    ease: [0.25, 0.46, 0.45, 0.94],
                }}
                style={{ opacity: isTemporarilyHidden ? 0 : 1, pointerEvents: isTemporarilyHidden ? 'none' : 'auto' }}
            >
                <div ref={measureRef} className={styles.wrapper}>
                    {view === 'default' && <DefaultView />}
                    {view === 'select' && <SelectView />}
                    {view === 'connecting' && (
                        <ConnectingView
                            outcome={connectionOutcome}
                            onSuccessCountdownFinished={() => hideAndResetToDefault(1000)}
                        />
                    )}
                    {view === 'wallet-connect' && <WalletConnectView />}
                    {view === "email-otp" && <EmailOTPView />}
                </div>
            </motion.div>
        </IntegrationContext.Provider>
    );
}
