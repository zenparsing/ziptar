import { AsyncFS } from "package:zen-bits";
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
    
    async read(buffer, start, length) {
    
        return this.mutex.lock($=> {
        
            this._assertOpen();
        
            if (start === void 0) start = 0;
            if (length === void 0) length = buffer.length - start;

            var offset = this.position;
            this.position = Math.min(this.length, this.position + length);

            var count = await AsyncFS.read(
                this.fd, 
                buffer, 
                start, 
                length, 
                offset);
            
            return count === 0 ? null : buffer.slice(start, count);
            
        });
    }
    
    async write(buffer, start, length) {
    
        return this.mutex.lock($=> {
        
            this._assertOpen();
        
            if (!buffer || buffer.length === 0)
                return;
        
            if (start === void 0) start = 0;
            if (length === void 0) length = buffer.length - start;
        
            var offset = this.position;
            this.position += length;

            return AsyncFS.write(
                this.fd, 
                buffer, 
                start, 
                length, 
                offset);
        });
    }
    
    async seek(offset) {
    
        this._assertOpen();
        
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
    
    _assertOpen() {
    
        if (!this.fd)
            throw new Error("File is not open");
    }
    
}