(function () {

    "use strict";

    var VertexPackage = require('../core/VertexPackage'),
        VertexBuffer = require('../core/VertexBuffer'),
        IndexBuffer = require('../core/IndexBuffer');

    function parseVertexAttributes( spec ) {
        var attributes = [];
        if ( spec.positions ) {
            attributes.push( spec.positions );
        }
        if ( spec.normals ) {
            attributes.push( spec.normals );
        }
        if ( spec.uvs ) {
            attributes.push( spec.uvs );
        }
        if ( spec.tangents ) {
            attributes.push( spec.tangents );
        }
        if ( spec.bitangents ) {
            attributes.push( spec.bitangents );
        }
        if ( spec.colors ) {
            attributes.push( spec.colors );
        }
        if ( spec.joints ) {
            attributes.push( spec.joints );
        }
        if ( spec.weights ) {
            attributes.push( spec.weights );
        }
        return attributes;
    }

    function Renderable( spec, options ) {
        spec = spec || {};
        options = options || {};
        if ( spec.vertexBuffer || spec.vertexBuffers ) {
            // use existing vertex buffer
            this.vertexBuffers = spec.vertexBuffers || [ spec.vertexBuffer ];
        } else {
            // create vertex package
            var vertexPackage = new VertexPackage( parseVertexAttributes( spec ) );
            // create vertex buffer
            this.vertexBuffers = [ new VertexBuffer( vertexPackage ) ];
        }
        if ( spec.indexBuffer ) {
            // use existing index buffer
            this.indexBuffer = spec.indexBuffer;
        } else {
            if ( spec.indices ) {
                // create index buffer
                this.indexBuffer = new IndexBuffer( spec.indices );
            }
        }
        // store rendering options
        this.options = {
            mode: options.mode,
            offset: options.offset,
            count: options.count
        };
        return this;
    }

    Renderable.prototype.draw = function( options ) {
        var overrides = options || {};
        // override options if provided
        overrides.mode = overrides.mode || this.options.mode;
        overrides.offset = ( overrides.offset !== undefined ) ? overrides.offset : this.options.offset;
        overrides.count = ( overrides.count !== undefined ) ? overrides.count : this.options.count;
        // draw the renderable
        if ( this.indexBuffer ) {
            // use index buffer to draw elements
            this.vertexBuffers.forEach( function( vertexBuffer ) {
                vertexBuffer.bind();
                // no advantage to unbinding as there is no stack used
            });
            this.indexBuffer.bind();
            this.indexBuffer.draw( overrides );
            // no advantage to unbinding as there is no stack used
        } else {
            // no index buffer, use draw arrays
            this.vertexBuffers.forEach( function( vertexBuffer ) {
                vertexBuffer.bind();
                vertexBuffer.draw( overrides );
                // no advantage to unbinding as there is no stack used
            });
        }
        return this;
    };

    module.exports = Renderable;

}());