const HttpServer = require('./index');

const server = new HttpServer();

server.listen(3000, 'localhost', () => {
    console.log('Server is running at http://localhost:3000');
});

server.get('/', (req, res) => {
    res.json({ message: 'Welcome to my API' });
});

server.post('/post', (req, res) => {
    res.json({ message: 'Post request received', data: req.body });
});

