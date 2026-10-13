// cube-dance.js
// Randy Mattoka - written for CSE 470 at ASU

"use strict";

var gl;
var program;

var cubeVertices = [];
var cubeColor = [];

var outerCubes = [];
var outerCubeCount = 8;
var MIN_OUTER_CUBES = 4;
var MAX_OUTER_CUBES = 20;
var OUTER_RADIUS = 0.75;

var sharedAngleRad = 0.0;
var rotationSpeedRad = 0.03;
var cubeScale = 0.2;

var centerCubeRotates = false;
var centerCubeAxis = vec3(1.0, 0.0, 0.0);

var modelViewMatrixLoc;
var projectionMatrixLoc;
var colorBuffer;
var vertexBuffer;

var projectionMatrix;
var viewMatrix;
var inverseViewProjectionMatrix;

var CUBE_LOCAL_NEG_CENTER = vec3(-0.5, -0.5, 0.5);

var scaleValueElem;
var speedValueElem;
var cubeCountValueElem;

window.onload = function init() {
    var canvas = document.getElementById("gl-canvas");
    scaleValueElem = document.getElementById("scaleValue");
    speedValueElem = document.getElementById("speedValue");
    cubeCountValueElem = document.getElementById("cubeCountValue");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert("WebGL isn't available");
        return;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.96, 0.96, 0.96, 1.0);
    gl.enable(gl.DEPTH_TEST);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    rebuildCubeGeometry();
    createCubeInstances();
    initBuffers();
    initMatrices(canvas.width / canvas.height);
    initUI(canvas);

    requestAnimationFrame(render);
};

//extra credit, user can change # of cubes
function createCubeInstances() {
    outerCubes = [];

    for (var i = 0; i < outerCubeCount; ++i) {
        var theta = (2.0 * Math.PI * i) / outerCubeCount;
        var x = OUTER_RADIUS * Math.cos(theta);
        var y = OUTER_RADIUS * Math.sin(theta);

        outerCubes.push({
            location: vec3(x, y, 0.0),
            axis: vec3(x, y, 0.0)
        });
    }
}

//to place outer cubes evenly around the circle
function rebuildCubeGeometry() {
    cubeVertices = [];
    cubeColor = [];
    createCube();
}

function initBuffers() {
    colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cubeColor), gl.STATIC_DRAW);

    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cubeVertices), gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
}

//rebuild vertex/color arrays
function updateCubeBuffers() {
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cubeColor), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(cubeVertices), gl.STATIC_DRAW);
}

function initMatrices(aspect) {
    var eye = vec3(0.0, 0.0, 3.0);
    var at = vec3(0.0, 0.0, 0.0);
    var up = vec3(0.0, 1.0, 0.0);

    viewMatrix = lookAt(eye, at, up);
    projectionMatrix = perspective(50.0, aspect, 0.1, 12.0);
    inverseViewProjectionMatrix = inverse(mult(projectionMatrix, viewMatrix));
}

function initUI(canvas) {
    var resetBtn = document.getElementById("resetCenterBtn");
    var scaleSlider = document.getElementById("scaleSlider");
    var speedSlider = document.getElementById("speedSlider");
    var increaseCubesBtn = document.getElementById("increaseCubesBtn");
    var decreaseCubesBtn = document.getElementById("decreaseCubesBtn");
    var randomizeColorsBtn = document.getElementById("randomizeColorsBtn");

    updateScaleUI();
    updateSpeedUI();
    updateCubeCountUI();

    resetBtn.addEventListener("click", function () {
        centerCubeRotates = false;
    });

    scaleSlider.addEventListener("input", function (event) {
        cubeScale = Number(event.target.value) / 100.0;
        updateScaleUI();
    });

    speedSlider.addEventListener("input", function (event) {
        rotationSpeedRad = Number(event.target.value);
        updateSpeedUI();
    });

    increaseCubesBtn.addEventListener("click", function () {
        if (outerCubeCount < MAX_OUTER_CUBES) {
            outerCubeCount += 1;
            createCubeInstances();
            updateCubeCountUI();
        }
    });

    decreaseCubesBtn.addEventListener("click", function () {
        if (outerCubeCount > MIN_OUTER_CUBES) {
            outerCubeCount -= 1;
            createCubeInstances();
            updateCubeCountUI();
        }
    });

    randomizeColorsBtn.addEventListener("click", function () {
        randomizeFaceColors();
        rebuildCubeGeometry();
        updateCubeBuffers();
    });

    canvas.addEventListener("click", function (event) {
        var selectedIndex = pickOuterCube(canvas, event.clientX, event.clientY);

        if (selectedIndex >= 0) {
            centerCubeRotates = true;
            centerCubeAxis = outerCubes[selectedIndex].axis;
        }
    });
}

function updateScaleUI() {
    var percent = Math.round(cubeScale * 100.0);
    scaleValueElem.textContent = percent + "%";
}

function updateSpeedUI() {
    speedValueElem.textContent = rotationSpeedRad.toFixed(2);
}

function updateCubeCountUI() {
    cubeCountValueElem.textContent = outerCubeCount;
}

//another extra credit/ extra function for fun
function randomizeFaceColors() {
    if (typeof faceColors === "undefined" || faceColors.length === 0) {
        return;
    }

    for (var i = 0; i < faceColors.length; ++i) {
        var hue = (Math.random() + (i / faceColors.length)) % 1.0;
        var rgb = hsvToRgb(hue, 0.62, 0.86);
        faceColors[i] = vec4(rgb[0], rgb[1], rgb[2], 1.0);
    }
}

function hsvToRgb(h, s, v) {
    var i = Math.floor(h * 6.0);
    var f = h * 6.0 - i;
    var p = v * (1.0 - s);
    var q = v * (1.0 - f * s);
    var t = v * (1.0 - (1.0 - f) * s);
    var mod = i % 6;

    if (mod === 0) return vec3(v, t, p);
    if (mod === 1) return vec3(q, v, p);
    if (mod === 2) return vec3(p, v, t);
    if (mod === 3) return vec3(p, q, v);
    if (mod === 4) return vec3(t, p, v);
    return vec3(v, p, q);
}

function buildCubeModelMatrix(location, axis, angleRad) {
    var angleDeg = angleRad * 180.0 / Math.PI;

    var translateToLocation = translate(location);
    var rotateAroundAxis = rotate(angleDeg, axis);
    var scaleModel = scalem(cubeScale, cubeScale, cubeScale);
    var centerModelAtOrigin = translate(CUBE_LOCAL_NEG_CENTER);

    return mult(
        translateToLocation,
        mult(rotateAroundAxis, mult(scaleModel, centerModelAtOrigin))
    );
}

//assign new colors then rebuild
function pickOuterCube(canvas, mouseX, mouseY) {
    var rect = canvas.getBoundingClientRect();

    var px = mouseX - rect.left;
    var py = mouseY - rect.top;

    var xNdc = (2.0 * px) / rect.width - 1.0;
    var yNdc = 1.0 - (2.0 * py) / rect.height;

    var nearPoint = unprojectFromNdc(xNdc, yNdc, -1.0);
    var farPoint = unprojectFromNdc(xNdc, yNdc, 1.0);
    var rayDir = subtract(farPoint, nearPoint);

    if (Math.abs(rayDir[2]) < 1e-6) {
        return -1;
    }

    var t = -nearPoint[2] / rayDir[2];
    if (t < 0.0) {
        return -1;
    }

    var hitPoint = vec3(
        nearPoint[0] + t * rayDir[0],
        nearPoint[1] + t * rayDir[1],
        0.0
    );

    var selectionRadius = Math.max(0.08, 0.42 / Math.sqrt(outerCubeCount)) + cubeScale * 0.25;
    var bestIndex = -1;
    var bestDist = Number.POSITIVE_INFINITY;

    for (var i = 0; i < outerCubes.length; ++i) {
        var dx = hitPoint[0] - outerCubes[i].location[0];
        var dy = hitPoint[1] - outerCubes[i].location[1];
        var dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < bestDist && dist <= selectionRadius) {
            bestDist = dist;
            bestIndex = i;
        }
    }

    return bestIndex;
}

function unprojectFromNdc(x, y, z) {
    var clip = multiplyMat4Vec4(inverseViewProjectionMatrix, vec4(x, y, z, 1.0));

    if (clip[3] === 0.0) {
        return vec3(0.0, 0.0, 0.0);
    }

    return vec3(clip[0] / clip[3], clip[1] / clip[3], clip[2] / clip[3]);
}

function multiplyMat4Vec4(m, v) {
    return vec4(
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2] + m[0][3] * v[3],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2] + m[1][3] * v[3],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2] + m[2][3] * v[3],
        m[3][0] * v[0] + m[3][1] * v[1] + m[3][2] * v[2] + m[3][3] * v[3]
    );
}

function drawCube(modelMatrix) {
    var modelViewMatrix = mult(viewMatrix, modelMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    gl.drawArrays(gl.TRIANGLES, 0, cubeVertices.length);
}

//itll convert moust clicks into a world space ray to find the nearest cube
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    sharedAngleRad -= rotationSpeedRad;
    if (sharedAngleRad > 2.0 * Math.PI) {
        sharedAngleRad -= 2.0 * Math.PI;
    }

    // Center cube
    var centerAxis = centerCubeRotates ? centerCubeAxis : vec3(1.0, 0.0, 0.0);
    var centerAngle = centerCubeRotates ? sharedAngleRad : 0.0;
    var centerMatrix = buildCubeModelMatrix(vec3(0.0, 0.0, 0.0), centerAxis, centerAngle);
    drawCube(centerMatrix);

    // Outer cubes
    for (var i = 0; i < outerCubes.length; ++i) {
        var c = outerCubes[i];
        var modelMatrix = buildCubeModelMatrix(c.location, c.axis, sharedAngleRad);
        drawCube(modelMatrix);
    }

    requestAnimationFrame(render);
}
