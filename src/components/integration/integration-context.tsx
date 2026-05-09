import { createContext, useContext } from 'react';
import type { SelectableWallet } from './wallets';

export type IntegrationView = 'default' | 'select' | 'connecting' | 'wallet-connect' | 'email-otp';

export type IntegrationContextValue = {
    view: IntegrationView;
    setView: (view: IntegrationView) => void;
    email: string;
    setEmail: (email: string) => void;
    selectedWallet: SelectableWallet | null;
    setSelectedWallet: (wallet: SelectableWallet | null) => void;
    hideAndResetToDefault: (delayMs?: number) => void;
};

export type { SelectableWallet } from './wallets';

export const IntegrationContext = createContext<IntegrationContextValue | null>(null);

export function useIntegrationContext(): IntegrationContextValue {
    const context = useContext(IntegrationContext);
    if (!context) {
        throw new Error('useIntegrationContext must be used within IntegrationContext.Provider');
    }
    return context;
}
