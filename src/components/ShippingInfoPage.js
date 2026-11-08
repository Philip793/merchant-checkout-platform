import React from "react";

const ShippingInfoPage = () => (
  <main className="min-h-screen bg-gray-50 py-16">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold text-burgundy-900 text-center mb-12">
        Shipping Information
      </h1>
      <div className="bg-white rounded-lg shadow-lg p-8 space-y-8 text-gray-700">
        <section>
          <h2 className="text-2xl font-semibold text-burgundy-800 mb-4">Shipping charges</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Australia: fixed shipping charge of <strong>AUD $10</strong> per order.</li>
            <li>United States: fixed shipping charge of <strong>USD $30</strong> per order,
              converted to AUD using the reference exchange rate displayed at checkout.</li>
          </ul>
          <p className="mt-4">Products and the final payment are priced in AUD. The checkout
            displays the shipping amount and total AUD charge before payment. Your card issuer
            may apply its own currency conversion or international transaction fees.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-burgundy-800 mb-4">Delivery destinations</h2>
          <p>Checkout currently supports delivery addresses in Australia and the United States.
            Shipping charges are based on the selected delivery country.</p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-burgundy-800 mb-4">Delivery and tracking</h2>
          <p>Dispatch and transit times vary by destination and carrier. Your order confirmation
            records the amount charged and your delivery address. Contact customer support if
            you need an update on an order.</p>
        </section>
      </div>
    </div>
  </main>
);

export default ShippingInfoPage;
