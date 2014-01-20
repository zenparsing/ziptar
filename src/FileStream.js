import { AsyncFS } from "package:zen-bits";
import { AsyncGate } from "AsyncGate.js";

export class FileStream {

    constructor(fd) {
    
        this.fd = fd || 0;
        this.position = 0;
        this.path = "";
        this.length = 0;
        this.pending = 0;
        this.flushGate = new AsyncGate;
    }
    
    async close() {
    
        if (this.fd) {
        
            var fd = this.fd;
            this.fd = 0;
            
            await this.flushGate.promise;
            await AsyncFS.close(fd);
        }
    }

    async end() {
    
        await this.close();
    }
    
    async read(buffer, start, length) {
    
        this._assertOpen();
        
        if (start === void 0) start = 0;
        if (length === void 0) length = buffer.length - start;
        
        var offset = this.position;
        this.position = Math.min(this.length, this.position + length);

        var count = await this._startOp($=> AsyncFS.read(
            this.fd, 
            buffer, 
            start, 
            length, 
            offset));
        
        return count === 0 ? null : buffer.slice(start, count);
    }
    
    async write(buffer, start, length) {
    
        this._assertOpen();
        
        if (!buffer || buffer.length === 0)
            return;
        
        if (start === void 0) start = 0;
        if (length === void 0) length = buffer.length - start;
        
        var offset = this.position;
        this.position += length;

        return this._startOp($=> AsyncFS.write(
            this.fd, 
            buffer, 
            start, 
            length, 
            offset));
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
    
    _startOp(fn) {
        
        this.flushGate.close();
        this.pending += 1;
        
        var finished = $=> {
        
            this.pending -= 1;
            
            if (this.pending === 0)
                this.flushGate.open();
        };
        
        var promise = fn();
        promise.then(finished, finished);
        return promise;
    }
}