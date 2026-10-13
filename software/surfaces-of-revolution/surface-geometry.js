/*
 * Name: Mattoka
 * Date: 2026-04-06
 * Surface-of-revolution mesh utilities (written for CSE 470 at ASU)
 */

(function () {
  "use strict";

  function clampPositive(value, minValue) {
    return value < minValue ? minValue : value;
  }

  function buildSORMesh(options) {
    var tMin = options.tMin;
    var tMax = options.tMax;
    var tSteps = options.tSteps;
    var thetaSteps = options.thetaSteps;
    var radiusFn = options.radiusFn;
    var radiusDerivFn = options.radiusDerivFn;

    var positions = [];
    var normals = [];
    var indices = [];

    var bounds = {
      min: vec3(Infinity, Infinity, Infinity),
      max: vec3(-Infinity, -Infinity, -Infinity)
    };

    var dt = (tMax - tMin) / tSteps;
    var dTheta = (2.0 * Math.PI) / thetaSteps;

    for (var i = 0; i <= tSteps; i += 1) {
      var t = tMin + i * dt;
      var radius = clampPositive(radiusFn(t), 0.0001);
      var drdt = radiusDerivFn(t);

      for (var j = 0; j <= thetaSteps; j += 1) {
        var theta = j * dTheta;
        var c = Math.cos(theta);
        var s = Math.sin(theta);

        var x = radius * c;
        var y = t;
        var z = -radius * s;

        var dT = vec3(drdt * c, 1.0, -drdt * s);
        var dThetaVec = vec3(-radius * s, 0.0, -radius * c);
        var n = normalize(cross(dThetaVec, dT));

        positions.push(vec4(x, y, z, 1.0));
        normals.push(vec3(n[0], n[1], n[2]));

        bounds.min[0] = Math.min(bounds.min[0], x);
        bounds.min[1] = Math.min(bounds.min[1], y);
        bounds.min[2] = Math.min(bounds.min[2], z);
        bounds.max[0] = Math.max(bounds.max[0], x);
        bounds.max[1] = Math.max(bounds.max[1], y);
        bounds.max[2] = Math.max(bounds.max[2], z);
      }
    }

    var rowSize = thetaSteps + 1;
    for (var row = 0; row < tSteps; row += 1) {
      for (var col = 0; col < thetaSteps; col += 1) {
        var a = row * rowSize + col;
        var b = (row + 1) * rowSize + col;
        var cIndex = (row + 1) * rowSize + (col + 1);
        var d = row * rowSize + (col + 1);

        indices.push(a, b, d);
        indices.push(b, cIndex, d);
      }
    }

    var dimensions = vec3(
      bounds.max[0] - bounds.min[0],
      bounds.max[1] - bounds.min[1],
      bounds.max[2] - bounds.min[2]
    );

    var center = vec3(
      0.5 * (bounds.min[0] + bounds.max[0]),
      0.5 * (bounds.min[1] + bounds.max[1]),
      0.5 * (bounds.min[2] + bounds.max[2])
    );

    return {
      name: options.name,
      positions: positions,
      normals: normals,
      indices: indices,
      bounds: bounds,
      dimensions: dimensions,
      center: center
    };
  }

  function buildNormalLineVertices(mesh, scale) {
    var vertices = [];
    for (var i = 0; i < mesh.positions.length; i += 1) {
      var p = mesh.positions[i];
      var n = mesh.normals[i];
      vertices.push(vec4(p[0], p[1], p[2], 1.0));
      vertices.push(
        vec4(
          p[0] + n[0] * scale,
          p[1] + n[1] * scale,
          p[2] + n[2] * scale,
          1.0
        )
      );
    }
    return vertices;
  }

  function createCylinderMesh(tSteps, thetaSteps) {
    return buildSORMesh({
      name: "Cylinder",
      tMin: -1.0,
      tMax: 1.0,
      tSteps: tSteps,
      thetaSteps: thetaSteps,
      radiusFn: function () {
        return 1.0;
      },
      radiusDerivFn: function () {
        return 0.0;
      }
    });
  }

  function createCurvyMesh(tSteps, thetaSteps) {
    var tMin = -1.2;
    var tMax = 1.2;
    var invRange = 1.0 / (tMax - tMin);

    function uOfT(t) {
      return (t - tMin) * invRange;
    }

    return buildSORMesh({
      name: "Wavy Vase",
      tMin: tMin,
      tMax: tMax,
      tSteps: tSteps,
      thetaSteps: thetaSteps,
      radiusFn: function (t) {
        var u = uOfT(t);
        return 0.42 + 0.22 * Math.cos(Math.PI * u) + 0.08 * Math.sin(4.0 * Math.PI * u);
      },
      radiusDerivFn: function (t) {
        var u = uOfT(t);
        var drdu = -0.22 * Math.PI * Math.sin(Math.PI * u) +
          0.32 * Math.PI * Math.cos(4.0 * Math.PI * u);
        return drdu * invRange;
      }
    });
  }

  window.MattokaGeometry = {
    buildSORMesh: buildSORMesh,
    buildNormalLineVertices: buildNormalLineVertices,
    createCylinderMesh: createCylinderMesh,
    createCurvyMesh: createCurvyMesh
  };
})();
