import { Condition, Mutex } from "Mutex.js";

export class CopyStream {

    constructor() {
    
        this.output = null;
        this.outputOffset = 0;
        this.reading = new Mutex;
        this.writing = new Mutex;
        this.hasBuffer = new Condition;
        this.bufferDone = new Condition;
        this.lastBuffer = null;
        this.ended = false;
    }
    
    async read(buffer, start, length) {
    
        return this.reading.lock($=> {
        
            // Null signals end-of-stream
            if (this.ended)
                return null;
        
            if (start !== undefined)
                buffer = buffer.slice(start, length);
        
            this.output = buffer;
            this.outputOffset = 0;
            
            // Signal that a buffer is ready and wait until buffer is done
            this.hasBuffer.set();
            await this.bufferDone.wait(true);
            
            var out = this.output;
            this.output = null;
            
            return out;
            
        });
    }
    
    async write(buffer, start, length) {
    
        return this.writing.lock($=> {
        
            if (this.ended)
                throw new Error("Stream closed");
            
            if (start !== undefined)
                buffer = buffer.slice(start, length);
            
            var offset = 0, 
                outLength,
                needed, 
                count,
                end;
            
            while (offset < buffer.length) {
            
                await this.hasBuffer.wait(true);
            
                outLength = this.output.length;                
                needed = outLength - this.outputOffset;
                end = Math.min(offset + needed, buffer.length);
                count = end - offset;
                
                buffer.copy(this.output, this.outputOffset, offset, end);
                
                offset += count;
                this.outputOffset += count;
                
                if (this.outputOffset >= outLength)
                    this.bufferDone.set();
            }
            
            return buffer.length;
            
        });
    }
    
    async end() {
    
        return this.writing.lock($=> {
        
            this.ended = true;
            
            if (this.output) {
            
                this.output = this.output.slice(0, this.outputOffset);
                this.bufferDone.set();
            }
            
        });
    }
    
}
