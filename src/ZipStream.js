import { EventTarget, Event } from "EventTarget.js";

import ZLib = "zlib";
import Async = "AsyncFlow.js";

class DataEvent extends Event {

    constructor(data) {
    
        super("data");
        this.data = data;
    }
}

class ZipStream extends EventTarget {

    constructor(deflate) {
    
        super();
        
        this.zlib = deflate ? ZLib.createDeflateRaw() : ZLib.createInflateRaw();
        this.zlib.on("data", data => this.dispatchEvent(new DataEvent(data)));
    }
    
    write(buffer) {
    
        var async = this._async();
        
        this.zlib.write(buffer, async.callback);
        return async.promise;
    }
    
    end() {

        var async = this._async();
        
        this.zlib.end(null, async.callback);
        return async.promise;
    }
    
    _async() {
    
        var async = Async.defer(),
            onErr = err => { async.reject(err); };
        
        this.zlib.on("error", onErr);
        
        return { 
        
            callback: () => {
        
                this.zlib.removeListener("error", onErr);
                async.resolve(null);
            },
            
            promise: async.promise
            
        };
    }
}

export class InflateStream extends ZipStream {

    constructor() {
    
        super(false);
    }
}

export class DeflateStream extends ZipStream {

    constructor() {
    
        super(true);
    }
}

export class NullStream extends EventTarget {

    constructor() {
    
        super();
    }
    
    write(data) {
    
        if (data)
            this.dispatchEvent(new DataEvent(data));
        
        return Async.when(null);
    }
    
    end() {
    
        return this.write(null);
    }
}
