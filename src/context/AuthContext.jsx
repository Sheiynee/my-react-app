import { useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithCustomToken,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../firebase'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  // Called after backend mints a custom token from Discord OAuth
  async function loginWithDiscordToken(token) {
    const cred = await signInWithCustomToken(auth, token)
    return cred.user
  }

  async function loginWithEmail(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred.user
  }

  async function registerWithEmail(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    return cred.user
  }

  async function logout() {
    await signOut(auth)
  }

  // Returns the current ID token, refreshing it if needed
  async function getToken() {
    if (!auth.currentUser) return null
    return auth.currentUser.getIdToken()
  }

  return (
    <AuthContext.Provider value={{
      user,
      authLoading,
      loginWithDiscordToken,
      loginWithEmail,
      registerWithEmail,
      logout,
      getToken,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

