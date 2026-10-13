
// cube-geometry.js
// Randy Mattoka - written for CSE 470 at ASU
/* Cube model (prototype) shared by every cube instance in Cube Dance.
   The vertex positions are the course-supplied unit cube; each face is
   assigned its own color below.
*/

var vertices = [
	vec3( 0.0, 0.0,  0.0),
	vec3( 0.0, 1.0,  0.0 ),
	vec3( 1.0, 1.0,  0.0 ),
	vec3( 1.0, 0.0,  0.0 ),
	vec3( 0.0, 0.0, -1.0 ),
	vec3( 0.0, 1.0, -1.0),
	vec3( 1.0, 1.0, -1.0 ),
	vec3( 1.0, 0.0, -1.0 )
];

// One unique color per face
var faceColors = [
    vec4(0.87, 0.35, 0.30, 1.0), // clay red
    vec4(0.26, 0.63, 0.77, 1.0), // ocean blue
    vec4(0.35, 0.72, 0.44, 1.0), // leaf green
    vec4(0.89, 0.58, 0.26, 1.0), // amber
    vec4(0.67, 0.49, 0.84, 1.0), // muted violet
    vec4(0.91, 0.81, 0.39, 1.0)  // wheat
];


function createCube()
{
    quad( 1, 0, 3, 2, 0 );
    quad( 2, 3, 7, 6, 1 );
    quad( 3, 0, 4, 7, 2 );
    quad( 6, 5, 1, 2, 3 );
    quad( 4, 5, 6, 7, 4 );
    quad( 5, 4, 0, 1, 5 );

}

function quad(a, b, c, d, faceIndex)
{
    // Partition the quad (face) into two triangles
    // a, b, c is one triangle and a, c, d is the second

    var indices = [ a, b, c, a, c, d ];

    //console.log("quad function: indices = ",indices);

    for ( var i = 0; i < indices.length; ++i ) {
        cubeVertices.push( vertices[indices[i]] );
		cubeColor.push(faceColors[faceIndex]);

    }
}

