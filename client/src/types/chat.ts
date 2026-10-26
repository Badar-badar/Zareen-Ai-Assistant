export interface PendingAction {
  id: string;
  type: 'createOrder' | 'createCustomer' | 'updateOrderStatus';
  summary: string;
  expiresAt: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  actions?: PendingAction[];
}