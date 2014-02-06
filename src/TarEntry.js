import { TarHeader } from "TarHeader.js";

class TarEntry {

    constructor(name) {
    
        this.name = name;
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
        
        if (this.isDirectory)
            this.type = "directory";
    }
    
    get name() { return this._name }
    set name(value) { this._name = normalizePath(value || "") }
    
    get isDirectory() { return this.name.endsWith("/") }
    
}

export class TarEntryReader extends TarEntry {

    async open() {
    
        // Provide a read stream for the entry content, if it has content
    }
}

export class TarEntryWriter extends TarEntry {

    async open() {
    
        // Write the extended header for overflowing metadata
        
        // Write the header
        
        // If the item is a file (has content), then provide a stream
        // for writing the output.  (Note:  need to provide the size
        // in advance.  Throw if written size does not equal that size.)
        
        // On end, zero fill the last block
    }
}
