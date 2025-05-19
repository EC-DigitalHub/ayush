import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Parse the incoming request
    const body = await req.json();
    const userMessage = body.text || "";
    
    // Simulate a small delay to mimic network latency
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate a mock response based on user input
    let response = "";
    
    if (userMessage.toLowerCase().includes("hello") || userMessage.toLowerCase().includes("hi")) {
      response = "Hello! How can I assist you today?";
    } else if (userMessage.toLowerCase().includes("help")) {
      response = "I'm here to help. What do you need assistance with?";
    } else if (userMessage.toLowerCase().includes("weather")) {
      response = "I don't have access to real-time weather data, but I can help with other questions.";
    } else if (userMessage.toLowerCase().includes("audio") || userMessage.toLowerCase().includes("recording")) {
      response = "I received your audio message. How can I help you with that?";
    } else if (userMessage.toLowerCase().includes("bye") || userMessage.toLowerCase().includes("goodbye")) {
      response = "Goodbye! Feel free to chat again if you need anything.";
    } else {
      // Default response for any other input
      const responses = [
        "I understand you're saying: \"" + userMessage + "\". Can you tell me more?",
        "Thanks for your message. How else can I assist you?",
        "I'm processing your request. Is there anything specific you'd like to know?",
        "That's an interesting point. Would you like me to elaborate on anything?",
        "I'm here to help with your questions. Is there something specific you're looking for?"
      ];
      
      // Pick a random response
      response = responses[Math.floor(Math.random() * responses.length)];
    }
    
    return new Response(JSON.stringify({
      success: true,
      reply: response
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    let message = 'Failed to process request';
    if (error instanceof Error) {
      message = error.message;
      console.error('Mock webhook error:', error);
    } else {
      console.error('Mock webhook error:', error);
    }
    return new Response(JSON.stringify({
      success: false,
      error: message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 