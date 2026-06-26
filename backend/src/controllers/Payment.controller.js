'use strict';

const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const Booth = require('../models/Booth');
const Session = require('../models/Session');
const Expo = require('../models/Expo');
const Notification = require('../models/Notification');
const PaymentService = require('../services/payment.service');

// ─── Initialize Payment Service ─────────────────────────────────────────────
const resolveMockMode = () => {
  if (process.env.MOCK_PAYMENTS === 'false') return false;
  if (process.env.MOCK_PAYMENTS === 'true') return true;
  return process.env.NODE_ENV !== 'production';
};

const paymentService = new PaymentService({
  mockMode: resolveMockMode(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const createError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const handleValidationErrors = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    const err = new Error(messages[0]);
    err.statusCode = 422;
    err.errors = messages;
    throw err;
  }
};

// ─── Controllers ──────────────────────────────────────────────────────────────

// ── Create a payment transaction for booth reservation ────────────────────
const createBoothPayment = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { boothId, paymentMethod = 'mock' } = req.body;
    const userId = req.user._id;

    const booth = await Booth.findById(boothId).populate('expoId', 'title boothPrice boothCurrency');
    if (!booth) {
      return next(createError(404, 'Booth not found.'));
    }

    // ── CLEAN UP: null out invoiceNumber on any cancelled transactions
    // for this booth+user so the unique index can't block new ones
    await Transaction.updateMany(
      {
        userId,
        referenceId: boothId,
        type: 'booth_reservation',
        status: 'cancelled',
        invoiceNumber: { $ne: null },
      },
      { $set: { invoiceNumber: null } }
    );

    // Already fully assigned to this user
    if (booth.status === 'assigned' && booth.assignedTo?.toString() === userId.toString()) {
      return res.status(200).json({
        success: true,
        message: 'You already have this booth assigned!',
        data: { booth, alreadyAssigned: true },
      });
    }

    const price = booth.displayPrice || booth.expoId.boothPrice || 0;
    const currency = booth.displayCurrency || booth.expoId.boothCurrency || 'USD';

    // Pending for this user — resume existing transaction
    if (booth.status === 'pending' && booth.assignedTo?.toString() === userId.toString()) {
      let existingPending = await Transaction.findOne({
        userId,
        referenceId: boothId,
        type: 'booth_reservation',
        status: 'pending',
        expiresAt: { $gt: new Date() },
      });

      if (!existingPending) {
        existingPending = await Transaction.createPending({
          userId,
          type: 'booth_reservation',
          referenceId: boothId,
          referenceModel: 'Booth',
          expoId: booth.expoId._id,
          amount: price,
          currency,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'You already have a pending reservation for this booth.',
        data: {
          transaction: existingPending,
          booth,
          requiresPayment: true,
          isFree: price === 0,
          expiresAt: existingPending.expiresAt,
          amount: existingPending.amount,
          currency: existingPending.currency,
        },
      });
    }

    // Check if booth can be reserved
    const canReserve = booth.canReserve(userId);
    if (!canReserve.allowed) {
      return next(createError(400, canReserve.reason));
    }

    // Check for an existing unexpired pending transaction (safety net)
    const existingPending = await Transaction.findOne({
      userId,
      referenceId: boothId,
      type: 'booth_reservation',
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    if (existingPending) {
      return res.status(200).json({
        success: true,
        message: 'You already have a pending reservation for this booth.',
        data: {
          transaction: existingPending,
          booth,
          requiresPayment: true,
          isFree: existingPending.amount === 0,
          expiresAt: existingPending.expiresAt,
          amount: existingPending.amount,
          currency: existingPending.currency,
        },
      });
    }

    await booth.reserve(userId, 15);

    const transaction = await Transaction.createPending({
      userId,
      type: 'booth_reservation',
      referenceId: boothId,
      referenceModel: 'Booth',
      expoId: booth.expoId._id,
      amount: price,
      currency,
    });

    const paymentIntent = await paymentService.createPaymentIntent({
      transactionId: transaction._id,
      amount: price,
      currency,
      userId: userId.toString(),
      metadata: {
        boothId: boothId.toString(),
        boothNumber: booth.boothNumber,
        expoTitle: booth.expoId.title,
        isFree: price === 0,
      },
    });

    await paymentService.sendNotification({
      recipient: userId,
      type: 'booth_reserved',
      title: '📋 Booth Reserved - Action Required',
      body: price > 0
        ? `You've reserved ${booth.boothNumber}. Complete payment within 15 minutes to confirm.`
        : `You've reserved ${booth.boothNumber}. Confirm your free reservation.`,
      link: `/exhibitor/expos/${booth.expoId._id}/floor-plan`,
      referenceId: boothId,
      referenceModel: 'Booth',
    });

    return res.status(201).json({
      success: true,
      message: price === 0
        ? 'Please confirm your free booth reservation.'
        : 'Please complete the payment to confirm your reservation.',
      data: {
        transaction,
        booth,
        paymentIntent,
        requiresPayment: true,
        isFree: price === 0,
        expiresAt: transaction.expiresAt,
        amount: price,
        currency,
      },
    });

  } catch (err) {
    return next(err);
  }
};

// ── Create a payment transaction for session registration ──────────────────
const createSessionPayment = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { sessionId, paymentMethod = 'mock' } = req.body;
    const userId = req.user._id;

    // Validate session
    const session = await Session.findById(sessionId);
    if (!session) {
      return next(createError(404, 'Session not found.'));
    }

    // Check if user is already registered
    const alreadyRegistered = session.attendees.some(
      (a) => a.userId.toString() === userId.toString()
    );
    if (alreadyRegistered) {
      return next(createError(400, 'You are already registered for this session.'));
    }

    // Check capacity
    if (session.maxCapacity && session.attendees.length >= session.maxCapacity) {
      return next(createError(400, 'Session is at maximum capacity.'));
    }

    // Check if user already has a pending transaction for this session
    const existingPending = await Transaction.findOne({
      userId,
      referenceId: sessionId,
      type: 'session_registration',
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });

    if (existingPending) {
      return res.status(200).json({
        success: true,
        message: 'You already have a pending registration for this session.',
        data: {
          transaction: existingPending,
          requiresPayment: existingPending.amount > 0,
          isFree: existingPending.amount === 0,
          expiresAt: existingPending.expiresAt,
          amount: existingPending.amount,
          currency: existingPending.currency,
        },
      });
    }

    // Get price from session
    const price = session.price || 0;
    const currency = session.currency || 'USD';

    // Create transaction
    const transaction = await Transaction.createPending({
      userId,
      type: 'session_registration',
      referenceId: sessionId,
      referenceModel: 'Session',
      expoId: session.expoId,
      amount: price,
      currency,
    });

    // Create payment intent if not on-site
    let paymentIntent = null;
    if (paymentMethod !== 'on_site' && price > 0) {
      paymentIntent = await paymentService.createPaymentIntent({
        transactionId: transaction._id,
        amount: price,
        currency,
        userId: userId.toString(),
        metadata: {
          sessionId: sessionId.toString(),
          sessionTitle: session.title,
        },
      });
    }

    // Send notification
    await paymentService.sendNotification({
      recipient: userId,
      type: 'session_registered',
      title: '📋 Session Registration - Action Required',
      body: price > 0
        ? `You've registered for "${session.title}". Complete payment within 15 minutes to confirm.`
        : `You've registered for "${session.title}". No payment required.`,
      link: `/attendee/sessions`,
      referenceId: sessionId,
      referenceModel: 'Session',
    });

    // If free, auto-confirm
    if (price === 0) {
      await transaction.markAsPaid('mock', 'free');
      await paymentService.handlePaymentSuccess(transaction);
      
      return res.status(201).json({
        success: true,
        message: 'Registered successfully! 🎉',
        data: {
          transaction,
          requiresPayment: false,
          isFree: true,
          expiresAt: transaction.expiresAt,
          amount: price,
          currency,
        },
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Payment required to complete registration.',
      data: {
        transaction,
        paymentIntent,
        requiresPayment: price > 0 && paymentMethod !== 'on_site',
        isFree: price === 0,
        expiresAt: transaction.expiresAt,
        amount: price,
        currency,
      },
    });

  } catch (err) {
    return next(err);
  }
};

// ── Confirm payment (after user completes payment) ──────────────────────────
const confirmPayment = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { transactionId, paymentId } = req.body;
    const userId = req.user._id;

    // Validate transaction
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return next(createError(404, 'Transaction not found.'));
    }

    // Check ownership
    if (transaction.userId.toString() !== userId.toString()) {
      return next(createError(403, 'You do not have permission to confirm this payment.'));
    }

    if (transaction.status !== 'pending') {
      return next(createError(400, `Transaction is already ${transaction.status}.`));
    }

    if (transaction.expiresAt && new Date() > new Date(transaction.expiresAt)) {
      await transaction.cancel('Payment window expired');
      return next(createError(400, 'Transaction has expired. Please start again.'));
    }

    // ✅ Check if it's a free transaction
    if (transaction.amount === 0 || paymentId.startsWith('free_')) {
      await transaction.markAsPaid('mock', paymentId);
      await paymentService.handlePaymentSuccess(transaction);
      
      return res.status(200).json({
        success: true,
        message: 'Reservation confirmed successfully! 🎉',
        data: transaction,
      });
    }

    // Confirm payment for paid transactions
    const confirmed = await paymentService.confirmPayment(paymentId, transactionId);

    return res.status(200).json({
      success: true,
      message: 'Payment confirmed successfully! 🎉',
      data: confirmed,
    });

  } catch (err) {
    return next(err);
  }
};

// ── Cancel a transaction ─────────────────────────────────────────────────────
const cancelTransaction = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user._id;
    const { reason } = req.body;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return next(createError(404, 'Transaction not found.'));
    }

    // Check ownership (or admin)
    const isOwner = transaction.userId.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return next(createError(403, 'You do not have permission to cancel this transaction.'));
    }

    await transaction.cancel(reason || 'Cancelled by user');

    // Release the booth if it was a booth reservation
    if (transaction.type === 'booth_reservation') {
      const booth = await Booth.findById(transaction.referenceId);
      if (booth) {
        await booth.cancelReservation(userId, reason || 'Reservation cancelled by user');
      }
    }

    // Send notification
    await paymentService.sendNotification({
      recipient: userId,
      type: 'payment_reminder',
      title: '❌ Reservation Cancelled',
      body: `Your ${transaction.type === 'booth_reservation' ? 'booth' : 'session'} reservation has been cancelled.`,
      link: `/${transaction.type === 'booth_reservation' ? 'exhibitor' : 'attendee'}/dashboard`,
      referenceId: transaction.referenceId,
      referenceModel: transaction.referenceModel,
    });

    return res.status(200).json({
      success: true,
      message: 'Transaction cancelled successfully.',
      data: transaction,
    });

  } catch (err) {
    return next(err);
  }
};

// ── Get user's transaction history ──────────────────────────────────────────
const getTransactionHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, status } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    const query = { userId };
    if (status) query.status = status;

    const transactions = await Transaction.find(query)
      .populate('referenceId', 'title boothNumber')
      .populate('expoId', 'title')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const total = await Transaction.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });

  } catch (err) {
    return next(err);
  }
};

// ── Get a single transaction ─────────────────────────────────────────────────
const getTransaction = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const userId = req.user._id;

    const transaction = await Transaction.findById(transactionId)
      .populate('referenceId', 'title boothNumber description')
      .populate('expoId', 'title')
      .populate('userId', 'name email avatar');

    if (!transaction) {
      return next(createError(404, 'Transaction not found.'));
    }

    // Check ownership (or admin)
    const isOwner = transaction.userId._id.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return next(createError(403, 'You do not have permission to view this transaction.'));
    }

    return res.status(200).json({
      success: true,
      data: transaction,
    });

  } catch (err) {
    return next(err);
  }
};

// ── Admin: Get all transactions ──────────────────────────────────────────────
const getAllTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, type, expoId } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (expoId) query.expoId = expoId;

    const transactions = await Transaction.find(query)
      .populate('userId', 'name email avatar')
      .populate('expoId', 'title')
      .populate('referenceId', 'title boothNumber')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const total = await Transaction.countDocuments(query);

    // Get stats
    const stats = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0],
            },
          },
          pendingCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, 1, 0],
            },
          },
          paidCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'paid'] }, 1, 0],
            },
          },
          failedCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'failed'] }, 1, 0],
            },
          },
          cancelledCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0],
            },
          },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        stats: stats[0] || {
          totalAmount: 0,
          paidAmount: 0,
          pendingCount: 0,
          paidCount: 0,
          failedCount: 0,
          cancelledCount: 0,
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });

  } catch (err) {
    return next(err);
  }
};

// ── Admin: Confirm on-site payment ───────────────────────────────────────────
const confirmOnSitePayment = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const adminId = req.user._id;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return next(createError(404, 'Transaction not found.'));
    }

    if (transaction.paymentMethod !== 'on_site') {
      return next(createError(400, 'Transaction is not an on-site payment.'));
    }

    if (transaction.status !== 'paid') {
      return next(createError(400, `Transaction status is ${transaction.status}, not paid.`));
    }

    // Confirm on-site payment
    const confirmed = await paymentService.confirmOnSitePayment(transactionId, adminId);

    return res.status(200).json({
      success: true,
      message: 'On-site payment confirmed successfully! 🎉',
      data: confirmed,
    });

  } catch (err) {
    return next(err);
  }
};

// ── Webhook handler for Stripe ──────────────────────────────────────────────
const handleWebhook = async (req, res, next) => {
  try {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      // In development, just log and return
      console.warn('[Payment] Stripe webhook secret not configured. Skipping webhook.');
      return res.status(200).json({ received: true });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    console.log(`[Payment] Webhook event: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const transactionId = paymentIntent.metadata.transactionId;
        if (transactionId) {
          await paymentService.confirmPayment(paymentIntent.id, transactionId);
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const transactionId = paymentIntent.metadata.transactionId;
        if (transactionId) {
          const transaction = await Transaction.findById(transactionId);
          if (transaction) {
            await transaction.markAsFailed(paymentIntent.last_payment_error?.message || 'Payment failed');
          }
        }
        break;
      }
      default:
        console.log(`[Payment] Unhandled webhook event: ${event.type}`);
    }

    res.status(200).json({ received: true });

  } catch (err) {
    console.error('[Payment] Webhook error:', err);
    return res.status(400).json({ error: err.message });
  }
};

// ─── Export ──────────────────────────────────────────────────────────────────
module.exports = {
  createBoothPayment,
  createSessionPayment,
  confirmPayment,
  cancelTransaction,
  getTransactionHistory,
  getTransaction,
  getAllTransactions,
  confirmOnSitePayment,
  handleWebhook,
};