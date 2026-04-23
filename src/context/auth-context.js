import { createContext, useContext } from 'react'

// Context object + hook live in a non-component file so Fast Refresh can
// safely reload AuthContext.jsx without losing state (react-refresh/only-export-components).
export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)
