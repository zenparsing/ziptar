export class AsyncGate {

    constructor() {
    
        this.set = true;
        this.deferred = null;
        
        this.close();
    }
    
    open(value) {
    
        if (this.set)
            throw new Error("Value is already set");
        
        this.set = true;
        this.deferred.resolve(value);
    }
    
    close() {
    
        if (!this.set)
            return;
        
        this.set = false;
        
        var d = this.deferred = {};
        
        d.promise = new Promise((resolve, reject) => {
        
            d.resolve = resolve;
            d.reject = reject;
        });
    }
    
    get promise() { return this.deferred.promise }
    
}