const fs = require('fs');

async function check() {
  const uploads = fs.readdirSync('C:/Users/nicoj/.gemini/antigravity/brain/ad2a9098-bace-4492-a2d7-6ccfa71831ae/.user_uploaded/');
  console.log(uploads);
}
check();
