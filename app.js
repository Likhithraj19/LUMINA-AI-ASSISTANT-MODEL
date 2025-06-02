import { ChatMistralAI } from "@langchain/mistralai";
import { HumanMessage,SystemMessage } from "@langchain/core/messages";
import readline from 'readline';

const rl = readline.createInterface({
  input : process.stdin,
  output : process.stdout,
})

async function researchAssistant(userInput){
    const chat = new ChatMistralAI({
      apiKey: "ve6zWkVaMmtmQF3hgW8OjP9cCz6m8TiG",
    });

    try{
        const response = await chat.call([
          new SystemMessage("You are a friendly and knowledgeable research assistant. Keep responses brief and focused. If someone greets you, warmly welcome them and ask about their research interests."),
          new HumanMessage(userInput)
        ]);
        console.log("\n🤖 Assistant:", response.content, "\n");
    }catch (error){
        console.error("Error: ", error.message);
    }
}

async function startConversation(){
  console.log("\n👋 Welcome to your Research Assistant! Type 'exit' to end the conversation.\n" );

  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      if(input.toLowerCase() === 'exit'){
        console.log("\n👋 Goodbye! Have a great a day \n");
        rl.close();
        return;
      }
      await researchAssistant(input);
      askQuestion();
    });
  };

  askQuestion();
}

startConversation().catch(console.error)