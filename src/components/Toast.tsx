import { Toaster } from 'react-hot-toast';

export function Toast() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3200,
        style: {
          borderRadius: '12px',
          background: '#0F172A',
          color: '#FFFFFF',
          fontSize: '14px',
          padding: '10px 16px',
        },
        success: {
          iconTheme: {
            primary: '#10B981',
            secondary: '#FFFFFF',
          },
        },
      }}
    />
  );
}
