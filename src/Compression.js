import { AsyncGate } from "AsyncGate.js";

var Z = process.binding("zlib");

var modes = {

    "inflate": Z.INFLATE,
    "deflate": Z.DEFLATE,
    "inflate-raw": Z.INFLATERAW,
    "deflate-raw": Z.DEFLATERAW,
    "gzip": Z.GZIP,
    "gunzip": Z.GUNZIP   
}

/*

We're going to need some abstractions to account for the state of asynchronous
objects.  For example, if there is currently no read buffer, we'll need a promise
to wait on which will get released when a read buffer is attached.  Doing that
manually with the Promise API will get nasty quick.  We need a higher-level
abstraction.

Parallel with this, we need to settle some design choices with respect to 
asynchronous types.  Specifically, do we queue up asynchronous calls, or
throw?  Is that a per-object choice, or is that something that should be
a matter of design principle?

*/

class ZipStream {

    constructor(mode) {
    
        if (modes[mode] === void 0)
            throw new Error("Invalid mode");
        
        this.zlib = new Z(modes[mode]);
        
        // this.zlib.init(...);
    }
    
    async read(buffer, start, length) {
    
        // Wait for last read to complete, or throw if currently waiting for a read
        // Resolve read-ready promise.
    }
    
    async write(buffer, start, length) {
    
        // Wait for write to finish, wait for read-ready
        // repeatedly call this.zlib.write
    }
    
    async end() {
    
        // Wait for write to finish, call this.zlib.write as flush, call this.zlib.close()
        // Release pending read buffers?
    }
}
