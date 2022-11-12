var io;
var RoomData = new Map();

exports.connectedToServer = function(sio, sock) {
    io = sio;
    let socket = sock;
    socket.emit('connected', socket.id);
    console.log("\x1B[34mGOLFGAME:  User Connected:    " + socket.id);
    
    //A player is disconnecting...
    socket.on('disconnecting', () => {
        try {
            if(socket.rooms != undefined) {
                let lobbies = Array.from(socket.rooms); //Get Array of rooms the disconnecting user is in [0] = personal SocketId, [1] = Game Room Id (if any)
                console.log("\x1B[34mGOLFGAME:  User Disconnected: " + lobbies[0]);
                if(lobbies.length > 1) {
                    //Player is in a lobby
                    let hostOfLobby = RoomData.get(lobbies[1]); //Get the host Socket Id of the lobby the player is in
                    //If player is host, kick everyone
                    if(lobbies[0] == hostOfLobby.hostSocketId) {
                        //Player is a host, destroy lobby
                        console.log('\x1B[34mGOLFGAME:  Host is leaving a lobby!');
                        socket.broadcast.to(lobbies[1]).emit('hostLeft');   //Broadcast Host Left event
                        RoomData.delete(lobbies[1]);    //Delete Game Room in Server List
                        io.in(lobbies[1]).socketsLeave(lobbies[1]);   //Force everyone to leave the Game Room
                    } else {
                        //Player is just a player
                        console.log("\x1B[34mGOLFGAME:  Player is leaving a lobby!");
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
            console.log("\x1B[34mGOLFGAME:  Generated room code: " + newGameId);
            console.log("\x1B[34mGOLFGAME: Current Opened Lobbies: ");
            console.log("----------------------------------");
            console.log(RoomData);
            console.log("----------------------------------");
            return newGameId;
        }
        count++;
    }
    console.log("\x1B[34mGOLFGAME:  Failed to generate room code!");
    return null;
}

//Create Empty room with gameId
exports.setGame = function(gameId, hostName) {
    //Add room to RoomData
    if(RoomData.has(gameId) != true) {
        let serverPacket = {
            hostSocketId: 'EMPTY',
            hostName: hostName
        }
        RoomData.set(gameId, serverPacket);
        console.log("\x1B[34mGOLFGAME:  Created empty room for:  " + gameId + " with host name: " + hostName);
        timeoutDeadLobby(gameId, 5000);
        return true;
    } else {
        console.log("\x1B[34mGOLFGAME:  Failed to set game room " + gameId + " up with host name: " + hostName);
        return false;
    }
}

//Return room of gameId
exports.getGame = function(gameId) {
    if(RoomData.has(gameId) == true) {
        console.log("\x1B[34mGOLFGAME:  Found room for " + gameId);
        return RoomData.get(gameId);
    } else {
        console.log("\x1B[34mGOLFGAME:  Failed to find room for " + gameId);
        return null;
    }
}

//Create lobby with host in the lobby
exports.createGame = function(gameId, mySocket) {
    try {
        let room = RoomData.get(gameId);
        if(room == null) return false;
        if(room.hostSocketId != 'EMPTY') {
            console.log("\x1B[34mGOLFGAME:  Failed to add hostSocketId: " + mySocket + " to room " + gameId);
            return false;
        }
        room.hostSocketId = mySocket;
        RoomData.set(gameId, room);
        console.log("\x1B[34mGOLFGAME:  Added hostSocketId: " + mySocket + " to room " + gameId);
        return true;
    } catch (error) {
        console.log("\x1B[34mGOLFGAME:  Failed to add hostSocketId: " + mySocket + " to room " + gameId);
        console.log(error);
        return false;
    }
}

//------------------------------------------------------------------------------------------------
// Listener Functions
//------------------------------------------------------------------------------------------------


// {gameId, socketId}
function getName(data) {
    try {
        let room = RoomData.get(parseInt(data.gameId));

        if(room == undefined) {
            console.log("\x1B[34mGOLFGAME:  Room does not exist!"); 
            return;
        }

        let retData = {error: false, gameId: data.gameId, hostSocketId: room.hostSocketId, hostName: room.hostName}

        if(room.hostSocketId == data.socketId) {
            console.log("\x1B[34mGOLFGAME:  Found my room: " + data.gameId + " as host: " + data.socketId); 
            this.emit('getNameACK', retData);
        } else {
            //Lobby belongs to someone else
            retData.error = true;
            console.log("\x1B[34mGOLFGAME:  Found someone's room: " + data.gameId + " as a player " + data.socketId); 
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
        let room  = RoomData.get(parseInt(gameId));
        if(room == undefined) {
            console.log("\x1B[34mGOLFGAME:  Room does not exist. Cannot Join Socket " + gameId); 
            return;
        }
        console.log("\x1B[34mGOLFGAME:  Sucessfully joined game room socket for: " + gameId); 
        data = {gameId: gameId, hostSocketId: room.hostSocketId, hostName: room.hostName, joined: true}
        this.emit('joinSocketACK', data);
    } catch (error) {
        console.log("\x1B[34mGOLFGAME:  Failed to join game room socket for: " + gameId); 
        console.log(error); this.emit('joinSocketACK', data);
    }
}

function playerJoinREQ(data) {
    try {
        let room = RoomData.get(parseInt(data.gameId));
        if(room == undefined) return;
        console.log("\x1B[34mGOLFGAME:  " + data.socketId + " is trying to connect to " + data.gameId);
        this.broadcast.to(room.hostSocketId).emit('playerJoinREQ', data);
    } catch (error) {console.log(error);}
}

function requestPlayerToJoin(data) {
    try {
        io.sockets.sockets.get(data.mySocket).join(parseInt(data.gameId));
        console.log("\x1B[34mGOLFGAME:  Player: " + data.mySocket + " joined existing lobby: " + data.gameId);
    } catch (error) {console.log(error);}
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

function timeoutDeadLobby(gameId, TIME) {
    setTimeout(() => {
        //Wait TIME units, if lobby still does not have a hostSocketId, remove lobby
        let room = RoomData.get(gameId);
        if(room == undefined) return;
        if(room.hostSocketId != 'EMPTY') {
            console.log("\x1B[34mGOLFGAME:  Timeout: Room has hostSocketId. No need to destroy lobby!"); 
            return;
        } else {
            console.log("\x1B[34mGOLFGAME:  Timeout: Room still does not have a hostSocketId after " + TIME + "ms. Destroying lobby..."); 
            RoomData.delete(gameId);
            return;
        }
    }, TIME);
}