module AsyncFS from "AsyncFS.js";

import { Mutex } from "Mutex.js";

export class FileStream {

    constructor(fd) {
    
        this.fd = fd || 0;
        this.position = 0;
        this.path = "";
        this.length = 0;
        this.pending = 0;
        this.mutex = new Mutex;
    }
    
    async close() {
    
        if (!this.fd)
            return;
        
        this.mutex.lock($=> {
        
            var fd = this.fd;
            this.fd = 0;
        
            await this.flushed.wait();
            await AsyncFS.close(fd);
        });
    }

    async end() {
    
        await this.close();
    }
    
    async read(buffer) {
    
        return this.mutex.lock($=> {
        
            // Return EOF if file has been closed
            if (!this.fd)
                return null;
            
            var offset = this.position;
            this.position = Math.min(this.length, this.position + buffer.length);

            var count = await AsyncFS.read(
                this.fd, 
                buffer, 
                0, 
                buffer.length, 
                offset);
            
            return count === 0 ? null : buffer.slice(0, count);
            
        });
    }
    
    async write(buffer) {
    
        return this.mutex.lock($=> {
        
            if (!this.fd)
                throw new Error("File not open");
        
            if (buffer.length === 0)
                return;
        
            var offset = this.position;
            this.position += buffer.length;

            return AsyncFS.write(
                this.fd, 
                buffer, 
                0, 
                buffer.length, 
                offset);
        });
    }
    
    async seek(offset) {
    
        if (!this.fd)
            throw new Error("File not open");
        
        if (offset < 0)
            throw new Error("Invalid file offset");
        
        this.position = offset;
    }
    
    static async open(path, flags, mode) {
        
        var info;
        
        try { info = await AsyncFS.stat(path) }
        catch (x) {}
        
        if (info && !info.isFile())
            throw new Error("File not found");
        
        var fd = await AsyncFS.open(path, flags || "r", mode),
            stream = new this(fd);
        
        stream.path = path;
        stream.length = info ? info.size : 0;
        
        return stream;
    }
    
}