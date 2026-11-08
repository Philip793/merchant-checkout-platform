// Isolated cleanup tests. No Stripe, Atlas, or email network calls.
// Run: node --test tests/stripeExpiryCleanup.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../server/controllers/stripeController.js', import.meta.url), 'utf8');
const start = source.indexOf('const releaseExpiredPendingOrders =');
const end = source.indexOf('/*\n * Convert a successful Stripe payment', start);
assert.ok(start >= 0 && end > start, 'Cleanup function not found');
const functionSource = source.slice(start, end);

function setup({ orders, statuses, cancellationStatus = 'canceled', throwOnRetrieve = false }) {
  const actions = [];
  const stripe = {
    paymentIntents: {
      async retrieve(id) {
        actions.push(`retrieve:${id}`);
        if (throwOnRetrieve) throw new Error('provider unavailable');
        return { id, status: statuses[id] };
      },
      async cancel(id) {
        actions.push(`cancel:${id}`);
        return { id, status: cancellationStatus };
      },
    },
  };
  const PendingOrder = {
    find(query) {
      assert.equal(query.inventoryReservationId.$exists, true);
      return {
        limit: async () => orders.filter(o => Boolean(o.inventoryReservationId)),
      };
    },
  };
  const context = {
    PendingOrder, stripe,
    console: { warn() {}, error() {} },
    async releasePendingInventory(order) {
      actions.push(`release:${order._id}`);
      order.inventoryStatus = 'released';
      return { success: true };
    },
    async finalizePendingOrder(order) {
      actions.push(`finalize:${order._id}`);
      order.status = 'paid';
      return { orderId: 'test-order' };
    },
    async sendOrderConfirmationEmailOnce() { actions.push('email'); },
  };
  const cleanup = vm.runInNewContext(`${functionSource}\nreleaseExpiredPendingOrders`, context);
  return { cleanup, actions };
}

function pending(id, reservationId = `reservation-${id}`) {
  return {
    _id: { toString: () => id },
    stripePaymentIntentId: `pi_${id}`,
    inventoryReservationId: reservationId,
    status: 'pending',
    inventoryStatus: 'reserved',
    async save() {},
  };
}

test('cancellable unpaid payment is cancelled BEFORE releasing stock', async () => {
  const order = pending('unpaid');
  const { cleanup, actions } = setup({ orders: [order], statuses: { pi_unpaid: 'requires_payment_method' } });
  await cleanup();
  assert.deepEqual(actions, ['retrieve:pi_unpaid', 'cancel:pi_unpaid', 'release:unpaid']);
  assert.equal(order.status, 'expired');
});

test('succeeded payment is finalized, never released', async () => {
  const order = pending('paid');
  const { cleanup, actions } = setup({ orders: [order], statuses: { pi_paid: 'succeeded' } });
  await cleanup();
  assert.deepEqual(actions, ['retrieve:pi_paid', 'finalize:paid', 'email']);
});

test('processing payment remains reserved', async () => {
  const order = pending('processing');
  const { cleanup, actions } = setup({ orders: [order], statuses: { pi_processing: 'processing' } });
  await cleanup();
  assert.deepEqual(actions, ['retrieve:pi_processing']);
  assert.equal(order.inventoryStatus, 'reserved');
});

test('legacy checkout without ID is ignored by automated cleanup', async () => {
  const order = pending('legacy', undefined);
  order.inventoryReservationId = undefined;
  const { cleanup, actions } = setup({ orders: [order], statuses: {} });
  await cleanup();
  assert.deepEqual(actions, []);
});

test('Stripe cancellation failure never releases stock', async () => {
  const order = pending('no-cancel');
  const { cleanup, actions } = setup({
    orders: [order], statuses: { 'pi_no-cancel': 'requires_payment_method' }, cancellationStatus: 'processing',
  });
  await cleanup();
  assert.deepEqual(actions, ['retrieve:pi_no-cancel', 'cancel:pi_no-cancel']);
  assert.equal(order.inventoryStatus, 'reserved');
});
