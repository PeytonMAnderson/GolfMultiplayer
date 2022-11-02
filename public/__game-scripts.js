// follow.js
var Follow = pc.createScript('follow');

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
    this.entity.setPosition(this.vec); 
};


// movement.js
var Movement = pc.createScript('movement');

Movement.attributes.add('speed', {
    type: 'number',    
    default: 0.1,
    min: 0.05,
    max: 0.5,
    precision: 2,
    description: 'Controls the movement speed'
});

// initialize code called once per entity
Movement.prototype.initialize = function() {
    this.force = new pc.Vec3();
};

// update code called every frame
Movement.prototype.update = function(dt) {
    var forceX = 0;
    var forceZ = 0;

    // calculate force based on pressed keys
    if (this.app.keyboard.isPressed(pc.KEY_A)) {
        forceX = -this.speed;
    } 

    if (this.app.keyboard.isPressed(pc.KEY_D)) {
        forceX += this.speed;
    }

    if (this.app.keyboard.isPressed(pc.KEY_W)) {
        forceZ = -this.speed;
    } 

    if (this.app.keyboard.isPressed(pc.KEY_S)) {
        forceZ += this.speed;
    }

    this.force.x = forceX;
    this.force.z = forceZ;

    // if we have some non-zero force
    if (this.force.length()) {

        // calculate force vector
        var rX = Math.cos(-Math.PI * 0.25);
        var rY = Math.sin(-Math.PI * 0.25);
        this.force.set(this.force.x * rX - this.force.z * rY,  0, this.force.z * rX + this.force.x * rY);

        // clamp force to the speed
        if (this.force.length() > this.speed) {
            this.force.normalize().scale(this.speed);
        }
    }


    //-------------------------------------------------------------------------------------------------
    //NETWORKING
    try {
        if(GRD.hostSocketId == sockets.id) {
            // apply impulse to move the entity
            this.entity.rigidbody.applyImpulse(this.force);
        } else {
            //Send to host for processing
            sendPlayerInput(this.force);
        }
    } catch (error) {
        console.log(error);
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
    if (pos.y < 0) {this.teleport(this.lastTeleportFrom, this.lastTeleportTo);}
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

    // teleport entity to the target entity
    otherEntity.script.teleportable.teleport(this.entity, this.target);
    
    //-----------------------------------------------------------------------------------------------
    //NETWORK
    try {
        //If player is not the host, then do not activate
        if(sockets.id != GRD.hostSocketId) {
            return;
        }
        
    } catch (error) {
        console.log(error);
    }
    //------------------------------------------------------------------------------------------------

    //Load Next Scene
    loadScene('Scene 2', { hierarchy: true, settings: true }, (err, loadedSceneRootEntity) => {
        if (err) {
            console.error(err);
        } else {
            // Scene hierachary has successfully been loaded
            console.log("LOADED NEW SCENE");
        }
    });
};


// orbitCamera.js
var OrbitCamera = pc.createScript('orbitCamera');

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
    this.pivotPoint.copy(lookAtPoint);
    this.entity.setPosition(resetPoint);

    this.entity.lookAt(lookAtPoint);

    var distance = OrbitCamera.distanceBetween;
    distance.sub2(lookAtPoint, resetPoint);
    this.distance = distance.length();

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

    this._pivotPoint = new pc.Vec3();
    this._pivotPoint.copy(this._modelsAabb.center);

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

    this._updatePosition();
};


OrbitCamera.prototype._updatePosition = function () {
    // Work out the camera position based on the pivot point, pitch, yaw and distance
    this.entity.setLocalPosition(0,0,0);
    this.entity.setLocalEulerAngles(this._pitch, this._yaw, 0);

    var position = this.entity.getPosition();
    position.copy(this.entity.forward);
    position.scale(-this._distance);
    position.add(this.pivotPoint);
    this.entity.setPosition(position);
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
    switch (event.button) {
        case pc.MOUSEBUTTON_LEFT: {
            this.lookButtonDown = true;
        } break;
            
        case pc.MOUSEBUTTON_MIDDLE: 
        case pc.MOUSEBUTTON_RIGHT: {
            this.panButtonDown = true;
        } break;
    }
};


MouseInput.prototype.onMouseUp = function (event) {
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
    if (this.lookButtonDown) {
        this.orbitCamera.pitch -= event.dy * this.orbitSensitivity;
        this.orbitCamera.yaw -= event.dx * this.orbitSensitivity;
        
    } else if (this.panButtonDown) {
        this.pan(event);   
    }
    
    this.lastPoint.set(event.x, event.y);
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
        
        this.app.touch.on(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
        
        this.on('destroy', function() {
            this.app.touch.off(pc.EVENT_TOUCHSTART, this.onTouchStartEndCancel, this);
            this.app.touch.off(pc.EVENT_TOUCHEND, this.onTouchStartEndCancel, this);
            this.app.touch.off(pc.EVENT_TOUCHCANCEL, this.onTouchStartEndCancel, this);

            this.app.touch.off(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
        });
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
    var touches = event.touches;
    if (touches.length == 1) {
        var touch = touches[0];
        
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
//Incremented each update cycle
var tick = 0;
//How many update frames before a game update is sent to players
var tick_ratio = 2;

// initialize code called once per entity
GameUpdater.prototype.initialize = function() {
    thisPlayer = this.app.root.findByName('ball');
    thisOther = this.app.root.findByName('other_ball');
    console.log("Loading Complete!");
    loaded = true;
};

// update code called every frame
GameUpdater.prototype.update = function(dt) {
    //If this script is being ran without network.js
    try {
        if(GRD);
    } catch (error) {
        console.log(error);
        return;
    }

    tick++;
    if(tick <= tick_ratio) return;
    tick = 0;

    //Run this script with network.js
    if(sockets.id == GRD.hostSocketId) {
        for(let name in this.playerArray) {
            if(this.playerArray[name] == undefined) {continue;}
            let i = getPlayer(name);
            //If player went out of bounds, reset location
            if(this.playerArray[name].getPosition().y < 0) {
                this.playerArray[name].rigidbody.teleport(GRD.origin.x, GRD.origin.y, GRD.origin.z);
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
                    data.Players[i].myAngVelocity
                );
            }  else {
                if(this.playerArray[data.name] == undefined) {this.playerArray[data.name] = thisPlayer;}
            }
        }
    }
    this.initialized = true;
};

//Remove Player
GameUpdater.prototype.removePlayerBall = function (index) {
    if(this.playerArray[GRD.Players[index].myName] == undefined) {console.log("BALL DOES NOT EXIST, CANNOT REMOVE"); return;}
    this.playerArray[GRD.Players[index].myName].destroy();
    this.playerArray[GRD.Players[index].myName] = undefined;
}

//Add Player
GameUpdater.prototype.addPlayerBall = function (data) {
    //data = {name, myPosition, myLinVelocity, myAngVelocity}
    if(this.playerArray[data.name] != undefined) {console.log("BALL ALREADY EXISTS"); return;}
    this.playerArray[data.name] = this.createPlayerEnitity(data.myPosition, data.myLinVelocity, data.myAngVelocity);
};

GameUpdater.prototype.createPlayerEnitity = function(pos, lin_vel, ang_vel) {
    var newPlayer = thisOther.clone();  //Create a copy of the "Other Ball"
    newPlayer.enabled = true;   //Enable it so it is visible in game
    thisOther.getParent().addChild(newPlayer);  //Add Copy to the scene structure
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
            console.log(error);
        }
    }
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
    if(this.playerArray[data.name].rigidbody) {this.playerArray[data.name].rigidbody.applyImpulse(data.force);}};
//-------------------------------------------------------------------------------------------------

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
    this.div.classList.add('container');
    this.div.innerHTML = this.html.resource || '';

    // append to body
    // can be appended somewhere else
    // it is recommended to have some container element
    // to prevent iOS problems of overfloating elements off the screen
    document.body.appendChild(this.div);

    //--------------------------------------------------------------------------
    //NETWORKING
    try {
        console.log(GRD.hostSocketId);
        if(App.mySocketId.toString() == GRD.hostSocketId) {
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
    let join_button = this.div.querySelector('.button');

    if(join_button) {
        console.log("Found Button");
        
        join_button.addEventListener('click', function() {
            console.log("Clicked Button");
            console.log(join_input.value);
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
    let div = document.body.querySelector('.container');
    document.body.removeChild(div);
    loadScene('Main Scene', { hierarchy: true, settings: true }, (err, loadedSceneRootEntity) => {
        if (err) {
            console.error(err);
        } else {
            // Scene hierachary has successfully been loaded
            console.log("LOADED NEW SCENE");
        }
    });
}





