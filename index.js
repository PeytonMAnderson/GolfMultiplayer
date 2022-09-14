const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

require("dotenv").config();

app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true }));

//Send Resources
app.get('/', (req, res) => {
    //res.sendFile(__dirname + '/public/index.html');
    res.send("Hello");
});

//HTTP server begin listening
let port = process.env.PORT || 3000;
let address = process.env.ADDRESS || "localhost";
server.listen(port , address, () => {
    console.log('listening on http://' + address + ':' + port);
});


