//Open Socket to server
console.log("Connecting to network...");
var sockets = io(); //Socket IO Connection 

var lostplayers = new Map();

//Global Variables (Across Multiplayer)
var GRD = {
    gameId: 0,
    origin: undefined,
    hostSocketId: 'NULL',
    playerCount: 1,
    playerLimit: 8,
    timeLeft: 'NULL',
    timeLimit: 120,
    Players: [],
    LostPlayers: lostplayers
}

//Local Variables (Only on this instance)
var myName = 'anon'; //My Name
var loaded = false; //If the Script in PlayCanvas is completely initalized
var validName = false;

var IO = {
    init : function() {
        IO.socket = sockets;
        IO.bindEvents();
    },
    bindEvents : function() {
        //Bind Server Listeners
        IO.socket.on('connected', IO.onConnected);
        IO.socket.on('getNameACK', IO.getNameACK);
        IO.socket.on('joinSocketACK', IO.joinSocketACK);

        //Host Server Listeners
        IO.socket.on('playerJoinREQ', App.Host.playerJoinREQ); //Host determines if player can join
        IO.socket.on('playerLeft', App.Host.playerLeft);    //Host removes player from lobby
        IO.socket.on('sendPlayerInputREQ', App.Host.sendPlayerInputREQ); //Process User Request
        //Player Server Listeners
        IO.socket.on('gameUpdateACK', App.Player.gameUpdateACK); //Player recieves Entire lobby data from host
        IO.socket.on('hostLeft', App.Player.hostLeft);  //The host has left the lobby
    },
    onConnected : function(socID) {
        if(App.mySocketId != undefined && App.mySocketId != '') {
            //Another connected request is coming but I am already connected!
            console.log("I AM ALREADY CONNECTED: " + App.mySocketId + '   ' + sockets.id);
            return;
        }
        App.mySessionId = IO.socket.io.engine.id;
        App.mySocketId = socID;
        console.log('Connected! Socket ID: ' + App.mySocketId );
        console.log("Creating Lobby...");

        //Get Room code from URL
        let path = window.location.pathname;
        let pathAry = path.split('/');
        let currentGameId = pathAry[pathAry.length-1];

        //POST to server to see if room is set up already
        let data = {gameId: currentGameId, mySocketId: App.mySocketId}
        var formBody = [];
        for (var property in data) {
            var encodedKey = encodeURIComponent(property);
            var encodedValue = encodeURIComponent(data[property]);
            formBody.push(encodedKey + "=" + encodedValue);
        }
        formBody = formBody.join("&");
        fetch(window.location.href, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: formBody
        });

        //See if name exists on server
        let newData = {gameId: parseInt(currentGameId), socketId: App.mySocketId}
        GRD.gameId = parseInt(currentGameId);
        try {IO.socket.emit("getName", newData);} catch (error) {console.log(error);}
    },
    getNameACK : function (data) {
        //If player is joining lobby
        if(data.error) {
            console.log("Lobby already created by: " + data.hostName);
            console.log("Joining Lobby...");
            try {
                // let sendData = {name: myName, mySocket: App.mySocketId, gameId: GRD.gameId}
                // IO.socket.emit('playerJoinREQ', sendData);
            } catch (error) {
                console.log(error);
            }
        //If player is hosting lobby
        } else {
            console.log("Created Lobby for: " + data.gameId + ' with host: ' + data.hostName + ' who has id: ' + data.hostSocketId);
            console.log("Joining Lobby...");
            try {
                IO.socket.emit("joinSocket", GRD.gameId); 
                myName = data.hostName;
            } catch (error) {
                console.log(error);
            }
        }
    },
    joinSocketACK : async function (data) {
        try {
            if(data.joined) {
                //Create Host in Lobby
                GRD.hostSocketId = data.hostSocketId;
                console.log("Joined " + data.hostName + "'s lobby:  " + data.gameId);
                resetPlayersArray();
                let index = findFirstOpen(GRD.Players);
                GRD.Players[index] = {
                    myName: myName,
                    mySocket: App.mySocketId,
                    myPosition: undefined,
                    myLinVelocity: undefined,
                    myAngVelocity: undefined
                }

                //Wait for Scene to load if it hasn't yet
                function checkLoading() {
                    if(loaded) {
                        const org = {
                            x: thisPlayer.getPosition().x,
                            y: thisPlayer.getPosition().y + 2,
                            z: thisPlayer.getPosition().z
                        }
                        GRD.origin = org;
                        GRD.Players[index].myPosition = thisPlayer.getPosition();
                        GRD.Players[index].myLinVelocity = thisPlayer.rigidbody.linearVelocity;
                        GRD.Players[index].myAngVelocity = thisPlayer.rigidbody.angularVelocity;
                        GameUpdater.prototype.initializePlayers({Players: GRD.Players, name: myName});
                    } else {
                        window.setTimeout(checkLoading, 50);
                    }
                }
                checkLoading();
            } else {
                console.log("Failed to join game!");
            }
        } catch (error) {
            console.log(error);
        }
    }
}

var App = {
    init : function() {
        App.cacheElements();
        App.bindEvents();
    },
    cacheElements : function() {
        return;
    },
    bindEvents : function() {
        return;
    },
    Host : {
        playerJoinREQ : function(data) {
            console.log("Player " + data.name + " with socketId: " + data.socketId + " is trying to join my lobby " + data.gameId);
            try {
                if(data.name == undefined || data.name == '') {console.log("Player has no name!"); return;}
                if(data.socketId == undefined || data.socketId == '') {console.log("Player has no SocketId!");return;}
                if(GRD.playerCount >= GRD.playerLimit) {console.log("Room is Already full!");return;}
                if(hasPlayer(data.name)) {console.log("Player Already in Lobby!");return;}
                
                let transmitData = {mySocket: data.socketId, gameId: data.gameId}
                sockets.emit('requestPlayerToJoin', transmitData);

                let index = findFirstOpen(GRD.Players);
                if(index == null) {console.log("Room is Already full!");return;}

                //Determine if incoming player is history in lobby
                if(GRD.LostPlayers.has(data.name)) {
                    //There was an existing player in the Lost Database, re-create player
                    let ret_player = GRD.LostPlayers.get(data.name);
                    GRD.Players[index] = {
                        myName: ret_player.myName,
                        mySocket: data.socketId,
                        myPosition: ret_player.myPosition,
                        myLinVelocity: ret_player.myLinVelocity,
                        myAngVelocity: ret_player.myAngVelocity
                    }
                    //Destroy old memory of Lost Player
                    GRD.LostPlayers.delete(data.name);
                } else {
                    //New Player is not in history records, create brand-new player
                    GRD.Players[index] = {
                        myName: data.name,
                        mySocket: data.socketId,
                        myPosition: GRD.origin,
                        myLinVelocity: {x: 0, y: 0, z: 0},
                        myAngVelocity: {x: 0, y: 0, z: 0}
                    }
                }

                //Finalize New Player joining
                console.log("Adding " + data.name + " to lobby!");
                addPlayer(GRD.Players[index]);
                sendGameUpdate();   //Send New data to Everyone in Lobby
            } catch (error) {console.log(error);}
        },
        playerLeft : function(playerSocket) {
            for(let i = 0; i < GRD.Players.length; i++) {
                if(GRD.Players[i].mySocket == playerSocket) {
                    console.log(GRD.Players[i].myName + " has left my lobby!");
                    removePlayer(i);
                    GRD.LostPlayers.set(GRD.Players[i].myName, GRD.Players[i]);
                    GRD.Players[i] = 'EMPTY';
                }
            }
        },
        sendPlayerInputREQ : function(data) {
            let input = {force: data.data, name: data.name}
            GameUpdater.prototype.applyInput(input);
        }
    },
    Player : {
        sendName : function() {
            //Make sure I have provided a valid name
            if(myName == 'anon' || myName == undefined || myName == '') {console.log("PLEASE PROVIDE A NAME"); return;}
            if(App.mySocketId == undefined || App.mySocketId == '') {console.log("YOU HAVE NO SOCKET ID"); return;}

            //Send my name to the host to see if I can enter
            let data = {name: myName, socketId: App.mySocketId, gameId: GRD.gameId}
            IO.socket.emit('playerJoinREQ', data);
        },
        gameUpdateACK : function(data) {
            //If Player and done with name, go to main scene
            if(validName == false && App.mySocketId.toString() != data.hostSocketId.toString()) {
                console.log("NAME ACCEPTED!");
                validName = true;
                joinComplete();
            }
            //Wait for Scene to load if it hasn't yet
            function checkLoading() {
                if(loaded) {
                    if(findFirstOpen(GRD.Players) == null || findFirstOpen(GRD.Players) != findFirstOpen(data.Players)) {
                        //If different ammount of players, reset players
                        resetPlayers(data.Players);
                    } else {
                        //Update each players position
                        updatePlayers();
                    }
                    GRD = {
                        gameId: parseInt(data.gameId),
                        hostSocketId: data.hostSocketId,
                        origin: data.origin,
                        playerCount: data.playerCount,
                        playerLimit: data.playerLimit,
                        timeLeft: data.timeLeft,
                        timeLimit: data.timeLimit,
                        Players: data.Players
                    }
                } else {
                    window.setTimeout(checkLoading, 50);
                }
            }
            checkLoading();
        },
        hostLeft : function() {
            console.log("The host has left the lobby!");
            let new_location = location.origin;
            location.href = new_location;
        }
    }
}

//Run network.js
IO.init();
App.init();

//--------------------------------------------------------------------------------------------
//Help functions
//--------------------------------------------------------------------------------------------

//Send Whole game update for everyone with new player
function sendGameUpdate() {
    let data = {
        gameId: GRD.gameId,
        hostSocketId: GRD.hostSocketId,
        origin: GRD.origin,
        playerCount: GRD.playerCount,
        playerLimit: GRD.playerLimit,
        timeLeft: GRD.timeLeft,
        timeLimit: GRD.timeLimit,
        Players: GRD.Players
    }
    IO.socket.emit('gameUpdate', data);
}

//Reset Players if Player count mis-match
function resetPlayers(newPlayers) {
    console.log("reseting players");
    let data = {name: myName, Players: newPlayers}
    GameUpdater.prototype.initializePlayers(data);
}

//Add player
function addPlayer(Player) {
    let data = {name: Player.myName, 
                myPosition: Player.myPosition, 
                myLinVelocity: Player.myLinVelocity,
                myAngVelocity: Player.myAngVelocity
    }
    GameUpdater.prototype.addPlayerBall(data);
}

//Remove Player as host
function removePlayer(index) {
    GameUpdater.prototype.removePlayerBall(index);
}


//Update player data in game
function updatePlayers() {
    for (let i = 0; i < GRD.Players.length; i++) {
        if(GRD.Players[i] != 'EMPTY') {
            let data = {
                name: GRD.Players[i].myName, 
                position: GRD.Players[i].myPosition,
                lv: GRD.Players[i].myLinVelocity,
                av: GRD.Players[i].myAngVelocity
            }
            GameUpdater.prototype.updatePosition(data);
        }
    }
}

//Find my index
function getPlayer(name) {
    for(let i = 0; i < GRD.Players.length; i++) {
        if(GRD.Players[i].myName == name) {
            return i;
        }
    }
}

//Returns true if game already has a player
function hasPlayer(name) {
    for(let i = 0; i < GRD.Players.length; i++) {
        if(GRD.Players[i].myName == name) {
            return true;
        }
    }
    return false;
}

//Reset Players Array
function resetPlayersArray() {
    GRD.Players = [];
    for(let i = 0; i < GRD.playerLimit; i++) {
        GRD.Players[i] = 'EMPTY';
    }
}

//Find First open slot
function findFirstOpen(Array) {
    for(let i = 0; i < Array.length; i++) {
        if(Array[i] == 'EMPTY') {
            return i;
        }
    }
    return null;
}

//Send User Input
function sendPlayerInput(data) {
    let packet = {gameId: GRD.gameId, data: data, name: myName}
    IO.socket.emit('sendPlayerInputREQ', packet);
}