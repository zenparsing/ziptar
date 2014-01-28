import { Condition, Mutex } from "Mutex.js";

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

Should we attempt to fill read buffers?  Or that could be an option.
That would prevent us

*/

class ZipStream {

    constructor(mode) {
    
        // TODO: Allow user to specify an options object
        
        if (modes[mode] === void 0)
            throw new Error("Invalid mode");
        
        this.output = null;
        this.reading = new Mutex;
        this.writing = new Mutex;
        this.hasBuffer = new Condition;
        this.bufferDone = new Condition;
        
        var dictionary = undefined;
        
        this.zlib = new Z.Zlib(modes[mode]);
        
        this.zlib.init(
            15, // Z.Z_DEFAULT_WINDOWBITS,
            Z.Z_DEFAULT_COMPRESSION,
            8, // Z.Z_DEFAULT_MEMLEVEL,
            Z.Z_DEFAULT_STRATEGY,
            dictionary);
    }
    
    async read(buffer, start, length) {
    
        return this.reading.lock($=> {
        
            // Null signals end-of-stream
            if (!this.zlib)
                return null;
        
            if (start !== undefined)
                buffer = buffer.slice(start, length);
        
            this.output = buffer;
            
            // Signal that a buffer is ready and wait until buffer is done
            this.hasBuffer.set();
            await this.bufferDone.wait(true);
            
            var b = this.output;
            this.output = null;
            
            return b;
            
        });
    }
    
    async write(buffer, start, length) {
    
        return await this._write(buffer, start, length, false);
    }
    
    async end() {
    
        // Write the final, flushing buffer
        return await this._write(new Buffer(0), 0, 0, true);
    }
    
    async _write(buffer, start, length, end) {
    
        return this.writing.lock($=> {
        
            if (!this.zlib)
                throw new Error("Stream closed");
            
            var deferred = Promise.defer(),
                written = 0;
            
            var pump = (buffer, start, length) => {
        
                // Wait for a reader
                await this.hasBuffer.wait(true);
            
                var inOffset = start || 0,
                    inLength = length || (buffer.length - inOffset),
                    outOffset = 0,
                    outLength = this.output.length;
            
                // Send a write command to zlib
                var req = this.zlib.write(
                    end ? Z.Z_FINISH : Z.Z_NO_FLUSH,
                    buffer,
                    inOffset,
                    inLength,
                    this.output,
                    outOffset,
                    outLength);
            
                req.output = buffer;
            
                // When the command has finished...
                req.callback = (inLeft, outLeft) => {
            
                    try {
                
                        written += inLength - inLeft;
                
                        // Notify reader that output buffer is ready
                        this.output = this.output.slice(0, outLength - outLeft);
                        this.bufferDone.set();
                
                        if (outLeft === 0) {
                    
                            // If the output buffer was completely used, assume that there
                            // is more data to write
                            await pump(buffer, buffer.length - inLeft);
                    
                        } else {
                
                            // Write is complete
                            deferred.resolve();
                        }
                    
                    } catch (x) {
                
                        deferred.reject(x);
                    }
                };
            };
            
            // Set an error handler specific to this write operation
            this.zlib.onerror = (msg, errno) => {
            
                deferred.reject(new Error(msg));
                
                // End the stream ungracefully
                this.zlib = null;
                
                // Signal that we are done with the output buffer
                this.output = null;
                this.bufferDone.set();
            };
            
            // Start writing data
            await pump(buffer, start, length);
        
            // Wait for write to complete
            await deferred.promise;
        
            // Clear the error handler
            this.zlib.onerror = undefined;
            
            // Close zlib if we are ending the stream
            if (end) {
            
                this.zlib.close();
                this.zlib = null;
            }
        
            return written;
        
        });
        
    }
    
}

export class DeflateStream extends ZipStream {

    constructor(header) { super(header ? "deflate" : "deflate-raw") }
}

export class InflateStream extends ZipStream {

    constructor(header) { super(header ? "inflate" : "inflate-raw") }
}

export class GZipStream extends ZipStream {

    constructor(header) { super("gzip") }
}

export class GUnzipStream extends ZipStream {

    constructor(header) { super("gunzip") }
}
