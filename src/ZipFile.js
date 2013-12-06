module Path from "node:path";

import { AsyncFS, PromiseExtensions } from "package:zen-bits";
import { EndHeader } from "EndHeader.js";
import { ZipEntry } from "ZipEntry.js";
import { FileStream } from "FileStream.js";

var BUFFER_SIZE = 8 * 1024;

function dirname(path) {

    return path.replace(/[^\/]+(\/)?$/, "");
}

// Creates a directory, if it doesn't already exist
function createDirectory(path) {

    return AsyncFS.stat(path).then(null, err => null).then(stat => {
    
        // Verify that destination is not something other than a directory
        if (stat && !stat.isDirectory())
            throw new Error("Path is not a directory.");
        
        // Create directory if necessary
        if (!stat)
            return AsyncFS.mkdir(path).then(value => null);
        
        return null;
    });
}

export class ZipFile {

    constructor() {

        this.fileStream = new FileStream;
        this.comment = "";
        this.entries = [];
        this.entryTable = {};
    }
    
    get file() { return this.fileStream.file; }
    get size() { return this.fileStream.size; }
    
    getEntryNames() {
    
        return Object.keys(this.entryTable);
    }
    
    hasEntry(name) {
    
        return typeof this.entryTable[name] === "number";
    }
    
    getChildEntryNames(name) {
    
        return this.entries.filter(path => path !== name && path.indexOf(name) === 0);
    }
    
    getEntry(name) {
    
        var index = this.entryTable[name];
        
        if (typeof index !== "number")
            throw new Error("Entry not found.");
        
        return this.entries[index];
    }
    
    deleteEntry(name) {
    
        var index = this.entryTable[name];
        
        if (typeof index === "number") {
        
            delete this.entryTable[name];
            this.entries.splice(index, 1);
        }
        
        // Delete child entries
        this.getChildEntryNames(name).forEach(path => {
        
            index = this.entryTable[path];
            
            delete this.entryTable[name];
            this.entries.splice(index, 1);
        });
    }
    
    setEntry(entry) {
    
        var d = entry.name;
        
        // Add entries for parent directories
        while (d = dirname(d))
            if (!this.hasEntry(d))
                this.setEntry(new ZipEntry(d));
        
        var index = this.entryTable[entry.name];
        
        if (typeof index !== "number")
            index = this.entries.length;
        
        this.entries[index] = entry;
        this.entryTable[entry.name] = index;
    }
    
    addFile(path, dest) {
    
        path = Path.resolve(path);
        dest = this._destination(dest);
        
        return AsyncFS.stat(path).then(stat => {
            
            var base = Path.basename(path),
                isDir = stat.isDirectory(),
                entry;
            
            if (!isDir && !stat.isFile())
                throw new Error("Invalid path.");
            
            entry = new ZipEntry(dest + base + (isDir ? "/" : ""));
            entry.lastModified = stat.mtime;
            entry.source = path;
            
            this.setEntry(entry);
            
            if (isDir) {
            
                return AsyncFS.readdir(path).then(list => {
                
                    list = list
                        .filter(item => item !== ".." && item !== ".")
                        .map(item => Path.join(path, item));
                    
                    return this.addFiles(list, entry.name);
                });
            
            }
            
            return this;
        });
    }
    
    addFiles(list, dest) {
    
        dest = this._destination(dest);
        
        if (typeof list === "string")
            list = [list];
        
        list = list.map(path => this.addFile(path, dest));
        
        return Promise.all(list).then(val => this);
    }
    
    write(dest) {
    
        dest = Path.resolve(dest);
        
        // Sort entries so that already compressed entries come first 
        var list = this.getEntryNames().sort((a, b) => {
        
            if (a.source && !b.source)
                return 1;
            
            if (b.source && !a.source)
                return -1;
            
            return a.toLowerCase().localeCompare(b.toLowerCase());
        });
        
        return new FileStream().open(dest, "w").then(outStream => {
        
            var buffer = this._createBuffer(),
                queue = list.slice(0);
            
            // Compress all files
            return PromiseExtensions.forEach(queue, entryName => {
            
                var entry = this.getEntry(entryName);
                
                if (entry.isDirectory)
                    return outStream.write(entry.packDataHeader());
                
                return new FileStream()
                    .open(entry.source)
                    .then(inStream => entry.compress(inStream, outStream, buffer));
            
            }).then(val => {
            
                var start = outStream.position;
                
                // Write central directory
                for (var i = 0; i < list.length; ++i)
                    outStream.write(this.getEntry(list[i]).packHeader());
                
                // Pack end of central directory 
                var endHeader = EndHeader.toBuffer({
                
                    volumeEntries: list.length,
                    totalEntries: list.length,
                    size: outStream.position - start,
                    offset: start,
                    commentLength: Buffer.byteLength(this.comment)
                    
                });
                
                // Add comment
                endHeader.write(this.comment, EndHeader.LENGTH);
                
                // Write end-of-central-directory header
                return outStream.write(endHeader);
            });
            
        }).then(val => this);
    }
    
    close() {
    
        return this.fileStream.close().then(val => this);
    }
    
    extractAll(dest) {
    
        return this.extractDirectory("", dest);
    }
    
    extractDirectory(name, dest) {
    
        dest = Path.resolve(dest);
        
        this._assertOpen();
        
        var buffer = this._createBuffer(),
            names;
        
        if (name = name || "") {
        
            // Verify the entry is a directory
            if (!this.getEntry(name).isDirectory)
                throw new Error("Not a directory");
            
            // Get the names that are children of this entry
            names = this.getChildEntryNames(path);
            
        } else {
        
            // Get all entries
            names = this.getEntryNames();
        }
        
        // Sort alphabetically to ensure that directories come before their contents
        names = names.sort();
        
        // Create the directory
        return createDirectory(dest).then(value => {
        
            return PromiseExtensions.forEach(names, entryName => {
            
                var entry = this.getEntry(entryName),
                    outName = Path.join(dest, entryName.slice(name.length));
                
                if (entry.isDirectory) {
                
                    // Create the directory
                    return createDirectory(outName);
                    
                } else {
                
                    // Create the output file
                    return this.extractFile(entry.name, outName, buffer);
                }
                
            });
        
        }).then(val => this);
    }
    
    extractFile(name, dest, buffer) {
    
        dest = Path.resolve(dest);
        
        this._assertOpen();
        
        var entry = this.getEntry(name),
            buffer = buffer || this._createBuffer(),
            outStream = new FileStream;
        
        return outStream
            .open(dest, "w")
            .then(val => entry.extract(this.fileStream, outStream, buffer))
            .then(val => AsyncFS.utimes(dest, new Date(), entry.lastModified))
            .then(val => this);
    }
    
    // Opens a zip file and reads the central directory
    open(path) {
    
        path = Path.resolve(path);
        
        var file = this.fileStream,
            endOffset;
        
        return file.open(path).then(val => {
            
            // === Read the Index Header ===
            
            var end = file.size - EndHeader.LENGTH, // Last possible location of start of end header
                start = Math.max(0, end - 0xffff); // First possible location of start of end header
            
            file.seek(start);
            
            // Read the end-of-central-directory header
            return file.readBytes(file.size - start).then(buffer => {
            
                var offset = -1;
                
                // Search backward until we find the start of the header
                for (var i = end - start; i >= 0; --i) {
                
                    // Skip if byte is not "P"
                    if (buffer[i] != 0x50) 
                        continue;
                    
                    // Look for header start value
                    if (buffer.readUInt32LE(i) === EndHeader.SIGNATURE) {
                    
                        offset = i;
                        break;
                    }
                }
                
                if (offset === -1)
                    throw new Error("Cannot find header start.");
                
                endOffset = start + offset;
                
                // Read header
                var header = EndHeader.fromBuffer(buffer, offset);
                
                // Read optional comment
                if (header.commentLength) {
                
                    offset += EndHeader.LENGTH;
                    this.comment = buffer.toString("utf8", offset, offset + header.commentLength);
                }
                
                return header;
                
            });
            
        }).then(header => {
            
            // === Read the Entry Headers ===
            
            file.seek(header.offset);
            
            // Read all file entires into a single buffer
            return file.readBytes(endOffset - header.offset).then(buffer => {
            
                var count = 0,
                    entry, 
                    i;
                
                // Read each file entry
                for (i = 0; i < header.volumeEntries; ++i) {
                
                    entry = new ZipEntry();
                    buffer = buffer.slice(count);
                    count = entry.readHeader(buffer);
                    
                    this.setEntry(entry);
                }
                
                return this;
            });
        });
    }
    
    _assertOpen() {
    
        if (!this.file)
            throw new Error("No open file");
    }
    
    _destination(name) {
    
        if (name) {
        
            if (!name.endsWith("/"))
                name += "/";
            
            if (!this.hasEntry(name))
                throw new Error("Invalid destination.");
            
        } else {
        
            name = "";
        }
        
        return name;
    }
    
    _createBuffer() {
    
        return new Buffer(Math.min(BUFFER_SIZE, this.fileStream.size || BUFFER_SIZE));
    }
}
