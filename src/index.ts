/**
 * Main entry point for the multi-agent workflow system
 * Express.js backend server
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
  webSearchAgent,
  processChangelogs,
  searchChangelogs,
  compareTools,
  recommendationAgent,
  newsletterAgent,
} from './agents/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Multi-agent workflow system is running' });
});

// Web Search Agent endpoints
app.post('/api/agents/web-search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }
    const result = await webSearchAgent(query);
    res.json(result);
  } catch (error) {
    console.error('Web search agent error:', error);
    res.status(500).json({ error: 'Failed to perform web search' });
  }
});

// Process changelogs from tools
app.post('/api/agents/web-search/process', async (req, res) => {
  try {
    const { tools } = req.body;
    if (!tools || !Array.isArray(tools)) {
      res.status(400).json({ error: 'Tools array is required' });
      return;
    }
    const result = await processChangelogs(tools);
    res.json(result);
  } catch (error) {
    console.error('Changelog processing error:', error);
    res.status(500).json({ error: 'Failed to process changelogs' });
  }
});

// Search changelogs using semantic search
app.post('/api/agents/web-search/search', async (req, res) => {
  try {
    const { query, toolName, limit } = req.body;
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }
    const result = await searchChangelogs(query, toolName, limit);
    res.json(result);
  } catch (error) {
    console.error('Changelog search error:', error);
    res.status(500).json({ error: 'Failed to search changelogs' });
  }
});

// Comparison Agent endpoint
app.post('/api/agents/comparison', async (req, res) => {
  try {
    const { toolNames, items } = req.body;
    // Support both toolNames (new) and items (legacy) for backward compatibility
    const tools = toolNames || items;
    if (!tools || !Array.isArray(tools) || tools.length < 2) {
      res.status(400).json({ error: 'At least 2 tool names are required for comparison' });
      return;
    }
    const result = await compareTools(tools);
    res.json(result);
  } catch (error) {
    console.error('Comparison agent error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to perform comparison';
    res.status(500).json({ error: errorMessage });
  }
});

// Recommendation Agent endpoint
app.post('/api/agents/recommendation', async (req, res) => {
  try {
    const { context, preferences } = req.body;
    if (!context) {
      res.status(400).json({ error: 'Context is required' });
      return;
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
      res.status(400).json({ error: 'At least one topic is required' });
      return;
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

