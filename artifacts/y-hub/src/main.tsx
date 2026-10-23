import { supabase } from '@/utils/supabaseClient';
import { configureMathHeaders } from '@/services/math/ports';
import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

configureMathHeaders(async()=>{
 const {data,error}=await supabase.auth.getSession();
 if(error || !data.session)throw new Error('Authentication required');
 return {Authorization: `Bearer ${data.session.access_token}`};
});

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
