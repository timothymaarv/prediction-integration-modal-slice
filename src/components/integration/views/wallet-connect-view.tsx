import styles from '../integration.module.css';
import { useIntegrationContext } from '../integration-context';
import Header from './header';

export default function WalletConnectView() {
    const { setView } = useIntegrationContext();

    return (
        <>
            <Header onBack={() => setView('select')} onClose={() => setView('default')} />
            <div className={styles.top}>
                <div className={styles.titles}>
                    <span className={styles.title}>Wallet connect</span>
                    <p className={styles.subtitle}>Placeholder view for wallet connection UI.</p>
                </div>
            </div>
            <div className={styles.bottom}>
                <button type="button" className={styles.viewActionButton} onClick={() => setView('select')}>
                    Back to select
                </button>
            </div>
        </>
    );
}
