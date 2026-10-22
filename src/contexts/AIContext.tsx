import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  getUserGeminiApiKey,
  setUserGeminiApiKey,
  getUserGeminiTier,
  setUserGeminiTier,
  type GeminiTier,
} from '../services/aiService'

interface AIContextType {
  userApiKey: string
  setUserApiKey: (key: string) => void
  userTier: GeminiTier
  setUserTier: (tier: GeminiTier) => void
  showKeyModal: boolean
  setShowKeyModal: (show: boolean) => void
  enableSearch: boolean
  setEnableSearch: React.Dispatch<React.SetStateAction<boolean>>
  isLocalMode: boolean
  setIsLocalMode: (local: boolean) => void
  activeTab: 'chat' | 'work'
  setActiveTab: (tab: 'chat' | 'work') => void
  newChatTrigger: number
  triggerNewChat: () => void
}

const AIContext = createContext<AIContextType | null>(null)

export const AIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userApiKey, setUserApiKeyState] = useState(() => getUserGeminiApiKey())
  const [userTier, setUserTierState] = useState<GeminiTier>(() => getUserGeminiTier())
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [enableSearch, setEnableSearch] = useState(true)
  const [isLocalMode, setIsLocalMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'work'>('chat')
  const [newChatTrigger, setNewChatTrigger] = useState(0)

  const triggerNewChat = () => {
    setNewChatTrigger((prev) => prev + 1)
  }

  const setUserApiKey = (key: string) => {
    setUserApiKeyState(key)
    setUserGeminiApiKey(key)
  }

  const setUserTier = (tier: GeminiTier) => {
    setUserTierState(tier)
    setUserGeminiTier(tier)
  }

  useEffect(() => {
    const handleStorage = () => {
      setUserApiKeyState(getUserGeminiApiKey())
      setUserTierState(getUserGeminiTier())
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return (
    <AIContext.Provider
      value={{
        userApiKey,
        setUserApiKey,
        userTier,
        setUserTier,
        showKeyModal,
        setShowKeyModal,
        enableSearch,
        setEnableSearch,
        isLocalMode,
        setIsLocalMode,
        activeTab,
        setActiveTab,
        newChatTrigger,
        triggerNewChat,
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
