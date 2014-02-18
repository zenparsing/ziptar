import { TarHeader } from "TarHeader.js";
import { TarExtended } from "TarExtended.js";
import { normalizePath, zeroFill } from "Utilities.js";
import { Mutex } from "Mutex.js";

var OCTAL_755 = 493,
    OCTAL_644 = 420;

var NO_SIZE = {

    "link": 1,
    "symlink": 1,
    "character-device": 1,
    "block-device": 1,
    "directory": 1,
    "fifo": 1
};

class TarEntry {

    constructor() {
    
        this.name = "";
        this.mode = OCTAL_644;
        this.userID = 0;
        this.groupID = 0;
        this.size = 0;
        this.lastModified = new Date;
        this.type = "file";
        this.linkPath = "";
        this.userName = "";
        this.groupName = "";
        this.deviceMajor = 0;
        this.deviceMinor = 0;
        this.attributes = {};
        this.stream = null;
    }
    
    get name() { return this._name }
    set name(value) { this._name = normalizePath(value || "") }
    
    get isDirectory() { 
    
        switch (this.type) {
        
            case "directory":
            case "gnu-directory": return true;
            default: return false;
        }
    }
    
    get isFile() { 
    
        switch (this.type) {
        
            case "file":
            case "contiguous-file": return true;
            default: return false;
        }
    }
    
}

export class TarEntryReader extends TarEntry {

    constructor() {
    
        super();
        
        this.remaining = -1;
        this.fillBytes = -1;
    }

    async open() {
    
        if (!this.stream)
            throw new Error("No input stream");
        
        if (this.remaining < 0) {
        
            this.remaining = NO_SIZE[this.type] ? 0 : this.size;
            this.fillBytes = 512 - (this.remaining % 512 || 512);
        }
        
        var mutex = new Mutex;
    
        return {
        
            read: buffer => mutex.lock($=> {
    
                if (this.remaining === 0)
                    return null;
        
                if (this.remaining < buffer.length)
                    buffer = buffer.slice(0, this.remaining);
        
                var read = await this.stream.read(buffer);
        
                if (read) {
        
                    this.remaining -= read.length;
            
                    // Read past block padding
                    if (this.remaining === 0 && this.fillBytes > 0)
                        await this.stream.read(new Buffer(this.fillBytes));
            
                } else {
        
                    this.remaining = 0;
                }
        
                return read;
                
            })
            
        };
    }
    
}

export class TarEntryWriter extends TarEntry {

    constructor(name) {
    
        super();
        
        this.name = name;
        
        if (this.name.endsWith("/")) {
        
            this.type = "directory";
            this.mode = OCTAL_755;
        }
    }
    
    async open() {
    
        if (!this.stream)
            throw new Error("No output stream");
        
        var header = TarHeader.fromEntry(this),
            extended = header.getOverflow(),
            mutex = new Mutex;
        
        // Copy attributes to extended collection
        Object.keys(this.attributes).forEach(k => extended[k] = this.attributes[k]);
        
        // Write the extended header
        if (Object.keys(extended).length > 0)
            await this._writeExtended(extended);
        
        // Write the entry header
        await this.stream.write(header.write());
        
        var remaining = NO_SIZE[this.type] ? 0 : this.size;
        remaining += 512 - (remaining % 512 || 512);
        
        return {
        
            write: buffer => mutex.lock($=> {
            
                await this.stream.write(buffer);
                
                remaining -= buffer.length;
                
                if (remaining < 0)
                    throw new Error("Invalid entry length");
            }),
            
            end: $=> mutex.lock($=> {
            
                if (remaining <= 0)
                    return;
                
                var buffer = zeroFill(Math.min(remaining, 8 * 1024)),
                    data;
                
                while (remaining > 0) {
                
                    data = remaining < buffer.length ? 
                        buffer.slice(0, remaining) : 
                        buffer;
                    
                    await this.stream.write(data);
                    
                    remaining -= data.length;
                }
            })
            
        };
    }
    
    async _writeExtended(fields) {
    
        // Don't write extended attributes for attributes entries
        switch (this.type) {
        
            case "extended-attributes":
            case "global-attributes":
            case "old-extended-attributes":
                return;
        }
        
        var data = TarExtended.write(fields);
        
        var entry = new TarEntryWriter("._" + this.name);
        entry.type = "extended-attributes";
        entry.stream = this.stream;
        entry.size = data.length;
        
        var stream = await entry.open();
        await stream.write(data);
        await stream.end();
    }
    
}
