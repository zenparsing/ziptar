/*

This EventTarget implementation differs from DOM3 EventTargets in the following
ways:

- There is no capture phase.
- Listeners must be functions.  They cannot be EventListener objects.
- There is no way to tell if a DOM event has been stopped by a handler.
  Instead, we check a "propagationStopped" property on the event object.
- stopImmediatePropagation is not implemented.

*/

function listeners(obj, type) {

	var list = obj.eventListeners[type];
	
	if (!list) 
	    list = obj.eventListeners[type] = [];
	
	return list;
}

function fire(obj, evt) {

	var list = listeners(obj, evt.type),
	    len = list.length,
	    i,
	    x;
	
	for (i = 0; i < len; ++i) {
	
	    x = list[i].call(obj, evt);
	    
	    if (Promise.isPromise(x))
	        x.then(null, x => setTimeout($=> { throw x }, 0));
	}
}

export class EventTarget {

    constructor() {
    
        this.eventListeners = {};
        this.parentEventTarget = null;
    }
    
    on(type, handler) {
    
        return this.addEventListener(type, handler);
    }
    
    addEventListener(type, handler) {
    
        if (typeof handler !== "function")
            throw new Error("Listener is not a function");
        
        var a = listeners(this, type), 
            i = a.indexOf(handler);
            
        if (i === -1) 
            a.push(handler);
    }
    
    removeEventListener(type, handler) {
    
        var a = list(this, type), 
            i = a.indexOf(handler);
        
    	if (i !== -1) 
    	    a.splice(i, 1);
    }
    
    dispatchEvent(evt) {
    
        evt.target = this;
        
        // At target phase
        fire(evt.currentTarget = this, evt);
        
        // Bubble phase
        if (evt.bubbles) {
        
            for (var target = this.parentEventTarget; 
                 target && !evt.propagationStopped; 
                 target = target.parentEventTarget) {
                
                fire(evt.currentTarget = target, evt);
            }
        }
        
        // Reset current target for default actions
        evt.currentTarget = null;
        
        return !evt.defaultPrevented;
    }
}

export class Event {

    constructor(type, bubbles, cancellable) {
    
        this.type = type;
        this.timeStamp = new Date();
        this.bubbles = !!bubbles;
        this.cancelable = !!cancellable;
        this.currentTarget = null;
        this.target = null;
        this.defaultPrevented = false;
        this.propagationStopped = false;
    }
    
    stopPropagation() {
    
        this.propagationStopped = true;
    }
    
    preventDefault() {
    
        this.defaultPrevented = true;
    }
    
}

