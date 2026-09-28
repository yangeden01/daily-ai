import React, { createContext, useContext, useEffect, useState } from 'react'
import { getUserGeminiApiKey, setUserGeminiApiKey } from '../services/aiService'

interface AIContextType {
  userApiKey: string
  setUserApiKey: (key: string) => void
  showKeyModal: boolean
  setShowKeyModal: (show: boolean) => void
  enableSearch: boolean
  setEnableSearch: React.Dispatch<React.SetStateAction<boolean>>
  isLocalMode: boolean
  setIsLocalMode: (local: boolean) => void
}

const AIContext = createContext<AIContextType | null>(null)

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userApiKey, setUserApiKeyState] = useState(() => getUserGeminiApiKey())
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [enableSearch, setEnableSearch] = useState(true)
  const [isLocalMode, setIsLocalMode] = useState(false)

  const setUserApiKey = (key: string) => {
    setUserApiKeyState(key)
    setUserGeminiApiKey(key)
  }

  useEffect(() => {
    const handleStorage = () => {
      setUserApiKeyState(getUserGeminiApiKey())
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return (
    <AIContext.Provider
      value={{
        userApiKey,
        setUserApiKey,
        showKeyModal,
        setShowKeyModal,
        enableSearch,
        setEnableSearch,
        isLocalMode,
        setIsLocalMode,
      }}
    >
      {children}
    </AIContext.Provider>
  )
}

export function useAI(): AIContextType {
  const context = useContext(AIContext)
  if (!context) {
    throw new Error('useAI must be used within an AIProvider')
  }
  return context
}
