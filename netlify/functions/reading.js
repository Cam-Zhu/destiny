// netlify/functions/reading.js
// Checks user credits, calls Anthropic API, decrements credit, returns reading.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { email, name, day, month, year, hour, chart } = body;

  if (!email || !name || !day || !month || !year || !chart) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const normalised = email.toLowerCase().trim();

  // Fetch user and check credits
  const { data: user, error: fetchErr } = await supabase
    .from('users')
    .select('id, credits_remaining')
    .eq('email', normalised)
    .single();

  if (fetchErr || !user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'User not found' }) };
  }

  if (user.credits_remaining <= 0) {
    return { statusCode: 402, body: JSON.stringify({ error: 'No credits remaining' }) };
  }

  // Build prompt
  const pillarsText = `
Year Pillar:  ${chart.year.stem}${chart.year.branch} (${chart.year.element} ${chart.year.animal})
Month Pillar: ${chart.month.branch} (${chart.month.animal})
Day Pillar:   ${chart.day.stem}${chart.day.branch} (${chart.day.element}, ${chart.day.polarity})
Hour Pillar:  ${chart.hour ? `${chart.hour.branch} (${chart.hour.animal})` : 'Not provided'}`.trim();

  const prompt = `You are a master Chinese astrologer steeped in the tradition of the Four Pillars (Bāzì). Write a rich, poetic, personal astrology reading for ${name}, born ${day}/${month}/${year}${hour !== null && hour !== undefined ? ` at hour ${hour}` : ''}.

Their Bāzì chart:
${pillarsText}

Write in a flowing, slightly mystical but grounded style — as if an ancient scholar is speaking directly to ${name}. Do NOT use markdown, headers, or bullet points. Write exactly 4 paragraphs of prose only:

1. Their birth sign character and destiny (${chart.year.element} ${chart.year.animal})
2. Their inner nature, emotional world, and relationships (Day Pillar: ${chart.day.element} energy)
3. Their gifts, challenges, and life path themes
4. A closing blessing or fortune for the year ahead

Keep it personal to ${name}. Around 280 words total. No lists, no headers, pure flowing prose.`;

  // Call Anthropic
  let reading;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic error:', data);
      return { statusCode: 500, body: JSON.stringify({ error: 'Reading generation failed' }) };
    }

    reading = data.content?.find(b => b.type === 'text')?.text || '';
  } catch (e) {
    console.error('Anthropic fetch error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Reading generation failed' }) };
  }

  // Decrement credit atomically
  const { data: updated, error: updateErr } = await supabase
    .from('users')
    .update({ credits_remaining: user.credits_remaining - 1 })
    .eq('id', user.id)
    .eq('credits_remaining', user.credits_remaining) // optimistic lock
    .select('credits_remaining')
    .single();

  if (updateErr || !updated) {
    // Credit decrement failed — still return the reading but log it
    console.error('Credit decrement failed:', updateErr);
    return {
      statusCode: 200,
      body: JSON.stringify({ reading, credits_remaining: user.credits_remaining - 1 })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ reading, credits_remaining: updated.credits_remaining })
  };
};
