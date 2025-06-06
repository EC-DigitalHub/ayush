import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No audio file received'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Convert the received audio file to a Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Forward the audio to the n8n webhook
    // Note: Adjust the URL to your actual n8n webhook URL
    const webhookUrl = "https://tannyst.aiagent.n8n.boss.tanish.me/webhook/interview";
    
    // Create a new FormData to send to the webhook
    const n8nFormData = new FormData();
    
    // Add the audio file to the form data with the same name expected by n8n
    const audioBlob = new Blob([buffer], { type: audioFile.type });
    n8nFormData.append('audio', audioBlob, 'audio.wav');
    
    // Send the request to the n8n webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: n8nFormData,
    });
    
    // Check if the response was successful
    if (!response.ok) {
      throw new Error(`Webhook responded with status ${response.status}`);
    }
    
    // Parse and return the response from n8n
    let data;
    try {
      data = await response.json();
    } catch {
      // If response is not JSON, get it as text
      const textResponse = await response.text();
      data = { text: textResponse };
    }
    
    return new Response(JSON.stringify({
      success: true,
      response: data
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {
    const message = 'Failed to process audio with n8n webhook';
    return new Response(JSON.stringify({
      success: false,
      error: message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 