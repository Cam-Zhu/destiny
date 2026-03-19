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

  const { email, name, day, month, year, hour, focus, question, chart } = body;

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

  // Current Chinese year context
  const currentYear = new Date().getFullYear();
  const chineseYearAnimals = ['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'];
  const chineseYearElements = ['Wood','Wood','Fire','Fire','Earth','Earth','Metal','Metal','Water','Water'];
  const yearAnimal = chineseYearAnimals[((currentYear - 4) % 12 + 12) % 12];
  const yearElement = chineseYearElements[((currentYear - 4) % 10 + 10) % 10];
  const currentChineseYear = yearElement + ' ' + yearAnimal;

  const pillarsText = [
    'Year Pillar:  ' + chart.year.stem + chart.year.branch + ' (' + chart.year.element + ' ' + chart.year.animal + ')',
    'Month Pillar: ' + chart.month.branch + ' (' + chart.month.animal + ')',
    'Day Pillar:   ' + chart.day.stem + chart.day.branch + ' (' + chart.day.element + ', ' + chart.day.polarity + ')',
    'Hour Pillar:  ' + (chart.hour ? chart.hour.branch + ' (' + chart.hour.animal + ')' : 'Not provided')
  ].join('\n');

  const focusArea = focus || 'General Destiny';
  const questionLine = question ? '\nThe seeker asks: "' + question + '"' : '';

  const prompt = 'You are a master Chinese astrologer steeped in the tradition of the Four Pillars (Bazi). Write a rich, poetic, personal astrology reading for ' + name + ', born ' + day + '/' + month + '/' + year + (hour !== null && hour !== undefined ? ' at hour ' + hour : '') + '.\n\n' +
    'Their Bazi chart:\n' + pillarsText + '\n\n' +
    'Focus area for this reading: ' + focusArea + questionLine + '\n' +
    'Current Chinese year: ' + currentChineseYear + ' (' + currentYear + ')\n\n' +
    'Write in a flowing, slightly mystical but grounded style, as if an ancient scholar is speaking directly to ' + name + '. Do NOT use markdown, headers, or bullet points. Write exactly 4 paragraphs of prose only:\n\n' +
    '1. Their birth sign character and destiny (' + chart.year.element + ' ' + chart.year.animal + '), woven with the theme of ' + focusArea + '\n' +
    '2. Their inner nature and how it shapes their approach to ' + focusArea + ' (Day Pillar: ' + chart.day.element + ' energy)\n' +
    '3. What the current ' + currentChineseYear + ' year brings for them specifically around ' + focusArea + (question ? ' and address their question: "' + question + '"' : '') + '\n' +
    '4. A closing blessing or fortune for the year ahead\n\n' +
    'Keep it deeply personal to ' + name + '. Around 300 words total. No lists, no headers, pure flowing prose.';

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

    reading = data.content && data.content.find(function(b) { return b.type === 'text'; });
    reading = reading ? reading.text : '';
  } catch (e) {
    console.error('Anthropic fetch error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Reading generation failed' }) };
  }

  // Decrement credit atomically
  const { data: updated, error: updateErr } = await supabase
    .from('users')
    .update({ credits_remaining: user.credits_remaining - 1 })
    .eq('id', user.id)
    .eq('credits_remaining', user.credits_remaining)
    .select('credits_remaining')
    .single();

  if (updateErr || !updated) {
    console.error('Credit decrement failed:', updateErr);
    return {
      statusCode: 200,
      body: JSON.stringify({ reading: reading, credits_remaining: user.credits_remaining - 1 })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ reading: reading, credits_remaining: updated.credits_remaining })
  };
};
