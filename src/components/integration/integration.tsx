import { useState } from 'react';
import { motion } from 'motion/react';
import useMeasure from 'react-use-measure';
import styles from './integration.module.css';
import { IntegrationContext, type IntegrationView } from './integration-context';
import DefaultView from './views/default-view';
import SelectView from './views/select-view';
import WalletConnectView from './views/wallet-connect-view';
import ConnectingView from './views/connecting-view';

export default function Integration() {
    const [view, setView] = useState<IntegrationView>('connecting');
    const [measureRef, bounds] = useMeasure();

    return (
        <IntegrationContext.Provider value={{ view, setView }}>
            <motion.div
                className={styles.integrationContainer}
                initial={false}
                animate={{ height: bounds.height || 'auto' }}
                transition={{
                    type: 'tween',
                    duration: 0.20,
                    ease: [0.25, 0.46, 0.45, 0.94],
                }}
            >
                <div ref={measureRef} className={styles.wrapper}>
                    {view === 'default' && <DefaultView />}
                    {view === 'select' && <SelectView />}
                    {view === 'connecting' && <ConnectingView />}
                    {view === 'wallet-connect' && <WalletConnectView />}
                </div>
            </motion.div>
        </IntegrationContext.Provider>
    );
}
