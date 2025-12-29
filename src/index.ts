/**
 * Main entry point for the multi-agent workflow system
 * Express.js backend server
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  webSearchAgent,
  comparisonAgent,
  recommendationAgent,
  newsletterAgent,
} from './agents/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Multi-agent workflow system is running' });
});

// Web Search Agent endpoint
app.post('/api/agents/web-search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    const result = await webSearchAgent(query);
    res.json(result);
  } catch (error) {
    console.error('Web search agent error:', error);
    res.status(500).json({ error: 'Failed to perform web search' });
  }
});

// Comparison Agent endpoint
app.post('/api/agents/comparison', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length < 2) {
      return res.status(400).json({ error: 'At least 2 items are required for comparison' });
    }
    const result = await comparisonAgent(items);
    res.json(result);
  } catch (error) {
    console.error('Comparison agent error:', error);
    res.status(500).json({ error: 'Failed to perform comparison' });
  }
});

// Recommendation Agent endpoint
app.post('/api/agents/recommendation', async (req, res) => {
  try {
    const { context, preferences } = req.body;
    if (!context) {
      return res.status(400).json({ error: 'Context is required' });
    }
    const result = await recommendationAgent(context, preferences);
    res.json(result);
  } catch (error) {
    console.error('Recommendation agent error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

// Newsletter Agent endpoint
app.post('/api/agents/newsletter', async (req, res) => {
  try {
    const { topics, style } = req.body;
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ error: 'At least one topic is required' });
    }
    const result = await newsletterAgent(topics, style);
    res.json(result);
  } catch (error) {
    console.error('Newsletter agent error:', error);
    res.status(500).json({ error: 'Failed to generate newsletter' });
  }
});

app.listen(PORT, () => {
  console.log('Multi-agent workflow system initialized');
  console.log(`Server running on port ${PORT}`);
});

