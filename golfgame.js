var io;
var RoomData = new Map();

exports.connectedToServer = function(sio, sock) {
    io = sio;
    let socket = sock;
    socket.emit('connected', socket.id);
    console.log("User Connected:    " + socket.id);
    
    //A player is disconnecting...
    socket.on('disconnecting', () => {
        try {
            if(socket.rooms != undefined) {
                let lobbies = Array.from(socket.rooms); //Get Array of rooms the disconnecting user is in [0] = personal SocketId, [1] = Game Room Id (if any)
                console.log("User Disconnected: " + lobbies[0]);
                if(lobbies.length > 1) {
                    //Player is in a lobby
                    let hostOfLobby = RoomData.get(lobbies[1]); //Get the host Socket Id of the lobby the player is in
                    //If player is host, kick everyone
                    if(lobbies[0] == hostOfLobby.hostSocketId) {
                        //Player is a host, destroy lobby
                        console.log('Host is leaving the lobby!');
                        socket.broadcast.to(lobbies[1]).emit('hostLeft');   //Broadcast Host Left event
                        RoomData.delete(lobbies[1]);    //Delete Game Room in Server List
                        io.in(lobbies[1]).socketsLeave(lobbies[1]);   //Force everyone to leave the Game Room
                    } else {
                        //Player is just a player
                        console.log("Player is leaving lobby!");
                        socket.broadcast.to(hostOfLobby.hostSocketId).emit('playerLeft', lobbies[0]);   //Send User who left to the Host
                    }
                }
            }
        } catch (error) {console.log(error);}
    });

    //App Listeners
    socket.on('getName', getName);  //Get name of the host from the server
    socket.on('joinSocket', joinSocket); //Let Host join the socket
    socket.on('playerJoinREQ', playerJoinREQ);  //Player wants to join host's lobby
    socket.on('requestPlayerToJoin', requestPlayerToJoin); //Host accepted player, let server add player to lobby
    socket.on('gameUpdate', gameUpdate); //Host sending new data of ENTIRE lobby to EVERYONE
    socket.on('sendPlayerInputREQ', sendPlayerInputREQ); //Player wants to apply input, send to host for processing
    socket.on('sendPlayerReadyREQ', sendPlayerReadyREQ); //Player wants to change their ready status
}


//Generate GameId
exports.getGameId = function() {
    let collide = true;
    let count = 0;
    let newGameId = 0;
    while (collide == true && count < 100000) {
        newGameId = Math.random() * 100000 | 0;
        newGameId += 100000;
        if(RoomData.has(newGameId) != true) {
            collide = false; 
            return newGameId;
        }
        count++;
    }
}

//Create Empty room with gameId
exports.setGame = function(gameId, hostName) {
    //Clean up other half-open lobbies
    cleanUpLobbies();
    //Add room to RoomData
    if(RoomData.has(gameId) != true) {
        let serverPacket = {
            hostSocketId: 'EMPTY',
            hostName: hostName
        }
        RoomData.set(gameId, serverPacket);
        console.log("Created Room:  " + gameId);
    }
}

//Return room of gameId
exports.getGame = function(gameId) {
    if(RoomData.has(gameId) == true) {return RoomData.get(gameId);} else {return 'NULL';}
}

//Create lobby with host in the lobby
exports.createGame = function(gameId, mySocket) {
    try {
        let room = RoomData.get(gameId);
        if(room == undefined) return;
        room.hostSocketId = mySocket;
        RoomData.set(gameId, room);
    } catch (error) {
        console.log(error);
    }
}

//Clean up half-made lobbies
function cleanUpLobbies() {
    RoomData.forEach((value, key, map) => {
        if(value.hostSocketId == 'EMPTY') RoomData.delete(key);
    });
}


//------------------------------------------------------------------------------------------------
// Listener Functions
//------------------------------------------------------------------------------------------------


// {gameId, socketId}
function getName(data) {
    try {
        let room = RoomData.get(parseInt(data.gameId));
        if(room == undefined) return;
        let retData = {error: false, gameId: data.gameId, hostSocketId: room.hostSocketId, hostName: room.hostName}
        if(room.hostSocketId == data.socketId) {
            this.emit('getNameACK', retData);
        } else {
            //Lobby belongs to someone else
            retData.error = true;
            this.emit('getNameACK', retData);
        }
    } catch (error) {console.log(error);}
}


//Join Socket lobby
function joinSocket(gameId) {
    //Add Player to Game Room
    let data = {joined: false}
    try {
        this.join(parseInt(gameId));
        let thisId;
        this.client.sockets.forEach(cout);
        function cout(value, key, map) {thisId = key;}
        console.log(thisId + " joined " + gameId);
        let room  = RoomData.get(parseInt(gameId));
        if(room == undefined) return;
        data = {gameId: gameId, hostSocketId: room.hostSocketId, hostName: room.hostName, joined: true}
        this.emit('joinSocketACK', data);
    } catch (error) {
        console.log(error); this.emit('joinSocketACK', data);
    }
}

function playerJoinREQ(data) {
    try {
        let room = RoomData.get(parseInt(data.gameId));
        if(room == undefined) return;
        console.log(data.socketId + " is trying to connect to " + data.gameId);
        this.broadcast.to(room.hostSocketId).emit('playerJoinREQ', data);
    } catch (error) {console.log(error);}
}

function requestPlayerToJoin(data) {
    try {
        io.sockets.sockets.get(data.mySocket).join(parseInt(data.gameId));
        console.log("Player: " + data.mySocket + " joined existing lobby: " + data.gameId);
        
    } catch (error) {
        console.log(error);
    }
}

function gameUpdate(data) {
    this.broadcast.to(parseInt(data.gameId)).emit('gameUpdateACK', data);
}

function sendPlayerInputREQ(data) {
    let room = RoomData.get(parseInt(data.gameId));
    if(room == undefined) return;
    this.broadcast.to(room.hostSocketId).emit('sendPlayerInputREQ', data);
}

function sendPlayerReadyREQ(data) {
    let room = RoomData.get(parseInt(data.gameId));
    if(room == undefined) return;
    this.broadcast.to(room.hostSocketId).emit('sendPlayerReadyREQ', data);
}