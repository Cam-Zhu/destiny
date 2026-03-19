// netlify/functions/auth.js
// Gets or creates a user in Supabase. Returns their credit balance.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const FREE_CREDITS = 3;

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

  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email address' }) };
  }

  const normalised = email.toLowerCase().trim();

  // Try to find existing user
  const { data: existing, error: fetchErr } = await supabase
    .from('users')
    .select('id, credits_remaining')
    .eq('email', normalised)
    .single();

  if (fetchErr && fetchErr.code !== 'PGRST116') {
    // PGRST116 = row not found — that's fine, we'll create them
    console.error('Supabase fetch error:', fetchErr);
    return { statusCode: 500, body: JSON.stringify({ error: 'Database error' }) };
  }

  if (existing) {
    return {
      statusCode: 200,
      body: JSON.stringify({ credits_remaining: existing.credits_remaining })
    };
  }

  // Create new user with free credits
  const { data: created, error: insertErr } = await supabase
    .from('users')
    .insert({ email: normalised, credits_remaining: FREE_CREDITS })
    .select('credits_remaining')
    .single();

  if (insertErr) {
    console.error('Supabase insert error:', insertErr);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not create user' }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ credits_remaining: created.credits_remaining })
  };
};
