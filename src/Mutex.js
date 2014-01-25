
export class Condition {

    constructor() {
    
        this.state = true;
        this.deferred = null;
        this.set(false);
    }
    
    wait(reset) {
    
        if (!this.state)
            return this.deferred.promise.then($=> this.wait(reset));
        
        if (reset) this.state = false;
        return null;
    }
    
    set(state) {
    
        if (state === undefined)
            state = true;
        
        // No-op if state is not changing
        if (state === this.state)
            return;
        
        this.state = state;
        
        if (this.state) {
        
            this.deferred.resolve();
        
        } else {
        
            var d = this.deferred = {};
        
            d.promise = new Promise((resolve, reject) => {
        
                d.resolve = resolve;
                d.reject = reject;
            });
        }
    }
    
}

export class Mutex {

    constructor() {
        
        this.condition = new Condition;
        this.condition.set(true);
    }
    
    enter() {
    
        return this.condition.wait(true);
    }
    
    leave() {
    
        this.condition.set(true);
    }
    
    async lock(fn) {
    
        await this.enter();
        
        var x;
        
        try { x = fn() }
        finally { this.leave() }
        
        return x;
    }
}