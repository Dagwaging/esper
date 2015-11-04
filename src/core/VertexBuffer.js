(function () {

    "use strict";

    var WebGLContext = require('./WebGLContext'),
        VertexPackage = require('./VertexPackage'),
        Util = require('../util/Util'),
        _boundBuffer = null,
        _enabledAttributes = null;

    function setAttributePointers( vertexBuffer, attributePointers ) {
        if ( !attributePointers ) {
            console.error( "VertexBuffer requires attribute pointers to be " +
                "specified, command ignored." );
            return;
        }
        vertexBuffer.pointers = attributePointers;
    }

    function VertexBuffer( array, attributePointers, options ) {
        options = options || {};
        this.id = 0;
        this.pointers = {};
        this.gl = WebGLContext.get();
        if ( array ) {
            if ( array instanceof VertexPackage ) {
                // VertexPackage argument
                this.bufferData( array.buffer() );
                setAttributePointers( this, array.attributePointers() );
                // shift arg since there will be no attrib pointers
                options = attributePointers || options;
            } else if ( array instanceof WebGLBuffer ) {
                // WebGLBuffer argument
                this.id = array;
                setAttributePointers( this, attributePointers );
                this.count = ( options.count !== undefined ) ? options.count : 0;
            } else {
                // Array or ArrayBuffer argument
               this.bufferData( array );
               setAttributePointers( this, attributePointers );
            }
        }
        this.offset = ( options.offset !== undefined ) ? options.offset : 0;
        this.mode = options.mode || "TRIANGLES";
    }

    VertexBuffer.prototype.bufferData = function( array ) {
        var gl = this.gl;
        if ( array instanceof Array ) {
            // cast arrays into bufferview
            array = new Float32Array( array );
        } else if ( !Util.isTypedArray( array ) && typeof array !== "number" ) {
            console.error( "VertexBuffer requires an Array or ArrayBuffer, " +
                "or a size argument, command ignored." );
            return;
        }
        if ( !this.id ) {
            this.id = gl.createBuffer();
        }
        gl.bindBuffer( gl.ARRAY_BUFFER, this.id );
        gl.bufferData( gl.ARRAY_BUFFER, array, gl.STATIC_DRAW );
    };

    VertexBuffer.prototype.bufferSubData = function( array, offset ) {
        var gl = this.gl;
        if ( !this.id ) {
            console.error( "VertexBuffer has not been initially buffered, " +
                "command ignored." );
            return;
        }
        if ( array instanceof Array ) {
            array = new Float32Array( array );
        } else if ( !Util.isTypedArray( array ) ) {
            console.error( "VertexBuffer requires an Array or ArrayBuffer " +
                "argument, command ignored." );
            return;
        }
        offset = ( offset !== undefined ) ? offset : 0;
        gl.bindBuffer( gl.ARRAY_BUFFER, this.id );
        gl.bufferSubData( gl.ARRAY_BUFFER, offset, array );
    };

    VertexBuffer.prototype.bind = function() {
        // if this buffer is already bound, exit early
        if ( _boundBuffer === this ) {
            return;
        }
        var gl = this.gl,
            pointers = this.pointers,
            previouslyEnabledAttributes = _enabledAttributes || {},
            pointer,
            index;
        // cache this vertex buffer
        _boundBuffer = this;
        _enabledAttributes = {};
        // bind buffer
        gl.bindBuffer( gl.ARRAY_BUFFER, this.id );
        for ( index in pointers ) {
            if ( pointers.hasOwnProperty( index ) ) {
                pointer = this.pointers[ index ];
                // set attribute pointer
                gl.vertexAttribPointer( index,
                    pointer.size,
                    gl[ pointer.type ],
                    false,
                    pointer.stride,
                    pointer.offset );
                // enabled attribute array
                gl.enableVertexAttribArray( index );
                // cache attribute
                _enabledAttributes[ index ] = true;
                // remove from previous list
                delete previouslyEnabledAttributes[ index ];
            }
        }
        // ensure leaked attribute arrays are disabled
        for ( index in previouslyEnabledAttributes ) {
            if ( previouslyEnabledAttributes.hasOwnProperty( index ) ) {
                gl.disableVertexAttribArray( index );
            }
        }
    };

    VertexBuffer.prototype.draw = function( options ) {
        options = options || {};
        if ( _boundBuffer === null ) {
            console.warn( "No VertexBuffer is bound, command ignored." );
            return;
        }
        var gl = this.gl;
        var mode = gl[ options.mode ] || gl[ this.mode ] || gl.TRIANGLES;
        var offset = ( options.offset !== undefined ) ? options.offset : this.offset;
        var count = ( options.count !== undefined ) ? options.count : this.count;
        gl.drawArrays(
            mode, // primitive type
            offset, // offset
            count ); // count
    };

    VertexBuffer.prototype.unbind = function() {
        // if no buffer is bound, exit early
        if ( _boundBuffer === null ) {
            return;
        }
        var gl = this.gl,
            pointers = this.pointers,
            index;
        for ( index in pointers ) {
            if ( pointers.hasOwnProperty( index ) ) {
                gl.disableVertexAttribArray( index );
            }
        }
        gl.bindBuffer( gl.ARRAY_BUFFER, null );
        _boundBuffer = null;
        _enabledAttributes = {};
    };

    module.exports = VertexBuffer;

}());
