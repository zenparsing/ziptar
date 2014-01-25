import { Condition } from "Mutex.js";


export class Pipe {

    constructor(readStream, options) {
    
        this.input = readStream;
        this.outputs = [];
        this.minBuffers = options.minBuffers >>> 0 || 1;
        this.maxBuffers = options.maxBuffers >>> 0 || 16;
        this.bufferSize = options.bufferSize >>> 0 || 8 * 1024;
        this.free = [];
        this.bufferCount = 0;
        this.started = false;
        this.bufferFree = new Condition;
        this.end = !!options.end;
        
        while (this.bufferCount < this.minBuffers)
            this.free[this.bufferCount++] = new Buffer(this.bufferSize);
    }
    
    connect(writeStream) {
    
        if (!this.outputs.some(val => val === writeString))
            this.outputs.push(writeStream);
    }
    
    disconnect(writeStream) {
    
        this.outputs.some((val, i) => {
        
            if (val === writeString) {
            
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
        
            buffer = this.free.pop();
            
            if (!buffer) {
            
                if (this.bufferCount < this.maxBuffers) {
                
                    this.bufferCount += 1;
                    buffer = new Buffer(this.bufferSize);
                    
                } else {
                
                    await this.bufferFree.wait(true);
                    buffer = this.free.pop();
                }
            }
            
            read = await this.input.read(buffer);
            
            if (!read) {
            
                if (this.end) {
                
                    writes = this.outputs.map(out => out.end());
                    lastWrite = Promise.all(writes);
                }
                
                break;
            }
            
            writes = this.outputs.map(out => out.write(read));
            
            lastWrite = Promise.all(writes).then($=> {
            
                this.free.push(buffer);
                
                if (this.free.length === 1)
                    this.bufferFree.set();
                
                // TODO:  remove unused buffers over minimum threshold
            });
        }
        
        await lastWrite;
    }
    
    stop() {
    
        this.started = false;
    }
}