import ChevronLeftIcon from '../../../assets/custom/chevron-left.svg?react';
import CloseIcon from '../../../assets/custom/close.svg?react';
import styles from './header.module.css';

type HeaderProps = {
    onBack?: () => void;
    onClose?: () => void;
};

export default function Header({ onBack, onClose }: HeaderProps) {
    return (
        <div className={styles.header}>
            {onBack ? (
                <button type="button" className={styles.headerAction} onClick={onBack} aria-label="Go back">
                    <ChevronLeftIcon />
                </button>
            ) : (
                <span className={styles.headerSpacer} />
            )}
            {onClose ? (
                <button type="button" className={styles.headerAction} onClick={onClose} aria-label="Close">
                    <CloseIcon />
                </button>
            ) : (
                <span className={styles.headerSpacer} />
            )}
        </div>
    );
}
