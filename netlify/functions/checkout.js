// netlify/functions/checkout.js
// Creates a Stripe Checkout session for 10 readings at £2.99

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let email;
  try {
    ({ email } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const siteUrl = process.env.URL || 'http://localhost:8888';

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            unit_amount: 299, // £2.99 in pence
            product_data: {
              name: '10 Astrology Readings',
              description: 'Unlock 10 personalised Chinese astrology readings. Never expires.',
              images: [], // add your logo URL here if you have one
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        email: email.toLowerCase().trim(),
        credits_to_add: '10',
      },
      success_url: `${siteUrl}/?payment=success`,
      cancel_url:  `${siteUrl}/`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };
  } catch (e) {
    console.error('Stripe error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not create checkout session' }) };
  }
};
