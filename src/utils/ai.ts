import OpenAI from 'openai';
import dotenv from 'dotenv';
import pool from '../db/pool';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function analyzeGroupSentiment(
  groupId: number,
  date: string
): Promise<string> {
  try {
    const messages = await pool.query(
      `SELECT messages_count, active_users, new_members, left_members
       FROM analytics
       WHERE group_id = $1 AND date = $2`,
      [groupId, date]
    );

    if (messages.rows.length === 0) {
      return 'No data available.';
    }

    const data = messages.rows[0];

    const prompt = `Analyze this Telegram group data for ${date}:
- Messages: ${data.messages_count}
- Active users: ${data.active_users}
- New members: ${data.new_members}
- Left members: ${data.left_members}

Provide a brief insight (max 2 sentences) about community health and one actionable tip.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 150
    });

    const insight =
      response.choices[0]?.message?.content || 'Analysis unavailable.';

    await pool.query(
      `INSERT INTO ai_insights
       (group_id, date, insight_type, insight_text, confidence)
       VALUES ($1, $2, 'sentiment', $3, 0.85)`,
      [groupId, date, insight]
    );

    return insight;
  } catch (err) {
    console.error('AI analysis error:', err);
    return 'AI analysis temporarily unavailable.';
  }
}

export async function generateGrowthTips(
  groupId: number
): Promise<string[]> {
  try {
    const avg = await pool.query(
      `SELECT
         AVG(messages_count) AS avg_msg,
         AVG(active_users) AS avg_users
       FROM analytics
       WHERE group_id = $1
         AND date >= CURRENT_DATE - INTERVAL '7 days'`,
      [groupId]
    );

    const prompt = `Based on a Telegram group with ${
      avg.rows[0]?.avg_msg || 0
    } avg daily messages and ${
      avg.rows[0]?.avg_users || 0
    } avg active users, give 3 specific growth tips. Each tip max 15 words. Return as JSON array.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: {
        type: 'json_object'
      },
      max_tokens: 200
    });

    const content =
      response.choices[0]?.message?.content || '{"tips":[]}';

    const parsed = JSON.parse(content);

    return parsed.tips || [
      'Post consistently',
      'Engage with polls',
      'Welcome new members'
    ];
  } catch (err) {
    console.error('AI tips error:', err);

    return [
      'Post consistently',
      'Engage with polls',
      'Welcome new members'
    ];
  }
}

export { openai };