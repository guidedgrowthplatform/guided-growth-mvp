/* eslint-disable */
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkWhisper() {
  const audioStream = fs.createReadStream('./cartesia_test.mp3');
  const formData = new FormData();
  formData.append('file', audioStream, 'audio.mp3');
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      ...formData.getHeaders(),
    },
    body: formData,
  });

  if (!response.ok) {
    console.error('Failed:', await response.text());
  } else {
    const data = await response.json();
    console.log('Success:', data.text);
  }
}
checkWhisper();
