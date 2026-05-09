import { useState } from 'react';
import { motion } from 'motion/react';
import useMeasure from 'react-use-measure';
import styles from './integration.module.css';
import { IntegrationContext, type IntegrationView } from './integration-context';
import type { SelectableWallet } from './wallets';
import DefaultView from './views/default-view';
import SelectView from './views/select-view';
import WalletConnectView from './views/wallet-connect-view';
import ConnectingView from './views/connecting-view';

export type IntegrationConnectionOutcome = 'success' | 'failed';

type IntegrationProps = {
    connectionOutcome: IntegrationConnectionOutcome;
};

export default function Integration({ connectionOutcome }: IntegrationProps) {
    const [view, setView] = useState<IntegrationView>('default');
    const [selectedWallet, setSelectedWallet] = useState<SelectableWallet | null>(null);
    const [isTemporarilyHidden, setIsTemporarilyHidden] = useState(false);
    const [measureRef, bounds] = useMeasure();

    const handleSuccessClose = () => {
        setIsTemporarilyHidden(true);
        window.setTimeout(() => {
            setView('default');
            setSelectedWallet(null);
            setIsTemporarilyHidden(false);
        }, 1000);
    };

    return (
        <IntegrationContext.Provider value={{ view, setView, selectedWallet, setSelectedWallet }}>
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
                            onSuccessCountdownFinished={handleSuccessClose}
                        />
                    )}
                    {view === 'wallet-connect' && <WalletConnectView />}
                </div>
            </motion.div>
        </IntegrationContext.Provider>
    );
}
