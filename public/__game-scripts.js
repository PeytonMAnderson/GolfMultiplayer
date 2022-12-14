// follow.js
var Follow = pc.createScript('follow');
var current_ball_pos;

Follow.attributes.add('target', {
    type: 'entity',
    title: 'Target',
    description: 'The Entity to follow'
});

Follow.attributes.add('distance', {
    type: 'number',
    default: 4,
    title: 'Distance',
    description: 'How far from the Entity should the follower be'
});

// initialize code called once per entity
Follow.prototype.initialize = function() {
    this.vec = new pc.Vec3();
    current_ball_pos = this.vec;
};

// update code called every frame
Follow.prototype.update = function(dt) {
    if (!this.target) return;

    // get the position of the target entity
    var pos = this.target.getPosition();

    // calculate the desired position for this entity
    pos.x += 0.0 * this.distance;
    pos.y += 1.0 * this.distance;
    pos.z += 0.75 * this.distance;

    // smoothly interpolate towards the target position
    this.vec.lerp(this.vec, pos, 0.1);

    // set the position for this entity
    //currentCamPos = this.vec;
    current_ball_pos = this.vec;
    //this.entity.setPosition(this.vec); 
};


// movement.js
var Movement = pc.createScript('movement');
var current_friction;
var current_speed;
var current_gravity;
var current_collision;
var host_recieved = true;
var ballSelected = false;
var movement_th = 0.05;

function deg_to_rad(degrees) {
    return degrees * (Math.PI/180);
}

function rad_to_deg(radians) {
    return radians * (180/Math.PI);
}

Movement.attributes.add('speed', {
    type: 'number',    
    default: 0.1,
    min: 0.05,
    max: 100,
    precision: 2,
    description: 'Controls the movement speed'
});

// initialize code called once per entity
Movement.prototype.initialize = function() {
    this.force = new pc.Vec3();
    current_friction = this.entity.rigidbody.friction;
    current_speed = this.speed;
    current_gravity = this.app.systems.rigidbody.gravity;
    mouseIsHeld = false;

    try {
        GameUi.updateNetwork(this, "GRAVITY");
        GameUi.updateNetwork(this, "FRICTION");
        GameUi.updateNetwork(this, "SPEED");
    } catch (error) {
        //console.log(error);
    }
};

// update code called every frame
Movement.prototype.update = function(dt) {
    //console.log(mouseDistance);
    //--------------------------------------------------------------------
    //NETWORK
    try {
        if(current_speed != GRD.speed) {
            current_speed = GRD.speed;
        }
        if(current_gravity != GRD.gravity) {
            current_gravity = GRD.gravity;
        }
        if(current_friction != GRD.friction) {
            current_friction = GRD.friction;
        }
    } catch (error) {
        //console.log(error);
    }
    //--------------------------------------------------------------------

    var forceX = 0;
    var forceY = 0;
    var forceZ = 0;
    this.force.x = 0;
    this.force.y = 0;
    this.force.z = 0;


    //Get Camera direction in radians
    let theta_0 = 0;
    if(camera_direction) {
        let transformed_forward = new pc.Vec3();
        camera_direction.transformVector(pc.Vec3.FORWARD, transformed_forward);
        theta_0 = Math.atan2(-transformed_forward.x, -transformed_forward.z);
    }
    
    //Only allow new imput if the current velocity is 0


    let vel_mag = Math.abs(this.entity.rigidbody.linearVelocity.x) + Math.abs(this.entity.rigidbody.linearVelocity.y) + Math.abs(this.entity.rigidbody.linearVelocity.z);
    
   
    const inputPressed = isTouchPressed || isMousePressed;

    let pickedBall = pickedEntity == this.entity;

    let hold_for_network = true;

    //-------------------------------------------------------------------------------------------------
    //NETWORKING
    try {
        if (GRD.Players[getPlayer(myName)].myScores[GRD.holeNumber - 1] >= GRD.maxShots) {
            hold_for_network = false;
        }
    } catch (error) {
        //console.log(error);
    }
    //-------------------------------------------------------------------------------------------------

    if (inputPressed && pickedBall && vel_mag < movement_th && hold_for_network) {ballSelected = true;} else {ballSelected = false;}
    if(vel_mag > movement_th && !host_recieved) host_recieved = true;
    if(vel_mag < movement_th && host_recieved) {
        this.wait_counter++;
        if(this.wait_counter > 16) {
            //Add force if ball is was selected and released
            if(pickedBall && inputPressed == false) {
                let max_speed = -this.speed;
                let max_power = window.screen.width > window.screen.height ? window.screen.height/2 : window.screen.width/2;
                let current_power = (2 * mouseDistance) / max_power;
                forceZ = max_speed * current_power;
                pickedEntity = undefined;
            }
        }
    } else {
        this.wait_counter = 0;
    }

    //Calcuate Foward and Backward tranformed to global space
    this.force.x = this.force.x + forceZ * Math.sin(theta_0);
    this.force.z = this.force.z + forceZ * Math.cos(theta_0);
    //Calcuate Left and Right transformed to global space
    this.force.x = this.force.x + forceX * Math.sin(Math.PI/2 + theta_0);
    this.force.z = this.force.z + forceX * Math.cos(Math.PI/2 + theta_0);

    // if we have some non-zero force
    if (this.force.length()) {
        
        this.force.set(this.force.x,  0, this.force.z);
        // clamp force to the speed
        if (this.force.length() > this.speed) {
            this.force.normalize().scale(this.speed);
        }
    }

    if(this.entity.rigidbody.friction != current_friction) {
        this.entity.rigidbody.friction = current_friction;
    }

    if(this.speeed != current_speed) {
        this.speed = current_speed;
    }

    if(this.app.systems.rigidbody.gravity != current_gravity) {
        this.app.systems.rigidbody.gravity = current_gravity;
    }
    
    //-------------------------------------------------------------------------------------------------
    //NETWORKING
    if(!this.force.length()) return;
    try {
        let playerid = getPlayer(myName);
        //Prevent players from hitting if they have gone over the max shot count
        if(GRD.Players[playerid].myScores[GRD.holeNumber - 1] < GRD.maxShots) {
            if(GRD.hostSocketId != sockets.id)  {
                host_recieved = false;
                sendPlayerInput(this.force);
            } else {
                //First hit of the hole
                if(GRD.Players[playerid].myReady == true && GRD.Players[playerid].myScores[GRD.holeNumber - 1] == 0) {
                    GRD.Players[playerid].myReady = false;
                }
                this.entity.rigidbody.applyImpulse(this.force);
                GRD.Players[playerid].myScores[GRD.holeNumber - 1]++;
                if(GRD.Players[playerid].myScores[GRD.holeNumber - 1] >= GRD.maxShots) {
                    GRD.Players[playerid].myReady = true;
                }
            }
        }
    } catch (error) {
        //console.log(error);
        this.entity.rigidbody.applyImpulse(this.force);
    }
    //-------------------------------------------------------------------------------------------------
};


// teleportable.js
var Teleportable = pc.createScript('teleportable');

// initialize code called once per entity
Teleportable.prototype.initialize = function() {
    this.lastTeleportFrom = null;
    this.lastTeleportTo = null;
    this.lastTeleport = Date.now(); 
    this.startPosition = this.entity.getPosition().clone();       
};

// update code called every frame
Teleportable.prototype.update = function(dt) {
    // Make sure we don't fall over. If we do then
    // teleport to the last location
    var pos = this.entity.getPosition();
    if (!this.enabled) return;
    //if (pos.y < 0) {this.teleport(this.lastTeleportFrom, this.lastTeleportTo);}
};


Teleportable.prototype.teleport = function(from, to) {
    // can't teleport too often (500ms)
    if (from && (Date.now() - this.lastTeleport) < 500)
        return;

    // set new teleport time
    this.lastTeleport = Date.now();

    // set last teleport targets
    this.lastTeleportFrom = from;
    this.lastTeleportTo = to;

    // position to teleport to
    var position;

    if (to) {
        // from target
        position = to.getPosition();
        // move a bit higher
        position.y += 0.5;
    } else {
        // to respawn location
        position = this.startPosition;
    }

    // move ball to that point
    this.entity.rigidbody.teleport(position);
    // need to reset angular and linear forces
    this.entity.rigidbody.linearVelocity = pc.Vec3.ZERO;
    this.entity.rigidbody.angularVelocity = pc.Vec3.ZERO;            
};


// teleport.js
var Teleport = pc.createScript('teleport');

Teleport.attributes.add('target', {
    type: 'entity',
    title: 'Target Entity',
    description: 'The target entity where we are going to teleport'
});

// initialize code called once per entity
Teleport.prototype.initialize = function() {
    if (this.target) {
        // Subscribe to the triggerenter event of this entity's collision component.
        // This will be fired when a rigid body enters this collision volume.
        this.entity.collision.on('triggerenter', this.onTriggerEnter, this);
    }
};

Teleport.prototype.onTriggerEnter = function (otherEntity) {
    // it is not teleportable
    if (! otherEntity.script.teleportable)
        return;

    //-----------------------------------------------------------------------------------------------
    //NETWORK
    try {
        //If player is not the host, then do not activate
        if(sockets.id != GRD.hostSocketId) {
            return;
        }
        
    } catch (error) {
        //console.log(error);
    }
    //------------------------------------------------------------------------------------------------

    // teleport entity to the target entity
    otherEntity.script.teleportable.teleport(this.entity, this.target);

    loadScene('Scene 2', { hierarchy: true, settings: true }, (err, loadedSceneRootEntity) => {
        if (err) {
            console.error(err);
        } else {
            // Scene hierachary has successfully been loaded
            console.log("PLAYCANVAS: Loaded new scene!");
        }
    });
};


// orbitCamera.js
var OrbitCamera = pc.createScript('orbitCamera');
var camera_direction;
var current_fov;

OrbitCamera.attributes.add('autoRender', {
    type: 'boolean', 
    default: true, 
    title: 'Auto Render', 
    description: 'Disable to only render when camera is moving (saves power when the camera is still)'
});

OrbitCamera.attributes.add('distanceMax', {type: 'number', default: 0, title: 'Distance Max', description: 'Setting this at 0 will give an infinite distance limit'});
OrbitCamera.attributes.add('distanceMin', {type: 'number', default: 0, title: 'Distance Min'});
OrbitCamera.attributes.add('pitchAngleMax', {type: 'number', default: 90, title: 'Pitch Angle Max (degrees)'});
OrbitCamera.attributes.add('pitchAngleMin', {type: 'number', default: -90, title: 'Pitch Angle Min (degrees)'});

OrbitCamera.attributes.add('inertiaFactor', {
    type: 'number',
    default: 0,
    title: 'Inertia Factor',
    description: 'Higher value means that the camera will continue moving after the user has stopped dragging. 0 is fully responsive.'
});

OrbitCamera.attributes.add('focusEntity', {
    type: 'entity',
    title: 'Focus Entity',
    description: 'Entity for the camera to focus on. If blank, then the camera will use the whole scene'
});

OrbitCamera.attributes.add('frameOnStart', {
    type: 'boolean',
    default: true,
    title: 'Frame on Start',
    description: 'Frames the entity or scene at the start of the application."'
});


// Property to get and set the distance between the pivot point and camera
// Clamped between this.distanceMin and this.distanceMax
Object.defineProperty(OrbitCamera.prototype, "distance", {
    get: function() {
        return this._targetDistance;
    },

    set: function(value) {
        this._targetDistance = this._clampDistance(value);
    }
});


// Property to get and set the pitch of the camera around the pivot point (degrees)
// Clamped between this.pitchAngleMin and this.pitchAngleMax
// When set at 0, the camera angle is flat, looking along the horizon
Object.defineProperty(OrbitCamera.prototype, "pitch", {
    get: function() {
        return this._targetPitch;
    },

    set: function(value) {
        this._targetPitch = this._clampPitchAngle(value);
    }
});


// Property to get and set the yaw of the camera around the pivot point (degrees)
Object.defineProperty(OrbitCamera.prototype, "yaw", {
    get: function() {
        return this._targetYaw;
    },

    set: function(value) {
        this._targetYaw = value;

        // Ensure that the yaw takes the shortest route by making sure that 
        // the difference between the targetYaw and the actual is 180 degrees
        // in either direction
        var diff = this._targetYaw - this._yaw;
        var reminder = diff % 360;
        if (reminder > 180) {
            this._targetYaw = this._yaw - (360 - reminder);
        } else if (reminder < -180) {
            this._targetYaw = this._yaw + (360 + reminder);
        } else {
            this._targetYaw = this._yaw + reminder;
        }
    }
});


// Property to get and set the world position of the pivot point that the camera orbits around
Object.defineProperty(OrbitCamera.prototype, "pivotPoint", {
    get: function() {
        return this._pivotPoint;
    },

    set: function(value) {
        this._pivotPoint.copy(value);
    }
});


// Moves the camera to look at an entity and all its children so they are all in the view
OrbitCamera.prototype.focus = function (focusEntity) {
    // Calculate an bounding box that encompasses all the models to frame in the camera view
    this._buildAabb(focusEntity, 0);

    var halfExtents = this._modelsAabb.halfExtents;

    var distance = Math.max(halfExtents.x, Math.max(halfExtents.y, halfExtents.z));
    distance = (distance / Math.tan(0.5 * this.entity.camera.fov * pc.math.DEG_TO_RAD));
    distance = (distance * 2);

    this.distance = distance;

    this._removeInertia();

    this._pivotPoint.copy(this._modelsAabb.center);
};


OrbitCamera.distanceBetween = new pc.Vec3();

// Set the camera position to a world position and look at a world position
// Useful if you have multiple viewing angles to swap between in a scene
OrbitCamera.prototype.resetAndLookAtPoint = function (resetPoint, lookAtPoint) {
    this.entity.setPosition(resetPoint);

    

    var distance = OrbitCamera.distanceBetween;
    distance.sub2(lookAtPoint, resetPoint);
    this.distance = distance.length();

    this.entity.lookAt(lookAtPoint);
    this.pivotPoint.copy(lookAtPoint);

    var cameraQuat = this.entity.getRotation();
    this.yaw = this._calcYaw(cameraQuat);
    this.pitch = this._calcPitch(cameraQuat, this.yaw);

    this._removeInertia();
    this._updatePosition();

    if (!this.autoRender) {
        this.app.renderNextFrame = true;
    }
};


// Set camera position to a world position and look at an entity in the scene
// Useful if you have multiple models to swap between in a scene
OrbitCamera.prototype.resetAndLookAtEntity = function (resetPoint, entity) {
    this._buildAabb(entity, 0);
    this.resetAndLookAtPoint(resetPoint, this._modelsAabb.center);
};


// Set the camera at a specific, yaw, pitch and distance without inertia (instant cut)
OrbitCamera.prototype.reset = function (yaw, pitch, distance) {
    this.pitch = pitch;
    this.yaw = yaw;
    this.distance = distance;

    this._removeInertia();

    if (!this.autoRender) {
        this.app.renderNextFrame = true;
    }
};

/////////////////////////////////////////////////////////////////////////////////////////////
// Private methods

OrbitCamera.prototype.initialize = function () {
    this._checkAspectRatio();

    // Find all the models in the scene that are under the focused entity
    this._modelsAabb = new pc.BoundingBox();
    this._buildAabb(this.focusEntity || this.app.root, 0);

    this.entity.lookAt(this._modelsAabb.center);

    //Set Pivot Position
    this._pivotPoint = new pc.Vec3();
    if(current_ball_pos) {
        this._pivotPoint.copy(current_ball_pos);
    } else {
        this._pivotPoint.copy(this._modelsAabb.center);
    }

    // Calculate the camera euler angle rotation around x and y axes
    // This allows us to place the camera at a particular rotation to begin with in the scene
    var cameraQuat = this.entity.getRotation();

    // Preset the camera
    this._yaw = this._calcYaw(cameraQuat);
    this._pitch = this._clampPitchAngle(this._calcPitch(cameraQuat, this._yaw));

    
    this.entity.setLocalEulerAngles(this._pitch, this._yaw, 0);
    

    this._distance = 0;

    this._targetYaw = this._yaw;
    this._targetPitch = this._pitch;

    //Get Global Copy of Camera Direction for camera based movements
    camera_direction = this.entity.getRotation();
    current_fov = this.entity.camera.fov;

    // If we have ticked focus on start, then attempt to position the camera where it frames
    // the focused entity and move the pivot point to entity's position otherwise, set the distance
    // to be between the camera position in the scene and the pivot point
    if (this.frameOnStart) {
        this.focus(this.focusEntity || this.app.root);
    } else {
        var distanceBetween = new pc.Vec3();
        distanceBetween.sub2(this.entity.getPosition(), this._pivotPoint);
        this._distance = this._clampDistance(distanceBetween.length());
    }

    this._targetDistance = this._distance;

    this._autoRenderDefault = this.app.autoRender;

    // Do not enable autoRender if it's already off as it's controlled elsewhere
    if (this.app.autoRender) {
        this.app.autoRender = this.autoRender;
    }

    if (!this.autoRender) {
        this.app.renderNextFrame = true;
    }

    this.on('attr:autoRender', function (value, prev) {
        this.app.autoRender = value;
        if (!this.autoRender) {
            this.app.renderNextFrame = true;
        }
    }, this);

    // Reapply the clamps if they are changed in the editor
    this.on('attr:distanceMin', function (value, prev) {
        this._targetDistance = this._clampDistance(this._distance);
    }, this);

    this.on('attr:distanceMax', function (value, prev) {
        this._targetDistance = this._clampDistance(this._distance);
    }, this);

    this.on('attr:pitchAngleMin', function (value, prev) {
        this._targetPitch = this._clampPitchAngle(this._pitch);
    }, this);

    this.on('attr:pitchAngleMax', function (value, prev) {
        this._targetPitch = this._clampPitchAngle(this._pitch);
    }, this);

    // Focus on the entity if we change the focus entity
    this.on('attr:focusEntity', function (value, prev) {
        if (this.frameOnStart) {
            this.focus(value || this.app.root);
        } else {
            this.resetAndLookAtEntity(this.entity.getPosition(), value || this.app.root);
        }
    }, this);

    this.on('attr:frameOnStart', function (value, prev) {
        if (value) {
            this.focus(this.focusEntity || this.app.root);
        }
    }, this);

    var onResizeCanvas = function () {
        this._checkAspectRatio();
        if (!this.autoRender) {
            this.app.renderNextFrame = true;
        }
    };

    this.app.graphicsDevice.on('resizecanvas', onResizeCanvas, this);

    this.on('destroy', function() {
        this.app.graphicsDevice.off('resizecanvas', onResizeCanvas, this);
        this.app.autoRender = this._autoRenderDefault;
    }, this);
};


OrbitCamera.prototype.update = function(dt) {
    // Check if we have are still moving for autorender
    if (!this.autoRender) {
        var distanceDiff = Math.abs(this._targetDistance - this._distance);
        var yawDiff = Math.abs(this._targetYaw - this._yaw);
        var pitchDiff = Math.abs(this._targetPitch - this._pitch);

        this.app.renderNextFrame = this.app.renderNextFrame || distanceDiff > 0.01 || yawDiff > 0.01 || pitchDiff > 0.01;
    }

    // Add inertia, if any
    var t = this.inertiaFactor === 0 ? 1 : Math.min(dt / this.inertiaFactor, 1);
    this._distance = pc.math.lerp(this._distance, this._targetDistance, t);
    this._yaw = pc.math.lerp(this._yaw, this._targetYaw, t);
    this._pitch = pc.math.lerp(this._pitch, this._targetPitch, t);

    //Get Global Copy of Camera Direction for camera based movements
    camera_direction = this.entity.getRotation();
    if(this.entity.camera.fov != current_fov) {
        this.entity.camera.fov = current_fov;
    }

    //Update Pivot Point
    if(current_ball_pos) {
        this._pivotPoint.copy(current_ball_pos);
    } else {
        this._pivotPoint.copy(this._modelsAabb.center);
    }

    //Update Camera Position
    this._updatePosition();
};


OrbitCamera.prototype._updatePosition = function () {
    // Work out the camera position based on the pivot point, pitch, yaw and distance

    if (ballSelected == false) {
        this.entity.setLocalPosition(0,0,0);
        this.entity.setLocalEulerAngles(this._pitch, this._yaw, 0);

        var position = this.entity.getPosition();
        position.copy(this.entity.forward);
        position.scale(-this._distance);
        position.add(this.pivotPoint);
        this.entity.setPosition(position);
    }
};


OrbitCamera.prototype._removeInertia = function () {
    this._yaw = this._targetYaw;
    this._pitch = this._targetPitch;
    this._distance = this._targetDistance;
};


OrbitCamera.prototype._checkAspectRatio = function () {
    var height = this.app.graphicsDevice.height;
    var width = this.app.graphicsDevice.width;

    // Match the axis of FOV to match the aspect ratio of the canvas so
    // the focused entities is always in frame
    this.entity.camera.horizontalFov = height > width;
};


OrbitCamera.prototype._buildAabb = function (entity, modelsAdded) {
    var i = 0, j = 0, meshInstances;
    
    if (entity instanceof pc.Entity) {
        var allMeshInstances = [];
        var renders = entity.findComponents('render');

        for (i = 0; i < renders.length; ++i) {
            meshInstances = renders[i].meshInstances;
            if (meshInstances) {
                for (j = 0; j < meshInstances.length; j++) {
                    allMeshInstances.push(meshInstances[j]);
                }
            }
        }  

        var models = entity.findComponents('model');
        for (i = 0; i < models.length; ++i) {
            meshInstances = models[i].meshInstances;
            if (meshInstances) {
                for (j = 0; j < meshInstances.length; j++) {
                    allMeshInstances.push(meshInstances[j]);
                }
            }
        }  

        for (i = 0; i < allMeshInstances.length; i++) {
            if (modelsAdded === 0) {
                this._modelsAabb.copy(allMeshInstances[i].aabb);
            } else {
                this._modelsAabb.add(allMeshInstances[i].aabb);
            }

            modelsAdded += 1;
        }
    }

    for (i = 0; i < entity.children.length; ++i) {
        modelsAdded += this._buildAabb(entity.children[i], modelsAdded);
    }

    return modelsAdded;
};


OrbitCamera.prototype._calcYaw = function (quat) {
    var transformedForward = new pc.Vec3();
    quat.transformVector(pc.Vec3.FORWARD, transformedForward);

    return Math.atan2(-transformedForward.x, -transformedForward.z) * pc.math.RAD_TO_DEG;
};


OrbitCamera.prototype._clampDistance = function (distance) {
    if (this.distanceMax > 0) {
        return pc.math.clamp(distance, this.distanceMin, this.distanceMax);
    } else {
        return Math.max(distance, this.distanceMin);
    }
};


OrbitCamera.prototype._clampPitchAngle = function (pitch) {
    // Negative due as the pitch is inversed since the camera is orbiting the entity
    return pc.math.clamp(pitch, -this.pitchAngleMax, -this.pitchAngleMin);
};


OrbitCamera.quatWithoutYaw = new pc.Quat();
OrbitCamera.yawOffset = new pc.Quat();

OrbitCamera.prototype._calcPitch = function(quat, yaw) {
    var quatWithoutYaw = OrbitCamera.quatWithoutYaw;
    var yawOffset = OrbitCamera.yawOffset;

    yawOffset.setFromEulerAngles(0, -yaw, 0);
    quatWithoutYaw.mul2(yawOffset, quat);

    var transformedForward = new pc.Vec3();

    quatWithoutYaw.transformVector(pc.Vec3.FORWARD, transformedForward);

    return Math.atan2(transformedForward.y, -transformedForward.z) * pc.math.RAD_TO_DEG;
};

// mouseInput.js
var MouseInput = pc.createScript('mouseInput');

var current_sensitivity;
var mouseDistance;
var isMousePressed = false;

MouseInput.attributes.add('orbitSensitivity', {
    type: 'number', 
    default: 0.3, 
    title: 'Orbit Sensitivity', 
    description: 'How fast the camera moves around the orbit. Higher is faster'
});

MouseInput.attributes.add('distanceSensitivity', {
    type: 'number', 
    default: 0.15, 
    title: 'Distance Sensitivity', 
    description: 'How fast the camera moves in and out. Higher is faster'
});

// initialize code called once per entity
MouseInput.prototype.initialize = function() {
    this.orbitCamera = this.entity.script.orbitCamera;
        
    if (this.orbitCamera) {
        var self = this;
        
        var onMouseOut = function (e) {
           self.onMouseOut(e);
        };
        
        this.app.mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
        this.app.mouse.on(pc.EVENT_MOUSEUP, this.onMouseUp, this);
        this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
        this.app.mouse.on(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);

        // Listen to when the mouse travels out of the window
        window.addEventListener('mouseout', onMouseOut, false);
        
        // Remove the listeners so if this entity is destroyed
        this.on('destroy', function() {
            this.app.mouse.off(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
            this.app.mouse.off(pc.EVENT_MOUSEUP, this.onMouseUp, this);
            this.app.mouse.off(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
            this.app.mouse.off(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);

            window.removeEventListener('mouseout', onMouseOut, false);
        });
    }
    
    // Disabling the context menu stops the browser displaying a menu when
    // you right-click the page
    this.app.mouse.disableContextMenu();
  
    this.lookButtonDown = false;
    this.panButtonDown = false;
    this.lastPoint = new pc.Vec2();
    this.startPoint = new pc.Vec2();


    if(!current_sensitivity) current_sensitivity = this.orbitSensitivity;
};

MouseInput.prototype.update = function() { 
    if(this.orbitSensitivity != current_sensitivity) {
        this.orbitSensitivity = current_sensitivity;
    }
};


MouseInput.fromWorldPoint = new pc.Vec3();
MouseInput.toWorldPoint = new pc.Vec3();
MouseInput.worldDiff = new pc.Vec3();


MouseInput.prototype.pan = function(screenPoint) {
    var fromWorldPoint = MouseInput.fromWorldPoint;
    var toWorldPoint = MouseInput.toWorldPoint;
    var worldDiff = MouseInput.worldDiff;
    
    // For panning to work at any zoom level, we use screen point to world projection
    // to work out how far we need to pan the pivotEntity in world space 
    var camera = this.entity.camera;
    var distance = this.orbitCamera.distance;
    
    camera.screenToWorld(screenPoint.x, screenPoint.y, distance, fromWorldPoint);
    camera.screenToWorld(this.lastPoint.x, this.lastPoint.y, distance, toWorldPoint);

    worldDiff.sub2(toWorldPoint, fromWorldPoint);
       
    this.orbitCamera.pivotPoint.add(worldDiff);    
};


MouseInput.prototype.onMouseDown = function (event) {
    
    //Edit isMousePressed
    isMousePressed = true;

    switch (event.button) {
        case pc.MOUSEBUTTON_LEFT: {
            this.lookButtonDown = true;
            this.startPoint.set(event.x, event.y);
        } break;
            
        case pc.MOUSEBUTTON_MIDDLE: 
        case pc.MOUSEBUTTON_RIGHT: {
            this.panButtonDown = true;
        } break;
    }
};


MouseInput.prototype.onMouseUp = function (event) {

    //Edit isMousePressed
    isMousePressed = false;

    switch (event.button) {
        case pc.MOUSEBUTTON_LEFT: {
            this.lookButtonDown = false;
        } break;
            
        case pc.MOUSEBUTTON_MIDDLE: 
        case pc.MOUSEBUTTON_RIGHT: {
            this.panButtonDown = false;            
        } break;
    }
};


MouseInput.prototype.onMouseMove = function (event) {    
    var mouse = pc.app.mouse;
    if (ballSelected == false) {
        if (this.lookButtonDown) {
            this.orbitCamera.pitch -= event.dy * this.orbitSensitivity;
            this.orbitCamera.yaw -= event.dx * this.orbitSensitivity;
            
        } else if (this.panButtonDown) {
            this.pan(event);   
        }
        this.lastPoint.set(event.x, event.y);
    }
    mouseDistance = Math.sqrt(Math.pow(event.x - this.startPoint.x,2) + Math.pow(event.y - this.startPoint.y,2));
};


MouseInput.prototype.onMouseWheel = function (event) {
    this.orbitCamera.distance -= event.wheel * this.distanceSensitivity * (this.orbitCamera.distance * 0.1);
    event.event.preventDefault();
};


MouseInput.prototype.onMouseOut = function (event) {
    this.lookButtonDown = false;
    this.panButtonDown = false;
};

// touchInput.js
var TouchInput = pc.createScript('touchInput');
var isTouchPressed = false;

TouchInput.attributes.add('orbitSensitivity', {
    type: 'number', 
    default: 0.4, 
    title: 'Orbit Sensitivity', 
    description: 'How fast the camera moves around the orbit. Higher is faster'
});

TouchInput.attributes.add('distanceSensitivity', {
    type: 'number', 
    default: 0.2, 
    title: 'Distance Sensitivity', 
    description: 'How fast the camera moves in and out. Higher is faster'
});

// initialize code called once per entity
TouchInput.prototype.initialize = function() {
    this.orbitCamera = this.entity.script.orbitCamera;
    
    // Store the position of the touch so we can calculate the distance moved
    this.lastTouchPoint = new pc.Vec2();
    this.lastPinchMidPoint = new pc.Vec2();
    this.lastPinchDistance = 0;
    
    if (this.orbitCamera && this.app.touch) {
        // Use the same callback for the touchStart, touchEnd and touchCancel events as they 
        // all do the same thing which is to deal the possible multiple touches to the screen
        this.app.touch.on(pc.EVENT_TOUCHSTART, this.onTouchStartEndCancel, this);
        this.app.touch.on(pc.EVENT_TOUCHEND, this.onTouchStartEndCancel, this);
        this.app.touch.on(pc.EVENT_TOUCHCANCEL, this.onTouchStartEndCancel, this);

        //Edit isTouchPressed
        this.app.touch.on(pc.EVENT_TOUCHSTART, (e) => {
            isTouchPressed = true;
            this.startPoint = {x: e.touches[0].x, y: e.touches[0].y};
        }, this);
        this.app.touch.on(pc.EVENT_TOUCHMOVE, () => {isTouchPressed = true;}, this);
        this.app.touch.on(pc.EVENT_TOUCHEND, () => {isTouchPressed = false;}, this);
        
        this.app.touch.on(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
        
        this.on('destroy', function() {
            this.app.touch.off(pc.EVENT_TOUCHSTART, this.onTouchStartEndCancel, this);
            this.app.touch.off(pc.EVENT_TOUCHEND, this.onTouchStartEndCancel, this);
            this.app.touch.off(pc.EVENT_TOUCHCANCEL, this.onTouchStartEndCancel, this);

            this.app.touch.off(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
        });
    }


    if(!current_sensitivity) current_sensitivity =  this.orbitSensitivity;
};

TouchInput.prototype.update = function() { 
    if(this.orbitSensitivity != current_sensitivity) {
        this.orbitSensitivity = current_sensitivity;
    }
};


TouchInput.prototype.getPinchDistance = function (pointA, pointB) {
    // Return the distance between the two points
    var dx = pointA.x - pointB.x;
    var dy = pointA.y - pointB.y;    
    
    return Math.sqrt((dx * dx) + (dy * dy));
};


TouchInput.prototype.calcMidPoint = function (pointA, pointB, result) {
    result.set(pointB.x - pointA.x, pointB.y - pointA.y);
    result.scale(0.5);
    result.x += pointA.x;
    result.y += pointA.y;
};


TouchInput.prototype.onTouchStartEndCancel = function(event) {
    // We only care about the first touch for camera rotation. As the user touches the screen, 
    // we stored the current touch position
    var touches = event.touches;
    if (touches.length == 1) {
        this.lastTouchPoint.set(touches[0].x, touches[0].y);
    
    } else if (touches.length == 2) {
        // If there are 2 touches on the screen, then set the pinch distance
        this.lastPinchDistance = this.getPinchDistance(touches[0], touches[1]);
        this.calcMidPoint(touches[0], touches[1], this.lastPinchMidPoint);
    }
};


TouchInput.fromWorldPoint = new pc.Vec3();
TouchInput.toWorldPoint = new pc.Vec3();
TouchInput.worldDiff = new pc.Vec3();

this.lastPoint = new pc.Vec2();
this.startPoint = new pc.Vec2();



TouchInput.prototype.pan = function(midPoint) {
    var fromWorldPoint = TouchInput.fromWorldPoint;
    var toWorldPoint = TouchInput.toWorldPoint;
    var worldDiff = TouchInput.worldDiff;
    
    // For panning to work at any zoom level, we use screen point to world projection
    // to work out how far we need to pan the pivotEntity in world space 
    var camera = this.entity.camera;
    var distance = this.orbitCamera.distance;
    
    camera.screenToWorld(midPoint.x, midPoint.y, distance, fromWorldPoint);
    camera.screenToWorld(this.lastPinchMidPoint.x, this.lastPinchMidPoint.y, distance, toWorldPoint);
    
    worldDiff.sub2(toWorldPoint, fromWorldPoint);
     
    this.orbitCamera.pivotPoint.add(worldDiff);    
};


TouchInput.pinchMidPoint = new pc.Vec2();


TouchInput.prototype.onTouchMove = function(event) {
    var pinchMidPoint = TouchInput.pinchMidPoint;
    
    // We only care about the first touch for camera rotation. Work out the difference moved since the last event
    // and use that to update the camera target position 
    let touches = event.touches;
    let touch = touches[0];
    if (ballSelected == false) {
        if (touches.length == 1) {
            this.orbitCamera.pitch -= (touch.y - this.lastTouchPoint.y) * this.orbitSensitivity;
            this.orbitCamera.yaw -= (touch.x - this.lastTouchPoint.x) * this.orbitSensitivity;
            
            this.lastTouchPoint.set(touch.x, touch.y);
        
        } else if (touches.length == 2) {
            // Calculate the difference in pinch distance since the last event
            var currentPinchDistance = this.getPinchDistance(touches[0], touches[1]);
            var diffInPinchDistance = currentPinchDistance - this.lastPinchDistance;
            this.lastPinchDistance = currentPinchDistance;
                    
            this.orbitCamera.distance -= (diffInPinchDistance * this.distanceSensitivity * 0.1) * (this.orbitCamera.distance * 0.1);
            
            // Calculate pan difference
            this.calcMidPoint(touches[0], touches[1], pinchMidPoint);
            this.pan(pinchMidPoint);
            this.lastPinchMidPoint.copy(pinchMidPoint);
        }
    }
    mouseDistance = Math.sqrt(Math.pow(touch.x - this.startPoint.x,2) + Math.pow(touch.y - this.startPoint.y,2));
};


// load-scene-helper.js
    /**
     * @name loadScene
     * @function
     * @description Loads a scene hierarchy and settings depending on the options.
     * @param {string} sceneName - Name of the scene to load.
     * @param {Object} [options] - Optional. Extra options to do extra processing on the GLB.
     * @param {boolean} [options.hierarchy] - Optional. Set to true if you want to load the scene hierarchy.
     * @param {boolean} [options.settings] - Optional. Set to true if you want to load the scene settings.
     * @param {pc.callbacks.LoadHierarchy} [callback] - Optional. This is called if there is an error or if the scene is loaded successfully.
     * @param {Object} [scope] - The object scope to call the callback with.
     */

function loadScene(sceneName, options, callback, scope) {
    var app = pc.Application.getApplication();
    var scene = app.scenes.find(sceneName);

    if (scene) {
        // Check if the scene data is already loaded, if it is we should assume
        // that it stay cached after we loaded the scene and added the 
        // entities to the scene graph
        var wasSceneLoaded = scene.loaded;

        app.scenes.loadSceneData(scene, function(err, scene) {
            if (err) {
                if (callback) {
                    callback.call(scope, err);
                }
            } else {
                var sceneParent = null;

                // Destroy all the entities on the app.root to completely remove 
                // the existing scenes
                var rootChildren = app.root.children;
                while(rootChildren.length > 0) {
                    rootChildren[0].destroy();
                }

                // As we've already loaded the scene data, the callbacks for these
                // functions will be called immediately
                if (options.settings) {
                    app.scenes.loadSceneSettings(scene, function (err) {
                        if (err && callback) {
                            callback.call(scope, err);
                        }
                    });
                }

                if (options.hierarchy) {
                    app.scenes.loadSceneHierarchy(scene, function (err, parent) {
                        if (err) {
                            if (callback) {
                                callback(err);
                            }
                        } else {
                            sceneParent = parent;
                        }
                    });
                }

                if (!wasSceneLoaded) {
                    app.scenes.unloadSceneData(scene);
                }

                if (callback) {
                    callback.call(scope, null, sceneParent);
                }
            }
        });
    } else {
        if (callback) {
            callback.call(scope, "Scene not found: " + sceneName);
        }
    }
}

// gameUpdater.js
//-------------------------------------------------------------------------------------------------
//NETWORKING
var GameUpdater = pc.createScript('gameUpdater');   //GameUpdater Object
var thisPlayer; //Contains data of this player's ball in the world
var thisOther;  //Contains data of other players' balls in the world
var thisText; //Nameplate for each ball
//Incremented each update cycle
var tick = 0;
//How many update frames before a game update is sent to players
var tick_ratio = 16;

//Keep track of countdowns
var intervalID;
var intervalHTML;

// initialize code called once per entity
GameUpdater.prototype.initialize = function() {
    thisPlayer = this.app.root.findByName('ball');
    thisOther = this.app.root.findByName('other_ball');
    thisText = this.app.root.findByName('MyBallText');
    console.log("PLAYCANVAS: Loading Complete!");
    loaded = true;
};

// update code called every frame
GameUpdater.prototype.update = function(dt) {
    //If this script is being ran without network.js
    try {
        if(GRD);
    } catch (error) {
        //console.log(error);
        return;
    }

    // for (let name in this.playerArray) {
    //     let nameid = getPlayer(name);
    //     if(GRD.Players[nameid].myReady) {
    //         this.playerArray[name].collision.enabled = false;
    //     } else {
    //         this.playerArray[name].collision.enabled = true;
    //     }
    // }

    //Update only once every tick_ratio ticks
    tick++;
    if(tick <= tick_ratio) return;
    tick = 0;

    //Check Ready Up
    if(GRD.holeNumber == 0) {
        //If Host
        if(sockets.id == GRD.hostSocketId) {
            if(checkReadyUp() == true) {
                if(GRD.timeLeft == 'NULL') {
                    startCountdown(20);
                    //Set every score to 0
                    for (let i = 0; i < GRD.Players.length; i++ ) {
                        if(GRD.Players[i] != "EMPTY") {
                            for (let k = 0; k < GRD.Players[i].myScores.length; k++) {
                                if(GRD.Players[i].myScores[k] != 0) GRD.Players[i].myScores[k] = 0;
                            }
                        }
                    }
                }
            } else {
                stopCoundown();
            }
        }

        //If anyone (for graphics)
        let myid = getPlayer(myName);
        if(GRD.timeLeft != "NULL") {
            let ready_button = document.getElementById("readyButton");
            ready_button.innerHTML = "Starting in... " + GRD.timeLeft;
        } else {
            let ready_button = document.getElementById("readyButton");
            if(ready_button.innerHTML != "READY" && ready_button.innerHTML != "NOT READY") {
                ready_button.innerHTML = GRD.Players[myid].myReady ? "READY" : 'NOT READY';
            }
        }
    } else {
        //If Host
        if(sockets.id == GRD.hostSocketId) {
            if(GRD.timeLeft == 'NULL') {
                //Ended hole, penalize DNF players
                for (let i = 0; i < GRD.Players.length; i++) {
                    if(GRD.Players[i] != "EMPTY") {
                        if(GRD.Players[i].myReady == false && GRD.holeNumber > 1) {
                            GRD.Players[i].myScores[GRD.holeNumber - 2] = GRD.maxShots;
                        } else {
                            //Person did not even move last round, penalize them.
                            if(GRD.Players[i].myScores[GRD.holeNumber - 2] == 0) {
                                GRD.Players[i].myScores[GRD.holeNumber - 2] = GRD.maxShots;
                            }
                        }
                    }
                }

                //Set everyone to ready to prevent collision
                for (let i = 0; i < GRD.Players.length; i++) {
                    if(GRD.Players[i] != "EMPTY") {
                        if(GRD.Players[i].myScores[GRD.holeNumber - 1] == 0) GRD.Players[i].myReady = true;
                    }
                }

                //New hole not set up yet, teleport players and start countdown
                let start_entity_name = "hole_start_" + GRD.holeNumber;
                let start_entity = this.app.root.findByName(start_entity_name);
                if(GRD.origin != start_entity.getPosition()) {
                    GRD.origin = start_entity.getPosition();
                    for (let i = 0; i < GRD.Players.length; i++) {
                        if(GRD.Players[i] != "EMPTY") {
                            GRD.Players[i].myPosition = GRD.origin;
                            GRD.Players[i].myLinVelocity = pc.Vec3.ZERO;
                            GRD.Players[i].myAngVelocity = pc.Vec3.ZERO;
                            if(this.playerArray[GRD.Players[i].myName].rigidbody) this.playerArray[GRD.Players[i].myName].rigidbody.teleport(GRD.origin.x, GRD.origin.y + 1, GRD.origin.z);
                        }
                    }
                }
                startCountdown(GRD.timeLimit);
            } else {
                //If everyone is ready and everyone someone hit during the round, go to next hole
                if(checkReadyUp() == true && checkNoHits() == false && checkHasVelocity(this.playerArray) == false) {
                    stopCoundown();
                    if(GRD.holeNumber < GRD.holeLimit) {
                        GRD.holeNumber++;
                    } else {
                        //End end game
                        //Set everyone to unready   
                        for (let i = 0; i < GRD.Players.length; i++) if(GRD.Players[i] != "EMPTY") GRD.Players[i].myReady = false;
                        //Teleport everyone back to the waiting room
                        GRD.holeNumber = 0;
                        let start_entity_name = "waiting_room_start";
                        let start_entity = this.app.root.findByName(start_entity_name);
                        if(GRD.origin != start_entity.getPosition()) {
                            GRD.origin = start_entity.getPosition();
                            for (let i = 0; i < GRD.Players.length; i++) {
                                if(GRD.Players[i] != "EMPTY") {
                                    GRD.Players[i].myPosition = GRD.origin;
                                    GRD.Players[i].myLinVelocity = pc.Vec3.ZERO;
                                    GRD.Players[i].myAngVelocity = pc.Vec3.ZERO;
                                    if(this.playerArray[GRD.Players[i].myName].rigidbody) this.playerArray[GRD.Players[i].myName].rigidbody.teleport(GRD.origin.x, GRD.origin.y + 1, GRD.origin.z);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    //Update Cookies
    updateCookies();

    //Run this script with network.js
    if(sockets.id == GRD.hostSocketId) {
        for(let name in this.playerArray) {
            if(this.playerArray[name] == undefined) {continue;}
            let i = getPlayer(name);
            //If player went out of bounds, reset location
            if(this.playerArray[name].getPosition().y < 0) {
                this.playerArray[name].rigidbody.teleport(GRD.origin.x, GRD.origin.y + 1, GRD.origin.z);
                this.playerArray[name].rigidbody.angularVelocity = pc.Vec3.ZERO;
                this.playerArray[name].rigidbody.linearVelocity = pc.Vec3.ZERO;
            }
            GRD.Players[i].myPosition = this.playerArray[name].getPosition().clone();
            GRD.Players[i].myLinVelocity = this.playerArray[name].rigidbody.linearVelocity.clone();
            GRD.Players[i].myAngVelocity = this.playerArray[name].rigidbody.angularVelocity.clone();
        }

        //Prevent Teleportation if not host
        if(!thisPlayer.script.teleportable.enabled) thisPlayer.script.teleportable.enabled = true;
        sendGameUpdate();
    } else {
        if(thisPlayer.script.teleportable.enabled) thisPlayer.script.teleportable.enabled = false;
    }
};

//Update World Player Data
GameUpdater.prototype.initializePlayers = function (data) {
    // data = {Players: name:}
    //If a player change, remove all balls in world
    if(this.playerArray) {
        for(let name in this.playerArray) {
            if(name != data.name) {
                if(this.playerArray[name].namePlate) this.playerArray[name].namePlate.destroy();
                this.playerArray[name].destroy();
                this.playerArray[name] = undefined;
            }
        }
    } 
    this.playerArray = [];
    //Create Array of All OTHER players in game
    //For every other player in lobby create object
    for (let i = 0; i < data.Players.length; i++) {
        if(data.Players[i] != 'EMPTY') {
            if(data.Players[i].myName != data.name) {
                this.playerArray[data.Players[i].myName] = this.createPlayerEnitity(
                    data.Players[i].myPosition,
                    data.Players[i].myLinVelocity,
                    data.Players[i].myAngVelocity,
                    data.Players[i].myName
                );
            }  else {
                if(this.playerArray[data.name] == undefined) {this.playerArray[data.name] = thisPlayer;}
            }
        }
    }
    this.initialized = true;
};

//Remove Player
GameUpdater.prototype.removePlayerBall = function (name) {
    if(this.playerArray[name] == undefined) {console.log("PLAYCANVAS: BALL DOES NOT EXIST, CANNOT REMOVE"); return;}
    if(this.playerArray[name].namePlate) this.playerArray[name].namePlate.destroy();
    this.playerArray[name].destroy();
    this.playerArray[name] = undefined;
};

//Add Player
GameUpdater.prototype.addPlayerBall = function (data) {
    //data = {name, myPosition, myLinVelocity, myAngVelocity}
    if(this.playerArray[data.name] != undefined) {console.log("PLAYCANVAS: BALL ALREADY EXISTS"); return;}
    this.playerArray[data.name] = this.createPlayerEnitity(data.myPosition, data.myLinVelocity, data.myAngVelocity, data.name);
};

GameUpdater.prototype.createPlayerEnitity = function(pos, lin_vel, ang_vel, name) {
    var newPlayer = thisOther.clone();  //Create a copy of the "Other Ball"
    newPlayer.enabled = true;   //Enable it so it is visible in game
    thisOther.getParent().addChild(newPlayer);  //Add Copy to the scene structure

    var newText = thisText.clone();
    newText.focusEntity = newPlayer;
    newText.focusName = name;
    if (name == GRD.hostName) {
        newText.element.color = new pc.Color(1, 0.75, 0, 1);
    }
    thisOther.getParent().addChild(newText);  //Add Copy to the scene structure

    newPlayer.namePlate = newText;
    newPlayer.rigidbody.teleport(pos.x, pos.y, pos.z);   // Move Ball to the starting location
    newPlayer.rigidbody.angularVelocity = ang_vel;
    newPlayer.rigidbody.linearVelocity = lin_vel;
    return newPlayer;
};

GameUpdater.prototype.updatePosition = function (data) {
    //data = {position: name:}
    if(!data.position) return;
    if(data.name == myName) {
        //Update MY POSITION
            thisPlayer.rigidbody.teleport(data.position.x, data.position.y, data.position.z);
            thisPlayer.rigidbody.angularVelocity = data.av;
            thisPlayer.rigidbody.linearVelocity = data.lv;
    } else {
        //Update OTHER'S POSITION
        try {
            if(this.playerArray[data.name].rigidbody) {
                this.playerArray[data.name].rigidbody.teleport(data.position.x, data.position.y, data.position.z);
                this.playerArray[data.name].rigidbody.angularVelocity = data.av;
                this.playerArray[data.name].rigidbody.linearVelocity = data.lv;
            }
        } catch (error) {
            //console.log(error);
        }
    }
};

GameUpdater.prototype.calculateError = function(Ball, expected_position) {
    let pos = Ball.getPosition();
    let vel = Ball.rigidbody.linearVelocity;
    let x, y, z;
    if(vel.x > 0) {x = pos.x - expected_position.x;} else {x = expected_position.x - pos.x;}
    if(vel.y > 0) {y = pos.y - expected_position.y;} else {y = expected_position.y - pos.y;}
    if(vel.z > 0) {z = pos.z - expected_position.z;} else {z = expected_position.z - pos.z;}

    return (x + y + z)/3;
};

GameUpdater.prototype.getPosition = function(name) {
    if(name == myName) {
        return thisPlayer.getPosition(); //Return MY POSITION if asking for self
    } else {
        try {
            if(this.playerArray[name].entity.position) return this.playerArray[name].entity.getPosition();  //Return Position of player with name
        } catch (error) {console.log(error);}
    }
};

GameUpdater.prototype.applyInput = function(data) {
    if(this.playerArray[data.name].rigidbody) {
        let playerid = getPlayer(data.name);
        //First hit of the hole
        if(GRD.Players[playerid].myReady == true && GRD.Players[playerid].myScores[GRD.holeNumber - 1] == 0) {
            GRD.Players[playerid].myReady = false;
        }
        this.playerArray[data.name].rigidbody.applyImpulse(data.force);
        GRD.Players[playerid].myScores[GRD.holeNumber - 1]++;
        if(GRD.Players[playerid].myScores[GRD.holeNumber - 1] >= GRD.maxShots) {
            GRD.Players[playerid].myReady = true;
        }
    }
};

GameUpdater.prototype.playerInHole = function(entity) {
    for (let name in this.playerArray) {
        if (this.playerArray[name].entity == entity || this.playerArray[name] == entity) {
            GRD.Players[getPlayer(name)].myReady = true;
            return;
        }
    }
};

function mul_by_c(vector, c) {
    vector.x = vector.x * c;
    vector.y = vector.y * c;
    vector.z = vector.z * c;
    return vector;
}

function loadFromCookies() {
    if(document.cookie) {
        let cookies = document.cookie
                        .split(';')
                        .map(cookie => cookie.split('='))
                        .reduce((accumulator, [key, value]) => 
                            ({...accumulator, [key.trim()]: decodeURIComponent(value)}), {});
        current_volume = parseInt(cookies.volume);
        current_sfxvolume = parseInt(cookies.sfxvolume);
        current_musicvolume = parseInt(cookies.musicvolume);
        current_fov = parseFloat(cookies.fov);
        current_tutorial = cookies.tutorial;
        current_sensitivity = parseFloat(cookies.sen);        
        //-----------------------------------------------------------------
        //Network
        try {
            if(myName == undefined || myName == "anon") {
                //I currently do not have a name check cookies
                if(cookies.name) {
                    //If cookie exists, send name to host
                    myName = cookies.name;
                    App.Player.sendName();
                }
            }
        } catch (error) {
            //console.log(error);
        }
        //-----------------------------------------------------------------
    } else {
        document.cookie = "volume=" + current_volume;
        document.cookie = "sfxvolume=" + current_sfxvolume;
        document.cookie = "musicvolume=" + current_musicvolume;
        document.cookie = "fov=" + current_fov;
        document.cookie = "tutorial=" + current_tutorial;
        document.cookie = "sen=" + current_sensitivity;
        //-----------------------------------------------------------------
        //Network
        try {
            if(myName && GRD.gameId > 0) document.cookie = "name=" + myName + "; path=/" + GRD.gameId;
        } catch (error) {
            //console.log(error);
        }
        //-----------------------------------------------------------------
    }
}

function updateCookies() {
    let cookies = document.cookie
        .split(';')
        .map(cookie => cookie.split('='))
        .reduce((accumulator, [key, value]) => 
            ({...accumulator, [key.trim()]: decodeURIComponent(value)}), {});
    if(parseInt(cookies.volume) != current_volume) document.cookie = "volume=" + current_volume;
    if(parseInt(cookies.sfxvolume) != current_sfxvolume) document.cookie = "sfxvolume=" + current_sfxvolume;
    if(parseInt(cookies.musicvolume) != current_musicvolume) document.cookie = "musicvolume=" + current_musicvolume;
    if(parseFloat(cookies.fov) != current_fov.toFixed(1)) document.cookie = "fov=" + current_fov.toFixed(1);
    if(cookies.tutorial != current_tutorial) document.cookie = "tutorial=" + current_tutorial;
    if(parseFloat(cookies.sen) != current_sensitivity.toFixed(1)) document.cookie = "sen=" + current_sensitivity.toFixed(1);
    //-----------------------------------------------------------------
    //Network
    try {
        if(myName != undefined && myName != "anon" && parseInt(GRD.gameId) > 0) {
            if(!cookies.name || cookies.name != myName) document.cookie = "name=" + myName + "; path=/" + GRD.gameId;
        }
    } catch (error) {
        //console.log(error);
    }
    //-----------------------------------------------------------------
}

function checkReadyUp() {
    for (let i = 0; i < GRD.Players.length; i++) {
        if(GRD.Players[i] != "EMPTY") {
            if(GRD.Players[i].myReady == false) return false;
        }
    }
    return true;
}

function checkNoHits() {
    for (let i = 0; i < GRD.Players.length; i++) {
        if(GRD.Players[i] != "EMPTY") {
            if(GRD.Players[i].myScores[GRD.holeNumber - 1] > 0) return false;
        }
    }
    return true;
}

function checkHasVelocity(playerArray) {
    for (let name in playerArray) {
        let vel_vec = playerArray[name].rigidbody.angularVelocity;
        let vel_mag = Math.abs(vel_vec.x) + Math.abs(vel_vec.y) + Math.abs(vel_vec.z);
        if(vel_mag > movement_th) return true;
    }
    return false;
}

function startCountdown(time) {
    GRD.timeLeft = time;
    intervalID = setInterval(() => {
        if(GRD.timeLeft > 0) {
            GRD.timeLeft--;
        } else {
            stopCoundown();
            if(GRD.holeNumber < GRD.holeLimit) GRD.holeNumber++;
        }
    }, time * 10);
}

function stopCoundown() {
    if(intervalID != undefined) {
        GRD.timeLeft = 'NULL';
        clearInterval(intervalID);
        intervalID = undefined;
    }
}


// join-ui.js
// join-ui.js
var JoinUi = pc.createScript('joinUi');

JoinUi.attributes.add('css', {type: 'asset', assetType:'css', title: 'CSS Asset'});
JoinUi.attributes.add('html', {type: 'asset', assetType:'html', title: 'HTML Asset'});

// initialize code called once per entity
JoinUi.prototype.initialize = function() {
    // create STYLE element
    var style = document.createElement('style');

    // append to head
    document.head.appendChild(style);
    style.innerHTML = this.css.resource || '';

    // Add the HTML
    this.div = document.createElement('div');
    this.div.classList.add('joinContainer');
    this.div.innerHTML = this.html.resource || '';

    // append to body
    // can be appended somewhere else
    // it is recommended to have some container element
    // to prevent iOS problems of overfloating elements off the screen
    document.body.appendChild(this.div);

    //--------------------------------------------------------------------------
    //NETWORKING
    try {
        loadFromCookies();
        if(App.mySocketId.toString() == GRD.hostSocketId) {
            validName = true;
            joinComplete();
            return;
        }
    } catch (error) {
        console.log(error);
    }
    //--------------------------------------------------------------------------
    this.bindEvents();
};

JoinUi.prototype.bindEvents = function() {

    let join_input = this.div.querySelector('.createPlayerName');
    let join_button = this.div.querySelector('.joinButton');

    if(join_button) {
        join_button.addEventListener('click', function() {
            //-----------------------------------------------------------
            //NETWORKING
            try {
                myName = join_input.value;
                App.Player.sendName();
            //-----------------------------------------------------------
            } catch (error) {console.log(error);}
        }, false);
    }
};

function joinComplete() {
    let div = document.body.querySelector('.joinContainer');
    document.body.removeChild(div);
    loadScene('Main Scene', { hierarchy: true, settings: true }, (err, loadedSceneRootEntity) => {
        if (err) {
            console.error(err);
        } else {
            // Scene hierachary has successfully been loaded
            console.log("PLAYCANVAS: Loaded new Scene!");
        }
    });
}





// TextPosition.js
var TextPosition = pc.createScript('textPosition');

//Attribute for how high the text sits above the ball
TextPosition.attributes.add('hoverHeight', {type: 'number', default: 0.5, title: 'HoverHeight'});

//Attribute for what ball the text sits above
TextPosition.attributes.add('focusEntity', {
    type: 'entity',
    title: 'Focus Entity',
    description: 'Entity for the text to hover on. If empty then text hovers over origin.'
});

TextPosition.prototype.initialize = function() {
    //---------------------------------------------------------------------------
    //NETWORK
    try {
        if(myName && validName == true) {
            if(!this.entity.focusName) this.entity.focusName = myName;
            this.changeName("PLACE HOLDER");
        }
    } catch (error) {
        //console.log(error);
    }
    //---------------------------------------------------------------------------
    if(this.focusEntity) {
        if(!this.entity.focusEntity) this.entity.focusEntity = this.focusEntity;
        let new_position = this.entity.focusEntity.getPosition();
        new_position.y = new_position.y + this.hoverHeight;
        this.entity.setPosition(new_position);
    } else {
        this.entity.setPosition(0, 0, 0);
    }
};

// update code called every frame
TextPosition.prototype.update = function(dt) {

    //---------------------------------------------------------------------------
    //NETWORK
    try {
        if(myName && validName == true) {
            if(!this.entity.focusName) {this.entity.focusName = myName;}
            if(this.entity.focusName != this.entity.element.text) {

                //Changes the clients own name to nothing to not clog screen-space
                if(this.entity.focusName != myName) {
                    this.changeName(this.entity.focusName);
                } else {
                    if(this.entity.element.text != ' ') this.changeName(' ');
                }
            }
        }
    } catch (error) {
        //console.log(error);
    }
    //---------------------------------------------------------------------------


    //Change Focus Entity
    if(this.entity.focusEntity) {
        let new_position = this.entity.focusEntity.getPosition();
        new_position.y = new_position.y + this.hoverHeight;
        this.entity.setPosition(new_position);
    } else {
        //If the entity no longer exists, destroy this enitity
        this.entity.destroy();
    }

    //Set rotation of Text to Camera angle
    if(camera_direction) this.entity.setRotation(camera_direction);
};

TextPosition.prototype.changeName = function(new_name) {this.entity.element.text = new_name;};
TextPosition.prototype.changeFocus = function(new_entity) {this.entity.focusEntity = new_entity;};

// GameUi.js
var GameUi = pc.createScript('gameUi');

//Game Settings
var current_collision = true;
var current_maxshots = 14;

//Temporary hold for network.js variables
var MAX_HOLES = 4;
var current_holeLimit = 4;
var current_timeLimit = 120;
var current_playerLimit = 8;

//General Settings
var current_volume = 100;
var current_sfxvolume = 100;
var current_musicvolume = 100;
var current_tutorial = true;
var current_ready = false;

GameUi.attributes.add('css', {type: 'asset', assetType:'css', title: 'Main CSS Asset'});
GameUi.attributes.add('html', {type: 'asset', assetType:'html', title: 'Main HTML Asset'});
GameUi.attributes.add('share_html', {type: 'asset', assetType:'html', title: 'Share HTML Asset'});
GameUi.attributes.add('settings_html', {type: 'asset', assetType:'html', title: 'Settings HTML Asset'});
GameUi.attributes.add('host_settings_html', {type: 'asset', assetType:'html', title: 'Game Settings HTML Asset'});
GameUi.attributes.add('adv_host_settings_html', {type: 'asset', assetType:'html', title: 'Advanced Game Settings HTML Asset'});
GameUi.attributes.add('player_settings_html', {type: 'asset', assetType:'html', title: 'General Settings HTML Asset'});
GameUi.attributes.add('scoreboard_html', {type: 'asset', assetType:'html', title: 'Scoreboard HTML Asset'});

// initialize code called once per entity
GameUi.prototype.initialize = function() {
    // create STYLE element
    var style = document.createElement('style');

    // append to head
    document.head.appendChild(style);
    style.innerHTML = this.css.resource || '';

    // Add the HTML
    this.div = document.createElement('div');
    this.div.classList.add('container');
    this.div.innerHTML = this.html.resource || '';

    this.div_hud = document.createElement('div');
    this.div_hud.classList.add('HUDcontainer');
    let ready_button = document.createElement('div');
    ready_button.id = "readyButtonContainer";
    ready_button.innerHTML = current_ready ? '<div class = "buttonGreen" id = "readyButton">READY</div>' :'<div class = "buttonRed" id = "readyButton">NOT READY</div>';
    this.div_hud.appendChild(ready_button);
    //this.div_hud.innerHTML = '<div class = "textBigLeft">SHOT: 0</div><div class = "textBigRight">2:00</div>';

    // append to body
    // can be appended somewhere else
    // it is recommended to have some container element
    // to prevent iOS problems of overfloating elements off the screen
    document.body.appendChild(this.div_hud);
    document.body.appendChild(this.div);
    this.bindEvents(this);
};


GameUi.prototype.append_html = function(ref, html_element, bind_index) {
    // Add the HTML
    let div = document.createElement('div');
    div.classList.add('option');
    let menuDiv = document.body.querySelector(".optionMenu");
    div.innerHTML = html_element.resource || '';
    menuDiv.appendChild(div);
    this.eventBinder(ref, bind_index);
};

GameUi.prototype.remove_html = function() {
    let menuDiv = document.body.querySelector(".optionMenu");
    let option = document.body.querySelector(".option");
    if(option) menuDiv.removeChild(option);
};

GameUi.prototype.eventBinder = function(ref, bind_index) {
    switch(bind_index) {
        //Share Events
        case 0:
            ref.bindEventShare(ref);
            break;
        //Main Setting Events
        case 1:
            ref.bindEventSettings(ref);
            break;
        //Game Settings Events
        case 2:
            ref.bindEventGameSettings(ref);
            break;
        //General Settings Events
        case 3:
            ref.bindEventGeneralSettings(ref);
            break;
        //Advanced Game Settings Events
        case 4:
            ref.bindEventAdvGameSettings(ref);
            break;
        case 10:
            ref.bindEventScoreboard(ref);
            break;
    }
};

//Main Event Binder for Share and Settings Button
GameUi.prototype.bindEvents = function(ref) {

    //Get HTML Elements of GameBar
    this.share_button = document.getElementById('shareButton');
    this.settings_button = document.getElementById('settingsButton');
    this.scoreboard_button = document.getElementById('scoreboardButton');
    this.gameid = document.getElementById('gameid');
    this.players = document.getElementById('playercount');
    this.readyButton = document.getElementById('readyButton');

    //Ready Button
    if(this.readyButton) {
        this.readyButton.addEventListener('click', function() {

            current_ready = current_ready ? false : true;
            if(current_ready) {
                this.className = "buttonGreen";
                this.textContent = "READY";
            } else {
                this.className = "buttonRed";
                this.textContent = "NOT READY";
            }
            //-------------------------------------------------------------------
            //NETWORK
            try {
                if(GRD.hostSocketId == sockets.id) {
                    GRD.Players[getPlayer(myName)].myReady = current_ready;
                } else {
                    sendPlayerReady(current_ready);
                }
            } catch (error) {
                //console.log(error);
            }
            //-------------------------------------------------------------------
        }, false);
    }

    //Share Button
    if(this.share_button) {
        this.share_button.addEventListener('click', function() {
            let thisMenu = document.querySelector('.shareOptions');
            let settingsMenu = document.querySelector('.settingsOptions');
            let scoreboardMenu = document.querySelector('.scoreboardOptions');

            if(thisMenu || settingsMenu || scoreboardMenu) {
                if(settingsMenu || scoreboardMenu) {
                    ref.remove_html();
                    ref.append_html(ref, ref.share_html, 0);
                } else {
                    ref.remove_html();
                }
            } else {
                ref.append_html(ref, ref.share_html, 0);
            }
        }, false);
    }

    //Scoreboard Button
    if(this.scoreboard_button) {
        this.scoreboard_button.addEventListener('click', function() {
            let thisMenu = document.querySelector('.scoreboardOptions');
            let shareMenu = document.querySelector('.shareOptions');
            let settingsMenu = document.querySelector('.settingsOptions');

            if(thisMenu || settingsMenu || shareMenu) {
                if(settingsMenu || shareMenu) {
                    ref.remove_html();
                    ref.append_html(ref, ref.scoreboard_html, 10);
                } else {
                    ref.remove_html();
                }
            } else {
                ref.append_html(ref, ref.scoreboard_html, 10);
            }
        }, false);
    }

    //Settings Button
    if( this.settings_button) {
         this.settings_button.addEventListener('click', function() {
            let thisMenu = document.querySelector('.settingsOptions');
            let shareMenu = document.querySelector('.shareOptions');
            let scoreboardMenu = document.querySelector('.scoreboardOptions');

            if(thisMenu || shareMenu || scoreboardMenu) {
                if(shareMenu || scoreboardMenu) {
                    ref.remove_html();
                    ref.checkNetwork(ref, "TO");
                } else {
                    ref.remove_html();
                }
            } else {
                ref.checkNetwork(ref, "TO");
            }
        }, false);
    }
};

//----------------------------------------------------------------
//NETWORK
GameUi.prototype.checkNetwork = function (ref, TO_FROM) {
    if(TO_FROM == "TO") {
        //If connected to network.js
        try {
            //If host, show Game Settings
            if(GRD.hostSocketId == sockets.id) {
                ref.append_html(ref, ref.settings_html, 1);
            } else {
                ref.append_html(ref, ref.player_settings_html, 3);
            }
        //If not connected to network.js
        } catch (error) {
            ref.append_html(ref, ref.settings_html, 1);
        }
    } else if (TO_FROM == "FROM") {
        //If connected to network.js
        try {
            //If host, show Game Settings
            if(GRD.hostSocketId == sockets.id) {
                ref.append_html(ref, ref.settings_html, 1);
            }
        //If not connected to network.js
        } catch (error) {
            ref.append_html(ref, ref.settings_html, 1);
        }
    }
};
//----------------------------------------------------------------

//Scoreboard Menu Events
GameUi.prototype.bindEventScoreboard = function (ref) {
    this.back = document.getElementById('backButton');
    //Back Button
    this.back.addEventListener('click', function() {
        ref.remove_html();
    }, false);
};

//Share Menu Events
GameUi.prototype.bindEventShare = function (ref) {
    //Get HTML Elements
    this.qr = document.getElementById('qrcode');
    this.url_text = document.getElementById('urltext');
    this.link = document.getElementById('copylink');
    this.back = document.getElementById('backButton');


    //Generate QR Code
    const wd = window.innerWidth;
    const ht = window.innerHeight;
    let sz = (wd > ht) ? ht : wd;
    this.url_text.textContent = location.href;
    generateQR(location.href, sz/1.5);

    //Copy Link Button
    this.link.addEventListener('click', function() {
        console.log("PLAYCANVAS: Copying Link");
        navigator.clipboard.writeText(location.href);
        if(!document.getElementById('copied')) {
            document.getElementById('copylink').insertAdjacentHTML("afterend",
            '<div class="text" id="copied">Link Copied!</div>');
        }
    }, false);

    //Back Button
    this.back.addEventListener('click', function() {
        ref.remove_html();
    }, false);
};

//Settings Main Menu Events
GameUi.prototype.bindEventSettings = function (ref) {
    //Get HTML Elements
    this.game_button = document.getElementById('gameButton');
    this.general_button = document.getElementById('generalButton');
    this.back = document.getElementById('backButton');

    //Game Settings Button
    this.game_button.addEventListener('click', function() {
        ref.remove_html();
        ref.append_html(ref, ref.host_settings_html, 2);
    }, false);

    //General Settings Button
    this.general_button.addEventListener('click', function() {
        ref.remove_html();
        ref.append_html(ref, ref.player_settings_html, 3);
    }, false);

    //Back Button
    this.back.addEventListener('click', function() {
        ref.remove_html();
    }, false);
};


//Game Settings Event Listeners
GameUi.prototype.bindEventGameSettings = function (ref) {

    //Player Limit
    let pm = document.getElementById('playerMinus');
    let pt = document.getElementById('currentPlayer');
    let pp = document.getElementById('playerPlus');
    //-------------------------------------------------------------------------
    //NETWORK
    try {pt.textContent = GRD.playerLimit;} catch (error) {pt.textContent = current_playerLimit;}
    //--------------------------------------------------------------------------
    pm.addEventListener('click', function() {
        let c_player = parseInt(pt.textContent);
        if(c_player <= 1) return;
        //-------------------------------------------------------------------------
        //NETWORK
        try {
            if(GRD.playerCount >= c_player) return;
            c_player = c_player - 1;
            GRD.playerLimit = c_player;
            reducePlayerArray();
            pt.textContent = GRD.playerLimit;     
        } catch (error) {
            c_player = c_player - 1;
            current_playerLimit = c_player;
            pt.textContent = current_playerLimit;
        }
        //--------------------------------------------------------------------------
    }, false);
    pp.addEventListener('click', function() {
        let c_player = parseInt(pt.textContent);
        //-------------------------------------------------------------------------
        //NETWORK
        try {
            if(GRD.playerLimit) {
                c_player = c_player + 1;
                GRD.playerLimit = c_player;
                increasePlayerArray();
                pt.textContent = GRD.playerLimit;
            }    
        } catch (error) {
            c_player = c_player + 1;
            current_playerLimit = c_player;
            pt.textContent = current_playerLimit;
        }
        //--------------------------------------------------------------------------
    }, false);

    //Time Limit
    let tm = document.getElementById('timeMinus');
    let tt = document.getElementById('currentTime');
    let tp = document.getElementById('timePlus');
    //-------------------------------------------------------------------------
    //NETWORK
    try {tt.textContent = GRD.timeLimit + "s";} catch (error) {tt.textContent = current_timeLimit + "s";}
    //--------------------------------------------------------------------------
    tm.addEventListener('click', function() {
        //-------------------------------------------------------------------------
        //NETWORK
        try {
            let c_time = parseInt(GRD.timeLimit);
            if(c_time <= 1) return;
            c_time = c_time - 1;
            GRD.timeLimit = c_time;
            tt.textContent = GRD.timeLimit + "s";     
        } catch (error) {
            let c_time = parseInt(current_timeLimit);
            if(c_time <= 1) return;
            c_time = c_time - 1;
            current_timeLimit = c_time;
            tt.textContent = current_timeLimit + "s";
        }
        //--------------------------------------------------------------------------
    }, false);
    tp.addEventListener('click', function() {
        //-------------------------------------------------------------------------
        //NETWORK
        try {
            let c_time = parseInt(GRD.timeLimit);
            c_time = c_time + 1;
            GRD.timeLimit = c_time;
            tt.textContent = GRD.timeLimit + "s";     
        } catch (error) {
            let c_time = parseInt(current_timeLimit);
            c_time = c_time + 1;
            current_timeLimit = c_time;
            tt.textContent = current_timeLimit + "s";
        }
        //--------------------------------------------------------------------------
    }, false);

    //Hole Limit
    let hm = document.getElementById('holeMinus');
    let ht = document.getElementById('currentHole');
    let hp = document.getElementById('holePlus');
    //-------------------------------------------------------------------------
    //NETWORK
    try {ht.textContent = GRD.holeLimit;} catch (error) {ht.textContent = current_holeLimit;}
    //--------------------------------------------------------------------------
    hm.addEventListener('click', function() {
        //-------------------------------------------------------------------------
        //NETWORK
        try {
            let c_hole = parseInt(GRD.holeLimit);
            if(c_hole <= 1) return;
            c_hole = c_hole - 1;
            GRD.holeLimit = c_hole;
            ht.textContent = GRD.holeLimit;     
        } catch (error) {
            let c_hole = parseInt(current_holeLimit);
            if(c_hole <= 1) return;
            c_hole = c_hole - 1;
            current_holeLimit = c_hole; 
            ht.textContent = current_holeLimit;
        }
        //--------------------------------------------------------------------------
    }, false);
    hp.addEventListener('click', function() {
        //-------------------------------------------------------------------------
        //NETWORK
        try {
            let c_hole = parseInt(GRD.holeLimit);
            if(c_hole >= MAX_HOLES) return;
            c_hole = c_hole + 1;
            GRD.holeLimit = c_hole;
            ht.textContent = GRD.holeLimit;     
        } catch (error) {
            let c_hole = parseInt(current_holeLimit);
            if(c_hole >= MAX_HOLES) return;
            c_hole = c_hole + 1;
            current_holeLimit = c_hole; 
            ht.textContent = current_holeLimit;
        }
        //--------------------------------------------------------------------------
    }, false);

    //Collision
    let cm = document.getElementById('collisionMinus');
    let ct = document.getElementById('currentCollision');
    let cp = document.getElementById('collisionPlus');
    ct.textContent = current_collision ? "Yes" : "No";
    cm.addEventListener('click', function() {
        current_collision = false;
        ct.textContent = current_collision ? "Yes" : "No";
    }, false);
    cp.addEventListener('click', function() {
        current_collision = true;
        ct.textContent = current_collision ? "Yes" : "No";
    }, false);

    //Max Shots
    let mm = document.getElementById('maxshotsMinus');
    let mt = document.getElementById('currentMaxShots');
    let mp = document.getElementById('maxshotsPlus');
    //-------------------------------------------------------------------------
    //NETWORK
    try {mt.textContent = GRD.maxShots;} catch (error) {mt.textContent = current_maxshots;}
    //-------------------------------------------------------------------------
    mm.addEventListener('click', function() {
        //-------------------------------------------------------------------------
        //NETWORK
        try {
            if(GRD.maxShots > 1) {
                GRD.maxShots = GRD.maxShots - 1;
                mt.textContent = GRD.maxShots;
            }
        } catch (error) {
            if(current_maxshots > 1) {
                current_maxshots = current_maxshots - 1;
                mt.textContent = current_maxshots;
            }
        }
        //-------------------------------------------------------------------------
    }, false);
    mp.addEventListener('click', function() {
        //-------------------------------------------------------------------------
        //NETWORK
        try {
            GRD.maxShots = GRD.maxShots + 1;
            mt.textContent = GRD.maxShots;
        } catch (error) {
            current_maxshots = current_maxshots + 1;
            mt.textContent = current_maxshots;
        }
        //-------------------------------------------------------------------------
    }, false);

    //Get HTML Elements
    this.back = document.getElementById('backButton');
    this.advanced = document.getElementById('advancedButton');

    //Advanced Settings Button
    this.advanced.addEventListener('click', function() {
        let exists = document.querySelector('.advancedOption');
        let ac = document.getElementById('advancedContainer');
        if(!exists) {
            let adv_div = document.createElement('div');
            adv_div.classList.add('advancedOption');
            adv_div.innerHTML = ref.adv_host_settings_html.resource || '';
            ac.appendChild(adv_div);
            ref.eventBinder(ref, 4);
        } else {
            ac.removeChild(exists);
        }
    }, false);
    //Back Button
    this.back.addEventListener('click', function() {
        ref.remove_html();
        ref.checkNetwork(ref, "FROM");
    }, false);
};

GameUi.prototype.bindEventGeneralSettings = function (ref) {
    //Volume
    let vm = document.getElementById('volumeMinus');
    let vt = document.getElementById('currentVolume');
    let vp = document.getElementById('volumePlus');
    vt.textContent = current_volume;
    vm.addEventListener('click', function() {
        let c_vol = parseInt(vt.textContent);
        if(c_vol >= 5) {
            c_vol = c_vol - 5;
            current_volume = c_vol;
            vt.textContent = current_volume;
        }
    }, false);
    vp.addEventListener('click', function() {
        let c_vol = parseInt(vt.textContent);
        if(c_vol <= 95) {
            c_vol = c_vol + 5;
            current_volume = c_vol;
            vt.textContent = current_volume;
        }
    }, false);

    //SFX Volume
    let sfxm = document.getElementById('sfxvolumeMinus');
    let sfxt = document.getElementById('currentSFXVolume');
    let sfxp = document.getElementById('sfxvolumePlus');
    sfxt.textContent = current_sfxvolume;
    sfxm.addEventListener('click', function() {
        let c_vol = parseInt(sfxt.textContent);
        if(c_vol >= 5) {
            c_vol = c_vol - 5;
            current_sfxvolume = c_vol;
            sfxt.textContent = current_sfxvolume;
        }
    }, false);
    sfxp.addEventListener('click', function() {
        let c_vol = parseInt(sfxt.textContent);
        if(c_vol <= 95) {
            c_vol = c_vol + 5;
            current_sfxvolume = c_vol;
            sfxt.textContent = current_sfxvolume;
        }
    }, false);

    //Music Volume
    let musm = document.getElementById('musicvolumeMinus');
    let must = document.getElementById('currentMusicVolume');
    let musp = document.getElementById('musicvolumePlus');
    must.textContent = current_musicvolume;
    musm.addEventListener('click', function() {
        let c_vol = parseInt(must.textContent);
        if(c_vol >= 5) {
            c_vol = c_vol - 5;
            current_musicvolume = c_vol;
            must.textContent = current_musicvolume;
        }
    }, false);
    musp.addEventListener('click', function() {
        let c_vol = parseInt(must.textContent);
        if(c_vol <= 95) {
            c_vol = c_vol + 5;
            current_musicvolume = c_vol;
            must.textContent = current_musicvolume;
        }
    }, false);

    //Tutorial
    let tm = document.getElementById('tutorialMinus');
    let tt = document.getElementById('currentTutorial');
    let tp = document.getElementById('tutorialPlus');
    tt.textContent = current_tutorial ? "Yes" : "No";
    tm.addEventListener('click', function() {
        current_tutorial = false;
        tt.textContent = current_tutorial ? "Yes" : "No";
    }, false);
    tp.addEventListener('click', function() {
        current_tutorial = true;
        tt.textContent = current_tutorial ? "Yes" : "No";
    }, false);

    //FOV
    let fovm = document.getElementById('fovMinus');
    let fovt = document.getElementById('currentFov');
    let fovp = document.getElementById('fovPlus');
    fovt.textContent = parseFloat(current_fov).toFixed(1);
    fovm.addEventListener('click', function() {
        let c_fov = parseFloat(fovt.textContent);
        c_fov = c_fov - 5;
        current_fov = c_fov;
        fovt.textContent = parseFloat(current_fov).toFixed(1);
    }, false);
    fovp.addEventListener('click', function() {
        let c_fov = parseFloat(fovt.textContent);
        c_fov = c_fov + 5;
        current_fov = c_fov;
        fovt.textContent = parseFloat(current_fov).toFixed(1);
    }, false);

    //Sensitivity
    let senm = document.getElementById('senMinus');
    let sent = document.getElementById('currentSen');
    let senp = document.getElementById('senPlus');
    sent.textContent = parseFloat(current_sensitivity).toFixed(1);
    senm.addEventListener('click', function() {
        let c_sen = parseFloat(sent.textContent);
        c_sen = c_sen - 0.1;
        current_sensitivity = c_sen;
        sent.textContent = parseFloat(current_sensitivity).toFixed(1);
    }, false);
    senp.addEventListener('click', function() {
        let c_sen = parseFloat(sent.textContent);
        c_sen = c_sen + 0.1;
        current_sensitivity = c_sen;
        sent.textContent = parseFloat(current_sensitivity).toFixed(1);
    }, false);

    //Get HTML Elements
    this.back = document.getElementById('backButton');
    //Back Button
    this.back.addEventListener('click', function() {
        ref.remove_html();
        ref.checkNetwork(ref, "FROM");
    }, false);
};


//Advanced Game Settings Event Listeners
GameUi.prototype.bindEventAdvGameSettings = function (ref) {
    //Gravity
    let gm = document.getElementById('gravityMinus');
    let gt = document.getElementById('currentGravity');
    let gp = document.getElementById('gravityPlus');
    gt.textContent = current_gravity.y.toFixed(1);
    gm.addEventListener('click', function() {
        let c_grav = parseFloat(gt.textContent);
        c_grav = c_grav - 0.1;
        current_gravity.y = c_grav;
        GameUi.updateNetwork(ref, "GRAVITY");
        c_grav = c_grav.toFixed(1);
        gt.textContent = c_grav;
    }, false);
    gp.addEventListener('click', function() {
        let c_grav = parseFloat(gt.textContent);
        c_grav = c_grav + 0.1;
        current_gravity.y = c_grav;
        GameUi.updateNetwork(ref, "GRAVITY");
        c_grav = c_grav.toFixed(1);
        gt.textContent = c_grav;
    }, false);

    //Friction
    let fm = document.getElementById('frictionMinus');
    let ft = document.getElementById('currentFriction');
    let fp = document.getElementById('frictionPlus');
    ft.textContent = current_friction.toFixed(1);
    fm.addEventListener('click', function() {
        let c_fric = ft.textContent = parseFloat(ft.textContent);
        if(c_fric > 0) {
            c_fric = c_fric - 0.1;
            current_friction = c_fric;
            GameUi.updateNetwork(ref, "FRICTION");
            ft.textContent = current_friction.toFixed(1);
        }
    }, false);
    fp.addEventListener('click', function() {
        let c_fric = ft.textContent = parseFloat(ft.textContent);
        if(c_fric < 1) {
            c_fric = c_fric + 0.1;
            current_friction = c_fric;
            GameUi.updateNetwork(ref, "FRICTION");
            ft.textContent = current_friction.toFixed(1);
        }
    }, false);

    //Speed
    let sm = document.getElementById('speedMinus');
    let st = document.getElementById('currentSpeed');
    let sp = document.getElementById('speedPlus');
    st.textContent = current_speed.toFixed(1);
    sm.addEventListener('click', function() {
        let c_speed = parseFloat(st.textContent);
        c_speed = c_speed - 1.0;
        current_speed = c_speed;
        GameUi.updateNetwork(ref, "SPEED");
        st.textContent = current_speed.toFixed(1);
    }, false);
    sp.addEventListener('click', function() {
        let c_speed = parseFloat(st.textContent);
        c_speed = c_speed + 1.0;
        current_speed = c_speed;
        GameUi.updateNetwork(ref, "SPEED");
        st.textContent = current_speed.toFixed(1);
    }, false);
};

//--------------------------------------------------------------
//NETWORK
GameUi.updateNetwork = function (ref, UPDATE) {
    try {
        switch (UPDATE) {
            case "GRAVITY":
                GRD.gravity = current_gravity;
                break;
            case "FRICTION":
                GRD.friction = current_friction;
                break;
            case "SPEED":
                GRD.speed = current_speed;
                break;
        }
    } catch (error) {
        //console.log(error);
    }
};
//--------------------------------------------------------------

GameUi.prototype.update = function() {
    //--------------------------------------------------------------------
    //NETWORK
    try {
        if(GRD.gameId) {
            //Update Game ID
            let gameid = document.getElementById('gameid');
            if(gameid.textContent != GRD.gameId) gameid.textContent = GRD.gameId;
            //Update Player Count
            let players = document.getElementById('playercount');
            let playerarray = this.players.textContent.split('/');
            let update = false;
            if(playerarray[0] != GRD.playerCount) {playerarray[0] = GRD.playerCount;  update = true;}
            if(playerarray[1] != GRD.playerLimit) {playerarray[1] = GRD.playerLimit; update = true;}
            if(update) players.textContent = playerarray[0] + "/" + playerarray[1];
            //Update Player Name
            let playerName = document.getElementById('playerName');
            if(playerName.textContent != myName) playerName.textContent = myName;

            try {
                //Update Bottom UI bar
                let bottom_bar = document.querySelector('.HUDcontainer');
                if(GRD.holeNumber == 0) {
                    let ready_button = document.getElementById('readyButtonContainer');
                    if(!ready_button) {
                        //-------------------------------------------------------------------
                        //NETWORK
                        try {
                            let myid = getPlayer(myName);
                            current_ready = GRD.Players[myid].myReady;
                        } catch (error) {
                            current_ready = current_ready ? false : true;
                        }
                        //-------------------------------------------------------------------

                        //Reset inside HUD Container
                        bottom_bar.innerHTML = '';
                        //Create Ready button
                        let new_button = document.createElement('div');
                        new_button.id = "readyButtonContainer";
                        new_button.innerHTML = current_ready ? '<div class = "buttonGreen" id = "readyButton">READY</div>' :'<div class = "buttonRed" id = "readyButton">NOT READY</div>';
                        bottom_bar.appendChild(new_button);
                        let ready_button = document.getElementById('readyButton');
                        ready_button.addEventListener('click', function() {
                            current_ready = current_ready ? false : true;
                            console.log('Click!');
                            if(current_ready) {
                                this.className = "buttonGreen";
                                this.textContent = "READY";
                            } else {
                                this.className = "buttonRed";
                                this.textContent = "NOT READY";
                            }
                            //-------------------------------------------------------------------
                            //NETWORK
                            try {
                                if(GRD.hostSocketId == sockets.id) {
                                    GRD.Players[getPlayer(myName)].myReady = current_ready;
                                } else {
                                    sendPlayerReady(current_ready);
                                }
                            } catch (error) {
                                //console.log(error);
                            }
                            //-------------------------------------------------------------------
                        }, false);
                    }
                } else {
                    let hud = document.getElementById('innerHudContainer');
                    if(!hud) {
                        //Reset inside HUD Container
                        bottom_bar.innerHTML = '';
                        //Create Ready button
                        let new_hud = document.createElement('div');
                        new_hud.classList.add("HUDelements");
                        new_hud.id = "innerHudContainer";
                        new_hud.innerHTML = '<div class = "textBigLeftNotReady" id = "currentshots" >SHOT: 0</div><div class = "textBigRight" id = "timeleft" >2:00</div>';
                        bottom_bar.appendChild(new_hud);
                    } else {
                        let shots = document.getElementById('currentshots');
                        let time = document.getElementById('timeleft');
                        if(time.innerHTML != "TIME: " + GRD.timeLeft) {
                            time.innerHTML = "TIME: " + GRD.timeLeft;
                        }
                        if(shots.innerHTML != "SHOTS: " + GRD.Players[getPlayer(myName)].myScores[GRD.holeNumber - 1] + "/" + GRD.maxShots) {
                            shots.innerHTML = "SHOTS: " + GRD.Players[getPlayer(myName)].myScores[GRD.holeNumber - 1] + "/" + GRD.maxShots;
                        }
                        let ready = GRD.Players[getPlayer(myName)].myReady;
                        if(ready == true) {
                            if (shots.className != "textBigLeftReady") {
                                shots.className = "textBigLeftReady";
                            }
                        } else {
                            if (shots.className != "textBigLeftNotReady") {
                                shots.className = "textBigLeftNotReady";
                            }
                        }
                    }
                }
                //Update Scoreboard
                let scoreboardMenu = document.querySelector('.scoreboardOptions');
                if(scoreboardMenu) {
                    for (let i = 0; i < GRD.playerLimit; i++) {
                        if(GRD.Players[i] != "EMPTY") {
                            let player_div = document.getElementById(GRD.Players[i].myName);
                            if(player_div) {
                                //Update Div
                                for (let k = 0; k < GRD.Players[i].myScores.length; k++) {
                                    let query = 'div[id = "' + (k+1) + '"]';
                                    let score_div = player_div.querySelector(query);
                                    if(score_div.textContent != GRD.Players[i].myScores[k]) score_div.textContent = GRD.Players[i].myScores[k];
                                }
                                let total_div = player_div.querySelector('div[id = "total"]');
                                let c_total = calculatePlayerTotal(i);
                                if(total_div.textContent != c_total) total_div.textContent = c_total;
                            } else {
                                //Add Player Div
                                // <div class = "playerScore" id = "MYNAME">
                                //     <div class = "titleText" id = "player">NAME</div>
                                //     <div class = "scores">
                                //         <div class = "titleText" id = "1">Hole 1</div>
                                //         <div class = "titleText" id = "2">Hole 2</div>
                                //         <div class = "titleText" id = "3">Hole 3</div>
                                //         <div class = "titleText" id = "4">Hole 4</div>
                                //     </div>
                                //     <div class = "titleText" id = "total">Total</div>
                                // </div>

                                //playerScore
                                let player_div = document.createElement('div');
                                player_div.classList.add('playerScore');
                                player_div.id = GRD.Players[i].myName;
                                
                                //player Title
                                let playername_div = document.createElement('div');
                                playername_div.classList.add('text');
                                playername_div.id = "player";
                                playername_div.textContent = GRD.Players[i].myName;
                                player_div.appendChild(playername_div);

                                //Player Score
                                let scores_div = document.createElement('div');
                                scores_div.classList.add('scores');
                                for (let k = 0; k < GRD.Players[i].myScores.length; k++) {
                                    let score_div = document.createElement('div');
                                    score_div.classList.add('text');
                                    score_div.id = k + 1;
                                    score_div.textContent = GRD.Players[i].myScores[k];
                                    scores_div.appendChild(score_div);
                                }
                                player_div.appendChild(scores_div);

                                //Player Total
                                let playertotal_div = document.createElement('div');
                                playertotal_div.classList.add('text');
                                playertotal_div.id = "total";
                                playertotal_div.textContent = calculatePlayerTotal(i);
                                player_div.appendChild(playertotal_div);

                                //Append Div to HTML
                                scoreboardMenu.appendChild(player_div);
                            }
                        }
                    }
                }
            } catch (error) {
                console.log(error);
            }
        }
    } catch (error) {
        //console.log(error);
        //Update Game ID
        let gameid = document.getElementById('gameid');
        if(gameid.textContent != "12345") gameid.textContent = "12345";
        //Update Player Count
        let players = document.getElementById('playercount');
        let playerarray = this.players.textContent.split('/');
        let update = false;
        if(playerarray[0] != "1") {playerarray[0] = 1;  update = true;}
        if(playerarray[1] != current_playerLimit) {playerarray[1] = current_playerLimit; update = true;}
        if(update) players.textContent = playerarray[0] + "/" + playerarray[1];
        //Update PlayerName
        let playerName = document.getElementById('playerName');
        if(playerName.textContent != "Name") playerName.textContent = "Name";

        //Update Scoreboard
    }
    //--------------------------------------------------------------------
};

function generateQR(url, size) {
    try {
        const qrcode = new QRCode('qrcode', {
            text: url,
            width: size,
            height: size
        });
    } catch (error) {
        console.log(error);
    }
}



// rayCast.js
var RayCast = pc.createScript('rayCast');
var pickedEntity = 0;

// initialize code called once per entity
RayCast.prototype.initialize = function() {
    this.start = undefined;
    this.end = undefined;
    this.startedLine = false;

    if(!this.app.touch) this.app.mouse.on(pc.EVENT_MOUSEDOWN, this.onSelectMouse, this);
    if(!this.app.touch) this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.updateMouse, this);
    if(this.app.touch) this.app.touch.on(pc.EVENT_TOUCHSTART, this.onSelectTouch, this);
    if(this.app.touch) this.app.touch.on(pc.EVENT_TOUCHMOVE, this.updateTouch, this);

    this.on('destroy', function() {
        this.app.mouse.off(pc.EVENT_MOUSEDOWN, this.onSelect, this);
    }, this);
};

// update code called every frame
RayCast.prototype.onSelectMouse = function (e) {
    this.startedLine = false;
    let from = this.entity.camera.screenToWorld(e.x, e.y, this.entity.camera.nearClip);
    let to = this.entity.camera.screenToWorld(e.x, e.y, this.entity.camera.farClip);
    let result = this.app.systems.rigidbody.raycastFirst(from, to);
    if (result) {
        pickedEntity = result.entity;
    }
};

RayCast.prototype.onSelectTouch = function (e) {
    this.startedLine = false;
    let from = this.entity.camera.screenToWorld(e.touches[0].x, e.touches[0].y, this.entity.camera.nearClip);
    let to = this.entity.camera.screenToWorld(e.touches[0].x, e.touches[0].y, this.entity.camera.farClip);
    let result = this.app.systems.rigidbody.raycastFirst(from, to);
    if (result) {
        pickedEntity = result.entity;
    }
};

RayCast.prototype.updateMouse = function (e) {
    if(pickedEntity && ballSelected) {
        this.start = this.entity.camera.screenToWorld(e.x, e.y, this.entity.camera.nearClip);
        this.end = pickedEntity.getPosition();
        this.startedLine = true;
    }
};

RayCast.prototype.updateTouch = function (e) {
    if(pickedEntity && ballSelected) {
        this.start = this.entity.camera.screenToWorld(e.touches[0].x, e.touches[0].y, this.entity.camera.nearClip);
        this.end = pickedEntity.getPosition();
        this.startedLine = true;
    }
};

RayCast.prototype.update = function() {
    if(pickedEntity && ballSelected && this.start && this.end && this.startedLine) {
        let r = mouseDistance/1000;
        let g = 1 - mouseDistance/1000;
        let color = new pc.Color(r, g, 0);
        let startplusplus = new pc.Vec3(this.start.x + 0.0001, this.start.y + 0.0001, this.start.z);
        let startminusminus = new pc.Vec3(this.start.x - 0.0001, this.start.y - 0.0001, this.start.z);
        let startplusminus = new pc.Vec3(this.start.x + 0.0001, this.start.y - 0.0001, this.start.z);
        let startminusplus = new pc.Vec3(this.start.x - 0.0001, this.start.y + 0.0001, this.start.z);
        let endplusplus = new pc.Vec3(this.end.x + 0.001, this.end.y + 0.001, this.end.z);
        let endminusminus = new pc.Vec3(this.end.x - 0.001, this.end.y - 0.001, this.end.z);
        let endplusminus = new pc.Vec3(this.end.x + 0.001, this.end.y - 0.001, this.end.z);
        let endminusplus = new pc.Vec3(this.end.x - 0.001, this.end.y + 0.001, this.end.z);
        // let startminus = pc.Vec3(this.start.x, this.start.y - 1, this.start.z);
        this.app.drawLine(this.start, this.end, color, true);
        this.app.drawLine(startplusplus, endplusplus, color, true);
        this.app.drawLine(startminusminus, endminusminus, color, true);
        this.app.drawLine(startplusminus, endplusminus, color, true);
        this.app.drawLine(startminusplus, endminusplus, color, true);
    }
};


// hole.js
// hole.js
var Hole = pc.createScript('hole');

// initialize code called once per entity
Hole.prototype.initialize = function() {
    // Subscribe to the triggerenter event of this entity's collision component.
    // This will be fired when a rigid body enters this collision volume.
    this.entity.collision.on('triggerenter', this.onTriggerEnter, this);
};

Hole.prototype.onTriggerEnter = function (otherEntity) {
    //-----------------------------------------------------------------------------------------------
    //NETWORK
    try {
        //If player is not the host, then do not activate
        if(sockets.id != GRD.hostSocketId) return;
        GameUpdater.prototype.playerInHole(otherEntity);
    } catch (error) {
        //console.log(error);
    }
    //------------------------------------------------------------------------------------------------
};

