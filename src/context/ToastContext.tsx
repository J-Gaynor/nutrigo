import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ToastContextType {
    showToast: (message: string) => void;
    hideToast: () => void;
    incrementPending: (type: 'add' | 'remove') => void;
    decrementPending: (type: 'add' | 'remove') => void;
    toastMessage: string;
    toastVisible: boolean;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toastMessage, setToastMessage] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [pendingAdds, setPendingAdds] = useState(0);
    const [pendingRemoves, setPendingRemoves] = useState(0);

    const updateToastMessage = (adds: number, removes: number) => {
        if (adds > 0 && removes > 0) {
            // Both happening
            setToastMessage(`${adds > 1 ? 'Adding' : 'Adding'} ${adds} ${adds > 1 ? 'foods' : 'food'}, ${removes > 1 ? 'removing' : 'removing'} ${removes}...`);
        } else if (adds > 0) {
            setToastMessage(adds > 1 ? `Adding ${adds} foods...` : 'Adding food...');
        } else if (removes > 0) {
            setToastMessage(removes > 1 ? `Removing ${removes} foods...` : 'Removing food...');
        }
        // When all done (adds === 0 && removes === 0), don't update message - just hide
    };

    const incrementPending = (type: 'add' | 'remove') => {
        if (type === 'add') {
            setPendingAdds(prev => {
                const newCount = prev + 1;
                updateToastMessage(newCount, pendingRemoves);
                return newCount;
            });
        } else {
            setPendingRemoves(prev => {
                const newCount = prev + 1;
                updateToastMessage(pendingAdds, newCount);
                return newCount;
            });
        }
        setToastVisible(true);
    };

    const decrementPending = (type: 'add' | 'remove') => {
        if (type === 'add') {
            setPendingAdds(prev => {
                const newCount = Math.max(0, prev - 1);
                updateToastMessage(newCount, pendingRemoves);
                if (newCount === 0 && pendingRemoves === 0) {
                    // Auto-hide after brief delay
                    setTimeout(() => setToastVisible(false), 1500);
                }
                return newCount;
            });
        } else {
            setPendingRemoves(prev => {
                const newCount = Math.max(0, prev - 1);
                updateToastMessage(pendingAdds, newCount);
                if (newCount === 0 && pendingAdds === 0) {
                    setTimeout(() => setToastVisible(false), 1500);
                }
                return newCount;
            });
        }
    };

    const showToast = (message: string) => {
        setToastMessage(message);
        setToastVisible(true);
    };

    const hideToast = () => {
        setToastVisible(false);
        setPendingAdds(0);
        setPendingRemoves(0);
    };

    return (
        <ToastContext.Provider value={{ showToast, hideToast, incrementPending, decrementPending, toastMessage, toastVisible }}>
            {children}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};
