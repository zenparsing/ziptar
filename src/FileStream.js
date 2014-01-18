import { AsyncFS } from "package:zen-bits";

export class FileStream {

    constructor() {
    
        this.file = 0;
        this.position = 0;
        this.path = "";
        this.size = 0;
        this.pending = { count: 0, promise: null, resolve: null };
    }

    async open(path, flags, mode) {
    
        if (this.file)
            throw new Error("File is currently open");
        
        // Wait for any pending file operations to complete
        // for the previously opened file.
        await this.pending.promise;
        
        var info;
        
        try { info = await AsyncFS.stat(path) }
        catch (x) {}
        
        if (info && !info.isFile())
            throw new Error("File not found");
        
        var fd = await AsyncFS.open(path, flags || "r", mode);
        
        this.file = fd;
        this.path = path;
        this.size = info ? info.size : 0;
    }
    
    async close() {
    
        if (this.file) {
        
            var fd = this.file;
            this.file = 0;
            
            await this.pending.promise;
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
        this.position = Math.min(this.size, this.position + length);
        
        this.pending += 1;
        
        var count = await this._startOp($=> AsyncFS.read(
            this.file, 
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
        this.position = this.position + length;

        return this._startOp($=> AsyncFS.write(
            this.file, 
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
    
        var stream = new FileStream;
        await stream.open(path, flags, mode);
        return stream;
    }
    
    _assertOpen() {
    
        if (!this.file)
            throw new Error("File is not open");
    }
    
    _startOp(fn) {
        
        if (this.pending.count === 0)
            this.pending.promise = new Promise(resolve => this.pending.resolve = resolve);
        
        this.pending.count += 1;
        
        var finished = $=> {
        
            this.pending.count -= 1;
            
            if (this.pending.count === 0)
                this.pending.resolve(null);
        };
        
        var promise = fn();
        promise.then(finished, finished);
        return promise;
    }
}