//
// Petal Burst (originally "Explode!", written for CSE 470 at ASU)
//
/*
Written by: Randy Mattoka
Date: January 27th 2026

Description: 
This program renders a stylized flower composed
    of its stationary core and multiple outer petals. The flower is constructed entirely
    from triangles. During the animation, the petals explode radially outward while the core
    remains still! The explosion is implemented in the vertex shader.
*/

var canvas;
var gl;

//store the vertices
//Each triplet represents one triangle
var vertices = [];

//store a color for each vertex
var colors = [];

// Explosion state: isCore flags each vertex as core (1.0) or petal (0.0)

var isCore = [];
var explodeFactor = 0.5;
var maxShift = 0.45;
var startTime = Date.now();
 

// =============== function init ======================
 
// When the page is loaded into the browser, start webgl stuff
window.onload = function init()
{
	// notice that gl-canvas is specified in the html code
    canvas = document.getElementById( "gl-canvas" );
    
	// gl is a canvas object
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

	// Track progress of the program with print statement
    console.log("Opened canvas");
        
    // Define the geometry. Each set of three points is one triangle.
    // (During the explosion all geometry stays inside the window.)
    //
    // scale value for initial simple core size
    var sval = 0.15;

    var coreRadius = sval;
    var coreSegments = 8;
    var coreColor = vec3(0.85, 0.25, 0.25);

    for (var i = 0; i < coreSegments; ++i) {
        var a0 = (i / coreSegments) * 2.0 * Math.PI;
        var a1 = ((i + 1) / coreSegments) * 2.0 * Math.PI;
        // triangle: center, p0, p1
        vertices.push(vec2(0.0, 0.0));
        vertices.push(vec2(coreRadius * Math.cos(a0), coreRadius * Math.sin(a0)));
        vertices.push(vec2(coreRadius * Math.cos(a1), coreRadius * Math.sin(a1)));
        // colors
        colors.push(coreColor); colors.push(coreColor); colors.push(coreColor);
        // mark as core
        isCore.push(1.0); isCore.push(1.0); isCore.push(1.0);
    }

    var petalInnerRadius = coreRadius + 0.03;
    var petalOuterRadius = 0.35;
    var petals = 8;
    var petalSegments = 3;
    var petalColors = [
        vec3(0.15, 0.55, 1.0),
        vec3(0.15, 1.0, 0.45),
        vec3(1.0, 0.65, 0.20),
        vec3(0.65, 0.25, 1.0)
    ];

    for (var p = 0; p < petals; ++p) {
        var baseAngle = p * (2.0 * Math.PI / petals);
        var color = petalColors[p % petalColors.length];
        var spread = 0.35;
        for (var s = 0; s < petalSegments; ++s) {
            var a0 = baseAngle - spread * 0.5 + (s / petalSegments) * spread;
            var a1 = baseAngle - spread * 0.5 + ((s + 1) / petalSegments) * spread;
            var inner0 = vec2(petalInnerRadius * Math.cos(a0), petalInnerRadius * Math.sin(a0));
            var inner1 = vec2(petalInnerRadius * Math.cos(a1), petalInnerRadius * Math.sin(a1));
            var tip   = vec2(petalOuterRadius * Math.cos(baseAngle), petalOuterRadius * Math.sin(baseAngle));
            vertices.push(inner0); vertices.push(tip); vertices.push(inner1);
            colors.push(color); colors.push(color); colors.push(color);
            isCore.push(0.0); isCore.push(0.0); isCore.push(0.0);
        }
    }


    // Print the input vertices and colors to the console
    console.log("Input vertices and colors:");
    console.log("vertex count:", vertices.length);
    console.log("color count:", colors.length);
    console.log("isCore count:", isCore.length);
	 
	 

    //  Configure WebGL
    gl.viewport( 0, 0, canvas.width, canvas.height );
	// Background color to white
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );

    //  Define shaders to use  
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    // Load the data into the GPU
	//
	// color buffer: create, bind, and load
    var cBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW );
	
	// Associate shader variable for  r,g,b color
	var vColor = gl.getAttribLocation( program, "vColor" );
    gl.vertexAttribPointer( vColor, 3, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vColor )

    //my new blocks of code
    var coreBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, coreBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(isCore), gl.STATIC_DRAW);

    var aIsCore = gl.getAttribLocation(program, "aIsCore");
    gl.vertexAttribPointer(aIsCore, 1, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aIsCore);


    // vertex buffer: create, bind, load
    var vbuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, vbuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW );

    // Associate shader variables for x,y vertices	
    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer( vPosition, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vPosition );
	
	// associate the shader's explosion uniforms
    var explodeLoc = gl.getUniformLocation(program, "explodeFactor");
    var maxShiftLoc = gl.getUniformLocation(program, "maxShift");

    window._prog = {
        program: program,
        explodeLoc: explodeLoc,
        maxShiftLoc: maxShiftLoc,
        vertexCount: vertices.length
    };

    if (maxShiftLoc !== null && maxShiftLoc !== -1) {
        gl.uniform1f(maxShiftLoc, maxShift);
    }

    console.log("Data loaded to GPU -- Now call render");

    render();
};


// =============== function render ======================

function render()
{
    // clear the screen 
    gl.clear( gl.COLOR_BUFFER_BIT );
	
	// send the animated uniform(s) to the vertex shader
    var time = (Date.now() - startTime) / 1000.0;
    explodeFactor = 0.5 * (1.0 + Math.sin(time * 1.2));

    gl.useProgram(window._prog.program);
    if (window._prog.explodeLoc !== null && window._prog.explodeLoc !== -1) {
        gl.uniform1f(window._prog.explodeLoc, explodeFactor);
    }
    if (window._prog.maxShiftLoc !== null && window._prog.maxShiftLoc !== -1) {
        gl.uniform1f(window._prog.maxShiftLoc, maxShift);
    }

    // draw the object (core and petals share one draw call; the vertex shader
    // decides which vertices move)
    gl.drawArrays(gl.TRIANGLES, 0, window._prog.vertexCount);
	
	 
	requestAnimFrame( render );
}

