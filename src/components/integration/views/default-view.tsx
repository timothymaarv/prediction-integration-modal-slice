import styles from '../integration.module.css';
import { useIntegrationContext } from '../integration-context';

export default function DefaultView() {
    const { setView } = useIntegrationContext();

    return (
        <>
            <div className={styles.top}>
                <div className={styles.titles}>
                    <span className={styles.title}>Integration flow</span>
                    <p className={styles.subtitle}>Default view with no header.</p>
                </div>
            </div>
            <div className={styles.bottom}>
                <button type="button" className={styles.viewActionButton} onClick={() => setView('select')}>
                    Go to select
                </button>
            </div>
        </>
    );
}
