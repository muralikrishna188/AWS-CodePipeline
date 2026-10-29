function add(a, b) {
  return a + b;
}

function greet(name) {
  return `Hello, ${name}!`;
}

module.exports = { add, greet };

if (require.main === module) {
  const http = require('http');
  const port = process.env.PORT || 3000;
  http.createServer((req, res) => {
    res.end(greet('CodeBuild test'));
  }).listen(port, () => console.log(`Listening on port ${port}`));
}
