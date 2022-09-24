# 3D Multiplayer Mini-Golf Website

3D Multiplayer Mini-Golf Website is a server-hosted 3D multiplayer mini-golf game. The aim of this project is to provide the most intuitive form of multiplayer mini-golf that is capable of being used by a general audience of all ages. This project creates a lobby that is hosted on a dedicated Node.js server and uses Express and Socket.io to create multiplayer lobby connections. This project also uses PlayCanvas as the Physics and 3D rendering engine for fast Moblie 3D graphics.

## Installation

To install, please make sure you have npm and node installed already, if not: [Install Node and Npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)

To create your own server, first clone this repository:

```bash
git clone https://github.com/PeytonMAnderson/GolfMultiplayer.git
```
Next, navigate to the directory ( ./GolfMultiplayer ) and install the server dependencies
```bash
npm install
```
Next, create a .env file in the directory ( ./GolfMultiplayer/.env ) and in the file set up your custom settings

```js
ADDRESS="localhost"
PORT="8080"
```
Finally, start the node server while in the directory:
```bash
npm run start
```
## Usage

To use this project, install and start a node server (see above)

Then, connect to the server in your web browser using the ADDRESS and PORT that you chose

```
http://localhost:8080/
```
You should now be able to navigate the website and create a server and join it on another device.

## Contributions
Caleb Stewart - UI and UX Programming

Peyton Anderson - Networking and Server Backend

Ashley Elliot - Modeling and CSS Design

Tianqing Feng - Map and Game Design

Dylan Guidry - UI and UX Programming

Colby Moore - Physics and Game Logic Programming

## License
[MIT](https://choosealicense.com/licenses/mit/)
