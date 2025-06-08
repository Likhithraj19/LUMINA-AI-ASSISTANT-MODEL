import { ChatMistralAI } from "@langchain/mistralai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import readline from 'readline';
import fs from 'fs/promises';
import dotenv from 'dotenv';
// import path from 'path';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Global state variables
let conversationHistory = [];
let learningData = {
  supervised: [],
  unsupervised: []
};
let userFeedback = [];
let topicPatterns = new Map();
let responseQuality = new Map();
let learningPhase = 'supervised';
let supervisedThreshold = 50; // Threshold to switch to unsupervised learning
let interactionCount = 0;

const chat = new ChatMistralAI({
  apiKey: process.env.MISTRAL_API_KEY, 
  // modelName: "mistral-large-latest",
});

async function initialize() {
  await loadLearningData();
  await loadConversationHistory();
  console.log(`🧠 Learning Phase: ${learningPhase.toUpperCase()}`);
  console.log(`📊 Interactions: ${interactionCount}`);
}

async function loadLearningData() {
  try {
    const data = await fs.readFile('learning_data.json', 'utf8');
    const parsed = JSON.parse(data);
    learningData = parsed.learningData || { supervised: [], unsupervised: [] };
    userFeedback = parsed.userFeedback || [];
    topicPatterns = new Map(parsed.topicPatterns || []);
    responseQuality = new Map(parsed.responseQuality || []);
    interactionCount = parsed.interactionCount || 0;
    learningPhase = interactionCount >= supervisedThreshold ? 'unsupervised' : 'supervised';
  } catch (error) {
    console.log("📝 Starting with fresh learning data...");
  }
}

async function loadConversationHistory() {
  try {
    const data = await fs.readFile('conversation_history.json', 'utf8');
    conversationHistory = JSON.parse(data) || [];
  } catch (error) {
    console.log("📝 Starting with fresh conversation history...");
  }
}

async function saveLearningData() {
  const data = {
    learningData: learningData,
    userFeedback: userFeedback,
    topicPatterns: Array.from(topicPatterns.entries()),
    responseQuality: Array.from(responseQuality.entries()),
    interactionCount: interactionCount,
    learningPhase: learningPhase
  };
  
  await fs.writeFile('learning_data.json', JSON.stringify(data, null, 2));
}

async function saveConversationHistory() {
  await fs.writeFile(
    'conversation_history.json', 
    JSON.stringify(conversationHistory, null, 2)
  );
}

// Enhanced research query validation with learning
async function validateResearchQuery(query) {
  const researchKeywords = [
    'research', 'study', 'analysis', 'theory', 'methodology',
    'data', 'experiment', 'hypothesis', 'scientific', 'academic',
    'paper', 'journal', 'publication', 'findings', 'literature',
    'review', 'investigation', 'what', 'why', 'how',
    'explain', 'define', 'analyze', 'compare', 'evaluate',
    'discuss', 'examine', 'explore', 'investigate'
  ];
  
  const queryLower = query.toLowerCase();
  
  // Allow greetings and thanks
  if (/^(hi|hello|hey|greetings|thanks|thank you|bye|goodbye)/.test(queryLower)) {
    return true;
  }
  
  // Use learned patterns in unsupervised phase
  if (learningPhase === 'unsupervised') {
    for (let [pattern, isResearch] of topicPatterns) {
      if (queryLower.includes(pattern) && isResearch) {
        return true;
      }
    }
  }
  
  return researchKeywords.some(keyword => queryLower.includes(keyword)) || 
         queryLower.length >= 15; // Longer queries are likely research-related
}

// Extract topics and patterns for unsupervised learning
function extractTopicPatterns(query, isResearchRelated) {
  const words = query.toLowerCase().split(/\s+/).filter(word => word.length > 3);
  const patterns = [];
  
  // Extract n-grams
  for (let i = 0; i < words.length - 1; i++) {
    patterns.push(words[i] + ' ' + words[i + 1]);
  }
  
  // Store patterns with their research relevance
  patterns.forEach(pattern => {
    topicPatterns.set(pattern, isResearchRelated);
  });
}

// Supervised learning - collect labeled data
function supervisedLearning(userInput, assistantResponse, feedback = null) {
  const dataPoint = {
    input: userInput,
    response: assistantResponse,
    timestamp: new Date().toISOString(),
    feedback: feedback,
    isResearchRelated: validateResearchQuery(userInput)
  };
  
  learningData.supervised.push(dataPoint);
  extractTopicPatterns(userInput, dataPoint.isResearchRelated);
  
  console.log("📚 [Supervised Learning] Data point collected");
}

// Unsupervised learning - find patterns without labels
function unsupervisedLearning(userInput, assistantResponse) {
  // Cluster similar queries and responses
  const similarity = calculateSimilarity(userInput);
  const cluster = findOrCreateCluster(userInput, similarity);
  
  const dataPoint = {
    input: userInput,
    response: assistantResponse,
    timestamp: new Date().toISOString(),
    cluster: cluster,
    patterns: extractFeatures(userInput)
  };
  
  learningData.unsupervised.push(dataPoint);
  updateResponseQuality(userInput, assistantResponse);
  
  console.log("🔍 [Unsupervised Learning] Pattern analysis completed");
}

function calculateSimilarity(input) {
  // Simple word overlap similarity
  const inputWords = new Set(input.toLowerCase().split(/\s+/));
  let maxSimilarity = 0;
  
  for (let data of learningData.unsupervised) {
    const dataWords = new Set(data.input.toLowerCase().split(/\s+/));
    const intersection = new Set([...inputWords].filter(x => dataWords.has(x)));
    const union = new Set([...inputWords, ...dataWords]);
    const similarity = intersection.size / union.size;
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }
  
  return maxSimilarity;
}

function findOrCreateCluster(input, similarity) {
  if (similarity > 0.3) {
    for (let data of learningData.unsupervised) {
      if (calculateSimilarity(input) > 0.3) {
        return data.cluster;
      }
    }
  }
  return `cluster_${Date.now()}`;
}

function extractFeatures(input) {
  return {
    length: input.length,
    wordCount: input.split(/\s+/).length,
    hasQuestionWords: /\b(what|why|how|when|where|who)\b/i.test(input),
    hasResearchTerms: /\b(study|research|analysis|theory)\b/i.test(input),
    complexity: input.split(/[.!?]/).length
  };
}

function updateResponseQuality(input, response) {
  const key = input.substring(0, 50); // Use first 50 chars as key
  const currentQuality = responseQuality.get(key) || { count: 0, avgLength: 0 };
  
  currentQuality.count++;
  currentQuality.avgLength = (currentQuality.avgLength + response.length) / 2;
  
  responseQuality.set(key, currentQuality);
}

// Enhanced system prompt based on learning phase
function generateSystemPrompt() {
  let basePrompt = `You are an intelligent research assistant that learns and adapts. 
Current learning phase: ${learningPhase.toUpperCase()}

Core capabilities:
1. Focus on academic and research topics
2. Provide detailed, well-structured responses
3. Engage naturally while maintaining research focus
4. Learn from interactions and improve over time`;

  if (learningPhase === 'unsupervised') {
    // Add learned patterns to prompt
    const topPatterns = Array.from(topicPatterns.entries())
      .filter(([_, isResearch]) => isResearch)
      .slice(0, 10)
      .map(([pattern]) => pattern);
    
    if (topPatterns.length > 0) {
      basePrompt += `\n\nLearned research patterns: ${topPatterns.join(', ')}`;
    }
  }

  return basePrompt;
}

async function processUserInput(userInput) {
  try {
    interactionCount++;
    
    // Check if we should switch to unsupervised learning
    if (learningPhase === 'supervised' && interactionCount >= supervisedThreshold) {
      learningPhase = 'unsupervised';
      console.log("\n🎓 Switching to UNSUPERVISED learning mode!\n");
    }

    // Validate research query
    const isResearchRelated = await validateResearchQuery(userInput);
    if (!isResearchRelated && !isGreeting(userInput)) {
      console.log("\n🤖 Assistant: I specialize in research topics. Could you ask me about an academic subject or research area?\n");
      return;
    }

    // Add to conversation history
    conversationHistory.push({ role: 'user', content: userInput });

    // Generate context-aware prompt
    const systemPrompt = generateSystemPrompt();
    const contextPrompt = conversationHistory
      .slice(-10) // Last 10 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    // Get AI response
    const response = await chat.call([
      new SystemMessage(`${systemPrompt}\n\nRecent context:\n${contextPrompt}`),
      new HumanMessage(userInput)
    ]);

    const assistantResponse = response.text || response.content;

    // Add assistant response to history
    conversationHistory.push({ role: 'assistant', content: assistantResponse });

    // Apply appropriate learning method
    if (learningPhase === 'supervised') {
      supervisedLearning(userInput, assistantResponse);
    } else {
      unsupervisedLearning(userInput, assistantResponse);
    }

    // Save data
    await saveLearningData();
    await saveConversationHistory();

    console.log(`\n🤖 Assistant [${learningPhase}]:`, assistantResponse);
    
    // Ask for feedback in supervised phase
    if (learningPhase === 'supervised' && interactionCount % 5 === 0) {
      askForFeedback();
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

function isGreeting(input) {
  return /^(hi|hello|hey|greetings|thanks|thank you|bye|goodbye)/i.test(input.trim());
}

function askForFeedback() {
  console.log("\n💬 Was my response helpful? (Type 'yes', 'no', or just continue with your next question)");
}

async function handleFeedback(feedback) {
  if (['yes', 'no', 'good', 'bad', 'helpful', 'not helpful'].includes(feedback.toLowerCase())) {
    const lastInteraction = learningData.supervised[learningData.supervised.length - 1];
    if (lastInteraction) {
      lastInteraction.userFeedback = feedback;
      userFeedback.push({
        feedback: feedback,
        timestamp: new Date().toISOString(),
        context: lastInteraction.input
      });
      console.log("📝 Thank you for your feedback!");
      await saveLearningData();
      return true;
    }
  }
  return false;
}

function displayStats() {
  console.log("\n📊 Learning Statistics:");
  console.log(`Interactions: ${interactionCount}`);
  console.log(`Learning Phase: ${learningPhase.toUpperCase()}`);
  console.log(`Supervised Data Points: ${learningData.supervised.length}`);
  console.log(`Unsupervised Data Points: ${learningData.unsupervised.length}`);
  console.log(`Learned Patterns: ${topicPatterns.size}`);
  console.log(`User Feedback Received: ${userFeedback.length}\n`);
}

// Main function
async function startConversation() {
  await initialize();
  
  console.log("\n🔬 Welcome to your AI Research Assistant with Machine Learning!");
  console.log("📚 I learn from our conversations to provide better assistance.");
  console.log("Type 'stats' to see learning progress, or 'exit' to end.\n");
  
  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      const trimmedInput = input.trim();
      
      if (trimmedInput.toLowerCase() === 'exit') {
        console.log('\n🎓 Thank you for helping me learn! Goodbye!\n');
        displayStats();
        rl.close();
        return;
      }
      
      if (trimmedInput.toLowerCase() === 'stats') {
        displayStats();
        askQuestion();
        return;
      }

      const isFeedback = await handleFeedback(trimmedInput);
      if (!isFeedback) {
        await processUserInput(trimmedInput);
      }
      
      askQuestion();
    });
  };

  askQuestion();
}

startConversation().catch(error => {
  console.error("💥 Application error:", error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down gracefully...');
  rl.close();
  process.exit(0);
});

export {initialize, processUserInput}