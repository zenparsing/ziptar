import FS = "fs";

import Promise from "Promise.js";

// Wraps a standard Node async function with a promise
// generating function
function wrap(obj, name) {

	return function() {
	
		var a = [].slice.call(arguments, 0),
			promise = new Promise;
		
		a.push(function(err, data) {
		
			if (err) promise.reject(err);
			else promise.resolve(data);
		});
		
		if (name) obj[name].apply(obj, a);
    	else obj.apply(null, a);
		
		return promise.future;
	};
}

export var 
    exists = wrap(FS.exists),
    readFile = wrap(FS.readFile),
    close = wrap(FS.close),
    open = wrap(FS.open),
    read = wrap(FS.read),
    write = wrap(FS.write),
    rename = wrap(FS.rename),
    truncate = wrap(FS.truncate),
    rmdir = wrap(FS.rmdir),
    fsync = wrap(FS.fsync),
    mkdir = wrap(FS.mkdir),
    sendfile = wrap(FS.sendfile),
    readdir = wrap(FS.readdir),
    fstat = wrap(FS.fstat),
    lstat = wrap(FS.lstat),
    stat = wrap(FS.stat),
    readlink = wrap(FS.readlink),
    symlink = wrap(FS.symlink),
    link = wrap(FS.link),
    unlink = wrap(FS.unlink),
    fchmod = wrap(FS.fchmod),
    lchmod = wrap(FS.lchmod),
    chmod = wrap(FS.chmod),
    lchown = wrap(FS.lchown),
    fchown = wrap(FS.fchown),
    chown = wrap(FS.chown),
    utimes = wrap(FS.utimes),
    futimes = wrap(FS.futimes),
    writeFile = wrap(FS.writeFile),
    appendFile = wrap(FS.appendFile),
    realpath = wrap(FS.realpath)
;


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
        
        return stat(path)
        .then(null, err => null)
        .then(info => {
        
            if (info && !info.isFile())
                throw new Error("File not found.");
            
            return open(path, flags || "r", mode).then(fd => { 
            
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
            return close(fd);
        }
        
        return Promise.when(null);
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
        
        return read(this.file, buffer, start, length, offset);
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
        
        return write(this.file, buffer, start, length, offset);
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