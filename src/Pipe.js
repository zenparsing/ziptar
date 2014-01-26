import { Condition } from "Mutex.js";


export class Pipe {

    constructor(readStream, options) {
    
        if (!options)
            options = {};
        
        this.input = readStream;
        this.outputs = [];
        this.minBuffers = options.minBuffers >>> 0 || 1;
        this.maxBuffers = options.maxBuffers >>> 0 || 16;
        this.bufferSize = options.bufferSize >>> 0 || 8 * 1024;
        this.free = [];
        this.bufferCount = 0;
        this.started = false;
        this.bufferFree = new Condition;
        
        // Allocate initial buffers
        while (this.bufferCount < this.minBuffers)
            this.free[this.bufferCount++] = new Buffer(this.bufferSize);
        
        // Set signal to indicate there are buffers on the free list
        this.bufferFree.set();
    }
    
    connect(writeStream, end) {
    
        if (!this.outputs.some(val => val.stream === writeStream))
            this.outputs.push({ stream: writeStream, end: !!end });
    }
    
    disconnect(writeStream) {
    
        this.outputs.some((val, i) => {
        
            if (val.stream === writeString) {
            
                this.outputs.splice(i, 1);
                
                // Stop the flow if this was the last output
                if (this.outputs.length === 0)
                    this.stop();
                    
                return true;
            }
            
            return false;
        });
    }
    
    async start() {
    
        if (this.started)
            return;
        
        if (this.outputs.length === 0)
            throw new Error("Pipe has no outputs");
        
        var buffer, 
            read, 
            writes, 
            lastWrite;
        
        this.started = true;
        
        while (this.started) {
        
            // Get a buffer from the free list
            buffer = this.free.pop();
            
            // If free list was empty...
            if (!buffer) {
            
                if (this.bufferCount < this.maxBuffers) {
                
                    // Allocate a new buffer
                    this.bufferCount += 1;
                    buffer = new Buffer(this.bufferSize);
                    
                } else {
                
                    // Wait until a buffer is freed
                    await this.bufferFree.wait();
                    buffer = this.free.pop();
                }
            }
            
            // Unset the free signal if free list is empty
            if (this.free.length === 0) 
                this.bufferFree.set(false);
            
            // Read from the input stream
            read = await this.input.read(buffer);
            
            // Null signals end-of-stream
            if (!read) {
                            
                writes = this.outputs.map(out => {
                
                    if (out.end) 
                        out.stream.end();
                });
                
                lastWrite = Promise.all(writes);
                break;
                
            } else if (read.length === 0) {
            
                // Skip writing if there is nothing to write
                continue;
            }
            
            // Write to all output streams
            writes = this.outputs.map(out => out.stream.write(read));
            
            // When all writes are complete...
            lastWrite = Promise.all(writes).then($=> {
            
                // Put buffer back on the free list
                this.free.push(buffer);
                
                // Signal readers waiting on a free buffer
                this.bufferFree.set();
                
                // TODO: Remove unused buffers over minimum threshold, but
                // not too eagerly...
                
            }, x => {
            
                // TODO: Stop flow and propagate error to caller
                console.log("error!");
                console.log(x);
            });
        }
        
        // Wait for last batch of "write" or "end" operations to complete
        await lastWrite;
    }
    
    stop() {
    
        this.started = false;
    }
}
