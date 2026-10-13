// Randy Mattoka
// Dino Walk: hierarchical, textured avatar (written for CSE 470 at ASU)

var canvas;
var gl;
var program;

var numVertices = 36;

var pointsArray = [];
var normalsArray = [];
var texCoordsArray = [];

var modelViewMatrix;
var projectionMatrix;
var instanceMatrix;
var stack = [];

var modelViewMatrixLoc;
var projectionMatrixLoc;
var normalMatrixLoc;
var baseColorLoc;
var useTextureLoc;
var textureModeLoc;

var avatarTexture;
var groundTexture;

var animationEnabled = true;
var walkTime = 0.0;

var textureMode = {
    MODULATE: 0,
    DECAL: 1
};

var vertices = [
    vec4(-0.5, -0.5, 0.5, 1.0),
    vec4(-0.5, 0.5, 0.5, 1.0),
    vec4(0.5, 0.5, 0.5, 1.0),
    vec4(0.5, -0.5, 0.5, 1.0),
    vec4(-0.5, -0.5, -0.5, 1.0),
    vec4(-0.5, 0.5, -0.5, 1.0),
    vec4(0.5, 0.5, -0.5, 1.0),
    vec4(0.5, -0.5, -0.5, 1.0)
];

var texCoord = [
    vec2(0.0, 0.0),
    vec2(0.0, 1.0),
    vec2(1.0, 1.0),
    vec2(1.0, 0.0)
];

var torsoId = 0;
var headId = 1;
var snoutId = 2;
var leftArmId = 3;
var rightArmId = 4;
var leftLegId = 5;
var leftFootId = 6;
var rightLegId = 7;
var rightFootId = 8;
var tailId = 9;
var saddleId = 10;

var numNodes = 11;
var figure = [];
for (var i = 0; i < numNodes; i++) {
    figure[i] = createNode(null, null, null, null);
}

var theta = [];

var dimensions = {
    torsoHeight: 2.9,
    torsoWidth: 1.8,
    torsoDepth: 2.05,
    headHeight: 1.6,
    headWidth: 1.6,
    headDepth: 1.7,
    snoutHeight: 0.9,
    snoutWidth: 1.3,
    snoutDepth: 1.18,
    armHeight: 1.08,
    armWidth: 0.56,
    armDepth: 0.56,
    legHeight: 1.35,
    legWidth: 0.75,
    legDepth: 0.8,
    footHeight: 0.45,
    footWidth: 1.05,
    footDepth: 1.22,
    tailHeight: 0.7,
    tailWidth: 0.72,
    tailDepth: 1.8,
    saddleHeight: 1.05,
    saddleWidth: 0.98,
    saddleDepth: 0.22
};

var colors = {
    body: vec4(0.44, 0.83, 0.29, 1.0),
    belly: vec4(0.94, 0.96, 0.89, 1.0),
    snout: vec4(0.92, 0.98, 0.88, 1.0),
    saddle: vec4(0.92, 0.14, 0.14, 1.0),
    shoe: vec4(0.97, 0.53, 0.18, 1.0),
    ground: vec4(0.53, 0.73, 0.42, 1.0)
};

var sceneCenter = {
    x: 0.0,
    z: -1.0
};

var viewer = {
    eye: vec3(0.0, 7.8, 14.0),
    at: vec3(sceneCenter.x, 1.6, sceneCenter.z),
    up: vec3(0.0, 1.0, 0.0)
};

var lightPosition = vec4(6.0, 9.0, 12.0, 1.0);
var lightAmbient = vec4(0.28, 0.28, 0.28, 1.0);
var lightDiffuse = vec4(1.0, 1.0, 1.0, 1.0);
var lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);
var materialAmbient = vec4(1.0, 1.0, 1.0, 1.0);
var materialDiffuse = vec4(1.0, 1.0, 1.0, 1.0);
var materialSpecular = vec4(0.45, 0.45, 0.45, 1.0);
var materialShininess = 24.0;

var lastTimestamp = 0.0;

function scale4(a, b, c) {
    var result = mat4();
    result[0][0] = a;
    result[1][1] = b;
    result[2][2] = c;
    return result;
}

function createNode(transform, render, sibling, child) {
    return {
        transform: transform,
        render: render,
        sibling: sibling,
        child: child
    };
}

function quad(a, b, c, d, normal) {
    pointsArray.push(vertices[a]);
    normalsArray.push(normal);
    texCoordsArray.push(texCoord[0]);

    pointsArray.push(vertices[b]);
    normalsArray.push(normal);
    texCoordsArray.push(texCoord[1]);

    pointsArray.push(vertices[c]);
    normalsArray.push(normal);
    texCoordsArray.push(texCoord[2]);

    pointsArray.push(vertices[a]);
    normalsArray.push(normal);
    texCoordsArray.push(texCoord[0]);

    pointsArray.push(vertices[c]);
    normalsArray.push(normal);
    texCoordsArray.push(texCoord[2]);

    pointsArray.push(vertices[d]);
    normalsArray.push(normal);
    texCoordsArray.push(texCoord[3]);
}

function colorCube() {
    quad(1, 0, 3, 2, vec3(0.0, 0.0, 1.0));
    quad(2, 3, 7, 6, vec3(1.0, 0.0, 0.0));
    quad(3, 0, 4, 7, vec3(0.0, -1.0, 0.0));
    quad(6, 5, 1, 2, vec3(0.0, 1.0, 0.0));
    quad(4, 5, 6, 7, vec3(0.0, 0.0, -1.0));
    quad(5, 4, 0, 1, vec3(-1.0, 0.0, 0.0));
}

function configureTexture(texture, image) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    if (image.data) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, image.width, image.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, image.data);
    } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    }

    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
}

function createAvatarTexture() {
    var size = 128;
    var data = new Uint8Array(4 * size * size);
    var base = [247, 252, 240, 0];

    for (var i = 0; i < size; i++) {
        for (var j = 0; j < size; j++) {
            var idx = 4 * (i * size + j);
            var u = j / (size - 1);
            var v = i / (size - 1);

            data[idx] = base[0];
            data[idx + 1] = base[1];
            data[idx + 2] = base[2];
            data[idx + 3] = base[3];

            var stripe = 0.5 + 0.5 * Math.sin(24.0 * u + 12.0 * v);
            var diagonal = Math.sin(12.0 * (u - v));
            var dx = u - 0.5;
            var dy = v - 0.5;
            var spot = Math.sin(36.0 * Math.sqrt(dx * dx + dy * dy));

            if (stripe > 0.8) {
                data[idx] = 50;
                data[idx + 1] = 113;
                data[idx + 2] = 43;
                data[idx + 3] = 95;
            }

            if (diagonal > 0.84) {
                data[idx] = 84;
                data[idx + 1] = 152;
                data[idx + 2] = 58;
                data[idx + 3] = 120;
            }

            if (spot > 0.92) {
                data[idx] = 232;
                data[idx + 1] = 245;
                data[idx + 2] = 219;
                data[idx + 3] = 160;
            }
        }
    }

    return { width: size, height: size, data: data };
}

function createGroundTexture() {
    var size = 128;
    var data = new Uint8Array(4 * size * size);

    for (var i = 0; i < size; i++) {
        for (var j = 0; j < size; j++) {
            var idx = 4 * (i * size + j);
            var stripe = 0.5 + 0.5 * Math.sin(j * 0.22);
            var grain = 0.5 + 0.5 * Math.sin((i * 0.19) + (j * 0.11));
            var grass = 88 + Math.floor(70 * stripe);
            var dirt = 72 + Math.floor(40 * grain);

            data[idx] = 52 + Math.floor(18 * grain);
            data[idx + 1] = grass;
            data[idx + 2] = 40 + Math.floor(14 * stripe);
            data[idx + 3] = 255;

            if ((i % 22) < 2 || (j % 18) < 2) {
                data[idx] = 70;
                data[idx + 1] = dirt + 25;
                data[idx + 2] = 45;
            }
        }
    }

    return { width: size, height: size, data: data };
}

function loadGrassGroundTexture() {
    if (typeof grass_base64 === "undefined") {
        return;
    }

    var grassImage = new Image();
    grassImage.onload = function() {
        configureTexture(groundTexture, grassImage);
    };
    grassImage.src = grass_base64;
}

function initNodes(id) {
    var m = mat4();
    var d = dimensions;
    var pathPosition = getPathPosition(walkTime);

    switch (id) {
    case torsoId:
        m = mult(translate(pathPosition[0], 1.45, pathPosition[2]), rotate(getPathHeadingDegrees(walkTime), 0, 1, 0));
        figure[torsoId] = createNode(m, torso, null, headId);
        break;

    case headId:
        m = translate(0.0, d.torsoHeight * 0.78, d.torsoDepth * 0.28);
        m = mult(m, rotate(theta[headId], 1, 0, 0));
        figure[headId] = createNode(m, head, leftArmId, snoutId);
        break;

    case snoutId:
        m = translate(0.0, 0.12, (d.headDepth * 0.5) - 0.02);
        m = mult(m, rotate(theta[snoutId], 1, 0, 0));
        figure[snoutId] = createNode(m, snout, null, null);
        break;

    case leftArmId:
        m = translate(-(d.torsoWidth * 0.63), d.torsoHeight * 0.50, d.torsoDepth * 0.08);
        m = mult(m, rotate(theta[leftArmId], 1, 0, 0));
        figure[leftArmId] = createNode(m, leftArm, rightArmId, null);
        break;

    case rightArmId:
        m = translate(d.torsoWidth * 0.63, d.torsoHeight * 0.50, d.torsoDepth * 0.08);
        m = mult(m, rotate(theta[rightArmId], 1, 0, 0));
        figure[rightArmId] = createNode(m, rightArm, saddleId, null);
        break;

    case saddleId:
        m = translate(0.0, d.torsoHeight * 0.42, -(d.torsoDepth * 0.60));
        figure[saddleId] = createNode(m, saddle, leftLegId, null);
        break;

    case leftLegId:
        m = translate(-(d.torsoWidth * 0.33), -0.08, 0.45);
        m = mult(m, rotate(theta[leftLegId], 1, 0, 0));
        figure[leftLegId] = createNode(m, leftLeg, rightLegId, leftFootId);
        break;

    case leftFootId:
        m = translate(0.0, -d.legHeight, 0.22);
        m = mult(m, rotate(theta[leftFootId], 1, 0, 0));
        figure[leftFootId] = createNode(m, leftFoot, null, null);
        break;

    case rightLegId:
        m = translate(d.torsoWidth * 0.33, -0.08, 0.45);
        m = mult(m, rotate(theta[rightLegId], 1, 0, 0));
        figure[rightLegId] = createNode(m, rightLeg, tailId, rightFootId);
        break;

    case rightFootId:
        m = translate(0.0, -d.legHeight, 0.22);
        m = mult(m, rotate(theta[rightFootId], 1, 0, 0));
        figure[rightFootId] = createNode(m, rightFoot, null, null);
        break;

    case tailId:
        m = translate(0.0, d.torsoHeight * 0.31, -(d.torsoDepth * 0.43));
        m = mult(m, rotate(theta[tailId], 1, 0, 0));
        figure[tailId] = createNode(m, tail, null, null);
        break;
    }
}

function traverse(id) {
    if (id == null) {
        return;
    }

    stack.push(modelViewMatrix);
    modelViewMatrix = mult(modelViewMatrix, figure[id].transform);
    figure[id].render();
    if (figure[id].child != null) {
        traverse(figure[id].child);
    }
    modelViewMatrix = stack.pop();
    if (figure[id].sibling != null) {
        traverse(figure[id].sibling);
    }
}

function applyMatrices(instance) {
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instance));
    gl.uniformMatrix3fv(normalMatrixLoc, false, flatten(normalMatrix(instance, true)));
}

function drawCube(color, texture, useTexture, mode, scaleX, scaleY, scaleZ, translateX, translateY, translateZ) {
    instanceMatrix = mult(modelViewMatrix, translate(translateX, translateY, translateZ));
    instanceMatrix = mult(instanceMatrix, scale4(scaleX, scaleY, scaleZ));
    applyMatrices(instanceMatrix);
    gl.uniform4fv(baseColorLoc, flatten(color));
    gl.uniform1i(useTextureLoc, useTexture ? 1 : 0);
    gl.uniform1i(textureModeLoc, mode);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.drawArrays(gl.TRIANGLES, 0, numVertices);
}

function torso() {
    var d = dimensions;
    drawCube(colors.body, avatarTexture, true, textureMode.DECAL, d.torsoWidth, d.torsoHeight, d.torsoDepth, 0.0, 0.5 * d.torsoHeight, 0.0);
    drawCube(colors.belly, null, false, textureMode.DECAL, d.torsoWidth * 0.5, d.torsoHeight * 0.58, d.torsoDepth * 0.34, 0.0, 0.43 * d.torsoHeight, d.torsoDepth * 0.42);
}

function head() {
    var d = dimensions;
    drawCube(colors.body, avatarTexture, true, textureMode.DECAL, d.headWidth, d.headHeight, d.headDepth, 0.0, 0.5 * d.headHeight, 0.0);
}

function snout() {
    var d = dimensions;
    drawCube(colors.snout, null, false, textureMode.DECAL, d.snoutWidth, d.snoutHeight, d.snoutDepth, 0.0, 0.32 * d.snoutHeight, 0.5 * d.snoutDepth);
}

function leftArm() {
    var d = dimensions;
    drawCube(colors.body, avatarTexture, true, textureMode.DECAL, d.armWidth, d.armHeight, d.armDepth, 0.0, -0.5 * d.armHeight, 0.0);
}

function rightArm() {
    var d = dimensions;
    drawCube(colors.body, avatarTexture, true, textureMode.DECAL, d.armWidth, d.armHeight, d.armDepth, 0.0, -0.5 * d.armHeight, 0.0);
}

function leftLeg() {
    var d = dimensions;
    drawCube(colors.body, avatarTexture, true, textureMode.DECAL, d.legWidth, d.legHeight, d.legDepth, 0.0, -0.5 * d.legHeight, 0.0);
}

function rightLeg() {
    var d = dimensions;
    drawCube(colors.body, avatarTexture, true, textureMode.DECAL, d.legWidth, d.legHeight, d.legDepth, 0.0, -0.5 * d.legHeight, 0.0);
}

function leftFoot() {
    var d = dimensions;
    drawCube(colors.shoe, null, false, textureMode.DECAL, d.footWidth, d.footHeight, d.footDepth, 0.0, -0.12 * d.footHeight, 0.38 * d.footDepth);
}

function rightFoot() {
    var d = dimensions;
    drawCube(colors.shoe, null, false, textureMode.DECAL, d.footWidth, d.footHeight, d.footDepth, 0.0, -0.12 * d.footHeight, 0.38 * d.footDepth);
}

function tail() {
    var d = dimensions;
    drawCube(colors.body, avatarTexture, true, textureMode.DECAL, d.tailWidth, d.tailHeight, d.tailDepth, 0.0, 0.0, -0.42 * d.tailDepth);
}

function saddle() {
    var d = dimensions;
    drawCube(colors.saddle, null, false, textureMode.DECAL, d.saddleWidth, d.saddleHeight, d.saddleDepth, 0.0, 0.5 * d.saddleHeight, 0.0);
}

function drawGround() {
    var groundBase = mult(lookAt(viewer.eye, viewer.at, viewer.up), translate(sceneCenter.x, 0.0, sceneCenter.z));
    instanceMatrix = mult(groundBase, scale4(16.0, 0.12, 16.0));
    applyMatrices(instanceMatrix);
    gl.uniform4fv(baseColorLoc, flatten(vec4(1.0, 1.0, 1.0, 1.0)));
    gl.uniform1i(useTextureLoc, 1);
    gl.uniform1i(textureModeLoc, textureMode.MODULATE);
    gl.bindTexture(gl.TEXTURE_2D, groundTexture);
    gl.drawArrays(gl.TRIANGLES, 0, numVertices);
}

function setPose(time) {
    var stride = Math.sin(time * 3.1);
    var oppositeStride = Math.sin(time * 3.1 + Math.PI);
    var bounce = Math.sin(time * 6.2);

    theta[headId] = 6.0 + 6.0 * Math.sin(time * 1.6 + 0.5);
    theta[snoutId] = -2.0 + 2.0 * Math.sin(time * 1.3);
    theta[leftArmId] = 14.0 + 18.0 * oppositeStride;
    theta[rightArmId] = 14.0 + 18.0 * stride;
    theta[leftLegId] = 18.0 * stride;
    theta[rightLegId] = 18.0 * oppositeStride;
    theta[leftFootId] = -8.0 - 14.0 * Math.max(0.0, oppositeStride);
    theta[rightFootId] = -8.0 - 14.0 * Math.max(0.0, stride);
    theta[tailId] = -18.0 + 16.0 * Math.sin(time * 3.1 + Math.PI * 0.5);
    theta[saddleId] = 0.0;

    viewer.at = vec3(sceneCenter.x, 1.6 + 0.08 * bounce, sceneCenter.z);
}

function getPathPosition(t) {
    return vec3(
        sceneCenter.x + 4.2 * Math.cos(t) + 1.2 * Math.cos(2.0 * t + 0.4),
        0.0,
        sceneCenter.z + 2.7 * Math.sin(t) - 0.9 * Math.sin(3.0 * t)
    );
}

function getPathHeadingDegrees(t) {
    var dx = -4.2 * Math.sin(t) - 2.4 * Math.sin(2.0 * t + 0.4);
    var dz = 2.7 * Math.cos(t) - 2.7 * Math.cos(3.0 * t);
    return (180.0 / Math.PI) * Math.atan2(dx, dz);
}

function resetScene() {
    walkTime = Math.PI * 0.55;
    setPose(walkTime);
    for (var i = 0; i < numNodes; i++) {
        initNodes(i);
    }
}

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert("WebGL isn't available");
        return;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.56, 0.82, 0.98, 1.0);
    gl.enable(gl.DEPTH_TEST);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    colorCube();

    var nBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW);
    var vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vNormal);

    var vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW);
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    var tBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(texCoordsArray), gl.STATIC_DRAW);
    var vTexCoord = gl.getAttribLocation(program, "vTexCoord");
    gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vTexCoord);

    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
    normalMatrixLoc = gl.getUniformLocation(program, "normalMatrix");
    baseColorLoc = gl.getUniformLocation(program, "baseColor");
    useTextureLoc = gl.getUniformLocation(program, "useTexture");
    textureModeLoc = gl.getUniformLocation(program, "textureMode");

    var ambientProduct = mult(lightAmbient, materialAmbient);
    var diffuseProduct = mult(lightDiffuse, materialDiffuse);
    var specularProduct = mult(lightSpecular, materialSpecular);

    gl.uniform4fv(gl.getUniformLocation(program, "ambientProduct"), flatten(ambientProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "diffuseProduct"), flatten(diffuseProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "specularProduct"), flatten(specularProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "lightPosition"), flatten(lightPosition));
    gl.uniform1f(gl.getUniformLocation(program, "shininess"), materialShininess);

    projectionMatrix = perspective(50.0, canvas.width / canvas.height, 0.1, 100.0);
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    avatarTexture = gl.createTexture();
    groundTexture = gl.createTexture();
    configureTexture(avatarTexture, createAvatarTexture());
    configureTexture(groundTexture, createGroundTexture());
    loadGrassGroundTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(gl.getUniformLocation(program, "textureSampler"), 0);

    resetScene();

    document.getElementById("toggle-animation").onclick = function() {
        animationEnabled = !animationEnabled;
        this.textContent = animationEnabled ? "Pause Animation" : "Resume Animation";
    };

    document.getElementById("reset-scene").onclick = function() {
        resetScene();
    };

    render(0.0);
};

function render(timestamp) {
    var dt = (timestamp - lastTimestamp) * 0.001;
    lastTimestamp = timestamp;

    if (animationEnabled) {
        walkTime += Math.min(dt, 0.05) * 0.95;
    }

    setPose(walkTime);
    for (var i = 0; i < numNodes; i++) {
        initNodes(i);
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);

    drawGround();

    modelViewMatrix = lookAt(viewer.eye, viewer.at, viewer.up);
    traverse(torsoId);

    requestAnimFrame(render);
}
