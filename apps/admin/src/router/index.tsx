import { createBrowserRouter, type RouterProviderProps } from 'react-router-dom';

// Minimal router stub — full routes added in Task 2
export const router: RouterProviderProps['router'] = createBrowserRouter([
  {
    path: '/',
    element: <div>Loading...</div>,
  },
]);
