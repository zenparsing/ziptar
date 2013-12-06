import { AsyncFS } from "package:zen-bits";

export class FileStream {

    constructor() {
    
        this.file = 0;
        this.position = 0;
        this.path = "";
        this.size = 0;
    }

    open(path, flags, mode) {
    
        if (this.file)
            throw new Error("File already open.");
        
        return AsyncFS.stat(path)
        .then(null, err => null)
        .then(info => {
        
            if (info && !info.isFile())
                throw new Error("File not found.");
            
            return AsyncFS.open(path, flags || "r", mode).then(fd => { 
            
                this.file = fd;
                this.path = path;
                this.size = info ? info.size : 0;
            
                return this;
            });
        });
    }
    
    close() {
    
        if (this.file) {
        
            var fd = this.file;
            this.file = 0;
            return AsyncFS.close(fd);
        }
        
        return Promise.resolve(null);
    }

    end() {
    
        return this.close();
    }
    
    readBytes(count) {
    
        var buffer = new Buffer(count);
        return this.read(buffer, 0, count).then(bytes => bytes < count ? buffer.slice(0, bytes) : buffer);
    }
    
    read(buffer, start, length) {
    
        this._assertOpen();
        
        if (start === void 0) start = 0;
        if (length === void 0) length = (buffer.length - start);
        
        var offset = this.position;
        this.position = Math.min(this.size, this.position + length);
        
        return AsyncFS.read(this.file, buffer, start, length, offset);
    }
    
    write(buffer, start, length) {
    
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