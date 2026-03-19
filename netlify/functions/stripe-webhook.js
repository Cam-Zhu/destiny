// netlify/functions/stripe-webhook.js
// Listens for Stripe payment confirmations and adds credits to the user's account.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (e) {
    console.error('Webhook signature verification failed:', e.message);
    return { statusCode: 400, body: `Webhook Error: ${e.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;

    if (session.payment_status !== 'paid') {
      return { statusCode: 200, body: 'Payment not complete' };
    }

    const email = session.metadata?.email;
    const creditsToAdd = parseInt(session.metadata?.credits_to_add || '10', 10);

    if (!email) {
      console.error('No email in session metadata');
      return { statusCode: 400, body: 'Missing email in metadata' };
    }

    // Fetch current credits
    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('id, credits_remaining')
      .eq('email', email)
      .single();

    if (fetchErr || !user) {
      console.error('User not found for email:', email);
      return { statusCode: 404, body: 'User not found' };
    }

    // Add credits
    const { error: updateErr } = await supabase
      .from('users')
      .update({ credits_remaining: user.credits_remaining + creditsToAdd })
      .eq('id', user.id);

    if (updateErr) {
      console.error('Failed to add credits:', updateErr);
      return { statusCode: 500, body: 'Failed to update credits' };
    }

    console.log(`Added ${creditsToAdd} credits to ${email}`);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
