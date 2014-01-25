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

class ZipStream {

    constructor(mode) {
    
        if (modes[mode] === void 0)
            throw new Error("Invalid mode");
        
        this.buffer = null;
        this.error = null;
        this.reading = new Mutex;
        this.writing = new Mutex;
        this.finish = false;
        this.hasBuffer = new Condition;
        this.bufferDone = new Condition;
        
        var dictionary = void 0;
        
        this.zlib = new Z(modes[mode]);
        
        this.zlib.onerror = (msg, id) => {
        
            this.error = new Error(msg);
            this.zlib = null;
        };
        
        this.zlib.init(
            Z.Z_DEFAULT_WINDOWBITS,
            Z.Z_DEFAULT_COMPRESSION,
            Z.Z_DEFAULT_MEMLEVEL,
            Z.Z_DEFAULT_STRATEGY,
            dictionary);
    }
    
    async read(buffer, start, length) {
    
        return this.reading.lock($=> {
        
            if (!this.zlib)
                throw new Error("Stream closed");
        
            if (start !== undefined)
                buffer = buffer.slice(start, length);
        
            this.buffer = buffer;
        
            // Signal that a buffer is ready and wait until that buffer is done
            this.hasBuffer.set();
            await this.bufferDone.wait(true);
            
            var b = this.buffer;
            this.buffer = null;
            
            // If zlib reported an error, then read fails
            if (this.error)
                throw error;
        
            return b.length === 0 ? null : b;
        });
    }
    
    async write(buffer, start, length) {
    
        var deferred = Promise.defer(),
            written = 0;
        
        var pump = (buffer, start, length) => {
        
            if (this.error)
                return;
            
            // Wait for a reader
            await this.hasBuffer.wait(true);
            
            var inOffset = start || 0,
                inLength = length || (buffer.length - inputOffset),
                outOffset = 0,
                outLength = this.buffer.length;
        
            var req = this.zlib.write(
                this.finish ? Z.Z_FINISH : Z.Z_NO_FLUSH,
                buffer,
                inOffset,
                inLength,
                this.buffer,
                outOffset,
                outLength);
            
            req.buffer = buffer;
            
            req.callback = (inLeft, outLeft) => {
            
                written += inLength - inLeft;
                
                this.buffer = this.buffer.slice(0, outLength - outLeft);
                this.bufferDone.set();
                
                if (outLeft === 0) {
                    
                    pump(buffer, buffer.length - inLeft);
                    
                } else {
                
                    deferred.resolve();
                }
            };
        };
        
        return this.writing.lock($=> {
        
            if (!this.zlib)
                throw new Error("Stream closed");
            
            pump(buffer, start, length);
            await deferred.promise;
            
            // If zlib reported an error, then write fails
            if (this.error)
                throw error;
            
            return written;
        });
    }
    
    async end() {
    
        return this.writing.lock($=> {
        
            this.finish = true;
            await this.write(new Buffer(0));
            
            this.zlib.close()
            this.zlib = null;
        });
    }
    
}

export class DeflateStream extends ZipStream {

    constructor(header) {
    
        super(header ? "deflate" : "deflate-raw");
    }
}

export class InflateStream extends ZipStream {

    constructor(header) {
    
        super(header ? "inflate" : "inflate-raw");
    }
}

export class GZipStream extends ZipStream {

    constructor(header) {
    
        super("gzip");
    }
}

export class GUnzipStream extends ZipStream {

    constructor(header) {
    
        super("gunzip");
    }
}
