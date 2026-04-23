import { createContext, useContext } from 'react'

// Context object + hook live in a non-component file so Fast Refresh can
// safely reload AppContext.jsx without losing state (react-refresh/only-export-components).
export const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)
