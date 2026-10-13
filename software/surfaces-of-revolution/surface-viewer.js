/*
 * Name: Mattoka
 * Date: 2026-04-06
 * Surfaces of Revolution: main WebGL program (written for CSE 470 at ASU)
 */

(function () {
  "use strict";

  var gl;
  var canvas;

  var mainProgram;
  var lineProgram;

  var buffers = {
    position: null,
    normal: null,
    index: null,
    normalLines: null
  };

  var attribs = {
    main: {},
    line: {}
  };

  var uniforms = {
    main: {},
    line: {}
  };

  var meshes = {};
  var currentMesh = null;

  var state = {
    sorKey: "cylinder",
    materialKey: "copper",
    lightMode: "eye",
    showNormals: false,
    shininess: 120.0,
    fov: 60.0,
    aspect: 1.0,
    near: 0.1,
    far: 20.0,
    yaw: 0.0,
    pitch: 0.0,
    orbitRadius: 5.0,
    at: vec3(0.0, 0.0, 0.0),
    up: vec3(0.0, 1.0, 0.0),
    eye: vec3(0.0, 0.0, 5.0),
    lightAngle: 0.0,
    lightOrbitRadius: 2.0,
    lightOrbitHeight: 0.0
  };

  var light = {
    ambient: vec4(0.2, 0.2, 0.2, 1.0),
    diffuse: vec4(1.0, 1.0, 1.0, 1.0),
    specular: vec4(1.0, 1.0, 1.0, 1.0)
  };

  var materials = {
    copper: {
      name: "Brushed Copper",
      ambient: vec4(0.19, 0.10, 0.06, 1.0),
      diffuse: vec4(0.78, 0.40, 0.18, 1.0),
      specular: vec4(0.95, 0.75, 0.58, 1.0)
    },
    jade: {
      name: "Jade Ceramic",
      ambient: vec4(0.06, 0.14, 0.10, 1.0),
      diffuse: vec4(0.30, 0.74, 0.58, 1.0),
      specular: vec4(0.55, 0.90, 0.78, 1.0)
    }
  };

  var drag = {
    active: false,
    lastX: 0,
    lastY: 0
  };

  function transformPoint(m, v) {
    return vec4(
      m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2] + m[0][3] * v[3],
      m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2] + m[1][3] * v[3],
      m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2] + m[2][3] * v[3],
      m[3][0] * v[0] + m[3][1] * v[1] + m[3][2] * v[2] + m[3][3] * v[3]
    );
  }

  function updateEyeFromAngles() {
    var cp = Math.cos(state.pitch);
    state.eye = vec3(
      state.at[0] + state.orbitRadius * Math.sin(state.yaw) * cp,
      state.at[1] + state.orbitRadius * Math.sin(state.pitch),
      state.at[2] + state.orbitRadius * Math.cos(state.yaw) * cp
    );
  }

  function setupPrograms() {
    mainProgram = initShaders(gl, "main-vertex-shader", "main-fragment-shader");
    lineProgram = initShaders(gl, "line-vertex-shader", "line-fragment-shader");

    attribs.main.position = gl.getAttribLocation(mainProgram, "vPosition");
    attribs.main.normal = gl.getAttribLocation(mainProgram, "vNormal");

    uniforms.main.modelView = gl.getUniformLocation(mainProgram, "uModelViewMatrix");
    uniforms.main.projection = gl.getUniformLocation(mainProgram, "uProjectionMatrix");
    uniforms.main.normalMatrix = gl.getUniformLocation(mainProgram, "uNormalMatrix");
    uniforms.main.lightPosition = gl.getUniformLocation(mainProgram, "uLightPosition");
    uniforms.main.ambientProduct = gl.getUniformLocation(mainProgram, "uAmbientProduct");
    uniforms.main.diffuseProduct = gl.getUniformLocation(mainProgram, "uDiffuseProduct");
    uniforms.main.specularProduct = gl.getUniformLocation(mainProgram, "uSpecularProduct");
    uniforms.main.shininess = gl.getUniformLocation(mainProgram, "uShininess");

    attribs.line.position = gl.getAttribLocation(lineProgram, "vLinePosition");
    uniforms.line.modelView = gl.getUniformLocation(lineProgram, "uModelViewMatrix");
    uniforms.line.projection = gl.getUniformLocation(lineProgram, "uProjectionMatrix");
    uniforms.line.color = gl.getUniformLocation(lineProgram, "uLineColor");
  }

  function setupBuffers() {
    buffers.position = gl.createBuffer();
    buffers.normal = gl.createBuffer();
    buffers.index = gl.createBuffer();
    buffers.normalLines = gl.createBuffer();
  }

  function setCurrentMesh(meshKey) {
    state.sorKey = meshKey;
    currentMesh = meshes[meshKey];

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(currentMesh.positions), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(currentMesh.normals), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(currentMesh.indices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normalLines);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(currentMesh.normalLines), gl.STATIC_DRAW);

    configureCameraForMesh(currentMesh);
  }

  function configureCameraForMesh(mesh) {
    state.at = vec3(mesh.center[0], mesh.center[1], mesh.center[2]);
    var maxDim = Math.max(mesh.dimensions[0], mesh.dimensions[1], mesh.dimensions[2]);
    state.orbitRadius = maxDim * 2.8 + 0.25;
    state.near = Math.max(0.1, state.orbitRadius - 2.3 * maxDim);
    state.far = state.orbitRadius + 3.3 * maxDim;
    state.lightOrbitRadius = maxDim * 1.8;
    state.lightOrbitHeight = mesh.center[1] + 0.55 * maxDim;
    updateEyeFromAngles();
  }

  function computeLightWorldPosition() {
    if (state.lightMode === "eye") {
      return vec4(state.eye[0], state.eye[1], state.eye[2], 1.0);
    }
    return vec4(
      state.at[0] + state.lightOrbitRadius * Math.cos(state.lightAngle),
      state.lightOrbitHeight,
      state.at[2] + state.lightOrbitRadius * Math.sin(state.lightAngle),
      1.0
    );
  }

  function drawSurface(modelView, projection, lightEye) {
    var material = materials[state.materialKey];

    gl.useProgram(mainProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(attribs.main.position, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribs.main.position);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
    gl.vertexAttribPointer(attribs.main.normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribs.main.normal);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);

    gl.uniformMatrix4fv(uniforms.main.modelView, false, flatten(modelView));
    gl.uniformMatrix4fv(uniforms.main.projection, false, flatten(projection));
    gl.uniformMatrix3fv(uniforms.main.normalMatrix, false, flatten(normalMatrix(modelView, true)));
    gl.uniform4fv(uniforms.main.lightPosition, flatten(lightEye));
    gl.uniform4fv(uniforms.main.ambientProduct, flatten(mult(light.ambient, material.ambient)));
    gl.uniform4fv(uniforms.main.diffuseProduct, flatten(mult(light.diffuse, material.diffuse)));
    gl.uniform4fv(uniforms.main.specularProduct, flatten(mult(light.specular, material.specular)));
    gl.uniform1f(uniforms.main.shininess, state.shininess);

    gl.drawElements(gl.TRIANGLES, currentMesh.indices.length, gl.UNSIGNED_SHORT, 0);
  }

  function drawNormals(modelView, projection) {
    gl.useProgram(lineProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normalLines);
    gl.vertexAttribPointer(attribs.line.position, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(attribs.line.position);

    gl.uniformMatrix4fv(uniforms.line.modelView, false, flatten(modelView));
    gl.uniformMatrix4fv(uniforms.line.projection, false, flatten(projection));
    gl.uniform4fv(uniforms.line.color, flatten(vec4(0.0, 0.0, 0.0, 1.0)));

    gl.drawArrays(gl.LINES, 0, currentMesh.normalLines.length);
  }

  function updateReadouts(lightWorld) {
    var lightText = document.getElementById("lightPositionValue");
    if (lightText) {
      lightText.textContent = "(" +
        lightWorld[0].toFixed(2) + ", " +
        lightWorld[1].toFixed(2) + ", " +
        lightWorld[2].toFixed(2) + ")";
    }
  }

  function render() {
    if (state.lightMode === "orbit") {
      state.lightAngle += 0.015;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var modelView = lookAt(state.eye, state.at, state.up);
    var projection = perspective(state.fov, state.aspect, state.near, state.far);

    var lightWorld = computeLightWorldPosition();
    var lightEye = transformPoint(modelView, lightWorld);

    drawSurface(modelView, projection, lightEye);
    if (state.showNormals) {
      drawNormals(modelView, projection);
    }

    updateReadouts(lightWorld);
    requestAnimFrame(render);
  }

  function formatVec3(v) {
    return "(" + v[0].toFixed(3) + ", " + v[1].toFixed(3) + ", " + v[2].toFixed(3) + ")";
  }

  function logMeshBounds(mesh) {
    console.log(
      "[MinMax " + mesh.name + "] min=" + formatVec3(mesh.bounds.min) +
      " max=" + formatVec3(mesh.bounds.max) +
      " dimensions=" + formatVec3(mesh.dimensions)
    );
  }

  function setupInteractions() {
    var sorSelect = document.getElementById("sorSelect");
    var materialSelect = document.getElementById("materialSelect");
    var lightModeSelect = document.getElementById("lightModeSelect");
    var shininessSlider = document.getElementById("shininessSlider");
    var fovSlider = document.getElementById("fovSlider");
    var showNormalsCheckbox = document.getElementById("showNormalsCheckbox");

    sorSelect.addEventListener("change", function (event) {
      setCurrentMesh(event.target.value);
    });

    materialSelect.addEventListener("change", function (event) {
      state.materialKey = event.target.value;
    });

    lightModeSelect.addEventListener("change", function (event) {
      state.lightMode = event.target.value;
    });

    shininessSlider.addEventListener("input", function (event) {
      state.shininess = parseFloat(event.target.value);
      document.getElementById("shininessValue").textContent = event.target.value;
    });

    fovSlider.addEventListener("input", function (event) {
      state.fov = parseFloat(event.target.value);
      document.getElementById("fovValue").textContent = event.target.value + "\u00b0";
    });

    showNormalsCheckbox.addEventListener("change", function (event) {
      state.showNormals = !!event.target.checked;
    });

    canvas.addEventListener("mousedown", function (event) {
      drag.active = true;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;
    });

    window.addEventListener("mouseup", function () {
      drag.active = false;
    });

    canvas.addEventListener("mousemove", function (event) {
      if (!drag.active) {
        return;
      }
      var dx = event.clientX - drag.lastX;
      var dy = event.clientY - drag.lastY;
      drag.lastX = event.clientX;
      drag.lastY = event.clientY;

      state.yaw += dx * 0.012;
      state.pitch -= dy * 0.012;
      state.pitch = Math.max(-1.45, Math.min(1.45, state.pitch));
      updateEyeFromAngles();
    });
  }

  function bootstrapScene() {
    var tSteps = 90;
    var thetaSteps = 70;

    meshes.cylinder = MattokaGeometry.createCylinderMesh(tSteps, thetaSteps);
    meshes.cylinder.normalLines = MattokaGeometry.buildNormalLineVertices(
      meshes.cylinder,
      0.08
    );

    meshes.custom = MattokaGeometry.createCurvyMesh(tSteps, thetaSteps);
    meshes.custom.normalLines = MattokaGeometry.buildNormalLineVertices(
      meshes.custom,
      0.08
    );

    logMeshBounds(meshes.cylinder);
    logMeshBounds(meshes.custom);

    setCurrentMesh("cylinder");
    state.aspect = canvas.width / canvas.height;

    console.log("[Initial Eye] " + formatVec3(state.eye));
    console.log("[Initial At] " + formatVec3(state.at));
    console.log("[Initial Up] " + formatVec3(state.up));
    console.log(
      "[Initial Perspective] fov=" + state.fov.toFixed(1) +
      " aspect=" + state.aspect.toFixed(3) +
      " near=" + state.near.toFixed(3) +
      " far=" + state.far.toFixed(3)
    );

    var initialLightPos = computeLightWorldPosition();
    console.log(
      "[Initial Light Position] (" +
      initialLightPos[0].toFixed(3) + ", " +
      initialLightPos[1].toFixed(3) + ", " +
      initialLightPos[2].toFixed(3) + ")"
    );
  }

  function init() {
    canvas = document.getElementById("gl-canvas");
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
      alert("WebGL is not available");
      return;
    }

    setupPrograms();
    setupBuffers();

    gl.clearColor(0.96, 0.96, 0.98, 1.0);
    gl.enable(gl.DEPTH_TEST);

    bootstrapScene();
    setupInteractions();
    render();
  }

  window.onload = init;
})();
