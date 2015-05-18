(function () {

    "use strict";

    var WebGLContext = require('./WebGLContext'),
        Util = require('../util/Util'),
        Stack = require('../util/Stack'),
        FACES = [
            '-x', '+x',
            '-y', '+y',
            '-z', '+z'
        ],
        FACE_TARGETS = {
            '+z': "TEXTURE_CUBE_MAP_POSITIVE_Z",
            '-z': "TEXTURE_CUBE_MAP_NEGATIVE_Z",
            '+x': "TEXTURE_CUBE_MAP_POSITIVE_X",
            '-x': "TEXTURE_CUBE_MAP_NEGATIVE_X",
            '+y': "TEXTURE_CUBE_MAP_POSITIVE_Y",
            '-y': "TEXTURE_CUBE_MAP_NEGATIVE_Y"
        },
        _stack = {},
        _boundTexture = null;

    /**
     * If the provided image dimensions are not powers of two, it will redraw
     * the image to the next highest power of two.
     *
     * @param {HTMLImageElement} image - The image object.
     *
     * @param {HTMLImageElement} The new image object.
     */
    function ensurePowerOfTwo( image ) {
        if ( !Util.isPowerOfTwo( image.width ) || !Util.isPowerOfTwo( image.height ) ) {
            var canvas = document.createElement( "canvas" );
            canvas.width = Util.nextHighestPowerOfTwo( image.width );
            canvas.height = Util.nextHighestPowerOfTwo( image.height );
            var ctx = canvas.getContext("2d");
            ctx.drawImage( image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height );
            return canvas;
        }
        return image;
    }

    /**
     * Binds the texture object to a location and activates the texture unit
     * while caching it to prevent unnecessary rebinds.
     *
     * @param {TextureCubeMap} texture - The TextureCubeMap object to bind.
     * @param {String} location - The texture unit location.
     */
    function bind( texture, location ) {
        // if this buffer is already bound, exit early
        if ( _boundTexture === texture ) {
            return;
        }
        var gl = texture.gl;
        location = gl[ location ] || gl.TEXTURE0;
        gl.activeTexture( location );
        gl.bindTexture( gl.TEXTURE_CUBE_MAP, texture.id );
        _boundTexture = texture;
    }

    /**
     * Unbinds the texture object. Prevents unnecessary unbinding.
     *
     * @param {TextureCubeMap} texture - The TextureCubeMap object to unbind.
     */
    function unbind( texture ) {
        // if no buffer is bound, exit early
        if ( _boundTexture === null ) {
            return;
        }
        var gl = texture.gl;
        gl.bindTexture( gl.TEXTURE_CUBE_MAP, null );
        _boundTexture = null;
    }

    function loadAndBufferImage( cubeMap, url, face ) {
        return function( done ) {
            var image = new Image();
            image.onload = function() {
                // buffer face texture
                cubeMap.bufferFaceData( face, image );
                done();
            };
            image.src = url;
        };
    }

    function TextureCubeMap( spec, callback ) {
        var that = this,
            face,
            jobs;
        // store gl context
        this.gl = WebGLContext.get();
        this.id = this.gl.createTexture();
        this.wrap = spec.wrap || "CLAMP_TO_EDGE";
        this.filter = spec.filter || "LINEAR";
        // create cube map based on input
        if ( spec.images ) {
            // multiple Image objects
            for ( face in spec.images ) {
                if ( spec.images.hasOwnProperty( face ) ) {
                    // buffer face texture
                    this.bufferFaceData( face, spec.images[ face ] );
                }
            }
            this.setParameters( this );
        } else if ( spec.urls ) {
            // multiple urls
            jobs = {};
            for ( face in spec.urls ) {
                if ( spec.urls.hasOwnProperty( face ) ) {
                    // add job to map
                    jobs[ face ] = loadAndBufferImage(
                        this,
                        spec.urls[ face ],
                        face );
                }
            }
            Util.async( jobs, function() {
                that.setParameters( that );
                callback( that );
            });
        } else {
            // empty cube map
            this.format = spec.format || "RGBA";
            this.internalFormat = this.format; // webgl requires format === internalFormat
            this.type = spec.type || "UNSIGNED_BYTE";
            this.mipMap = spec.mipMap || false;
            FACES.forEach( function( face ) {
                var data = ( spec.data ? spec.data[face] : spec.data ) || null;
                that.bufferFaceData( face, data, spec.width, spec.height );
            });
            this.setParameters( this );
        }
    }

    /**
     * Binds the texture object and pushes it to the front of the stack.
     * @memberof TextureCubeMap
     *
     * @param {String} location - The texture unit location.
     *
     * @returns {TextureCubeMap} The texture object, for chaining.
     */
     TextureCubeMap.prototype.push = function( location ) {
        _stack[ location ] = _stack[ location ] || new Stack();
        _stack[ location ].push( this );
        bind( this, location );
        return this;
    };

    /**
     * Unbinds the texture object and binds the framebuffer beneath it on
     * this stack. If there is no underlying framebuffer, bind the backbuffer.
     * @memberof TextureCubeMap
     *
     * @returns {TextureCubeMap} The texture object, for chaining.
     */
     TextureCubeMap.prototype.pop = function( location ) {
        var top;
        if ( !_stack[ location ] ) {
            console.log("No texture was bound to texture unit '" + location +
                "'. Command ignored.");
        }
        _stack[ location ].pop();
        top = _stack[ location ].top();
        if ( top ) {
            bind( top, location );
        } else {
            unbind( this );
        }
        return this;
    };

    TextureCubeMap.prototype.bufferFaceData = function( face, data, width, height ) {
        var gl = this.gl,
            faceTarget = gl[ FACE_TARGETS[ face ] ];
        if ( !faceTarget ) {
            console.log("Invalid face enumeration '"+ face +"' provided, " +
                "ignoring command.");
        }
        // buffer face texture
        gl.bindTexture( gl.TEXTURE_CUBE_MAP, this.id );
        if ( data instanceof HTMLImageElement ) {
            this.images = this.images || {};
            this.images[ face ] = ensurePowerOfTwo( data );
            this.filter = "LINEAR";
            this.mipMap = true;
            // images are inverted along the y, load them upside down
            // gl.pixelStorei( gl.UNPACK_FLIP_Y_WEBGL, true );
            gl.texImage2D(
                faceTarget,
                0, // level
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                this.images[ face ] );
        } else {
            this.data = this.data || {};
            this.data[ face ] = data;
            this.width = width || this.width;
            this.height = height || this.height;
            gl.texImage2D(
                faceTarget,
                0, // level
                gl[ this.internalFormat ],
                this.width,
                this.height,
                0, // border, must be 0
                gl[ this.format ],
                gl[ this.type ],
                data );
        }
        // only generate mipmaps if all faces are buffered
        this.bufferedFaces = this.bufferedFaces || {};
        this.bufferedFaces[ face ] = true;
        // once all faces are buffered
        if ( this.mipMap &&
            this.bufferedFaces['-x'] && this.bufferedFaces['+x'] &&
            this.bufferedFaces['-y'] && this.bufferedFaces['+y'] &&
            this.bufferedFaces['-z'] && this.bufferedFaces['+z'] ) {
            // generate mipmaps once all faces are buffered
            gl.generateMipmap( gl.TEXTURE_CUBE_MAP );
        }
        gl.bindTexture( gl.TEXTURE_CUBE_MAP, null );
        return this;
    };

    TextureCubeMap.prototype.setParameters = function( parameters ) {
        var gl = this.gl;
        gl.bindTexture( gl.TEXTURE_CUBE_MAP, this.id );
        if ( parameters.wrap ) {
            // set wrap parameters
            this.wrap = parameters.wrap;
            gl.texParameteri(
                gl.TEXTURE_CUBE_MAP,
                gl.TEXTURE_WRAP_S,
                gl[ this.wrap.s || this.wrap ] );
            gl.texParameteri(
                gl.TEXTURE_CUBE_MAP,
                gl.TEXTURE_WRAP_T,
                gl[ this.wrap.t || this.wrap ] );
            /* not supported in webgl 1.0
            gl.texParameteri(
                gl.TEXTURE_CUBE_MAP,
                gl.TEXTURE_WRAP_R,
                gl[ this.wrap.r || this.wrap ] );
            */
        }
        if ( parameters.filter ) {
            // set filter parameters
            this.filter = parameters.filter;
            var minFilter = this.filter.min || this.filter;
            if ( this.minMap ) {
                // append min mpa suffix to min filter
                minFilter += "_MIPMAP_LINEAR";
            }
            gl.texParameteri(
                gl.TEXTURE_CUBE_MAP,
                gl.TEXTURE_MAG_FILTER,
                gl[ this.filter.mag || this.filter ] );
            gl.texParameteri(
                gl.TEXTURE_CUBE_MAP,
                gl.TEXTURE_MIN_FILTER,
                gl[ minFilter] );
        }
        gl.bindTexture( gl.TEXTURE_CUBE_MAP, null );
        return this;
    };

    module.exports = TextureCubeMap;

}());
