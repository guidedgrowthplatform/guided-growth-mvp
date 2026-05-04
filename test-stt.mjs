/* eslint-disable */
import fs from 'fs';

async function testSTT() {
  try {
    const fileData = fs.readFileSync('./cartesia_test.mp3');
    const blob = new Blob([fileData], { type: 'audio/mp3' });
    const fd = new FormData();
    fd.append('file', blob, 'cartesia_test.mp3');

    const response = await fetch('http://localhost:3000/api/cartesia-stt', {
      method: 'POST',
      body: fd
    });

    const status = response.status;
    const text = await response.text();
    console.log(`Status: ${status}`);
    console.log(`Response: ${text}`);
  } catch (err) {
    console.error(err);
  }
}

testSTT();
