import Stripe from 'stripe';
import { query } from '../db-config';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-01-27.acacia' as any })
  : null;

export class PaymentService {
  static async createPaymentIntent(amount: number, currency: string = 'usd'): Promise<{ clientSecret: string }> {
    if (!stripe) throw new Error('Stripe not configured');
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      automatic_payment_methods: { enabled: true },
    });

    return { clientSecret: paymentIntent.client_secret! };
  }

  static async processCardPayment(userId: string, amount: number, paymentMethodId: string): Promise<boolean> {
    if (!stripe) throw new Error('Stripe not configured');

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        payment_method: paymentMethodId,
        confirm: true,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      });

      if (paymentIntent.status === 'succeeded') {
        await query(
          `UPDATE users SET balance = balance + ? WHERE id = ?`,
          [amount, userId]
        );

        await query(
          `INSERT INTO transactions (id, user_id, amount, type, description, reference_id, created_at)
           VALUES (?, ?, ?, 'credit', 'Card Payment', ?, datetime('now'))`,
          [Date.now().toString(36), userId, amount, paymentIntent.id]
        );

        return true;
      }

      return false;
    } catch (error) {
      console.error('Payment failed:', error);
      return false;
    }
  }

  static async splitPayment(rideId: string, totalAmount: number, splits: { userId: string; amount: number }[]): Promise<boolean> {
    try {
      for (const split of splits) {
        await query(
          `UPDATE users SET balance = balance - ? WHERE id = ?`,
          [split.amount, split.userId]
        );

        await query(
          `INSERT INTO transactions (id, user_id, amount, type, description, reference_id, created_at)
           VALUES (?, ?, ?, 'debit', 'Split Payment', ?, datetime('now'))`,
          [Date.now().toString(36), split.userId, split.amount, rideId]
        );
      }

      return true;
    } catch (error) {
      console.error('Split payment failed:', error);
      return false;
    }
  }

  static async refund(transactionId: string, amount: number): Promise<boolean> {
    if (!stripe) throw new Error('Stripe not configured');

    try {
      const txResult = await query(
        `SELECT reference_id, user_id FROM transactions WHERE id = ?`,
        [transactionId]
      );

      if (txResult.rows.length === 0) return false;

      const { reference_id, user_id } = txResult.rows[0];

      if (reference_id && reference_id.startsWith('pi_')) {
        await stripe.refunds.create({
          payment_intent: reference_id,
          amount: Math.round(amount * 100),
        });
      }

      await query(
        `UPDATE users SET balance = balance + ? WHERE id = ?`,
        [amount, user_id]
      );

      await query(
        `INSERT INTO transactions (id, user_id, amount, type, description, created_at)
         VALUES (?, ?, ?, 'credit', 'Refund', datetime('now'))`,
        [Date.now().toString(36), user_id, amount]
      );

      return true;
    } catch (error) {
      console.error('Refund failed:', error);
      return false;
    }
  }
}
