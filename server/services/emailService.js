const RESEND_API_URL = "https://api.resend.com/emails";

const escapeHtml = (value) => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const formatMoney = (value, currency = "AUD") => {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
};

const buildAddressLines = (shippingAddress = {}) => {
  return [
    shippingAddress.fullName,
    shippingAddress.street,
    `${shippingAddress.city || ""} ${shippingAddress.state || ""} ${
      shippingAddress.zip || ""
    }`.trim(),
    shippingAddress.country,
  ].filter(Boolean);
};

const buildOrderConfirmationHtml = (order) => {
  const itemsHtml = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
            ${escapeHtml(item.name)} x ${item.quantity}
          </td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
            ${escapeHtml(formatMoney(item.price * item.quantity, order.currency))}
          </td>
        </tr>
      `,
    )
    .join("");

  const addressHtml = buildAddressLines(order.shippingAddress)
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h1 style="font-size: 24px; margin-bottom: 16px;">Order confirmed</h1>
      <p>Thanks for your order. We have received your payment and recorded your order.</p>

      <h2 style="font-size: 18px; margin-top: 24px;">Order ${escapeHtml(order.orderId)}</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tbody>${itemsHtml}</tbody>
      </table>

      <table style="width: 100%; margin-top: 16px;">
        <tbody>
          <tr>
            <td>Subtotal</td>
            <td style="text-align: right;">${escapeHtml(formatMoney(order.subtotal, order.currency))}</td>
          </tr>
          <tr>
            <td>Shipping</td>
            <td style="text-align: right;">${escapeHtml(formatMoney(order.shipping, order.currency))}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding-top: 8px;">Total charged</td>
            <td style="font-weight: bold; padding-top: 8px; text-align: right;">
              ${escapeHtml(formatMoney(order.total, order.currency))}
            </td>
          </tr>
        </tbody>
      </table>

      <h2 style="font-size: 18px; margin-top: 24px;">Shipping address</h2>
      <div>${addressHtml}</div>

      <p style="margin-top: 24px;">
        Prices are charged in AUD. If your card or bank account uses another currency,
        your bank or payment provider may use its own exchange rate and fees.
      </p>
      <p>We will prepare your order and send tracking details when available.</p>
    </div>
  `;
};

const buildOrderConfirmationText = (order) => {
  const itemLines = order.items
    .map(
      (item) =>
        `- ${item.name} x ${item.quantity}: ${formatMoney(
          item.price * item.quantity,
          order.currency,
        )}`,
    )
    .join("\n");

  const addressLines = buildAddressLines(order.shippingAddress).join("\n");

  return [
    "Order confirmed",
    "",
    "Thanks for your order. We have received your payment and recorded your order.",
    "",
    `Order ${order.orderId}`,
    itemLines,
    "",
    `Subtotal: ${formatMoney(order.subtotal, order.currency)}`,
    `Shipping: ${formatMoney(order.shipping, order.currency)}`,
    `Total charged: ${formatMoney(order.total, order.currency)}`,
    "",
    "Shipping address",
    addressLines,
    "",
    "Prices are charged in AUD. If your card or bank account uses another currency, your bank or payment provider may use its own exchange rate and fees.",
    "We will prepare your order and send tracking details when available.",
  ].join("\n");
};

export const sendOrderConfirmationEmail = async (order) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ORDER_EMAIL_FROM;
  const supportEmail = process.env.SUPPORT_EMAIL;
  const to = order.customer?.email;

  if (!to) {
    throw new Error("Order does not have a customer email address");
  }

  if (!apiKey || !from) {
    throw new Error("Order confirmation email is not configured");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `customer-${order.orderId}`,
    },
    body: JSON.stringify({
      from,
      to,
      reply_to: supportEmail || from,
      subject: `Order confirmation ${order.orderId}`,
      html: buildOrderConfirmationHtml(order),
      text: buildOrderConfirmationText(order),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Email provider rejected request: ${body}`);
  }

  return response.json();
};

export const sendOrderConfirmationEmailOnce = async (order) => {
  if (order.email?.confirmationSentAt) {
    return { skipped: true, reason: "already_sent" };
  }

  try {
    await sendOrderConfirmationEmail(order);
    order.email = {
      ...(order.email || {}),
      confirmationSentAt: new Date(),
      confirmationError: undefined,
    };
    await order.save();
    return { sent: true };
  } catch (error) {
    order.email = {
      ...(order.email || {}),
      confirmationError: error.message,
    };
    await order.save();
    console.error("Order confirmation email failed:", {
      orderId: order.orderId,
      error: error.message,
    });
    return { sent: false, error: error.message };
  }
};
export const sendMerchantOrderNotificationEmail = async (order) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ORDER_EMAIL_FROM;
  const merchantEmail = process.env.MERCHANT_ORDER_EMAIL || process.env.SUPPORT_EMAIL;

  if (!apiKey || !from) {
    throw new Error("Merchant order email is not configured");
  }

  if (!merchantEmail) {
    throw new Error("MERCHANT_ORDER_EMAIL or SUPPORT_EMAIL must be configured");
  }

  const itemsText = order.items
    .map(
      (item) =>
        `- ${item.name} x ${item.quantity}: ${formatMoney(
          item.price * item.quantity,
          order.currency,
        )}`,
    )
    .join("\n");

  const itemsHtml = order.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.quantity)}</td>
          <td>${escapeHtml(formatMoney(item.price, order.currency))}</td>
          <td>${escapeHtml(
            formatMoney(item.price * item.quantity, order.currency),
          )}</td>
        </tr>
      `,
    )
    .join("");

  const addressLines = buildAddressLines(order.shippingAddress);
  const addressText = addressLines.join("\n");
  const addressHtml = addressLines
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");

  const subject = `New order ${order.orderId} - ${formatMoney(
    order.total,
    order.currency,
  )}`;

  const text = [
    "New order received",
    "",
    `Order ID: ${order.orderId}`,
    `Customer name: ${order.customer?.name || "Not provided"}`,
    `Customer email: ${order.customer?.email || "Not provided"}`,
    `Phone: ${order.shippingAddress?.phone || "Not provided"}`,
    "",
    "Items",
    itemsText,
    "",
    `Subtotal: ${formatMoney(order.subtotal, order.currency)}`,
    `Shipping: ${formatMoney(order.shipping, order.currency)}`,
    `Total: ${formatMoney(order.total, order.currency)}`,
    "",
    `Payment provider: ${order.payment?.provider || "Unknown"}`,
    `Transaction ID: ${order.payment?.transactionId || "Unknown"}`,
    "",
    "Shipping address",
    addressText,
    "",
    "Action required: pack and fulfil this order.",
  ].join("\n");

  const html = `
    <h1>New order received</h1>

    <h2>Order ${escapeHtml(order.orderId)}</h2>

    <p><strong>Customer:</strong> ${escapeHtml(order.customer?.name || "Not provided")}</p>
    <p><strong>Email:</strong> ${escapeHtml(order.customer?.email || "Not provided")}</p>
    <p><strong>Phone:</strong> ${escapeHtml(order.shippingAddress?.phone || "Not provided")}</p>

    <h2>Items</h2>
    <table border="1" cellpadding="8" cellspacing="0">
      <thead>
        <tr>
          <th align="left">Item</th>
          <th align="left">Qty</th>
          <th align="left">Unit price</th>
          <th align="left">Line total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <h2>Totals</h2>
    <p><strong>Subtotal:</strong> ${escapeHtml(formatMoney(order.subtotal, order.currency))}</p>
    <p><strong>Shipping:</strong> ${escapeHtml(formatMoney(order.shipping, order.currency))}</p>
    <p><strong>Total:</strong> ${escapeHtml(formatMoney(order.total, order.currency))}</p>

    <h2>Payment</h2>
    <p><strong>Provider:</strong> ${escapeHtml(order.payment?.provider || "Unknown")}</p>
    <p><strong>Transaction ID:</strong> ${escapeHtml(order.payment?.transactionId || "Unknown")}</p>

    <h2>Shipping address</h2>
    ${addressHtml}

    <p><strong>Action required:</strong> pack and fulfil this order.</p>
  `;

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `merchant-${order.orderId}`,
    },
    body: JSON.stringify({
      from,
      to: merchantEmail,
      reply_to: order.customer?.email || process.env.SUPPORT_EMAIL || from,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Merchant email provider rejected request: ${body}`);
  }

  return response.json();
};

export const sendMerchantOrderNotificationEmailOnce = async (order) => {
  if (order.email?.merchantSentAt) return { skipped: true, reason: "already_sent" };
  try {
    await sendMerchantOrderNotificationEmail(order);
    order.email = {
      ...(order.email?.toObject?.() || order.email || {}),
      merchantSentAt: new Date(), merchantError: undefined,
    };
    await order.save();
    return { sent: true };
  } catch (error) {
    order.email = {
      ...(order.email?.toObject?.() || order.email || {}),
      merchantError: error.message,
    };
    await order.save();
    console.error("Merchant order notification failed:", { orderId: order.orderId, error: error.message });
    return { sent: false, error: error.message };
  }
};

export const sendPaymentReconciliationAlertOnce = async (pending, reason) => {
  if (pending.reconciliationAlertSentAt) return { skipped: true };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ORDER_EMAIL_FROM;
  const to = process.env.MERCHANT_ORDER_EMAIL || process.env.SUPPORT_EMAIL;
  if (!apiKey || !from || !to) throw new Error("Operational email is not configured");
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `reconcile-${pending._id}`,
    },
    body: JSON.stringify({
      from, to,
      subject: "Action required: payment reconciliation",
      text: `A checkout needs manual payment review.\nPending order ID: ${pending._id}\nProvider: ${pending.paymentProvider}\nReason: ${reason}\nDo not create another charge or release reserved stock until provider status is verified.`,
    }),
  });
  if (!response.ok) throw new Error("Operational notification was rejected by Resend");
  pending.reconciliationAlertSentAt = new Date();
  await pending.save();
  return { sent: true };
};
