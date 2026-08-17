require('dotenv').config();
const app = require('./api/index.js');
const port = 3000;
app.listen(port, () => {
  console.log(`Test server running at http://localhost:${port}`);
});
