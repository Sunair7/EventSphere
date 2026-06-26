'use strict';

const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const Booth = require('../models/Booth');
const Session = require('../models/Session');
const User = require('../models/User');
const ExhibitorProfile = require('../models/Exhibitorprofile');

// ─── Payment Service ──────────────────────────────────────────────────────────

class PaymentService {
  constructor(config = {}) {
    this.mockMode = config.mockMode !== undefined ? config.mockMode : process.env.NODE_ENV === 'development';
    this.stripeSecret = config.stripeSecret || process.env.STRIPE_SECRET_KEY;
    this.stripePublic = config.stripePublic || process.env.STRIPE_PUBLISHABLE_KEY;
  }

  // ── Get the IO instance ───────────────────────────────────────────────────
  get io() {
    // This is set by the app during initialization
    return global._io;
  }

  // ── Create a payment intent ──────────────────────────────────────────────
  async createPaymentIntent({ transactionId, amount, currency, userId, metadata = {} }) {
    // For mock mode - just return a fake client secret
    if (this.mockMode) {
      return {
        clientSecret: `mock_${crypto.randomBytes(16).toString('hex')}`,
        paymentId: `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        mockMode: true,
        amount,
        currency,
      };
    }

    // Real Stripe implementation
    try {
      const stripe = require('stripe')(this.stripeSecret);
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: currency.toLowerCase(),
        metadata: {
          transactionId: transactionId.toString(),
          userId: userId.toString(),
          ...metadata,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentId: paymentIntent.id,
        mockMode: false,
        amount,
        currency,
      };
    } catch (error) {
      console.error('[PaymentService] Stripe error:', error);
      throw new Error('Payment processing failed. Please try again.');
    }
  }

  // ── Confirm payment (webhook or direct) ──────────────────────────────────
  async confirmPayment(paymentId, transactionId) {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found.');
    }

    if (transaction.status !== 'pending') {
      throw new Error(`Transaction is already ${transaction.status}.`);
    }

    // In mock mode, always succeed
    if (this.mockMode) {
      await transaction.markAsPaid('mock', paymentId);
      await this.handlePaymentSuccess(transaction);
      return transaction;
    }

    // Real Stripe verification
    try {
      const stripe = require('stripe')(this.stripeSecret);
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);

      if (paymentIntent.status === 'succeeded') {
        await transaction.markAsPaid('stripe', paymentId);
        await this.handlePaymentSuccess(transaction);
        return transaction;
      }

      if (paymentIntent.status === 'requires_payment_method') {
        throw new Error('Payment requires a valid payment method.');
      }

      throw new Error(`Payment failed. Status: ${paymentIntent.status}`);
    } catch (error) {
      console.error('[PaymentService] Confirm error:', error);
      await transaction.markAsFailed(error.message || 'Payment processing failed.');
      throw error;
    }
  }

  // ── Handle "Pay at Venue" selection ──────────────────────────────────────
  async markOnSitePayment(transactionId, userId) {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found.');
    }

    if (transaction.status !== 'pending') {
      throw new Error(`Transaction is already ${transaction.status}.`);
    }

    if (transaction.userId.toString() !== userId.toString()) {
      throw new Error('You do not have permission to update this transaction.');
    }

    // For on-site, we mark as paid immediately (or you could keep it pending)
    await transaction.markAsPaid('on_site', null);

    // But we don't auto-confirm the booth/session - admin needs to verify on-site
    // So we skip handlePaymentSuccess for on-site payments

    // Send notification
    await this.sendNotification({
      recipient: userId,
      type: 'payment_pending',
      title: '🏢 Pay at Venue - Reservation Confirmed',
      body: `Your ${transaction.type === 'booth_reservation' ? 'booth' : 'session'} has been reserved. Please complete payment at the venue registration desk.`,
      link: `/${transaction.type === 'booth_reservation' ? 'exhibitor' : 'attendee'}/dashboard`,
      referenceId: transaction.referenceId,
      referenceModel: transaction.referenceModel,
    });

    return transaction;
  }

  // ── Admin: Confirm on-site payment ──────────────────────────────────────
  async confirmOnSitePayment(transactionId, adminId) {
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      throw new Error('Transaction not found.');
    }

    if (transaction.paymentMethod !== 'on_site') {
      throw new Error('Transaction is not an on-site payment.');
    }

    if (transaction.status !== 'paid') {
      throw new Error(`Transaction status is ${transaction.status}, not paid.`);
    }

    // Now confirm the booth/session
    transaction.paidBy = adminId;
    await transaction.save();
    await this.handlePaymentSuccess(transaction);

    return transaction;
  }

  // ─── Handle successful payment ─────────────────────────────────────────────
async handlePaymentSuccess(transaction) {
  const { type, referenceId, userId, amount, expoId } = transaction;

  // Update the referenced item
  if (type === 'booth_reservation') {
    const booth = await Booth.findById(referenceId);
    if (booth) {
      booth.status = 'assigned';
      booth.assignedTo = userId;
      booth.assignedAt = new Date();
      booth.reservationExpiresAt = null;
      booth.reservationLocked = false;
      await booth.save();
      
      // ✅ UPDATE EXHIBITOR PROFILE
      const profile = await ExhibitorProfile.findOne({ userId });
      if (profile) {
        // Check if already assigned
        const alreadyAssigned = profile.assignedBooths.some(
          (ab) => ab.boothId?.toString() === booth._id.toString()
        );
        
        if (!alreadyAssigned) {
          profile.assignedBooths.push({
            boothId: booth._id,
            expoId: booth.expoId,
            assignedBy: userId,
            assignedAt: new Date(),
          });
          await profile.save();
          console.log(`✅ Added booth ${booth.boothNumber} to exhibitor profile`);
        }
      }
    }
  } else if (type === 'session_registration') {
    const session = await Session.findById(referenceId);
    if (session) {
      const alreadyRegistered = session.attendees.some(
        (a) => a.userId.toString() === userId.toString()
      );
      if (!alreadyRegistered) {
        session.attendees.push({ userId });
        await session.save();
      }
    }
  }

    // ── Send notifications ──────────────────────────────────────────────────
    const io = this.io;

    // Get the user
    const user = await User.findById(userId);

    // Get the item details
    let itemName = '';
    let itemType = '';
    if (type === 'booth_reservation') {
      const booth = await Booth.findById(referenceId).populate('expoId', 'title');
      itemName = `Booth ${booth.boothNumber}`;
      itemType = 'booth';
    } else if (type === 'session_registration') {
      const session = await Session.findById(referenceId);
      itemName = session.title;
      itemType = 'session';
    }

    // 1. Payment success notification
    await Notification.createAndEmit(io, {
      recipient: userId,
      type: 'payment_success',
      title: `Payment Successful! 🎉`,
      body: `Your payment of $${(amount / 100).toFixed(2)} for ${itemName} was successful.`,
      link: type === 'booth_reservation'
        ? `/exhibitor/expos/${expoId}/floor-plan`
        : `/attendee/sessions`,
      referenceId: referenceId,
      referenceModel: type === 'booth_reservation' ? 'Booth' : 'Session',
    });

    // 2. Confirmation notification (specific to the item)
    if (type === 'booth_reservation') {
      await Notification.createAndEmit(io, {
        recipient: userId,
        type: 'booth_confirmed',
        title: `✅ Booth Confirmed!`,
        body: `Your booth reservation for ${itemName} is now confirmed.`,
        link: `/exhibitor/expos/${expoId}/floor-plan`,
        referenceId: referenceId,
        referenceModel: 'Booth',
      });
    } else {
      await Notification.createAndEmit(io, {
        recipient: userId,
        type: 'session_confirmed',
        title: `✅ Session Confirmed!`,
        body: `Your registration for "${itemName}" is now confirmed.`,
        link: `/attendee/sessions`,
        referenceId: referenceId,
        referenceModel: 'Session',
      });
    }

    // 3. Admin notification - get admin users
    const adminUsers = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
    for (const admin of adminUsers) {
      await Notification.createAndEmit(io, {
        recipient: admin._id,
        type: 'system',
        title: `💰 Payment Received`,
        body: `Payment of $${(amount / 100).toFixed(2)} received from ${user.name} for ${itemName}. Invoice: ${transaction.invoiceNumber}`,
        link: `/admin/transactions/${transaction._id}`,
        referenceId: transaction._id,
        referenceModel: null,
      });
    }
  }

  // ── Send a notification ──────────────────────────────────────────────────
  async sendNotification({ recipient, type, title, body, link, referenceId, referenceModel }) {
    const io = this.io;
    await Notification.createAndEmit(io, {
      recipient,
      type,
      title,
      body,
      link,
      referenceId,
      referenceModel,
    });
  }

  // ── Handle expired transactions (called by cron job) ────────────────────
  async handleExpiredTransactions() {
    const expired = await Transaction.find({
      status: 'pending',
      expiresAt: { $lt: new Date() },
    });

    for (const transaction of expired) {
      await transaction.cancel('Payment not completed within 15 minutes');

      // Send notification to user
      await this.sendNotification({
        recipient: transaction.userId,
        type: 'payment_reminder',
        title: '⏰ Reservation Expired',
        body: `Your reservation for ${transaction.type === 'booth_reservation' ? 'booth' : 'session'} has expired. Please try again if you're still interested.`,
        link: `/${transaction.type === 'booth_reservation' ? 'exhibitor' : 'attendee'}/dashboard`,
        referenceId: transaction.referenceId,
        referenceModel: transaction.referenceModel,
      });

      // Release the booth if it was a booth reservation
      if (transaction.type === 'booth_reservation') {
        const booth = await Booth.findById(transaction.referenceId);
        if (booth && booth.status === 'pending') {
          booth.status = 'available';
          booth.assignedTo = null;
          booth.assignedAt = null;
          booth.reservationLocked = false;
          booth.reservationExpiresAt = null;
          booth.lockedBy = null;
          await booth.save();
        }
      }
    }

    return expired.length;
  }
}

module.exports = PaymentService;