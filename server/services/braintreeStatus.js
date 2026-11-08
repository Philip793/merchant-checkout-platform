export const classifyBraintreeTransaction = (status) => {
  const normalized = String(status || "").toLowerCase().replaceAll("_", "");
  if (["submittedforsettlement", "settling", "settlementpending", "settled", "settlementconfirmed"].includes(normalized)) return "paid";
  if (["processordeclined", "gatewayrejected", "failed", "voided", "settlementdeclined", "authorizationexpired"].includes(normalized)) return "failed";
  return "uncertain";
};
