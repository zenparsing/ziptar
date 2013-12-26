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
    
    write(buffer) {
    
        var async = this._async();
        
        this.zlib.write(buffer, async.callback);
        return async.promise;
    }
    
    end() {

        var async = this._async();
        
        this.zlib.on("end", async.callback);
        this.zlib.end();
        
        return async.promise;
    }
    
    _async() {
    
        var resolver,
            promise = new Promise((resolve, reject) => resolver = { resolve, reject }),
            onErr = err => resolver.reject(err);
        
        this.zlib.on("error", onErr);
        
        return { 
        
            callback: $=> {
        
                this.zlib.removeListener("error", onErr);
                resolver.resolve(null);
            },
            
            promise
            
        };
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
    
    write(data) {
    
        if (data)
            this.dispatchEvent(new DataEvent(data));
        
        return Promise.resolve(null);
    }
    
    end() {
    
        return this.write(null);
    }
}
