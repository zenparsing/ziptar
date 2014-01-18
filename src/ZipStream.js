module ZLib from "node:zlib";

import { EventTarget, Event } from "EventTarget.js";

class DataEvent extends Event {

    constructor(data) {
    
        super("data");
        this.data = data;
    }
}

class ZipStream extends EventTarget {

    constructor(mode) {
    
        super();
        
        this.zlib = mode === "deflate" ? 
            ZLib.createDeflateRaw() :
            ZLib.createInflateRaw();
        
        this.zlib.on("data", data => {
        
            //var data = this.zlib.read();
            
            if (data !== null)
                this.dispatchEvent(new DataEvent(data)); 
        });
    }
    
    async read(buffer, start, length) {
    
        
        if (start === void 0) start = 0;
        if (length === void 0) length = buffer.length - start;
    }
    
    async write(buffer, start, length) {
    
        if (start === void 0) start = 0;
        if (length === void 0) length = buffer.length - start;
        
        await this._async(cb => this.zlib.write(buffer.slice(start, length), cb));
    }
    
    async end() {

        await this._async(cb => {
        
            this.zlib.on("end", cb);
            this.zlib.end();
        });
    }
    
    _async(fn) {
    
        return new Promise((resolve, reject) => {
        
            this.zlib.on("error", reject);
            
            fn($=> {
            
                this.zlib.removeListener("error", reject);
                resolve(null);
            });
        });
    }
}

export class InflateStream extends ZipStream {

    constructor() {
    
        super("inflate");
    }
}

export class DeflateStream extends ZipStream {

    constructor() {
    
        super("deflate");
    }
}

export class NullStream extends EventTarget {

    constructor() {
    
        super();
    }
    
    async write(buffer, start, length) {
    
        if (start === void 0) start = 0;
        if (length === void 0) length = (buffer.length - start);
        
        await 0; // v8 does not yet support empty yield
        
        if (buffer)
            this.dispatchEvent(new DataEvent(buffer.slice(start, length)));
    }
    
    async end() {
    
        await this.write();
    }
}
