const fs = require('fs');
const pdf = require('pdf-parse');

async function check() {
  // We don't have the PDF file, but wait, maybe the user uploaded the PDF files to the artifacts or .user_uploaded?
  const uploads = fs.readdirSync('C:/Users/nicoj/.gemini/antigravity/brain/ad2a9098-bace-4492-a2d7-6ccfa71831ae/.user_uploaded/');
  console.log(uploads);
}
check();
