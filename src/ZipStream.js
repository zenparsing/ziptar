import { EventTarget, Event } from "EventTarget.js";
import Promise from "Promise.js";

module ZLib = "zlib";

class DataEvent extends Event {

    constructor(data) {
    
        super("data");
        this.data = data;
    }
}

class ZipStream extends EventTarget {

    constructor(mode) {
    
        super();
        
        this.zlib = mode === "deflate" ? ZLib.createDeflateRaw() : ZLib.createInflateRaw();
        this.zlib.on("data", data => this.dispatchEvent(new DataEvent(data)));
    }
    
    write(buffer) {
    
        var async = this._async();
        
        this.zlib.write(buffer, async.callback);
        return async.future;
    }
    
    end() {

        var async = this._async();
        
        this.zlib.end(null, async.callback);
        return async.future;
    }
    
    _async() {
    
        var promise = new Promise,
            onErr = err => { promise.reject(err); };
        
        this.zlib.on("error", onErr);
        
        return { 
        
            callback: () => {
        
                this.zlib.removeListener("error", onErr);
                promise.resolve(null);
            },
            
            future: promise.future
            
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
        
        return Promise.when(null);
    }
    
    end() {
    
        return this.write(null);
    }
}
