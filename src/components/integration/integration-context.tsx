import { createContext, useContext } from 'react';

export type IntegrationView = 'default' | 'select' | 'connecting' | 'wallet-connect';

export type IntegrationContextValue = {
    view: IntegrationView;
    setView: (view: IntegrationView) => void;
};

export const IntegrationContext = createContext<IntegrationContextValue | null>(null);

export function useIntegrationContext(): IntegrationContextValue {
    const context = useContext(IntegrationContext);
    if (!context) {
        throw new Error('useIntegrationContext must be used within IntegrationContext.Provider');
    }
    return context;
}
