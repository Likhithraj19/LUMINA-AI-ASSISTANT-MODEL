import readline from 'readline';
import { initialize,processUserInput, displayStats, handleFeedback } from '../app.js';


const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

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
