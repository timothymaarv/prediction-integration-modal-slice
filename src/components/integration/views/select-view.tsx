import styles from '../integration.module.css';
import { useIntegrationContext } from '../integration-context';
import Header from './header';

export default function SelectView() {
    const { setView } = useIntegrationContext();

    return (
        <>
            <Header onBack={() => setView('default')} onClose={() => setView('default')} />
            <div className={styles.top}>
                <div className={styles.titles}>
                    <span className={styles.title}>Select connection</span>
                    <p className={styles.subtitle}>Use the back arrow to return to default.</p>
                </div>
            </div>
            <div className={styles.bottom}>
                <button type="button" className={styles.viewActionButton} onClick={() => setView('connecting')}>
                    Go to connecting
                </button>
                <button type="button" className={styles.viewSecondaryButton} onClick={() => setView('wallet-connect')}>
                    Open wallet-connect
                </button>
            </div>
        </>
    );
}
