import { initializeApp, getApps, getApp } from 'firebase/app'
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import firebaseConfig from '../../firebase-applet-config.json'

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
export const auth = getAuth(app)

export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
]

const provider = new GoogleAuthProvider()
for (const scope of GOOGLE_DRIVE_SCOPES) {
  provider.addScope(scope)
}
// Always prompt to select account / confirm permissions if needed
provider.setCustomParameters({
  prompt: 'select_account',
})

let isSigningIn = false
let cachedAccessToken: string | null = null

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken)
      } else if (!isSigningIn) {
        if (onAuthSuccess) onAuthSuccess(user, null)
      }
    } else {
      cachedAccessToken = null
      if (onAuthFailure) onAuthFailure()
    }
  })
}

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true
    const result = await signInWithPopup(auth, provider)
    const credential = GoogleAuthProvider.credentialFromResult(result)
    if (!credential?.accessToken) {
      throw new Error('未從 Google 授權取得 Access Token')
    }
    cachedAccessToken = credential.accessToken
    return { user: result.user, accessToken: cachedAccessToken }
  } catch (error: unknown) {
    console.error('Google Sign in error:', error)
    throw error
  } finally {
    isSigningIn = false
  }
}

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken
  // If user is signed in but token was purged from memory, re-acquire via popup
  if (auth.currentUser) {
    try {
      const res = await googleSignIn()
      return res?.accessToken || null
    } catch {
      return null
    }
  }
  return null
}

export const logout = async () => {
  await auth.signOut()
  cachedAccessToken = null
}
