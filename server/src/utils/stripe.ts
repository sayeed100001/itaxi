import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export const hasUsableStripeKey = () => {
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!key) return false;
  if (!key.startsWith('sk_')) return false;
  if (key.includes('your_stripe_secret_key_here')) return false;
  return true;
};

export const getStripeClient = () => {
  if (!hasUsableStripeKey()) {
    throw new Error('Stripe is not configured with a valid secret key');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2026-01-28.clover' });
  }

  return stripeClient;
};
