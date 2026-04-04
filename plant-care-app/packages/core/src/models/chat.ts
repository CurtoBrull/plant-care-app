export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number   // Unix ms
}

export interface ChatSession {
  plantId: string
  messages: ChatMessage[]
}
