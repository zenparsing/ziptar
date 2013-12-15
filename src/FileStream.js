import { AsyncFS } from "package:zen-bits";

export class FileStream {

    constructor() {
    
        this.file = 0;
        this.position = 0;
        this.path = "";
        this.size = 0;
    }

    async open(path, flags, mode) {
    
        if (this.file)
            throw new Error("File already open.");
        
        var info;
        
        try { info = await AsyncFS.stat(path) }
        catch (x) {}
        
        if (info && !info.isFile())
            throw new Error("File not found.");
        
        var fd = await AsyncFS.open(path, flags || "r", mode);
        
        this.file = fd;
        this.path = path;
        this.size = info ? info.size : 0;
        
        return this;
    }
    
    async close() {
    
        if (this.file) {
        
            var fd = this.file;
            this.file = 0;
            
            return AsyncFS.close(fd);
        }
        
        return null;
    }

    end() {
    
        return this.close();
    }
    
    async readBytes(count) {
    
        var buffer = new Buffer(count);
        var bytes = await this.read(buffer, 0, count);
        
        return bytes < count ? buffer.slice(0, bytes) : buffer;
    }
    
    async read(buffer, start, length) {
    
        this._assertOpen();
        
        if (start === void 0) start = 0;
        if (length === void 0) length = (buffer.length - start);
        
        var offset = this.position;
        this.position = Math.min(this.size, this.position + length);
        
        return AsyncFS.read(this.file, buffer, start, length, offset);
    }
    
    async write(buffer, start, length) {
    
        this._assertOpen();
        
        if (start === void 0) start = 0;
        if (length === void 0) length = (buffer.length - start);
        
        var offset = this.position;
        this.position = this.position + length;
        
        // TODO: If the user calls write again before the promise is
        // resolved, then we're going to need to queue buffers.  Or does 
        // fs.write queue internally???
        
        return AsyncFS.write(this.file, buffer, start, length, offset);
    }
    
    seek(offset) {
    
        this._assertOpen();
        
        if (offset < 0)
            throw new Error("Invalid offset.");
        
        this.position = offset;
    }
    
    _assertOpen() {
    
        if (!this.file)
            throw new Error("File is not open.");
    }
    
    _alloc(length) {
    
    }
}