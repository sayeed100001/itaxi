const API_URL = `${(import.meta as any).env?.VITE_API_URL || '/api'}/payments`;

export const createCheckoutSession = async (amount: number): Promise<{ sessionId: string; url: string }> => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_URL}/create-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ amount })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create checkout session');
  }

  return response.json();
};

export const requestPayout = async (amount: number) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`${API_URL}/payout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ amount })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to request payout');
  }

  return response.json();
};

export const redirectToCheckout = async (amount: number) => {
  const { url } = await createCheckoutSession(amount);
  window.location.href = url;
};
