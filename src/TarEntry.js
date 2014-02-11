import { TarHeader } from "TarHeader.js";
import { normalizePath, zeroFill } from "Utilities.js";

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
        this.mode = 0;
        this.userID = 0;
        this.groupID = 0;
        this.size = 0;
        this.lastModified = new Date();
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
            this.fillBytes = 512 - (this.remaining % 512);
        }
    
        return {
        
            read: buffer => {
    
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
            }
            
        };
    }
    
}

export class TarEntryWriter extends TarEntry {

    constructor(name) {
    
        super();
        
        this.name = name;
        
        if (this.name.endsWith("/"))
            this.type = "directory";
    }
    
    async open() {
    
        if (!this.stream)
            throw new Error("No output stream");
        
        var header = TarHeader.fromEntry(this),
            extended = header.getOverflow();
        
        // Copy attributes to extended collection
        Object.keys(this.attributes).forEach(k => extended[k] = this.attributes[k]);
        
        // Write the extended header
        await this._writeExtended(extended);
        
        // Write the entry header
        await this.stream.write(header.write());
        
        var remaining = NO_SIZE[this.type] ? 0 : this.size;
        remaining += remaining % 512;
        
        return {
        
            write: buffer => {
            
                await this.stream.write(buffer);
                
                remaining -= buffer.length;
                
                if (remaining < 0)
                    throw new Error("Invalid entry length");
            },
            
            end: $=> {
            
                if (remaining > 0) {
                
                    var buffer = zeroFill(Math.min(remaining, 16 * 1024)),
                        data;
                    
                    while (remaining > 0) {
                    
                        data = remaining < buffer.length ? 
                            buffer.slice(0, remaining) : 
                            buffer;
                        
                        await this.stream.write(data);
                        
                        remaining -= data.length;
                    }
                }
                
                await this.stream.end();
            }
            
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
        await entry.write(data);
        await entry.close();
    }
    
}
